const assert = require('chai').assert;
const path = require('path');
const fse = require('fs-extra');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('Client', () => {
  let client;
  let node;

  before(async function() {
    node = new Node(await tools.createNodeOptions());
    await node.init();
  });

  after(async function() {
    await node.deinit();
  });

  describe('instance creation', function () {
    it('should create an instance', async function () { 
      const options = await tools.createClientOptions({ address: node.address });
      assert.doesNotThrow(() => client = new Client(options));
    });
  });

  describe('.init()', function () {
    it('should not throw an exception', async function () {
      await client.init();
    });
  });

  describe('.storeFile()', function () {
    it('should not store the wrong file type', async () => {
      try {
        await client.storeFile({});
        throw new Error('Fail');
      }
      catch(err) {}
    });

    it('should store the file from a buffer', async () => {
      const hash = await client.storeFile(Buffer.from('client-1'));
      assert.isTrue(await node.hasFile(hash));
    });

    it('should store the file from a path', async () => {
      const filePath = path.join(tools.tmpPath, '1.txt');
      await fse.writeFile(filePath, 'client-2');
      const hash = await client.storeFile(filePath);
      assert.isTrue(await node.hasFile(hash));
    });

    it('should store the file from fs.ReadStream', async () => {
      const filePath = path.join(tools.tmpPath, '1.txt');
      await fse.writeFile(filePath, 'client-3');
      const hash = await client.storeFile(filePath);
      assert.isTrue(await node.hasFile(hash));
    });
  });

  describe('.getFileLink()', () => {
    it('should not return the wrong file hash link', async () => {
      assert.isFalse(utils.isValidFileLink(await client.getFileLink('wrong')));
    });

    it('should return the right link', async () => {
      const hash = await client.storeFile(Buffer.from('hello'));
      assert.isTrue(utils.isValidFileLink(await client.getFileLink(hash)));
    });
  });

  describe('.getFileLinks()', () => {
    it('should return an empty array', async () => {
      const links = await client.getFileLinks('wrong');
      assert.isOk(Array.isArray(links) && !links.length);
    });

    it('should return the right link in an array', async () => {
      const hash = await client.storeFile(Buffer.from('hello'));
      const links = await client.getFileLinks(hash);
      assert.isTrue(utils.isValidFileLink(links[0]));
    });
  });

  describe('.getFileToBuffer()', () => {
    it('should throw an exception because of a wrong file hash', async () => {
      try {
        await client.getFileToBuffer('wrong');
        throw new Error('Fail');
      }
      catch(err) {}    
    });

    it('should return the buffer', async () => {
      const buffer = Buffer.from('hello');
      const json = JSON.stringify([...buffer]);
      const hash = await client.storeFile(buffer);
      const result = await client.getFileToBuffer(hash);
      assert.instanceOf(result, Buffer, 'check the intance');
      assert.equal(json, JSON.stringify([...result]), 'check the data');
    });
  });

  describe('.getFileToPath()', () => {
    it('should throw an exception because of a wrong file hash', async () => {
      try {
        await client.getFileToBuffer('wrong');
        throw new Error('Fail');
      }
      catch(err) {}     
    });

    it('should save the file', async () => {
      const text = 'hello';
      const filePath = path.join(tools.tmpPath, '1.txt');
      const hash = await client.storeFile(Buffer.from(text));
      await client.getFileToPath(hash, filePath);
      assert.equal(await fse.readFile(filePath), text);
    });
  });

  describe('.removeFile()', () => {
    it('should remove the file', async () => {
      const hash = await client.storeFile(Buffer.from('hello'));
      await client.removeFile(hash);
      assert.isFalse(await node.hasFile(hash));
    });
  });

  describe('.createRequestedFileLink()', () => {
    it('should return the right link', async () => {
      const hash = 'hash';
      await client.removeFile(hash);
      const link = client.createRequestedFileLink('hash');
      assert.equal(link, `${client.getRequestProtocol()}://${client.workerAddress}/client/request-file/${hash}`);
    });
  });
  
  describe('.deinit()', function () {
    it('should not throw an exception', async function () {
      await client.deinit();
    });
  });
});