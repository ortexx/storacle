

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  /**
   * Get the file storing info
   * 
   * @api {post} /api/slave/get-file-storing-info
   * @apiParam {object} info
   * @apiParam {string} info.size
   * @apiParam {string} info.hash
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getFileStoringInfo',
    method: 'post',
    url: '/get-file-storing-info', 
    fn: controllers.getFileStoringInfo
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
