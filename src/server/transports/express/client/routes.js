

const controllers = require('./controllers');
const midds = require('../midds');

module.exports = [
  /**
   * Store a file
   * 
   * @api {post} /client/store-file/
   * @apiParam {fs.ReadStream|string} file 
   */
  { 
    name: 'storeFile', 
    method: 'post',
    url: '/store-file', 
    fn: node => ([
      midds.requestQueueFiles(node),
      midds.filesFormData(node), 
      controllers.storeFile(node)
    ]) 
  },

  /**
   * Get the file link
   * 
   * @api {post} /client/get-file-link
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'getFileLink', 
    method: 'post', 
    url: '/get-file-link',
    fn: controllers.getFileLink
  },

  /**
   * Get the file links array
   * 
   * @api {post} /client/get-file-links
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'getFileLinks', 
    method: 'post', 
    url: '/get-file-links',
    fn: controllers.getFileLinks
  },

  /**
   * Remove the file
   * 
   * @api {post} /client/remove-file
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'removeFile',
    method: 'post', 
    url: '/remove-file',
    fn: controllers.removeFile
  }
];