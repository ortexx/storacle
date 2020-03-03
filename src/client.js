const merge = require('lodash/merge');
const Client = require('spreadable/src/client')();
const fs = require('fs');
const utils = require('./utils');
const errors = require('./errors');

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class ClientStoracle extends (Parent || Client) {
    static get utils () { return utils }
    static get errors () { return errors }
    
    constructor(options = {}) {
      options = merge({
        request: {
          fileStoringTimeout: '2.05h',
          fileGettingTimeout: '1h',
          fileRemovalTimeout: '10s',          
          fileLinkGettingTimeout: '10s'
        },
      }, options);
      super(options);
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
      return (await this.request('get-file-link', Object.assign({}, options, {
        body: { hash },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout
      }))).link;
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
      return (await this.request('get-file-links', Object.assign({}, options, {
        body: { hash },
        timeout: options.timeout || this.options.request.fileLinkGettingTimeout
      }))).links;
    }

    /**
     * Get the file to a buffer
     * 
     * @param {string} hash
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getFileToBuffer(hash, options = {}) {
      this.envTest(false, 'getFileToBuffer');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-file-link', Object.assign({}, options, {
        body: { hash },
        timeout: timer(this.options.request.fileLinkGettingTimeout)
      }));
      
      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
      
      return await utils.fetchFileToBuffer(result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }

    /**
     * Get the file and save it to the path
     * 
     * @async
     * @param {string} hash
     * @param {string} filePath
     * @param {object} [options]
     */
    async getFileToPath(hash, filePath, options = {}) {
      this.envTest(false, 'getFileToPath');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-file-link', Object.assign({}, options, {
        body: { hash },
        timeout: timer(this.options.request.fileLinkGettingTimeout)
      }));

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
 
      await utils.fetchFileToPath(filePath, result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }

    /**
     * Get file to a blob
     * 
     * @param {string} hash
     * @param {object} [options]
     * @returns {Blob} 
     */
    async getFileToBlob(hash, options = {}) {
      this.envTest(true, 'getFileToBlob');
      const timeout = options.timeout || this.options.request.fileGettingTimeout;
      const timer = this.createRequestTimer(timeout);

      let result  = await this.request('get-file-link', Object.assign({}, options, {
        body: { hash },
        timeout: timer(this.options.request.fileLinkGettingTimeout)
      }));

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
      
      return await utils.fetchFileToBlob(result.link, this.createDefaultRequestOptions({ timeout: timer() }));
    }

    /**
     * Store the file to the storage
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream|Blob|File} file
     * @param {object} [options]
     */
    async storeFile(file, options = {}) {
      const destroyFileStream = () => utils.isFileReadStream(file) && file.destroy();

      try {
        const info = await utils.getFileInfo(file);

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }

        const result = await this.request('store-file', Object.assign({}, options, {
          formData: {
            file: {
              value: file,
              options: {
                filename: info.hash + (info.ext? '.' + info.ext: ''),
                contentType: info.mime
              }
            }
          },
          timeout: options.timeout || this.options.request.fileStoringTimeout
        }));

        destroyFileStream();
        return result.hash;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
    }

    /**
     * Remove the file
     * 
     * @async
     * @param {string} hash
     * @param {object} [options]
     * @returns {object}
     */
    async removeFile(hash, options = {}) {
      return await this.request('remove-file', Object.assign({}, options, {
        body: { hash },
        timeout: options.timeout || this.options.request.fileRemovalTimeout
      }));
    }

    /**
     * Create a deferred file link
     * 
     * @param {string} hash 
     * @param {object} options 
     * @returns {string}
     */
    createRequestedFileLink(hash, options = {}) {
      return this.createRequestUrl(`request-file/${hash}`, options);
    }

    /**
     * Prepare the options
     */
    prepareOptions() {   
      super.prepareOptions();
      this.options.request.fileGettingTimeout = utils.getMs(this.options.request.fileGettingTimeout);
      this.options.request.fileStoringTimeout = utils.getMs(this.options.request.fileStoringTimeout);
      this.options.request.fileRemovalTimeout = utils.getMs(this.options.request.fileRemovalTimeout);
      this.options.request.fileLinkGettingTimeout = utils.getMs(this.options.request.fileLinkGettingTimeout);
    }
  }
};