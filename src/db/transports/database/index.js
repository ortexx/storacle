const Database = require('spreadable/src/db/transports/database')();

module.exports = (Parent) => {
  /**
   * Database transport interface
   */
  return class DatabaseStoracle extends (Parent || Database) {    
    /**
     * Get file cache
     * 
     * @async
     * @param {string} hash
     */
    async getCache() {
      throw new Error('Method "getCache" is required for database transport');
    }
  
    /**
    * Set file cache
    * 
    *  @async
    * @param {string} hash
    * @param {string} link
    */
    async setCache() {
      throw new Error('Method "setCache" is required for database transport');
    }

    /**
     * Get file cache
     * 
     * @async
     * @param {string} hash
     */
    async removeCache() {
      throw new Error('Method "removeCache" is required for database transport');
    }
  }
};