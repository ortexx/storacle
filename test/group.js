const assert = require('chai').assert;
const Node = require('../src/node')();
const Client = require('../src/client')();
const utils = require('../src/utils');
const tools = require('./tools');

describe('group communication', () => {
  let nodes;
  let client;
  let buffer;
  let dublicates;
  let fileStoreTimeout;

  before(async () => {
    nodes = [];
    fileStoreTimeout = 800;

    for(let i = 0; i < 4; i++) {
      const node = new Node(await tools.createNodeOptions({ request: { fileStoreTimeout } }));
      await node.init();
      nodes.push(node);
      node.initialNetworkAddress = nodes[0].address;
    }
    
    client = new Client(await tools.createClientOptions({ address: nodes[0].address }));
    await client.init();
    await tools.nodesSync(nodes, nodes.length * 2); 
    buffer = Buffer.from('hello');
    dublicates = await nodes[0].getFileDuplicatesCount();
  });

  after(async () => {
    for(let i = 0; i < nodes.length; i++) {
      await nodes[i].deinit();
    }
  });

  it('should get the right network size', async () => {
    for(let i = 0; i < nodes.length; i++) {
      assert.equal(await nodes[i].getNetworkSize(), nodes.length);
    }
  });

  it('should store the file', async () => {
    const hash = await client.storeFile(buffer);       
    await tools.wait(fileStoreTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      (await nodes[i].hasFile(hash)) && count++;
    }
    
    assert.equal(count, dublicates);
  });

  it('should not store the existent files again', async () => {
    const hash = await client.storeFile(buffer);    
    await tools.wait(fileStoreTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      (await nodes[i].hasFile(hash)) && count++;
    }

    assert.equal(count, dublicates);
  });

  it('should store the necessary count of dublicates', async () => {
    const hash = await utils.getFileHash(buffer);

    for(let i = 0; i < nodes.length; i++) {
      if(await nodes[i].hasFile(hash)) {
        await nodes[i].removeFileFromStorage(hash);
        break;
      }
    }

    await client.storeFile(buffer);
    await tools.wait(fileStoreTimeout);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      (await nodes[i].hasFile(hash)) && count++;
    }

    assert.equal(count, dublicates);
  });

  it('should return the right links', async () => {
    const hash = await utils.getFileHash(buffer);
    const links = await client.getFileLinks(hash);
    assert.equal(links.length, dublicates);
  });

  it('should remove the file', async () => {
    const hash = await utils.getFileHash(buffer);
    await client.removeFile(hash);
    let count = 0;

    for(let i = 0; i < nodes.length; i++) {
      (await nodes[i].hasFile(hash)) && count++;
    }

    assert.equal(count, 0);
  });

  it('should store files in parallel', async () => {
    const length = 10;  
    const p = [];
    let count = 0;

    for(let i = 0; i < length; i++) {
      p.push(client.storeFile(Buffer.from(i + '')));
    }

    await Promise.all(p);
    await tools.wait(fileStoreTimeout);

    for(let i = 0; i < nodes.length; i++) {
      count += await nodes[i].db.getData('filesCount');
    }

    assert.isOk(count >= length * dublicates);
  });
});