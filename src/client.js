const _ = require('lodash');
const request = require('request');
const Client = require('spreadable/src/client')();
const fs = require('fs-extra');
const utils = require('./utils');
const errors = require('./errors');

module.exports = (Parent) => {
  /**
   * Class to manage client requests to the network
   */
  return class ClientStoracle extends (Parent || Client) {
    constructor(options = {}) {
      options = _.merge({
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
      this.initializationFilter();

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
      this.initializationFilter();

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
      this.initializationFilter();
      const timeout = options.timeout || this.options.request.clientTimeout;
      const timer = utils.getRequestTimer(timeout);

      const result  = await this.request('get-file-link', {
        body: { hash },
        timeout: timer([ timeout, this.options.request.fileGetTimeout ]),
        useInitialAddress: options.useInitialAddress
      });

      if(!result.link) {
        throw new errors.WorkError(`Link for hash "${hash}" is not found`, 'ERR_STORACLE_NOT_FOUND_LINK');
      }
      
      return await new Promise(async (resolve, reject) => {    
        try {
          const req = request(this.createDefaultRequestOptions({ 
            url: result.link,
            method: 'GET',
            json: false,
            timeout: timer()
          }));
          const chunks = [];
          req
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
      this.initializationFilter();
      const timeout = options.timeout || this.options.request.clientTimeout;
      const timer = utils.getRequestTimer(timeout);

      const result  = await this.request('get-file-link', {
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
          const req = request(this.createDefaultRequestOptions({ 
            url: result.link,
            method: 'GET',
            json: false,
            timeout: timer()
          }));
          req
            .on('error', (err) => reject(utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err))  
            .pipe(ws)
            .on('error', reject)
            .on('finish', () => resolve());   
        }   
        catch(err) {
          reject(err);
        }  
      });
    }

    /**
     * Store the file to the storage
     * 
     * @async
     * @param {string|Buffer|fs.ReadStream} file
     * @param {object} [options]
     */
    async storeFile(file, options = {}) {
      this.initializationFilter();

      if(typeof file == 'string') {
        file = fs.createReadStream(file);      
      }

      const info = await utils.getFileInfo(file);

      return (await this.request('store-file', {
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
      })).hash;
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

      await this.request('remove-file', {
        body: { hash },
        timeout: options.timeout,
        useInitialAddress: options.useInitialAddress
      });
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