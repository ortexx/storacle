const Cache = require('../cache')();

module.exports = (Parent) => {
  /**
   * The main tasks transport
   */
  return class CacheDatabase extends (Parent || Cache) {
    /**
     * @see Task.prototype.init
     */
    async init() {
      await super.init();    
    }

    /**
     * @see Task.prototype.get
     */
    async get(key) {
      const cache = await this.node.db.getCache(key);
      return cache? { key: cache.key, value: cache.value }: null;
    }

    /**
     * @see Task.prototype.set
     */
    async set(key, value) {
      return await this.node.db.setCache(key, value);
    }

    /**
     * @see Task.prototype.remove
     */
    async remove(key) {
      return await this.node.db.removeCache(key);
    }
  }
};