import utils from "../../../../utils.js";
import errors from "../../../../errors.js";

export const requestFile = node => {
  return async (req, res, next) => {
    try {
      const hash = req.params.hash;
      if (!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      const link = await node.getFileLink(hash);
      if (!link) {
        throw new errors.NotFoundError('File not found');
      }
      res.redirect(link);
    }
    catch (err) {
      next(err);
    }
  };
};

export const storeFile = node => {
  return async (req, res, next) => {
    try {
      const file = req.body.file;
      if (!utils.isFileReadStream(file)) {
        throw new errors.WorkError('"file" field is invalid', 'ERR_STORACLE_INVALID_FILE_FIELD');
      }
      const hash = await node.storeFile(file, node.prepareClientMessageOptions(req.body));
      res.send({ hash });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getFileLink = node => {
  return async (req, res, next) => {
    try {
      const hash = req.body.hash;
      if (!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      const link = await node.getFileLink(hash, node.prepareClientMessageOptions(req.body));
      res.send({ link });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getFileLinks = node => {
  return async (req, res, next) => {
    try {
      const hash = req.body.hash;
      if (!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      const links = await node.getFileLinks(hash, node.prepareClientMessageOptions(req.body));
      res.send({ links });
    }
    catch (err) {
      next(err);
    }
  };
};

export const removeFile = node => {
  return async (req, res, next) => {
    try {
      const hash = req.body.hash;
      if (!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      const result = await node.removeFile(hash, node.prepareClientMessageOptions(req.body));
      res.send(result);
    }
    catch (err) {
      next(err);
    }
  };
};

export const getNetworkFilesCount = node => {
  return async (req, res, next) => {
    try {
      res.send({ count: await node.getNetworkFilesCount(node.prepareClientMessageOptions(req.body)) });
    }
    catch (err) {
      next(err);
    }
  };
};
