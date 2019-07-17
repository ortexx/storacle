const _ = require('lodash');
const utils = require('./utils');
const _schema = require('spreadable/src/schema');
const schema = Object.assign({}, _schema);

schema.getStatusResponse = function () {
  return _.merge(_schema.getStatusResponse(), {
    props: {
      total: 'number',
      available: 'number',
      allowed: 'number',
      used: 'number',
      free: 'number',
      clean: 'number',
      tempAllowed: 'number',
      tempUsed: 'number',
      tempFree: 'number',
      fileMaxSize: 'number',
      filesCount: 'number'
    }
  })
};

schema.getStatusPrettyResponse = function () {
  return _.merge(this.getStatusResponse(), _schema.getStatusPrettyResponse(), {
    props: {
      total: 'string',
      available: 'string',
      allowed: 'string',
      used: 'string',
      free: 'string',
      clean: 'string',
      tempAllowed: 'string',
      tempUsed: 'string',
      tempFree: 'string',
      fileMaxSize: 'string',
    }    
  });
};

schema.getFileLink = function () {
  return {
    type: 'string',
    value: val => val == '' || utils.isValidFileLink(val)
  };
};

schema.getFileStoreResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      hash: 'string',
      link: this.getFileLink()
    },
    strict: true
  }
};

schema.getFileStoreCandidateSlaveResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      free: 'number',
      isAvailable: 'boolean',
      isExistent: 'boolean'
    },
    strict: true
  }
};

schema.getFileStoreCandidateMasterResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      candidates: {
        type: 'array',
        items: this.getFileStoreCandidateSlaveResponse()
      },
      existing: 'number'
    },
    strict: true
  }
};

schema.getFileLinksSlaveResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      link: this.getFileLink()
    },
    strict: true
  }
};

schema.getFileLinksMasterResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      links: {
        type: 'array',
        items: this.getFileLinksSlaveResponse()
      }
    },
    strict: true
  }
};

schema.removeFileMasterResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      removed: 'number'
    },
    strict: true
  }
};

schema.removeFileSlaveResponse = function () {
  return {
    type: 'object',
    props: {
      address: this.getAddress(),
      removed: 'boolean'
    },
    strict: true
  }
};

module.exports = schema;