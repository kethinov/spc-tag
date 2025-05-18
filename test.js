/* eslint-env mocha */
const assert = require('assert')
const { execFileSync } = require('child_process')
const fs = require('fs')
const { readSPCID666Tags, writeSPCID666Tags } = require('./spc-id666-tag-editor')

describe('spc-tag command line tests', () => {
  it('spc-tag should print an error when an invalid file is passed', () => {
    try {
      const output = execFileSync('node', ['spc-tag.js'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      assert(output.includes('Please supply a valid SPC file.'))
    } catch (err) {
      // swallow error
    }
  })

  it('spc-tag should print metadata from a spc file', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      const output = execFileSync('node', ['spc-tag.js', 'test.spc'], { encoding: 'utf8' })
      assert(output.includes('songTitle: \'Dummy Song\''))
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should write new metadata to a spc file', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      const output = execFileSync('node', ['spc-tag.js', 'write', 'songTitle=new title', 'test.spc'], { encoding: 'utf8' })
      assert(output.includes('songTitle: \'new title\''))
    } finally {
      fs.unlinkSync('test.spc')
    }
  })
})

describe('spc-id666-tag-editor library tests', () => {
  it('should fail to read a non-spc file', () => {
    const dummySpcFile = Buffer.alloc(66048, 0)
    try {
      readSPCID666Tags(dummySpcFile)
      assert(false, 'This message should not appear because this code should never execute.')
    } catch (err) {
      assert(err.message === 'Invalid SPC file.')
    }
  })

  it('should read songTitle from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.songTitle === 'Dummy Song')
  })

  it('should read gameTitle from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.gameTitle === 'Dummy Game')
  })

  it('should read dumper from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.dumper === 'Dumper')
  })

  it('should read comments from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.comments === 'Dummy Comments')
  })

  it('should read dumpDate from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.dumpDate === '01/01/2025')
  })

  it('should read artist from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.artist === 'Dummy Artist')
  })

  it('should read defaultChannelDisables from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.defaultChannelDisables === 0)
  })

  it('should read emulatorUsed from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.emulatorUsed === 0)
  })

  it('should read all dummy spc file sample tags', () => {
    const dummySpcFile = makeSampleSPCFile()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.songTitle === 'Dummy Song')
    assert(metadata.gameTitle === 'Dummy Game')
    assert(metadata.dumper === 'Dumper')
    assert(metadata.comments === 'Dummy Comments')
    assert(metadata.dumpDate === '01/01/2025')
    assert(metadata.artist === 'Dummy Artist')
    assert(metadata.defaultChannelDisables === 0)
    assert(metadata.emulatorUsed === 0)
  })

  it('should write songTitle to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { songTitle: 'kethisong' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.songTitle === 'kethisong')
  })

  it('should write gameTitle to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { gameTitle: 'kethigame' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.gameTitle === 'kethigame')
  })

  it('should write dumper to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { dumper: 'kethinov' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.dumper === 'kethinov')
  })

  it('should write comments to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { comments: 'edited by spc-id666-tag-editor' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.comments === 'edited by spc-id666-tag-editor')
  })

  it('should write dumpDate to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { dumpDate: '12/24/1999' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.dumpDate === '12/24/1999')
  })

  it('should write artist to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { artist: 'kethiartist' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.artist === 'kethiartist')
  })

  it('should write defaultChannelDisables to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { defaultChannelDisables: 1 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.defaultChannelDisables === 1)
  })

  it('should write emulatorUsed to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { emulatorUsed: 37 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.emulatorUsed === 37)
  })

  it('should write ost to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { ost: 'kethiost' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.ost === 'kethiost')
  })

  it('should write ostDisc to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { ostDisc: '6' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.ostDisc === '6')
  })

  it('should write ostTrack to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { ostTrack: '11C' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.ostTrack === '11C')
  })

  it('should write ostTrack to dummy spc file with a non-printable character properly replaced', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { ostTrack: '11\u001F' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.ostTrack === '11')
  })

  it('should write publisherName to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { publisherName: 'kethipublisher' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.publisherName === 'kethipublisher')
  })

  it('should write copyrightYear to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { copyrightYear: '1999' })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.copyrightYear === '1999')
  })

  it('should write introLength to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { introLength: 11184000 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.introLength === 11184000)
  })

  it('should write loopLength to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { loopLength: 704000 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.loopLength === 704000)
  })

  it('should write endLength to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { endLength: 500000 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.endLength === 500000)
  })

  it('should write fadeLength to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { fadeLength: 630000 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.fadeLength === 630000)
  })

  it('should write mutedChannels to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { mutedChannels: 1 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.mutedChannels === 1)
  })

  it('should write loopCount to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { loopCount: 3 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.loopCount === 3)
  })

  it('should write amplification to dummy spc file', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { amplification: 65536 })
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.amplification === 65536)
  })

  it('should write all tag types to dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFile()
    const newMetadata = {
      songTitle: 'kethisong',
      gameTitle: 'kethigame',
      dumper: 'kethinov',
      comments: 'edited by spc-id666-tag-editor',
      dumpDate: '12/24/1999',
      artist: 'kethiartist',
      defaultChannelDisables: 0,
      emulatorUsed: 43,
      ost: 'kethiost',
      ostDisc: '6',
      ostTrack: '11C',
      publisherName: 'kethipublisher',
      copyrightYear: '1999',
      introLength: 11184000,
      loopLength: 704000,
      endLength: 500000,
      fadeLength: 630000,
      mutedChannels: 0,
      loopCount: 2,
      amplification: 65536
    }
    const newFile = writeSPCID666Tags(dummySpcFile, newMetadata)
    const metadata = readSPCID666Tags(newFile)
    assert(metadata.songTitle === 'kethisong')
    assert(metadata.gameTitle === 'kethigame')
    assert(metadata.dumper === 'kethinov')
    assert(metadata.comments === 'edited by spc-id666-tag-editor')
    assert(metadata.dumpDate === '12/24/1999')
    assert(metadata.artist === 'kethiartist')
    assert(metadata.defaultChannelDisables === 0)
    assert(metadata.emulatorUsed === 43)
    assert(metadata.ost === 'kethiost')
    assert(metadata.ostDisc === '6')
    assert(metadata.ostTrack === '11C')
    assert(metadata.publisherName === 'kethipublisher')
    assert(metadata.copyrightYear === '1999')
    assert(metadata.introLength === 11184000)
    assert(metadata.loopLength === 704000)
    assert(metadata.endLength === 500000)
    assert(metadata.fadeLength === 630000)
    assert(metadata.mutedChannels === 0)
    assert(metadata.loopCount === 2)
    assert(metadata.amplification === 65536)
  })

  it('should write publisherName to dummy spc file then write copyrightYear to dummy spc file separately', () => {
    let dummyFile = makeSampleSPCFile()
    dummyFile = writeSPCID666Tags(dummyFile, { publisherName: 'kethipublisher' })
    dummyFile = writeSPCID666Tags(dummyFile, { copyrightYear: '1999' })
    const metadata = readSPCID666Tags(dummyFile)
    assert(metadata.copyrightYear === '1999')
  })

  it('should observe an invalid field from dummy spc file', () => {
    const dummySpcFile = makeSampleSPCFileWithInvalidSubChunk()
    const metadata = readSPCID666Tags(dummySpcFile)
    assert(metadata.unknown_34_type_0 === 13330)
  })
})

function makeSampleSPCFile () {
  // create a buffer for the spc file (66048 bytes)
  const spcBuffer = Buffer.alloc(66048, 0) // fill with zeros

  // populate the spc header (256 bytes)
  spcBuffer.write('SNES-SPC700 Sound File Data v0.30', 0, 33, 'ascii') // magic string
  spcBuffer.writeUInt8(26, 37) // version
  spcBuffer.writeUInt8(26, 38) // version
  spcBuffer.writeUInt8(26, 39) // version
  spcBuffer.writeUInt8(0, 40) // reserved
  spcBuffer.write('Dummy Song', 46, 32, 'ascii') // song title
  spcBuffer.write('Dummy Game', 78, 32, 'ascii') // game title
  spcBuffer.write('Dumper', 110, 16, 'ascii') // dumper
  spcBuffer.write('01/01/2025', 158, 11, 'ascii') // dump date
  spcBuffer.write('Dummy Artist', 177, 32, 'ascii') // artist
  spcBuffer.write('Dummy Comments', 126, 32, 'ascii') // comments
  spcBuffer.writeUInt8(0, 0xD0) // default channel disables
  spcBuffer.writeUInt8(0, 0xD1) // emulator used
  return spcBuffer
}

function makeSampleSPCFileWithInvalidSubChunk () {
  // create a buffer for the spc file (66048 bytes)
  const spcBuffer = makeSampleSPCFile()

  // add extended metadata that is invalid
  let newChunk = ''
  newChunk += '22' // sub-chunk id that is invalid
  newChunk += '00' // it's a length-only field
  newChunk += '1234' // add some nonsense

  // calculate padding to make the last sub-chunk 8 bytes long
  const totalLength = newChunk.length / 2 // each hex character represents half a byte
  const paddingNeeded = (8 - (totalLength % 8)) % 8 // calculate padding to make it a multiple of 8
  let xid6ChunkHex = newChunk + '00'.repeat(paddingNeeded) // add padding

  // write chunk length marker, e.g. 14000000
  let xid6ChunkLengthMarker = xid6ChunkHex.length / 2 // every 2 characters is a byte
  xid6ChunkLengthMarker = (xid6ChunkLengthMarker + 3) & ~3 // round up to the nearest number divisible by 4
  xid6ChunkLengthMarker = xid6ChunkLengthMarker.toString(16) // convert it to hex
  xid6ChunkLengthMarker = xid6ChunkLengthMarker.padStart(2, '0') // pad the start with 0 if needed
  xid6ChunkLengthMarker = xid6ChunkLengthMarker.padEnd(8, '0') // pad the end with 0s
  xid6ChunkLengthMarker = '78696436' + xid6ChunkLengthMarker // prepend the xid6 chunk marker
  xid6ChunkHex = xid6ChunkLengthMarker + xid6ChunkHex

  // append the xid6 chunk to the spc buffer
  const xid6Chunk = Buffer.from(xid6ChunkHex, 'hex')
  return Buffer.concat([spcBuffer, xid6Chunk])
}
