const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  /**
   * Store the file
   * 
   * @api {post} /api/node/store-file/:hash
   * @apiParam {fs.ReadStream|string} file
   */
  { 
    name: 'storeFile',
    method: 'post', 
    url: '/store-file/:hash',
    fn: [
      midds.requestQueueFileHash,
      midds.filesFormData,
      midds.prepareFileToStore,
      controllers.storeFile
    ]
  }
];
