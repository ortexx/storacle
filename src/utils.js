const mime = require('mime');
const hasha = require('hasha');
const mmm = require('mmmagic');
const disk = require('diskusage');
const fse = require('fs-extra');
const fs = require('fs');
const urlib = require('url');
const errors = require('./errors');
const utils = Object.assign({}, require('spreadable/src/utils'));

/**
 * Get the disk info
 * 
 * @async
 * @param {string}
 * @returns {object}
 */
utils.getDiskInfo = async function (dir) {
  return await new Promise((resolve, reject) => {
    disk.check(dir, async (err, info) => {
      if (err) {
        return reject(err);
      } 

      try {
        resolve(info);
      }
      catch(err) {
        reject(err);
      }        
    });
  });
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
  else if(typeof fs == 'object' && ((file instanceof fs.ReadStream) || typeof file == 'string')) {
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
  else if(typeof fs == 'object' && ((file instanceof fs.ReadStream) || typeof file == 'string')) {
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
    const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
    content instanceof fs.ReadStream && (content = content.path);
    magic[content instanceof Buffer? 'detect': 'detectFile'](content, (err, mime) => {
      if (err) {
        return reject(reject);
      }

      resolve(mime);
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
 * @returns {boolean}
 */
utils.isValidFileLink = function (link) {
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
  
  if(!info.pathname || !info.pathname.match(/\/file\/[a-z0-9]+(\.[\w\d]+)*$/)) {
    return false;
  }

  return true;
};

module.exports = utils;
