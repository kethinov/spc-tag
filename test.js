const { describe, it } = require('node:test')
const assert = require('node:assert')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const { readSPCID666Tags, writeSPCID666Tags } = require('./spc-id666-tag-editor')
const didYouMean = require('./didYouMean')

// runs the command line program, returning its exit code and what it printed
function spcTag (...args) {
  // without colors, which node adds to what's printed when FORCE_COLOR is set (as some terminals and ci services do), so the output can be checked as plain text
  const env = { ...process.env, NO_COLOR: '1' }
  delete env.FORCE_COLOR
  const { status, stdout, stderr } = spawnSync(process.execPath, ['spc-tag.js', ...args], { encoding: 'utf8', env })
  return { status, stdout, stderr }
}

describe('spc-tag command line tests', () => {
  it('spc-tag should print an error when an invalid file is passed', () => {
    const { status, stderr } = spcTag()
    assert.strictEqual(status, 1)
    assert(stderr.includes('Please supply a valid SPC file.'))
  })

  it('spc-tag should print an error when the file does not exist', () => {
    const { status, stderr } = spcTag('nonexistent.spc')
    assert.strictEqual(status, 1)
    assert(stderr.includes('File not found: nonexistent.spc'))
  })

  it('spc-tag should print an error when the file is not an SPC file', () => {
    fs.writeFileSync('test.spc', Buffer.alloc(66048, 0))
    try {
      const { status, stderr } = spcTag('test.spc')
      assert.strictEqual(status, 1)
      assert(stderr.includes('Invalid SPC file.'))
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should print metadata from a spc file', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      const { stdout } = spcTag('test.spc')
      assert(stdout.includes('songTitle: \'Dummy Song\''))
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should write new metadata to a spc file', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      const { stdout } = spcTag('write', 'songTitle=new title', 'test.spc')
      assert(stdout.includes('songTitle: \'new title\''))
      assert.strictEqual(readSPCID666Tags(fs.readFileSync('test.spc')).songTitle, 'new title')
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should write several tags at once, with values that have = in them', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      spcTag('write', 'songTitle=a=b', 'publisherName=kethipublisher', 'test.spc')
      const metadata = readSPCID666Tags(fs.readFileSync('test.spc'))
      assert.strictEqual(metadata.songTitle, 'a=b')
      assert.strictEqual(metadata.publisherName, 'kethipublisher')
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should suggest the tag that was meant when one is misspelled, without writing anything', () => {
    fs.writeFileSync('test.spc', makeSampleSPCFile())
    try {
      const { status, stderr } = spcTag('write', 'songTitel=new title', 'test.spc')
      assert.strictEqual(status, 1)
      assert(stderr.includes('Unknown tag "songTitel". Did you mean "songTitle"?'))
      assert(fs.readFileSync('test.spc').equals(makeSampleSPCFile()))
    } finally {
      fs.unlinkSync('test.spc')
    }
  })

  it('spc-tag should print an error for a tag that is nothing like any of them', () => {
    const { status, stderr } = spcTag('write', 'favoriteColor=blue', 'test.spc')
    assert.strictEqual(status, 1)
    assert(stderr.includes('Unknown tag "favoriteColor".'))
    assert(!stderr.includes('Did you mean'))
  })

  it('spc-tag should print an error for a tag that can be read but not written', () => {
    const { status, stderr } = spcTag('write', 'lengthSeconds=100', 'test.spc')
    assert.strictEqual(status, 1)
    assert(stderr.includes('"lengthSeconds" can be read, but not written.'))
  })

  it('spc-tag should print an error for a tag without a value', () => {
    const { status, stderr } = spcTag('write', 'songTitle', 'test.spc')
    assert.strictEqual(status, 1)
    assert(stderr.includes('Please supply a value for "songTitle"'))
  })

  it('spc-tag should suggest the command that was meant when one is misspelled', () => {
    const { status, stderr } = spcTag('wirte', 'songTitle=new title', 'test.spc')
    assert.strictEqual(status, 1)
    assert(stderr.includes('Unknown command "wirte". Did you mean "write"?'))
  })
})

describe('did you mean tests', () => {
  it('should measure the Levenshtein distance between two strings', () => {
    assert.strictEqual(didYouMean.levenshtein('kitten', 'sitting'), 3)
    assert.strictEqual(didYouMean.levenshtein('', 'abc'), 3)
    assert.strictEqual(didYouMean.levenshtein('abc', ''), 3)
    assert.strictEqual(didYouMean.levenshtein('same', 'same'), 0)
    assert.strictEqual(didYouMean.levenshtein('lenght', 'length'), 2) // a swap is two substitutions
  })

  it('should suggest the closest choice, ignoring case, if it\'s close enough to be a typo', () => {
    assert.strictEqual(didYouMean('songtitle', ['songTitle', 'gameTitle']), 'songTitle')
    assert.strictEqual(didYouMean('gameTitel', ['songTitle', 'gameTitle']), 'gameTitle')
    assert.strictEqual(didYouMean('wirte', ['write']), 'write')
    assert.strictEqual(didYouMean('favoriteColor', ['songTitle', 'gameTitle']), undefined)
    assert.strictEqual(didYouMean('x', ['write']), undefined)
  })
})

describe('spc-id666-tag-editor library tests', () => {
  it('should fail to read a non-spc file', () => {
    assert.throws(() => readSPCID666Tags(Buffer.alloc(66048, 0)), { message: 'Invalid SPC file.' })
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

  it('should read the song length and fade from a text format tag', () => {
    const dummySpcFile = makeSampleSPCFile()
    dummySpcFile.write('144', 0xA9, 'ascii')
    dummySpcFile.write('7000', 0xAC, 'ascii')
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.lengthSeconds, 144)
    assert.strictEqual(metadata.fadeMilliseconds, 7000)
  })

  it('should read the song length, fade, and artist from a binary format tag', () => {
    const dummySpcFile = makeSampleBinarySPCFile({ lengthSeconds: 154, fadeMilliseconds: 7680, artist: 'Binary Artist' })
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.lengthSeconds, 154)
    assert.strictEqual(metadata.fadeMilliseconds, 7680) // stored as 00 1E 00 00, so its first byte is a null
    assert.strictEqual(metadata.artist, 'Binary Artist')
  })

  it('should ignore a single digit text length, which is almost always the first byte of a binary length', () => {
    const dummySpcFile = makeSampleBinarySPCFile({ lengthSeconds: 0x0135, fadeMilliseconds: 5000, artist: 'Binary Artist' }) // 0x35 is the digit 5
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.lengthSeconds, 0x0135)
  })

  it('should read no song length or fade from a file without an ID666 tag', () => {
    const dummySpcFile = makeSampleSPCFile()
    dummySpcFile.write('144', 0xA9, 'ascii')
    dummySpcFile.writeUInt8(27, 0x23) // 27 means there's no ID666 tag
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.lengthSeconds, null)
    assert.strictEqual(metadata.fadeMilliseconds, null)
  })

  it('should read no song length or fade from a tag that leaves them empty', () => {
    const metadata = readSPCID666Tags(makeSampleSPCFile())
    assert.strictEqual(metadata.lengthSeconds, null)
    assert.strictEqual(metadata.fadeMilliseconds, null)
  })

  it('should write the artist where a binary format tag keeps it, leaving the fade length alone', () => {
    const dummySpcFile = writeSPCID666Tags(makeSampleBinarySPCFile({ lengthSeconds: 154, fadeMilliseconds: 7680, artist: 'Binary Artist' }), { artist: 'New Artist' })
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.artist, 'New Artist')
    assert.strictEqual(metadata.fadeMilliseconds, 7680)
  })
  it('should write the xid6 chunk exactly as earlier versions have', () => {
    // the bytes after the 64KB of RAM etc., as version 1.0.3 wrote them
    const xid6 = (metadata) => writeSPCID666Tags(makeSampleSPCFile(), metadata).subarray(66048).toString('hex')
    assert.strictEqual(xid6({ ost: 'kethiost', ostDisc: '6', ostTrack: '11C', publisherName: 'kethipublisher', copyrightYear: '1999', introLength: 11184000, loopLength: 704000, endLength: 500000, fadeLength: 630000, mutedChannels: 0, loopCount: 2, amplification: 65536 }), '7869643660000000100109006b657468696f737400000000110006001200430b13010f006b657468697075626c697368657200001400cf073004040080a7aa003104040000be0a003204040020a1070033040400f09c090034000000350002003604040000000100')
    assert.strictEqual(xid6({ ostDisc: '6' }), '78696436080000001100060000000000') // the last sub-chunk is padded out to 8 bytes
    assert.strictEqual(xid6({ ost: 'abcd' }), '786964360c000000100105006162636400000000') // except when the ost is the only one
    assert.strictEqual(xid6({ publisherName: 'abc', mutedChannels: 0 }), '786964361000000013010400616263003400000000000000')
    assert.strictEqual(xid6({}), '') // no xid6 chunk at all
  })

  it('should write the size of an xid6 chunk of 256 bytes or more', () => {
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { ost: 'o'.repeat(200), publisherName: 'p'.repeat(100), copyrightYear: '1999' })
    assert.strictEqual(newFile.readUInt32LE(66052), newFile.length - 66056)
    const metadata = readSPCID666Tags(newFile)
    assert.strictEqual(metadata.publisherName, 'p'.repeat(100))
    assert.strictEqual(metadata.copyrightYear, '1999')
  })

  it('should replace an existing xid6 chunk', () => {
    let dummyFile = writeSPCID666Tags(makeSampleSPCFile(), { ost: 'o'.repeat(200), publisherName: 'p'.repeat(100) })
    dummyFile = writeSPCID666Tags(dummyFile, { ost: 'short', publisherName: '' })
    assert.strictEqual(dummyFile.subarray(66048).toString('hex'), '786964360c0000001001060073686f7274000000')
    assert.strictEqual(readSPCID666Tags(dummyFile).ost, 'short')
  })

  it('should cut off standard tags that are too long at their field\'s length, rather than overwriting the next field', () => {
    const dummySpcFile = makeSampleSPCFile()
    dummySpcFile.write('144', 0xA9, 'ascii')
    const written = writeSPCID666Tags(dummySpcFile, { dumpDate: '12/24/1999 and a lot more', songTitle: 's'.repeat(40) })
    const metadata = readSPCID666Tags(written)
    assert.strictEqual(metadata.dumpDate, '12/24/1999') // the space after it is trimmed off
    assert.strictEqual(metadata.lengthSeconds, 144)
    assert.strictEqual(written.toString('latin1', 0x2E, 0x4E), 's'.repeat(32)) // the song title's field holds as much as fits
    assert.strictEqual(metadata.songTitle, 's'.repeat(40)) // and the whole of it is kept in the xid6 chunk (see the test of long tags)
    assert.strictEqual(metadata.gameTitle, 'Dummy Game')
  })

  it('should keep the whole of a standard tag that\'s too long for its field in the xid6 chunk, and read it from there', () => {
    const title = 'A Very Long Song Title That Does Not Fit In Thirty Two Bytes'
    const written = writeSPCID666Tags(makeSampleSPCFile(), { songTitle: title, artist: 'Short Artist' })
    assert.strictEqual(written.toString('ascii', 0x10200, 0x10204), 'xid6')
    assert.strictEqual(written.readUInt8(0x10208), 0x01) // the song title's sub-chunk
    assert.strictEqual(readSPCID666Tags(written).songTitle, title)
    assert.strictEqual(readSPCID666Tags(written).artist, 'Short Artist')
    // once it fits again, it's only in its field
    const shortened = writeSPCID666Tags(written, { songTitle: 'Short Title' })
    assert.strictEqual(readSPCID666Tags(shortened).songTitle, 'Short Title')
    assert.strictEqual(shortened.length, 66048) // and with nothing else in the xid6 chunk, the chunk is gone
  })

  it('should read and write tags in encodings other than ascii without changing their bytes', () => {
    // a Shift JIS title (チャイム, which isn't valid utf-8), read as latin-1 and written back as the same bytes
    const shiftJis = Buffer.from([0x83, 0x60, 0x83, 0x83, 0x83, 0x43, 0x83, 0x80])
    const dummySpcFile = makeSampleSPCFile()
    dummySpcFile.fill(0, 0x2E, 0x4E)
    shiftJis.copy(dummySpcFile, 0x2E)
    const metadata = readSPCID666Tags(dummySpcFile)
    const written = writeSPCID666Tags(dummySpcFile, metadata)
    assert.deepStrictEqual(written.subarray(0x2E, 0x2E + shiftJis.length), shiftJis)
    // latin-1 text, such as accented letters, is written as latin-1
    const accented = writeSPCID666Tags(makeSampleSPCFile(), { gameTitle: 'Pokémon Café' })
    assert.deepStrictEqual(accented.subarray(0x4E, 0x4E + 12), Buffer.from('Pokémon Café', 'latin1'))
    assert.strictEqual(readSPCID666Tags(accented).gameTitle, 'Pokémon Café')
    // and text that can't be latin-1 is written as utf-8, cut off between characters rather than in the middle of one
    const japanese = writeSPCID666Tags(makeSampleSPCFile(), { dumper: 'クロノトリガー' }) // 21 bytes of utf-8, in a 16 byte field
    assert.strictEqual(japanese.toString('utf8', 0x6E, 0x6E + 15), 'クロノトリ') // 15 bytes: 5 whole characters
    assert.strictEqual(japanese.readUInt8(0x6E + 15), 0)
    assert.strictEqual(readSPCID666Tags(japanese).dumper, 'クロノトリガー') // the whole of it, from the xid6 chunk
  })

  it('should read and write the channel disables and emulator where the tag\'s format keeps them', () => {
    // in the text format, they're at 0xD1 and 0xD2, after the artist's 32 bytes at 0xB1, and some tools store them as ascii digits
    const text = makeSampleSPCFile()
    text.write('144', 0xA9, 'ascii')
    text.write('Text Artist'.padEnd(32, 'x'), 0xB1, 'latin1') // an artist that fills its field, up to 0xD0
    text.write('1', 0xD2, 'ascii') // ZSNES, as a digit
    assert.strictEqual(readSPCID666Tags(text).emulatorUsed, 1)
    const writtenText = writeSPCID666Tags(text, { emulatorUsed: 2, defaultChannelDisables: 1 })
    assert.strictEqual(writtenText.toString('ascii', 0xD2, 0xD3), '2') // still a digit
    assert.strictEqual(writtenText.readUInt8(0xD1), 1)
    assert.strictEqual(readSPCID666Tags(writtenText).artist, 'Text Artist'.padEnd(32, 'x')) // the artist's last character is untouched
    // in the binary format, they're at 0xD0 and 0xD1
    const binary = writeSPCID666Tags(makeSampleBinarySPCFile({ lengthSeconds: 154, fadeMilliseconds: 7680, artist: 'Binary Artist' }), { emulatorUsed: 2, defaultChannelDisables: 1 })
    assert.strictEqual(binary.readUInt8(0xD0), 1)
    assert.strictEqual(binary.readUInt8(0xD1), 2)
    assert.deepStrictEqual([readSPCID666Tags(binary).defaultChannelDisables, readSPCID666Tags(binary).emulatorUsed], [1, 2])
  })

  it('should keep xid6 sub-chunks it doesn\'t know when writing', () => {
    const dummySpcFile = writeSPCID666Tags(makeSampleSPCFileWithInvalidSubChunk(), { publisherName: 'kethipublisher' })
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.unknown_34_type_0, 13330)
    assert.strictEqual(metadata.publisherName, 'kethipublisher')
    // including dates (0x05), strings, and data of types it doesn't know
    const withMore = writeSPCID666Tags(makeSampleSPCFile(), { unknown_5_type_4: 20250101, unknown_32_type_1: 'some text', unknown_33_type_2: Buffer.from([1, 2, 3]) })
    const readBack = readSPCID666Tags(withMore)
    assert.strictEqual(readBack.unknown_5_type_4, 20250101)
    assert.strictEqual(readBack.unknown_32_type_1, 'some text')
    assert.deepStrictEqual(readBack.unknown_33_type_2, Buffer.from([1, 2, 3]))
  })

  it('should remove the xid6 chunk when every extended tag is emptied', () => {
    const tagged = writeSPCID666Tags(makeSampleSPCFile(), { publisherName: 'kethipublisher', introLength: 64000 })
    assert.strictEqual(tagged.toString('ascii', 0x10200, 0x10204), 'xid6')
    const emptied = writeSPCID666Tags(tagged, { publisherName: '', introLength: 0 })
    assert.strictEqual(emptied.length, 66048)
    assert.strictEqual(readSPCID666Tags(emptied).publisherName, undefined)
  })

  it('should read a length-only sub-chunk at the very end of an xid6 chunk', () => {
    // as other programs write them, with no padding after the last sub-chunk
    const dummySpcFile = Buffer.concat([makeSampleSPCFile(), Buffer.from('786964360c00000030040400002cc9001400cb07', 'hex')])
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.introLength, 13184000)
    assert.strictEqual(metadata.copyrightYear, '1995')
  })

  it('should skip sub-chunks of types it doesn\'t know, keeping their data', () => {
    const dummySpcFile = Buffer.concat([makeSampleSPCFile(), Buffer.from('786964361000000040020300010203001400cb07', 'hex')])
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.deepStrictEqual(metadata.unknown_64_type_2, Buffer.from([1, 2, 3]))
    assert.strictEqual(metadata.copyrightYear, '1995')
  })

  it('should not read past the end of a truncated xid6 chunk', () => {
    const dummySpcFile = Buffer.concat([makeSampleSPCFile(), Buffer.from('78696436400000001400cb07100120006162', 'hex')]) // says it's 64 bytes, and ends partway through a string
    const metadata = readSPCID666Tags(dummySpcFile)
    assert.strictEqual(metadata.copyrightYear, '1995')
    assert.strictEqual(metadata.ost, undefined)
  })

  it('should warn about tags it doesn\'t know, suggesting the one that was meant', async (t) => {
    const emitWarning = t.mock.method(process, 'emitWarning', () => {}) // the warnings are recorded rather than printed
    const newFile = writeSPCID666Tags(makeSampleSPCFile(), { songTitel: 'kethisong' })
    writeSPCID666Tags(newFile, readSPCID666Tags(newFile)) // tags read from a file don't warn
    assert.deepStrictEqual(emitWarning.mock.calls.map(call => call.arguments[0]), ['spc-tag: ignoring unknown tag "songTitel". Did you mean "songTitle"?'])
    assert.strictEqual(readSPCID666Tags(newFile).songTitle, 'Dummy Song')
  })
})

function makeSampleBinarySPCFile ({ lengthSeconds, fadeMilliseconds, artist }) {
  const spcBuffer = makeSampleSPCFile()
  spcBuffer.fill(0, 0x9E, 0xD0) // the binary format's date, length, fade, and artist fields
  spcBuffer.writeUInt32LE(20250101, 0x9E) // dump date
  spcBuffer.writeUIntLE(lengthSeconds, 0xA9, 3) // seconds to play before fading out
  spcBuffer.writeUInt32LE(fadeMilliseconds, 0xAC) // fade length
  spcBuffer.write(artist, 0xB0, 32, 'ascii') // artist
  return spcBuffer
}

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
