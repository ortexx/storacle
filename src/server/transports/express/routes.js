import midds from "./midds.js";

export default [
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
