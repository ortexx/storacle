const path = require('path');
const url = require('url');
const fs = require('fs');
const fse = require('fs-extra');
const fetch = require('node-fetch');
const _ = require('lodash');
const SplayTree = require('splaytree');
const bytes = require('pretty-bytes');
const Node = require('spreadable/src/node')();
const CacheDatabaseStoracle = require('spreadable/src/cache/transports/database')();
const DatabaseLokiStoracle = require('./db/transports/loki')();
const ServerExpressStoracle = require('./server/transports/express')();
const utils = require('./utils');
const errors = require('./errors');
const schema = require('./schema');
const pack = require('../package.json');

module.exports = (Parent) => {
  /**
   * Class to manage the storacle node
   */
  return class NodeStoracle extends (Parent || Node) {
    static get version () { return pack.version }
    static get codename () { return 'storacle' }
    static get DatabaseTransport () { return DatabaseLokiStoracle }
    static get ServerTransport () { return ServerExpressStoracle }
    static get CacheFileTransport () { return CacheDatabaseStoracle }

    /**
     * @see Node
     */
    constructor(options = {}) {
      options = _.merge({      
        request: { 
          clientStoringConcurrency: 20,
          fileStoringNodeTimeout: '2h',
          cacheTimeout: 250
        },
        storage: { 
          dataSize: '45%',
          tempSize: '45%',
          tempLifetime: '2h',
          autoCleanSize: 0
        },
        file: {          
          maxSize: '50%',
          preferredDublicates: 'auto',
          responseCacheLifetime: '7d',
          mimeWhitelist: [],
          mimeBlacklist: [],
          extWhitelist: [],
          extBlacklist: [],
          linkCache: {
            limit: 50000,
            lifetime: '7d'
          }         
        },
        task: {
          cleanUpStorageInterval: '30s',
          cleanUpTempDirInterval: '20s',
          calculateStorageInfoInterval: '2s'
        }
      }, options);

      super(options);  
      this.storageDataSize = 0;
      this.storageTempSize = 0;
      this.storageAutoCleanSize = 0;
      this.fileMaxSize = 0;
      this.CacheFileTransport = this.constructor.CacheFileTransport;
      this.__dirNestingSize = 2;
      this.__dirNameLength = 1;
      this.__blockedFiles = {};
    }    

    /**
     * @see Node.prototype.init
     */
    async init() {      
      await super.init.apply(this, arguments); 
      this.filesPath = path.join(this.storagePath, 'files');
      this.tempPath = path.join(this.storagePath, 'tmp');
      await fse.ensureDir(this.filesPath); 
      await fse.ensureDir(this.tempPath);
      await this.calculateStorageInfo();
    }

    /**
     * @see Node.prototype.destroy
     */
    async destroy() {
      await fse.remove(this.storagePath);
      super.destroy();
    }   

    /**
     * @see Node.prototype.prepareServices
     */
    async prepareServices() {
      await super.prepareServices();

      if(this.options.file.linkCache) {
        this.cacheFile = new this.CacheFileTransport(this, 'file', this.options.file.linkCache);
      }

      if(!this.task) {
        return;
      }

      if(this.options.task.cleanUpStorageInterval) {
        await this.task.add('cleanUpStorage', this.options.task.cleanUpStorageInterval, () => this.cleanUpStorage());
      }
      
      if(this.options.task.cleanUpTempDirInterval) {
        await this.task.add('cleanUpTempDir', this.options.task.cleanUpTempDirInterval, () => this.cleanUpTempDir());
      }
      
      if(this.options.task.calculateStorageInfoInterval) {
        await this.task.add('calculateStorageInfo', this.options.task.calculateStorageInfoInterval, () => this.calculateStorageInfo());
      }
    }

    /**
     * @see Node.prototype.initServices
     */
    async initServices() {
      await super.initServices();
      this.cacheFile && await this.cacheFile.init();
    }

    /**
     * @see Node.prototype.deinitServices
     */
    async deinitServices() {
      await super.deinitServices();
      this.cacheFile && await this.cacheFile.deinit(); 
    }

    /**
     * @see Node.prototype.deinitServices
     */
    async destroyServices() {
      await super.destroyServices();
      this.cacheFile && await this.cacheFile.destroy(); 
    }

     /**
     * @see Node.prototype.sync
     */
    async sync() {
      await super.sync.apply(this, arguments);
      this.cacheFile && await this.cacheFile.normalize();
    }

    /**
     * @see Node.prototype.getStatusInfo
     */
    async getStatusInfo(pretty = false) {      
      const storage = await this.getStorageInfo();

      if(pretty) {
        for(let key in storage) {
          storage[key] = bytes(storage[key]);
        }
      }

      return _.merge(await super.getStatusInfo(pretty), storage, {
        filesCount: await this.db.getData('filesCount')
      });
    }

    /**
     * Calculate the storage info
     * 
     * @async
     */
    async calculateStorageInfo() {     
      const info = await utils.getDiskInfo(this.filesPath);
      const used = await this.getStorageTotalSize();    
      const tempDirInfo = await this.getTempDirInfo();
      this.storageDataSize = this.options.storage.dataSize;
      this.storageTempSize = this.options.storage.tempSize;
      this.storageAutoCleanSize = this.options.storage.autoCleanSize;
      this.fileMaxSize = this.options.file.maxSize;
      const available = info.available + used + tempDirInfo.size;
      
      if(typeof this.storageDataSize == 'string') {
        this.storageDataSize = Math.floor(available * parseFloat(this.storageDataSize) / 100);
      }
      
      if(typeof this.storageTempSize == 'string') {
        this.storageTempSize = Math.floor(available * parseFloat(this.storageTempSize) / 100);
      }

      if(this.storageDataSize > available) {
        this.storageDataSize = available;
        this.logger.warn(`"storage.dataSize" is greater than available disk space`);
      }
      
      if(this.storageTempSize > available) {
        this.storageTempSize = available;
        this.logger.warn(`"storage.tempSize" is greater than available disk space`);
      }
      
      const dev = (this.storageDataSize + this.storageTempSize) / available; 
      
      if(dev > 1) {
        this.storageDataSize = Math.floor(this.storageDataSize / dev);
        this.storageTempSize =  Math.floor(this.storageTempSize / dev);
        this.logger.warn(`"storage.dataSize" + "storage.tempSize" is greater than available disk space`);
      }

      if(typeof this.storageAutoCleanSize == 'string') {
        this.storageAutoCleanSize = Math.floor(this.storageDataSize * parseFloat(this.storageAutoCleanSize) / 100);
      }

      if(typeof this.fileMaxSize == 'string') {
        this.fileMaxSize = Math.floor(this.storageDataSize * parseFloat(this.fileMaxSize) / 100);
      }
      
      if(this.storageAutoCleanSize > this.storageDataSize) {
        this.storageAutoCleanSize = this.storageDataSize;
        this.logger.warn(`"storage.autoCleanSize" is greater than "storage.dataSize"`);
      }
      
      if(this.fileMaxSize > this.storageDataSize) {
        this.fileMaxSize = this.storageDataSize;
        this.logger.warn(`"file.maxSize" is greater than "storage.dataSize"`);
      }

      if(this.fileMaxSize > this.tempSize) {
        this.fileMaxSize = this.tempSize;
        this.logger.warn(`"file.maxSize" is greater than "storage.tempSize"`);
      }
    }

    /**
     * Get the file storing filter options
     * 
     * @async
     * @param {object} info
     * @returns {object}
     */
    async getFileStoringFilterOptions(info) {
      return {
        fnCompare: await this.createSuscpicionComparisonFunction('storeFile', await this.createFileStoringComparisonFunction()),
        fnFilter: c => !c.existenceInfo && c.isAvailable,
        schema: schema.getFileStoringInfoSlaveResponse(),
        limit: await this.getFileDuplicatesCount(info)   
      }
    }

    /**
     * Create a file storing comparison function
     * 
     * @async
     * @returns {function}
     */
    async createFileStoringComparisonFunction() {
      return (a, b) => b.free - a.free;
    }

    /**
     * Get the file links filter options
     * 
     * @async
     * @returns {object}
     */
    async getFileLinksFilterOptions() {
      return {
        fnFilter: c => utils.isValidFileLink(c.link)
      }
    }

    /**
     * Store the file to the network
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream} file
     * @param {object} [options]
     * @returns {string}
     */
    async storeFile(file, options = {}) {      
      const destroyFileStream = () => utils.isFileReadStream(file) && file.destroy();

      try {
        const timer = this.createRequestTimer(options.timeout);

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const info = await utils.getFileInfo(file);
        
        if(!info.size || !info.hash) {        
          throw new errors.WorkError('This file cannot be added to the network', 'ERR_STORACLE_INVALID_FILE');
        }

        const masterRequestTimeout = this.getRequestMastersTimeout(options);
        let results = await this.requestMasters('get-file-storing-candidates', {
          body: { info },
          timeout: timer(
            [masterRequestTimeout, this.options.request.fileStoringNodeTimeout],
            { min: masterRequestTimeout, grabFree: true }
          ),
          responseSchema: schema.getFileStoringCandidatesMasterResponse({ networkOptimum: await this.getNetworkOptimum() }),
          masterTimeout: options.masterTimeout,
          slaveTimeout: options.slaveTimeout
        });
        const existing = _.flatten(results).reduce((p, c) => p.concat(c.existing), []);
        const dublicates = await this.getFileDuplicatesCount(info);
        const limit = dublicates - existing.length;
        
        if(limit <= 0) {
          destroyFileStream();
          return info.hash;
        }

        const filterOptions = Object.assign(await this.getFileStoringFilterOptions(info), { limit });
        const candidates = await this.filterCandidatesMatrix(results.map(r => r.candidates), filterOptions);
      
        if(!candidates.length && !existing.length) {
          throw new errors.WorkError('Not found a suitable server to store the file', 'ERR_STORACLE_NOT_FOUND_STORAGE');
        }

        if(candidates.length) {
          await this.db.addBehaviorCandidate('storeFile', candidates[0].address);
        }
        else {
          destroyFileStream();
          return info.hash;
        }
        
        const servers = candidates.map(c => c.address).sort(await this.createAddressComparisonFunction());    
        const dupOptions = Object.assign({}, options, { timeout: timer() });
        const result = await this.duplicateFile(servers, file, info, dupOptions);

        if(!result && !existing.length) {
          throw new errors.WorkError('Not found an available server to store the file', 'ERR_STORACLE_NOT_FOUND_STORAGE');
        }

        if(!result) {
          destroyFileStream();
          return info.hash;
        }
        
        destroyFileStream();
        return result.hash;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }

    /**
     * Duplicate the file
     * 
     * @async
     * @param {string[]} servers 
     * @param {fs.ReadStream|Buffer} file 
     * @param {object} info 
     * @param {object} [options]
     * @returns {object}
     */
    async duplicateFile(servers, file, info, options = {}) {
      options = _.assign({
        responseSchema: schema.getFileStoringResponse(),
        cache: true      
      }, options);
      let tempFile;

      if(utils.isFileReadStream(file)) {
        const name = path.basename(file.path);
        await fse.exists(path.join(this.tempPath, name)) && (tempFile = name);         
      }

      options.serverOptions = address => ({
        timeout: this.options.request.fileStoringNodeTimeout,
        formData: _.merge({}, options.formData, {
          file: address == (this.address && tempFile) || {
            value: file,
            options: {
              filename: info.hash + (info.ext? '.' + info.ext: ''),
              contentType: info.mime
            }
          }          
        })
      });

      const result = await this.duplicateData(options.action || `store-file/${ info.hash }`, servers, options);
      result && options.cache && await this.updateFileCache(result.hash, { link: result.link });
      return result;
    }
    
    /**
     * Get the file links array
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {string[]}
     */
    async getFileLinks(hash, options = {}) {
      let results = await this.requestMasters('get-file-links', {
        body: { hash },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.getFileLinksMasterResponse({ networkOptimum: await this.getNetworkOptimum() })
      });

      const filterOptions = _.merge(await this.getFileLinksFilterOptions());
      const links = await this.filterCandidatesMatrix(results.map(r => r.links), filterOptions);
      return links.map(c => c.link);
    }

    /**
     * Get the file link
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {string}
     */
    async getFileLink(hash, options = {}) {
      options = _.merge({
        cache: true
      }, options);

      if(await this.hasFile(hash)) {
        return await this.createFileLink(hash);
      }

      if(this.cacheFile && options.cache) {
        const cache = await this.cacheFile.get(hash);

        if(cache) {
          const link = cache.value.link;

          if(await this.checkCacheLink(link)) {
            return link;
          }
          
          await this.cacheFile.remove(hash);
        }
      } 

      const links = await this.getFileLinks(hash, options);

      if(links.length) {
        const link = utils.getRandomElement(links);
        options.cache && await this.updateFileCache(hash, { link }); 
        return link;
      }

      return '';
    }

    /**
     * Remove the file
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {string}
     */
    async removeFile(hash, options = {}) {   
      const result = await this.requestMasters('remove-file', {
        body: { hash },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.getFileRemovalMasterResponse()
      });

      return { removed: result.reduce((p, c) => p + c.removed, 0) };
    }

    /**
     * Update the file cache
     * 
     * @async
     * @param {string} title
     * @param {object} value
     * @param {string} value.link
     */
    async updateFileCache(title, value) {  
      if(!this.cacheFile || !utils.isValidFileLink(value.link) || url.parse(value.link).host == this.address) {
        return;
      }

      await this.cacheFile.set(title, value);
    }

    /**
     * Get the file duplicates count
     * 
     * @async
     * @param {object} info 
     * @param {integer} info.size 
     * @param {string} info.hash
     * @returns {number}
     */
    async getFileDuplicatesCount() {
      return this.getValueGivenNetworkSize(this.options.file.preferredDublicates);
    }

    /**
     * Get the disk usage information
     * 
     * @async
     * @param {object} data
     * @returns {object}
     */
    async getStorageInfo(data = {}) {
      data = Object.assign({
        total: true,
        available: true,
        allowed: true,
        used: true,
        free: true,
        clean: true,
        tempAllowed: true,
        tempUsed: true,
        tempFree: true,
        fileMaxSize: true
      }, data);

      const diskInfo = await utils.getDiskInfo(this.filesPath);      
      const info = {};
      let used;
      let tempUsed;

      if(data.used || data.available || data.free) {
        used = await this.getStorageTotalSize();
      }
      
      if(data.tempUsed || data.tempFree) {
        tempUsed = (await this.getTempDirInfo()).size;
      }

      data.total && (info.total = diskInfo.total);
      data.available && (info.available = diskInfo.available + used);
      data.allowed && (info.allowed = this.storageDataSize);
      data.used && (info.used = used);
      data.free && (info.free = this.storageDataSize - used);
      data.clean && (info.clean = this.storageAutoCleanSize);      
      data.tempAllowed && (info.tempAllowed = this.storageTempSize);
      data.tempUsed && (info.tempUsed = tempUsed);
      data.tempFree && (info.tempFree = this.storageTempSize - tempUsed);
      data.fileMaxSize && (info.fileMaxSize = this.fileMaxSize);
      return info;
    }   

    /**
     * Iterate all files
     * 
     * @async
     * @param {function} fn
     * @param {object} [options]
     */
    async iterateFiles(fn, options = {}) { 
      options = _.assign({ ignoreFolders: true }, options);      
      const iterate = async (dir, level) => {
        if(options.maxLevel && level > options.maxLevel) {
          return;
        }

        const files = await fse.readdir(dir);

        for(let i = 0; i < files.length; i++) {
          try {
            const filePath = path.join(dir, files[i])
            const stat = await fse.stat(filePath);

            if(stat.isDirectory()) {              
              await iterate(filePath, level + 1);
              
              if(options.ignoreFolders) {
                continue;
              }  
            }

            await fn(filePath, stat);           
          }
          catch(err) {
            if(err.code != 'ENOENT') {
              throw err;
            }
          }        
        }
      }

      await iterate(this.filesPath, 1);
    }

    /**
     * Get the storage cleaning up tree
     * 
     * @async
     * @returns {SplayTree} - node data must be like { size: 1, path: '' }
     */
    async getStorageCleaningUpTree() {
      const tree = new SplayTree((a, b) => a.atimeMs - b.atimeMs);
      await this.iterateFiles((filePath, stat) => {
        tree.insert({ atimeMs: stat.atimeMs }, { size: stat.size, path: filePath });
      });
      return tree;
    }
    
    /**
     * Clean up the storage
     * 
     * @async
     */
    async cleanUpStorage() { 
      if(!this.storageAutoCleanSize) {
        return;
      }

      const storageInfoData = { tempUsed: false, tempFree: false };
      const storage = await this.getStorageInfo(storageInfoData);
      const needSize = this.storageAutoCleanSize - storage.free;

      if(needSize <= 0) {
        return;
      }
      
      this.logger.info(`It is necessary to clean ${needSize} byte(s)`);
      const tree = await this.getStorageCleaningUpTree();
      let node = tree.minNode();
      
      while(node) {
        const obj = node.data;

        try {
          await this.removeFileFromStorage(path.basename(obj.path));

          if((await this.getStorageInfo(storageInfoData)).free >= this.storageAutoCleanSize) {
            break;
          }
        }
        catch(err) {
          this.logger.warn(err.stack);
        }

        node = tree.next(node);
      }

      if((await this.getStorageInfo(storageInfoData)).free < this.storageAutoCleanSize) {
        this.logger.warn('Unable to free up space on the disk completely');
      }
    }

    /**
     * Clean up the temp dir
     * 
     * @async
     */
    async cleanUpTempDir() {
      const files = await fse.readdir(this.tempPath);

      for(let i = 0; i < files.length; i++) {
        try {
          const filePath = path.join(this.tempPath, files[i]);
          const stat = await fse.stat(filePath);
          
          if(Date.now() - stat.mtimeMs <= this.options.storage.tempLifetime) {
            continue;
          }

          await fse.remove(filePath);
        }
        catch(err) {
          this.logger.warn(err.stack);
        }      
      }
    }

    /**
     * Normalize the files info
     * 
     * @async
     */
    async normalizeFilesInfo() {
      let size = 0;
      let count = 0;      

      try {
        await this.iterateFiles((fp, stat) => (count++, size += stat.size));
        await this.db.setData('filesTotalSize', size);
        await this.db.setData('filesCount', count);
        this.logger.info('Files info has been normalized'); 
      }
      catch(err) {
        throw err;
      }    
    }

    /**
     * Export files to another server
     * 
     * @async
     * @param {string} address
     * @param {object} [options]
     * @param {boolean} [options.strict] - all files must be exported or to throw an error
     * @param {number} [options.timeout]
     */
    async exportFiles(address, options = {}) {  
      options = _.merge({
        strict: false
      }, options);

      let success = 0;
      let fail = 0;
      const timer = this.createRequestTimer(options.timeout);

      await this.requestServer(address, `/ping`, {
        method: 'GET',
        timeout: timer(this.options.request.pingTimeout) || this.options.request.pingTimeout
      });
  
      await this.iterateFiles(async (filePath) => {
        const info = await utils.getFileInfo(filePath);
        let file;

        try {
          file = fs.createReadStream(filePath);
          await this.duplicateFile([address], file, info, { timeout: timer() });                       
          success++;
          file.destroy();
          this.logger.info(`File "${info.hash}" has been exported`);
        }
        catch(err) {
          file.destroy();

          if(options.strict) {
            throw err;
          }
          
          fail++;
          this.logger.warn(err.stack);
          this.logger.info(`File "${info.hash}" has been failed`);
        }
      });

      if(!success && !fail) {
        this.logger.info(`There are not files to export`);
      }
      else if(!fail) {
        this.logger.info(`${success} file(s) have been exported`);
      }
      else {
        this.logger.info(`${success} file(s) have been exported, ${fail} file(s) have been failed`);
      }
    }

    /**
     * Create the file link
     * 
     * @async 
     * @param {string} hash 
     */
    async createFileLink(hash) {
      const info = await utils.getFileInfo(this.getFilePath(hash), { hash: false });
      return `${this.getRequestProtocol()}://${this.address}/file/${hash}${info.ext? '.' + info.ext: ''}`;
    }  
  
    /**
     * Check the node has the file
     * 
     * @async
     * @param {string} hash
     * @returns {boolean}
     */
    async hasFile(hash) {
      return await fse.pathExists(this.getFilePath(hash));
    }

    /**
     * Add the file to the storage
     * 
     * @async
     * @param {fs.ReadStream|string} file
     * @param {string} hash
     * @param {string} [options]
     * @returns {boolean}
     */
    async addFileToStorage(file, hash, options = {}) {
      const sourcePath = file.path || file;
      const stat = await fse.stat(sourcePath);
      const destPath = this.getFilePath(hash);
      const dir = path.dirname(destPath);

      try {
        await fse.ensureDir(dir);
        await fse[options.copy? 'copy': 'move'](sourcePath, destPath, { overwrite: true });
        await this.db.setData('filesTotalSize', row => row.value + stat.size);
        await this.db.setData('filesCount', row => row.value + 1);
        utils.isFileReadStream(file) && file.destroy();
      }
      catch(err) {
        utils.isFileReadStream(file) && file.destroy();
        await this.normalizeDir(dir);
        throw err;
      }      
    }

    /**
     * Remove the file from the storage
     * 
     * @async
     * @param {string} hash
     */
    async removeFileFromStorage(hash) {
      const filePath = this.getFilePath(hash);
      const stat = await fse.stat(filePath);
      let dir = path.dirname(filePath);

      try {
        await fse.remove(filePath); 
        await this.db.setData('filesTotalSize', row => row.value - stat.size);
        await this.db.setData('filesCount', row => row.value - 1);
        await this.normalizeDir(dir);
      }
      catch(err) {
        await this.normalizeDir(dir);

        if(err.code != 'ENOENT') {
          throw err;
        }        
      }
    }

    /**
     * Normalize the storage directory
     * 
     * @param {string} dir 
     */
    async normalizeDir(dir) {
      const filesPath = path.normalize(this.filesPath);

      while(dir.length > filesPath.length) {
        if(!((await fse.readdir(dir)).length)) {
          await fse.remove(dir);
        }  
        
        dir = path.dirname(dir);
      }
    }

    /**
     * Empty the storage
     * 
     * @async
     */
    async emptyStorage() {
      await fse.emptyDir(this.filesPath);
      await this.db.setData('filesTotalSize', 0);
      await this.db.setData('filesCount', 0);
    }

    /** 
     * Get the storage total size
     * 
     * @async
     * @returns {integer}
     */
    async getStorageTotalSize() {
      let filesSize = await this.db.getData('filesTotalSize');
      let foldersSize = 0;
      await this.iterateFiles((fp, stat) => foldersSize += stat.size, { 
        maxLevel: this.__dirNestingSize, 
        ignoreFolders: false 
      });
      return filesSize + foldersSize;
    }

    /** 
     * Get the temp folder total size
     * 
     * @async
     * @returns {integer}
     */
    async getTempDirInfo() {
      let size = 0;
      let count = 0;    
      const files = await fse.readdir(this.tempPath);

      for(let i = 0; i < files.length; i++) {
        try {
          const filePath = path.join(this.tempPath, files[i]);
          size += (await fse.stat(filePath)).size;
          count += 1;
        }
        catch(err) {
          if(err.code != 'ENOENT') {
            throw err;
          } 
        }
      }
      
      return { size, count };
    }

    /**
     * Get the file existence info
     * 
     * @see NodeStoracle.prototype.fileAvailabilityTest
     * @returns {boolean}
     */
    async getFileExistenceInfo(info) {
      return await this.hasFile(info.hash)? info: null;
    }

    /**
     * Check the file availability
     * 
     * @see NodeStoracle.prototype.fileAvailabilityTest
     * @return {boolean}
     */
    async checkFileAvailability() {
      try {
        await this.fileAvailabilityTest(...arguments);
        return true;
      }
      catch(err) {
        if(err instanceof errors.WorkError) {
          return false;
        }

        throw err;
      }
    }

    /**
     * Test the file availability
     * 
     * @async
     * @param {object} info
     * @param {integer} info.size
     * @param {string} info.hash
     * @param {string} [info.mime]
     * @param {string} [info.ext]
     * @param {object} [info.storage]
     */
    async fileAvailabilityTest(info = {}) {
      const storage = info.storage || await this.getStorageInfo();
      const mimeWhite = this.options.file.mimeWhitelist || [];
      const mimeBlack = this.options.file.mimeBlacklist || [];
      const extWhite = this.options.file.extWhitelist || [];
      const extBlack = this.options.file.extBlacklist || [];
            
      if(!info.size || !info.hash) {
        throw new errors.WorkError('Wrong file', 'ERR_STORACLE_WRONG_FILE');
      }

      if(info.size > storage.free) {
        throw new errors.WorkError('Not enough space to store', 'ERR_STORACLE_NOT_ENOUGH_SPACE');
      }

      if(info.size > storage.tempFree) {
        throw new errors.WorkError('Not enough space in temp folder', 'ERR_STORACLE_NOT_ENOUGH_SPACE_TEMP');
      }

      if(info.size > this.fileMaxSize) {
        throw new errors.WorkError('File is too big', 'ERR_STORACLE_FILE_MAX_SIZE');
      }

      if(mimeWhite.length && (!info.mime || mimeWhite.indexOf(info.mime) == -1)) {
        throw new errors.WorkError('File mime type is denied', 'ERR_STORACLE_FILE_MIME_TYPE');
      }

      if(mimeBlack.length && (mimeBlack.indexOf(info.mime) != -1)) {
        throw new errors.WorkError('File mime type is denied', 'ERR_STORACLE_FILE_MIME_TYPE');
      }

      if(extWhite.length && (!info.ext || extWhite.indexOf(info.ext) == -1)) {
        throw new errors.WorkError('File extension is denied', 'ERR_STORACLE_FILE_EXTENSION');
      }

      if(extBlack.length && (extBlack.indexOf(info.ext) != -1)) {
        throw new errors.WorkError('File extension is denied', 'ERR_STORACLE_FILE_EXTENSION');
      }
    }

    /**
     * Check the cache link is available
     * 
     * @async
     * @param {string} link
     * @returns {boolean}
     */
    async checkCacheLink(link) {
      if(!link || typeof link != 'string') {
        return false;
      }

      try {
        const res = await fetch(link, this.createDefaultRequestOptions({ 
          method: 'HEAD',
          timeout: this.options.request.cacheTimeout
        }));

        return res.status >= 200 && res.status < 300;
      }
      catch(err) {
        return false;
      }
    }

    /**
     * @see Node.prototype.getAvailabilityParts
     */
    async getAvailabilityParts() {
      return (await super.getAvailabilityParts()).concat([
        await this.getAvailabilityTempDir()
      ]);
    }

     /**
     * Get the node temp folder availability
     * 
     * @async
     * @returns {float} 0-1
     */
    async getAvailabilityTempDir() {
      const info = await this.getTempDirInfo();
      return 1 - info.size / this.storageTempSize;
    }
 
    /**
     * Prepare the options
     */
    prepareOptions() {
      super.prepareOptions();
      this.options.storage.dataSize = utils.getBytes(this.options.storage.dataSize);
      this.options.storage.tempSize = utils.getBytes(this.options.storage.tempSize);
      this.options.storage.autoCleanSize = utils.getBytes(this.options.storage.autoCleanSize);
      this.options.file.maxSize = utils.getBytes(this.options.file.maxSize); 
      this.options.file.responseCacheLifetime = utils.getMs(this.options.file.responseCacheLifetime);      
      this.options.storage.tempLifetime = utils.getMs(this.options.storage.tempLifetime);
      this.options.request.fileStoringNodeTimeout = utils.getMs(this.options.request.fileStoringNodeTimeout);
      this.options.file.linkCache && (this.options.file.linkCache.lifetime = utils.getMs(this.options.file.linkCache.lifetime));
    }

    /**
     * Get the file path
     * 
     * @param {string} hash 
     * @returns {string} 
     */
    getFilePath(hash) {
      const subs = [];

      for(let i = 0, o = 0; i < this.__dirNestingSize; i++, o += this.__dirNameLength) {
        subs.push(hash.substr(o, this.__dirNameLength));
      }

      return path.join(this.filesPath, ...subs, hash);
    }
  }
};