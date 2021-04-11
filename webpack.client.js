const path = require('path');
const merge = require('lodash/merge');
const spWebpackConfig = require('spreadable/webpack.client.js');

module.exports = (options = {}, wp) => {
  options = merge({
    include: [],
    mock: {
      "stream": false,
      "detect-file-type": true,
      "diskusage": true,
      "fs-extra": true,
      "crypto": path.join(__dirname, "/src/browser/client/mock/crypto.js")      
    }
  }, options); 
  options.include.push([path.resolve(__dirname, 'src/browser/client')]);
  return wp? spWebpackConfig(options, wp): options;
}