import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { createGzip } from 'zlib'; // Zlib do kompresji
import temp from 'temp'; // Zależność do obsługi plików tymczasowych
import consola from 'consola';
import { minify } from 'minify';


class HWBuilder {
    constructor() {
        temp.track(); // Ustawienie, aby automatycznie śledzić pliki tymczasowe
    }

    // Funkcja przeszukująca wszystkie pliki, wykluczając ręcznie pliki na podstawie `exclude`
    async buildFileStructure(dirPath: string, exclude: string[] = [], doMinify: boolean): Promise<any> {
        const structure: any = {};
        const supportedExtensions = ['.js', '.css', '.html', '.htm', '.json'];  // Obsługiwane rozszerzenia
        const items = glob.sync(`${dirPath}/**/*`, { nodir: false });
    
        console.log(`Znaleziono pliki: ${items.length}`); // Sprawdzenie liczby plików
    
        for (const fullPath of items) {
            let relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/'); // Zamiana na ukośniki
            const stats = fs.statSync(fullPath);
    
            // Sprawdź, czy plik/katalog nie znajduje się w liście wykluczeń
            if (!exclude.includes(relativePath) && stats.isFile()) {
                const ext = path.extname(fullPath).toLowerCase();
                const fileContent = fs.readFileSync(fullPath, 'utf-8'); // Odczytaj zawartość pliku
                
                // Logowanie ścieżek plików
                console.log(`Dodawanie pliku: ${relativePath}`);
    
                // Sprawdzamy, czy plik ma rozszerzenie obsługiwane do minifikacji
                if (supportedExtensions.includes(ext) && doMinify) {
                    try {
                        // Minifikujemy przekazując ścieżkę do pliku
                        const minifiedContent = await minify(fullPath);
                        structure[relativePath] = {
                            content: minifiedContent,  // Zapisujemy zminifikowaną zawartość
                        };
                    } catch (error) {
                        console.error(`Błąd podczas minifikacji pliku ${fullPath}:`, error);
                    }
                } else {
                    // Zapisujemy zawartość pliku bez minifikacji, jeśli rozszerzenie nie jest wspierane
                    structure[relativePath] = {
                        content: fileContent,
                    };
                }
            }
        }
    
        console.log(`Struktura wygenerowana: ${JSON.stringify(structure, null, 2)}`); // Logowanie struktury
    
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

    async createHWFile(projectDir: string, outputFilePath: string, excludeFolders: string[] = [], gzip: boolean, debug: boolean, doMinify: boolean) {
        if (debug) consola.debug('Creating filemap...');
        const srcDir = path.join(projectDir, 'src');  // Skupiamy się na katalogu 'src'
        const fileStructure: any = {
            "$filetype": "hostweb.pack",
            "#": {} // dynamiczne foldery i pliki z 'src'
        };

        // Przeszukiwanie katalogu 'src' i wykluczanie ręcznie podanych plików/folderów
        const result = await this.buildFileStructure(srcDir, excludeFolders, doMinify);

        // Dodaj folder `assets`, jeśli istnieje
        const assetsDir = path.join(srcDir, '.assets');
        if (fs.existsSync(assetsDir)) {
            if (debug) consola.debug('Adding assets...');
            fileStructure["assets"] = await this.buildFileStructure(assetsDir, excludeFolders, doMinify);
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
