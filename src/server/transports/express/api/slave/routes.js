

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  /**
   * Get file store info
   * 
   * @api {post} /api/slave/get-file-store-info
   * @apiParam {object} info
   * @apiParam {string} info.size
   * @apiParam {string} info.hash
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getFileStoreInfo',
    method: 'post',
    url: '/get-file-store-info', 
    fn: controllers.getFileStoreInfo
  },
  
  /**
   * Get the file link info
   * 
   * @api {post} /api/slave/get-file-link-info
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'getFileLinkInfo',
    method: 'post', 
    url: '/get-file-link-info', 
    fn: controllers.getFileLinkInfo
  },
  
  /**
   * Remove the file
   * 
   * @api {post} /api/slave/remove-file
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'removeFile',
    method: 'post', 
    url: '/remove-file',
    fn: [      
      midds.requestQueueFileHash, 
      controllers.removeFile
    ]
  }
];
