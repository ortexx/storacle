const errors = require('../../../../../errors');

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