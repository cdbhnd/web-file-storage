var express = require('express');
var FileStore = require('express-file-store');
var authorizationMiddleware = require('./authorization');
const url = require('url');
const resize = require('./resize')
const newResize = require('./resize-new')

// using file system
var fileStore = FileStore('fs', {
  path: __dirname + '/uploads'
});

var app = express();

app.use(authorizationMiddleware);

app.get('*', (req, res) => {
  const cleanUrl = decodeURIComponent(url.parse(req.url).pathname);
  if (req.query && req.query.resize) {
    const widthString = req.query.width
    const heightString = req.query.height
    const newResize = req.query.newResize;
    let format = req.query.format

    // Parse to integer if possible
    let width, height
    if (widthString) {
      width = parseInt(widthString)
    }
    if (heightString) {
      height = parseInt(heightString)
    }
    // Set the content-type of the response
    if (!format) {
      format = cleanUrl.indexOf('jpg') !== -1 ? 'jpg' : 'png';
    }
    res.type(`image/${format}`)

    // Get the resized image
    if (newResize) {
      return newResize(`${__dirname}/uploads${cleanUrl}`, width, height).pipe(res)
    } else {
      return resize(`${__dirname}/uploads${cleanUrl}`, format, width, height).pipe(res)
    }
  } else {
    return fileStore.get(cleanUrl, function (err, file) {
      if (file) {
        res.sendFile(file.stream.path);
      } else {
        res.status(404).send('Not found');
      }
    });
  }
});

app.use(fileStore.routes);

app.listen(4200);
