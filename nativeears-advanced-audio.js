/* Attach verified, same-origin NativeEars Book 3/4 audio without replacing study material. */
(function (global) {
  'use strict';

  if (!Array.isArray(global.LESSONS) || !Array.isArray(global.NATIVEEARS_ADVANCED_CATALOGUE)) return;

  var limits = { 3: 60, 4: 48 };
  var series = { 3: '48', 4: '47' };
  var labels = { 3: 'NativeEars所列三册音频', 4: 'NativeEars所列四册音频' };
  var hasOwn = Object.prototype.hasOwnProperty;

  function validEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (!Number.isInteger(entry.book) || !hasOwn.call(limits, entry.book)) return false;
    if (!Number.isInteger(entry.number) || entry.number < 1 || entry.number > limits[entry.book]) return false;
    if (typeof entry.title !== 'string' || !entry.title.trim()) return false;
    if (typeof entry.sourceTitle !== 'string' || !entry.sourceTitle.trim()) return false;
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) return false;
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256)) return false;
    if (!Number.isSafeInteger(entry.episodeId) || entry.episodeId <= 0) return false;
    return entry.path === 'audio/nativeears/b' + entry.book + '-' + String(entry.number).padStart(3, '0') + '.mp3'
      && entry.sourcePage === 'https://nativeears.mojoru.org/player/' + entry.episodeId
      && entry.seriesUrl === 'https://nativeears.mojoru.org/series/' + series[entry.book];
  }

  var seen = Object.create(null);
  var catalogue = global.NATIVEEARS_ADVANCED_CATALOGUE.filter(function (entry) {
    if (!validEntry(entry)) return false;
    var key = entry.book + ':' + entry.number;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  if (!catalogue.length) return;

  // Coordinates are authoritative: the existing lesson IDs have several source prefixes.
  var lessons = Object.create(null);
  global.LESSONS.forEach(function (lesson) {
    if (!lesson || typeof lesson.id !== 'string' || !lesson.id) return;
    var key = Number(lesson.book) + ':' + Number(lesson.number);
    if (!lessons[key]) lessons[key] = lesson;
  });

  var previous = global.STUDY_LESSON_AUDIO || {};
  var previousSources = global.PROVIDED_AUDIO_SOURCES || {};
  var fallbacks = global.STUDY_LESSON_AUDIO_FALLBACKS || {};
  var sourceFallbacks = global.PROVIDED_AUDIO_SOURCE_FALLBACKS || {};
  var sources = {};

  catalogue.forEach(function (entry) {
    var key = entry.book + ':' + entry.number;
    var lesson = lessons[key];
    if (!lesson) {
      lesson = {
        id: 'nce-nativeears-b' + entry.book + '-l' + String(entry.number).padStart(3, '0'),
        book: entry.book,
        number: entry.number,
        title: '第' + entry.number + '课 · ' + entry.title.trim(),
        subtitle: '仅音频 · 正文资料待补充',
        topic: 'NativeEars音频',
        source: 'provided',
        audioOnly: true,
        paragraphs: [], vocabulary: [], usage: [], grammar: [], keyPoints: [], questions: []
      };
      lessons[key] = lesson;
      global.LESSONS.push(lesson);
    }

    var id = lesson.id;
    if (hasOwn.call(previous, id) && previous[id] !== entry.path && !hasOwn.call(fallbacks, id)) {
      fallbacks[id] = previous[id];
    }
    if (hasOwn.call(previousSources, id) && previousSources[id]?.kind !== 'nativeears' && !hasOwn.call(sourceFallbacks, id)) {
      sourceFallbacks[id] = previousSources[id];
    }
    previous[id] = entry.path;
    sources[id] = {
      kind: 'nativeears', label: labels[entry.book], title: entry.sourceTitle,
      file: entry.path.slice(entry.path.lastIndexOf('/') + 1), bytes: entry.bytes,
      sha256: entry.sha256, sourcePage: entry.sourcePage, seriesUrl: entry.seriesUrl
    };
  });

  global.LESSONS.sort(function (a, b) {
    return (Number(a?.book) || 0) - (Number(b?.book) || 0)
      || (Number(a?.number) || 0) - (Number(b?.number) || 0);
  });
  global.STUDY_LESSON_AUDIO_FALLBACKS = fallbacks;
  global.PROVIDED_AUDIO_SOURCE_FALLBACKS = sourceFallbacks;
  global.STUDY_LESSON_AUDIO = previous;
  global.PROVIDED_AUDIO_SOURCES = Object.assign(previousSources, sources);
  global.NATIVEEARS_AUDIO_SOURCES = Object.assign(global.NATIVEEARS_AUDIO_SOURCES || {}, sources);
})(window);
