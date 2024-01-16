import chalk from "chalk";
import yargs from "yargs";
import srcUtils from "../src/utils.js";
import utils from "./utils.js";
import * as actions$0 from "spreadable-ms/bin/actions";
const argv = yargs.argv;
const actions = Object.assign({}, actions$0);
/**
 * Normalize the files info
 */
actions.normalizeFilesInfo = async (node) => {
    await node.normalizeFilesInfo();
    //eslint-disable-next-line no-console
    console.log(chalk.cyan('The files info has been normalized'));
};
/**
 * Clean up the storage
 */
actions.cleanUpStorage = async (node) => {
    await node.cleanUpStorage();
    //eslint-disable-next-line no-console
    console.log(chalk.cyan('The storage has been cleaned up'));
};
/**
 * Export all files to another node
 */
actions.exportFiles = async (node) => {
    await node.exportFiles(argv.address || argv.n);
    //eslint-disable-next-line no-console
    console.log(chalk.cyan('The files have been exported'));
};
/**
 * Store the file
 */
actions.storeFile = async (node) => {
    const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
    const fileText = argv.fileText || argv.t;
    const hash = await node.storeFile(filePath || new Buffer(fileText));
    //eslint-disable-next-line no-console
    console.log(chalk.cyan(`The file with hash "${hash}" has been stored`));
};
/**
 * Get the file link
 */
actions.getFileLink = async (node) => {
    const hash = argv.hash || argv.h;
    const link = await node.getFileLink(hash);
    if (!link) {
        throw new Error(`There is no file with the hash ${hash}`);
    }
    //eslint-disable-next-line no-console
    console.log(chalk.cyan(`The file link is "${link}"`));
};
/**
 * Get the file to the path
 */
actions.getFileToPath = async (node) => {
    const hash = argv.hash || argv.h;
    const filePath = utils.getAbsolutePath(argv.filePath || argv.f);
    const link = await node.getFileLink(hash);
    if (!link) {
        throw new Error(`There is no file with the hash ${hash}`);
    }
    await srcUtils.fetchFileToPath(filePath, link, node.createDefaultRequestOptions());
    //eslint-disable-next-line no-console
    console.log(chalk.cyan(`The file "${hash}" has been saved to "${filePath}"`));
};
/**
 * Remove the file
 */
actions.removeFile = async (node) => {
    const hash = argv.hash || argv.h;
    await node.removeFile(hash);
    //eslint-disable-next-line no-console
    console.log(chalk.cyan(`The file "${hash}" has been removed`));
};
/**
 * Flush the files cache
 */
actions.flushFilesCache = async (node) => {
    await node.cacheFile.flush();
    //eslint-disable-next-line no-console
    console.log(chalk.cyan(`The files cache has been flushed`));
};
export default actions;
