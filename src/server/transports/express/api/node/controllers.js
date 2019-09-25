const errors = require('../../../../../errors');
const utils = require('../../../../../utils');
const fs = require('fs');
const path = require('path');

/**
 * Store the file
 */
module.exports.storeFile = node => {  
  return async (req, res, next) => {
    let file;

    try {
      file = req.body.file;      
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
      await node.fileAvailabilityTest(info);

      if(await node.hasFile(info.hash)) {
        file.destroy();
        return res.send({ hash: info.hash, link: await node.createFileLink(info.hash) });
      }
      
      await node.addFileToStorage(file, info.hash);   
      const link = await node.createFileLink(info.hash);
      file.destroy();

      if(dublicates.length) {
        file = fs.createReadStream(node.getFilePath(info.hash));        
        node.duplicateFile(dublicates, file, info)
        .then(() => {
          file.destroy();
        })
        .catch((err) => {
          file.destroy();
          node.logger.error(err.stack);
        });
      }

      res.send({ hash: info.hash, link });
    }
    catch(err) {
      file instanceof fs.ReadStream && file.destroy();
      next(err);
    }    
  }
};