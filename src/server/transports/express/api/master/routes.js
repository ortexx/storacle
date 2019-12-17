const controllers = require('./controllers');

module.exports = [
  /**
   * Get candidates to store the file
   * 
   * @api {post} /api/master/get-file-storing-candidates
   * @apiParam {object} info
   * @apiParam {string} info.size
   * @apiParam {string} info.hash
   * @apiSuccess {object} - { candidates: ... }
   */
  { 
    name: 'getFileStoringCandidates', 
    method: 'post',
    url: '/get-file-storing-candidates', 
    fn: controllers.getFileStoringCandidates
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
