import { Request, Response } from 'express';
import fs from "fs";
import path from "path";
import consola, { LogLevels } from "consola";
import { _version } from "#hostweb";
import showdown from "showdown";
import express from 'express';
import chalk from "chalk";
import { Server } from "http";
import { parse, stringify } from "ini";
import { dirname, filename } from 'dirname-filename-esm';
import { glob } from 'glob';
import { HWBuilder } from '#classes';
import { createGunzip } from 'zlib';
import temp from 'temp';
import { promisify } from 'util';
import { pipeline } from 'stream';

const __dirname = dirname(import.meta);
const __filename = filename(import.meta);
export async function serve(filename: string, raw: boolean) {
    let content: string | Buffer = '';
    const extension = path.extname(filename).toLowerCase(); // Get file extension to identify the file type
    if (raw) {
        consola.info('Using raw mode. Formatting disabled.');  // Notify the user that raw mode is used
    }
    consola.start(`Invoking server for "${path.resolve(filename)}"...`);  // Start server notification

    // Check if the file exists
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        consola.error(`This is not a file or it doesn't exist: ${path.resolve(filename)}`);  // If the file is not found, log the error and return
        return;
    }

    const app = express();  // Initialize an Express app

    // File handling based on extension type
    switch (extension) {
        case '.md':  // Handle Markdown files
            if (!raw) {
                consola.start('Converting markdown...');  // Log markdown conversion process
                const converter = new showdown.Converter();  // Create a new showdown markdown converter
                let body = converter.makeHtml(fs.readFileSync(filename, 'utf8'));  // Convert markdown to HTML
                content = `
                <!-- Generated by HostWeb v${_version} -->
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${filename}</title>
                    <style>
                        @font-face {
                            font-family: 'CustomFont';
                            src: url('../assets/fonts/leaguespartan.ttf') format('truetype');
                        }
    
                        body {
                            font-family: 'CustomFont', sans-serif;
                        }
                    </style>
                </head>
                <body>
                    ${body}  <!-- Converted HTML content is placed here -->
                </body>
                </html>
                `
                consola.success('Markdown conversion done!');  // Log markdown conversion success
            } else {
                content = fs.readFileSync(filename);  // Just read file content in raw mode
            }
            break;

        case '.html':  // Handle HTML files
        case '.htm':
            content = fs.readFileSync(filename);  // Read the HTML file content
            break;

        case '.hw':  // Handle custom .hw (hostweb) files
            if (!raw) {
                let filepath: string;
                if (isGzipFile(filename)) {  // If the file is Gzipped
                    filepath = temp.path({ suffix: '.hwunpacked' });  // Create a temporary file to hold unpacked content
                    try {
                        await decompressGzipFile(filename, filepath);  // Decompress the file into the temp path
                    } catch (error) {
                        consola.error('Error during decompression:', error);  // Log errors during decompression
                        return;
                    }
                } else {
                    filepath = filename;  // If not Gzipped, use the original file path
                }

                const config = JSON.parse(fs.readFileSync(filepath, 'utf8'));  // Read the JSON content of the .hw file

                // Serve dynamic routes from the .hw configuration
                app.get("/", (req: Request, res: Response) => {
                    if (config['#'] && config['#']['index.html']) {
                        res.setHeader('Content-Type', 'text/html');  // Set the content type to HTML
                        res.send(config['#']['index.html'].content);  // Serve the index.html content
                    } else {
                        res.status(404).send('Index.html not found in .hw file');  // Return 404 if not found
                    }
                });


                Object.keys(config['#']).forEach((route) => {
                    let routePath: string;
                
                    // Sprawdzenie, czy mamy plik index.html w głównym folderze lub w podfolderach
                    if (route.toLowerCase() === "index.html" || route.toLowerCase() === "index.htm") {
                        routePath = "/";  // Główna ścieżka
                    } else if (route.endsWith('/index.html') || route.endsWith('/index.htm')) {
                        // Jeśli mamy plik "index.html" w folderze, tworzymy odpowiednią trasę
                        routePath = `/${route.replace('/index.html', '').replace('/index.htm', '')}`;
                    } else {
                        // Zachowujemy rozszerzenie .html w nazwie pliku
                        routePath = `/${route}`;
                    } 
                
                    app.get(routePath, (req: Request, res: Response) => {
                        if (config['#'][route] && config['#'][route].content) {
                            res.setHeader('Content-Type', 'text/html');
                            res.send(config['#'][route].content);
                        } else {
                            res.status(404).send(`${route} not found in .hw file`);
                        }
                    });
                });
                

                // Serve static assets from the .assets directory
                app.get('/.assets/:file', (req: Request, res: Response) => {
                    const requestedAsset = req.params.file;
                    if (config.assets && config.assets[requestedAsset]) {
                        res.setHeader('Content-Type', getContentType(requestedAsset));  // Set the appropriate content type
                        res.send(config.assets[requestedAsset].content);  // Serve the asset content
                    } else {
                        res.status(404).send('Asset not found');  // Return 404 if the asset is not found
                    }
                });
            } else {
                content = fs.readFileSync(filename);  // Simply read the file content
            }
            break;
    
        default:  // Default case for all other file types
            content = fs.readFileSync(filename);  // Simply read the file content 
    }

    if (extension != '.hw' || (extension == '.hw' && raw)) {
        let fileexts = JSON.parse(fs.readFileSync(path.resolve(path.join(path.dirname(__dirname), 'assets', 'json', 'fileext.json')), 'utf8')); 
        app.get('/', (req: Request, res: Response) => {
            if (raw) {
                res.setHeader('Content-Type', 'text/plain');  // Set the content type to plain text
            } else {
                res.contentType(fileexts[extension] || 'text/plain');
            }
            res.send(content);  // Serve the content
        });
    }
    // Start the Express server
    app.set('view engine', 'ejs');  // Set the view engine to EJS
    app.set('views', path.resolve(path.join(path.dirname(__dirname), 'htmls')));  // Set the views directory
    const server: Server = app.listen(825, () => {  // Start the server on port 825
        consola.log('');
        consola.info(`Serving file: ${chalk.green(filename)}`);
        consola.info(chalk.blue(`http://localhost:825`));
        consola.info(`Press ${chalk.green("Ctrl+C")} to stop...`);
    });

    app.use((req: Request, res: Response, next) => {
        res.set("X-Powered-By", "HostWeb");  // Add a custom header to responses
        next(); 
    });

    // Handle errors for 404 routes
    app.use((req: Request, res: Response) => {
        res.status(404).render('404', { version: _version, adress: req.url });  // Render a 404 page using EJS
    });
}

export async function create(projname: string) {
    consola.start('Invoked project creation...');
    if (projname == '.') {
        let currdir = await consola.prompt("Generate project in current directory?", { type: 'confirm' });
        if (!currdir) {
            process.exit(0);
        } else if (currdir) {
            if ((await glob('*', { cwd: process.cwd() })).length > 0) {
                consola.error(`Directory is not empty: ${process.cwd()}`);
                process.exit(0);
            }
        }
    }
    if (fs.existsSync(projname) && projname != '.') {
        consola.error(`Directory already exists: ${projname}`);
        process.exit(0);
    }
    if (projname != '.') {
        fs.mkdirSync(projname, { recursive: true });
    }
    fs.mkdirSync(path.join(projname, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projname, 'src', 'example-route'), { recursive: true });
    fs.mkdirSync(path.join(projname, 'src','.assets'), { recursive: true });
    fs.writeFileSync(path.join(projname, 'src','example-route',  'index.html'), '<h1>Hello World</h1>\n<p>This is example route</p>\n', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','index.html'), '<h1>Hello World</h1>\n<p>This is homepage</p>\n', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','.assets', 'style.css'), '/* This is an example stylesheet */\nbody { background-color: #f2f2f2; }', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','README.md'), `# ${projname == '.' ? path.basename(process.cwd()) : projname}
Welcome in ${projname == '.' ? path.basename(process.cwd()) : projname} project!

## Useful commands

### build
\`hostweb build\` - Build project

<hr>
<center>HostWeb v${_version}</center>`, 'utf8');
    fs.writeFileSync(path.join(projname, '.hostwebrc'), stringify({
        file: "hostwebrc",
        config: {
            name: projname == '.' ? path.basename(process.cwd()) : projname, 
            build: {
                type: "classic",
                usegzip: true,
                minify: true
            },
            ignore: [
                "README.md"
            ] 
        },
    }), 'utf8');
    consola.success('Project created successfully! 🎉');
}

export async function build(out: string, debug: boolean) {
    let config: any;
    consola.level = debug ? LogLevels.debug : LogLevels.info;
    if (debug) consola.debug('Debug mode enabled!');
    consola.start('Invoked project build...');
    if (debug) consola.debug('Parsing config...'); 
    if (!fs.existsSync('./.hostwebrc')) {
        consola.error('Cannot find config (.hostwebrc) file!');
        process.exit(0);
    }
    try {
        config = parse(fs.readFileSync('./.hostwebrc', 'utf8'));
        if (debug) consola.debug('Invoking HWBuilder...');
        const hwb = new HWBuilder();
        hwb.createHWFile(process.cwd(), path.join(out, config.config.name + '.hw'), config.config.ignore, config.config.build.usegzip, debug, config.config.build.minify);
    } catch (error) {
        consola.error(error);
        process.exit(0);
    }
    consola.success(chalk.green('Project builded successfully! 🎉'));
    consola.info('Check it out by running: ' + chalk.blueBright(`hostweb serve ./${out}/${config.config.name}.hw`)); 
}

export function isGzipFile(filePath: string) {
    const buffer = Buffer.alloc(2); // Pierwsze dwa bajty
    const fileDescriptor = fs.openSync(filePath, 'r');
    fs.readSync(fileDescriptor, buffer, 0, 2, 0);
    fs.closeSync(fileDescriptor);

    // Sprawdź czy pierwsze dwa bajty są zgodne z Gzip (0x1f 0x8b)
    return buffer[0] === 0x1f && buffer[1] === 0x8b;
}

const pipelineAsync = promisify(pipeline);

export async function decompressGzipFile(filePath: string, outPath: string): Promise<void> {
    try {
        const readStream = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(outPath);
        const unzip = createGunzip();

        // Używamy promisify do pipeline, aby obsługiwać strumienie asynchronicznie
        await pipelineAsync(readStream, unzip, writeStream);
    } catch (err) {
        consola.error(err);
        throw err;
    }
}

export function getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.png':  // Handle PNG files
        case '.jpg':  // Handle JPG files
        case '.jpeg':  // Handle JPEG files
        case '.gif':  // Handle GIF files
        case '.svg':  // Handle SVG files
        case '.webp':  // Handle WebP files
        case '.ico':  // Handle ICO files
        case '.bmp':  // Handle BMP files 
        case '.tiff':  // Handle TIFF files
            return 'image/' + ext.slice(1);
        default:
            return 'text/plain';
    }
}
