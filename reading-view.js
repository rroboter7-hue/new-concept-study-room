/* Reading-only playback markers and synchronous redraw position preservation. */
(function (global) {
  'use strict';

  function sentenceIndex(row) {
    var value = row.getAttribute('data-sentence');
    if (!/^(?:0|[1-9]\d*)$/.test(value || '')) return null;
    var index = Number(value);
    return Number.isSafeInteger(index) ? index : null;
  }

  function available(root) { return Boolean(root && root.isConnected !== false); }

  function scrollImmediately(window, root, delta) {
    if (!window || typeof window.scrollBy !== 'function') return;
    var document = root.ownerDocument || window.document;
    var styles = document ? [document.documentElement, document.body].filter(function (node) {
      return node && node.style && typeof node.style.setProperty === 'function';
    }).map(function (node) {
      var style = node.style;
      var saved = { style: style, value: style.getPropertyValue('scroll-behavior'), priority: style.getPropertyPriority('scroll-behavior') };
      style.setProperty('scroll-behavior', 'auto', 'important');
      return saved;
    }) : [];
    try { window.scrollBy(0, delta); }
    finally {
      styles.forEach(function (saved) {
        if (saved.value) saved.style.setProperty('scroll-behavior', saved.value, saved.priority);
        else saved.style.removeProperty('scroll-behavior');
      });
    }
  }

  class ReadingView {
    constructor(options) {
      options = options || {};
      this._getRoot = options.getRoot || function () { return null; };
      this._getLessonId = options.getLessonId || function () { return null; };
      this._getAudioState = options.getAudioState || function () { return null; };
      this._getTopOffset = options.getTopOffset || function () { return 0; };
      this._getBottomOffset = options.getBottomOffset || function () { return 0; };
      this._window = options.window || global;
    }

    updatePlayback() {
      var root = this._getRoot();
      if (!available(root)) return this;
      var state = this._getAudioState();
      var lessonId = this._getLessonId();
      var index = state && state.mode === 'tts' && lessonId != null && lessonId !== '' && state.lessonId === lessonId && Number.isSafeInteger(state.sentenceIndex) && state.sentenceIndex >= 0 ? state.sentenceIndex : null;
      var current = null;
      root.querySelectorAll('[data-sentence]').forEach(function (row) {
        row.classList.remove('active');
        row.removeAttribute('aria-current');
        if (!current && index !== null && sentenceIndex(row) === index) current = row;
      });
      root.querySelectorAll('.reading-pair').forEach(function (pair) {
        pair.classList.remove('is-current');
        pair.removeAttribute('aria-current');
      });
      if (current) {
        var pair = current.closest('.reading-pair');
        if (pair && root.contains(pair)) {
          current.classList.add('active');
          current.setAttribute('aria-current', 'true');
          pair.classList.add('is-current');
          pair.setAttribute('aria-current', 'true');
        }
      }
      return this;
    }

    preserve(action) {
      var root = this._getRoot();
      var lessonId = this._getLessonId();
      var anchor = null;
      if (available(root) && lessonId != null && lessonId !== '') {
        var top = Math.max(0, Number(this._getTopOffset()) || 0);
        var height = Number(this._window.innerHeight) || root.ownerDocument?.documentElement?.clientHeight || 0;
        var bottom = Number(this._getBottomOffset());
        if (Number.isFinite(bottom) && bottom >= 0) height -= bottom;
        var pairs = height > top ? root.querySelectorAll('.reading-pair') : [];
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          var bounds = pair.getBoundingClientRect();
          if (bounds.bottom <= top || bounds.top >= height || bounds.bottom <= bounds.top) continue;
          var row = pair.querySelector('[data-sentence]');
          var english = pair.querySelector('.english');
          if (!row || !english || sentenceIndex(row) === null) continue;
          var englishTop = english.getBoundingClientRect().top;
          if (Number.isFinite(englishTop)) {
            anchor = { index: sentenceIndex(row), top: englishTop };
            break;
          }
        }
      }
      var result = action();
      this.updatePlayback();
      if (!anchor || this._getLessonId() !== lessonId || this._getRoot() !== root || !available(root)) return result;
      var rows = root.querySelectorAll('[data-sentence]');
      for (var j = 0; j < rows.length; j++) {
        if (sentenceIndex(rows[j]) !== anchor.index) continue;
        var nextPair = rows[j].closest('.reading-pair');
        var nextEnglish = nextPair && root.contains(nextPair) && nextPair.querySelector('.english');
        if (!nextEnglish) break;
        var delta = nextEnglish.getBoundingClientRect().top - anchor.top;
        if (Number.isFinite(delta) && Math.abs(delta) >= 1) scrollImmediately(this._window, root, delta);
        break;
      }
      return result;
    }
  }

  global.ReadingView = ReadingView;
})(window);
