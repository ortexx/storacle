const DatabaseLoki = require('spreadable/src/db/transports/loki')();
const path = require('path');

module.exports = (Parent) => {
  /**
   * Lokijs storacle database transport
   */
  return class DatabaseLokiStoracle extends (Parent || DatabaseLoki) {
    constructor(node, options = {}) {
      if(!options.filename) {
        options.filename = path.join(node.storagePath, 'loki.db')
      }

      super(node, options);
    }

    /**
     * @see Database.prototype.init
     */
    async init() {
      await super.init();
    }
    
    /**
     * @see DatabaseLoki.prototype.initCollectionData
     */
    async initCollectionData() {
      await super.initCollectionData();
      const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
      const filesCount = this.col.data.findOne({ name: 'filesCount' });

      if(!filesTotalSize) {
        this.col.data.insert({ name: 'filesTotalSize', value: 0 });
      }

      if(!filesCount) {
        this.col.data.insert({ name: 'filesCount', value: 0 });
      }
    }
  }
};