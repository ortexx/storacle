const chalk = require('chalk');
const argv = require('optimist').argv;

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