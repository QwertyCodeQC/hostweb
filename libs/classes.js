import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { createGzip } from 'zlib';
import temp from 'temp';
import consola from 'consola';
class HWBuilder {
    constructor() {
        temp.track();
    }
    buildFileStructure(dirPath, exclude = []) {
        const structure = {};
        const pattern = `${dirPath}/**/*`;
        const items = glob.sync(pattern, { nodir: false });
        items.forEach((fullPath) => {
            let relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/');
            const stats = fs.statSync(fullPath);
            if (!exclude.includes(relativePath) && stats.isFile()) {
                structure[relativePath] = {
                    content: fs.readFileSync(fullPath, 'utf-8')
                };
            }
        });
        return structure;
    }
    compressFile(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(inputPath);
            const output = fs.createWriteStream(outputPath);
            const gzip = createGzip();
            input.pipe(gzip).pipe(output).on('finish', resolve).on('error', reject);
        });
    }
    async createHWFile(projectDir, outputFilePath, excludeFolders = [], gzip, debug) {
        if (debug)
            consola.debug('Creating filemap...');
        const srcDir = path.join(projectDir, 'src');
        const fileStructure = {
            "$filetype": "hostweb.pack",
            "#": {}
        };
        const result = this.buildFileStructure(srcDir, excludeFolders);
        const assetsDir = path.join(srcDir, '.assets');
        if (fs.existsSync(assetsDir)) {
            if (debug)
                consola.debug('Adding assets...');
            fileStructure["assets"] = this.buildFileStructure(assetsDir, excludeFolders);
        }
        fileStructure["#"] = result;
        const hwContent = JSON.stringify(fileStructure, null, 2);
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            if (debug)
                consola.debug('Creating output directory...');
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }
        if (gzip) {
            const tempFilePath = temp.path({ suffix: '.hw' });
            fs.writeFileSync(tempFilePath, hwContent);
            if (debug)
                consola.debug('Compressing file...');
            const gzippedOutputPath = outputFilePath;
            await this.compressFile(tempFilePath, gzippedOutputPath);
        }
        else {
            if (debug)
                consola.debug('Saving...');
            fs.writeFileSync(outputFilePath, hwContent);
        }
    }
}
export { HWBuilder };
