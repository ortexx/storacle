const assert = require('chai').assert;
const fse = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const Node = require('../src/node')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('Node', () => {
  let node;

  describe('instance creation', () => {
    it('should create an instance', async() => { 
      const options = await tools.createNodeOptions();
      assert.doesNotThrow(() => node = new Node(options));
    });
  });

  describe('.init()', () => {
    it('should not throw an exception', async () => {
      await node.init();
    });

    it('should create the storage', async () => {
      assert.isTrue(await fse.pathExists(tools.getStoragePath(node.port)));
    });
  });

  describe('.calculateStorageInfo()', () => {    
    let data;
    let defaultOptions;

    before(async () => {
      defaultOptions = _.merge({}, node.options);
      data = await node.getStorageInfo();
    });

    after(async () => {
      node.options = defaultOptions;
      await node.calculateStorageInfo();
    });

    it('should define the necessary variables as expected', async () => {
      node.options.storage.dataSize = 1024;
      node.options.storage.tempSize = 1024;
      node.options.storage.autoCleanSize = 8;
      node.options.file.maxSize = 128;
      node.options.file.minSize = 1;
      await node.calculateStorageInfo();
      assert.equal(node.storageDataSize, node.options.storage.dataSize, 'check "storage.dataSize"');
      assert.equal(node.storageTempSize, node.options.storage.tempSize, 'check "storage.tempSize"');
      assert.equal(node.storageAutoCleanSize, node.options.storage.autoCleanSize, 'check "storage.autoCleanSize"');
      assert.equal(node.fileMaxSize, node.options.file.maxSize, 'check "file.minSize"');
    });

    it('should define the necessary variables as expected using a percentage', async () => {      
      node.options.storage.dataSize = '50%';
      node.options.storage.tempSize = '50% - 1b';
      node.options.storage.autoCleanSize = '10%';
      node.options.file.maxSize = '20%';
      node.options.file.minSize = '10%';
      await node.calculateStorageInfo();
      assert.equal(node.storageDataSize, Math.floor(data.available / 2), 'check "storage.dataSize"');
      assert.equal(Math.floor(node.storageTempSize), Math.floor(node.storageDataSize) - 1, 'check "storage.tempSize"');
      assert.equal(Math.floor(node.storageAutoCleanSize), Math.floor(node.storageDataSize * 0.1), 'check "storage.autoCleanSize"');
      assert.equal(Math.floor(node.fileMaxSize), Math.floor(data.available * 0.2), 'check "file.maxSize"');
      assert.equal(Math.floor(node.fileMinSize), Math.floor(data.available * 0.1), 'check "file.minSize"');
    });

    it('should throw "storage.dataSize" error', async () => {
      node.options.storage.dataSize = '110%';
      node.options.storage.tempSize = '80%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('"storage.dataSize"'));
      }
    });

    it('should throw "storage.tempSize" error', async () => {
      node.options.storage.dataSize = '80%';
      node.options.storage.tempSize = '110%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('"storage.tempSize"'));
      }
    });

    it('should throw "storage.autoCleanSize" error', async () => {
      node.options.storage.dataSize = '80%';
      node.options.storage.tempSize = '10%';
      node.options.storage.autoCleanSize = '110%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('"storage.autoCleanSize"'));
      }

      node.options.storage.autoCleanSize = 0;
    });

    it('should throw "file.maxSize" error because of the data size', async () => {      
      node.options.storage.dataSize = '10%';
      node.options.storage.tempSize = '30%';
      node.options.file.maxSize = '20%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('"file.maxSize"'));
      }
    });

    it('should throw "file.maxSize" error because of the temp size', async () => {
      node.options.storage.dataSize = '30%';
      node.options.storage.tempSize = '10%';
      node.options.file.maxSize = '20%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('Minimum temp file'));
      }
    });

    it('should throw "file.maxSize" error because of "file.minSize"', async () => {
      node.options.storage.dataSize = '30%';
      node.options.storage.tempSize = '30%';
      node.options.file.maxSize = '20%';
      node.options.file.minSize = '25%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('file.minSize'));
      }
    });

    it('should throw "dataSize + tempSize" error', async () => {
      node.options.storage.dataSize = '50%';
      node.options.storage.tempSize = '80%';

      try {
        await node.calculateStorageInfo();
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.includes('"storage.dataSize" + "storage.tempSize"'));
      }
    });
  });

  assert.hasAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'bar', 'baz']);

  describe('.getStorageInfo()', () => {
    let keys;

    before(() => {
      keys = [
        'total', 'available', 'allowed', 'used', 
        'free', 'clean', 'fileMaxSize', 'fileMinSize',
        'tempAllowed', 'tempUsed', 'tempFree'
      ];
    });

    it('should have all the keys', async () => {      
      assert.hasAllKeys(await node.getStorageInfo(), keys);
    });

    it('should get number values', async () => {
      const info = await node.getStorageInfo();

      for(let i = 0; i < keys.length; i++) {
        assert.isNumber(info[keys[i]]);
      }
    });

    it('should exclude the necessary props', async () => {
      for(let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const info = await node.getStorageInfo({ [key]: false });
        assert.isUndefined(info[key]);
      }      
    });
  });

  describe('.getFilePath()', () => {
    it('should return the right format', () => {
      const filePath = node.getFilePath('d131dd02c5e6eec4693d9a0698aff95c');
      assert.equal(filePath, path.join(node.filesPath, 'd','1', 'd131dd02c5e6eec4693d9a0698aff95c'));
    });
  });
  
  describe('.storeFile()', () => {
    let filesCount;

    before(() => {
      filesCount = 0;
    });

    it('should not store the wrong file type', async () => {
      try {
        await node.storeFile({});
        throw new Error('Fail');
      }
      catch(err) {
        assert.isOk(err.message.match('Wrong file'));
      }
    });

    it('should store the file from a buffer', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      filesCount++;
      assert.isTrue(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), filesCount), 'check the count';
    });

    it('should overwrite the same file', async () => {
      await node.storeFile(Buffer.from('hello'));
      assert.equal(await node.db.getData('filesCount'), filesCount);
    });

    it('should store the file from the path', async () => {
      const filePath = path.join(tools.tmpPath, '1.txt');
      await fse.writeFile(filePath, 'bye');
      const hash = await node.storeFile(filePath);
      filesCount++;
      assert.isTrue(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), filesCount), 'check the count';
    });

    it('should store the file from fs.ReadStream', async () => {
      const filePath = path.join(tools.tmpPath, '1.txt');
      await fse.writeFile(filePath, 'goodbye');
      const hash = await node.storeFile(fse.createReadStream(filePath));
      filesCount++;
      assert.isTrue(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), filesCount), 'check the count';
    });

    it('should store the file with the temp path', async () => {
      const filePath = path.join(node.tempPath, '1.txt');
      await fse.writeFile(filePath, 'morning');
      const hash = await node.storeFile(await fse.createReadStream(filePath));
      filesCount++;
      assert.isTrue(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), filesCount), 'check the count';
    });
  });

  describe('.hasFile()', () => {
    it('should return false', async () => {
      assert.isFalse(await node.hasFile('wrong'));
    });

    it('should return true', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      assert.isTrue(await node.hasFile(hash));
    });
  });

  describe('.createFileLink()', () => {
    it('should create a right file link', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      assert.equal(await node.createFileLink(hash), `http://${node.address}/file/${hash}.txt`);
    });
  });

  describe('.getFileLink()', () => {
    it('should not return the wrong file hash link', async () => {
      assert.isFalse(utils.isValidFileLink(await node.getFileLink('wrong')));
    });

    it('should return the right link', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      assert.isTrue(utils.isValidFileLink(await node.getFileLink(hash)));
    });
  });

  describe('.getFileLinks()', () => {
    it('should return an empty array', async () => {
      const links = await node.getFileLinks('wrong');
      assert.isOk(Array.isArray(links) && !links.length);
    });

    it('should return the right link in an array', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      const links = await node.getFileLinks(hash);
      assert.isTrue(utils.isValidFileLink(links[0]));
    });
  });

  describe('.removeFile()', () => {
    it('should remove the file', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      const filesCount = await node.db.getData('filesCount');
      const res = await node.removeFile(hash);
      assert.equal(res.removed, 1, 'check the result');
      assert.isFalse(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), filesCount - 1, 'check the count');
    });
  });

  describe('.getNetworkFilesCount()', function () {
    it('should get the right count', async function () {
      const count = await node.getNetworkFilesCount();
      assert.equal(count, await node.db.getData('filesCount'));
    });
  });

  describe('.emptyStorage()', () => {
    it('should remove all files', async () => {
      await node.storeFile(Buffer.from('hello'));
      let files = await fse.readdir(node.filesPath);
      assert.isOk(files.length > 0, 'check before');
      await node.emptyStorage();
      files = await fse.readdir(node.filesPath);
      assert.equal(files.length, 0, 'check after');
    });
  });

  describe('.addFileToStorage()', () => {
    it('should add the file', async () => {
      await node.emptyStorage();
      const filePath = path.join(node.tempPath, '1.txt');
      await fse.writeFile(filePath, 'hello');
      const stat = await fse.stat(filePath);
      const file = fse.createReadStream(filePath);
      const hash = await utils.getFileHash(file);
      await node.addFileToStorage(file, hash);
      assert.isTrue(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), 1, 'check the count');
      assert.equal(await node.db.getData('filesTotalSize'), stat.size, 'check the size');
    });
  });

  describe('.removeFileFromStorage()', () => {
    it('should remove the file', async () => {
      const hash = await utils.getFileHash(Buffer.from('hello'));
      await node.removeFileFromStorage(hash);
      assert.isFalse(await fse.pathExists(node.getFilePath(hash)), 'check the file');
      assert.equal(await node.db.getData('filesCount'), 0, 'check the count');
      assert.equal(await node.db.getData('filesTotalSize'), 0, 'check the size');
    });
  });

  describe('.normalizeDir()', () => {
    let dir;
    let hash;

    it('should not remove the directory', async () => {
      await node.emptyStorage();
      hash = await node.storeFile(Buffer.from('hello'));
      dir = path.dirname(node.getFilePath(hash));
      await node.normalizeDir(dir);
      assert.isTrue(await fse.pathExists(dir));
    });

    it('should remove the directory', async () => {
      await fse.remove(node.getFilePath(hash));
      await node.normalizeDir(dir);
      assert.isFalse(await fse.pathExists(dir), 'check the directory');
      assert.isNotOk((await fse.readdir(node.filesPath)).length, 'check the files path');
    });
  });

  describe('.getStorageTotalSize()', () => {
    it('should get the right size', async () => {
      await node.emptyStorage();
      assert.equal(0, await node.getStorageTotalSize(), 'check the empty folder');
      const buffer = Buffer.from('hello');
      const hash = await node.storeFile(buffer);
      const folder = path.dirname(await node.getFilePath(hash));
      const size = (await fse.stat(folder)).size * node.__dirNestingSize + buffer.length; 
      assert.equal(size, await node.getStorageTotalSize(), 'check with the files');
    });
  });

  describe('.getTempDirInfo()', () => {
    let size;
    let count;

    before(async () => {
      size = 0;
      count = 0;
      await fse.emptyDir(node.tempPath);
    });

    after(async () => {
      await fse.emptyDir(node.tempPath);
    });

    it('should get a zero', async () => {      
      let info = await node.getTempDirInfo();
      assert.equal(count, info.count, 'check the folder files count');
      assert.equal(size, info.size, 'check the folder size');
    });

    it('should return count as 1 and the actual file size', async () => {
      const filePath = path.join(node.tempPath, '1.txt');
      await fse.writeFile(filePath, 'hello');
      size += (await fse.stat(filePath)).size;
      count++;
      let info = await node.getTempDirInfo();
      assert.equal(count, info.count, 'check the folder files count');
      assert.equal(size, info.size, 'check the folder size');
    });

    it('should return count as 2 and the actual files size', async () => {
      const filePath = path.join(node.tempPath, '2.txt');
      await fse.writeFile(filePath, 'goodbye');
      size += (await fse.stat(filePath)).size;
      count++;
      let info = await node.getTempDirInfo();
      assert.equal(count, info.count, 'check the folder files count');
      assert.equal(size, info.size, 'check the folder size');
    });
  });

  describe('.cleanUpStorage()', () => {
    let lastStorageAutoCleanSize;

    before(() => {
      lastStorageAutoCleanSize = node.storageAutoCleanSize;
    });

    after(() => {
      node.storageAutoCleanSize = lastStorageAutoCleanSize;
    });

    it('should not remove anything', async () => {
      await node.emptyStorage();
      await node.storeFile(Buffer.from('hello'));      
      await node.calculateStorageInfo();
      const size = await node.getStorageTotalSize();
      node.storageAutoCleanSize = node.storageDataSize - size;
      await node.cleanUpStorage();
      assert.equal(await node.getStorageTotalSize(), size);
    });

    it('should remove the file', async () => {
      await node.calculateStorageInfo();
      const size = await node.getStorageTotalSize(); 
      node.storageAutoCleanSize = node.storageDataSize - size / 2;
      await node.cleanUpStorage();
      assert.equal(await node.getStorageTotalSize(), 0);
    });

    it('should remove only one file', async () => {   
      const buffer = Buffer.from('hello');      
      await node.storeFile(buffer);
      await node.storeFile(Buffer.from('goodbye'));
      await node.calculateStorageInfo();
      const size = await node.getStorageTotalSize(); 
      node.storageAutoCleanSize = node.storageDataSize - size + buffer.length;
      await node.cleanUpStorage();
      assert.equal(await node.db.getData('filesCount'), 1);
    });
  });

  describe('.cleanUpTempDir()', () => {
    let options;

    before(async () => {
      options = _.merge({}, node.options);
      await fse.emptyDir(node.tempPath);
    });

    after(() => {
      node.options = options;
    });

    it('should not remove anything', async () => {      
      node.options.storage.tempLifetime = Infinity;
      const filePath = path.join(node.tempPath, '1.txt');
      await fse.writeFile(filePath, 'hello');
      await node.cleanUpTempDir();
      const files = await fse.readdir(node.tempPath);
      assert.equal(files.length, 1);
    });

    it('should remove only one file', async () => { 
      await tools.wait(500);      
      const filePath = path.join(node.tempPath, '2.txt');
      await fse.writeFile(filePath, 'hi');
      const stat = await fse.stat(filePath);
      node.options.storage.tempLifetime = Date.now() - stat.atimeMs + 100;
      await node.cleanUpTempDir();
      const files = await fse.readdir(node.tempPath);
      assert.equal(files.length, 1);
    });

    it('should remove all files', async () => {
      node.options.storage.tempLifetime = 1;
      const filePath = path.join(node.tempPath, '3.txt');
      await fse.writeFile(filePath, 'hey');
      await tools.wait(1); 
      await node.cleanUpTempDir();
      const files = await fse.readdir(node.tempPath);
      assert.equal(files.length, 0);
    });
  });

  describe('.normalizeFilesInfo()', () => {
    it('should fix "filesCount"', async () => {
      await node.emptyStorage();
      await node.storeFile(Buffer.from('hello'));
      const count = await node.db.getData('filesCount');
      await node.db.setData('filesCount', 10);
      await node.normalizeFilesInfo();
      assert.equal(await node.db.getData('filesCount'), count);
    });

    it('should fix "filesTotalSize"', async () => {
      const size = await node.db.getData('filesTotalSize');
      await node.db.setData('filesTotalSize', Infinity);
      await node.normalizeFilesInfo();
      assert.equal(await node.db.getData('filesTotalSize'), size);
    });
  });

  describe('.exportFiles()', () => {
    let importNode;
    
    before(async () => {
      importNode = new Node(await tools.createNodeOptions());
      await importNode.init();
    });

    after(async () => {
      await importNode.deinit();
    });

    it('should export the file', async () => {
      await node.emptyStorage();
      const hash = await node.storeFile(Buffer.from('hello'));
      await node.exportFiles(importNode.address);
      assert.isTrue(await importNode.hasFile(hash));
    });
  });

  describe('.fileAvailabilityTest()', () => {
    let options;

    before(async () => {
      options = _.merge({}, node.options);
    });

    after(() => {
      node.options = options;
    });

    it('should throw an error because of wrong size', async () => {
      try {
        await node.fileAvailabilityTest({ hash: '1' });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong file'));
      }
    });

    it('should throw an error because of storage size', async () => {
      try {
        await node.fileAvailabilityTest({ hash: '1', size: (await node.getStorageInfo()).free + 1 });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Not enough space'));
      }
    });

    it('should throw an error because of temp size', async () => {
      try {
        await node.fileAvailabilityTest({ hash: '1', size: 2, storage: { tempFree: 1, free: 3 } });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('space in the temp'));
      }
    });

    it('should throw an error because of max size', async () => {
      try {
        node.fileMaxSize = 1;
        await node.fileAvailabilityTest({ hash: '1', size: node.fileMaxSize + 1 });        
        throw new Error('Fail');
      } 
      catch (err) {
        node.fileMaxSize = Infinity;
        assert.isOk(err.message.match('too big'));
      }
    });

    it('should throw an error because of min size', async () => {
      try {
        node.fileMinSize = 2;
        await node.fileAvailabilityTest({ hash: '1', size: node.fileMinSize - 1 });        
        throw new Error('Fail');
      } 
      catch (err) {
        node.fileMinSize = 0;
        assert.isOk(err.message.match('too small'));
      }
    });

    it('should throw an error because of hash', async () => {
      try {
        await node.fileAvailabilityTest({ size: 1 });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('Wrong file'));
      }
    });

    it('should throw an error because of mime whitelist', async () => {
      node.options.file.mimeWhitelist = ['image/jpeg'];
      
      try {
        await node.fileAvailabilityTest({ size: 1, hash: '1', mime: 'text/plain' });
        throw new Error('Fail');
      } 
      catch (err) {        
        assert.isOk(err.message.match('mime type'));        
      }
    });

    it('should throw an error because of mime blacklist', async () => {
      node.options.file.mimeBlacklist = ['image/jpeg'];
      node.options.file.mimeWhitelist = [];

      try {
        await node.fileAvailabilityTest({ size: 1, hash: '1', mime: 'image/jpeg' });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('mime type'));   
      }
    });

    it('should throw an error because of extension whitelist', async () => {
      node.options.file.extWhitelist = ['jpeg'];

      try {
        await node.fileAvailabilityTest({ size: 1, hash: '1', ext: 'txt' });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('extension'));   
      }
    });

    it('should throw an error because of extension blacklist', async () => {      
      node.options.file.extBlacklist = ['jpeg'];
      node.options.file.extWhitelist = [];

      try {
        await node.fileAvailabilityTest({ size: 1, hash: '1', ext: 'jpeg' });
        throw new Error('Fail');
      } 
      catch (err) {
        assert.isOk(err.message.match('extension'));  
      }
    });

    it('should not throw an error', async () => {
      await node.fileAvailabilityTest({ size: 1, hash: '1' });
      await node.fileAvailabilityTest({ size: 1, hash: '1', mime: 'audio/mpeg', ext: 'mp3' });
    });
  });

  describe('.checkFileAvailability()', () => {
    it('should return true', async () => {
      await node.checkFileAvailability({ size: 1, hash: '1' });
    });

    it('should return false', async () => {
      await node.checkFileAvailability({ size: 1 }, 'check the size');
      await node.checkFileAvailability({ hash: '1' }, 'check the hash');
    });
  });

  describe('.checkCacheLink()', () => {
    it('should return false', async () => {
      await node.checkCacheLink(`http://${node.address}/file/wrong`);
    });

    it('should return true', async () => {
      const hash = await node.storeFile(Buffer.from('hello'));
      await node.checkCacheLink(`http://${node.address}/file/${hash}`);
    });
  });
  
  describe('.deinit()', () => {
    it('should not throw an exception', async () => {
      await node.deinit();
    });

    it('should not remove the storage', async () => {
      assert.isTrue(await fse.pathExists(tools.getStoragePath(node.port)));
    });
  });

  describe('reinitialization', () => {
    it('should not throw an exception', async () => {
      await node.init();
    });

    it('should create the storage', async () => {
      assert.isTrue(await fse.pathExists(tools.getStoragePath(node.port)));
    });
  });

  describe('.destroy()', () => {
    it('should not throw an exception', async () => {
      await node.destroy();
    });

    it('should remove the storage', async () => {
      assert.isFalse(await fse.pathExists(tools.getStoragePath(node.port)));
    });
  });
});