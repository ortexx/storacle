import { assert } from "chai";
import fse from "fs-extra";
import path from "path";
import utils from "../src/utils.js";
import tools from "./tools.js";
import { URL } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

export default function () {
    describe('utils', () => {
        describe('.getDiskInfo()', () => {
            it('should return the necessary keys', async () => {
                assert.containsAllKeys(await utils.getDiskInfo(__dirname), ['available', 'total']);
            });
        });
        describe('.isValidFileLink()', () => {
            it('should return true', () => {
                assert.isTrue(utils.isValidFileLink('http://localhost:80/file/hash'), 'check http');
                assert.isTrue(utils.isValidFileLink('https://192.0.0.1:3000/file/hash'), 'check https');
            });
            it('should return false', () => {
                assert.isFalse(utils.isValidFileLink('http://localhost/file/hash'), 'check without a port');
                assert.isFalse(utils.isValidFileLink('ftp://localhost/file/hash'), 'check wrong a protocol');
                assert.isFalse(utils.isValidFileLink('http://192.0.0.1:80/files/hash'), 'check the wrong path');
            });
        });
        describe('files info', () => {
            let filePath;
            let buffer;
            before(() => {
                filePath = path.join(tools.tmpPath, '1.txt');
                buffer = Buffer.from('hello');
            });
            describe('.getFileInfo()', () => {
                describe('fse.ReadStream', () => {
                    it('should get all info', async () => {
                        await fse.writeFile(filePath, 'hello');
                        const stat = await fse.stat(filePath);
                        const info = await utils.getFileInfo(fse.createReadStream(filePath));
                        assert.equal(info.size, stat.size, 'check the size');
                        assert.equal(info.mime, 'text/plain', 'check the mime');
                        assert.equal(info.ext, 'txt', 'check the extension');
                        assert.equal(info.hash, await utils.getFileHash(filePath), 'check the hash');
                    });
                    it('should get info without hash', async () => {
                        const info = await utils.getFileInfo(fse.createReadStream(filePath), { hash: false });
                        assert.hasAllKeys(info, ['size', 'mime', 'ext']);
                    });
                    it('should get info without mime', async () => {
                        const info = await utils.getFileInfo(fse.createReadStream(filePath), { mime: false });
                        assert.hasAllKeys(info, ['size', 'hash']);
                    });
                    it('should get info without ext', async () => {
                        const info = await utils.getFileInfo(fse.createReadStream(filePath), { ext: false });
                        assert.hasAllKeys(info, ['size', 'hash', 'mime']);
                    });
                    it('should get info without size', async () => {
                        const info = await utils.getFileInfo(fse.createReadStream(filePath), { size: false });
                        assert.hasAllKeys(info, ['ext', 'hash', 'mime']);
                    });
                });
                describe('string path', () => {
                    let filePath;
                    before(() => {
                        filePath = path.join(tools.tmpPath, '1.txt');
                    });
                    it('should get all info', async () => {
                        const stat = await fse.stat(filePath);
                        const info = await utils.getFileInfo(filePath);
                        assert.equal(info.size, stat.size, 'check the size');
                        assert.equal(info.mime, 'text/plain', 'check the mime');
                        assert.equal(info.ext, 'txt', 'check the extension');
                        assert.equal(info.hash, await utils.getFileHash(filePath), 'check the hash');
                    });
                    it('should get info without hash', async () => {
                        const info = await utils.getFileInfo(filePath, { hash: false });
                        assert.hasAllKeys(info, ['size', 'mime', 'ext']);
                    });
                    it('should get info without mime', async () => {
                        const info = await utils.getFileInfo(filePath, { mime: false });
                        assert.hasAllKeys(info, ['size', 'hash']);
                    });
                    it('should get info without ext', async () => {
                        const info = await utils.getFileInfo(filePath, { ext: false });
                        assert.hasAllKeys(info, ['size', 'hash', 'mime']);
                    });
                    it('should get info without size', async () => {
                        const info = await utils.getFileInfo(filePath, { size: false });
                        assert.hasAllKeys(info, ['ext', 'hash', 'mime']);
                    });
                });
                describe('Buffer', () => {
                    it('should get all info', async () => {
                        const info = await utils.getFileInfo(buffer);
                        assert.equal(info.size, buffer.length, 'check the size');
                        assert.equal(info.mime, 'text/plain', 'check the mime');
                        assert.equal(info.ext, 'txt', 'check the extension');
                        assert.equal(info.hash, await utils.getFileHash(buffer), 'check the hash');
                    });
                    it('should get info without hash', async () => {
                        const info = await utils.getFileInfo(buffer, { hash: false });
                        assert.hasAllKeys(info, ['size', 'mime', 'ext']);
                    });
                    it('should get info without mime', async () => {
                        const info = await utils.getFileInfo(buffer, { mime: false });
                        assert.hasAllKeys(info, ['size', 'hash']);
                    });
                    it('should get info without ext', async () => {
                        const info = await utils.getFileInfo(buffer, { ext: false });
                        assert.hasAllKeys(info, ['size', 'hash', 'mime']);
                    });
                    it('should get info without size', async () => {
                        const info = await utils.getFileInfo(buffer, { size: false });
                        assert.hasAllKeys(info, ['ext', 'hash', 'mime']);
                    });
                });
            });
            describe('.getFileHash()', () => {
                let hash;
                before(() => {
                    hash = [];
                });
                it('should return for fse.ReadStream', async () => {
                    hash.push(await utils.getFileHash(fse.createReadStream(filePath)));
                    assert.isString(hash[0]);
                });
                it('should return for string', async () => {
                    hash.push(await utils.getFileHash(filePath));
                    assert.isString(hash[1]);
                });
                it('should return for buffer', async () => {
                    hash.push(await utils.getFileHash(buffer));
                    assert.isString(hash[2]);
                });
                it('should check all hashes are equal', async () => {
                    assert.equal(hash[0], hash[1]);
                    assert.equal(hash[1], hash[2]);
                });
            });
            describe('.getFileMimeType()', () => {
                it('should return for fse.ReadStream', async () => {
                    assert.equal('text/plain', await utils.getFileMimeType(fse.createReadStream(filePath)));
                });
                it('should return for string', async () => {
                    assert.equal('text/plain', await utils.getFileMimeType((filePath)));
                });
                it('should return for buffer', async () => {
                    assert.equal('text/plain', await utils.getFileMimeType(buffer));
                });
            });
        });
    });
}