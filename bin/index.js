#!/usr/bin/env node
import * as runner from "./runner.js";
import { Node as Node$0 } from "../src/index.js";
import actions from "./actions.js";
const Node = { Node: Node$0 }.Node;
runner('storacle', Node, actions);
