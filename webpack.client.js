import path from "path";
import merge from "lodash-es/merge.js";
import spWebpackConfig from "spreadable/webpack.client.js";

const __dirname = new URL('.', import.meta.url).pathname;

export default (options = {}, wp) => {
  options = merge({
    include: [],
    mock: {
      "stream": false,
      "detect-file-type": true,
      "diskusage": true,
      "fs-extra": true,
      "fs": true,
      "crypto": path.join(__dirname, "/src/browser/client/mock/crypto.js")
    }
  }, options);
  options.include.push([path.resolve(__dirname, 'src/browser/client')]);
  return wp ? spWebpackConfig(options, wp) : options;
};
