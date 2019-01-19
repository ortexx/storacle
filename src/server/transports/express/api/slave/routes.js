

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
   * Store the file
   * 
   * @api {post} /api/slave/store-file/
   * @apiParam {fs.ReadStream} file - file
   */
  { 
    name: 'storeFile',
    method: 'post', 
    url: '/store-file/:hash',
    fn: node => ([
      (req, res, next) => {
        const disableControl = req.headers['disable-files-concurrency-control'];
        disableControl && req.clientIp == node.ip? next(): midds.requestQueueFiles(node)(req, res, next);
      }, 
      midds.requestQueueFileHash(node),
      midds.filesFormData(node),
      controllers.storeFile(node)
    ])
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
    fn: node => ([      
      midds.requestQueueFileHash(node), 
      controllers.removeFile(node) 
    ])
  }
];
