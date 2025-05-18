🎮🎶 **spc-tag** [![npm](https://img.shields.io/npm/v/spc-tag.svg)](https://www.npmjs.com/package/spc-tag)

Node.js library and command line program to read or write [Super Nintendo SPC ID666 tags](https://wiki.superfamicom.org/spc-and-rsn-file-format). It supports reading and writing both standard and extended ID666 tags.

## Use as a command line program

### Install

```
npm i -g spc-tag
```

### Use

#### Read tags

```
spc-tag file.spc
```

#### Write a tag

```
spc-tag write songTitle="new title" file.spc
```

## Use in Node.js

### Install

```
npm i spc-tag
```

### Use

```javascript
const { readSPCID666Tags, writeSPCID666Tags } = require('spc-tag')
const fs = require('fs')

// read tags
const readMetadata = readSPCID666Tags(fs.readFileSync('file.spc'))
console.log(readMetadata) // prints metadata

// write tags
const fileData = fs.readFileSync('file.spc') // open file as a buffer
const metadata = readSPCID666Tags(fileData) // get metadata
metadata.songTitle = 'new title' // change metadata
const editedFileData = writeSPCID666Tags(fileData, metadata) // write new metadata to the buffer
fs.writeFileSync('file.spc', editedFileData) // write buffer to file
const editedFile = fs.readFileSync('file.spc') // open edited file as a buffer
console.log(readSPCID666Tags(editedFile)) // print metadata with edits
```

## Development

### Run tests

- Clone this repo
- `npm ci`
- `npm t`
