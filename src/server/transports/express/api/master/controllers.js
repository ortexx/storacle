const schema = require('../../../../../schema');

/**
 * Get candidates to store the file
 */
module.exports.getFileStoringInfo = node => {
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
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileLinksButlerResponse()
      });
      const results = await node.requestNetwork('get-file-links', options);
      const opts = await node.getFileLinksFilterOptions();
      const links = await node.filterCandidatesMatrix(results.map(r => r.links), opts);
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
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileRemovalButlerResponse()
      });
      const results = await node.requestNetwork('remove-file', options);
      const removed = results.reduce((p, c) => p + c.removed, 0);
      return res.send({ removed });
    }
    catch(err) {
      next(err);
    } 
  }   
};