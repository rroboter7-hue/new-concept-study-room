const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const integrationPath = path.join(root, 'nativeears-advanced-audio.js');
const integration = fs.existsSync(integrationPath) ? fs.readFileSync(integrationPath, 'utf8') : '';
const run = window => vm.runInNewContext(integration, { window });
const plain = value => JSON.parse(JSON.stringify(value));

// Synthetic verified-file metadata exercises catalogue behavior without downloading MP3s.
function entry(book, number, changes = {}) {
  const episodeId = book * 10000 + number;
  return {
    book, number, title: 'Verified lesson ' + number,
    sourceTitle: String(number).padStart(2, '0') + '－Verified lesson ' + number,
    episodeId,
    sourcePage: 'https://nativeears.mojoru.org/player/' + episodeId,
    seriesUrl: 'https://nativeears.mojoru.org/series/' + (book === 3 ? '48' : '47'),
    path: 'audio/nativeears/b' + book + '-' + String(number).padStart(3, '0') + '.mp3',
    bytes: 1000 + number,
    sha256: '0123456789abcdef'.repeat(4),
    ...changes
  };
}

function completeCatalogue() {
  return [
    ...Array.from({ length: 60 }, (_, i) => entry(3, i + 1)),
    ...Array.from({ length: 48 }, (_, i) => entry(4, i + 1))
  ];
}

test('attaches audio to existing lessons without replacing their IDs, text, records, or Book 2 sources', () => {
  const lesson = {
    id: 'original-book3-lesson1', book: 3, number: 1, title: 'Original title',
    paragraphs: [{ en: 'Existing verified text.', zh: '已有正文。' }],
    vocabulary: [{ word: 'existing', meaning: '已有的' }], usage: ['saved usage'],
    grammar: ['saved grammar'], keyPoints: ['saved key point'], questions: ['saved question']
  };
  const before = JSON.stringify(lesson);
  const records = { 'original-book3-lesson1': { completed: true, attempts: 3 } };
  const book2Source = { kind: 'nativeears', title: 'Existing Book 2 source' };
  const window = {
    LESSONS: [lesson], STUDY_RECORDS: records,
    NATIVEEARS_ADVANCED_CATALOGUE: [entry(3, 1)],
    STUDY_LESSON_AUDIO: { 'book2-original': 'audio/nativeears/b2-001.mp3' },
    PROVIDED_AUDIO_SOURCES: { 'book2-original': book2Source },
    NATIVEEARS_AUDIO_SOURCES: { 'book2-original': book2Source }
  };
  run(window);
  assert.equal(window.LESSONS[0], lesson);
  assert.equal(JSON.stringify(lesson), before);
  assert.equal(window.STUDY_RECORDS, records);
  assert.deepEqual(records, { 'original-book3-lesson1': { completed: true, attempts: 3 } });
  assert.equal(window.STUDY_LESSON_AUDIO['original-book3-lesson1'], 'audio/nativeears/b3-001.mp3');
  assert.equal(window.STUDY_LESSON_AUDIO['book2-original'], 'audio/nativeears/b2-001.mp3');
  assert.equal(window.PROVIDED_AUDIO_SOURCES['book2-original'], book2Source);
  assert.equal(window.NATIVEEARS_AUDIO_SOURCES['book2-original'], book2Source);
  assert.equal(window.NATIVEEARS_AUDIO_SOURCES['original-book3-lesson1'].sourcePage, 'https://nativeears.mojoru.org/player/30001');
});

test('creates a missing lesson as audio-only without fabricating study content', () => {
  const window = { LESSONS: [], NATIVEEARS_ADVANCED_CATALOGUE: [entry(4, 48)] };
  run(window);
  assert.deepEqual(plain(window.LESSONS), [{
    id: 'nce-nativeears-b4-l048', book: 4, number: 48,
    title: '第48课 · Verified lesson 48', subtitle: '仅音频 · 正文资料待补充',
    topic: 'NativeEars音频', source: 'provided', audioOnly: true,
    paragraphs: [], vocabulary: [], usage: [], grammar: [], keyPoints: [], questions: []
  }]);
  assert.equal(window.STUDY_LESSON_AUDIO['nce-nativeears-b4-l048'], 'audio/nativeears/b4-048.mp3');
  assert.deepEqual(plain(window.PROVIDED_AUDIO_SOURCES['nce-nativeears-b4-l048']), {
    kind: 'nativeears', label: 'NativeEars所列四册音频',
    title: '48－Verified lesson 48', file: 'b4-048.mp3', bytes: 1048,
    sha256: '0123456789abcdef'.repeat(4),
    sourcePage: 'https://nativeears.mojoru.org/player/40048',
    seriesUrl: 'https://nativeears.mojoru.org/series/47'
  });
});

test('completes and sorts the real Book 3 and 4 curriculum while retaining every original lesson', () => {
  const scope = { window: {} };
  for (const file of ['curriculum.js', 'textbook-lessons.js', 'book2-lessons.js', 'nativeears-audio.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), scope);
  }
  const window = scope.window;
  const originals = window.LESSONS.slice();
  const originalText = JSON.stringify(originals);
  const book2Audio = Object.entries(window.STUDY_LESSON_AUDIO);
  const book2Sources = Object.entries(window.NATIVEEARS_AUDIO_SOURCES);
  window.NATIVEEARS_ADVANCED_CATALOGUE = completeCatalogue().reverse();
  run(window);
  for (const lesson of originals) assert.ok(window.LESSONS.includes(lesson), 'original lesson object must survive: ' + lesson.id);
  assert.equal(JSON.stringify(originals), originalText);
  assert.equal(new Set(window.LESSONS.map(lesson => lesson.id)).size, window.LESSONS.length);
  for (const [book, count] of [[3, 60], [4, 48]]) {
    const lessons = window.LESSONS.filter(lesson => lesson.book === book);
    assert.equal(lessons.length, count);
    assert.deepEqual(plain(lessons.map(lesson => lesson.number)), Array.from({ length: count }, (_, i) => i + 1));
    assert.equal(lessons.filter(lesson => lesson.audioOnly).length, book === 3 ? 16 : 47);
  }
  for (const [id, file] of book2Audio) assert.equal(window.STUDY_LESSON_AUDIO[id], file);
  for (const [id, source] of book2Sources) assert.equal(window.NATIVEEARS_AUDIO_SOURCES[id], source);
  assert.equal(Object.keys(window.NATIVEEARS_AUDIO_SOURCES).length, 204);
  const expectedAudio = {
    'nce-b3-140ed4-l041': 'audio/nativeears/b3-041.mp3',
    'nce-b3-f4cefe-l042': 'audio/nativeears/b3-042.mp3',
    'nce-b3-63de95-l043': 'audio/nativeears/b3-043.mp3',
    'nce-b3-8160be-l044': 'audio/nativeears/b3-044.mp3',
    'nce-textbook-b4-l001': 'audio/nativeears/b4-001.mp3'
  };
  for (const [id, file] of Object.entries(expectedAudio)) assert.equal(window.STUDY_LESSON_AUDIO[id], file);
  assert.equal(window.PROVIDED_AUDIO_SOURCES['nce-b3-140ed4-l041'].label, 'NativeEars所列三册音频');
});

test('matches existing numeric lesson coordinates even when stored as strings', () => {
  const lesson = { id: 'imported-book3-lesson2', book: '3', number: '2', title: 'Imported lesson', paragraphs: [] };
  const window = { LESSONS: [lesson], NATIVEEARS_ADVANCED_CATALOGUE: [entry(3, 2)] };
  run(window);
  assert.equal(window.LESSONS.length, 1);
  assert.equal(window.LESSONS[0], lesson);
  assert.equal(window.STUDY_LESSON_AUDIO?.['imported-book3-lesson2'], 'audio/nativeears/b3-002.mp3');
});

test('saves overridden fallback audio once and leaves established fallbacks intact', () => {
  const first = { id: 'old-first', book: 3, number: 1 };
  const second = { id: 'old-second', book: 3, number: 2 };
  const third = { id: 'old-nativeears', book: 3, number: 3 };
  const oldSource = { kind: 'provided', title: 'Uploaded audio' };
  const retainedSource = { kind: 'generated', title: 'Earliest audio' };
  const window = {
    LESSONS: [first, second, third],
    NATIVEEARS_ADVANCED_CATALOGUE: [entry(3, 1), entry(3, 2), entry(3, 3)],
    STUDY_LESSON_AUDIO: { 'old-first': 'audio/uploaded-1.mp3', 'old-second': 'audio/uploaded-2.mp3', 'old-nativeears': 'audio/nativeears/previous.mp3', 'book2': 'audio/nativeears/b2-001.mp3' },
    PROVIDED_AUDIO_SOURCES: { 'old-first': oldSource, 'old-second': oldSource, 'old-nativeears': { kind: 'nativeears' } },
    STUDY_LESSON_AUDIO_FALLBACKS: { 'old-second': 'audio/earliest.mp3' },
    PROVIDED_AUDIO_SOURCE_FALLBACKS: { 'old-second': retainedSource }
  };
  run(window);
  assert.deepEqual(plain(window.STUDY_LESSON_AUDIO_FALLBACKS), {
    'old-first': 'audio/uploaded-1.mp3', 'old-second': 'audio/earliest.mp3', 'old-nativeears': 'audio/nativeears/previous.mp3'
  });
  assert.equal(window.PROVIDED_AUDIO_SOURCE_FALLBACKS['old-first'], oldSource);
  assert.equal(window.PROVIDED_AUDIO_SOURCE_FALLBACKS['old-second'], retainedSource);
  assert.equal(window.PROVIDED_AUDIO_SOURCE_FALLBACKS['old-nativeears'], undefined);
});

test('re-running the same catalogue is idempotent for lessons, mappings, and fallbacks', () => {
  const window = {
    LESSONS: [{ id: 'keep-lesson', book: 3, number: 1, title: 'Keep me' }],
    NATIVEEARS_ADVANCED_CATALOGUE: completeCatalogue(),
    STUDY_LESSON_AUDIO: { 'keep-lesson': 'audio/old.mp3' },
    PROVIDED_AUDIO_SOURCES: { 'keep-lesson': { kind: 'provided' } }
  };
  run(window);
  const before = JSON.stringify(window);
  const lessons = window.LESSONS.slice();
  run(window);
  assert.equal(window.LESSONS.length, 108);
  assert.equal(JSON.stringify(window), before);
  for (const lesson of lessons) assert.ok(window.LESSONS.includes(lesson));
});

test('skips malformed records and accepts a valid record after them', () => {
  const malformed = [
    null, [], 'not a record',
    entry(2, 1), entry(3, 0), entry(3, 61), entry(4, 49),
    entry(3, 1, { book: '3' }), entry(3, 1, { number: '1' }), entry(3, 1, { number: 1.5 }),
    entry(3, 1, { title: '' }), entry(3, 1, { title: '   ' }), entry(3, 1, { sourceTitle: null }),
    entry(3, 1, { path: 'https://example.com/b3-001.mp3' }),
    entry(3, 1, { path: '/audio/nativeears/b3-001.mp3' }),
    entry(3, 1, { path: 'audio/nativeears/../b3-001.mp3' }),
    entry(3, 1, { path: 'audio/nativeears/b3-002.mp3' }),
    entry(3, 1, { path: 'audio/nativeears/b3-001.mp3?source=other' }),
    entry(3, 1, { bytes: 0 }), entry(3, 1, { bytes: -1 }), entry(3, 1, { bytes: '1001' }), entry(3, 1, { bytes: 1.5 }),
    entry(3, 1, { sha256: 'a'.repeat(63) }), entry(3, 1, { sha256: 'g'.repeat(64) }),
    entry(3, 1, { episodeId: 0 }), entry(3, 1, { episodeId: 1.5 }),
    entry(3, 1, { sourcePage: 'https://nativeears.mojoru.org.evil.example/player/30001' }),
    entry(3, 1, { sourcePage: 'http://nativeears.mojoru.org/player/30001' }),
    entry(3, 1, { sourcePage: 'https://nativeears.mojoru.org/player/30002' }),
    entry(3, 1, { sourcePage: 'https://nativeears.mojoru.org/player/30001?other=1' }),
    entry(3, 1, { seriesUrl: 'https://example.com/series/48' }),
    entry(3, 1, { seriesUrl: 'https://nativeears.mojoru.org/series/47' })
  ];
  const catalogue = [...malformed, entry(4, 2)];
  const before = JSON.stringify(catalogue);
  const untouched = { id: 'existing', book: 1, number: 1 };
  const window = { LESSONS: [untouched], NATIVEEARS_ADVANCED_CATALOGUE: catalogue };
  assert.doesNotThrow(() => run(window));
  assert.equal(window.LESSONS.length, 2);
  assert.equal(window.LESSONS[0], untouched);
  assert.deepEqual(Object.keys(window.STUDY_LESSON_AUDIO), ['nce-nativeears-b4-l002']);
  assert.deepEqual(Object.keys(window.PROVIDED_AUDIO_SOURCES), ['nce-nativeears-b4-l002']);
  assert.equal(JSON.stringify(catalogue), before);
});

test('duplicate catalogue coordinates cannot duplicate a lesson or replace the first verified source', () => {
  const window = {
    LESSONS: [],
    NATIVEEARS_ADVANCED_CATALOGUE: [entry(3, 1), entry(3, 1, { bytes: 9999, sourceTitle: 'Conflicting duplicate' })]
  };
  run(window);
  assert.equal(window.LESSONS.length, 1);
  assert.equal(window.PROVIDED_AUDIO_SOURCES['nce-nativeears-b3-l001'].bytes, 1001);
  assert.equal(window.PROVIDED_AUDIO_SOURCES['nce-nativeears-b3-l001'].title, '01－Verified lesson 1');
});

test('an absent or malformed catalogue leaves existing course state untouched', () => {
  for (const catalogue of [undefined, null, {}, 'not an array']) {
    const window = { LESSONS: [{ id: 'existing', book: 3, number: 1 }], STUDY_LESSON_AUDIO: { existing: 'audio/old.mp3' } };
    if (catalogue !== undefined) window.NATIVEEARS_ADVANCED_CATALOGUE = catalogue;
    const before = JSON.stringify(window);
    assert.doesNotThrow(() => run(window));
    assert.equal(JSON.stringify(window), before);
  }
});

test('an unavailable lesson array cannot register orphan audio mappings', () => {
  for (const lessons of [undefined, null, {}]) {
    const window = { NATIVEEARS_ADVANCED_CATALOGUE: [entry(3, 1)], STUDY_LESSON_AUDIO: { existing: 'audio/old.mp3' } };
    if (lessons !== undefined) window.LESSONS = lessons;
    const before = JSON.stringify(window);
    assert.doesNotThrow(() => run(window));
    assert.equal(JSON.stringify(window), before);
  }
});
