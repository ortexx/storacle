import { assert } from "chai";
import tools from "../tools.js";
import loki from "../../src/db/transports/loki/index.js";
import fse from "fs-extra";

const DatabaseLokiStoracle = loki();

export default function () {
  describe('DatabaseLokiStoracle', () => {
    let loki;
    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => loki = new DatabaseLokiStoracle({
          filename: tools.getDbFilePath(this.node)
        }));
        loki.node = this.node;
      });
    });
    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await loki.init();
      });
      it('should create the db file', async function () {
        assert.isTrue(await fse.pathExists(tools.getDbFilePath(this.node)));
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
        assert.isFalse(await fse.pathExists(tools.getDbFilePath(this.node)));
      });
    });
  });
}