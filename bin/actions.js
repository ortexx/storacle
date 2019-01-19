const chalk = require('chalk');
const prettyBytes = require('pretty-bytes');
const argv = require('optimist').argv;

/**
 * Show some node storage info
 */
module.exports.showStorageInfo = async node => {
  const info = await node.getStorageInfo(); 
  const count = await node.db.getFilesCount() 

  for(let key in info) {
    info[key] = prettyBytes(info[key]);
  }

  info.filesCount = count;  
  //eslint-disable-next-line no-console
  console.log(chalk.cyan(JSON.stringify(info, null, 2)));
};

/**
 * Normalize files info
 */
module.exports.normalizeFilesInfo = async node => {
  await node.normalizeFilesInfo();
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('Files info has been normalized'));
};

/**
 * Export files to other node
 */
module.exports.exportFiles = async node => {
  await node.exportFiles(argv.n || argv.address);
  //eslint-disable-next-line no-console
  console.log(chalk.cyan('Files have been exported'));
};