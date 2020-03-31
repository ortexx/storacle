# [Storacle](https://github.com/ortexx/storacle/) [alpha] [![npm version](https://badge.fury.io/js/storacle.svg)](https://badge.fury.io/js/storacle)

Storacle is a decentralized file storage based on the [spreadable](https://github.com/ortexx/spreadable/) protocol.

```javascript
const Node = require('storacle').Node;

(async () => {  
  try {
    const node = new Node({
      port: 4000,
      hostname: 'localhost',
      initialNetworkAddress: 'localhost:4000'
    });
    await node.init();
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

```javascript
const Client = require('storacle').Client;

(async () => {  
  try {
    const client = new Client({
      address: 'localhost:4000'
    });
    await client.init();

    // Store our file
    const hash = await client.storeFile('./my-file');

    // Get the direct file link
    const link = await client.getFileLink(hash);

    // Create the requested file link
    const requestedLink = client.createRequestedFileLink(hash);
    
    // Remove the file
    await client.removeFile(hash);
  }
  catch(err) {
    console.error(err.stack);
    process.exit(1);
  }
})();
```

The example above shows the simplest use of the library. But the server can be flexibly configured.

## Browser client
You can also use the client in a browser. Look at the description of the [spreadable](https://github.com/ortexx/spreadable/) library. In window you  have __window.ClientStoracle__ instead of __window.ClientSpreadable__. The prepared file name is __storacle.client.js__.

## How it works

Nodes interact via the [spreadable](https://github.com/ortexx/spreadable/) mechanism. The file can be added to the network through any node. Files are saved entirely, not splitted into parts. After saving you get a hash of the file. With this hash you can later get it again, delete it or do something else. If possible, links to files are cached so if you work with the same file and in some other cases you will receive it immediately without re-traversing the network. For better reliability files can be duplicated. How exactly you can customize yourself. By default, each file tends to have its copies in amount of __Math.ceil(Math.sqrt(networkSize))__.

## What are the limitations

The number of files on one node is limited by the file system. The speed of receiving / saving in the network files is limited by spreadable protocol.

## Where to use it

### 1. Wherever files need to be stored decentralized
For example, you can create a network that stores books, invite new members, gather a large collection of books, and share links with others. Instead of books there could be anything else.

### 2. For own needs
Storing files of your own projects, websites, etc. The network can be made private and you will not need to figure out how to organize the file storage.

### 3. Serverless solutions
Since the library is written in javascript, you can receive / send / work with files in the browser and do not use server code at all. In some cases, it can be very convenient.

## Node configuration

When you create an instance of the node you can pass options below. Only specific options of this library are described here, without considering the options of the parent classes.

* {integer} __[request.clientStoringConcurrency=20]__ - the maximum number of simultaneous client storing requests per endpoint.

* {number|string} __[request.fileStoringNodeTimeout="2h"]__ - file storing timeout.

* {number|string} __[request.cacheTimeout=250]__ - file cache link check timeout.

* {number|string} __[storage.dataSize="45%"]__ - amount of space for storing files. If indicated in percent, the calculation will be based on the maximum available disk space.

* {number|string} __[storage.tempSize="45%"]__ - amount of space for temporary files. If indicated in percent, the calculation will be based on  the maximum available disk space.

* {number|string} __[storage.tempLifetime="2h"]__ - temporary files holding period.

* {integer} __[storage.autoCleanSize=0]__ - amount of space that should always be free. If indicated in percent, the calculation will be based on storage.dataSize. 

* {object} __[file]__ - section that responds for a single file settings.

* {number|string} __[file.maxSize="40%"]__ - maximum size of one file. If indicated in percent, the calculation will be based on the maximum available disk space. 

* {integer|string} __[file.preferredDublicates="auto"]__ - preferred number of file copies on the network. If indicated in percent, the calculation will be based on the network size. If the option is "auto" it will be calculated as `Math.ceil(Math.sqrt(networkSize))`.

* {number|string} __[file.responseCacheLifetime="7d"]__ - period of file caching after giving it to the client.

* {string[]} __[file.mimeWhitelist=[]]__ - whitelist for filtering a file by mime type.

* {string[]} __[file.mimeBlacklist=[]]__ - blacklist for filtering a file by mime type.

* {string[]} __[file.extWhitelist=[]]__ - whitelist for filtering a file by its extension.

* {string[]} __[file.extBlacklist=[]]__ - blacklist for filtering a file by its extension.

* {object|false} __[file.linkCache]__ - file link caching transport options.

* {integer} __[file.linkCache.limit=50000]__ - maximum cache links.

* {number|string} __[file.linkCache.lifetime="1d"]__ - cache link holding period.

* {number|string} __[task.cleanUpStorageInterval="30s"]__ - storage cleanup task interval.

* {number|string} __[task.cleanUpTempDirInterval="20s"]__ - temporary folder cleanup task interval.

* {number|string} __[task.calculateStorageInfoInterval="3s"]__ - storage information calculaion task interval.

## Client configuration

When you create an instance of the client you can pass options below. Only specific options of this library are described here, without considering the options of the parent classes.

* {number|string} __[request.fileStoringTimeout="2.05h"]__ - file storing timeout.

* {number|string} __[request.fileGettingTimeout="1h"]__ - file getting timeout.

* {number|string} __[request.fileRemovalTimeout="10s"]__ - file removal timeout.

* {number|string} __[request.fileLinkGettingTimeout="10s"]__ - file link getting timeout.

## Client interface

async __Client.prototype.storeFile()__ - add file to the network.
  * {string|fs.ReadStream|Buffer|Blob} __file__ - any file
  * {object} __[options]__ - storing options
  * {number} __[options.timeout]__ - storing timeout

async __Client.prototype.getFileLink()__ - get the file link by the hash.
  * {string} __hash__ - file hash
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getFileLinks()__ - get all file links by the hash.
  * {string} __hash__ - file hash
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout  

async __Client.prototype.getFileToBuffer()__ - download the file and return the buffer.
  * {string} __hash__ - file hash
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getFileToPath()__ - download the file and write it to the specified path.
  * {string} __hash__ - file hash
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.getFileToBlob()__ - download the file and return the blob. For browser client only.
  * {string} __hash__ - file hash
  * {object} __[options]__ - getting options
  * {number} __[options.timeout]__ - getting timeout

async __Client.prototype.removeFile()__ - Remove the file by hash.
  * {string} __hash__ - file hash
  * {object} __[options]__ - removal options
  * {number} __[options.timeout]__ - removal timeout

__Client.prototype.createRequestedFileLink()__ - сreate a requested file link. This is convenient if you need to get the link without doing any asynchronous operations at the moment. 
  * {string} __hash__ - file hash
  * {object} __[options]__ - options

## Contribution

If you face a bug or have an idea how to improve the library, create an issue on github. In order to fix something or add new code yourself fork the library, make changes and create a pull request to the master branch. Don't forget about tests in this case. Also you can join [the project on github](https://github.com/ortexx/storacle/projects/1).