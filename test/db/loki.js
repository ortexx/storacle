const assert = require('chai').assert;
const tools = require('../tools');
const DatabaseLokiStoracle = require('../../src/db/transports/loki')();
const fse = require('fs-extra');

describe('DatabaseLokiStoracle', () => {
  let loki;
  
  describe('instance creation', function () {
    it('should create an instance', function () { 
      assert.doesNotThrow(() => loki = new DatabaseLokiStoracle(this.node, {
        filename: tools.getDbFilePath(this.node.port)
      }));    
    });
  });

  describe('.init()', function () { 
    it('should not throw an exception', async function () {
      await loki.init();
    });  
    
    it('should create the db file', async function () {    
      assert.isTrue(await fse.exists(tools.getDbFilePath(this.node.port)));
    });
  });  

  describe('.deinit()', function () { 
    it('should not throw an exception', async function () {
      await loki.deinit();
    });
  }); 

  describe('reinitialization', () => {
    it('should not throw an exception', async function () {
      await loki.init();
    });
  });
  
  describe('.destroy()', function () { 
    it('should not throw an exception', async function () {
      await loki.destroy();
    });
    
    it('should remove the db file', async function () {
      assert.isFalse(await fse.exists(tools.getDbFilePath(this.node.port)));
    });
  });
});