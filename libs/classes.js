import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { createGzip } from 'zlib';
import temp from 'temp';
import consola from 'consola';
import { minify } from 'minify';
class HWBuilder {
    constructor() {
        temp.track();
    }
    async buildFileStructure(dirPath, exclude = [], doMinify) {
        const structure = {};
        const supportedExtensions = ['.js', '.css', '.html', '.htm', '.json'];
        const items = glob.sync(`${dirPath}/**/*`, { nodir: false });
        console.log(`Znaleziono pliki: ${items.length}`);
        for (const fullPath of items) {
            let relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/');
            const stats = fs.statSync(fullPath);
            if (!exclude.includes(relativePath) && stats.isFile()) {
                const ext = path.extname(fullPath).toLowerCase();
                const fileContent = fs.readFileSync(fullPath, 'utf-8');
                console.log(`Dodawanie pliku: ${relativePath}`);
                if (supportedExtensions.includes(ext) && doMinify) {
                    try {
                        const minifiedContent = await minify(fullPath);
                        structure[relativePath] = {
                            content: minifiedContent,
                        };
                    }
                    catch (error) {
                        console.error(`Błąd podczas minifikacji pliku ${fullPath}:`, error);
                    }
                }
                else {
                    structure[relativePath] = {
                        content: fileContent,
                    };
                }
            }
        }
        console.log(`Struktura wygenerowana: ${JSON.stringify(structure, null, 2)}`);
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
    async createHWFile(projectDir, outputFilePath, excludeFolders = [], gzip, debug, doMinify) {
        if (debug)
            consola.debug('Creating filemap...');
        const srcDir = path.join(projectDir, 'src');
        const fileStructure = {
            "$filetype": "hostweb.pack",
            "#": {}
        };
        const result = await this.buildFileStructure(srcDir, excludeFolders, doMinify);
        const assetsDir = path.join(srcDir, '.assets');
        if (fs.existsSync(assetsDir)) {
            if (debug)
                consola.debug('Adding assets...');
            fileStructure["assets"] = await this.buildFileStructure(assetsDir, excludeFolders, doMinify);
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
