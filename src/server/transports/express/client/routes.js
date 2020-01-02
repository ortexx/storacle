const controllers = require('./controllers');
const midds = require('../midds');

module.exports = [
  /**
   * Request the file
   * 
   * @api {get} /client/request-file/:hash
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'requestFile',
    method: 'get',
    url: '/request-file/:hash',
    fn: [
      midds.requestQueueClient,
      controllers.requestFile
    ]
  },

  /**
   * Store a file
   * 
   * @api {post} /client/store-file/
   * @apiParam {fs.ReadStream|string} file 
   * @apiSuccess {object} - { hash: '' }
   */
  { 
    name: 'storeFile', 
    method: 'post',
    url: '/store-file', 
    fn: [
      midds.requestQueueClient,
      midds.filesFormData, 
      controllers.storeFile     
    ]
  },

  /**
   * Get the file link
   * 
   * @api {post} /client/get-file-link
   * @apiParam {string} hash - file hash
   * @apiSuccess {object} - { link: '' }
   */
  { 
    name: 'getFileLink', 
    method: 'post', 
    url: '/get-file-link',
    fn: [
      midds.requestQueueClient,
      controllers.getFileLink
    ]
  },

  /**
   * Get the file links array
   * 
   * @api {post} /client/get-file-links
   * @apiParam {string} hash - file hash
   * @apiSuccess {object} - { links: [''] }
   */
  { 
    name: 'getFileLinks', 
    method: 'post', 
    url: '/get-file-links',
    fn: [
      midds.requestQueueClient,
      controllers.getFileLinks
    ]
  },

  /**
   * Remove the file
   * 
   * @api {post} /client/remove-file
   * @apiParam {string} hash - file hash
   * @apiSuccess {object} - { removed: 0 }
   */
  { 
    name: 'removeFile',
    method: 'post', 
    url: '/remove-file',
    fn: [
      midds.requestQueueClient,
      controllers.removeFile
    ]
  }
];