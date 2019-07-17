const Node = require('../src/node')();
const tools = require('./tools');

describe('services', () => {
  before(async function () {
    this.node = new Node(await tools.createNodeOptions({ server: false }));
    await this.node.init();
  });  

  after(async function () {
    await this.node.destroy();
  });  
  
  describe('db', () => {
    require('./db/loki');    
  });

  describe('server', () => {
    require('./server/express');    
  });
});