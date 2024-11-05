import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { createGzip } from 'zlib'; // Zlib do kompresji
import temp from 'temp'; // Zależność do obsługi plików tymczasowych
import consola from 'consola';
import { minify } from 'minify';
import { ESLint } from 'eslint';
import { dirname, filename } from 'dirname-filename-esm';
import { compileFile, convertMD } from '#functions';
import showdown from 'showdown';
const __dirname = dirname(import.meta);
class HWBuilder {
    constructor() {
        temp.track(); // Ustawienie, aby automatycznie śledzić pliki tymczasowe
    }

    // Funkcja przeszukująca wszystkie pliki, wykluczając ręcznie pliki na podstawie `exclude`
    async buildFileStructure(dirPath: string, exclude: string[] = [], doMinify: boolean, debug: boolean, parsemd: boolean): Promise<any> {
        const structure: any = {};
        const supportedExtensionsForMinify = ['.js', '.css', '.html', '.htm', '.json'];  // Obsługiwane rozszerzenia dla minifikacji
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mp3', '.wav', '.webm'];  // Obsługiwane rozszerzenia binarne
        const items = glob.sync(`${dirPath}/**/*`, { nodir: false });
    
        for (const fullPath of items) {
            const relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/'); // Zamiana na ukośniki
            const stats = fs.statSync(fullPath);
    
            // Sprawdź, czy plik/katalog nie znajduje się w liście wykluczeń
            if (!exclude.includes(relativePath) && stats.isFile()) {
                const ext = path.extname(fullPath).toLowerCase();
                // Logowanie ścieżek plików
                if (debug) consola.debug("Adding file " + relativePath + " to structure...");
    
                if (supportedExtensionsForMinify.includes(ext) && doMinify) {
                    // Minifikujemy pliki, jeśli mają odpowiednie rozszerzenie
                    try {
                        const minifiedContent = await minify(fullPath);
                        structure[relativePath] = {
                            content: minifiedContent,
                        };
                    } catch (error) {
                        consola.error(error);
                    }
                } else if (binaryExtensions.includes(ext)) {
                    // Odczytujemy pliki binarne jako Buffer
                    const fileContent = fs.readFileSync(fullPath);
                    structure[relativePath] = {
                        content: fileContent.toString('base64'),  // Kodowanie binarnych danych w Base64
                        encoding: 'base64'
                    };
                } else {
                    // Zapisujemy zawartość pliku tekstowego bez minifikacji
                    const fileContent = fs.readFileSync(fullPath, 'utf-8');
                    structure[relativePath] = {
                        content: fileContent,
                    };
                }
            }
        }
        return structure;
    }

    // Funkcja do kompresji Gzip
    compressFile(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(inputPath);
            const output = fs.createWriteStream(outputPath);
            const gzip = createGzip();

            input.pipe(gzip).pipe(output).on('finish', resolve).on('error', reject);
        });
    }

    async createHWFile(projectDir: string, outputFilePath: string, excludeFolders: string[] = [], gzip: boolean, debug: boolean, doMinify: boolean, useHWAPI: boolean, parsemd: boolean): Promise<void> {
        excludeFolders.push('_hwapi.js');
        if (debug) consola.debug('Creating filemap...');
        const srcDir = path.join(projectDir, 'src');  // Skupiamy się na katalogu 'src'
        const fileStructure: any = {
            "$filetype": "hostweb.pack",
            "$usehwapi": useHWAPI,
            "$parsemd": parsemd,
            "hwapi": "",
            "#": {} // dynamiczne foldery i pliki z 'src'
        };

        // Przeszukiwanie katalogu 'src' i wykluczanie ręcznie podanych plików/folderów
        const result = await this.buildFileStructure(srcDir, excludeFolders, doMinify, debug, parsemd);

        // Dodaj folder `assets`, jeśli istnieje
        const assetsDir = path.join(srcDir, '.assets');
        if (fs.existsSync(assetsDir)) {
            if (debug) consola.debug('Adding assets...');
            fileStructure["assets"] = await this.buildFileStructure(assetsDir, excludeFolders, doMinify, debug, parsemd);
        }

        if (useHWAPI) {
            if (fs.existsSync(path.join(projectDir, 'src', '_hwapi.js'))) {
                if (debug) consola.debug('Linting HWAPI...');
                const eslint = new ESLint({
                    overrideConfigFile: path.join(__dirname, '..', 'eslint.config.js')
                });
                const result = await eslint.lintFiles([path.join(projectDir, 'src', '_hwapi.js')]);
                if (result[0].errorCount > 0) {
                    consola.error('HWAPI file cloud not be loaded!');
                    result[0].messages.forEach((message) => {
                        consola.error(`${message.message} (${message.line}, ${message.column})`);
                    }) 
                    process.exit(0);
                } else {
                    if (debug) consola.debug('No errors found');
                }
                if (debug) consola.debug('Adding HWAPI...'); 
                fileStructure["hwapi"] = fs.readFileSync(await compileFile(path.join(projectDir, 'src', '_hwapi.js'), debug), 'utf-8');
            } else { 
                consola.error(`HWAPI file not found at ${path.join(projectDir, 'src', '_hwapi.js')}! (If you don\'t want to use this feature, disable it in config file)`);
                process.exit(0);
            }
            
        }

        // Przenosimy wynik do struktury pliku .hw
        fileStructure["#"] = result;

        // Zapisanie struktury jako JSON do pliku tymczasowego
        const hwContent = JSON.stringify(fileStructure, null, 2);
        if (!fs.existsSync(path.dirname(outputFilePath))) {
            if (debug) consola.debug('Creating output directory...');
            fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
        }
        // Jeśli gzip = true, kompresujemy plik i zapisujemy w katalogu wyjściowym
        if (gzip) {
            const tempFilePath = temp.path({ suffix: '.hw' });
            fs.writeFileSync(tempFilePath, hwContent);
            if (debug) consola.debug('Compressing file...');
            const gzippedOutputPath = outputFilePath; 
            await this.compressFile(tempFilePath, gzippedOutputPath);
        } else {
            if (debug) consola.debug('Saving...');
            // Jeśli kompresja nie jest potrzebna, przenosimy plik tymczasowy do miejsca docelowego
            fs.writeFileSync(outputFilePath, hwContent);
        }
    }    
}

export {
    HWBuilder
};
