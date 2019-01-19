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
 * Get disk usage information
 * 
 * @async
 * @param {string|Buffer|fs.ReadStream} file
 * @returns {object}
 */
utils.getFileInfo = async function (file) {
  if(typeof file == 'string') {
    file = fs.createReadStream(file);      
  }

  let info = {};

  if(file instanceof fs.ReadStream) {
    info.size = (await fs.stat(file.path)).size;
    info.mime = await this.getFileMimeType(file.path);      
    info.ext = mime.getExtension(info.mime);
    info.hash = await hasha.fromFile(file.path, { algorithm: 'md5' });
  }
  else if(file instanceof Buffer) {
    info.size = file.length;
    info.mime = await this.getFileMimeType(file); 
    info.ext = mime.getExtension(info.mime);
    info.hash = await hasha(file, { algorithm: 'md5' });
  }
  else {
    throw new Error('Wrong file format');
  } 

  return info;
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
