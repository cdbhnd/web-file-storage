const imagemin = require("imagemin");
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const fs = require("fs");
const fsPromise = require("fs").promises;
const path = require("path");

const uploadFile = async (fromDirectory, toDirectory, file, filePathsToCreate) => {
    if (!fs.existsSync(toDirectory) || !fs.lstatSync().isDirectory()) {
        let currentDir = __dirname;
        for (let d = 0; d < filePathsToCreate.length; d++) {
            currentDir = path.join(currentDir, `${filePathsToCreate[d]}`);
            if (!fs.existsSync(currentDir) || !fs.lstatSync(currentDir).isDirectory()) {
                fs.mkdirSync(currentDir, { recursive: true })
            }
        }
    }
    if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
        const files = await compressImages(fromDirectory, toDirectory, file.filename);
        fs.unlinkSync(path.join(fromDirectory, file.filename));
        return files[0]["path"];
    }
    fs.renameSync(path.join(fromDirectory, file.filename), path.join(toDirectory, file.filename));
    return path.join(toDirectory, file.filename);
}

const compressImages = async (fromDirectory, toDirectory, singleFileName) => {
    const whatToCompress = !!singleFileName ? singleFileName : "*.{jpg,png,jpeg}";
    return await imagemin([`${fromDirectory}/${whatToCompress}`], toDirectory, {
        plugins: [
            imageminJpegtran(),
            imageminPngquant({
                quality: [0.6, 0.8]
            })
        ]
    })
}

const compressAllFromDirectory = async (fromDirectory, toDirectory, includeInnerDirectories) => {
    let files = [];
    try {
        files = fs.readdirSync(fromDirectory);
    } catch (e) {
        console.log(`\n\nCouldn't read from directory ${fromDirectory} because:\n`, e);
    }
    let cf = [];
    try {
        cf = cf.concat(await compressImages(fromDirectory, toDirectory));
        console.log(`\n\nCompressed from ${fromDirectory} following files:\n`, cf.map(c => c["path"]));
    } catch (e) {
        console.log(`\n\nError occured while compressing images from ${fromDirectory}, error:\n`, e);
    }
    if (includeInnerDirectories) {
        for (let i = 0; i < files.length; i++) {
            const folder = files[i];
            if (fs.lstatSync(path.join(fromDirectory, folder)).isDirectory()) {
                cf = cf.concat(await compressAllFromDirectory(path.join(fromDirectory, folder), path.join(toDirectory, folder), true));
            }
        }
    }
    return cf;
}

const cutAndPasteAllFilesFromDirectory = async (dirPath, newDirPath, includeInnerDirectories) => {
    let files = [];
    try {
        files = fs.readdirSync(dirPath);
    } catch (e) {
        console.log(`\n\nCouldn't read from directory ${dirPath} because:\n`, e);
    }
    let filesNo = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (fs.lstatSync(path.join(dirPath, file)).isDirectory() && includeInnerDirectories) {
            filesNo += (await cutAndPasteAllFilesFromDirectory(path.join(dirPath, file), path.join(newDirPath, file), true));
        }
        if (fs.lstatSync(path.join(dirPath, file)).isFile()) {
            try {
                console.log(`\n\nRenaming file -> ${path.join(dirPath, file)}`);
                await fsPromise.rename(path.join(dirPath, file), path.join(newDirPath, file));
                filesNo++;
                console.log(`\nReplaced compressed file ${path.join(dirPath, file)} to main uploads folder => ${path.join(newDirPath, file)}`);
            } catch (err) {
                console.log(`\nError occured while replacing original file ${path.join(dirPath, file)} to main uploads folder => ${path.join(newDirPath, file)} with the error:`, err);
            }
        }
    }
    return filesNo;
}

const deleteDirectory = (dirPath) => {
    let files = [];
    try {
        files = fs.readdirSync(dirPath);
    } catch (e) {
        console.log(`\n\nCouldn't read from directory ${dirPath} because:\n`, e);
    }
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (fs.lstatSync(path.join(dirPath, file)).isFile()) {
            try {
                fs.unlinkSync(path.join(dirPath, file));
                console.log(`\n\nDeleted file -> ${path.join(dirPath, file)}`);
                continue;
            } catch (e) {
                console.log(`\n\nError while Deleting the file -> ${path.join(dirPath, file)}`);
            }
        }
        if (fs.lstatSync(path.join(dirPath, file)).isDirectory()) {
            deleteDirectory(path.join(dirPath, file));
        }
    }
    try {
        fs.rmdirSync(dirPath, { recursive: true, force: true });
        console.log(`\n\nDeleted directory -> ${dirPath}`);
    } catch (e) {
        console.log(`\n\nError while Deleting directory -> ${dirPath}`);
    }
}

module.exports = {
    uploadFile,
    compressImages,
    compressAllFromDirectory,
    cutAndPasteAllFilesFromDirectory,
    deleteDirectory
};