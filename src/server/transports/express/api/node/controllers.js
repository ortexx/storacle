
const utils = require('../../../../../utils');
const fs = require('fs');

/**
 * Store the file
 */
module.exports.storeFile = node => {
  return async (req, res, next) => {
    let file;

    try {
      file = req.body.file;
      const duplicates = req.body.duplicates || [];
      const info = await utils.getFileInfo(file);
      await node.fileAvailabilityTest(info);

      if(!await node.hasFile(info.hash)) {
        await node.addFileToStorage(file, info.hash);
      }

      file.destroy();
      const link = await node.createFileLink(info.hash);

      if(duplicates.length) {
        file = fs.createReadStream(node.getFilePath(info.hash));
        node.duplicateFile(duplicates, file, info)
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
      utils.isFileReadStream(file) && file.destroy();
      next(err);
    }
  }
};
