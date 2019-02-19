

const controllers = require('./controllers');
const midds = require('../../midds');
const utils = require('../../../../../utils');

module.exports = [
  /**
   * Store the file
   * 
   * @api {post} /api/node/store-file/
   * @apiParam {fs.ReadStream|string} file
   */
  { 
    name: 'storeFile',
    method: 'post', 
    url: '/store-file/:hash',
    fn: [
      node => {
        return (req, res, next) => {
          const disableControl = req.headers['disable-files-concurrency-control'];
          disableControl && !utils.isIpEqual(req.clientIp, node.ip)? next(): midds.requestQueueFiles(node)(req, res, next);
        }
      }, 
      midds.requestQueueFileHash,
      midds.filesFormData,
      controllers.storeFile
    ]
  }
];
