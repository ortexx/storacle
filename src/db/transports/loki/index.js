const DatabaseLoki = require('spreadable/src/db/transports/loki')();
const path = require('path');
const _ = require('lodash');

module.exports = (Parent) => {
  /**
   * Lokijs storacle database transport
   */
  return class DatabaseLokiStoracle extends (Parent || DatabaseLoki) {
    constructor(node, options = {}) {
      options = _.merge({
        filename: path.join(node.storagePath, 'loki.db')
      }, options);

      super(node, options);
    }
    
    /**
     * @see DatabaseLoki.prototype.initCollectionData
     */
    initCollectionData() {
      super.initCollectionData.apply(this, arguments);
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