const fse = require('fs-extra');
const tools = require('./tools');

describe('storacle', () => {
  before(() => fse.ensureDir(tools.tmpPath));
  after(() => fse.remove(tools.tmpPath));
  require('./utils');
  require('./node');
  require('./client');
  require('./services');
  require('./routes');
  require('./group');
});