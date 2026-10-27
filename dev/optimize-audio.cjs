'use strict';

// ID3v2.3.0 §§3.1/3.3: synchsafe tag size excludes the 10-byte header;
// frame sizes are ordinary big-endian uint32 values and exclude frame headers.
// ID3v2.4 has different frame sizes/footer rules, so it is deliberately rejected.
// https://id3.org/id3v2.3.0
// https://id3.org/id3v2.4.0-structure
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const slash = p => p.replaceAll('\\', '/');

function synchsafeRead(b, offset) {
  const bytes = b.subarray(offset, offset + 4);
  if (bytes.length !== 4 || bytes.some(x => x & 128)) throw new Error('Invalid ID3 synchsafe size');
  return bytes[0] * 2097152 + bytes[1] * 16384 + bytes[2] * 128 + bytes[3];
}

function synchsafeWrite(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0x0fffffff) throw new Error('Invalid ID3 synchsafe size');
  return Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
}

function parseId3(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('MP3 input must be a Buffer');
  if (buffer.toString('latin1', 0, 3) !== 'ID3') return { prefixBytes: 0, frames: [], paddingBytes: 0 };
  if (buffer.length < 10) throw new Error('Truncated ID3 header');
  if (buffer[3] !== 3 || buffer[4] !== 0) throw new Error('Unsupported ID3 version/revision; only v2.3.0 is handled');
  if (buffer[5] !== 0) throw new Error('Unsupported ID3 header flags; no extended header, unsynchronisation or footer is handled');
  const end = 10 + synchsafeRead(buffer, 6);
  if (end > buffer.length) throw new Error('Truncated ID3 tag');
  const frames = [];
  let position = 10;
  while (position < end) {
    if (buffer[position] === 0) {
      if (buffer.subarray(position, end).some(byte => byte !== 0)) throw new Error('Nonzero ID3 padding');
      break;
    }
    if (position + 10 > end) throw new Error('Truncated ID3 frame header');
    const id = buffer.toString('latin1', position, position + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) throw new Error('Invalid ID3 frame identifier');
    const size = buffer.readUInt32BE(position + 4);
    if (size < 1 || position + 10 + size > end) throw new Error('ID3 frame size crosses tag boundary or is truncated');
    if (buffer.readUInt16BE(position + 8) !== 0) throw new Error('Unsupported ID3 frame flags');
    frames.push({ id, raw: buffer.subarray(position, position + 10 + size) });
    position += 10 + size;
  }
  if (!frames.length) throw new Error('ID3 tag must contain at least one frame');
  return { prefixBytes: end, frames, paddingBytes: end - position };
}

function readMp3Frames(buffer) {
  const tag = parseId3(buffer);
  let position = tag.prefixBytes;
  let frameCount = 0;
  let durationSeconds = 0;
  const bitrates = new Set(), sampleRates = new Set(), channels = new Set();
  const rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  while (position < buffer.length) {
    if (buffer.length - position === 128 && buffer.toString('latin1', position, position + 3) === 'TAG') break;
    if (position + 4 > buffer.length) throw new Error('Truncated MPEG audio header');
    if (buffer[position] !== 255 || (buffer[position + 1] & 224) !== 224) throw new Error('Invalid MPEG audio frame or unknown MP3 trailer');
    const version = (buffer[position + 1] >>> 3) & 3;
    const layer = (buffer[position + 1] >>> 1) & 3;
    if (version !== 3 || layer !== 1) throw new Error('Unsupported MPEG version/layer; expected MPEG-1 Layer III');
    const bitrateIndex = (buffer[position + 2] >>> 4) & 15;
    const sampleIndex = (buffer[position + 2] >>> 2) & 3;
    if (!bitrateIndex || bitrateIndex === 15 || sampleIndex === 3) throw new Error('Invalid MPEG bitrate/sample rate');
    const bitrateKbps = rates[bitrateIndex];
    const sampleRate = [44100, 48000, 32000][sampleIndex];
    const length = Math.floor(144000 * bitrateKbps / sampleRate) + ((buffer[position + 2] >>> 1) & 1);
    if (position + length > buffer.length) throw new Error('Truncated MPEG audio frame');
    bitrates.add(bitrateKbps); sampleRates.add(sampleRate); channels.add((buffer[position + 3] >>> 6) === 3 ? 1 : 2);
    frameCount++; durationSeconds += 1152 / sampleRate; position += length;
  }
  if (!frameCount) throw new Error('MP3 has no MPEG audio frames');
  return {
    prefixBytes: tag.prefixBytes, frameCount, audioFrameBytes: position - tag.prefixBytes,
    audioFramesSha256: sha256(buffer.subarray(tag.prefixBytes, position)),
    audioPayloadSha256: sha256(buffer.subarray(tag.prefixBytes)),
    trailingBytes: buffer.length - position, durationSeconds,
    bitrates: [...bitrates], sampleRates: [...sampleRates], channels: [...channels]
  };
}

function optimizeMp3(original) {
  const parsed = parseId3(original);
  const before = readMp3Frames(original);
  const kept = parsed.frames.filter(frame => frame.id !== 'APIC');
  let prefix = Buffer.alloc(0);
  if (kept.length) {
    const body = Buffer.concat(kept.map(frame => frame.raw));
    prefix = Buffer.concat([original.subarray(0, 6), synchsafeWrite(body.length), body]);
  }
  const buffer = Buffer.concat([prefix, original.subarray(parsed.prefixBytes)]);
  const after = readMp3Frames(buffer);
  assert.equal(after.audioFramesSha256, before.audioFramesSha256, 'MPEG audio frame bytes changed');
  assert.equal(after.audioPayloadSha256, before.audioPayloadSha256, 'MP3 payload/trailer bytes changed');
  assert.equal(after.frameCount, before.frameCount, 'MPEG frame count changed');
  return {
    buffer, originalPrefix: original.subarray(0, parsed.prefixBytes),
    originalPrefixBytes: parsed.prefixBytes, newPrefixBytes: prefix.length,
    removedApicBytes: parsed.frames.filter(f => f.id === 'APIC').reduce((sum, f) => sum + f.raw.length, 0),
    removedPaddingBytes: parsed.paddingBytes,
    retainedFrames: kept.map(f => ({ id: f.id, bytes: f.raw.length, sha256: sha256(f.raw) })), before, after
  };
}

function inside(boundary, candidate) {
  const relative = path.relative(boundary, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function resolveWithin(boundary, candidate) {
  const base = fs.realpathSync(path.resolve(boundary));
  const absolute = path.resolve(base, candidate);
  if (!inside(base, absolute)) throw new Error('Path is outside the allowed workspace boundary: ' + candidate);
  let parent = absolute;
  const missing = [];
  while (!fs.existsSync(parent)) {
    missing.unshift(path.basename(parent));
    const next = path.dirname(parent);
    if (next === parent) throw new Error('Cannot resolve path boundary');
    parent = next;
  }
  const resolved = path.join(fs.realpathSync(parent), ...missing);
  if (!inside(base, resolved)) throw new Error('Resolved path escapes workspace boundary: ' + candidate);
  return resolved;
}

function writeBackup(boundary, relative, buffer) {
  const target = resolveWithin(boundary, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) assert.equal(sha256(fs.readFileSync(target)), sha256(buffer), 'Existing backup differs: ' + target);
  else fs.writeFileSync(target, buffer, { flag: 'wx' });
  assert.equal(sha256(fs.readFileSync(target)), sha256(buffer), 'Backup verification failed: ' + target);
  return target;
}

function writeAtomic(boundary, relative, buffer) {
  const target = resolveWithin(boundary, relative);
  const temporary = resolveWithin(boundary, relative + '.audio-optimization-tmp');
  let descriptor;
  let created = false;
  try {
    descriptor = fs.openSync(temporary, 'wx'); created = true; fs.writeFileSync(descriptor, buffer); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
    assert.equal(sha256(fs.readFileSync(temporary)), sha256(buffer));
    fs.renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (created && fs.existsSync(temporary)) fs.unlinkSync(resolveWithin(boundary, temporary));
  }
}

function metadataEdits(root, optimized, removed) {
  const byUrl = new Map(optimized.map(e => [e.url, e]));
  const scope = { window: {} };
  let native = fs.readFileSync(resolveWithin(root, 'nativeears-audio.js'), 'utf8');
  vm.runInNewContext(native, scope);
  const sources = scope.window.NATIVEEARS_AUDIO_SOURCES;
  for (const entry of Object.values(sources)) {
    const optimizedEntry = byUrl.get('audio/nativeears/' + entry.file);
    assert.ok(optimizedEntry, 'Unplanned source path');
    entry.bytes = optimizedEntry.newBytes; entry.sha256 = optimizedEntry.newSha256;
  }
  const sourceMatch = /\bsources=(\{[^]*?\});\r?\n var previous=/.exec(native);
  if (!sourceMatch) throw new Error('Cannot locate generated Book 2 source metadata');
  native = native.replace(sourceMatch[0], 'sources=' + JSON.stringify(sources) + ';\n var previous=');
  const book2Bytes = optimized.filter(e => /^audio\/nativeears\/b2-/.test(e.url)).reduce((s, e) => s + e.newBytes, 0);
  native = native.replace(/(global\.NATIVEEARS_AUDIO_INFO=)\{[^\r\n]+\};/, '$1' + JSON.stringify({ ...scope.window.NATIVEEARS_AUDIO_INFO, bytes: book2Bytes }) + ';');
  const retired = removed.filter(e => e.url.startsWith('audio/provided/')).map(e => e.url);
  const insertion = " var retired=new Set(" + JSON.stringify(retired) + ");\n Object.keys(fallbacks).forEach(function(id){if(retired.has(fallbacks[id])){delete fallbacks[id];delete sourceFallbacks[id];}});\n";
  native = native.replace(' Object.keys(previous).forEach', insertion + ' Object.keys(previous).forEach');
  native = native.replace('if(previous[id]!==audio[id]&&', 'if(!retired.has(previous[id])&&previous[id]!==audio[id]&&');
  native = native.replace("if(previousSources[id]?.kind!=='nativeears'&&", "if(!retired.has(previous[id])&&previousSources[id]?.kind!=='nativeears'&&");
  vm.runInNewContext(fs.readFileSync(resolveWithin(root, 'nativeears-advanced-catalogue.js'), 'utf8'), scope);
  const catalogue = scope.window.NATIVEEARS_ADVANCED_CATALOGUE;
  for (const entry of catalogue) {
    const optimizedEntry = byUrl.get(entry.path);
    assert.ok(optimizedEntry); entry.bytes = optimizedEntry.newBytes; entry.sha256 = optimizedEntry.newSha256;
  }
  return {
    'nativeears-audio.js': Buffer.from(native),
    'nativeears-advanced-catalogue.js': Buffer.from('/* Verified NativeEars catalogue. Lossless metadata cleanup provenance: dev/audio-storage-optimization-manifest.json. */\nwindow.NATIVEEARS_ADVANCED_CATALOGUE=' + JSON.stringify(catalogue) + ';\n'),
    'provided-audio.js': Buffer.from('/* Superseded Book 2 recordings were archived outside the publishing tree.\n   All current Book 2 lesson recordings are mapped by nativeears-audio.js. */\n')
  };
}

function verifyOptimization(root, archive, manifest) {
  let reconstructed = 0;
  let frames = 0;
  for (const entry of manifest.optimized) {
    const current = fs.readFileSync(resolveWithin(root, entry.url));
    assert.equal(current.length, entry.newBytes, entry.url + ' size');
    assert.equal(sha256(current), entry.newSha256, entry.url + ' hash');
    const parsed = parseId3(current);
    assert.equal(parsed.prefixBytes, entry.newPrefixBytes);
    assert.equal(parsed.paddingBytes, 0);
    assert.ok(parsed.frames.every(frame => frame.id !== 'APIC'));
    assert.deepEqual(parsed.frames.map(f => ({ id: f.id, bytes: f.raw.length, sha256: sha256(f.raw) })), entry.retainedFrames);
    const audio = readMp3Frames(current);
    assert.equal(audio.audioFramesSha256, entry.audioFramesSha256);
    assert.equal(audio.audioPayloadSha256, entry.audioPayloadSha256);
    assert.equal(audio.frameCount, entry.frameCount);
    const prefix = fs.readFileSync(resolveWithin(archive, entry.prefixBackup));
    assert.equal(prefix.length, entry.originalPrefixBytes);
    assert.equal(sha256(prefix), entry.prefixSha256);
    const rebuilt = Buffer.concat([prefix, current.subarray(entry.newPrefixBytes)]);
    assert.equal(rebuilt.length, entry.originalBytes);
    assert.equal(sha256(rebuilt), entry.originalSha256, entry.url + ' reconstruction');
    reconstructed++; frames += audio.frameCount;
  }
  for (const entry of manifest.removed) {
    assert.equal(fs.existsSync(resolveWithin(root, entry.url)), false, entry.url + ' was not retired');
    const backup = fs.readFileSync(resolveWithin(archive, entry.backup));
    assert.equal(backup.length, entry.originalBytes); assert.equal(sha256(backup), entry.originalSha256);
  }
  return { optimized: reconstructed, audioFrames: frames, archivedRetiredFiles: manifest.removed.length, recoveredOriginalHashes: reconstructed, removedApicBytes: manifest.optimized.reduce((s,e)=>s+e.removedApicBytes,0), removedPaddingBytes: manifest.optimized.reduce((s,e)=>s+e.removedPaddingBytes,0), savedAudioBytes: manifest.optimized.reduce((s,e)=>s+e.originalBytes-e.newBytes,0)+manifest.removed.reduce((s,e)=>s+e.originalBytes,0) };
}

function applyOptimization(root, archive, auditPath) {
  const allowedWorkspace = fs.realpathSync(path.resolve(__dirname, '..', '..'));
  root = resolveWithin(allowedWorkspace, root);
  archive = resolveWithin(allowedWorkspace, archive);
  if (inside(root, archive)) throw new Error('Archive must be outside the publishing root');
  fs.mkdirSync(archive, { recursive: true });
  const archiveManifestPath = resolveWithin(archive, 'manifest.json');
  if (fs.existsSync(archiveManifestPath)) {
    const existing = JSON.parse(fs.readFileSync(archiveManifestPath, 'utf8'));
    if (existing.status !== 'complete') throw new Error('Incomplete prior optimization: use archived prefixes and reconstruction instructions before retrying');
    return { ...verifyOptimization(root, archive, existing), idempotent: true };
  }
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  assert.equal(fs.realpathSync(audit.root), fs.realpathSync(root));
  const audited = new Map(audit.audio.map(f => [f.path, f]));
  const auditedFrames = new Map(audit.mp3FrameAudit.map(f => [f.path, f]));
  const urls = [];
  for (const [book, count] of [[2,96],[3,60],[4,48]]) for (let n=1;n<=count;n++) urls.push('audio/nativeears/b'+book+'-'+String(n).padStart(3,'0')+'.mp3');
  const retiredUrls = Array.from({ length: 38 }, (_,i) => 'audio/provided/b2-'+String(i+1).padStart(3,'0')+'.mp3').concat(["audio/words/i'm.wav", "audio/words/she's.wav"]);
  const manifest = {
    schemaVersion: 1, status: 'prepared', createdAt: new Date().toISOString(),
    specification: ['https://id3.org/id3v2.3.0', 'https://id3.org/id3v2.4.0-structure'],
    policy: 'Remove APIC and zero padding only; retain all other ID3 frames, MPEG frames, and trailing tags byte-for-byte. Reject unsupported versions or flags.',
    recovery: 'For each optimized URL, concatenate its archived original prefix with the current file sliced from newPrefixBytes. Verify originalBytes and originalSha256 before replacing anything. Retired files are full copies under files/.',
    optimized: [], removed: [], originalMetadata: []
  };
  for (const url of urls) {
    const original = fs.readFileSync(resolveWithin(root, url));
    const baseline = audited.get(url), baselineFrames = auditedFrames.get(url);
    assert.equal(original.length, baseline.bytes); assert.equal(sha256(original), baseline.sha256, url + ' audit baseline changed');
    const next = optimizeMp3(original);
    assert.equal(next.before.audioFramesSha256, baselineFrames.audioFramesSha256);
    assert.equal(next.before.frameCount, baselineFrames.frameCount);
    const prefixBackup = 'nativeears-prefixes/' + path.posix.basename(url) + '.id3';
    writeBackup(archive, prefixBackup, next.originalPrefix);
    manifest.optimized.push({
      url, originalBytes: original.length, originalSha256: sha256(original),
      originalPrefixBytes: next.originalPrefixBytes, prefixBackup, prefixSha256: sha256(next.originalPrefix),
      newBytes: next.buffer.length, newSha256: sha256(next.buffer), newPrefixBytes: next.newPrefixBytes,
      audioFramesSha256: next.before.audioFramesSha256, audioPayloadSha256: next.before.audioPayloadSha256,
      audioFrameBytes: next.before.audioFrameBytes, frameCount: next.before.frameCount,
      removedApicBytes: next.removedApicBytes, removedPaddingBytes: next.removedPaddingBytes,
      retainedFrames: next.retainedFrames
    });
  }
  for (const url of retiredUrls) {
    const original = fs.readFileSync(resolveWithin(root, url));
    const baseline = audited.get(url);
    assert.equal(original.length, baseline.bytes); assert.equal(sha256(original), baseline.sha256);
    assert.ok(!baseline.primaryLesson && !baseline.primaryWord, 'Cannot remove active audio: ' + url);
    const backup = 'files/' + url;
    writeBackup(archive, backup, original);
    manifest.removed.push({ url, backup, originalBytes: original.length, originalSha256: sha256(original), reason: url.startsWith('audio/provided/') ? 'Superseded by current NativeEars recording; no fallback consumer exists' : 'Unreferenced word file with an already mapped byte-identical alias' });
  }
  const edits = metadataEdits(root, manifest.optimized, manifest.removed);
  for (const file of Object.keys(edits)) {
    const original = fs.readFileSync(resolveWithin(root, file));
    const backup = 'files/' + file; writeBackup(archive, backup, original);
    manifest.originalMetadata.push({ url: file, backup, originalSha256: sha256(original), originalBytes: original.length });
  }
  writeBackup(archive, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  for (const entry of manifest.optimized) {
    const original = fs.readFileSync(resolveWithin(root, entry.url));
    assert.equal(sha256(original), entry.originalSha256);
    const next = optimizeMp3(original); assert.equal(sha256(next.buffer), entry.newSha256);
    writeAtomic(root, entry.url, next.buffer);
  }
  for (const [file, content] of Object.entries(edits)) writeAtomic(root, file, content);
  for (const entry of manifest.removed) {
    const target = resolveWithin(root, entry.url);
    const backup = fs.readFileSync(resolveWithin(archive, entry.backup));
    assert.equal(sha256(backup), entry.originalSha256);
    assert.equal(sha256(fs.readFileSync(target)), entry.originalSha256);
    fs.unlinkSync(target); // Individual audited file only; never recursive deletion.
  }
  manifest.status = 'complete'; manifest.completedAt = new Date().toISOString();
  manifest.verification = verifyOptimization(root, archive, manifest);
  writeAtomic(archive, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  writeAtomic(root, 'dev/audio-storage-optimization-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return manifest.verification;
}

module.exports = { optimizeMp3, readMp3Frames, resolveWithin, metadataEdits, applyOptimization, verifyOptimization };
if (require.main === module) {
  const args = process.argv.slice(2);
  const root = path.resolve(__dirname, '..');
  const value = flag => { const i=args.indexOf(flag); return i < 0 ? undefined : args[i+1]; };
  const archive = value('--archive') || path.resolve(root, '..', 'audio-optimization-archive', '2026-10-27');
  if (args.includes('--apply')) {
    const audit = value('--audit'); if (!audit) throw new Error('--apply requires --audit with the pre-optimization audit');
    console.log(JSON.stringify(applyOptimization(root, archive, audit), null, 2));
  } else if (args.includes('--verify')) {
    const manifest = JSON.parse(fs.readFileSync(resolveWithin(archive, 'manifest.json'), 'utf8'));
    console.log(JSON.stringify(verifyOptimization(root, archive, manifest), null, 2));
  } else {
    console.log('Read-only by default. Use --verify --archive <path>, or --apply --audit <audit.json> --archive <path>. No encoding or server is used.');
  }
}
