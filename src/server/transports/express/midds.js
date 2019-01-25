const errors = require('../../../errors');
const utils = require('../../../utils');
const formData = require("express-form-data");
Object.assign(module.exports, require("spreadable/src/server/transports/express/midds"));

/**
 * Provide files receiving
 */
module.exports.file = node => {
  return [
    this.requestQueueFileHash(node, false),
    async (req, res, next) => {
      try {
        const hash = req.params.hash.split('.')[0];
        
        if(!await node.checkFile(hash)) {
          throw new errors.NotFoundError('File not found');
        }

        const file = await node.createFileStream(hash);
        const info = await utils.getFileInfo(file, { hash: false });
        info.mime && res.setHeader("Content-Type", info.mime);
        res.setHeader("Content-Length", info.size);
        res.sendFile(file.path);
      }
      catch(err) {
        next(err);
      }
    }
  ]
};

/**
 * Provide files storing
 */
module.exports.filesFormData = node => {  
  return [
    async (req, res, next) => {
      try {
        let info = await node.getTempDirInfo();
        let maxSize = node.storageTempSize - info.size;
        let count = info.count;
        let length = +req.headers['content-length'];
        
        if(length > node.fileMaxSize) {
          throw new errors.WorkError('The file is too big', 'ERR_STORACLE_FILE_BIG');
        }

        if(count > node.options.storage.tempLimit || length > maxSize) {
          throw new errors.WorkError('Too many temp files, please try later', 'ERR_STORACLE_REQUEST_TEMP_LIMIT');
        }

        formData.parse({
          autoClean: true, 
          maxFilesSize: node.fileMaxSize,
          uploadDir: node.tempPath
        })(req, res, next);
      }
      catch(err) {
        next(err);
      }
    },
    formData.format(),
    formData.stream(),
    formData.union()
  ];
};

/**
 * Control file request's limit
 */
module.exports.requestQueueFiles = node => {  
  return (req, res, next) => {
    return this.requestQueue(node, 'files', { 
      limit: node.options.request.fileConcurrency,
      fnCheck: () => !node.__isFsBlocked
    })(req, res, next);
  }
};

/**
 * Control file request's limit by the file hash
 */
module.exports.requestQueueFileHash = (node, active = true) => {
  return (req, res, next) => {
    return this.requestQueue(node, req => `fileHash=${req.params.hash || req.body.hash}`, { 
      limit: 1,
      fnCheck: () => !node.__isFsBlocked,
      active
    })(req, res, next);
  }
};