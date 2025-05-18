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

// read id666 tags from a given buffer
function readSPCID666Tags (buffer) {
  // check if the file is valid
  if (buffer.length >= 66048) {
    if (buffer.toString('ascii', 0, 33) !== 'SNES-SPC700 Sound File Data v0.30') {
      throw new Error('Invalid SPC file.')
    }
  }

  // read standard metadata
  const metadata = {
    songTitle: cleanString(buffer.toString('ascii', 46, 78)),
    gameTitle: cleanString(buffer.toString('ascii', 78, 110)),
    dumper: cleanString(buffer.toString('ascii', 110, 126)),
    comments: cleanString(buffer.toString('ascii', 126, 158)),
    dumpDate: cleanString(buffer.toString('ascii', 158, 169)),
    artist: cleanString(buffer.toString('ascii', 177, 209)),
    defaultChannelDisables: buffer.readUInt8(0xD0),
    emulatorUsed: buffer.readUInt8(0xD1)
  }

  // check for extended metadata (aka the "xid6" chunk)
  if (buffer.length > 66048 + 4 && buffer.toString('ascii', 66048, 66052) === 'xid6') {
    const id666Length = buffer.readUInt32LE(66052)
    let bytesRead = 4

    if (buffer.length >= 66048 + 4 + id666Length && bytesRead < id666Length) {
      let offset = 66056
      const align = 4

      while (offset < buffer.length && bytesRead < id666Length) {
        const subChunkID = buffer.readUInt8(offset)
        const subChunkType = buffer.readUInt8(offset + 1)
        bytesRead += 2

        let subChunkData
        if (subChunkType === 1) { // this field is a string
          const subChunkLength = buffer.readUInt16LE(offset + 2)
          subChunkData = cleanString(buffer.toString('ascii', offset + 4, offset + 4 + subChunkLength))
          offset += 4 + subChunkLength
          bytesRead += 2 + subChunkLength
        } else if (subChunkType === 0) { // this field is a length-only field
          subChunkData = buffer.readUInt16LE(offset + 2)
          offset += 4
          bytesRead += 2
        } else if (subChunkType === 4) { // this field is an integer
          subChunkData = buffer.readUInt32LE(offset + 4)
          offset += 8
          bytesRead += 6
        }

        const offsetOld = offset
        offset = (offset + align - 1) & ~(align - 1)
        bytesRead += offset - offsetOld

        // map sub-chunk id to extended metadata fields
        switch (subChunkID) {
          case 16:
            metadata.ost = cleanString(subChunkData)
            break
          case 17:
            metadata.ostDisc = cleanString(subChunkData)
            break
          case 18: {
            const upperByte = buffer.readUInt8(offset - 1) // first byte (upper byte; track number)
            const lowerByte = buffer.readUInt8(offset - 2) // second byte (optional ascii character)
            const lowerChar = (lowerByte >= 32 && lowerByte <= 126) ? String.fromCharCode(lowerByte) : '' // check if lowerByte is a printable ascii character
            metadata.ostTrack = `${upperByte}${lowerChar}` // combine the bytes into the final track value
            break
          }
          case 19:
            metadata.publisherName = cleanString(subChunkData)
            break
          case 20:
            metadata.copyrightYear = cleanString(subChunkData)
            break
          case 48:
            metadata.introLength = subChunkData
            break
          case 49:
            metadata.loopLength = subChunkData
            break
          case 50:
            metadata.endLength = subChunkData
            break
          case 51:
            metadata.fadeLength = subChunkData
            break
          case 52:
            metadata.mutedChannels = subChunkData
            break
          case 53:
            metadata.loopCount = subChunkData
            break
          case 54:
            metadata.amplification = subChunkData
            break
          default:
            metadata[`unknown_${subChunkID}_type_${subChunkType}`] = subChunkData
        }
      }
    }
  }

  return metadata
}

// write id666 tags to a given buffer
function writeSPCID666Tags (buffer, newMetadata) {
  // read existing metadata
  const existingMetadata = readSPCID666Tags(buffer)

  // merge new metadata with existing metadata
  const metadata = { ...existingMetadata, ...newMetadata }

  // write standard ID666 fields
  buffer.write(metadata.songTitle.padEnd(32, '\0'), 0x2E, 'ascii')
  buffer.write(metadata.gameTitle.padEnd(32, '\0'), 0x4E, 'ascii')
  buffer.write(metadata.dumper.padEnd(16, '\0'), 0x6E, 'ascii')
  buffer.write(metadata.comments.padEnd(32, '\0'), 0x7E, 'ascii')
  buffer.write(metadata.dumpDate.padEnd(11, '\0'), 0x9E, 'ascii')
  buffer.write(metadata.artist.padEnd(32, '\0'), 0xB1, 'ascii')
  buffer.writeUInt8(metadata.defaultChannelDisables || 0, 0xD0) // default to 0 if not provided
  buffer.writeUInt8(metadata.emulatorUsed || 0, 0xD1) // default to 0 if not provided

  // write extended metadata
  let xid6ChunkHex = ''
  let newChunk

  if (metadata.ost) {
    newChunk = ''
    xid6ChunkHex += '10' // sub-chunk id for ost
    xid6ChunkHex += '01' // it's a null-terminated string

    // dynamically calculate the length of the string, e.g. '0e00'
    const stringLength = metadata.ost.length + 1 // include null terminator
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(stringLength, 0) // write the length in little-endian format
    xid6ChunkHex += lengthHex.toString('hex') // convert to hex and append

    // new string
    let newString = Buffer.from(metadata.ost, 'ascii').toString('hex') // new string converted to hex
    newString += '00' // add a null terminator

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newString.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // round up to the nearest number divisible by 4
    newString += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newString
  }

  if (metadata.ostDisc) {
    newChunk = ''
    newChunk += '11' // sub-chunk id for ost disc
    newChunk += '00' // it's a length-only field

    // new value
    const newValue = parseInt(metadata.ostDisc, 10) // convert to integer
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(newValue, 0) // write the length in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 8
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.ostTrack) {
    newChunk = ''
    newChunk += '12' // sub-chunk id for ost track
    newChunk += '00' // it's a length-only field

    // extract the track number and optional ascii character afterward
    const match = metadata.ostTrack.match(/^(\d+)([\x20-\x7E]?)$/) // match only printable ascii characters for the second part

    // if the input is invalid, default to just the numeric part
    if (!match) metadata.ostTrack = metadata.ostTrack.replace(/\D/g, '') // remove non-numeric characters

    // set track number and optional ascii character afterward
    const trackNumber = parseInt(metadata.ostTrack.match(/^(\d+)/)?.[1], 10) // extract the numeric part
    const asciiChar = match?.[2] ? match[2].charCodeAt(0) : 0 // extract the ascii character (or 0 if none)

    // write the 2-byte value (track number + ascii character) in little-endian format
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes
    lengthHex.writeUInt16LE((trackNumber << 8) | asciiChar, 0) // combine trackNumber and asciiChar into a single 16-bit value
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.publisherName) {
    newChunk = ''
    newChunk += '13' // sub-chunk id for publisher
    newChunk += '01' // it's a null-terminated string

    // dynamically calculate the length of the string, e.g. '0e00'
    const stringLength = metadata.publisherName.length + 1 // include null terminator
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(stringLength, 0) // write the length in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // new string
    let newString = Buffer.from(metadata.publisherName, 'ascii').toString('hex') // new string converted to hex
    newString += '00' // add a null terminator

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newString.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // round up to the nearest number divisible by 4
    newString += '00'.repeat(paddingNeeded) // add padding
    newChunk += newString

    xid6ChunkHex += newChunk
  }

  if (metadata.copyrightYear) {
    newChunk = ''
    newChunk += '14' // sub-chunk id for copyright year
    newChunk += '00' // it's a length-only field

    // new value
    const newValue = parseInt(metadata.copyrightYear, 10) // convert to integer
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(newValue, 0) // write the length in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.introLength) {
    newChunk = ''
    newChunk += '30' // sub-chunk id for intro length
    newChunk += '04' // it's an integer field
    newChunk += '0400' // encode length of the integer field

    // new value
    const lengthHex = Buffer.alloc(4) // allocate 4 bytes for the integer
    lengthHex.writeUInt32LE(parseInt(metadata.introLength, 10), 0) // write the value in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.loopLength) {
    newChunk = ''
    newChunk += '31' // sub-chunk id for loop length
    newChunk += '04' // it's an integer field
    newChunk += '0400' // encode length of the integer field

    // new value
    const lengthHex = Buffer.alloc(4) // allocate 4 bytes for the integer
    lengthHex.writeUInt32LE(parseInt(metadata.loopLength, 10), 0) // write the value in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.endLength) {
    newChunk = ''
    newChunk += '32' // sub-chunk id for end length
    newChunk += '04' // it's an integer field
    newChunk += '0400' // encode length of the integer field

    // new value
    const lengthHex = Buffer.alloc(4) // allocate 4 bytes for the integer
    lengthHex.writeUInt32LE(parseInt(metadata.endLength, 10), 0) // write the value in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.fadeLength) {
    newChunk = ''
    newChunk += '33' // sub-chunk id for fade length
    newChunk += '04' // it's an integer field
    newChunk += '0400' // encode length of the integer field

    // new value
    const lengthHex = Buffer.alloc(4) // allocate 4 bytes for the integer
    lengthHex.writeUInt32LE(parseInt(metadata.fadeLength, 10), 0) // write the value in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.mutedChannels || metadata.mutedChannels === 0) {
    newChunk = ''
    newChunk += '34' // sub-chunk id for muted channels
    newChunk += '00' // it's a length-only field

    // new value
    const newValue = parseInt(metadata.mutedChannels, 10) // convert to integer
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(newValue, 0) // write the length in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.loopCount) {
    newChunk = ''
    newChunk += '35' // sub-chunk id for loop count
    newChunk += '00' // it's a length-only field

    // new value
    const newValue = parseInt(metadata.loopCount, 10) // convert to integer
    const lengthHex = Buffer.alloc(2) // allocate 2 bytes for the length
    lengthHex.writeUInt16LE(newValue, 0) // write the length in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (metadata.amplification) {
    newChunk = ''
    newChunk += '36' // sub-chunk id for amplification
    newChunk += '04' // it's an integer field
    newChunk += '0400' // encode length of the integer field

    // new value
    const lengthHex = Buffer.alloc(4) // allocate 4 bytes for the integer
    lengthHex.writeUInt32LE(parseInt(metadata.amplification, 10), 0) // write the value in little-endian format
    newChunk += lengthHex.toString('hex') // convert to hex and append

    // pad the end of the string with 0s so the whole chunk is a multiple of 4 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (4 - (totalLength % 4)) % 4 // calculate padding to make it a multiple of 4
    newChunk += '00'.repeat(paddingNeeded) // add padding

    xid6ChunkHex += newChunk
  }

  if (xid6ChunkHex) {
    // calculate padding to make the last sub-chunk 8 bytes long
    const totalLength = newChunk.length / 2 // each hex character represents half a byte
    const paddingNeeded = (8 - (totalLength % 8)) % 8 // calculate padding to make it a multiple of 8
    xid6ChunkHex += '00'.repeat(paddingNeeded) // add padding

    // write chunk length marker, e.g. 14000000
    let xid6ChunkLengthMarker = xid6ChunkHex.length / 2 // every 2 characters is a byte
    xid6ChunkLengthMarker = (xid6ChunkLengthMarker + 3) & ~3 // round up to the nearest number divisible by 4
    xid6ChunkLengthMarker = xid6ChunkLengthMarker.toString(16) // convert it to hex
    xid6ChunkLengthMarker = xid6ChunkLengthMarker.padStart(2, '0') // pad the start with 0 if needed
    xid6ChunkLengthMarker = xid6ChunkLengthMarker.padEnd(8, '0') // pad the end with 0s
    xid6ChunkLengthMarker = '78696436' + xid6ChunkLengthMarker // prepend the xid6 chunk marker
    xid6ChunkHex = xid6ChunkLengthMarker + xid6ChunkHex

    const xid6Chunk = Buffer.from(xid6ChunkHex, 'hex')

    // locate the xid6 chunk
    const xid6Offset = buffer.indexOf('xid6', 0x101C0)
    if (xid6Offset === -1) {
      // if xid6 chunk does not exist, append it to the file
      buffer = Buffer.concat([buffer, xid6Chunk])
    } else {
      // if xid6 chunk exists, replace it with the reduced chunk
      const xid6Size = buffer.readUInt32BE(xid6Offset + 4)
      buffer = Buffer.concat([
        buffer.slice(0, xid6Offset), // data before xid6
        xid6Chunk, // xid6 marker
        buffer.slice(xid6Offset + 8 + xid6Size) // data after xid6
      ])
    }
  }

  // return the modified file as a buffer
  return buffer
}

// removes padding from metadata extracted from id666 tags
function cleanString (string) {
  return String(string).trim().replace(/\0/g, '')
}

module.exports = {
  readSPCID666Tags,
  writeSPCID666Tags
}
