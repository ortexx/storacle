import mime from "mime";
import hasha from 'hasha';
import detectMime from "detect-file-type";
import fse from "fs-extra";
import stream from "stream";
import fetch from "node-fetch";
import urlib from "url";
import errors from "./errors.js";
import _utils from "spreadable/src/utils.js";

const utils = Object.assign({}, _utils);

/**
 * Fetch the file to a buffer
 *
 * @async
 * @param {string} link
 * @param {object} [options]
 * @returns {Promise<Buffer>}
 */
utils.fetchFileToBuffer = async function (link, options = {}) {
  options = Object.assign({}, options, { method: 'GET' });

  try {
    let result = await fetch(link, options);
    return result.buffer();
  }
  catch (err) {
    throw utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err;
  }
};

/**
 * Fetch the file to a blob
 *
 * @async
 * @param {string} link
 * @param {object} [options]
 * @returns {Blob}
 */
utils.fetchFileToBlob = async function (link, options = {}) {
  const controller = new AbortController();
  options = Object.assign({}, options, {
    method: 'GET',
    signal: controller.signal
  });
  const timer = this.getRequestTimer(options.timeout);
  let timeIsOver = false;

  try {
    let result = await fetch(link, options);
    let timeoutObj;
    const timeout = timer();

    if (timeout) {
      timeoutObj = setTimeout(() => {
        timeIsOver = true;
        controller.abort();
      }, timeout);
    }

    const blob = await result.blob();
    timeoutObj && clearTimeout(timeoutObj);
    return blob;
  }
  catch (err) {
    throw utils.isRequestTimeoutError(err) || timeIsOver? utils.createRequestTimeoutError(): err;
  }
};

/**
 * Fetch the file to the path
 *
 * @async
 * @param {string} filePath
 * @param {string} link
 * @param {object} [options]
 */
utils.fetchFileToPath = async function (filePath, link, options = {}) {
  options = Object.assign({}, options, { method: 'GET' });
  const timer = this.getRequestTimer(options.timeout);
  let result;

  try {
    result = await fetch(link, options);
  }
  catch (err) {
    throw utils.isRequestTimeoutError(err)? utils.createRequestTimeoutError(): err;
  }

  return await new Promise((resolve, reject) => {
    const stream = fse.createWriteStream(filePath);
    const timeout = timer();
    let timeIsOver = false;
    let timeoutObj;
    if (timeout) {
      timeoutObj = setTimeout(() => {
        timeIsOver = true;
        stream.close();
      }, timeout);
    }
    result.body
      .pipe(stream)
      .on('error', reject)
      .on('finish', () => {
        clearTimeout(timeoutObj);
        timeIsOver? reject(utils.createRequestTimeoutError()): resolve();
      });
  });
};

/**
 * Check the file is fse.ReadStream or fse.ReadStream
 *
 * @param {*} obj
 * @returns {boolean}
 */
utils.isFileReadStream = function (obj) {
  return stream && typeof stream == 'function' && stream.Readable && (obj instanceof stream.Readable);
};

/**
 * Get the disk info
 *
 * @async
 * @param {string} dir
 * @returns {object}
 */
utils.getDiskInfo = async function (dir) {
  const stats = await fse.promises.statfs(dir);
  return {
    available: stats.bsize * stats.bavail, 
    free: stats.bsize * stats.bfree, 
    total: stats.bsize * stats.blocks 
  };
};

/**
 * Get the file info
 *
 * @async
 * @param {string|Buffer|fse.ReadStream|Blob} file
 * @param {object} data
 * @returns {object}
 */
utils.getFileInfo = async function (file, data = {}) {
  data = Object.assign({
    size: true,
    mime: true,
    ext: true,
    hash: true
  }, data);
  let info = {};

  if (typeof Blob == 'function' && file instanceof Blob) {
    data.size && (info.size = file.size);
    data.mime && (info.mime = file.type);
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(file));
  }
  else if (this.isFileReadStream(file) || typeof file == 'string') {
    const filePath = file.path || file;
    data.size && (info.size = (await fse.stat(filePath)).size);
    data.mime && (info.mime = await this.getFileMimeType(filePath));
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(filePath));
  }
  else if (typeof Buffer == 'function' && Buffer.isBuffer(file)) {
    data.size && (info.size = file.length);
    data.mime && (info.mime = await this.getFileMimeType(file));
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(file));
  }
  else {
    throw new errors.WorkError('Wrong file format', 'ERR_STORACLE_WRONG_FILE');
  }

  return info;
};

/**
 * Get the file hash
 *
 * @async
 * @param {string|Buffer|fse.ReadStream|Blob} file
 * @returns {string}
 */
utils.getFileHash = async function (file) {
  if (typeof Blob == 'function' && file instanceof Blob) {
    return await hasha(await this.blobToBuffer(file), { algorithm: 'md5' });
  }
  else if (this.isFileReadStream(file) || typeof file == 'string') {
    return await hasha.fromFile(file.path || file, { algorithm: 'md5' });
  }
  else if (typeof Buffer == 'function' && Buffer.isBuffer(file)) {
    return await hasha(file, { algorithm: 'md5' });
  }

  throw new errors.WorkError('Wrong file format', 'ERR_STORACLE_WRONG_FILE');
};

/**
 * Get the file mime type
 *
 * @async
 * @param {string|fse.ReadStream|Buffer} content
 * @returns {string}
 */
utils.getFileMimeType = async function (content) {
  return await new Promise((resolve, reject) => {
    this.isFileReadStream(content) && (content = content.path);
    detectMime[Buffer.isBuffer(content)? 'fromBuffer': 'fromFile'](content, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result ? result.mime : 'text/plain');
    });
  });
};

/**
 * Convert the blob to a Buffer
 *
 * @async
 * @param {Blob} blob
 * @returns {Buffer}
 */
utils.blobToBuffer = async function (blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fn = result => {
      reader.removeEventListener('loadend', fn);
      if (result.error) {
        return reject(result.error);
      }
      resolve(Buffer.from(reader.result));
    };
    reader.addEventListener('loadend', fn);
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * Check the file link is valid
 *
 * @param {string} link
 * @param {object} [options]
 * @returns {boolean}
 */
utils.isValidFileLink = function (link, options = {}) {
  if (typeof link != 'string') {
    return false;
  }

  const info = urlib.parse(link);
  
  if (!info.hostname || !this.isValidHostname(info.hostname)) {
    return false;
  }

  if (!info.port || !this.isValidPort(info.port)) {
    return false;
  }

  if (!info.protocol.match(/^https?:?$/)) {
    return false;
  }

  if (!info.pathname || !info.pathname.match(new RegExp(`\\/${options.action || 'file'}\\/[a-z0-9_-]+(\\.[\\w\\d]+)*$`, 'i'))) {
    return false;
  }

  return true;
};

export default utils;
