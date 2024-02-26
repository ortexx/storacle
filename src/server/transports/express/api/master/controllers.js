import schema from "../../../../../schema.js";

export const getFileStoringInfo = node => {
  return async (req, res, next) => {
    try {
      const info = req.body.info || {};
      node.hashTest(info.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileStoringInfoButlerResponse()
      });
      const results = await node.requestNetwork('get-file-storing-info', options);
      const existing = results.reduce((p, c) => p.concat(c.existing), []);
      const opts = await node.getFileStoringFilterOptions(info);
      const candidates = await node.filterCandidatesMatrix(results.map(r => r.candidates), opts);
      res.send({ candidates, existing });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getFileLinks = node => {
  return async (req, res, next) => {
    try {
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileLinksButlerResponse()
      });
      const results = await node.requestNetwork('get-file-links', options);
      const opts = await node.getFileLinksFilterOptions();
      const links = await node.filterCandidatesMatrix(results.map(r => r.links), opts);
      return res.send({ links });
    }
    catch (err) {
      next(err);
    }
  };
};

export const removeFile = node => {
  return async (req, res, next) => {
    try {
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileRemovalButlerResponse()
      });
      const results = await node.requestNetwork('remove-file', options);
      const removed = results.reduce((p, c) => p + c.removed, 0);
      return res.send({ removed });
    }
    catch (err) {
      next(err);
    }
  };
};

export const getNetworkFilesCount = node => {
  return async (req, res, next) => {
    try {
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getNetworkFilesCountButlerResponse()
      });
      const results = await node.requestNetwork('get-network-files-count', options);
      const count = results.reduce((p, c) => p + c.count, 0);
      return res.send({ count });
    }
    catch (err) {
      next(err);
    }
  };
};
