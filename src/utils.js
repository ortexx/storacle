const mime = require('mime');
const hasha = require('hasha');
const mmm = require('mmmagic');
const disk = require('diskusage');
const fs = require('fs-extra');
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
        return reject(err)
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
 * @param {string|Buffer|fs.ReadStream} file
 * @param {object} data
 * @returns {object}
 */
utils.getFileInfo = async function (file, data = {}) {
  if(typeof file == 'string') {
    file = fs.createReadStream(file);      
  }

  data = Object.assign({
    size: true,
    mime: true,
    ext: true,
    hash: true
  }, data);

  let info = {};

  if(file instanceof fs.ReadStream) {
    data.size && (info.size = (await fs.stat(file.path)).size);
    data.mime && (info.mime = await this.getFileMimeType(file.path));      
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(file));
  }
  else if(file instanceof Buffer) {
    data.size && (info.size = file.length);
    data.mime && (info.mime = await this.getFileMimeType(file)); 
    (data.mime && data.ext) && (info.ext = mime.getExtension(info.mime));
    data.hash && (info.hash = await this.getFileHash(file));
  }
  else {
    throw new Error('Wrong file format');
  } 

  return info;
};

/**
 * Get the file hash
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream} file
 * @returns {string}
 */
utils.getFileHash = async function (file) {
  if(typeof file == 'string') {
    file = fs.createReadStream(file);      
  }

  if(file instanceof fs.ReadStream) {
    return await hasha.fromFile(file.path, { algorithm: 'md5' });
  }
  else if(file instanceof Buffer) {
    return await hasha(file, { algorithm: 'md5' });
  }

  throw new Error('Wrong file format');
};

/**
 * Get file mime type
 * 
 * @async
 * @param {string|Buffer} content 
 * @returns {string} 
 */
utils.getFileMimeType = async function (content){
  return await new Promise((resolve, reject) => {
    const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
    
    magic[content instanceof Buffer? 'detect': 'detectFile'](content, (err, mime) => {
      if (err) {
        return reject(reject);
      }

      resolve(mime);
    });
  });    
};

module.exports = utils;
