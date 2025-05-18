#!/usr/bin/env node

const fs = require('fs')
const { readSPCID666Tags, writeSPCID666Tags } = require('./spc-id666-tag-editor')
console.log(`spc-tag version ${require('./package.json').version}\n`)

let reading = true
let tagToWrite
let tagValue
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === 'write') {
    reading = false
    const parts = process.argv[i + 1].split('=')
    tagToWrite = parts[0]
    delete parts[0]
    tagValue = parts.join('=')
    tagValue = tagValue.substring(1)
  }
}

const filePath = process.argv[process.argv.length - 1]
if (!filePath.endsWith('.spc')) {
  console.error('Please supply a valid SPC file.')
  process.exit()
}

const file = fs.readFileSync(filePath)
if (reading) {
  console.log('SPC ID666 tags:', readSPCID666Tags(file))
} else {
  // writing
  const metadata = {}
  metadata[tagToWrite] = tagValue
  console.log('SPC ID666 tags before edit:', readSPCID666Tags(file))
  const newFile = writeSPCID666Tags(file, metadata)
  fs.writeFileSync(filePath, newFile)
  console.log('SPC ID666 tags after edit:', readSPCID666Tags(newFile))
}
