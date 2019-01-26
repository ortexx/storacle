# [Storacle](https://github.com/ortexx/storacle/) [alpha]

Storacle is a simple decentralized distributed file storage based on [spreadable](https://github.com/ortexx/spreadable/) protocol.

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

    // Get the file link
    const link = await client.getFileLink(hash);
    console.log(link);
    
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

## How it works
Servers used to store files interact via [spreadable](https://github.com/ortexx/spreadable/) mechanism. The file can be added to the network through any node. Files are saved entirely, not splitted into parts. After saving you get a hash of the file. With this hash, you can later get it again, delete it, or do something else. If possible, links to files are cached, so if you work with the same file and in some other cases, you will receive it immediately, without re-traversing the network. For better reliability, files can be duplicated. How exactly you can customize yourself. By default, each file tends to have its copies in size __Math.ceil(Math.sqrt(networkSize))__.

## What are the limitations

The number of files on one node is limited by the file system. The speed of receiving / saving in the network files is limited by spreadable protocol.

## Where to use it

### 1. Wherever files need to be stored decentralized

For example, you can create a network that stores books, invite new members, gather a large collection of books together, and share links with others. Instead of books, there could be anything else.

### 2. For own needs

Storing files of your own projects, websites, etc. The network can be made private and you will not need to figure out how to organize file storage.