const errors = require('../../../../../errors');
const schema = require('../../../../../schema');
const _ = require('lodash');

/**
 * Get candidates to store the file
 */
module.exports.getFileStoringCandidates = node => {
  return async (req, res, next) => {
    try {      
      const info = req.body.info || {};

      if(!info.size) {
        throw new errors.WorkError('"info.size" field is invalid', 'ERR_STORACLE_INVALID_SIZE_FIELD');
      }

      if(!info.hash) {
        throw new errors.WorkError('"info.hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer(),
        responseSchema: schema.getFileStoringInfoSlaveResponse()
      });
      const results = await node.requestSlaves('get-file-storing-info', options);      
      const existing = results.filter(c => c.existenceInfo).map(c => _.pick(c, ['address', 'existenceInfo']));
      const candidates = await node.filterCandidates(results, await node.getFileStoringFilterOptions(info));
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
      const hash = req.body.hash;

      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }
      
      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer(),
        responseSchema: schema.getFileLinksSlaveResponse()
      });
      const results = await node.requestSlaves('get-file-link-info', options);
      const links = await node.filterCandidates(results, await node.getFileLinksFilterOptions());
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
      const hash = req.body.hash;
      
      if(!hash) {
        throw new errors.WorkError('"hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }

      const timer = node.createRequestTimer(node.createRequestTimeout(req.body));
      const options = node.createRequestSlavesOptions(req.body, {
        timeout: timer(),
        responseSchema: schema.getFileRemovalSlaveResponse()
      });
      const results = await node.requestSlaves('remove-file', options);
      return res.send({ removed: results.filter(item => item.removed).length });
    }
    catch(err) {
      next(err);
    } 
  }   
};