const midds = require('./midds');

module.exports = [
  {
    name: 'file',
    method: 'get',
    url: '/file/:hash',
    fn: node => ([
      midds.networkAccess(node),
      midds.file(node)
    ])
  }
];
