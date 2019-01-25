const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const urlib = require('url');
const _ = require('lodash');
const DatabaseSequelize = require('./db/transports/loki')();
const ServerExpress = require('./server/transports/express')();
const CacheDatabase = require('./cache/transports/database')();
const SplayTree = require('splaytree');
const prettyBytes = require('pretty-bytes');
const utils = require('./utils');
const errors = require('./errors');
const Node = require('spreadable/src/node')();

module.exports = (Parent) => {
  /**
   * Class to manage the storacle node
   */
  return class NodeStoracle extends (Parent || Node) {
    static get name () { return 'storacle' }
    static get DatabaseTransport () { return DatabaseSequelize }
    static get ServerTransport () { return ServerExpress }
    static get CacheTransport () { return CacheDatabase }

    /**
     * @see Node
     */
    constructor(options = {}) {
      options = _.merge({      
        request: {
          fileConcurrency: 30,    
          fileGetTimeout: '2s',
          fileStoreTimeout: '1h',
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
          mimeTypeWhitelist: [],
          mimeTypeBlacklist: [],
          extensionsWhitelist: [],
          extensionsBlacklist: []
        },
        task: {
          cleanUpStorageInterval: '30s',
          cleanUpTempDirInterval: '20s',
          calculateStorageInfoInterval: '2s'
        },
        cache: {
          limit: 50000
        }
      }, options);

      super(options);
  
      this.storageDataSize = 0;
      this.storageTempSize = 0;
      this.storageAutoCleanSize = 0;
      this.fileMaxSize = 0;
      this.__dirNestingSize = 2;
      this.__dirNameLength = 1;
      this.__requestQueueInterval = 10,
      this.__isFsBlocked = false;
    }    

    /**
     * @see Node.prototype.init
     */
    async init() {
      this.storagePath = this.options.storagePath || path.join(process.cwd(), 'storacle', `storage-${this.port}`);
      this.filesPath = path.join(this.storagePath, 'files');
      this.tempPath = path.join(this.storagePath, 'tmp');
      await fse.ensureDir(this.filesPath); 
      await fse.ensureDir(this.tempPath);
      await super.init();     
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
      this.options.cache && (this.cache = new this.CacheTransport(this, _.merge({}, this.options.cache)));      

      if(this.task) {
        this.task.add('cleanUpStorage', this.options.task.cleanUpStorageInterval, () => this.cleanUpStorage());
        this.task.add('cleanUpTempDir', this.options.task.cleanUpTempDirInterval, () => this.cleanUpTempDir());
        this.task.add('calculateStorageInfo', this.options.task.calculateStorageInfoInterval, () => this.calculateStorageInfo());
      }
    }

    /**
     * @see Node.prototype.initServices
     */
    async initServices() {
      await super.initServices();
      this.cache && await this.cache.init();
    }

    /**
     * @see Node.prototype.deinitServices
     */
    async deinitServices() {
      await super.deinitServices();
      this.cache && await this.cache.deinit(); 
    }

    /**
     * @see Node.prototype.deinitServices
     */
    async destroyServices() {
      await super.destroyServices();
      this.cache && await this.cache.destroy(); 
    }

    /**
     * @see Node.prototype.getStatusInfo
     */
    async getStatusInfo(pretty = false) {      
      const storage = await this.getStorageInfo();

      if(pretty) {
        for(let key in storage) {
          storage[key] = prettyBytes(storage[key]);
        }
      }

      return _.merge(await super.getStatusInfo(pretty), storage, {
        filesCount: await this.db.getFilesCount()
      });
    }

    /**
     * Calculate the storage info
     * 
     * @async
     */
    async calculateStorageInfo() {
      this.initializationFilter();      
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
     * Get file store filter options
     * 
     * @async
     * @returns {object} - { [fnCompare], [schema], [limit] }
     */
    async getFileStoreCandidateFilterOptions(info) {
      return {
        fnCompare: await this.createCandidatesComparisonFunction('storeFile', (a, b) => b.free - a.free),
        schema: { free: 1, isAvailable: true, isExistent: true },
        limit: await this.getFileDuplicatesCount(info)
      }
    }

    /**
     * Store the file to the network
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream} file
     * @param {object} [options]
     */
    async storeFile(file, options = {}) {
      const destroyFileStream = () => (file instanceof fs.ReadStream) && file.destroy();

      try {
        this.initializationFilter();        
        const timer = utils.getRequestTimer(options.timeout);
        const info = await utils.getFileInfo(file);

        if(!info.size || !info.hash) {        
          throw new errors.WorkError('This file cannot be added to the network', 'ERR_STORACLE_INVALID_FILE');
        }

        let results = await this.requestMasters('get-file-store-candidate', {
          body: {
            info
          },
          timeout: timer([this.getRequestMastersTimeout(), this.options.request.fileStoreTimeout])
        });
        
        let existing = 0;
        results.forEach(r => existing += r.existing);
        const dublicates = await this.getFileDuplicatesCount(info);
        const limit = dublicates - existing;

        if(limit <= 0) {
          destroyFileStream();
          return info.hash;
        }

        const filterOptions = await this.getFileStoreCandidateFilterOptions(info);
        filterOptions.limit = limit;
        const candidates = this.filterCandidatesMatrix(results.map(r => r.candidates), filterOptions);

        if(!candidates.length && !existing) {
          throw new errors.WorkError('Not found a suitable server to store the file', 'ERR_STORACLE_NOT_FOUND_STORAGE');
        }

        if(candidates.length) {
          await this.db.addCandidate(candidates[0].address, 'storeFile');
        }
        else {
          destroyFileStream();
          return info.hash;
        }

        const servers = candidates.map(c => c.address).sort((a, b) => {
          if(a == this.address) {
            return -1;
          }

          if(b == this.address) {
            return 1;
          }

          return 0;
        });

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }
        
        const storeResult = await this.duplicateFileForm(servers, file, info, _.merge({}, options, { timeout: timer() }));
        
        if(!storeResult && !existing) {
          throw new errors.WorkError('Not found an available server to store the file', 'ERR_STORACLE_NOT_FOUND_STORAGE');
        }

        if(!storeResult) {
          destroyFileStream();
          return info.hash;
        }

        this.cache && await this.cache.set(storeResult.hash, { link: storeResult.link });   
        destroyFileStream();  
        return storeResult.hash;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }

    /**
     * Duplicate file
     * 
     * @async
     * @param {string[]} servers 
     * @param {object} formData 
     * @param {object} options 
     */
    async duplicateFileForm(servers, file, info, options = {}) {
      const timer = utils.getRequestTimer(options.timeout);
      let result;
      
      while(servers.length) {
        const address = servers[0];
        const headers = {};

        if(options.disableConcurrencyControl) {
          headers['disable-files-concurrency-control'] = true;
        }

        const formData = _.merge({}, options.formData, {
          file: (address == this.address && options.tempFile) || {
            value: file,
            options: {
              filename: info.hash + (info.ext? '.' + info.ext: ''),
              contentType: info.mime
            }
          }
        });
        
        servers.slice(1).forEach((val, i) => formData[`dublicates[${i}]`] = val);

        try {
          result = await this.requestSlave(address, 'store-file/' + info.hash, {
            formData,
            headers,
            timeout: timer() || this.options.request.fileStoreTimeout
          });
          break;
        }
        catch(err) {
          servers.shift();
          this.logger.warn(err.stack);
        }
      }
      
      return result;
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
      this.initializationFilter();

      let results = await this.requestMasters('get-file-links', {
        body: {
          hash
        },
        timeout: options.timeout
      });

      let links = [];
      results.forEach(r => links.length < this.__maxCandidates && (links = links.concat(r.links)));
      links.length > this.__maxCandidates && (links = links.slice(0, this.__maxCandidates));
      return links.map(item => item.link);
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
      if(await this.checkFile(hash)) {
        return await this.createFileLink(hash);
      }

      if(this.cache) {
        const cache = await this.cache.get(hash);

        if(cache) {
          const link = cache.value.link;

          if(await this.checkCacheLink(link)) {
            return link;
          }
          
          await this.cache.remove(hash);
        }
      } 

      const links = await this.getFileLinks(hash, options);

      if(links.length) {
        const link = utils.getRandomElement(links);
        this.cache && await this.cache.set(hash, { link }); 
        return link;
      }

      return null;
    }

    /**
     * Remove file
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {string}
     */
    async removeFile(hash, options = {}) {
      this.initializationFilter();
      
      await this.requestMasters('remove-file', {
        body: {
          hash
        },
        timeout: options.timeout
      });
    }

    /**
     * Get file necessary duplicates count
     * 
     * @async
     * @param {object} info 
     * @param {integer} info.size 
     * @param {string} info.hash
     */
    async getFileDuplicatesCount() {
      this.initializationFilter();
      let dublicates = this.options.file.preferredDublicates;
      const networkSize = await this.getNetworkSize();

      if(dublicates == 'auto') {
        dublicates = Math.ceil(Math.sqrt(networkSize));
      }
      else if(typeof dublicates == 'string') {
        dublicates = Math.ceil(networkSize * parseFloat(dublicates) / 100); 
      }

      if(dublicates > networkSize) {
        dublicates = networkSize;
      }

      return dublicates;
    }

    /**
     * Get disk usage information
     * 
     * @async
     * @param {object} data
     * @returns {object}
     */
    async getStorageInfo(data = {}) {
      this.initializationFilter();

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
      this.initializationFilter();

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
        this.logger.error(`Unable to free up space on the disk completely`);
      }

      this.logger.info(`Storage has been succesfully cleaned`);
    }

    /**
     * Clean up the temp dir
     * 
     * @async
     */
    async cleanUpTempDir() {
      this.initializationFilter();
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
     * Normalize files info
     * 
     * @async
     */
    async normalizeFilesInfo() { 
      this.initializationFilter();

      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      let size = 0;
      let count = 0;      

      const walk = async (dir) => {
        const files = await fse.readdir(dir);

        for(let i = 0; i < files.length; i++) {
          const filePath = path.join(dir, files[i])
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
        await this.db.setFilesTotalSize(size);
        await this.db.setFilesCount(count);
        this.__isFsBlocked = false;
        this.logger.info('Files info has been normalized'); 
      }
      catch(err) {
        this.__isFsBlocked = false;
        throw err;
      }    
    }

    /**
     * Export files to other server
     * 
     * @async
     * @param {string} address
     * @param {object} [options]
     * @param {boolean} [options.strict] - all files must be exported or throw an error
     * @param {number} [options.timeout]
     */
    async exportFiles(address, options = { strict: false }) {
      this.initializationFilter(); 
      
      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      let success = 0;
      let fail = 0;
      const timer = utils.getRequestTimer(options.timeout);

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

            await this.requestSlave(address, 'store-file', {
              formData: {
                file: {
                  value: file,
                  options: {
                    filename: info.hash + (info.ext? '.' + info.ext: ''),
                    contentType: info.mime
                  }
                }
              },
              timeout: timer() || this.options.request.fileStoreTimeout
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
  
      this.__isFsBlocked = true;
  
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
     * Create file link
     * 
     * @async 
     * @param {string} hash 
     */
    async createFileLink(hash) {
      this.initializationFilter();
      const info = await utils.getFileInfo(this.getFilePath(hash), { hash: false });
      return `${this.options.server.https? 'https': 'http'}://${this.address}/file/${hash}${info.ext? '.' + info.ext: ''}`;
    }  
  
    /**
     * Check file info is available for this node
     * 
     * @async
     * @param {string} hash
     * @returns {fs.ReadStream}
     */
    async checkFile(hash) {
      this.initializationFilter();    
      return await fse.pathExists(this.getFilePath(hash));
    }

    /**
     * Add file to the storage
     * 
     * @async
     * @param {fs.ReadStream} file
     * @param {string} hash
     * @returns {boolean}
     */
    async addFileToStorage(file, hash) {
      this.initializationFilter();

      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      const stat = await fse.stat(file.path);
      const filePath = this.getFilePath(hash);
      const dir = path.dirname(filePath);

      try {
        await fse.ensureDir(dir);
        await fse.move(file.path, filePath, { overwrite: true });
        await this.db.increaseFilesTotalSize(stat.size);
        await this.db.increaseFilesCount();
      }
      catch(err) {
        await this.normalizeDir(dir);
        throw err;
      }
    }

    /**
     * Remove file from the storage
     * 
     * @async
     * @param {string} hash
     */
    async removeFileFromStorage(hash) {  
      this.initializationFilter();
      
      if(this.__isFsBlocked) {
        throw new errors.WorkError('File system is not available now, please try later', 'ERR_STORACLE_FS_NOT_AVAILABLE');
      }

      const filePath = this.getFilePath(hash);
      const stat = await fse.stat(filePath);
      let dir = path.dirname(filePath);

      try {
        await fse.remove(filePath); 
        await this.db.decreaseFilesTotalSize(stat.size);  
        await this.db.decreaseFilesCount();
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
      this.initializationFilter();
      const filesPath = path.normalize(this.filesPath);

      while(dir.length > filesPath.length) {
        if(!((await fse.readdir(dir)).length)) {
          await fse.remove(dir);
        }  
        
        dir = path.dirname(dir);
      }
    }

    /** 
     * Get storage total size
     * 
     * @async
     * @returns {integer}
     */
    async getStorageTotalSize() {
      this.initializationFilter();
      let filesSize = await this.db.getFilesTotalSize();
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
     * Get temp folder total size
     * 
     * @async
     * @returns {integer}
     */
    async getTempDirInfo() {
      this.initializationFilter();
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
     * @see Node.prototype.fileInfoFilter
     * @return {boolean}
     */
    async checkFileInfo() {
      this.initializationFilter();
      try {
        await this.fileInfoFilter(...arguments);
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
     * Check file info is available for this node
     * 
     * @async
     * @param {object} info
     * @param {integer} info.size
     * @param {string} info.hash
     * @param {string} [info.mime]
     * @param {string} [info.ext]
     * @returns {boolean|string}
     */
    async fileInfoFilter(info = {}) {
      this.initializationFilter();
      const mimeWhite = this.options.file.mimeTypeWhitelist || [];
      const mimeBlack = this.options.file.mimeTypBlacklist || [];
      const extWhite = this.options.file.extensionsWhitelist || [];
      const extBlack = this.options.file.extensionsBlacklist || [];
      
      if(!info.size || !info.hash) {
        throw new errors.WorkError('Wrong file', 'ERR_STORACLE_WRONG_FILE');
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
     * Check cache link is available
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
     * Check the file link is valid
     * 
     * @param {string} link
     * @returns {boolean}
     */
    isValidFileLink(link) {
      if(typeof link != 'string') {
        return false;
      }

      const info = urlib.parse(link);

      if(!info.hostname || !utils.isValidHostname(info.hostname)) {
        return false;
      }

      if(!info.port || !utils.isValidPort(info.port)) {
        return false;
      }
      
      if(!info.protocol.match(/^https?:?$/)) {
        return false;
      }
      
      if(!info.pathname || !info.pathname.match(/\/file\/[a-z0-9]+(\.[\w\d]+)*$/)) {
        return false;
      }

      return true;
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
      this.options.storage.tempLifetime = utils.getMs(this.options.storage.tempLifetime);
      this.options.request.fileGetTimeout = utils.getMs(this.options.request.fileGetTimeout);
      this.options.request.fileStoreTimeout = utils.getMs(this.options.request.fileStoreTimeout); 
    }

    /**
     * Get the file path
     * 
     * @param {string} hash 
     * @returns {string} 
     */
    getFilePath(hash) {
      this.initializationFilter();
      const subs = [];

      for(let i = 0, o = 0; i < this.__dirNestingSize; i++, o += this.__dirNameLength) {
        subs.push(hash.substr(o, this.__dirNameLength));
      }

      return path.join(this.filesPath, ...subs, hash);
    }
  }
};