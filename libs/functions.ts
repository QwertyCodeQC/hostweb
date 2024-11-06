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
import { HTMLElement, parse as parsehtml } from 'node-html-parser';
import { isUrlExternal } from 'is-url-external';
import { exec } from 'child_process';
import pkg from 'webpack';
import { pathToFileURL } from 'url';
import ejs from 'ejs';
import Watchpack from 'watchpack';
import AsyncExitHook from 'async-exit-hook';
import chokidar from 'chokidar';
const { webpack } = pkg;
const __dirname = dirname(import.meta);
const __filename = filename(import.meta);
interface HWApi {
    func: (...args: any[]) => any;
    name: string;
    _get: () => any;
}

AsyncExitHook(() => {
    consola.info('Closing...');
})
export async function serve(_filename: string, raw: boolean, watch: boolean) { 
    let watcher;
    let content: string | Buffer = ''; 
    let filename: any = _filename;

    if (raw) {
       consola.info('Using raw mode. Formatting disabled.');
    }

    if (watch) consola.info('Watching enabled!');
    if (watch && _filename != undefined) {
        watcher = chokidar.watch(filename, { persistent: true });
        filename = _filename;
    }
    if (_filename == undefined) {
        if (fs.existsSync('./.hostwebrc')) {
            consola.info('HostWeb Project found! Building project...');
            const distPath = temp.path({ suffix: '.hw' });
            const hwb = new HWBuilder();
            const config = parse(fs.readFileSync('./.hostwebrc', 'utf8'))['config'];
            await hwb.createHWFile(process.cwd(), distPath, config.ignore, config.build.usegzip, false, config.build.minify, config.usehwapi, config.build.parsemd);
            consola.success('Project built successfully!');
            filename = distPath;
            if (watch) {
                const pathsToWatch = [path.join(process.cwd(), '.hostwebrc'), path.join(process.cwd(), 'src')];
                watcher = chokidar.watch(pathsToWatch, { persistent: true });
            };
                
        } else {
            consola.error('HostWeb Project not found!');
            process.exit(0);
        }
    }


    consola.start(`Invoking server for "${path.resolve(filename)}"...\n`);
    // Sprawdzanie, czy plik istnieje
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        consola.error(`This is not a file or it doesn't exist: ${path.resolve(filename)}`);
        return;
    }



    const extension: string = path.extname(filename).toLowerCase(); // Pobieranie rozszerzenia pliku
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.disable('x-powered-by');
    // Obsługa plików w zależności od rozszerzenia
    switch (extension) {
        case '.md':  // Obsługa plików Markdown
            if (!raw) {
                consola.start('Converting markdown...');
                content = convertMD(fs.readFileSync(filename, 'utf8'), path.basename(filename));
                consola.success('Markdown conversion done!');
            } else {
                content = fs.readFileSync(filename);  // Odczyt pliku w trybie "raw"
            }
            break;

        case '.html':  // Obsługa plików HTML
        case '.htm':
            content = fs.readFileSync(filename);  // Odczyt zawartości HTML
            break;

        case '.hw':  // Obsługa plików .hw (HostWeb)
            if (!raw) {
                let filepath: string;
                if (isGzipFile(filename)) {  // Jeśli plik jest skompresowany Gzipem
                    filepath = temp.path({ suffix: '.hwunpacked' });
                    try {
                        await decompressGzipFile(filename, filepath);  // Dekompresja pliku
                    } catch (error) {
                        consola.error('Error during decompression:', error);
                        return;
                    }
                } else {
                    filepath = filename;
                }

                const config = JSON.parse(fs.readFileSync(filepath, 'utf8'));  // Odczyt JSON z pliku .hw
                if (config['$usehwapi']) {
                    const filepath = temp.path({ suffix: '.hwapi.mjs' });
                    fs.writeFileSync(filepath, config['hwapi'], 'utf8');
                    
                    const { hwa: hwapi } = await import(`${pathToFileURL(path.resolve(filepath)).href}`);
                    const functions: any[] = hwapi._get();
                    app.post('/_hwapi/:func', (req: Request, res: Response) => {
                        try {
                            let args = req.body;
                            let result: any = {
                                error: "Function not found",
                                result: "HWERR: Function not found"
                            };
                            const func = req.params.func;
                            functions.forEach((x) => {
                                if (x.name === func) { 
                                    result = {
                                        error: null,
                                        result: x.func(...args)
                                    }
                                }
                            })
                            if (result.error == "Function not found") {
                                consola.error("Function not found: " + func + " Check your JavaScript code!");
                            }
                            res.json(result);
                        } catch (error) {
                            consola.error(error);
                            res.status(500).json({ error: error });
                        }
                    });
                }
                let index = parsehtml(config['#']['index.html'].content)
                if (config['$usehwapi']) {
                    index.querySelectorAll('script').forEach((el: HTMLElement) => {
                        el.innerHTML = transformHWACalls(el.innerHTML);
                    })
                }
                // Serwowanie pliku głównego (index.html)
                app.get("/", (req: Request, res: Response) => {
                    if (config['#'] && config['#']['index.html']) {
                        res.setHeader('Content-Type', 'text/html');
                        res.send(index.innerHTML);
                    } else {
                        res.render('404', { version: _version, adress: 'index.html' });
                    }
                });

                // Serwowanie dynamicznych tras
                Object.keys(config['#']).forEach((route) => {
                    let routePath: string;
                    // Obsługa dynamicznych tras dla plików index.html
                    if (route.toLowerCase() === "index.html" || route.toLowerCase() === "index.htm") {
                        routePath = "/";
                    } else if (route.endsWith('/index.html') || route.endsWith('/index.htm')) {
                        routePath = `/${route.replace('/index.html', '').replace('/index.htm', '')}`;
                    } else {
                        routePath = `/${route}`;
                    }

                    app.get(routePath, (req: Request, res: Response) => {
                        if (config['#'][route] && config['#'][route].content) {
                            res.setHeader('Content-Type', 'text/html');
                            if (config['$usehwapi']) {
                                let page = parsehtml(config['#'][route].content)
                                page.querySelectorAll('script').forEach((el: HTMLElement) => {
                                    el.innerHTML = transformHWACalls(el.innerHTML);
                                })
                                if (config['$parsemd'] && route.endsWith('.md')) {
                                    res.send(convertMD(config['#'][route].content, path.basename(route)));
                                } else {
                                    res.send(page.innerHTML);
                                }
                            } else {
                                res.send(config['#'][route].content);
                            }
                        } else {
                            res.status(404).send(`${route} not found in .hw file`);
                        }
                    });
                });
                
                // Serwowanie zasobów z folderu .assets
                app.get('/.assets/:file', (req: Request, res: Response) => {
                    const requestedAsset = req.params.file;
                    if (config.assets && config.assets[requestedAsset]) {
                        const assetContent = config.assets[requestedAsset].content;
                        const assetEncoding = config.assets[requestedAsset].encoding || 'utf8';  // Sprawdzenie kodowania

                        if (assetEncoding === 'base64') {
                            res.setHeader('Content-Type', getContentType(requestedAsset));
                            const buffer = Buffer.from(assetContent, 'base64');  // Dekodowanie Base64 do bufora
                            res.send(buffer);
                        } else if (['.js', '.mjs', '.cjs'].includes(path.extname(requestedAsset)) && config['$usehwapi']) {
                            res.setHeader('Content-Type', 'text/javascript');
                            res.send(transformHWACalls(assetContent));
                        } else {
                            res.setHeader('Content-Type', getContentType(requestedAsset));
                            res.send(assetContent);
                        }
                    } else {
                        res.status(404).send('Asset not found');
                    }
                });
            }
            break;

        default:  // Domyślna obsługa innych typów plików
            content = fs.readFileSync(filename);
    }

    if (extension != '.hw' || (extension == '.hw' && raw)) {
        let fileexts = JSON.parse(fs.readFileSync(path.resolve(path.join(path.dirname(__dirname), 'assets', 'json', 'fileext.json')), 'utf8'));
        app.get('/', (req: Request, res: Response) => {
            if (raw) {
                res.setHeader('Content-Type', 'text/plain');
            } else {
                res.contentType(fileexts[extension] || 'text/plain');
            }
            res.send(content);
        });
    }

    if (['.html', '.htm', '.md'].includes(extension)) {
        const parsedHTML = parsehtml(content.toString());  //  Parsowanie zawartości HTML
        const assets: any = [];
    
        // Zbieranie zasobów (obrazy, skrypty, style), które nie są zewnętrzne
        parsedHTML.querySelectorAll('img, script, link[rel="stylesheet"]').forEach((element: HTMLElement) => {
            let srcAttr = element.getAttribute('src') || element.getAttribute('href');
            
            // Sprawdzanie, czy URL jest zewnętrzny
            if (srcAttr && !isUrlExternal(srcAttr, 'https://localhost:825')) {
                const assetPath = path.join(path.dirname(filename), srcAttr);
                if (fs.existsSync(assetPath)) {
                    assets.push(assetPath);
                }
            }
        });
        parsedHTML.querySelectorAll('script').forEach(async (element: HTMLElement) => {
            element.innerHTML = transformHWACalls(element.innerHTML)
        })
    
        if (assets.length > 0) {
            consola.info('Local assets detected! Serving to static server...');
        }
    
        // Serwowanie zasobów dynamicznie
        assets.forEach((asset: string) => {
            app.get('/' + asset, (req: Request, res: Response) => {
                res.contentType(getContentType(asset));
                res.send(fs.readFileSync(asset));
            });
        });

    }
    app.use('/_hostweb', express.static(path.join(path.dirname(__dirname), 'public')));
     

    // Uruchomienie serwera
    app.set('view engine', 'ejs');
    app.set('views', path.resolve(path.join(path.dirname(__dirname), 'htmls')));
    app.use((req, res, next) => {
        res.status(404).render('404', { adress: req.url, version: _version });
    });
    const server: Server = app.listen(825, () => {
        consola.log('');
        consola.info(`Serving file: ${chalk.green(filename)}`);
        consola.info(chalk.blue(`http://localhost:825`));
        consola.info(`Press ${chalk.green("Ctrl+C")} to stop...`);
    });
    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            consola.error('Port 825 is busy! Try to stop the colliding server and try again.');
            process.exit(1);
        }
    })
    if (watch) {
        watcher?.on("change", async () => {
            server.close(() => {
                watcher.close();
                consola.info(chalk.yellowBright(`File change detected, restarting server...`));
                console.log('');
                setTimeout(() => {
                    console.clear();
                    serve(_filename, raw, watch);
                }, 700);
            });
        })
    }
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
    fs.mkdirSync(path.join(projname, '_hostweb', 'js'), { recursive: true });
    fs.writeFileSync(path.join(projname, '_hostweb', 'js', 'hwapi.js'), 'class HWApi{funcarray=[];constructor(){}func(r){return this.funcarray.push(r),this}_get(){return this.funcarray}}export default HWApi;', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','example-route',  'index.html'), '<h1>Hello World</h1>\n<p>This is example route</p>\n', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','index.html'), '<h1>Hello World</h1>\n<p>This is homepage</p>\n', 'utf8');
    fs.writeFileSync(path.join(projname, 'src','.assets', 'style.css'), '/* This is an example stylesheet */\nbody { background-color: #f2f2f2; }', 'utf8');
    fs.writeFileSync(
        path.join(projname, 'src', '_hwapi.js'),
        ejs.render(
            fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'examples', 'hwapi.js'), 'utf8'),
            { hwapi_path: '../_hostweb/js/hwapi.js' }
        )
    );
    fs.writeFileSync(path.join(projname, 'src','README.md'), `# ${projname == '.' ? path.basename(process.cwd()) : projname}
Welcome in ${projname == '.' ? path.basename(process.cwd()) : projname} project!

## Useful commands

### build
\`hostweb build\` - Build project

### serve
\`hostweb serve\` - Serve project in development mode

<hr>
<center>HostWeb v${_version}</center>`, 'utf8');
    fs.writeFileSync(path.join(projname, '.hostwebrc'), stringify({
        file: "hostwebrc",
        config: {
            name: projname == '.' ? path.basename(process.cwd()) : projname, 
            usehwapi: true,
            build: {
                type: "classic",
                usegzip: true,
                minify: true,
                parsemd: true
            },
            ignore: [
                "README.md"
            ] 
        },
    }), 'utf8');
    await installPackage('babel-loader @babel/preset-env', projname, false);
    consola.success('Project created successfully! 🎉');
}

export async function build(out: string, debug: boolean) {
    let config: any;
    if (path.resolve(out) == path.resolve(process.cwd())) {
        consola.error('Cannot build project in current directory!');
        process.exit(0);
    }
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
        await hwb.createHWFile(process.cwd(), path.join(out, config.config.name + '.hw'), config.config.ignore, config.config.build.usegzip, debug, config.config.build.minify, config.config.usehwapi, config.config.build.parsemd);
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
    const exts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'json', 'fileext.json'), 'utf8'));
    return exts[ext] || 'text/plain';
}

export async function installPackage(packageName: string, location: string, savedev: boolean) {
    consola.start(chalk.green('Installing dependecies...'));
    return new Promise((resolve, reject) => {
        exec(`npm install ${packageName} --prefix ${location}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Błąd podczas instalacji paczki: ${error.message}`);
                reject(new Error('Dependency installing error'))
            }
            if (stderr) {
                console.error(`${stderr}`);
            }
            if (stdout) {
                consola.log(`${stdout}`);
            }
        });
    })
}

export async function compileFile(filePath: string, debug: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      const compiler = webpack({
        context: path.resolve(__dirname, '..'),
        mode: 'production',
        entry: path.resolve(filePath),
        output: {
            filename: 'compiledHWAPI.bundle.js',
            path: temp.mkdirSync('webpack_output'),
            library: {
              type: 'module',   // Ustawienie jako moduł ESM
            },
            chunkFormat: 'module',  // Użycie formatu modułowego
          },
          experiments: {
            outputModule: true, // Konfiguracja dla ESM
          },
          optimization: {
            minimize: true,  
          },
          target: 'node', // Specyfikuje środowisko Node.js
          module: {
            rules: [
              {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                  loader: 'babel-loader',
                  options: {
                    presets: ['@babel/preset-env'],
                  },
                },
              },
            ],
          },
        });
  
      // Uruchomienie kompilacji
      compiler.run((err, stats) => {
        if (err) {
          consola.error('Compilation error:', err);
          reject(err);
          return;
        }
  
        if (stats) {
          const info = stats.toJson();
  
          if (stats.hasErrors()) {
            info.errors?.forEach((error) => {
              consola.error('Compilation error:', error);
            });
            reject(new Error('Errors occurred during compilation.'));
            return;
          }
  
          if (stats.hasWarnings()) {
            info.warnings?.forEach((warning) => {
              consola.warn('Compilation warning:', warning);
            });
          }
  
          if (debug) {
            consola.debug('Webpack compilation done!');
          }
  
          try {
            const outputPath = path.join(info.outputPath ?? '', 'compiledHWAPI.bundle.js');
            resolve(outputPath);
          } catch (readError) {
            consola.error('Error reading output file:', readError);
            reject(readError);
          }
        } else {
          reject(new Error('Unable to retrieve compilation stats.'));
        }
      });
    });
}

export function convertMD(text: string, filename: string): string {
    const converter = new showdown.Converter();
    let body = converter.makeHtml(text);
    let content = `
    <!-- Generated by HostWeb v${_version} -->
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="./_hostweb/css/highlight.css">
        <link rel="stylesheet" href="./_hostweb/css/leaguespartan.css">
        <script src="./_hostweb/js/highlight.min.js"></script>
        <title>${filename}</title>
    </head>
    <body>
        <div class="mdbody">
            ${body}
        </div>
    </body>
    <script>
        hljs.highlightAll(); 
    </script>
    </html>
    `;
    return content;
}


export function transformHWACalls(code: string): string {
    // (yes i used chat gpt for it) 
    const regex = /(?<!\/\/[^\n]*)(?<!\/\*[^]*?)\bhwa\.([a-zA-Z0-9_]+)\(([^)]*)\)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
        const functionName = match[1];
        const argsString = match[2];
        
        const argsArray = argsString ? argsString.match(/[^,]+(?:\([^)]*\))?/g)?.map(arg => arg.trim()) ?? [] : [];

        let hasCallback = false;
        let callback: any = argsArray[argsArray.length - 1];
        
        if (callback && (callback.startsWith("function") || callback.includes("=>"))) {
            hasCallback = true;
            argsArray.pop();
        } else {
            callback = null;
        }

        const args = argsArray.map((_, index) => `arg${index}`);
        if (hasCallback) {
            args.push('cb');
        }

        const functionArgs = args.join(', ');

        // Ustal, czy mamy wywołać callback lub zostawić pustą funkcję
        const successCallback = hasCallback ? 'cb' : '(result => {})';
        const errorCallback = hasCallback ? 'cb' : '(error => {})';

        const fetchCode = `(function(${functionArgs}){fetch(\`./_hwapi/${functionName}\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([${argsArray.join(', ')}])}).then(res=>res.ok?res.json():Promise.reject(\`HTTP error! status: \${res.status}\`)).then(data=>{if(data.error){console.error('[HWAPI] Function execution error:', data.error);} ${successCallback}(data.result,null)}).catch(err=>{console.error('Fetch error:', err); ${errorCallback}(null,err);});})(${[...argsArray, hasCallback ? callback : ''].filter(arg => arg !== '').join(', ')})`;

        code = code.replace(match[0], fetchCode);
    }

    return code;
}






