const errors = require('../../../../../errors');

/**
 * Get store candidates
 */
module.exports.getFileStoreCandidate = node => {
  return async (req, res, next) => {
    try {
      const info = req.body.info || {};

      if(!info.size) {
        throw new errors.WorkError('"info.size" field is invalid', 'ERR_STORACLE_INVALID_SIZE_FIELD');
      }

      if(!info.hash) {
        throw new errors.WorkError('"info.hash" field is invalid', 'ERR_STORACLE_INVALID_HASH_FIELD');
      }  

      const results = await node.requestSlaves('get-file-store-info', {
        timeout: node.createRequestTimeout(req.body),
        body: req.body
      });      
     
      const existing = results.filter(c => c.isExistent).length;
      const actual = results.filter(c => !c.isExistent && c.isAvailable);      
      const candidates = node.filterCandidates(actual, await node.getFileStoreCandidateFilterOptions(info)); 
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

      const results = await node.requestSlaves('get-file-link-info', {
        timeout: node.createRequestTimeout(req.body),
        body: req.body
      });

      let links = results.filter(r => r.link);
      links.length > node.__maxCandidates && (links = links.slice(0, node.__maxCandidates));
      return res.send({ links: links });
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

      await node.requestSlaves('remove-file', {
        timeout: node.createRequestTimeout(req.body),
        body: req.body
      });

      return res.send({ success: true });
    }
    catch(err) {
      next(err);
    } 
  }   
};