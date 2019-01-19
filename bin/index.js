#!/usr/bin/env node

const runner = require('spreadable/bin/runner');
const Node = require('../src').Node;
const actions = Object.assign({}, require('spreadable/bin/actions'), require('./actions'));
runner('storacle', Node, actions);