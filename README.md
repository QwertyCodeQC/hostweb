<p align="center">
  <img src="https://raw.githubusercontent.com/QwertyCodeQC/hostweb/refs/heads/main/hostweb-light.png" width="500" alt="HostWeb Logo">
</p>

<h1 align="center">HostWeb</h1>

<p align="center">Simple localhost server with bundles</p>
<span align="center"><a href="https://projects.qwerty.daxel.pl/hostweb">Docs</a> | <a href="https://npmjs.com/package/hostweb">NPM</a></span>

<p align="center">
  <img src="https://img.shields.io/npm/d18m/hostweb" alt="NPM Downloads">
  <img alt="NPM Version" src="https://img.shields.io/npm/v/hostweb?link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2Fhostweb">
  <img src="https://img.shields.io/npm/l/hostweb" alt="License">
  <img src="https://img.shields.io/npm/unpacked-size/hostweb" alt="NPM Unpacked Size">
</p>

## About
HostWeb was created to serve .html, .md, .png and other files you can imagine!
It also has a lightweight bundle system!
Pack system is a set of bundles that you can use in your project (.hw files).
It means that you can make whole website in just one file!

## Why HostWeb?
- Easy to use - hostweb has been designed to be easy to use.
- Fast - HostWeb use express to serve files fast as possible, just like this name!
- Pre-configured - HostWeb is a pre-configured server, it means you don't have to set up anything.
- front-back integration - HostWeb comes with HWAPI - connection with frontend and backend.
- Irreplaceable in education - HostWeb is easy-to-use tool to learn how frameworks work and how to manage front-end and back-end, what is important in other technologies like
[electron](https://www.electronjs.org/).

## Installation
``` bash
npm i -g hostweb
```

## Usage
### serve
The base command is `hostweb serve` examples:

#### 1. Serve a .md
```bash
hostweb serve example.md
```
*It converts markdown to html and serves it.*

#### 2. Serve a .html
```bash
hostweb serve example.html
```
*It serves html.*

### create
`hostweb create` command is used to create new preset.

#### 1. Create new project
``` bash
hostweb create example
```
*It creates new project folder in current directory.*

#### 2. Create new project in current directory
``` bash
hostweb create .
```
*It creates new project in current directory.*

### build
`hostweb build` command is used to build your project.

``` bash
hostweb build -o dist --debug
```
*.hw file lands in dist directory, and enables debug mode to show additional info while compiling*

## .hostwebrc
It looks like this

``` ini
file=hostwebrc ; DO NOT CHANGE

[config]
ignore[]=README.md ; Ignore files in src

[config.build]
type=classic ; Classic build
usegzip=true ; Enable gzip (disable for debugging)
minify=true ; Enable minification for files (it not affects visuals)
```
# Upcoming: HostWeb 2
- Introducing HWAPI - connection with frontend and backend
- Styling for .md
- Markdown support in presets
- Watch mode
- Enchanced CLI
- and more!!

<hr>

<center>Made with ❤️ by <a href="https://github.com/QwertyCodeQC">QwertyCodeQC</a></center>