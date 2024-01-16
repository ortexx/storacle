import * as controllers from "./controllers.js";
import midds from "../../midds.js";
export default [
    /**
     * Store the file
     *
     * @api {post} /api/node/store-file/:hash
     * @apiParam {fse.ReadStream|string} file
     */
    {
        name: 'storeFile',
        method: 'post',
        url: '/store-file/:hash',
        fn: [
            midds.requestQueueFileHash,
            midds.filesFormData,
            midds.prepareFileToStore,
            controllers.storeFile
        ]
    }
];
