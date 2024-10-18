<center><img src="https://raw.githubusercontent.com/QwertyCodeQC/hostweb/refs/heads/main/hostweb-light.png" width="500"></center>
<center><h1>HostWeb</h1></center>
<center>Simple localhost server with presets</center>
<br>
<center>
    <img src="https://img.shields.io/npm/d18m/hostweb" alt="NPM Downloads">
    <img src="https://img.shields.io/npm/v/hostweb" alt="NPM Version">
    <img src="https://img.shields.io/npm/l/hostweb" alt="License">
    <img src="https://img.shields.io/npm/unpacked-size/hostweb" alt="NPM Unpacked Size">
</center>

## About
HostWeb was created to serve .html, .md, .png and other files you can imagine!
It also has a lightweight pack system!
Pack system is a set of presets that you can use in your project (.hw files).
It means that you can make whole website in just one file!

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

<hr>

<center>Made with ❤️ by <a href="https://github.com/QwertyCodeQC">QwertyCodeQC</a></center>