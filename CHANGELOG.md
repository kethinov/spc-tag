## 1.1.0

- Added `lengthSeconds` and `fadeMilliseconds` to the tags read: how long the song plays before fading out, and how long it fades out for, from the ID666 tag in either its text or binary format (or `null` if the tag doesn't say, or the file has none).
- Added feature to the command line program to now write more than one tag at once, like `spc-tag write songTitle="new title" artist="new artist" file.spc`.
- Fixed issues with non-ASCII characters. Tags are now read and written as Latin-1 rather than ASCII, so text in other encodings (such as Shift JIS, which many Japanese games' tags use) is no longer mangled when tags are written: writing back what was read gives the same bytes. Tags that are valid UTF-8 are read as UTF-8, and text that can't be Latin-1 (such as Japanese) is written as UTF-8.
- Fixed tag length overflow: Standard tags that are too long for their ID666 field (the song title, game title, artist, dumper, and comments) are now kept whole in the xid6 chunk, as the ID666 format intends, and read from there, rather than being cut off.
- Fixed reading and writing the channel disables and emulator tags of files whose ID666 tag is in the text format.
- Fixed reading and writing the artist of files whose ID666 tag is in the binary format.
- Fixed writing xid6 tags that take up 256 bytes or more, whose size was written wrong.
- Fixed writing standard tags that are longer than their field, which overwrote the fields after them (a long dump date overwrote the song length); they're now cut off at their field's length.
- Fixed reading xid6 tags whose last item is a number stored in its header (like the copyright year) with no padding after it, as other programs write them, which was missed.
- Fixed reading xid6 items of types this doesn't know (which are now kept as their raw bytes, under `unknown_<id>_type_<type>`), and xid6 tags that are cut short.
- Fixed various other smaller things too.
- Updated dependencies.

## 1.0.3

- Fixed packaging issues on npm.
- Updated dependencies.

## 1.0.2

- Added version number to CLI program output.
- Fixed issues with supplying bad files to the CLI program.

## 1.0.1

- Fixed packaging issues on npm.

## 1.0.0

- Initial version.
