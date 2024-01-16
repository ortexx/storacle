import express from "spreadable-ms/src/server/transports/express/index.js";
import routes from "./routes.js";
import routesClient from "./client/routes.js";
import routesApi from "./api/routes.js";
import routesApiMaster from "./api/master/routes.js";
import routesApiButler from "./api/butler/routes.js";
import routesApiSlave from "./api/slave/routes.js";
import routesApiNode from "./api/node/routes.js";

const ServerExpress = express();

export default (Parent) => {
    return class ServerExpressStoracle extends (Parent || ServerExpress) {
        /**
         * @see ServerExpress.prototype.getMainRoutes
         */
        getMainRoutes() {
            const arr = super.getMainRoutes();
            arr.splice(arr.findIndex(r => r.name == 'bodyParser'), 0, ...routes.slice());
            return arr;
        }
        /**
         * @see ServerExpress.prototype.getClientRoutes
         */
        getClientRoutes() {
            return super.getClientRoutes().concat(routesClient);
        }
        /**
         * @see ServerExpress.prototype.getApiRoutes
         */
        getApiRoutes() {
            return super.getApiRoutes().concat(routesApi);
        }
        /**
         * @see ServerExpress.prototype.getApiMasterRoutes
         */
        getApiMasterRoutes() {
            return super.getApiMasterRoutes().concat(routesApiMaster);
        }
        /**
        * @see ServerExpress.prototype.getApiButlerRoutes
        */
        getApiButlerRoutes() {
            return super.getApiButlerRoutes().concat(routesApiButler);
        }
        /**
         * @see ServerExpress.prototype.getApiSlaveRoutes
         */
        getApiSlaveRoutes() {
            return super.getApiSlaveRoutes().concat(routesApiSlave);
        }
        /**
         * @see ServerExpress.prototype.getApiNodeRoutes
         */
        getApiNodeRoutes() {
            return super.getApiNodeRoutes().concat(routesApiNode);
        }
    };
};
