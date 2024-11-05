#!/usr/bin/env node
import { Command } from "commander";
import { serve, create, build } from "#functions"; 
import fs from "fs";
import { dirname, filename } from "dirname-filename-esm";
import path from "path";

const __dirname = dirname(import.meta);
const __filename = filename(import.meta);

const _version = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")).version; 

const program = new Command();

program
    .name("hostweb")
    .description("Simple localhost server with presets")
    .version("HostWeb v" + _version, "-v, --version", "Show version number")
 

program
    .command("serve [filename]")
    .description("Serve a .md, .html, .hw, or any other file")
    .option("-r, --raw", "Serve raw content (For example: do not format html or md)", false)
    .option("-w, --watch", "Watch for changes and reload", false)
    .action((filename, options) => {
        serve(filename, options.raw, options.watch);
    });

program
    .command("create <projname>")
    .description("Create new HostWeb project")
    .action((projname) => {
        create(projname);
    });
program
    .command("build")
    .description("Build HostWeb project")
    .option("-o, --output <dir>", "Output directory", "dist")
    .option("-d, --debug", "Enable debug mode", false)
    .action((options) => {
        build(options.output, options.debug);
    });

program.parse(process.argv);


export {
    _version
} 