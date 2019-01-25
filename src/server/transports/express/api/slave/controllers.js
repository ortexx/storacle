const errors = require('../../../../../errors');
const utils = require('../../../../../utils');
const fs = require('fs-extra');
const path = require('path');

/**
 * Get the file link info
 */
module.exports.getFileLinkInfo = node => {
  return async (req, res, next) => {
    try {
      const hash = req.body.hash;      

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      return res.send({ link: await node.checkFile(hash)? await node.createFileLink(hash): '' });     
    }
    catch(err) {
      next(err);
    }   
  } 
};

/**
 * Get file store info
 */
module.exports.getFileStoreInfo = node => {  
  return async (req, res, next) => {
    try {
      const info = req.body.info || {};

      if(!info.size) {
        throw new errors.WorkError('"info.size" field is invalid', 'ERR_STORACLE_INVALID_SIZE_FIELD');
      }

      if(!info.hash) {
        throw new errors.WorkError('"info.hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }  
      
      const storage = await node.getStorageInfo({ tempUsed: false, tempFree: false });
      
      res.send({ 
        free: storage.free,
        isExistent: await node.checkFile(info.hash),
        isAvailable: info.size < storage.free && await node.checkFileInfo(info)
      });
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Store the file
 */
module.exports.storeFile = node => {  
  return async (req, res, next) => {
    try {
      let file = req.body.file;
      const dublicates = req.body.dublicates || [];
      const invalidFileErr = new errors.WorkError('"file" field is invalid', 'ERR_STORACLE_INVALID_FILE_FIELD');
      
      if(file && !(file instanceof fs.ReadStream)) {        
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
      
      if(!file || !(file instanceof fs.ReadStream)) {
        throw invalidFileErr;
      }

      const info = await utils.getFileInfo(file); 
      await node.fileInfoFilter(info);

      if(await node.checkFile(info.hash)) {
        return res.send({ hash: info.hash, link: await node.createFileLink(info.hash) });
      }

      const storage = await node.getStorageInfo({ free: true, tempUsed: false, tempFree: false });

      if(info.size > storage.free) {
        throw new errors.WorkError('Not enough space to store', 'ERR_STORACLE_NOT_ENOUGH_PLACE');
      }
      
      await node.addFileToStorage(file, info.hash);  
      const link = await node.createFileLink(info.hash);

      if(dublicates.length) {
        const ws = node.createFileStream(info.hash); 
        
        node.duplicateFileForm(dublicates, ws, info).then(() => {
          node.logger.info(`File ${info.hash} has been duplicate from ${node.address}`);
        }).catch((err) => {
          node.logger.error(err.stack);
        });
      }

      res.send({ hash: info.hash, link});
    }
    catch(err) {
      next(err);
    }    
  }
};

/**
 * Remove the file
 */
module.exports.removeFile = node => {
  return async (req, res, next) => {
    try {
      const hash = req.body.hash;
      
      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      if(await node.checkFile(hash)) {
        await node.removeFileFromStorage(hash);
      }

      res.send({ success: true });
    }
    catch(err) {
      next(err);
    } 
  }   
};