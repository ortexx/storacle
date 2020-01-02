const mime = require('mime');
const hasha = require('hasha');
const detectMime = require('detect-file-type');
const disk = require('diskusage');
const fse = require('fs-extra');
const stream = require('stream');
const urlib = require('url');
const errors = require('./errors');
const utils = Object.assign({}, require('spreadable/src/utils'));

/**
 * Check the file is fs.ReadStream or fse.ReadStream
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
 * @param {string}
 * @returns {object}
 */
utils.getDiskInfo = async function (dir) {
  return await disk.check(dir);
};

/**
 * Get the file info
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream|Blob} file
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

  if(typeof Blob == 'function' && file instanceof Blob) {
    data.size && (info.size = file.size);
    data.mime && (info.mime = file.type);
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(file));
  }
  else if(this.isFileReadStream(file) || typeof file == 'string') {
    const filePath = file.path || file;
    data.size && (info.size = (await fse.stat(filePath)).size);
    data.mime && (info.mime = await this.getFileMimeType(filePath));
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(filePath));
  }
  else if(typeof Buffer == 'function' && (file instanceof Buffer)) {
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
 * @param {string|Buffer|fs.ReadStream|Blob} file
 * @returns {string}
 */
utils.getFileHash = async function (file) {
  if(typeof Blob == 'function' && file instanceof Blob) {
    return await hasha(await this.blobToBuffer(file), { algorithm: 'md5' });
  }
  else if(this.isFileReadStream(file) || typeof file == 'string') {
    return await hasha.fromFile(file.path || file, { algorithm: 'md5' });
  }
  else if(typeof Buffer == 'function' && (file instanceof Buffer)) {
    return await hasha(file, { algorithm: 'md5' });
  }

  throw new errors.WorkError('Wrong file format', 'ERR_STORACLE_WRONG_FILE');
};

/**
 * Get the file mime type
 * 
 * @async
 * @param {string|fs.ReadStream|Buffer} content 
 * @returns {string} 
 */
utils.getFileMimeType = async function (content) {
  return await new Promise((resolve, reject) => {
    this.isFileReadStream(content) && (content = content.path);
    detectMime[content instanceof Buffer? 'fromBuffer': 'fromFile'](content, (err, result) => {
      if (err) {
        return reject(reject);
      }

      resolve(result? result.mime: 'text/plain');
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
  
      if(result.error) {
        return reject(result.error);
      }
  
      resolve(Buffer.from(reader.result));
    }
  
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
  if(typeof link != 'string') {
    return false;
  }

  const info = urlib.parse(link);

  if(!info.hostname || !this.isValidHostname(info.hostname)) {
    return false;
  }

  if(!info.port || !this.isValidPort(info.port)) {
    return false;
  }
  
  if(!info.protocol.match(/^https?:?$/)) {
    return false;
  }
  
  if(!info.pathname || !info.pathname.match(new RegExp(`\\/${ options.action || 'file' }\\/[a-z0-9]+(\\.[\\w\\d]+)*$`))) {
    return false;
  }

  return true;
};

module.exports = utils;
