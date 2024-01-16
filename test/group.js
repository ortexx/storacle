import { assert } from "chai";
import node from "../src/node.js";
import client from "../src/client.js";
import utils from "../src/utils.js";
import tools from "./tools.js";

const Node = node();
const Client = client();

export default function () {
    describe('group communication', () => {
        let nodes;
        let client;
        let buffer;
        let duplicates;
        let fileStoringNodeTimeout;
        before(async () => {
            nodes = [];
            fileStoringNodeTimeout = 800;
            for (let i = 0; i < 4; i++) {
                const node = new Node(await tools.createNodeOptions({ request: { fileStoringNodeTimeout } }));
                await node.init();
                nodes.push(node);
                node.initialNetworkAddress = nodes[0].address;
            }
            client = new Client(await tools.createClientOptions({ address: nodes[0].address }));
            await client.init();
            await tools.nodesSync(nodes, nodes.length * 3);
            buffer = Buffer.from('hello');
            duplicates = await nodes[0].getFileDuplicatesCount();
        });
        after(async () => {
            for (let i = 0; i < nodes.length; i++) {
                await nodes[i].deinit();
            }
        });
        it('should get the right network size', async () => {
            for (let i = 0; i < nodes.length; i++) {
                assert.equal(await nodes[i].getNetworkSize(), nodes.length);
            }
        });
        it('should store the file', async () => {
            const hash = await client.storeFile(buffer);
            await tools.wait(fileStoringNodeTimeout);
            let count = 0;
            for (let i = 0; i < nodes.length; i++) {
                (await nodes[i].hasFile(hash)) && count++;
            }
            assert.equal(count, duplicates);
        });
        it('should not store the existent files again', async () => {
            const hash = await client.storeFile(buffer);
            await tools.wait(fileStoringNodeTimeout);
            let count = 0;
            for (let i = 0; i < nodes.length; i++) {
                (await nodes[i].hasFile(hash)) && count++;
            }
            assert.equal(count, duplicates);
        });
        it('should store the necessary count of duplicates', async () => {
            const hash = await utils.getFileHash(buffer);
            for (let i = 0; i < nodes.length; i++) {
                if (await nodes[i].hasFile(hash)) {
                    await nodes[i].removeFileFromStorage(hash);
                    break;
                }
            }
            await client.storeFile(buffer);
            await tools.wait(fileStoringNodeTimeout);
            let count = 0;
            for (let i = 0; i < nodes.length; i++) {
                (await nodes[i].hasFile(hash)) && count++;
            }
            assert.equal(count, duplicates);
        });
        it('should return the right links', async () => {
            const hash = await utils.getFileHash(buffer);
            const links = await client.getFileLinks(hash);
            assert.equal(links.length, duplicates);
        });
        it('should remove the file', async () => {
            const hash = await utils.getFileHash(buffer);
            await client.removeFile(hash);
            let count = 0;
            for (let i = 0; i < nodes.length; i++) {
                (await nodes[i].hasFile(hash)) && count++;
            }
            assert.equal(count, 0);
        });
        it('should store files in parallel', async () => {
            const length = 10;
            const p = [];
            let count = 0;
            for (let i = 0; i < length; i++) {
                p.push(client.storeFile(Buffer.from(i + '')));
            }
            await Promise.all(p);
            await tools.wait(fileStoringNodeTimeout * 2);
            for (let i = 0; i < nodes.length; i++) {
                count += await nodes[i].db.getData('filesCount');
            }
            assert.isOk(count >= length * duplicates);
        });
        it('should get the network files count', async () => {
            let count = 0;
            let res = await client.getNetworkFilesCount();
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                count += await node.db.getData('filesCount');
            }
            assert.equal(count, res);
        });
    });
}