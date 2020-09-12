const fs = require('fs')
const sharp = require('sharp')

module.exports = function newResize(path, width, height) {
  const image = sharp(path);
  return image
    .metadata()
    .then(function (metadata) {
      if (metadata.width < width) {
        return image;
      }
      return image
        .resize(Math.round(width))
        .webp()
        .toBuffer();
    });
}