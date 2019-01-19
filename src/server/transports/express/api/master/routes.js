
const controllers = require('./controllers');

module.exports = [
  /**
   * Get a candidate to store file
   * 
   * @api {post} /api/master/get-file-store-candidate
   * @apiParam {object} info
   * @apiParam {string} info.size
   * @apiParam {string} info.hash
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getFileStoreCandidate', 
    method: 'post',
    url: '/get-file-store-candidate', 
    fn: controllers.getFileStoreCandidate
  },

  /**
   * Get the file links
   * 
   * @api {post} /api/master/get-file-links
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
   * @api {post} /api/master/remove-file
   * @apiParam {string} hash - file hash
   */
  { 
    name: 'removeFile',
    method: 'post', 
    url: '/remove-file',
    fn: controllers.removeFile
  }
];
