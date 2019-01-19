const ServerExpress = require('spreadable/src/server/transports/express')();
const routes = require('spreadable/src/server/transports/express/routes');
const routesClient = require('spreadable/src/server/transports/express/client/routes');
const routesApi = require('spreadable/src/server/transports/express/api/routes');
const routesApiMaster = require('spreadable/src/server/transports/express/api/master/routes');
const routesApiSlave = require('spreadable/src/server/transports/express/api/slave/routes');

module.exports = (Parent) => {
  return class ServerExpressStoracle extends (Parent || ServerExpress) {
    getMainRouter() {
      const arr = routes.slice();
      arr.splice(routes.findIndex(r => r.name == 'ping'), 0, ...require('./routes'));
      return this.createRouter(arr);
    }
  
    getClientRouter() {
      return this.createRouter(routesClient.concat(require('./client/routes')));
    }
  
    getApiRouter() {
      return this.createRouter(routesApi.concat(require('./api/routes')));
    }
  
    getApiMasterRouter() {
      return this.createRouter(routesApiMaster.concat(require('./api/master/routes')));
    }
  
    getApiSlaveRouter() {
      return this.createRouter(routesApiSlave.concat(require('./api/slave/routes')));
    }
  }
};