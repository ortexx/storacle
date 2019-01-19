const midds = require('./midds');

module.exports = [
  { 
    name: 'file', 
    mehtod: 'get', 
    url: '/file/:hash', 
    fn: node => ([
      midds.networkAccess(node),
      midds.file(node) 
    ])
  }
];