const assert = require('chai').assert;
const fetch = require('node-fetch');
const path = require('path');
const fse = require('fs-extra');
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const schema = require('../src/schema');
const tools = require('./tools');

describe('routes', () => {
  let node;
  let client;

  before(async function() {
    node = new Node(await tools.createNodeOptions({ 
      network: { 
        auth: { username: 'username', password: 'password' }
      } 
    }));
    await node.init();
    client = new Client(await tools.createClientOptions({ 
      address: node.address, 
      auth: { username: 'username', password: 'password' }
    }));
    await client.init();
  });

  after(async function() {
    await node.deinit();
    await client.deinit();
  });

  describe('/status', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/status`);
      assert.equal(await res.status, 401);
    });

    it('should return the status', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/status`, options);
      const json = await res.json();
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getStatusResponse(), json);
      });
    });

    it('should return the pretty status', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/status?pretty`, options);
      const json = await res.json();      
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getStatusPrettyResponse(), json);
      });
    });
  });

  describe('/file/:hash', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/file/hash`);
      assert.equal(await res.status, 401);
    });

    it('should return 404', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/file/wrong-hash`, options);
      assert.equal(res.status, 404);
    });

    it('should return the file', async function () {
      const text = 'route-file-check';
      const filePath = path.join(tools.tmpPath, '1.txt');
      const hash = await node.storeFile(Buffer.from(text));
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/file/${hash}`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.equal(await fse.readFile(filePath), text);
    });
  });

  describe('/client/request-file/:hash', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/client/request-file/hash`, { method: 'get' });
      assert.equal(await res.status, 401);
    });

    it('should return 404', async function () { 
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-file/wrong-hash`, options);
      assert.equal(res.status, 404);
    });

    it('should return the file', async function () { 
      const text = 'route-request-file-check';
      const filePath = path.join(tools.tmpPath, '1.txt');
      const hash = await node.storeFile(Buffer.from(text));
      const options = client.createDefaultRequestOptions({ method: 'get' });
      const res = await fetch(`http://${node.address}/client/request-file/${hash}`, options);
      await tools.saveResponseToFile(res, filePath);
      assert.equal(await fse.readFile(filePath), text);
    });
  });

  describe('/client/store-file', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/client/store-file`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return an error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/store-file`, options);
      assert.equal(res.status, 422);
    });

    it('should save the file', async function () {
      const text = 'check-client-store-file';     
      const fileOptions = { contentType: 'text/plain', filename: `${text}.txt` }; 
      const body = tools.createRequestFormData({ 
        file: { value: Buffer.from(text), options: fileOptions } 
      });
      const options = client.createDefaultRequestOptions({ body });
      const res = await fetch(`http://${node.address}/client/store-file`, options);
      const json = await res.json();
      assert.isTrue(await node.hasFile(json.hash));
    });
  });

  describe('/client/get-file-link/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/client/get-file-link`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/get-file-link`, options);
      assert.equal(res.status, 422);
    });

    it('should return the link', async function () {
      const hash = await node.storeFile(Buffer.from('hello')); 
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { hash } }));      
      const res = await fetch(`http://${node.address}/client/get-file-link`, options);
      const json = await res.json();
      assert.equal(json.link, await node.createFileLink(hash));
    });
  });

  describe('/client/get-file-links/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/client/get-file-links`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/get-file-links`, options);
      assert.equal(res.status, 422);
    });

    it('should return the link', async function () {
      const hash = await node.storeFile(Buffer.from('hello')); 
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { hash } }));      
      const res = await fetch(`http://${node.address}/client/get-file-links`, options);
      const json = await res.json();
      assert.equal(json.links[0], await node.createFileLink(hash));
    });
  });

  describe('/client/remove-file/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/client/remove-file/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () { 
      const options = client.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/client/remove-file/`, options);
      assert.equal(res.status, 422);
    });

    it('should remove the file', async function () {
      const hash = await node.storeFile(Buffer.from('hello')); 
      const options = client.createDefaultRequestOptions(tools.createJsonRequestOptions({ body: { hash } }));      
      const res = await fetch(`http://${node.address}/client/remove-file/`, options);
      const json = await res.json();
      assert.equal(json.removed, 1, 'check the response');
      assert.isFalse(await node.hasFile(hash), 'check the file');
    });
  });

  describe('/api/master/get-file-storing-candidates/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/get-file-storing-candidates/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a master acception error', async function () { 
      const options = node.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/api/master/get-file-storing-candidates/`, options);
      assert.equal(await res.status, 422);
    });

    it('should return a data error', async function () { 
      const body = { ignoreAcception: true };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));  
      const res = await fetch(`http://${node.address}/api/master/get-file-storing-candidates/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = {
        ignoreAcception: true,
        info: {
          size: 1,
          hash: 'hash'
        }
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/master/get-file-storing-candidates/`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileStoringCandidatesMasterResponse(), json);
      });
    });
  });

  describe('/api/master/get-file-links/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/get-file-links/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a master acception error', async function () { 
      const options = node.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/api/master/get-file-links/`, options);
      assert.equal(await res.status, 422);
    });

    it('should return a data error', async function () { 
      const body = { ignoreAcception: true };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));   
      const res = await fetch(`http://${node.address}/api/master/get-file-links/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = {
        ignoreAcception: true,
        hash: 'hash'
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/master/get-file-links/`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileLinksMasterResponse(), json);
      });
    });
  });

  describe('/api/master/remove-file/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/master/remove-file/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a master acception error', async function () { 
      const options = node.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/api/master/remove-file/`, options);
      assert.equal(await res.status, 422);
    });

    it('should return a data error', async function () { 
      const body = { ignoreAcception: true };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));   
      const res = await fetch(`http://${node.address}/api/master/remove-file/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = {
        ignoreAcception: true,
        hash: 'hash'
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/master/remove-file/`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileRemovalMasterResponse(), json);
      });
    });
  });

  describe('/api/slave/get-file-storing-info/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/slave/get-file-storing-info/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () {
      const options = node.createDefaultRequestOptions();   
      const res = await fetch(`http://${node.address}/api/slave/get-file-storing-info/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = {
        ignoreAcception: true,
        info: {
          size: 1,
          hash: 'hash'
        }
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/slave/get-file-storing-info/`, options);      
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileStoringInfoSlaveResponse(), json);
      });
    });
  });

  describe('/api/slave/get-file-link-info/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/slave/get-file-link-info/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () {
      const options = node.createDefaultRequestOptions();   
      const res = await fetch(`http://${node.address}/api/slave/get-file-link-info/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema for empty link', async function () {
      const body = {
        ignoreAcception: true,
        hash: 'hash'
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/slave/get-file-link-info/`, options);      
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileLinksSlaveResponse(), json);
      });
    });

    it('should return the right schema for the existent link', async function () {
      const hash = await node.storeFile(Buffer.from('hello'));
      const body = {
        ignoreAcception: true,
        hash
      };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/slave/get-file-link-info/`, options);      
      const json = tools.createServerResponse(node.address, await res.json());
      assert.equal(json.link, await node.createFileLink(hash), 'check the string');
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileLinksSlaveResponse(), json, 'check the validation');
      });
    });
  });

  describe('/api/slave/remove-file/', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/slave/remove-file/`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return a data error', async function () {
      const options = node.createDefaultRequestOptions();   
      const res = await fetch(`http://${node.address}/api/slave/remove-file/`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema', async function () {
      const body = { hash: 'hash' };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));      
      const res = await fetch(`http://${node.address}/api/slave/remove-file/`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileRemovalSlaveResponse(), json);
      });
    });
  });

  describe('/api/node/store-file/:hash', function () {
    it('should return an auth error', async function () { 
      const res = await fetch(`http://${node.address}/api/node/store-file/hash`, { method: 'post' });
      assert.equal(await res.status, 401);
    });

    it('should return an error', async function () { 
      const options = node.createDefaultRequestOptions();
      const res = await fetch(`http://${node.address}/api/node/store-file/hash`, options);
      assert.equal(res.status, 422);
    });

    it('should return the right schema for a common situation', async function () {  
      const fileOptions = { contentType: 'text/plain', filename: `hello.txt` }; 
      const buffer = Buffer.from('hello');
      const hash = await utils.getFileHash(buffer);
      const body = tools.createRequestFormData({ 
        file: { value: Buffer.from('hello'), options: fileOptions } 
      });
      const options = node.createDefaultRequestOptions({ body });
      const res = await fetch(`http://${node.address}/api/node/store-file/${hash}`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileStoringResponse(), json);
      });
    });

    it('should return the right schema for a temp file', async function () { 
      const name = '1.txt';
      const filePath = path.join(node.tempPath, name);
      await fse.writeFile(filePath, 'hello');
      const hash = await utils.getFileHash(fse.createReadStream(filePath));
      const body = { file: name };
      const options = node.createDefaultRequestOptions(tools.createJsonRequestOptions({ body }));
      const res = await fetch(`http://${node.address}/api/node/store-file/${hash}`, options);
      const json = tools.createServerResponse(node.address, await res.json());
      assert.doesNotThrow(() => {
        utils.validateSchema(schema.getFileStoringResponse(), json);
      });
    });
  });
});