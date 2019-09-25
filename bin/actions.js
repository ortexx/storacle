const chalk = require('chalk');
const argv = require('optimist').argv;
const fs = require('fs');
const fetch = require('node-fetch');
const utils = require('./utils');

/**
 * Normalize the files info
 */
module.exports.normalizeFilesInfo = async node => {
  await node.normalizeFilesInfo();
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The files info has been normalized'));
};

/**
 * Export the files to another node
 */
module.exports.exportFiles = async node => {
  await node.exportFiles(argv.address || argv.n);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('The files have been exported'));
};

/**
 * Store the file
 */
module.exports.storeFile = async node => {
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const fileText = argv.t || argv.fileText;
  const hash = await node.storeFile(filePath || new Buffer(fileText));
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The file with hash "${hash}" has been stored`));
};

/**
 * Get the file link
 */
module.exports.getFileLink = async node => {
  const hash = argv.h || argv.hash;
  const link = await node.getFileLink(argv.hash || argv.h);

  if(!link) {
    throw new Error(`There is no file with the hash ${hash}`);
  }

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The file link is "${link}"`));
};

/**
 * Get the file to path
 */
module.exports.getFileToPath = async node => {
  const hash = argv.h || argv.hash;
  const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
  const link = await node.getFileLink(argv.hash || argv.h);

  if(!link) {
    throw new Error(`There is no file with the hash ${hash}`);
  }

  await new Promise(async (resolve, reject) => {
    try { 
      (await fetch(link, node.createDefaultRequestOptions({ method: 'GET' }))).body
      .on('error', reject)
      .pipe(fs.createWriteStream(filePath))
      .on('error', reject)
      .on('finish', resolve);
    }   
    catch(err) {
      reject(err);
    }  
  });

  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The file "${hash}" has been saved to "${filePath}"`));
};

/**
 * Remove the file
 */
module.exports.removeFile = async node => {
  const hash = argv.hash || argv.h;
  await node.removeFile(hash);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(`The file "${hash}" has been removed`));
};