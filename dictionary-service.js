(function (root, factory) {
  'use strict';
  const service = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = service;
  else root.StudyDictionary = service;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const messages = {
    'invalid-word': 'Enter a single English word of up to 64 letters.',
    'not-found': 'This word was not found in the online dictionary.',
    'rate-limit': 'The online dictionary is receiving too many requests.',
    timeout: 'The online dictionary request timed out.',
    aborted: 'The online dictionary request was cancelled.',
    unavailable: 'The online dictionary is unavailable.'
  };
  function failure(code) {
    const error = new Error(messages[code]);
    error.code = code;
    return error;
  }
  function wordOf(value) {
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return word.length <= 64 && /^[a-z]+(?:[-'][a-z]+)*$/.test(word) ? word : '';
  }
  const encoded = word => encodeURIComponent(word).replace(/'/g, '%27');
  const localShardLimit = 4;
  const localShards = new Map();
  function rememberLocalShard(letter, entries) {
    localShards.delete(letter);
    localShards.set(letter, entries);
    if (localShards.size > localShardLimit) localShards.delete(localShards.keys().next().value);
  }
  function text(value, limit) {
    return typeof value === 'string' ? value
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, limit) : '';
  }
  function parse(data, word) {
    const entries = (Array.isArray(data) ? data : []).slice(0, 6);
    const meanings = entries.flatMap(entry => Array.isArray(entry?.meanings) ? entry.meanings.slice(0, 12) : [])
      .map(meaning => ({
        partOfSpeech: text(meaning?.partOfSpeech, 40),
        definitions: (Array.isArray(meaning?.definitions) ? meaning.definitions : []).slice(0, 20)
          .map(item => ({definition: text(item?.definition, 1200), example: text(item?.example, 1200)}))
          .filter(item => item.definition).slice(0, 4)
      })).filter(meaning => meaning.definitions.length).slice(0, 6);
    if (!meanings.length) throw failure('unavailable');
    const phonetic = entries.map(entry => text(entry?.phonetic, 120) ||
      (Array.isArray(entry?.phonetics) ? entry.phonetics.slice(0, 20).map(item => text(item?.text, 120)).find(Boolean) : '')).find(Boolean) || '';
    return {
      word, phonetic, pos: meanings[0].partOfSpeech,
      definition: meanings[0].definitions[0].definition, example: meanings[0].definitions[0].example,
      meanings, sourceName: 'Free Dictionary API', sourceUrl: 'https://dictionaryapi.dev/', language: 'en'
    };
  }
  async function lookup(input, {signal, timeoutMs = 5000, fetch: providedFetch} = {}) {
    const word = wordOf(input);
    if (!word) throw failure('invalid-word');
    if (signal?.aborted) throw failure('aborted');
    const fetcher = providedFetch || root.fetch;
    if (typeof fetcher !== 'function') throw failure('unavailable');
    const controller = new AbortController();
    const delay = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 30000) : 5000;
    let timer, reason, rejectCancelled;
    const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
    const cancel = code => {
      if (reason) return;
      reason = code;
      rejectCancelled(failure(code));
      controller.abort();
    };
    const onAbort = () => cancel('aborted');
    try {
      signal?.addEventListener('abort', onAbort, {once: true});
      timer = setTimeout(() => cancel('timeout'), delay);
      const request = (async () => {
        const response = await fetcher.call(root, 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encoded(word), {
          signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
        });
        if (!response?.ok) throw failure(response?.status === 404 ? 'not-found' : response?.status === 429 ? 'rate-limit' : 'unavailable');
        return parse(await response.json(), word);
      })();
      return await Promise.race([request, cancelled]);
    } catch (error) {
      if (reason) throw failure(reason);
      if (Object.hasOwn(messages, error?.code)) throw error;
      throw failure('unavailable');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  function parseLocal(entries, word) {
    if (!Object.hasOwn(entries, word)) return null;
    const raw = entries[word];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const translated = text(raw.translation, 1200);
    const translation = /[\u3400-\u9fff]/.test(translated) ? translated : '';
    const definitions = (typeof raw.definition === 'string' ? raw.definition.split(/\\n|\r?\n/) : [])
      .slice(0, 8).map(definition => ({definition: text(definition, 600), example: ''}))
      .filter(item => item.definition).slice(0, 4);
    if (!translation && !definitions.length) return null;
    const pos = text(raw.pos, 40);
    return {word, headword: wordOf(raw.headword) || word, translation,
      definition: definitions[0]?.definition || '', example: '', phonetic: text(raw.phonetic, 120), pos,
      meanings: definitions.length ? [{partOfSpeech: pos, definitions}] : [],
      sourceName: 'ECDICT', sourceUrl: 'https://github.com/skywind3000/ECDICT', language: 'en-zh'};
  }
  async function lookupLocal(input, {signal, timeoutMs = 5000, fetch: providedFetch} = {}) {
    const word = wordOf(input);
    if (!word) throw failure('invalid-word');
    if (signal?.aborted) throw failure('aborted');
    const letter = word[0];
    if (localShards.has(letter)) {
      const entries = localShards.get(letter);
      rememberLocalShard(letter, entries);
      return parseLocal(entries, word);
    }
    const fetcher = providedFetch || root.fetch;
    if (typeof fetcher !== 'function') throw failure('unavailable');
    const controller = new AbortController();
    const delay = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 30000) : 5000;
    let timer, reason, rejectCancelled;
    const cancelled = new Promise((_resolve, reject) => { rejectCancelled = reject; });
    const cancel = code => {
      if (reason) return;
      reason = code; rejectCancelled(failure(code)); controller.abort();
    };
    const onAbort = () => cancel('aborted');
    try {
      signal?.addEventListener('abort', onAbort, {once:true});
      timer = setTimeout(() => cancel('timeout'), delay);
      const request = (async () => {
        const response = await fetcher.call(root, 'dictionary-data/' + letter + '.json?build=2026-10-27-bilingual-v1', {
          signal: controller.signal, credentials:'omit', referrerPolicy:'no-referrer', cache:'force-cache'
        });
        if (response?.status === 404) return null;
        if (!response?.ok) throw failure('unavailable');
        const data = await response.json();
        if (data?.version !== 1 || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw failure('unavailable');
        if (reason || signal?.aborted) throw failure(reason || 'aborted');
        rememberLocalShard(letter, data.entries);
        return parseLocal(data.entries, word);
      })();
      return await Promise.race([request, cancelled]);
    } catch (error) {
      if (reason) throw failure(reason);
      if (Object.hasOwn(messages, error?.code)) throw error;
      throw failure('unavailable');
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
    }
  }
  function links(input) {
    const word = wordOf(input);
    return word ? [{name: '有道词典（中英）', url: 'https://www.youdao.com/result?word=' + encoded(word) + '&lang=en', language: 'zh-CN'}] : [];
  }
  return {lookup, lookupLocal, links};
});
