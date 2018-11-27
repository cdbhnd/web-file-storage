var fs = require('fs');
var express = require('express');
var FileStore = require('express-file-store');
var authorizationMiddleware = require('./authorization');
 
// using file system
var fileStore = FileStore('fs', {
  path: __dirname + '/uploads'
});

var app = express();

app.use(authorizationMiddleware);

app.use(fileStore.routes);

app.listen(4200);
