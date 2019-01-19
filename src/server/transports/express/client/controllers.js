const path = require('path');

/**
 * Store the file
 */
module.exports.storeFile = node => {
  return async (req, res, next) => {
    try {
      const file = req.body.file;
      const hash = await node.storeFile(file, {
        disableConcurrencyControl: true,
        tempFile: path.basename(file.path),
        timeout: node.createRequestTimeout(req.body) 
      });
      res.send({ hash });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Get the file link
 */
module.exports.getFileLink = node => {
  return async (req, res, next) => {
    try {
      res.send({ link: await node.getFileLink(req.body.hash, { timeout: node.createRequestTimeout(req.body) }) });
    }
    catch(err) {
      next(err);
    }
  }
};

/**
 * Get the file links array
 */
module.exports.getFileLinks = node => {
  return async (req, res, next) => {
    try {
      res.send({ link: await node.getFileLinks(req.body.hash, { timeout: node.createRequestTimeout(req.body) }) });
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
      await node.removeFile(req.body.hash, { timeout: node.createRequestTimeout(req.body) });
      res.send({ success: true });
    }
    catch(err) {
      next(err);
    }
  }
};