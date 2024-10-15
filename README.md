<center><img src="https://raw.githubusercontent.com/QwertyCodeQC/hostweb/refs/heads/main/hostweb-dark.png" width="500"></center>
<center><h1>HostWeb</h1></center>
<center>Simple localhost server with presets</center>

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
file=hostwebrc

[config]
ignore[]=README.md

[config.build]
type=classic
usegzip=true
```
I this there's nothing to explain...

<hr>

<center>Made with ❤️ by <a href="https://github.com/QwertyCodeQC">QwertyCodeQC</a></center>