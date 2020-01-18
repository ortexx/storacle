const errors = require('../../../errors');
const utils = require('../../../utils');
const formData = require("express-form-data");
const fs = require("fs");
const path = require("path");
const midds = Object.assign({}, require("spreadable/src/server/transports/express/midds"));

/**
 * Provide files receiving
 */
midds.file = node => {
  return [
    midds.requestQueueFileHash(node, false),
    async (req, res, next) => {
      try {
        const hash = req.params.hash.split('.')[0];
        
        if(!await node.hasFile(hash)) {
          throw new errors.NotFoundError('File not found');
        }

        const cache = Math.ceil(node.options.file.responseCacheLifetime / 1000);
        const filePath = await node.getFilePath(hash);
        const info = await utils.getFileInfo(filePath, { hash: false });
        info.mime && res.setHeader("Content-Type", info.mime);
        cache && res.set('Cache-Control', `public, max-age=${cache}`);
        res.setHeader("Content-Length", info.size);
        const stream = fs.createReadStream(filePath);
        stream.on('error', next).pipe(res);
      }
      catch(err) {
        next(err);
      }
    }
  ]
};

/**
 * Prepare file for storing
 */
midds.prepareFileToStore = node => {
  return async (req, res, next) => {
    let file;

    try {
      file = req.body.file;
      const invalidFileErr = new errors.WorkError('"file" field is invalid', 'ERR_STORACLE_INVALID_FILE_FIELD');
      
      if(file && !utils.isFileReadStream(file)) {  
        if(!utils.isIpEqual(req.clientIp, node.ip)) {
          throw invalidFileErr;
        }

        try {
          file = fs.createReadStream(path.join(node.tempPath, file));
        }
        catch(err) {
          throw invalidFileErr;
        }
      }

      if(!file || !utils.isFileReadStream(file)) {
        throw invalidFileErr;
      } 

      req.body.file = file;
      next();
    }
    catch(err) {
      utils.isFileReadStream(file) && file.destroy();
      next(err);
    }
  }
};

/**
 * Provide files storing
 */
midds.filesFormData = node => {  
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
 * Control file requests limit by the file hash
 */
midds.requestQueueFileHash = (node, active = true) => {
  const options = {
    limit: 1,
    active
  };

  return (req, res, next) => {
    return midds.requestQueue(node, `fileHash=${req.params.hash || req.body.hash}`, options)(req, res, next);
  }
};

module.exports = midds;