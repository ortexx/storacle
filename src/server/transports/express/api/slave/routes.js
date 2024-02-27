import * as controllers from "./controllers.js";
import midds from "../../midds.js";

export default [
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
   * Get the file links
   *
   * @api {post} /api/slave/get-file-links
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
  },

  /**
   * Get the network files count
   *
   * @api {post} /api/slave/get-network-files-count
   */
  {
    name: 'getNetworkFilesCount',
    method: 'post',
    url: '/get-network-files-count',
    fn: controllers.getNetworkFilesCount
  }
];
