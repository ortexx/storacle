import node from "../src/node.js";
import tools from "./tools.js";
import loki from "./db/loki.js";
import express from "./server/express.js";

const Node = node();

export default function () {
  describe('services', () => {
    before(async function () {
      this.node = new Node(await tools.createNodeOptions({ server: false }));
      await this.node.init();
    });

    after(async function () {
      await this.node.destroy();
    });

    describe('db', () => {
      describe('loki', loki.bind(this));

    });
    
    describe('server', () => {
      describe('express', express.bind(this));
    });
  });
}