import errors from "../../../errors.js";
import utils from "../../../utils.js";
import formData from "express-form-data";
import fse from "fs-extra";
import path from "path";
import midds from "spreadable-ms/src/server/transports/express/midds.js";

/**
 * Provide files receiving
 */
midds.file = node => {
    return async (req, res, next) => {
        try {
            const hash = req.params.hash.split('.')[0];
            if (!await node.hasFile(hash)) {
                throw new errors.NotFoundError('File not found');
            }
            if (req.headers['storacle-cache-check']) {
                return res.send('');
            }
            const cache = Math.ceil(node.options.file.responseCacheLifetime / 1000);
            const filePath = node.getFilePath(hash);
            const info = await utils.getFileInfo(filePath, { hash: false });
            info.mime && res.setHeader("Content-Type", info.mime);
            cache && res.set('Cache-Control', `public, max-age=${cache}`);
            res.setHeader("Content-Length", info.size);
            const stream = fse.createReadStream(filePath);
            stream.on('error', next).pipe(res);
        }
        catch (err) {
            next(err);
        }
    };
};
/**
 * Prepare file for storing
 */
midds.prepareFileToStore = node => {
    return async (req, res, next) => {
        let file;
        try {
            file = req.body.file;
            const invalidFileErr = new errors.WorkError('"file" field is invalid', 'ERR_STORACLE_INVALID_FILE_FIELD');
            if (file && !utils.isFileReadStream(file)) {
                if (!utils.isIpEqual(req.clientIp, node.ip)) {
                    throw invalidFileErr;
                }
                try {
                    file = fse.createReadStream(path.join(node.tempPath, file));
                }
                catch (err) {
                    throw invalidFileErr;
                }
            }
            if (!file || !utils.isFileReadStream(file)) {
                throw invalidFileErr;
            }
            req.body.file = file;
            next();
        }
        catch (err) {
            utils.isFileReadStream(file) && file.destroy();
            next(err);
        }
    };
};
/**
 * Provide files storing
 */
midds.filesFormData = node => {
    return [
        async (req, res, next) => {
            try {
                let info = await node.getTempDirInfo();
                let maxSize = node.storageTempSize - info.size;
                let length = +req.headers['content-length'];
                if (length > node.fileMaxSize) {
                    throw new errors.WorkError('The file is too big', 'ERR_STORACLE_FILE_BIG');
                }
                if (length < node.fileMinSize) {
                    throw new errors.WorkError('The file is too small', 'ERR_STORACLE_FILE_SMALL');
                }
                if (node.calculateTempFileMinSize(length) > maxSize) {
                    throw new errors.WorkError('Not enough place in the temp folder', 'ERR_STORACLE_REQUEST_TEMP_NOT_ENOUGH');
                }
                formData.parse({
                    autoClean: true,
                    maxFilesSize: node.fileMaxSize,
                    uploadDir: node.tempPath
                })(req, res, next);
            }
            catch (err) {
                next(err);
            }
        },
        formData.format(),
        formData.stream(),
        formData.union()
    ];
};
/**
 * Control file requests limit by the file hash
 */
midds.requestQueueFileHash = (node) => {
    const options = { limit: 1 };
    return (req, res, next) => {
        return midds.requestQueue(node, `fileHash=${req.params.hash || req.body.hash}`, options)(req, res, next);
    };
};
export default midds;
