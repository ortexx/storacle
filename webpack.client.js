const path = require('path');
const merge = require('lodash/merge');
const spWebpackConfig = require('spreadable/webpack.client.js');

module.exports = (options = {}) => {
  return spWebpackConfig(merge({
    include: [path.resolve(__dirname, 'src/browser/client')].concat(options.include || []),
    mock: {      
      "mmmagic": true,
      "diskusage": true,
      "fs-extra": true,
      "crypto": path.join(__dirname, "/src/browser/client/mock/crypto.js")
    }
  }, options));
}