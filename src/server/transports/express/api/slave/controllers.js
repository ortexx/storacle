const errors = require('../../../../../errors');

/**
 * Get the file storing info
 */
module.exports.getFileStoringInfo = node => {  
  return async (req, res, next) => {
    try {
      const info = req.body.info || {};

      if(!info.size) {
        throw new errors.WorkError('"info.size" field is invalid', 'ERR_STORACLE_INVALID_SIZE_FIELD');
      }

      if(!info.hash) {
        throw new errors.WorkError('"info.hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      
      const testInfo = Object.assign({}, info)
      testInfo.storage = await node.getStorageInfo({ tempUsed: false, tempFree: false });
      
      res.send({ 
        free: testInfo.storage.free,
        existenceInfo: await node.getFileExistenceInfo(testInfo),
        isAvailable: await node.checkFileAvailability(testInfo)
      });
    }
    catch(err) {
      next(err);
    }    
  }
};

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

      return res.send({ link: await node.hasFile(hash)? await node.createFileLink(hash): '' });     
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
      
      const hasFile = await node.hasFile(hash);

      if(hasFile) {
        await node.removeFileFromStorage(hash);
      }

      res.send({ removed: hasFile });
    }
    catch(err) {
      next(err);
    } 
  }   
};