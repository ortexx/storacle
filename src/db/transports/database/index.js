const Database = require('spreadable/src/db/transports/database')();

module.exports = (Parent) => {
  /**
   * Database transport interface
   */
  return class DatabaseStoracle extends (Parent || Database) {
    /** 
     * Init data table
     * 
     * @async
     */
    async initData() {
      throw new Error('Method "initData" is required for database transport');
    }

    /** 
     * Set files total size
     * 
     * @async
     * @param {integer} size
     */
    async setFilesTotalSize() {
      throw new Error('Method "setFilesTotalSize" is required for database transport');
    }
    
    /** 
     * Set files count
     * 
     * @async
     * @param {integer} count
     */
    async setFilesCount() {
      throw new Error('Method "setFilesCount" is required for database transport');
    }

    /** 
     * Increment files total size
     * 
     * @async
     * @param {integer} size
     */
    async increaseFilesTotalSize() {
      throw new Error('Method "increaseFilesTotalSize" is required for database transport');
    }

    /** 
     * Decrement files total size
     * 
     * @async
     * @param {integer} size
     */
    async decreaseFilesTotalSize() {
      throw new Error('Method "decreaseFilesTotalSize" is required for database transport');
    }

    /** 
     * Increment files count
     * 
     * @async
     */
    async increaseFilesCount() {
      throw new Error('Method "increaseFilesCount" is required for database transport');
    }

    /** 
     * Decrement files count
     * 
     * @async
     */
    async decreaseFilesCount() {
      throw new Error('Method "decreaseFilesCount" is required for database transport');
    }

    /** 
     * Get files total size
     * 
     * @async
     * @returns {integer}
     */
    async getFilesTotalSize() {
      throw new Error('Method "getFilesTotalSize" is required for database transport');
    }

    /** 
     * Get files count
     * 
     * @async
     * @returns {integer}
     */
    async getFilesCount() {
      throw new Error('Method "getFilesCount" is required for database transport');
    }

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