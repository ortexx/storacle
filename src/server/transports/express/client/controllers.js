const utils = require('../../../../utils');
const errors = require('../../../../errors');

/**
 * Request the file
 */
module.exports.requestFile = node => {
  return async (req, res, next) => {
    try {
      const hash = req.params.hash;

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      const link = await node.getFileLink(hash);

      if(!link) {
        throw new errors.NotFoundError('File not found');
      }

      res.redirect(link);
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
      const file = req.body.file;

      if(!utils.isFileReadStream(file)) {
        throw new errors.WorkError('"file" field is invalid', 'ERR_STORACLE_INVALID_FILE_FIELD');
      }

      const hash = await node.storeFile(file, { timeout: node.createRequestTimeout(req.body) });
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
      const hash = req.body.hash;

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      const link = await node.getFileLink(hash, { timeout: node.createRequestTimeout(req.body) });      
      res.send({ link });
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
      const hash = req.body.hash;

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      const links = await node.getFileLinks(hash, { timeout: node.createRequestTimeout(req.body) });
      res.send({ links });
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

      const result = await node.removeFile(hash, { timeout: node.createRequestTimeout(req.body) });
      res.send(result);
    }
    catch(err) {
      next(err);
    }
  }
};