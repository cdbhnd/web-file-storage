var express = require('express');
var FileStore = require('express-file-store');
var authorizationMiddleware = require('./authorization');
const url = require('url');
const resize = require('./resize')
const newResize = require('./resize-new')
const fs = require('fs');
const compress_images = require('compress-images');
const path = require('path');
const { on } = require('events');

// using file system
var fileStore = FileStore('fs', {
  path: path.join(__dirname, 'uploads')
});

var app = express();

app.use(authorizationMiddleware);

app.get('*', (req, res) => {
  const cleanUrl = decodeURIComponent(url.parse(req.url).pathname)
  const urlSplit = cleanUrl.split('/');
  if (req.query && req.query.resize) {
    const widthString = req.query.width
    const heightString = req.query.height
    const newResizeParam = req.query.newResize;
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
    if (newResizeParam) {
      return newResize(`${__dirname}/uploads${cleanUrl}`, width, height)
    } else {
      return resize(`${__dirname}/uploads${cleanUrl}`, format, width, height).pipe(res)
    }
  } else {
    /*  return fileStore.get(cleanUrl, function (err, file) {
       if (file) {
         res.sendFile(file.stream.path);
       } else {
         res.status(404).send('Not found');
       }
     }); */

    // Compress image if resize params where not sent
    if(!fs.existsSync(path.join(__dirname, 'uploads',...urlSplit))) {
      return res.status(404).send('Not found');
    }
    compress_images(`${__dirname}/uploads${cleanUrl}`, 'ready_for_sending/', { compress_force: false, statistic: true, autoupdate: true }, false,
      { jpg: { engine: "mozjpeg", command: ["-quality", "60"] } },
      { png: { engine: "pngquant", command: ["--quality=20-50", "-o"] } },
      { svg: { engine: "svgo", command: "--multipass" } },
      { gif: { engine: "gifsicle", command: ["--colors", "64", "--use-col=web"] } },
      function (error, completed, statistic) {
        if (completed) {
          const pathForTempFiles = path.join(__dirname, 'ready_for_sending');
          const imageName = urlSplit[(urlSplit.length-1)];
          const tempImgPath = path.join(pathForTempFiles, imageName);
          if(!fs.existsSync(tempImgPath)) {
            return res.status(500).send("Something went wrong");
          }
          const file = fs.createReadStream(tempImgPath);
          file.on('open', function () {
            file.pipe(res);
          });
          file.on('end', function () {
            fs.unlinkSync(tempImgPath);
          })
        }
        if (error) {
          console.log(error);
          return res.status(500).send('Something went wrong');
        }
      })

  }
});

app.use(fileStore.routes);

app.listen(4200);
