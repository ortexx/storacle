import loki from "spreadable-ms/src/db/transports/loki/index.js";

const DatabaseLoki = loki();

export default (Parent) => {
    /**
     * Lokijs storacle database transport
     */
    return class DatabaseLokiStoracle extends (Parent || DatabaseLoki) {
        /**
         * @see DatabaseLoki.prototype.initCollectionData
         */
        initCollectionData() {
            super.initCollectionData.apply(this, arguments);
            const filesTotalSize = this.col.data.findOne({ name: 'filesTotalSize' });
            const filesCount = this.col.data.findOne({ name: 'filesCount' });
            if (!filesTotalSize) {
                this.col.data.insert({ name: 'filesTotalSize', value: 0 });
            }
            if (!filesCount) {
                this.col.data.insert({ name: 'filesCount', value: 0 });
            }
        }
    };
};
