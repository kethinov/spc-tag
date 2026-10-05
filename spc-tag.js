#!/usr/bin/env node

// usage: spc-tag file.spc to read its tags, or spc-tag write field=value [field=value...] file.spc to write some
const fs = require('fs')
const { readSPCID666Tags, writeSPCID666Tags, tagNames, readOnlyTagNames } = require('./spc-id666-tag-editor')
const didYouMean = require('./didYouMean')
console.log(`spc-tag version ${require('./package.json').version}\n`)

// prints an error, with a suggestion if what was typed looks like a typo of one of the choices, and exits
function fail (message, typed, choices) {
  const suggestion = typed !== undefined && didYouMean(typed, choices)
  console.error(suggestion ? `${message} Did you mean "${suggestion}"?` : message)
  process.exit(1)
}

const args = process.argv.slice(2)
const filePath = args.pop()
if (!filePath || !filePath.toLowerCase().endsWith('.spc')) fail('Please supply a valid SPC file.')

// the only command is write, which is followed by the tags to write
const [command, ...tags] = args
if (command !== undefined && command !== 'write') fail(`Unknown command "${command}".`, command, ['write'])
if (command === 'write' && !tags.length) fail('Please supply a tag to write, like songTitle="new title".')
const metadata = {}
for (const tag of tags) {
  const equals = tag.indexOf('=')
  if (equals === -1) fail(`Please supply a value for "${tag}", like ${tag}="new value".`)
  const name = tag.substring(0, equals)
  if (readOnlyTagNames.includes(name)) fail(`"${name}" can be read, but not written.`)
  if (!tagNames.includes(name)) fail(`Unknown tag "${name}".`, name, tagNames)
  metadata[name] = tag.substring(equals + 1)
}

try {
  const file = fs.readFileSync(filePath)
  if (!command) {
    console.log('SPC ID666 tags:', readSPCID666Tags(file))
  } else {
    // writing
    console.log('SPC ID666 tags before edit:', readSPCID666Tags(file))
    const newFile = writeSPCID666Tags(file, metadata)
    fs.writeFileSync(filePath, newFile)
    console.log('SPC ID666 tags after edit:', readSPCID666Tags(newFile))
  }
} catch (error) {
  fail(error.code === 'ENOENT' ? `File not found: ${filePath}` : `Error: ${error.message}`)
}
