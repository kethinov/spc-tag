// this is a Node.js-based SPC ID666 tag editor based on the spec below copied from http://snesmusic.org/files/spc_file_format.txt
/*
SPC File Format v0.30
=====================

Offset Size  Description
------ ----- ------------------------------------------------------------------
00000h    33 File header "SNES-SPC700 Sound File Data v0.30"
00021h     2 26,26
00023h     1 26 = header contains ID666 information
             27 = header contains no ID666 tag
00024h     1 Version minor (i.e. 30)

SPC700 Registers:
00025h     2 PC
00027h     1 A
00028h     1 X
00029h     1 Y
0002Ah     1 PSW
0002Bh     1 SP (lower byte)
0002Ch     2 reserved

ID666 Tag (text format):
0002Eh    32 Song title
0004Eh    32 Game title
0006Eh    16 Name of dumper
0007Eh    32 Comments
0009Eh    11 Date SPC was dumped (MM/DD/YYYY)
000A9h     3 Number of seconds to play song before fading out
000ACh     5 Length of fade in milliseconds
000B1h    32 Artist of song
000D1h     1 Default channel disables (0 = enable, 1 = disable)
000D2h     1 Emulator used to dump SPC:
            0 = unknown
            1 = ZSNES
            2 = Snes9x
000D3h    45 reserved (set to all 0's)

ID666 Tag (binary format):
0002Eh    32 Song title
0004Eh    32 Game title
0006Eh    16 Name of dumper
0007Eh    32 Comments
0009Eh     4 Date SPC was dumped (YYYYMMDD)
000A2h     7 unused
000A9h     3 Number of seconds to play song before fading out
000ACh     4 Length of fade in milliseconds
000B0h    32 Artist of song
000D0h     1 Default channel disables (0 = enable, 1 = disable)
000D1h     1 Emulator used to dump SPC:
            0 = unknown
            1 = ZSNES
            2 = Snes9x
000D2h    46 reserved (set to all 0's)

00100h 65536 64KB RAM
10100h   128 DSP Registers
10180h    64 unused
101C0h    64 Extra RAM (Memory region used when the IPL ROM region is set
             to read-only)

Extended ID666 Format
=====================

Extended information is stored at the end of the SPC file as an IFF chunk
with an ID of "xid6".  Items that can be stored in the ID666 tag without any
loss of data should not be stored in the extended area.

Offset Size Description
------ ---- ------------------------------------------------------------------
0      4    Chunk type "xid6"
4      4    Chunk size, not including header

Sub-chunk Header
----------------

Inside the chunk are sub-chunks.  Each sub-chunk consists of a 4-byte header,
and possibly data.  All data is 32-bit aligned.  If the data stored doesn't
reach a 32-bit boundary, it will be padded with 0's.

Offset Size Description
------ ---- ------------------------------------------------------------------
0      1    ID     - song name, length, etc.
1      1    Type   - 0 means data is stored in the header
                     non-zero means data is stored after header
2      2    Length - if 'type' is non-zero, this contains the length of the
                     following data

Extended ID666 Items
--------------------

ID:   00-0F - Items from original ID666 tag
      10-1F - Extended items
      30-3F - Items related to playback

Type: Length  - 'Type' contains a 0, and the tag item is saved in the 'Length'
                of the sub-chunk header.
      String  - 'Type' contains a 1, and the tag item is stored as a null
                terminated string (max 256 characters including null).
                Currently, strings saved in SNESAmp use ANSI characters.
                However, support for UNICODE may be added.
      Integer - 'Type' contains a 4, and the tag item is stored as an integer
                following the header.  Currently all integer items are four
                bytes.

Size: The minimum and maximum sizes of an item

ID  Type    Size  Description
--- ------- ----- ------------------------------------------------------------
01h String  4-256 Song name
02h String  4-256 Game name
03h String  4-256 Artist's name
04h String  4-256 Dumper's name
05h Integer 4     Date song was dumped (stored as yyyymmdd)
06h Length  1     Emulator used
07h String  4-256 Comments
10h String  4-256 Official Soundtrack Title
11h Length  1     OST disc
12h Length  2     OST track (upper byte is the number 0-99, lower byte is an
                  optional ASCII character)
13h String  4-256 Publisher's name
14h Length  2     Copyright year
30h Integer 4     Introduction length (Lengths are stored in ticks.  A tick is
31h Integer 4     Loop length          1/64000th of a second.  The maximum
32h Integer 4     End length           length is 383999999 ticks.  The End can
33h Integer 4     Fade length          contain a negative value.)
34h Length  1     Muted channels (a bit is set for each channel that's muted)
35h Length  1     Number of times to loop the loop section of the song
36h Integer 4     Amplification value to apply to output (65536 = Normal SNES)

This may seem like a messy way to implement a format, but I wanted to assure
something that would be easily expandible.

The source code to SNESAmp (available at http://www.alpha-ii.com) contains a
C++ class for reading and writing ID666 and xid6 tags.
*/

const didYouMean = require('./didYouMean')

// the extended (xid6) tags, by sub-chunk id, in the order they're written: what they're called in the metadata, and how they're stored: as a null-terminated string after the sub-chunk header ('string'), as a 16 bit value in the header itself ('length'), or as a 32 bit integer after the header ('integer')
//
// 0x01 to 0x04 and 0x07 are the full versions of standard tags that are too long for their ID666 field (`standard: true`): they're read as those tags, and only written when a tag doesn't fit in its field. Other ids (including 0x05 and 0x06, which only repeat what the ID666 tag holds) are read as unknown_ tags and written back as they were
const xid6Tags = {
  0x01: { name: 'songTitle', type: 'string', standard: true },
  0x02: { name: 'gameTitle', type: 'string', standard: true },
  0x03: { name: 'artist', type: 'string', standard: true },
  0x04: { name: 'dumper', type: 'string', standard: true },
  0x07: { name: 'comments', type: 'string', standard: true },
  0x10: { name: 'ost', type: 'string' },
  0x11: { name: 'ostDisc', type: 'length' },
  0x12: { name: 'ostTrack', type: 'length' },
  0x13: { name: 'publisherName', type: 'string' },
  0x14: { name: 'copyrightYear', type: 'length' },
  0x30: { name: 'introLength', type: 'integer' },
  0x31: { name: 'loopLength', type: 'integer' },
  0x32: { name: 'endLength', type: 'integer' },
  0x33: { name: 'fadeLength', type: 'integer' },
  0x34: { name: 'mutedChannels', type: 'length' },
  0x35: { name: 'loopCount', type: 'length' },
  0x36: { name: 'amplification', type: 'integer' }
}
const subChunkTypes = { string: 1, length: 0, integer: 4 }
const XID6_OFFSET = 0x10200 // where the xid6 chunk starts: right after the 64KB of RAM, the DSP registers, the unused space, and the extra RAM

// the standard ID666 tags that are strings, with where they start and how long they can be (the artist's start depends on the tag's format; see artistOffset())
const stringTags = [
  { name: 'songTitle', offset: 0x2E, length: 32 },
  { name: 'gameTitle', offset: 0x4E, length: 32 },
  { name: 'dumper', offset: 0x6E, length: 16 },
  { name: 'comments', offset: 0x7E, length: 32 },
  { name: 'dumpDate', offset: 0x9E, length: 11 },
  { name: 'artist', length: 32 }
]

// the names of all the tags that can be written, for checking for typos; lengthSeconds and fadeMilliseconds are read but not written
const tagNames = [...new Set([...stringTags.map(tag => tag.name), 'defaultChannelDisables', 'emulatorUsed', ...Object.values(xid6Tags).map(tag => tag.name)])]
const XID6_STRING_MAX = 255 // the longest an xid6 string can be, in bytes, leaving room for its null terminator
const readOnlyTagNames = ['lengthSeconds', 'fadeMilliseconds']

// read id666 tags from a given buffer
function readSPCID666Tags (buffer) {
  // check if the file is valid
  if (buffer.length >= 66048) {
    if (buffer.toString('ascii', 0, 33) !== 'SNES-SPC700 Sound File Data v0.30') {
      throw new Error('Invalid SPC file.')
    }
  }

  // read standard metadata
  const metadata = {}
  for (const tag of stringTags) {
    const offset = tag.offset ?? artistOffset(buffer)
    metadata[tag.name] = cleanString(decodeText(buffer.subarray(offset, offset + tag.length)))
  }
  const bytes = byteTagOffsets(buffer)
  Object.assign(metadata, {
    defaultChannelDisables: readByteTag(buffer, bytes.defaultChannelDisables),
    emulatorUsed: readByteTag(buffer, bytes.emulatorUsed),
    ...readSongLength(buffer)
  })

  // check for extended metadata (aka the "xid6" chunk)
  if (buffer.length >= XID6_OFFSET + 8 && buffer.toString('ascii', XID6_OFFSET, XID6_OFFSET + 4) === 'xid6') {
    const end = Math.min(XID6_OFFSET + 8 + buffer.readUInt32LE(XID6_OFFSET + 4), buffer.length) // the chunk's size doesn't include its 8 byte header
    let offset = XID6_OFFSET + 8

    // each sub-chunk has a 4 byte header: its id, its type, and a 16 bit value, which is either the data itself (type 0), or how long the data after the header is (any other type), which is padded to a multiple of 4 bytes
    while (offset + 4 <= end) {
      const subChunkID = buffer.readUInt8(offset)
      const subChunkType = buffer.readUInt8(offset + 1)
      const subChunkLength = buffer.readUInt16LE(offset + 2)
      if (subChunkType !== 0 && offset + 4 + subChunkLength > end) break // the chunk ends partway through this sub-chunk's data

      let subChunkData
      if (subChunkType === 0) { // this field is a length-only field
        subChunkData = subChunkLength
      } else if (subChunkType === 1) { // this field is a string
        subChunkData = cleanString(decodeText(buffer.subarray(offset + 4, offset + 4 + subChunkLength)))
      } else if (subChunkType === 4 && subChunkLength >= 4) { // this field is an integer
        subChunkData = buffer.readUInt32LE(offset + 4)
      } else { // a type this doesn't know, so its data is kept as it is
        subChunkData = Buffer.from(buffer.subarray(offset + 4, offset + 4 + subChunkLength))
      }
      offset += subChunkType === 0 ? 4 : (4 + subChunkLength + 3) & ~3

      // an empty sub-chunk header is padding, which is skipped
      if (!subChunkID && !subChunkType && !subChunkLength) continue

      // map sub-chunk id to extended metadata fields
      const tag = xid6Tags[subChunkID]
      if (!tag) {
        metadata[`unknown_${subChunkID}_type_${subChunkType}`] = subChunkData
      } else if (tag.name === 'ostTrack') {
        const upperByte = subChunkLength >> 8 // upper byte; track number
        const lowerByte = subChunkLength & 0xFF // lower byte; optional ascii character
        const lowerChar = (lowerByte >= 32 && lowerByte <= 126) ? String.fromCharCode(lowerByte) : '' // check if lowerByte is a printable ascii character
        metadata.ostTrack = `${upperByte}${lowerChar}` // combine the bytes into the final track value
      } else if (tag.standard) {
        if (subChunkData) metadata[tag.name] = subChunkData // the full version of a standard tag that didn't fit in its field
      } else if (['ost', 'ostDisc', 'publisherName', 'copyrightYear'].includes(tag.name)) {
        metadata[tag.name] = cleanString(subChunkData)
      } else {
        metadata[tag.name] = subChunkData
      }
    }
  }

  return metadata
}

// write id666 tags to a given buffer
function writeSPCID666Tags (buffer, newMetadata) {
  warnAboutUnknownTags(newMetadata)

  // read existing metadata
  const existingMetadata = readSPCID666Tags(buffer)

  // merge new metadata with existing metadata
  const metadata = { ...existingMetadata, ...newMetadata }

  // write standard ID666 fields, each cut off at its field's length, so it can't run into the next one (the full text of one that's too long goes in the xid6 chunk, below)
  for (const tag of stringTags) {
    const offset = tag.offset ?? artistOffset(buffer) // the artist goes where the tag's format keeps it
    buffer.fill(0, offset, offset + tag.length)
    encodeText(String(metadata[tag.name] ?? ''), tag.length).copy(buffer, offset)
  }
  const bytes = byteTagOffsets(buffer)
  writeByteTag(buffer, bytes.defaultChannelDisables, metadata.defaultChannelDisables || 0) // default to 0 if not provided
  writeByteTag(buffer, bytes.emulatorUsed, metadata.emulatorUsed || 0)

  // write extended metadata, as a sub-chunk for each tag that has a value (muted channels can also be 0)
  const subChunks = []
  for (const [id, { name, type, standard }] of Object.entries(xid6Tags)) {
    const value = metadata[name]
    if (!value && !(name === 'mutedChannels' && value === 0)) continue
    if (standard && encodeText(String(value)).length <= stringTags.find(tag => tag.name === name).length) continue // it fits in its ID666 field, so it isn't repeated here
    const header = Buffer.from([Number(id), subChunkTypes[type], 0, 0])

    if (type === 'string') {
      // the string, a null terminator, and 0s to pad it out to a multiple of 4 bytes; the header has its length, including the null terminator
      const string = encodeText(String(value), XID6_STRING_MAX)
      header.writeUInt16LE(string.length + 1, 2)
      subChunks.push(Buffer.concat([header, string, Buffer.alloc(4 - string.length % 4)]))
    } else if (type === 'integer') {
      // 4 bytes long, as the header says, and then the integer
      header.writeUInt16LE(4, 2)
      const integer = Buffer.alloc(4)
      integer.writeUInt32LE(parseInt(value, 10), 0)
      subChunks.push(Buffer.concat([header, integer]))
    } else if (name === 'ostTrack') {
      // the track number in the upper byte, and an optional printable ascii character after it in the lower byte; if it's anything else, it's just the numbers in it
      const match = String(value).match(/^(\d+)([\x20-\x7E]?)$/)
      const trackNumber = parseInt((match ? match[1] : String(value).replace(/\D/g, '')).match(/^(\d+)/)?.[1], 10)
      const asciiChar = match?.[2] ? match[2].charCodeAt(0) : 0
      header.writeUInt16LE((trackNumber << 8) | asciiChar, 2)
      subChunks.push(header)
    } else {
      // the value goes in the header itself
      header.writeUInt16LE(parseInt(value, 10), 2)
      subChunks.push(header)
    }
  }

  // and the sub-chunks this doesn't know (read as unknown_<id>_type_<type> tags), written back as they were read, so rewriting the chunk doesn't lose them
  for (const [key, value] of Object.entries(metadata)) {
    const match = key.match(/^unknown_(\d+)_type_(\d+)$/)
    if (!match || value === undefined || value === null) continue
    subChunks.push(unknownSubChunk(Number(match[1]), Number(match[2]), value))
  }

  if (subChunks.length) {
    // pad the end with 0s to make the last sub-chunk a multiple of 8 bytes long, as earlier versions have, so tags are written exactly as they were (they didn't pad it when the ost was the only sub-chunk)
    const lastSubChunk = subChunks.length === 1 && subChunks[0][0] === 0x10 ? Buffer.alloc(0) : subChunks[subChunks.length - 1]
    subChunks.push(Buffer.alloc((8 - lastSubChunk.length % 8) % 8))

    // the chunk header: "xid6", and the size of the sub-chunks
    const header = Buffer.from('xid6\0\0\0\0', 'ascii')
    header.writeUInt32LE(subChunks.reduce((size, subChunk) => size + subChunk.length, 0), 4)
    const xid6Chunk = Buffer.concat([header, ...subChunks])

    if (buffer.length >= XID6_OFFSET + 4 && buffer.toString('ascii', XID6_OFFSET, XID6_OFFSET + 4) === 'xid6') {
      // if the xid6 chunk exists, replace it, along with anything after it
      buffer = Buffer.concat([buffer.subarray(0, XID6_OFFSET), xid6Chunk])
    } else {
      // if the xid6 chunk does not exist, append it to the file
      buffer = Buffer.concat([buffer, xid6Chunk])
    }
  } else if (buffer.length >= XID6_OFFSET + 4 && buffer.toString('ascii', XID6_OFFSET, XID6_OFFSET + 4) === 'xid6') {
    // with no extended tags left, the xid6 chunk is removed, along with anything after it
    buffer = Buffer.from(buffer.subarray(0, XID6_OFFSET))
  }

  // return the modified file as a buffer
  return buffer
}

// warns (with a node warning, which can be silenced) about tags that would be ignored because they're misspelled, or can't be written; tags read from a file can all be written back, including ones this doesn't know (whose names start with unknown_), which are ignored
function warnAboutUnknownTags (metadata) {
  for (const name of Object.keys(metadata ?? {})) {
    if (tagNames.includes(name) || readOnlyTagNames.includes(name) || name.startsWith('unknown_')) continue
    const suggestion = didYouMean(name, tagNames)
    process.emitWarning(`spc-tag: ignoring unknown tag "${name}".${suggestion ? ` Did you mean "${suggestion}"?` : ''}`)
  }
}

// where the artist field starts: 0xB1 in the text format of the ID666 tag, and 0xB0 in the binary format
//
// the tag doesn't say which format it's in, so this goes by the byte at 0xB0, which in the text format is the last digit of the fade length (or the null after it), and in the binary format is the artist's first character; this is how game-music-emu tells them apart (see get_spc_info() in https://github.com/libgme/game-music-emu/blob/master/gme/Spc_Emu.cpp)
function artistOffset (buffer) {
  const byte = buffer.readUInt8(0xB0)
  return byte < 0x20 || (byte >= 0x30 && byte <= 0x39) ? 0xB1 : 0xB0
}

// how long the song plays before fading out (lengthSeconds) and how long it fades out for (fadeMilliseconds), from the ID666 tag, in either of its formats; each is null if the tag doesn't say, including when the file has no ID666 tag
//
// the length is 3 bytes at 0xA9, either digits (text format) or a number (binary format), and the fade is 5 digits at 0xAC (text) or a 4 byte number (binary). Which format the length is in is worked out the way game-music-emu does it (see get_spc_info() in https://github.com/libgme/game-music-emu/blob/master/gme/Spc_Emu.cpp), which handles the ambiguous cases real files have: it's read as digits, and if they aren't digits or come to 0 (or more than 0x1FFF seconds), as a 16 bit number instead; single digit text lengths are ignored, since they're almost always the first byte of a binary length, unless the artist field starts at 0xB1 as in the text format
function readSongLength (buffer) {
  if (buffer.length < 0xB2 || buffer.readUInt8(0x23) === 27) return { lengthSeconds: null, fadeMilliseconds: null } // 27 means there's no ID666 tag
  const isDigit = (byte) => byte >= 0x30 && byte <= 0x39

  let length = 0
  let textFormat = true
  for (let i = 0; i < 3; i++) {
    const byte = buffer.readUInt8(0xA9 + i)
    if (!isDigit(byte)) {
      if (i === 1 && (buffer.readUInt8(0xB0) || !buffer.readUInt8(0xB1))) length = 0
      break
    }
    length = length * 10 + byte - 0x30
  }
  if (!length || length > 0x1FFF) {
    length = buffer.readUInt16LE(0xA9)
    textFormat = false
  }
  const lengthSeconds = length > 0 && length < 0x1FFF ? length : null

  // the fade is in the same format as the length: digits up to a null in the text format, and a 32 bit number in the binary format. When there's no length to tell by, it's digits if it's all digits up to a null, and otherwise a number. It's only kept if it's under 10 minutes, since anything longer means it was read the wrong way
  const text = buffer.subarray(0xAC, 0xB1)
  const end = text.indexOf(0) === -1 ? text.length : text.indexOf(0)
  const digits = [...text.subarray(0, end)].every(isDigit)
  let fade
  if ((lengthSeconds !== null ? textFormat : digits && end > 0)) fade = digits && end > 0 ? Number(text.subarray(0, end).toString('ascii')) : null
  else fade = buffer.readUInt32LE(0xAC) || null
  const fadeMilliseconds = fade !== null && fade < 600000 ? fade : null

  return { lengthSeconds, fadeMilliseconds }
}

// a sub-chunk this doesn't know, from what was read from it: its value in the header (type 0), a string (type 1), a 32 bit integer (type 4), or its data as it was (any other type)
function unknownSubChunk (id, type, value) {
  const header = Buffer.from([id, type, 0, 0])
  if (type === 0) {
    header.writeUInt16LE(Number(value) & 0xFFFF, 2)
    return header
  }
  let data
  if (type === 1) data = Buffer.concat([encodeText(String(value), XID6_STRING_MAX), Buffer.alloc(1)]) // with its null terminator
  else if (type === 4 && typeof value === 'number') {
    data = Buffer.alloc(4)
    data.writeUInt32LE(value >>> 0, 0)
  } else data = Buffer.from(value)
  header.writeUInt16LE(data.length, 2)
  return Buffer.concat([header, data, Buffer.alloc((4 - data.length % 4) % 4)]) // padded to a multiple of 4 bytes
}

// where the channel disables and emulator tags are: one byte later in the text format of the ID666 tag (0xD1 and 0xD2) than in the binary format (0xD0 and 0xD1), after its longer artist field
function byteTagOffsets (buffer) {
  const text = artistOffset(buffer) === 0xB1
  return { defaultChannelDisables: text ? 0xD1 : 0xD0, emulatorUsed: text ? 0xD2 : 0xD1 }
}

// reads a one byte tag, which some tools (in the text format) store as an ascii digit rather than a number
function readByteTag (buffer, offset) {
  const byte = buffer.readUInt8(offset)
  return byte >= 0x30 && byte <= 0x39 ? byte - 0x30 : byte
}

// writes a one byte tag the way it was stored: as an ascii digit if it already was one, and otherwise as a number
function writeByteTag (buffer, offset, value) {
  const byte = buffer.readUInt8(offset)
  const asDigit = byte >= 0x30 && byte <= 0x39 && value >= 0 && value <= 9
  buffer.writeUInt8(asDigit ? 0x30 + Number(value) : Number(value), offset)
}

// the text in a tag: tags are meant to be ascii, but files use other encodings too (e.g. Shift JIS, for Japanese games), so text is read as utf-8 if it's valid utf-8 with characters outside of ascii, and otherwise as latin-1, which turns each byte into one character, so that writing it back (see encodeText()) gives back the same bytes whatever the encoding was
function decodeText (bytes) {
  if (bytes.some(byte => byte >= 0x80)) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch (error) {
      // not utf-8
    }
  }
  return Buffer.from(bytes).toString('latin1')
}

// the bytes to write for some text, at most maxLength of them: latin-1 if every character can be one, so text read with decodeText() goes back as it was, and otherwise utf-8, cut off only between characters
function encodeText (string, maxLength = Infinity) {
  const latin1 = ![...string].some(character => character.codePointAt(0) > 0xFF)
  const bytes = Buffer.from(string, latin1 ? 'latin1' : 'utf8')
  if (bytes.length <= maxLength) return bytes
  let end = maxLength
  if (!latin1) while (end > 0 && (bytes[end] & 0xC0) === 0x80) end-- // back to the start of the character that would be cut in two
  return bytes.subarray(0, end)
}

// removes padding from metadata extracted from id666 tags
function cleanString (string) {
  return String(string).trim().replace(/\0/g, '')
}

module.exports = {
  readSPCID666Tags,
  writeSPCID666Tags,
  tagNames,
  readOnlyTagNames
}
