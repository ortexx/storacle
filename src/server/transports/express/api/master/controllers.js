const errors = require('../../../../../errors');
const schema = require('../../../../../schema');

/**
 * Get a candidate to store the file
 */
module.exports.getFileStoreCandidate = node => {
  return async (req, res, next) => {
    try {
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const info = req.body.info || {};

      if(!info.size) {
        throw new errors.WorkError('"info.size" field is invalid', 'ERR_STORACLE_INVALID_SIZE_FIELD');
      }

      if(!info.hash) {
        throw new errors.WorkError('"info.hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      
      const serverTimeout = node.getRequestServerTimeout();
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer([serverTimeout, serverTimeout / 2]),
        responseSchema: schema.getFileStoreCandidateSlaveResponse()
      });
      const results = await node.requestSlaves('get-file-store-info', options);      
      const existing = results.filter(c => c.isExistent).length;
      const actual = results.filter(c => !c.isExistent && c.isAvailable);
      const candidates = await node.filterCandidates(actual, await node.getFileStoreCandidateFilterOptions(info));
      res.send({ candidates, existing });
    }
    catch(err) {
      next(err);
    }    
  };
}

/**
 * Get the file links
 */
module.exports.getFileLinks = node => {
  return async (req, res, next) => {
    try {
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const hash = req.body.hash;

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      
      const serverTimeout = node.getRequestServerTimeout();
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer([serverTimeout, serverTimeout / 2]),
        responseSchema: schema.getFileLinksSlaveResponse()
      });
      const results = await node.requestSlaves('get-file-link-info', options);
      const links = await node.filterCandidates(results, await node.getFileLinkCandidateFilterOptions()); 
      return res.send({ links });
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
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const hash = req.body.hash;
      
      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      const serverTimeout = node.getRequestServerTimeout();
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer([serverTimeout, serverTimeout / 2]),
        responseSchema: schema.removeFileSlaveResponse()
      });
      const results = await node.requestSlaves('remove-file', options);
      return res.send({ removed: results.filter(item => item.removed).length });
    }
    catch(err) {
      next(err);
    } 
  }   
};