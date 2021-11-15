const schema = require('../../../../../schema');
const _ = require('lodash');

/**
 * Get candidates to store the file
 */
module.exports.getFileStoringInfo = node => {
  return async (req, res, next) => {
    try {      
      const info = req.body.info || {}; 
      node.hashTest(info.hash);     
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileStoringInfoSlaveResponse()
      });
      const results = await node.requestNetwork('get-file-storing-info', options);      
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
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileLinksSlaveResponse()
      });
      const results = await node.requestNetwork('get-file-links', options);
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
      node.hashTest(req.body.hash);
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getFileRemovalSlaveResponse()
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

/**
 * Get the network files count
 */
 module.exports.getNetworkFilesCount = node => {
  return async (req, res, next) => {
    try {
      const options = node.createRequestNetworkOptions(req.body, {
        responseSchema: schema.getNetworkFilesCountSlaveResponse()
      });
      const results = await node.requestNetwork('get-network-files-count', options);
      const count = results.reduce((p, c) => p + c.count, 0);     
      return res.send({ count });
    }
    catch(err) {
      next(err);
    } 
  }   
};