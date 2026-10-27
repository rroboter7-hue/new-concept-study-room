const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const os = require('node:os');
const optimizerPath = path.join(__dirname, '..', 'dev', 'optimize-audio.cjs');
const optimizer = fs.existsSync(optimizerPath) ? require(optimizerPath) : {};
const root = path.join(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function synchsafe(n) { return Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]); }
function id3Frame(id, body, flags = 0) {
  const header = Buffer.alloc(10); header.write(id); header.writeUInt32BE(body.length, 4); header.writeUInt16BE(flags, 8);
  return Buffer.concat([header, body]);
}
function tag(frames, padding = 0) {
  const body = Buffer.concat([...frames, Buffer.alloc(padding)]);
  return Buffer.concat([Buffer.from('494433030000', 'hex'), synchsafe(body.length), body]);
}
function audioPayload() {
  // Two valid MPEG-1 Layer III frames: 128kbps, 44.1kHz, mono, 417 bytes each.
  const frame = Buffer.alloc(417, 0x25); Buffer.from('fffb90c0', 'hex').copy(frame);
  const trailer = Buffer.alloc(128, 0x41); trailer.write('TAG');
  return Buffer.concat([frame, frame, trailer]);
}
const title = id3Frame('TIT2', Buffer.from('\0Lesson title'));
const album = id3Frame('TALB', Buffer.from('\0Original album'));
const copyright = id3Frame('TCOP', Buffer.from('\0Original copyright'));
const source = id3Frame('COMM', Buffer.from('\0eng\0Original source'));
const unknown = id3Frame('XABC', Buffer.from([1, 2, 3]));
const picture = id3Frame('APIC', Buffer.from([0, 105, 109, 103, 0, 3, 0, 255, 216, 255, 217]));

test('removes only APIC and zero padding, preserving every other frame and payload byte', () => {
  assert.equal(typeof optimizer.optimizeMp3, 'function', 'audio metadata optimizer must exist');
  const originalPrefix = tag([title, picture, album, copyright, source, unknown], 31);
  const original = Buffer.concat([originalPrefix, audioPayload()]);
  const result = optimizer.optimizeMp3(original);
  assert.deepEqual(result.buffer, Buffer.concat([tag([title, album, copyright, source, unknown]), audioPayload()]));
  assert.deepEqual(result.originalPrefix, originalPrefix);
  assert.equal(result.removedApicBytes, picture.length);
  assert.equal(result.removedPaddingBytes, 31);
  assert.equal(result.before.frameCount, 2);
  assert.equal(result.after.frameCount, 2);
  assert.equal(result.before.audioFramesSha256, hash(audioPayload().subarray(0, 834)));
  assert.equal(result.after.audioFramesSha256, result.before.audioFramesSha256);
  assert.equal(hash(Buffer.concat([result.originalPrefix, result.buffer.subarray(result.newPrefixBytes)])), hash(original));
});

test('optimization is idempotent and no-APIC tags preserve their text', () => {
  assert.equal(typeof optimizer.optimizeMp3, 'function');
  const expected = Buffer.concat([tag([title, copyright]), audioPayload()]);
  assert.deepEqual(optimizer.optimizeMp3(expected).buffer, expected);
  const once = optimizer.optimizeMp3(Buffer.concat([tag([title, picture], 10), audioPayload()])).buffer;
  assert.deepEqual(optimizer.optimizeMp3(once).buffer, once);
  const onlyPicture = optimizer.optimizeMp3(Buffer.concat([tag([picture], 4), audioPayload()]));
  assert.deepEqual(onlyPicture.buffer, audioPayload());
  assert.deepEqual(optimizer.optimizeMp3(audioPayload()).buffer, audioPayload());
});

test('rejects unsupported versions, revisions, header flags, frame flags, and v2.4 footers', () => {
  assert.equal(typeof optimizer.optimizeMp3, 'function');
  const normal = Buffer.concat([tag([title, picture]), audioPayload()]);
  for (const [offset, value] of [[3,2],[3,4],[3,5],[4,1],[5,0x80],[5,0x40],[5,0x20],[5,0x10],[5,1]]) {
    const changed = Buffer.from(normal); changed[offset] = value;
    assert.throws(() => optimizer.optimizeMp3(changed), /unsupported/i, `offset ${offset}, flag ${value}`);
  }
  assert.throws(() => optimizer.optimizeMp3(Buffer.concat([tag([id3Frame('TIT2', Buffer.from([0, 65]), 0x0040)]), audioPayload()])), /unsupported.*flag/i);
});

test('rejects malformed synchsafe lengths, truncated headers/frames, and nonzero padding', () => {
  assert.equal(typeof optimizer.optimizeMp3, 'function');
  const normal = Buffer.concat([tag([title, picture], 5), audioPayload()]);
  const invalidSize = Buffer.from(normal); invalidSize[6] = 128;
  assert.throws(() => optimizer.optimizeMp3(invalidSize), /synchsafe/i);
  assert.throws(() => optimizer.optimizeMp3(normal.subarray(0, 8)), /truncated/i);
  assert.throws(() => optimizer.optimizeMp3(normal.subarray(0, 20)), /truncated/i);
  const frameOverflow = Buffer.from(normal); frameOverflow.writeUInt32BE(0xffffff, 14);
  assert.throws(() => optimizer.optimizeMp3(frameOverflow), /frame.*(truncated|boundary|size)/i);
  const badPadding = Buffer.concat([tag([title], 5), audioPayload()]); badPadding[10 + title.length + 2] = 1;
  assert.throws(() => optimizer.optimizeMp3(badPadding), /padding/i);
  const badId = Buffer.from(normal); badId[10] = 97;
  assert.throws(() => optimizer.optimizeMp3(badId), /frame.*identifier/i);
  const highBitId = Buffer.from(normal); highBitId[10] = 0xd4;
  assert.throws(() => optimizer.optimizeMp3(highBitId), /frame.*identifier/i);
  assert.throws(() => optimizer.optimizeMp3(Buffer.concat([tag([], 3), audioPayload()])), /ID3.*frame/i);
});

test('refuses damaged MP3 payloads instead of scanning past missing frames or unknown trailers', () => {
  assert.equal(typeof optimizer.optimizeMp3, 'function');
  const damaged = audioPayload(); damaged[417] = 0;
  assert.throws(() => optimizer.optimizeMp3(Buffer.concat([tag([title,picture]), damaged])), /MPEG|MP3/i);
  assert.throws(() => optimizer.optimizeMp3(Buffer.concat([tag([title,picture]), audioPayload(), Buffer.from([1])])), /MPEG|MP3|trailer/i);
  assert.throws(() => optimizer.optimizeMp3(Buffer.concat([tag([title,picture]), audioPayload().subarray(0, 500)])), /truncated|MPEG|MP3/i);
});

test('filesystem operations reject traversal and prefix siblings', () => {
  assert.equal(typeof optimizer.resolveWithin, 'function');
  assert.equal(optimizer.resolveWithin(root, 'audio/nativeears/b2-001.mp3'), fs.realpathSync(path.join(root,'audio/nativeears/b2-001.mp3')));
  assert.throws(() => optimizer.resolveWithin(root, '../github-publish-book34-other/out.mp3'), /outside|boundary/i);
  assert.throws(() => optimizer.resolveWithin(root, path.resolve(root,'../out.mp3')), /outside|boundary/i);
});

test('filesystem operations resolve directory links before allowing a target', t => {
  assert.equal(typeof optimizer.resolveWithin, 'function');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'audio-boundary-'));
  const within = path.join(temporary,'within'), outside = path.join(temporary,'outside');
  const link = path.join(within,'escape');
  fs.mkdirSync(within); fs.mkdirSync(outside);
  try {
    try { fs.symlinkSync(outside, link, 'junction'); }
    catch (error) { if (error.code === 'EPERM') { t.skip('Windows sandbox does not permit creating junctions'); return; } throw error; }
    assert.throws(() => optimizer.resolveWithin(within, 'escape/new.mp3'), /outside|escapes|boundary/i);
  } finally {
    if (fs.existsSync(link)) fs.rmdirSync(link);
    fs.rmdirSync(within); fs.rmdirSync(outside); fs.rmdirSync(temporary);
  }
});

test('regenerates actual combined-declaration metadata and retires only archived fallback paths', () => {
  assert.equal(typeof optimizer.metadataEdits, 'function');
  const original = { window: {} };
  for (const file of ['nativeears-audio.js','nativeears-advanced-catalogue.js']) vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),original);
  const entries = [
    ...Object.values(original.window.NATIVEEARS_AUDIO_SOURCES).map(e=>({url:'audio/nativeears/'+e.file,newBytes:e.bytes-1,newSha256:'1'.repeat(64)})),
    ...original.window.NATIVEEARS_ADVANCED_CATALOGUE.map(e=>({url:e.path,newBytes:e.bytes-1,newSha256:'1'.repeat(64)}))
  ];
  const edits = optimizer.metadataEdits(root, entries, [{url:'audio/provided/b2-001.mp3'}]);
  const next = { window: {STUDY_LESSON_AUDIO:{old:'audio/provided/b2-001.mp3'},PROVIDED_AUDIO_SOURCES:{old:{kind:'provided'}},STUDY_LESSON_AUDIO_FALLBACKS:{old:'audio/provided/b2-001.mp3',keep:'audio/keep.mp3'},PROVIDED_AUDIO_SOURCE_FALLBACKS:{old:{kind:'provided'},keep:{kind:'generated'}}} };
  for(const file of ['provided-audio.js','nativeears-audio.js','nativeears-advanced-catalogue.js']) vm.runInNewContext(edits[file].toString(),next);
  assert.equal(next.window.STUDY_LESSON_AUDIO_FALLBACKS.old,undefined);
  assert.equal(next.window.PROVIDED_AUDIO_SOURCE_FALLBACKS.old,undefined);
  assert.equal(next.window.STUDY_LESSON_AUDIO_FALLBACKS.keep,'audio/keep.mp3');
  for (const [id, sourceEntry] of Object.entries(next.window.NATIVEEARS_AUDIO_SOURCES)) {
    const before = original.window.NATIVEEARS_AUDIO_SOURCES[id];
    assert.equal(sourceEntry.bytes,before.bytes-1);
    assert.equal(sourceEntry.sha256,'1'.repeat(64));
    for (const key of ['title','sourcePage','seriesUrl','duration','file']) assert.equal(sourceEntry[key],before[key]);
  }
  for (let i=0;i<next.window.NATIVEEARS_ADVANCED_CATALOGUE.length;i++) {
    const after=next.window.NATIVEEARS_ADVANCED_CATALOGUE[i], before=original.window.NATIVEEARS_ADVANCED_CATALOGUE[i];
    assert.equal(after.bytes,before.bytes-1); assert.equal(after.sha256,'1'.repeat(64));
    for (const key of ['title','sourceTitle','sourcePage','seriesUrl','episodeId','path']) assert.equal(after[key],before[key]);
  }
  assert.equal(next.window.NATIVEEARS_AUDIO_INFO.bytes,entries.filter(e=>e.url.startsWith('audio/nativeears/b2-')).reduce((s,e)=>s+e.newBytes,0));
});

test('all 204 optimized recordings retain audited audio frames and current metadata hashes', () => {
  assert.equal(typeof optimizer.readMp3Frames, 'function');
  const manifestFile = path.join(root, 'dev', 'audio-storage-optimization-manifest.json');
  assert.ok(fs.existsSync(manifestFile), 'verified optimization manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.optimized.length, 204);
  let totalFrames = 0;
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root,'nativeears-audio.js'),'utf8'), scope);
  vm.runInNewContext(fs.readFileSync(path.join(root,'nativeears-advanced-catalogue.js'),'utf8'), scope);
  const currentMetadata = new Map([
    ...Object.values(scope.window.NATIVEEARS_AUDIO_SOURCES).map(s=>['audio/nativeears/'+s.file,s]),
    ...scope.window.NATIVEEARS_ADVANCED_CATALOGUE.map(s=>[s.path,s])
  ]);
  for (const entry of manifest.optimized) {
    const current = fs.readFileSync(path.join(root, entry.url));
    const frames = optimizer.readMp3Frames(current);
    assert.equal(frames.audioFramesSha256, entry.audioFramesSha256, entry.url+' audio bytes');
    assert.equal(frames.audioPayloadSha256, entry.audioPayloadSha256, entry.url+' trailing bytes');
    assert.equal(frames.frameCount, entry.frameCount, entry.url+' frame count');
    assert.equal(current.length, entry.newBytes);
    assert.equal(hash(current), entry.newSha256);
    assert.equal(currentMetadata.get(entry.url).bytes, entry.newBytes, entry.url+' catalogue bytes');
    assert.equal(currentMetadata.get(entry.url).sha256, entry.newSha256, entry.url+' catalogue hash');
    assert.deepEqual(optimizer.optimizeMp3(current).buffer, current, entry.url+' is idempotent');
    totalFrames += frames.frameCount;
  }
  assert.equal(totalFrames, 1156263);
});

test('retired files are absent and every four-book lesson and word mapping resolves', () => {
  const scope = { window: {} };
  for (const file of ['curriculum.js','textbook-lessons.js','book1-first10-lessons.js','book1-first10-catalogue.js','book1-complete-lessons.js','book2-lessons.js','generated-audio.js','practice-pack-word-audio.js','provided-audio.js','nativeears-audio.js','book1-first10-audio.js','book1-complete-audio.js','book2-packs20-word-audio.js','nativeears-advanced-catalogue.js','nativeears-advanced-audio.js','book3-lessons.js','book4-lessons.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
  }
  assert.equal(Object.keys(scope.window.STUDY_LESSON_AUDIO).length,276);
  assert.equal(Object.keys(scope.window.STUDY_WORD_AUDIO).length,2250);
  for (const url of [...Object.values(scope.window.STUDY_LESSON_AUDIO),...Object.values(scope.window.STUDY_WORD_AUDIO)]) assert.ok(fs.existsSync(path.join(root,url)),url);
  for (const url of Object.values(scope.window.STUDY_LESSON_AUDIO_FALLBACKS||{})) assert.ok(fs.existsSync(path.join(root,url)), 'fallback '+url);
  for (let n=1;n<=38;n++) assert.equal(fs.existsSync(path.join(root,'audio/provided/b2-'+String(n).padStart(3,'0')+'.mp3')),false);
  for (const word of ["i'm", "she's"]) assert.equal(fs.existsSync(path.join(root,'audio/words/'+word+'.wav')),false);
});
