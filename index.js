var express = require('express');
var FileStore = require('express-file-store');
var authorizationMiddleware = require('./authorization');
const url = require('url');
const resize = require('./resize')
const newResize = require('./resize-new')
const fs = require('fs');
const fsPromises = require('fs').promises;
const compress_images = require('compress-images');
const { compress } = require('compress-images/promise');
const path = require('path');

// using file system
var fileStore = FileStore('fs', {
  path: path.join(__dirname, 'uploads')
});

var app = express();

app.use(authorizationMiddleware);

app.put('/compress-all', async (req, res) => {

  const processImages = async (input, savePath) => {
    const result = await compress({
      source: input,
      destination: './compressed/',
      enginesSetup: {
        jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
        png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
        svg: { engine: "svgo", command: "--multipass" },
        gif: { engine: "gifsicle", command: ["--colors", "64", "--use-col=web"] },
      },
      params: { compress_force: true, statistic: true, autoupdate: true },

    })
    const { statistics, errors } = result;
    if (errors.length) {
      console.log(errors);
      return false;
    }
    return true;
  }

  const loopThroughFolder = async (files, currentPath) => {
    for (let f = 0; f < files.length; f++) {
      if (fs.lstatSync(path.join(currentPath, files[f])).isFile()) {
        const comp = await processImages(`${currentPath}/${files[f]}`, `${currentPath}/`);
        if (!comp) {
          console.log(path.join(currentPath, files[f]) + " not compressed")
          continue;
        }
        try {
          await fsPromises.rename(path.join(__dirname, 'compressed', files[f]), path.join(currentPath, files[f]));
          console.log(`File ${path.join(currentPath, files[f])} compressed and saved`);
        } catch (err) {
          console.log(`File ${path.join(currentPath, files[f])} compressed but not saved because ${err}`);
        }

      }
      if (fs.lstatSync(path.join(currentPath, files[f])).isDirectory()) {
        fs.readdir(path.join(currentPath, files[f]), async (err, innerFiles) => {
          if (err) {
            console.log("Couldn't open folder on path " + path.join(currentPath, files[f]) + " becuase of the error " + err);
            return;
          }
          await loopThroughFolder(innerFiles, path.join(currentPath, files[f]));
        })
      }
    }
  };

  fs.readdir(path.join(__dirname, 'uploads'), async (err, uploadFiles) => {
    if (err) {
      return res.status(500).send('Something went wrong');
    }
    await loopThroughFolder(uploadFiles, path.join(__dirname, 'uploads'));
    return res.status(200).send('OK');
  });

});

app.post('*', (req, res) => {
  const contentType = req.headers['content-type'];
  if (!contentType || (contentType !== 'image/jpeg' && contentType !== 'image/jpg' && contentType !== 'image/png')) {
    return res.status(400).send('Only jpg, jpeg and png files are allowed');
  }
  const cleanUrl = decodeURIComponent(url.parse(req.url).pathname)
  const urlSplit = cleanUrl.split('/');
  const imagePath = urlSplit.slice(0, urlSplit.length - 1).join('/');
  let writeStream = fs.createWriteStream(`./${urlSplit[(urlSplit.length - 1)]}`);
  req.pipe(writeStream);
  req.on('end', () => {
    compress_images(`./${urlSplit[(urlSplit.length - 1)]}`, `${__dirname}/uploads${imagePath}/`, { compress_force: false, statistic: true, autoupdate: true }, false,
      { jpg: { engine: "mozjpeg", command: ["-quality", "60"] } },
      { png: { engine: "pngquant", command: ["--quality=20-50", "-o"] } },
      { svg: { engine: "svgo", command: "--multipass" } },
      { gif: { engine: "gifsicle", command: ["--colors", "64", "--use-col=web"] } },
      function (error, completed, statistic) {
        if (completed) {
          console.log("uploaded");
          fs.unlinkSync(`./${urlSplit[(urlSplit.length - 1)]}`);
          return res.status(200).send('Image uploaded successfully');
        }
        if (error) {
          console.log(error);
          return res.status(500).send('Something went wrong');
        }
      });
  });
});

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
    return fileStore.get(cleanUrl, function (err, file) {
      if (file) {
        return res.sendFile(file.stream.path);
      } else {
        return res.status(404).send('Not found');
      }
    });

    // Compress image if resize params where not sent
    /* if(!fs.existsSync(path.join(__dirname, 'uploads',...urlSplit))) {
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
      }) */

  }
});

app.use(fileStore.routes);

app.listen(4200);
