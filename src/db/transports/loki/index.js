const Database = require('../database')();
const DatabaseLoki = require('spreadable/src/db/transports/loki')(Database);
const path = require('path');

module.exports = (Parent) => {
  /**
   * Lokijs storacle  database transport
   */
  return class DatabaseLokiStoracle extends (Parent || DatabaseLoki) {
    constructor(node, options = {}) {
      if(!options.filename) {
        options.filename = path.join(node.storagePath, 'loki.db')
      }

      super(node, options);
    }

    /**
     * @see Database.propotype.init
     */
    async init() {
      await super.init();
      await this.initData();
    }

    /**
     * @see Database.propotype.initCollections
     */
    async initCollections() {
      super.initCollections();
      this.initCollectionCache();
    }

    /**
     * Initialize cache collection
     */
    initCollectionCache() {
      this.col.cache = this.loki.getCollection("cache");

      if (this.col.cache === null) {
        this.col.cache = this.loki.addCollection('cache', {
          unique: ['key']
        });
      }
    }
    
    /**
     * @see Database.propotype.initData
     */
    async initData() {
      const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
      const filesCount = this.col.data.findOne({ name: 'filesCount' });

      if(!filesTotalSize) {
        this.col.data.insert({ name: 'filesTotalSize', value: 0 });
      }

      if(!filesCount) {
        this.col.data.insert({ name: 'filesCount', value: 0 });
      }
    }

    /**
     * @see Database.propotype.setFilesTotalSize
     */
    async setFilesTotalSize(size) {
      const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
      filesTotalSize.value = size;
      this.col.data.update(filesTotalSize);
    }
    
    /**
     * @see Database.propotype.setFilesCount
     */
    async setFilesCount(count) {
      const filesCount = this.col.data.findOne({ name: 'filesCount' });
      filesCount.value = count;
      this.col.data.update(filesCount);
    }

    /**
     * @see Database.propotype.increaseFilesTotalSize
     */
    async increaseFilesTotalSize(size) {
      const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
      filesTotalSize.value += size;
      this.col.data.update(filesTotalSize);
    }

    /** 
     * @see Database.propotype.decrementFilesTotalSize
     */
    async decreaseFilesTotalSize(size) {
      const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
      filesTotalSize.value -= size;
      this.col.data.update(filesTotalSize);
    }

    /**
     * @see Database.propotype.increaseFilesCount
     */
    async increaseFilesCount() {
      const filesCount = this.col.data.findOne({ name: 'filesCount' });
      filesCount.value += 1;
      this.col.data.update(filesCount);
    }

    /** 
     * @see Database.propotype.decreaseFilesCount
     */
    async decreaseFilesCount() {
      const filesCount = this.col.data.findOne({ name: 'filesCount' });
      filesCount.value -= 1;
      this.col.data.update(filesCount);
    }

    /** 
     * @see Database.propotype.getFilesTotalSize
     */
    async getFilesTotalSize() {
      return this.col.data.findOne({ name: 'filesTotalSize' }).value;
    } 

    /**
     * @see Database.propotype.getFilesCount
     */
    async getFilesCount() {
      return this.col.data.findOne({ name: 'filesCount' }).value;
    } 

    /**
     * @see Database.propotype.getCache
     */
    async getCache(key) {
      const cache = this.col.cache.findOne({ key });

      if(cache) {
        cache.accessedAt = Date.now();
        return this.col.cache.update(cache);
      }

      return cache;
    }
  
    /**
     * @see Database.propotype.setCache
     */
    async setCache(key, value) {
      let cache = this.col.cache.findOne({ key });

      if(cache) {
        cache.value = value;
        cache.accessedAt = Date.now();
        return this.col.cache.update(cache);
      }

      cache = this.col.cache.insert({ key, value, accessedAt: Date.now() }); 
      const limit = this.node.options.cache.limit;
      this.col.cache.chain().find().simplesort('accessedAt', true).offset(limit).remove();
      return cache;
    }

    /**
     * @see Database.propotype.removeCache
     */
    async removeCache(key) {
      const cache = this.col.cache.findOne({ key });
      cache && this.col.cache.remove(cache);
    }
  }
};