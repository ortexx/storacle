const merge = require('lodash/merge');
const fetch = require('node-fetch');
const Client = require('spreadable/src/client')();
const fs = require('fs');
const utils = require('./utils');
const errors = require('./errors');

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class ClientStoracle extends (Parent || Client) {
    constructor(options = {}) {
      options = merge({
        request: {
          fileStoreTimeout: '2h',
          fileGetTimeout: '2s'
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
      return (await this.request('get-file-link', {
        body: {
          hash
        },
        timeout: options.timeout,
        useInitialAddress: options.useInitialAddress
      })).link;
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
      return (await this.request('get-file-links', {
        body: {
          hash
        },
        timeout: options.timeout,
        useInitialAddress: options.useInitialAddress
      })).link;
    }

    /**
     * Get file to buffer
     * 
     * @param {string} hash
     * @param {object} [options]
     * @returns {Buffer}
     */
    async getFileToBuffer(hash, options = {}) {
      this.envFilter(false, 'getFileToBuffer');
      const timeout = options.timeout || this.options.request.clientTimeout;
      const timer = utils.getRequestTimer(timeout);

      let result  = await this.request('get-file-link', {
        body: { hash },
        timeout: timer([ timeout, this.options.request.fileGetTimeout ]),
        useInitialAddress: options.useInitialAddress
      });

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
      
      return await new Promise(async (resolve, reject) => {
        try {
          result = await fetch(result.link, this.createDefaultRequestOptions({ 
            method: 'GET',
            timeout: timer()
          }));
          const chunks = [];
          result.body
            .on('error', (err) => reject(utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err))  
            .on('data', chunk => chunks.push(chunk) )        
            .on('end', () => resolve(Buffer.concat(chunks)));
        }   
        catch(err) {
          reject(err);
        }  
      });
    }

    /**
     * Get file and save to path
     * 
     * @async
     * @param {string} hash
     * @param {string} path
     * @param {object} [options]
     * @returns {Buffer} 
     */
    async getFileToPath(hash, path, options = {}) {
      this.envFilter(false, 'getFileToPath');
      const timeout = options.timeout || this.options.request.clientTimeout;
      const timer = utils.getRequestTimer(timeout);

      let result  = await this.request('get-file-link', {
        body: { hash },
        timeout: timer([ timeout, this.options.request.fileGetTimeout ]),
        useInitialAddress: options.useInitialAddress
      });

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }

      return await new Promise(async (resolve, reject) => {
        try { 
          const ws = fs.createWriteStream(path);
          result = await fetch(result.link, this.createDefaultRequestOptions({
            method: 'GET',
            timeout: timer()
          }));
          result.body
            .on('error', (err) => reject(utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err))
            .pipe(ws)
            .on('error', reject)
            .on('finish', resolve);
        }   
        catch(err) {
          reject(err);
        }  
      });
    }

    /**
     * Get file to blob
     * 
     * @param {string} hash
     * @param {object} [options]
     * @returns {Blob} 
     */
    async getFileToBlob(hash, options = {}) {
      this.envFilter(true, 'getFileToBlob');
      const timeout = options.timeout || this.options.request.clientTimeout;
      const timer = utils.getRequestTimer(timeout);

      let result  = await this.request('get-file-link', {
        body: { hash },
        timeout: timer([ timeout, this.options.request.fileGetTimeout ]),
        useInitialAddress: options.useInitialAddress
      });

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
      
      result = await fetch(result.link, this.createDefaultRequestOptions({
        method: 'GET',
        timeout: timer()
      }));

      return result.blob();
    }

    /**
     * Store the file to the storage
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream|Blob|File} file
     * @param {object} [options]
     */
    async storeFile(file, options = {}) {
      const destroyFileStream = () => (fs.ReadStream && file instanceof fs.ReadStream) && file.destroy();

      try {
        const info = await utils.getFileInfo(file);

        if(typeof file == 'string') {
          file = fs.createReadStream(file);
        }
        
        const result = await this.request('store-file', {
          formData: {
            file: {
              value: file,
              options: {
                filename: info.hash + (info.ext? '.' + info.ext: ''),
                contentType: info.mime
              }
            }
          },
          timeout: options.timeout || this.options.request.fileStoreTimeout,
          useInitialAddress: options.useInitialAddress
        });

        destroyFileStream();
        return result.hash;
      }
      catch(err) {
        destroyFileStream();
        throw err;
      }
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
      await this.request('remove-file', {
        body: { hash },
        timeout: options.timeout,
        useInitialAddress: options.useInitialAddress
      });
    }

    /**
     * Create a deferred file link
     * 
     * @param {string} hash 
     * @param {object} optio ns 
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
      this.options.request.fileGetTimeout = utils.getMs(this.options.request.fileGetTimeout);
      this.options.request.fileStoreTimeout = utils.getMs(this.options.request.fileStoreTimeout);
    }
  }
};