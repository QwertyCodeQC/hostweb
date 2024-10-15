#!/usr/bin/env node
const _version = "1.0.14";
import { Command } from "commander";
import { serve, create, build } from "#functions";
const program = new Command();
program
    .name("hostweb")
    .description("Simple localhost server with presets")
    .version("HostWeb v" + _version, "-v, --version", "Show version number");
program
    .command("serve <filename>")
    .description("Serve a .md, .html, .hw, or any other file")
    .option("-r, --raw", "Serve raw content (For example: do not format html or md)", false)
    .action((filename, options) => {
    serve(filename, options.raw);
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
export { _version };
