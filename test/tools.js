import _tools from "spreadable/test/tools.js";
import path from "path";

const tools = Object.assign({}, _tools);

/**
 * Get the storage path
 *
 * @param {number} port
 * @returnss {string}
 */
tools.getStoragePath = function (port) {
  return path.join(this.tmpPath, `storage-${port}`);
};

/**
 * Create the node options
 *
 * @async
 * @param {object} [options]
 * @returns {object}
 */
tools.createNodeOptions = async function (options = {}) {
  options = await _tools.createNodeOptions(options);
  delete options.db;
  options.storage = {
    path: this.getStoragePath(options.port)
  };
  return options;
};

export default tools;
