const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const _ = require('lodash');
const DatabaseLokiStoracle = require('./db/transports/loki')();
const ServerExpressStoracle = require('./server/transports/express')();
const CacheDatabaseStoracle = require('spreadable/src/cache/transports/database')();
const SplayTree = require('splaytree');
const bytes = require('pretty-bytes');
const utils = require('./utils');
const errors = require('./errors');
const schema = require('./schema');
const Node = require('spreadable/src/node')();

module.exports = (Parent) => {
  /**
   * Class to manage the storacle node
   */
  return class NodeStoracle extends (Parent || Node) {
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
          fileStoringNodeTimeout: '2h',
          cacheTimeout: 250
        },
        storage: {     
          autoCleanSize: 0,
          dataSize: '45%',
          tempSize: '45%',
          tempLifetime: '1d',
          tempLimit: 1000
        },
        file: {          
          maxSize: '50%',
          preferredDublicates: 'auto',
          responseCacheLifetime: '7d',
          mimeTypeWhitelist: [],
          mimeTypeBlacklist: [],
          extensionsWhitelist: [],
          extensionsBlacklist: [],
          linkCache: {
            limit: 50000
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
      this.__isFsBlocked = false;      
    }    

    /**
     * @see Node.prototype.init
     */
    async init() {
      this.storagePath = this.options.storage.path || path.join(process.cwd(), this.constructor.codename, `storage-${this.port}`);
      this.filesPath = path.join(this.storagePath, 'files');
      this.tempPath = path.join(this.storagePath, 'tmp');
      await fse.ensureDir(this.filesPath); 
      await fse.ensureDir(this.tempPath);
      await super.init.apply(this, arguments);    
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
    async getFileStoringCandidatesFilterOptions(info) {
      return {
        fnCompare: await this.createSuscpicionComparisonFunction('storeFile', (a, b) => b.free - a.free),
        fnFilter: c => !c.existenceInfo && c.isAvailable,
        schema: schema.getFileStoringInfoSlaveResponse(),
        limit: await this.getFileDuplicatesCount(info)   
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
      const destroyFileStream = () => (file instanceof fs.ReadStream) && file.destroy();

      try {
        const timer = this.createRequestTimer(options.timeout);

        options = _.merge({
          cache: true,
        }, options);

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const info = await utils.getFileInfo(file);
        
        if(!info.size || !info.hash) {        
          throw new errors.WorkError('This file cannot be added to the network', 'ERR_STORACLE_INVALID_FILE');
        }

        let results = await this.requestMasters('get-file-storing-candidates', {
          body: { info },
          timeout: timer([this.getRequestMastersTimeout(options), this.options.request.fileStoringNodeTimeout]),
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

        const filterOptions = Object.assign(await this.getFileStoringCandidatesFilterOptions(info), { limit });
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
        const result = await this.duplicateFile(servers, file, info, { timeout: timer() });

        if(!result && !existing.length) {
          throw new errors.WorkError('Not found an available server to store the file', 'ERR_STORACLE_NOT_FOUND_STORAGE');
        }

        if(!result) {
          destroyFileStream();
          return info.hash;
        }

        if(this.cacheFile && options.cache && result.address != this.address) {
          await this.cacheFile.set(result.hash, { link: result.link }); 
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
      options = _.merge({}, options, {
        responseSchema: schema.getFileStoreResponse()
      });
      const formData = options.formData;
      let tempFile;

      if(file instanceof fs.ReadStream) {
        const name = path.basename(file.path);
        await fse.exists(path.join(this.tempPath, name)) && (tempFile = name);         
      }

      options.formData = address => {
        return _.merge({}, formData, {
          file: address == (this.address && tempFile) || {
            value: file,
            options: {
              filename: info.hash + (info.ext? '.' + info.ext: ''),
              contentType: info.mime
            }
          },
          timeout: options.timeout || this.options.request.fileStoringNodeTimeout,
        });
      };

      return await this.duplicateData('store-file/' + info.hash, servers, options);
    }
    
    /**
     * Get the file links array
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {string}
     */
    async getFileLinks(hash, options = {}) {
      let results = await this.requestMasters('get-file-links', {
        body: { hash },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.getFileLinksMasterResponse({ networkOptimum: await this.getNetworkOptimum() })
      });

      return results.reduce((p, c) => p.concat(c.links.filter(it => utils.isValidFileLink(it.link)).map(it => it.link)), []);
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
        this.cacheFile && options.cache && await this.cacheFile.set(hash, { link }); 
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
      return await this.requestMasters('remove-file', {
        body: { hash },
        timeout: options.timeout,
        masterTimeout: options.masterTimeout,
        slaveTimeout: options.slaveTimeout,
        responseSchema: schema.removeFileMasterResponse()
      });
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
      const tree = new SplayTree(((a, b) => a.atimeMs - b.atimeMs));

      const walk = async (dir) => {
        const files = await fse.readdir(dir);

        for(let i = 0; i < files.length; i++) {
          try {
            const filePath = path.join(dir, files[i])
            const stat = await fse.stat(filePath);

            if(stat.isDirectory()) {
              await walk(filePath);
              continue;
            }

            tree.insert({ size: stat.size, path: filePath, atimeMs: stat.atimeMs });
          }
          catch(err) {
            if(err.code != 'ENOENT') {
              throw err;
            }
          }        
        }
      }

      await walk(this.filesPath);
      let keys = tree.keys();

      for(let i = 0; i < keys.length; i++) {
        const data = keys[i];

        try {
          await this.removeFileFromStorage(path.basename(data.path));

          if((await this.getStorageInfo(storageInfoData)).free >= this.storageAutoCleanSize) {
            break;
          }
        }
        catch(err) {
          this.logger.warn(err.stack);
        }
      } 

      if((await this.getStorageInfo(storageInfoData)).free < this.storageAutoCleanSize) {
        this.logger.error('Unable to free up space on the disk completely');
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
          
          if(Date.now() - stat.atimeMs <= this.options.storage.tempLifetime) {
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
      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      let size = 0;
      let count = 0;

      const walk = async (dir) => {
        const files = await fse.readdir(dir);

        for(let i = 0; i < files.length; i++) {
          const filePath = path.join(dir, files[i]);
          const stat = await fse.stat(filePath);

          if(stat.isDirectory()) {
            await walk(filePath);
            continue;
          }

          count++;
          size += stat.size;
        }
      }

      this.__isFsBlocked = true;

      try {
        await walk(this.filesPath);
        await this.db.setData('filesTotalSize', size);
        await this.db.setData('filesCount', count);
        this.__isFsBlocked = false;
        this.logger.info('Files info has been normalized'); 
      }
      catch(err) {
        this.__isFsBlocked = false;
        throw err;
      }    
    }

    /**
     * Export the files to another server
     * 
     * @async
     * @param {string} address
     * @param {object} [options]
     * @param {boolean} [options.strict] - all files must be exported or to throw an error
     * @param {boolean} [options.blockFileSystem] - block the file system before the exporting
     * @param {number} [options.timeout]
     */
    async exportFiles(address, options = {}) {  
      options = _.merge({
        strict: false,
        blockFileSystem: true
      }, options);

      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      let success = 0;
      let fail = 0;
      const timer = this.createRequestTimer(options.timeout);

      await this.requestServer(address, `/ping`, {
        method: 'GET',
        timeout: timer(this.options.request.pingTimeout) || this.options.request.pingTimeout
      });

      const walk = async (dir) => {
        const files = await fse.readdir(dir);
  
        for(let i = 0; i < files.length; i++) {
          const filePath = path.join(dir, files[i]);
          let file;          
          let info;  
  
          try {
            const stat = await fse.stat(filePath);
    
            if(stat.isDirectory()) {
              await walk(filePath);
              continue;
            }
  
            info = await utils.getFileInfo(filePath);
          }
          catch(err) {            
            if(err.code != 'ENOENT') {
              throw err;
            }
          }
  
          try {
            file = fs.createReadStream(filePath);

            await this.requestNode(address, `store-file/${info.hash}`, {
              formData: {
                file: {
                  value: file,
                  options: {
                    filename: info.hash + (info.ext? '.' + info.ext: ''),
                    contentType: info.mime
                  }
                }
              },
              timeout: timer() || this.options.request.fileStoringNodeTimeout,
              responseSchema: schema.getFileStoreResponse()
            });            
            success++;
            file.destroy();
            this.logger.info(`File ${info.hash} has been exported`);
          }
          catch(err) {
            file.destroy();

            if(options.strict) {
              throw err;
            }
            
            fail++;
            this.logger.warn(err.stack);
            this.logger.info(`File ${info.hash} has been failed`);
          }
        }
      }
  
      options.blockFileSystem && (this.__isFsBlocked = true);
  
      try {
        await walk(this.filesPath);
  
        if(!success && !fail) {
          this.logger.info(`There are not files to export`);
        }
        else if(!fail) {
          this.logger.info(`${success} file(s) have been exported`);
        }
        else {
          this.logger.info(`${success} file(s) have been exported, ${fail} file(s) have been failed`);
        }
  
        this.__isFsBlocked = false;
      }
      catch(err) {
        this.__isFsBlocked = false;
        throw err;
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
     * @param {fs.ReadStream} file
     * @param {string} hash
     * @returns {boolean}
     */
    async addFileToStorage(file, hash) {
      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      const stat = await fse.stat(file.path);
      const filePath = this.getFilePath(hash);
      const dir = path.dirname(filePath);

      try {
        await fse.ensureDir(dir);
        await fse.move(file.path, filePath, { overwrite: true });
        await this.db.setData('filesTotalSize', row => row.value + stat.size);
        await this.db.setData('filesCount', row => row.value + 1);
      }
      catch(err) {
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
      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

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
        throw err;
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

      const walk = async (dir, level) => {
        if(level > this.__dirNestingSize) {
          return;
        }

        const files = await fse.readdir(dir);      

        for(let i = 0; i < files.length; i++) {
          try {
            const name = files[i];
            const filePath = path.join(dir, name);
            foldersSize += (await fse.stat(filePath)).size;
            await walk(filePath, level + 1);
          }
          catch(err) {
            if(err.code != 'ENOENT') {
              throw err;
            }
          }        
        }
      }

      await walk(this.filesPath, 1);
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
      const storage = info.storage || await this.getStorageInfo({ tempUsed: false, tempFree: false });
      const mimeWhite = this.options.file.mimeTypeWhitelist || [];
      const mimeBlack = this.options.file.mimeTypBlacklist || [];
      const extWhite = this.options.file.extensionsWhitelist || [];
      const extBlack = this.options.file.extensionsBlacklist || [];
            
      if(!info.size || !info.hash) {
        throw new errors.WorkError('Wrong file', 'ERR_STORACLE_WRONG_FILE');
      }

      if(info.size > storage.free) {
        throw new errors.WorkError('Not enough space to store', 'ERR_STORACLE_NOT_ENOUGH_SPACE');
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
      try {
        await this.request({ 
          method: 'HEAD', 
          url: link,
          timeout: this.options.request.cacheTimeout          
        });

        return true;
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
      const size = 1 - info.size / this.storageTempSize;
      const limit = 1 - info.count / this.options.storage.tempLimit;
      return (size + limit) / 2;
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