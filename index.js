var express = require('express');
var FileStore = require('express-file-store');
var authorizationMiddleware = require('./authorization');
const fileService = require("./file.service");
const url = require('url');
const resize = require('./resize')
const newResize = require('./resize-new');
const path = require('path');
const multer = require("multer");


// Set temp storage for middleware file upload
const fileMulterStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, path.join(__dirname, "temp"));
  },
  filename: function (req, file, callback) {
    const urlSplit = decodeURIComponent(url.parse(req.url).pathname).split("/");
    callback(null, urlSplit[(urlSplit.length - 1)]);
  }
})
const upload = multer({ storage: fileMulterStorage });

// Using file system
var fileStore = FileStore('fs', {
  path: path.join(__dirname, 'uploads')
});

var app = express();

app.use(authorizationMiddleware);
app.use(express.json());

app.put('/files/compress', async (req, res) => {
  // Check body for possible compress arguments
  const additionalPath = req.body && req.body.path ? req.body.path.split("/") : [""];
  const includeInnerDirectories = req.body && typeof req.body.includeInnerDirectories === "boolean" ? req.body.includeInnerDirectories : true;

  // Set folder paths to and from for compressing and call compress function
  const uploadsDir = path.join(__dirname, "uploads", ...additionalPath);
  const compressedDir = path.join(__dirname, "compressed", ...additionalPath);
  const compressedFiles = await fileService.compressAllFromDirectory(uploadsDir, compressedDir, includeInnerDirectories);
  console.log(`\n\nCompress finished with ${compressedFiles.length} files compressed!!\n\n`);

  // Move files back to their original path once they've been compressed
  const filesRenamed = await fileService.cutAndPasteAllFilesFromDirectory(compressedDir, uploadsDir, includeInnerDirectories);
  console.log(`\n\nCut and paste files from folder finished with ${filesRenamed} files replaced!!\n\n`);

  // Remove compress directory (no need for redundant directories)
  fileService.deleteDirectory(path.join(__dirname, "compressed"));

  return res.status(200).send({ compressedFiles: compressedFiles.map((file) => file["path"]) });
});

app.post('*', upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: "Please upload the file" });
  }
  console.log("Uploaded file details:\n", req.file);

  // Get upload destination from url
  const urlSplit = decodeURIComponent(url.parse(req.url).pathname).split('/');
  const destination = path.join(__dirname, "uploads", ...urlSplit.slice(1, (urlSplit.length - 1)));

  //Upload file if possible
  try {
    const filePath = await fileService.uploadFile(path.join(__dirname, "temp"), destination, req.file, ["uploads", ...urlSplit.slice(1, (urlSplit.length - 1))]);
    return res.status(200).send({ uploadedFilePath: filePath });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ message: `File not uploaded because: ${e}` });
  }

});

app.get('*', (req, res) => {
  const cleanUrl = decodeURIComponent(url.parse(req.url).pathname);
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
  }
  else {
    return fileStore.get(cleanUrl, function (err, file) {
      if (file) {
        res.set('Cache-control', 'public, max-age=31557600');
        return res.sendFile(file.stream.path);
      } else {
        return res.status(404).send('Not found');
      }
    });
  }
});

app.use(fileStore.routes);

app.listen(4200);
