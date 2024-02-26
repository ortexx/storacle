export const getFileStoringInfo = node => {
  return async (req, res, next) => {
    try {
      const info = req.body.info || {};
      node.hashTest(info.hash);
      const testInfo = Object.assign({}, info);
      testInfo.storage = await node.getStorageInfo();
      res.send({
        free: testInfo.storage.free,
        existenceInfo: await node.getFileExistenceInfo(testInfo),
        isAvailable: await node.checkFileAvailability(testInfo)
      });
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
      node.hashTest(hash);
      return res.send({ link: await node.hasFile(hash) ? await node.createFileLink(hash) : '' });
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
      node.hashTest(hash);
      const hasFile = await node.hasFile(hash);
      if (hasFile) {
        await node.removeFileFromStorage(hash);
      }
      res.send({ removed: +hasFile });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getNetworkFilesCount = node => {
  return async (req, res, next) => {
    try {
      res.send({ count: await node.db.getData('filesCount') });
    }
    catch (err) {
      next(err);
    }
  };
};
