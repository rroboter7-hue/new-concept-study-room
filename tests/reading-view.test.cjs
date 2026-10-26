const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'reading-view.js');
const scope = { window: {} };
if (fs.existsSync(sourcePath)) vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), scope);

class Style {
  constructor() { this.values = new Map(); }
  getPropertyValue(name) { return this.values.get(name)?.value || ''; }
  getPropertyPriority(name) { return this.values.get(name)?.priority || ''; }
  setProperty(name, value, priority = '') { this.values.set(name, { value, priority }); }
  removeProperty(name) { this.values.delete(name); }
}

class Element {
  constructor(classes = [], attrs = {}) {
    this.classes = new Set(classes);
    this.attributes = { ...attrs };
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.style = new Style();
    this.classList = {
      contains: name => this.classes.has(name),
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      toggle: (name, on) => {
        if (on === undefined) on = !this.classes.has(name);
        if (on) this.classes.add(name); else this.classes.delete(name);
        return on;
      }
    };
  }
  append(child) { child.parentElement = this; this.children.push(child); return child; }
  get dataset() { return { sentence: this.attributes['data-sentence'] }; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) {
    if (selector[0] === '.') return this.classes.has(selector.slice(1));
    const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    return Boolean(match && Object.hasOwn(this.attributes, match[1]) && (match[2] === undefined || this.attributes[match[1]] === match[2]));
  }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  contains(node) {
    for (; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
}

// The real controller runs against DOM nodes whose document geometry is controlled here.
function fixture(count = 5, options = {}) {
  assert.equal(typeof scope.window.ReadingView, 'function', 'the reading controller must be available');
  const document = { documentElement: new Element(), body: new Element() };
  document.documentElement.style.setProperty('scroll-behavior', 'smooth', 'important');
  document.body.style.setProperty('scroll-behavior', 'smooth');
  const window = {
    document, innerHeight: 600, scrollY: 390, pendingAnimation: false,
    scrollBy(first, second) {
      const top = typeof first === 'object' ? first.top : second;
      const behavior = typeof first === 'object' ? first.behavior : 'auto';
      const cssBehavior = document.documentElement.style.getPropertyValue('scroll-behavior');
      if (behavior !== 'instant' && cssBehavior === 'smooth') this.pendingAnimation = true;
      else this.scrollY += top;
    }
  };
  const value = {
    root: null, lessonId: 'lesson-a', translated: true, geometryShift: 0, documentTop: 100,
    audioState: { mode: 'tts', lessonId: 'lesson-a', sentenceIndex: 1, playing: true },
    window, document,
    render(translated = this.translated, replaceRoot = false) {
      this.translated = translated;
      if (!this.root || replaceRoot) this.root = new Element(['reading-root']);
      this.root.ownerDocument = document;
      this.root.children = [];
      for (let index = 0; index < count; index++) {
        const pair = this.root.append(new Element(['reading-pair']));
        const english = pair.append(new Element(['english']));
        english.append(new Element(['sentence'], { 'data-sentence': String(index) }));
        const rect = height => {
          const pairHeight = this.translated ? 150 : 50;
          const top = this.documentTop + index * (pairHeight + 30) + this.geometryShift - window.scrollY;
          return { top, bottom: top + height, height, width: 500, left: 0, right: 500 };
        };
        pair.getBoundingClientRect = () => rect(this.translated ? 150 : 50);
        english.getBoundingClientRect = () => rect(30);
        if (translated) pair.append(new Element(['reading-translation']));
      }
      return this.root;
    },
    get rows() { return this.root.querySelectorAll('[data-sentence]'); },
    get pairs() { return this.root.querySelectorAll('.reading-pair'); },
    englishTop(index) { return this.pairs[index].querySelector('.english').getBoundingClientRect().top; }
  };
  value.render();
  value.view = new scope.window.ReadingView({
    getRoot: () => value.root,
    getLessonId: () => value.lessonId,
    getAudioState: () => value.audioState,
    getTopOffset: () => 64,
    window,
    ...options
  });
  return value;
}

function marked(value) {
  return value.rows.map((row, index) => ({
    index, active: row.classList.contains('active'), current: row.getAttribute('aria-current'),
    pair: value.pairs[index].classList.contains('is-current'),
    pairCurrent: value.pairs[index].getAttribute('aria-current')
  })).filter(row => row.active || row.current || row.pair || row.pairCurrent);
}

test('restores the matching TTS sentence and pair after paused reading is redrawn', () => {
  const value = fixture();
  value.view.updatePlayback();
  assert.deepEqual(marked(value), [{ index: 1, active: true, current: 'true', pair: true, pairCurrent: 'true' }]);
  value.audioState.playing = false;
  value.render(false);
  value.view.updatePlayback();
  assert.deepEqual(marked(value), [{ index: 1, active: true, current: 'true', pair: true, pairCurrent: 'true' }]);
  assert.equal(value.window.scrollY, 390);
});

test('clears stale sentence state for MP3 playback, a different lesson, and invalid indices', () => {
  const value = fixture(2);
  for (const changes of [
    { mode: 'audio' }, { lessonId: 'lesson-old' }, { sentenceIndex: -1 },
    { sentenceIndex: 0.5 }, { sentenceIndex: NaN }, { sentenceIndex: '1' }, { sentenceIndex: 2 }
  ]) {
    value.audioState = { mode: 'tts', lessonId: 'lesson-a', sentenceIndex: 1 };
    value.view.updatePlayback();
    assert.equal(marked(value).length, 1);
    Object.assign(value.audioState, changes);
    value.view.updatePlayback();
    assert.deepEqual(marked(value), [], JSON.stringify(changes));
  }
  value.audioState = { mode: 'tts', lessonId: 'lesson-a', sentenceIndex: 0 };
  value.rows[0].setAttribute('data-sentence', '');
  value.view.updatePlayback();
  assert.deepEqual(marked(value), []);
});

test('keeps the visible English sentence in place when translations above it are removed', () => {
  const value = fixture();
  assert.equal(value.englishTop(2), 70);
  const result = value.view.preserve(() => { value.render(false); return 'redrawn'; });
  assert.equal(result, 'redrawn');
  assert.equal(value.englishTop(2), 70);
  assert.equal(value.window.scrollY, 190);
  assert.equal(value.window.pendingAnimation, false);
  assert.equal(value.document.documentElement.style.getPropertyValue('scroll-behavior'), 'smooth');
  assert.equal(value.document.documentElement.style.getPropertyPriority('scroll-behavior'), 'important');
  assert.equal(value.document.body.style.getPropertyValue('scroll-behavior'), 'smooth');
  assert.deepEqual(marked(value), [{ index: 1, active: true, current: 'true', pair: true, pairCurrent: 'true' }]);
});

test('does not scroll for a subpixel layout change or when no reading pair is visible', () => {
  const value = fixture();
  value.view.preserve(() => { value.geometryShift = 0.4; });
  assert.equal(value.window.scrollY, 390);
  value.window.scrollY = 3000;
  value.view.preserve(() => value.render(false));
  assert.equal(value.window.scrollY, 3000);
});

test('does not anchor a sentence visible only behind the fixed bottom player', () => {
  const value = fixture(1, { getBottomOffset: () => 120 });
  value.documentTop = 910;
  assert.equal(value.englishTop(0), 520);
  value.view.preserve(() => { value.geometryShift = -90; });
  assert.equal(value.window.scrollY, 390);
  assert.equal(value.englishTop(0), 430);
});

test('keeps a normally visible sentence in place with a bottom player or invalid bottom offset', () => {
  for (const bottomOffset of [120, 0, -20, NaN, Infinity, undefined]) {
    const value = fixture(5, { getBottomOffset: () => bottomOffset });
    assert.equal(value.englishTop(2), 70);
    value.view.preserve(() => value.render(false));
    assert.equal(value.englishTop(2), 70, String(bottomOffset));
    assert.equal(value.window.scrollY, 190, String(bottomOffset));
  }
});

test('does not restore an old sentence into another lesson or a replaced reading root', () => {
  for (const change of ['lesson', 'root']) {
    const value = fixture();
    value.view.preserve(() => {
      if (change === 'lesson') value.lessonId = 'lesson-b';
      value.render(false, change === 'root');
    });
    assert.equal(value.window.scrollY, 390, change);
    if (change === 'lesson') assert.deepEqual(marked(value), []);
  }
});

test('does not anchor malformed sentence identities or detached reading roots', () => {
  const value = fixture();
  value.rows.forEach(row => row.setAttribute('data-sentence', 'invalid'));
  value.view.preserve(() => { value.geometryShift = -100; });
  assert.equal(value.window.scrollY, 390);
  value.render(true);
  value.root.isConnected = false;
  value.view.preserve(() => value.render(false));
  assert.equal(value.window.scrollY, 390);
});

test('missing reading roots still run the requested action without scrolling or highlighting', () => {
  const value = fixture();
  value.root = null;
  assert.doesNotThrow(() => value.view.updatePlayback());
  let called = 0;
  assert.equal(value.view.preserve(() => ++called), 1);
  assert.equal(called, 1);
  assert.equal(value.window.scrollY, 390);
});

test('propagates redraw errors without scrolling the old lesson', () => {
  const value = fixture();
  const failure = new Error('redraw failed');
  assert.throws(() => value.view.preserve(() => {
    value.render(false);
    value.lessonId = 'lesson-b';
    throw failure;
  }), error => error === failure);
  assert.equal(value.window.scrollY, 390);
});
