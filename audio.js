(function (global) {
  'use strict';

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var now = function () { return global.performance ? global.performance.now() : Date.now(); };
  var finite = function (value) { return Number.isFinite(value) && value > 0 ? value : 0; };

  function makeError(message, cause, name) {
    var error = new Error(message);
    if (cause) error.cause = cause;
    if (name) error.name = name;
    return error;
  }

  function sentenceTexts(lesson) {
    if (!lesson) return [];
    if (global.StudyReading && typeof global.StudyReading.units === 'function') return global.StudyReading.units(lesson).map(function (row) { return row.en; });
    var source = lesson.paragraphs || [];
    if (!Array.isArray(source)) source = source.en || [];
    if (!Array.isArray(source)) source = [source];
    var result = [];
    source.forEach(function (paragraph) {
      var text = typeof paragraph === 'string' ? paragraph : paragraph && paragraph.en;
      if (typeof text !== 'string') return;
      var sentences = text.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g) || [];
      sentences.forEach(function (sentence) {
        sentence = sentence.trim();
        if (sentence) result.push(sentence);
      });
    });
    return result;
  }

  function speechError(event) {
    var code = event && event.error;
    var messages = {
      'not-allowed': '浏览器阻止了朗读，请点击播放重试，并允许网站播放声音。',
      'audio-busy': '音频设备正忙，请稍后重试。',
      'audio-hardware': '音频设备不可用，请检查扬声器或耳机。',
      'network': '语音服务连接失败，请检查网络或导入音频。',
      'synthesis-unavailable': '当前设备没有可用的语音服务，请安装英语语音或导入音频。',
      'synthesis-failed': '语音合成失败，请重试或导入音频。',
      'language-unavailable': '当前设备没有可用的英语语音，请安装英语语音或导入音频。',
      'voice-unavailable': '所选英语语音不可用，请更换口音或导入音频。',
      'text-too-long': '这段文字过长，浏览器无法朗读。',
      'interrupted': '朗读被浏览器中断，请点击播放重试。',
      'canceled': '朗读被浏览器取消，请点击播放重试。'
    };
    return makeError(messages[code] || '朗读失败，请检查浏览器语音设置或导入音频。', event);
  }

  function audioPath(value) {
    if (typeof value !== 'string' || !value.trim()) throw makeError('音频地址无效。');
    var path = value.trim();
    if (global.location && typeof global.URL === 'function') {
      var resolved;
      try { resolved = new global.URL(path, global.location.href); }
      catch (error) { throw makeError('音频地址无效。', error); }
      if (resolved.origin !== global.location.origin || !/^https?:$/.test(resolved.protocol)) throw makeError('只支持本站的音频地址。');
    } else if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) {
      throw makeError('只支持本站的音频地址。');
    }
    return path;
  }

  class StudyAudio {
    constructor(options) {
      options = options || {};
      this._callbacks = options;
      this._synth = global.speechSynthesis || null;
      this._lesson = null;
      this._sentences = [];
      this._starts = [];
      this._lengths = [];
      this._baseDuration = 0;
      this._baseTime = 0;
      this._clockBase = 0;
      this._clockStart = 0;
      this._cursor = 0;
      this._playing = false;
      this._voice = 'en-GB';
      this._rate = 1;
      this._loop = false;
      this._mode = 'tts';
      this._mediaSource = 'tts';
      this._audio = null;
      this._audioURL = null;
      this._audioListeners = [];
      this._mediaRequest = 0;
      this._utterance = null;
      this._ttsPaused = false;
      this._token = 0;
      this._timer = null;
      this._startTimer = null;
      this._word = null;
      this._destroyed = false;
    }

    static splitSentences(lesson) { return sentenceTexts(lesson); }

    get state() {
      var audio = this._mode === 'audio' && this._audio;
      var duration = audio ? finite(audio.duration) : this._baseDuration / this._rate;
      var currentTime = audio ? Math.max(0, Number(audio.currentTime) || 0) : this._readBaseTime() / this._rate;
      return {
        playing: this._playing,
        mode: this._mode,
        mediaSource: this._mediaSource,
        currentTime: currentTime,
        duration: duration,
        rate: this._rate,
        voice: this._voice,
        loop: this._loop,
        isEstimated: !audio,
        canSeek: !this._destroyed && duration > 0 && (Boolean(audio) || this._sentences.length > 0),
        available: !this._destroyed && (audio ? typeof audio.play === 'function' : Boolean(this._synth && global.SpeechSynthesisUtterance)),
        sentenceIndex: audio ? -1 : (this._sentences.length ? Math.min(this._cursor, this._sentences.length - 1) : -1),
        speakingWord: Boolean(this._word)
      };
    }

    _callback(name) {
      var callback = this._callbacks[name];
      if (typeof callback !== 'function') return;
      try { callback.apply(null, Array.prototype.slice.call(arguments, 1)); }
      catch (error) { if (global.console) global.console.error('StudyAudio callback failed:', error); }
    }

    _emitState() { this._callback('onState', this.state); }
    _emitProgress() {
      var state = this.state;
      this._callback('onProgress', {
        currentTime: state.currentTime,
        duration: state.duration,
        progress: state.duration ? clamp(state.currentTime / state.duration, 0, 1) : 0,
        isEstimated: state.isEstimated
      });
    }
    _report(error) { this._callback('onError', error.message, error); return error; }

    _readBaseTime() {
      if (!this._playing || this._mode !== 'tts' || !this._utterance || !this._clockStart) return this._baseTime;
      var end = (this._starts[this._cursor] || 0) + (this._lengths[this._cursor] || 0);
      return clamp(this._clockBase + ((now() - this._clockStart) / 1000) * this._rate, 0, Math.max(0, end - 0.01));
    }

    _clearTimer() {
      if (this._timer !== null) global.clearInterval(this._timer);
      if (this._startTimer !== null) global.clearTimeout(this._startTimer);
      this._timer = null;
      this._startTimer = null;
    }

    _startProgressTimer() {
      if (this._timer !== null) global.clearInterval(this._timer);
      this._timer = global.setInterval(() => { if (this._playing) this._emitProgress(); }, 150);
    }

    _cancelWord(reason) {
      if (!this._word) return;
      var word = this._word;
      this._word = null;
      global.clearTimeout(word.timer);
      if (word.kind === 'audio') word.cleanup();
      else if (this._synth) this._synth.cancel();
      word.reject(makeError(reason || '单词朗读已取消。', null, 'AbortError'));
    }

    _cancelTts() {
      var hadUtterance = Boolean(this._utterance);
      this._token += 1;
      this._clearTimer();
      this._utterance = null;
      this._ttsPaused = false;
      this._clockStart = 0;
      if (hadUtterance && this._synth) this._synth.cancel();
    }

    _releaseAudio() {
      if (this._audio) {
        this._audioListeners.forEach((entry) => this._audio.removeEventListener(entry[0], entry[1]));
        this._audio.pause();
        this._audio.removeAttribute('src');
        this._audio.load();
      }
      this._audioListeners = [];
      this._audio = null;
      if (this._audioURL && global.URL) global.URL.revokeObjectURL(this._audioURL);
      this._audioURL = null;
    }

    setLesson(lesson, blob) {
      this.stop();
      this._releaseAudio();
      this._lesson = lesson || null;
      this._sentences = sentenceTexts(lesson);
      this._baseDuration = 0;
      this._starts = [];
      this._lengths = this._sentences.map((text) => {
        this._starts.push(this._baseDuration);
        var words = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || [];
        var length = Math.max(0.8, words.length / 2.65 + 0.2);
        this._baseDuration += length;
        return length;
      });
      this._baseTime = 0;
      this._cursor = 0;
      this._mode = 'tts';
      this._mediaSource = 'tts';
      if (blob != null) {
        try {
          if (!global.Audio) throw makeError('当前浏览器不支持音频文件播放。');
          var sourceURL;
          if (typeof blob === 'string') {
            sourceURL = audioPath(blob);
            this._mediaSource = 'generated';
          } else {
            if (!global.Blob || !(blob instanceof global.Blob)) throw makeError('请导入有效的音频文件。');
            if (!global.URL || !global.URL.createObjectURL) throw makeError('当前浏览器不支持音频文件播放。');
            this._audioURL = global.URL.createObjectURL(blob);
            sourceURL = this._audioURL;
            this._mediaSource = 'imported';
          }
          var audio = new global.Audio();
          this._audio = audio;
          this._mode = 'audio';
          audio.preload = 'metadata';
          audio.playbackRate = this._rate;
          audio.loop = this._loop;
          var listen = (name, callback) => {
            audio.addEventListener(name, callback);
            this._audioListeners.push([name, callback]);
          };
          listen('loadedmetadata', () => { this._emitState(); this._emitProgress(); });
          listen('durationchange', () => { this._emitState(); this._emitProgress(); });
          listen('timeupdate', () => this._emitProgress());
          listen('play', () => { this._playing = true; this._emitState(); });
          listen('pause', () => { this._playing = false; this._emitState(); this._emitProgress(); });
          listen('ended', () => { this._playing = false; this._emitState(); this._emitProgress(); });
          listen('error', () => {
            this._playing = false;
            var code = audio.error && audio.error.code;
            this._report(makeError(code === 4 ? '浏览器无法解码此音频，请换用 MP3、WAV 或浏览器支持的格式。' : '音频加载或播放失败，请重新导入有效的音频文件。', audio.error));
            this._emitState();
          });
          audio.src = sourceURL;
          audio.load();
        } catch (error) {
          this._releaseAudio();
          this._mode = 'tts';
          this._mediaSource = 'tts';
          this._emitState();
          throw this._report(error);
        }
      }
      this._callback('onSentence', this._mode === 'audio' ? -1 : (this._sentences.length ? 0 : -1));
      this._emitState();
      this._emitProgress();
      return this;
    }

    _chooseVoice() {
      var voices = this._synth.getVoices ? this._synth.getVoices() : [];
      var english = voices.filter(function (voice) { return /^en(?:-|_)/i.test(voice.lang || '') || /^en$/i.test(voice.lang || ''); });
      if (voices.length && !english.length) throw makeError('当前设备没有可用的英语语音，请安装英语语音或导入音频。');
      return english.find((voice) => voice.lang.toLowerCase().replace('_', '-') === this._voice.toLowerCase()) || english[0] || null;
    }

    _newUtterance(text) {
      if (!this._synth || !global.SpeechSynthesisUtterance) throw makeError('当前浏览器不支持语音朗读，请使用支持语音的浏览器或导入音频。');
      var utterance = new global.SpeechSynthesisUtterance(text);
      utterance.lang = this._voice;
      utterance.rate = this._rate;
      var voice = this._chooseVoice();
      if (voice) utterance.voice = voice;
      return utterance;
    }

    _failTts(error) {
      this._playing = false;
      this._baseTime = this._starts[this._cursor] || 0;
      this._cancelTts();
      this._report(error);
      this._emitState();
      this._emitProgress();
    }

    _startSentence() {
      if (!this._playing) return;
      if (this._cursor >= this._sentences.length) {
        if (this._loop && this._sentences.length) {
          this._cursor = 0;
          this._baseTime = 0;
        } else {
          this._baseTime = this._baseDuration;
          this._playing = false;
          this._utterance = null;
          this._clearTimer();
          this._emitState();
          this._emitProgress();
          return;
        }
      }
      var utterance;
      try { utterance = this._newUtterance(this._sentences[this._cursor]); }
      catch (error) { this._failTts(error); throw error; }
      var token = ++this._token;
      this._utterance = utterance;
      this._ttsPaused = false;
      this._baseTime = this._starts[this._cursor];
      this._clockBase = this._baseTime;
      this._clockStart = 0;
      utterance.onstart = () => {
        if (token !== this._token) return;
        if (this._startTimer !== null) global.clearTimeout(this._startTimer);
        this._startTimer = null;
        this._clockStart = now();
        this._startProgressTimer();
        this._emitState();
      };
      utterance.onend = () => {
        if (token !== this._token) return;
        this._clearTimer();
        this._baseTime = this._starts[this._cursor] + this._lengths[this._cursor];
        this._clockStart = 0;
        this._utterance = null;
        this._cursor += 1;
        this._emitProgress();
        if (this._playing) {
          try { this._startSentence(); } catch (_) { /* Reported by _startSentence. */ }
        }
      };
      utterance.onerror = (event) => { if (token === this._token) this._failTts(speechError(event)); };
      this._startTimer = global.setTimeout(() => {
        if (token === this._token && this._playing && !this._clockStart) this._failTts(makeError('浏览器语音未能启动，请点击播放重试，或导入音频。'));
      }, 12000);
      this._callback('onSentence', this._cursor);
      this._emitProgress();
      this._emitState();
      try {
        this._synth.resume();
        this._synth.speak(utterance);
      } catch (error) {
        var wrapped = makeError('浏览器无法启动朗读，请重试或导入音频。', error);
        this._failTts(wrapped);
        throw wrapped;
      }
    }

    async play() {
      if (this._destroyed) throw this._report(makeError('播放器已关闭，请刷新页面后重试。'));
      this._cancelWord('单词朗读已取消，开始播放课文。');
      if (this._playing) return;
      if (this._mode === 'audio' && this._audio) {
        var audio = this._audio;
        var request = ++this._mediaRequest;
        try {
          await audio.play();
          if (request !== this._mediaRequest || audio !== this._audio) return;
          this._playing = !audio.paused;
          this._emitState();
        } catch (error) {
          if (request !== this._mediaRequest || audio !== this._audio) return;
          this._playing = false;
          this._emitState();
          throw this._report(makeError(error && error.name === 'NotAllowedError' ? '浏览器阻止了音频，请点击播放按钮重试。' : '音频无法播放，请检查格式或重新导入。', error));
        }
        return;
      }
      if (!this._sentences.length) throw this._report(makeError('本课暂无可朗读的英文内容。'));
      if (!this._synth || !global.SpeechSynthesisUtterance) throw this._report(makeError('当前浏览器不支持语音朗读，请使用支持语音的浏览器或导入音频。'));
      this._playing = true;
      if (this._ttsPaused && this._utterance) {
        this._ttsPaused = false;
        this._clockBase = this._baseTime;
        this._clockStart = now();
        this._synth.resume();
        this._startProgressTimer();
        this._emitState();
      } else {
        if (this._cursor >= this._sentences.length) { this._cursor = 0; this._baseTime = 0; }
        this._startSentence();
      }
    }

    pause() {
      this._cancelWord('单词朗读已暂停。');
      this._mediaRequest += 1;
      if (this._mode === 'audio' && this._audio) {
        this._audio.pause();
      } else if (this._playing) {
        var hadStarted = Boolean(this._clockStart);
        this._baseTime = this._readBaseTime();
        this._clockStart = 0;
        this._clearTimer();
        this._ttsPaused = Boolean(this._utterance) && hadStarted;
        if (this._ttsPaused && this._synth) this._synth.pause();
        else this._cancelTts();
      }
      this._playing = false;
      this._emitState();
      this._emitProgress();
      return this;
    }

    stop() {
      this._cancelWord('单词朗读已停止。');
      this._mediaRequest += 1;
      this._playing = false;
      this._cancelTts();
      if (this._audio) {
        this._audio.pause();
        try { this._audio.currentTime = 0; } catch (_) { /* Metadata may not be ready. */ }
      }
      this._cursor = 0;
      this._baseTime = 0;
      this._callback('onSentence', this._mode === 'audio' || !this._sentences.length ? -1 : 0);
      this._emitState();
      this._emitProgress();
      return this;
    }

    seek(fraction) {
      fraction = Number(fraction);
      if (!Number.isFinite(fraction) || !this.state.canSeek) return false;
      fraction = clamp(fraction, 0, 1);
      if (this._mode === 'audio') {
        try { this._audio.currentTime = this._audio.duration * fraction; }
        catch (error) { this._report(makeError('音频暂时无法跳转，请等待音频加载完成。', error)); return false; }
        this._emitProgress();
        return true;
      }
      var wasPlaying = this._playing;
      this._cancelWord('单词朗读已取消，已跳转课文位置。');
      this._cancelTts();
      var target = this._baseDuration * fraction;
      this._cursor = fraction === 1 ? this._sentences.length : Math.max(0, this._starts.findIndex((start, index) => target >= start && target < start + this._lengths[index]));
      this._baseTime = this._cursor < this._sentences.length ? this._starts[this._cursor] : this._baseDuration;
      this._playing = wasPlaying;
      this._callback('onSentence', Math.min(this._cursor, this._sentences.length - 1));
      this._emitProgress();
      this._emitState();
      if (wasPlaying) { try { this._startSentence(); } catch (_) { return false; } }
      return true;
    }

    _changeTtsSetting() {
      if (this._mode !== 'tts' || !this._utterance) return;
      var wasPlaying = this._playing;
      this._cancelTts();
      this._baseTime = this._starts[this._cursor] || 0;
      if (wasPlaying) { try { this._startSentence(); } catch (_) { /* Already reported. */ } }
    }

    setRate(value) {
      value = Number(value);
      if (!Number.isFinite(value)) return this;
      this._rate = clamp(value, 0.5, 2);
      this._cancelWord('单词朗读已取消，语速已更改。');
      if (this._audio) this._audio.playbackRate = this._rate;
      this._changeTtsSetting();
      this._emitState();
      this._emitProgress();
      return this;
    }

    setVoice(value) {
      if (value !== 'en-GB' && value !== 'en-US') return this;
      if (value === this._voice) return this;
      this._voice = value;
      this._cancelWord('单词朗读已取消，口音已更改。');
      this._changeTtsSetting();
      this._emitState();
      this._emitProgress();
      return this;
    }

    setLoop(value) {
      this._loop = Boolean(value);
      if (this._audio) this._audio.loop = this._loop;
      this._emitState();
      return this;
    }

    speakWord(word) {
      if (this._destroyed) return Promise.reject(this._report(makeError('播放器已关闭，请刷新页面后重试。')));
      word = String(word || '').trim();
      if (!word) return Promise.reject(this._report(makeError('请选择要朗读的单词。')));
      if (word.length > 200) return Promise.reject(this._report(makeError('单次发音内容过长，请选择一个单词或短语。')));
      this.pause();
      // A word uses the same speech service; keep the lesson paused at this sentence.
      if (this._mode === 'tts') {
        this._cancelTts();
        this._baseTime = this._cursor >= this._sentences.length ? this._baseDuration : (this._starts[this._cursor] || 0);
        this._emitProgress();
      }
      var recordedPath = global.STUDY_WORD_AUDIO && global.STUDY_WORD_AUDIO[word.toLowerCase()];
      if (typeof recordedPath === 'string' && recordedPath) return this._speakRecordedWord(recordedPath);
      var utterance;
      try { utterance = this._newUtterance(word); }
      catch (error) { return Promise.reject(this._report(error)); }
      return new Promise((resolve, reject) => {
        var entry = { kind: 'tts', utterance: utterance, reject: reject, timer: null };
        this._word = entry;
        var finish = (error) => {
          if (this._word !== entry) return;
          this._word = null;
          global.clearTimeout(entry.timer);
          this._emitState();
          if (error) reject(this._report(error)); else resolve();
        };
        utterance.onstart = () => { global.clearTimeout(entry.timer); };
        utterance.onend = () => finish();
        utterance.onerror = (event) => finish(speechError(event));
        entry.timer = global.setTimeout(() => {
          if (this._word !== entry) return;
          finish(makeError('单词发音未能启动，请重试或检查浏览器语音设置。'));
          if (this._synth) this._synth.cancel();
        }, 12000);
        this._emitState();
        try { this._synth.resume(); this._synth.speak(utterance); }
        catch (error) { finish(makeError('无法播放单词发音，请重试。', error)); }
      });
    }

    _speakRecordedWord(path) {
      var audio;
      try {
        if (!global.Audio) throw makeError('当前浏览器不支持单词音频播放。');
        audio = new global.Audio();
        audio.preload = 'auto';
        audio.playbackRate = this._rate;
        audio.src = audioPath(path);
      } catch (error) { return Promise.reject(this._report(error)); }
      return new Promise((resolve, reject) => {
        var entry = { kind: 'audio', audio: audio, reject: reject, timer: null, cleanup: null };
        var listeners = [];
        var listen = function (name, callback) { audio.addEventListener(name, callback); listeners.push([name, callback]); };
        entry.cleanup = function () {
          listeners.forEach(function (listener) { audio.removeEventListener(listener[0], listener[1]); });
          listeners = [];
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        };
        this._word = entry;
        var finish = (error) => {
          if (this._word !== entry) return;
          this._word = null;
          global.clearTimeout(entry.timer);
          entry.cleanup();
          this._emitState();
          if (error) reject(this._report(error)); else resolve();
        };
        listen('playing', function () { global.clearTimeout(entry.timer); });
        listen('ended', () => finish());
        listen('error', () => finish(makeError('单词音频加载或播放失败，请检查网络后重试。', audio.error)));
        entry.timer = global.setTimeout(() => finish(makeError('单词音频未能启动，请检查网络后重试。')), 12000);
        this._emitState();
        try {
          var started = audio.play();
          if (started && typeof started.catch === 'function') started.catch((error) => {
            finish(makeError(error && error.name === 'NotAllowedError' ? '浏览器阻止了单词音频，请再次点击单词重试。' : '单词音频无法播放，请重试。', error));
          });
        } catch (error) { finish(makeError('单词音频无法播放，请重试。', error)); }
      });
    }

    destroy() {
      this.stop();
      this._releaseAudio();
      this._destroyed = true;
      this._emitState();
    }
  }

  var databasePromise = null;
  function database() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(makeError('当前浏览器不支持本地音频保存。')); return; }
      var request;
      try { request = global.indexedDB.open('new-concept-study-files', 1); }
      catch (error) { reject(makeError('无法打开本地音频存储，请检查浏览器隐私设置。', error)); return; }
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains('audio')) request.result.createObjectStore('audio');
      };
      request.onerror = function () { reject(makeError('无法打开本地音频存储。', request.error)); };
      request.onblocked = function () { reject(makeError('本地音频存储被其他页面占用，请关闭旧页面后重试。')); };
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () { db.close(); databasePromise = null; };
        resolve(db);
      };
    }).catch(function (error) { databasePromise = null; throw error; });
    return databasePromise;
  }

  async function audioTransaction(id, mode, operation) {
    id = String(id == null ? '' : id).trim();
    if (!id) throw makeError('保存音频需要有效的课文编号。');
    var db = await database();
    return new Promise(function (resolve, reject) {
      var transaction;
      var value = null;
      try {
        transaction = db.transaction('audio', mode);
        var request = operation(transaction.objectStore('audio'), id);
        request.onsuccess = function () { value = request.result == null ? null : request.result; };
      } catch (error) { reject(makeError('本地音频操作失败。', error)); return; }
      transaction.oncomplete = function () { resolve(value); };
      transaction.onerror = function () { reject(makeError('本地音频操作失败，可能是存储空间不足或浏览器限制。', transaction.error)); };
      transaction.onabort = function () { reject(makeError('本地音频操作被中断，资料未能保存。', transaction.error)); };
    });
  }

  global.StudyAudio = StudyAudio;
  global.StudyFiles = {
    putAudio: async function (id, blob) {
      if (!global.Blob || !(blob instanceof global.Blob)) throw makeError('请选择有效的音频文件。');
      await audioTransaction(id, 'readwrite', function (store, key) { return store.put(blob, key); });
    },
    getAudio: function (id) { return audioTransaction(id, 'readonly', function (store, key) { return store.get(key); }); },
    removeAudio: async function (id) { await audioTransaction(id, 'readwrite', function (store, key) { return store.delete(key); }); }
  };
})(window);
