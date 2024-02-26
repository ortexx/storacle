import { assert } from "chai";
import path from "path";
import fse from "fs-extra";
import node from "../src/node.js";
import client from "../src/client.js";
import utils from "../src/utils.js";
import tools from "./tools.js";

const Node = node();
const Client = client();

export default function () {
  describe('Client', () => {
    let client;
    let node;
    before(async function () {
      node = new Node(await tools.createNodeOptions());
      await node.init();
    });
    after(async function () {
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
        catch (err) {
          assert.isOk(err.message.match('Wrong file'));
        }
      });
      it('should store the file from a buffer', async () => {
        const hash = await client.storeFile(Buffer.from('client-1'));
        assert.isTrue(await node.hasFile(hash));
      });
      it('should store the file from the path', async () => {
        const filePath = path.join(tools.tmpPath, '1.txt');
        await fse.writeFile(filePath, 'client-2');
        const hash = await client.storeFile(filePath);
        assert.isTrue(await node.hasFile(hash));
      });
      it('should store the file from fse.ReadStream', async () => {
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
        catch (err) {
          assert.isOk(err.message.match('Link for hash'));
        }
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
        catch (err) {
          assert.isOk(err.message.match('Link for hash'));
        }
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
        const res = await client.removeFile(hash);
        assert.equal(res.removed, 1, 'check the result');
        assert.isFalse(await node.hasFile(hash), 'check the file');
      });
    });
    describe('.getNetworkFilesCount()', function () {
      it('should get the right count', async function () {
        const count = await client.getNetworkFilesCount();
        assert.equal(count, await node.db.getData('filesCount'));
      });
    });
    describe('.createRequestedFileLink()', () => {
      it('should return the right link', async () => {
        const hash = 'hash';
        const link = client.createRequestedFileLink(hash);
        assert.equal(link, `${client.getRequestProtocol()}://${client.workerAddress}/client/request-file/${hash}`);
      });
    });
    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await client.deinit();
      });
    });
  });
}