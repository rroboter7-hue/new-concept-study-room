const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../dictionary-service.js'), 'utf8');
const words = {a: ['apple', 'also'], b: ['book'], c: ['cat'], d: ['dog'], e: ['echo']};

function shard(letter, attempt) {
  return {version: 1, entries: Object.fromEntries(words[letter].map(word => [word, {
    translation: `词义 ${letter} ${attempt}`, definition: `${word} definition ${attempt}.`,
    phonetic: '/test/', headword: word, pos: 'noun'
  }]))};
}

function setup(fetchResult = ({letter, attempt}) => new Response(JSON.stringify(shard(letter, attempt)))) {
  const requests = [], counts = new Map();
  const scope = {AbortController, setTimeout, clearTimeout, fetch: async (url, options) => {
    const match = /^dictionary-data\/([a-e])\.json(?:\?[^#]*)?$/.exec(url);
    assert.ok(match, 'local shards must use the same-origin dictionary URL');
    const letter = match[1], attempt = (counts.get(letter) || 0) + 1;
    counts.set(letter, attempt);
    requests.push({letter, options});
    return fetchResult({letter, attempt, options});
  }};
  scope.window = scope;
  vm.createContext(scope);
  vm.runInContext(source, scope);
  return {service: scope.StudyDictionary, requests, counts};
}

test('keeps four local shards and rereads the oldest after a fifth shard is loaded', async () => {
  const h = setup();
  for (const word of ['apple', 'book', 'cat', 'dog']) await h.service.lookupLocal(word);
  for (const [word, translation] of [['apple', '词义 a 1'], ['book', '词义 b 1'], ['cat', '词义 c 1'], ['dog', '词义 d 1']]) {
    assert.equal((await h.service.lookupLocal(word)).translation, translation);
  }
  assert.equal(h.requests.length, 4);

  await h.service.lookupLocal('echo');
  for (const [word, translation] of [['book', '词义 b 1'], ['cat', '词义 c 1'], ['dog', '词义 d 1'], ['echo', '词义 e 1']]) {
    assert.equal((await h.service.lookupLocal(word)).translation, translation);
  }
  assert.equal(h.requests.length, 5);
  const reloaded = await h.service.lookupLocal('apple');
  assert.equal(reloaded.translation, '词义 a 2');
  assert.equal(reloaded.definition, 'apple definition 2.');
  assert.equal(h.requests.length, 6);
  assert.ok(h.requests.every(({options}) => options.cache === 'force-cache'));
  assert.ok(h.requests.every(({options}) => options.credentials === 'omit' && options.referrerPolicy === 'no-referrer'));
});

test('a cached lookup refreshes its whole shard before the least recently used shard is evicted', async () => {
  const h = setup();
  for (const word of ['apple', 'book', 'cat', 'dog']) await h.service.lookupLocal(word);
  assert.equal((await h.service.lookupLocal('also')).translation, '词义 a 1');
  await h.service.lookupLocal('echo');
  assert.equal((await h.service.lookupLocal('apple')).translation, '词义 a 1');
  assert.equal((await h.service.lookupLocal('book')).translation, '词义 b 2');
  assert.equal(h.counts.get('a'), 1);
  assert.equal(h.counts.get('b'), 2);
});

test('different words and misses reuse a cached shard and its misses refresh recency', async () => {
  const h = setup();
  await h.service.lookupLocal('apple');
  assert.equal((await h.service.lookupLocal('also')).definition, 'also definition 1.');
  assert.equal(h.requests.length, 1);
  for (const word of ['book', 'cat', 'dog']) await h.service.lookupLocal(word);
  assert.equal(await h.service.lookupLocal('absent'), null);
  await h.service.lookupLocal('echo');
  assert.equal((await h.service.lookupLocal('apple')).translation, '词义 a 1');
  assert.equal(h.counts.get('a'), 1);
  assert.equal((await h.service.lookupLocal('book')).translation, '词义 b 2');
});

test('a failed shard request does not occupy a cache slot or evict successful shards', async () => {
  const h = setup(({letter, attempt}) => {
    if (letter === 'e' && attempt === 1) throw new TypeError('offline');
    return new Response(JSON.stringify(shard(letter, attempt)));
  });
  for (const word of ['apple', 'book', 'cat', 'dog']) await h.service.lookupLocal(word);
  await assert.rejects(h.service.lookupLocal('echo'), {code: 'unavailable'});
  for (const [word, translation] of [['apple', '词义 a 1'], ['book', '词义 b 1'], ['cat', '词义 c 1'], ['dog', '词义 d 1']]) {
    assert.equal((await h.service.lookupLocal(word)).translation, translation);
  }
  assert.equal(h.requests.length, 5);
  assert.equal((await h.service.lookupLocal('echo')).translation, '词义 e 2');
});

test('an aborted shard with a late JSON body cannot occupy a cache slot or evict successful shards', async () => {
  let finishBody, requestSignal;
  const h = setup(({letter, attempt, options}) => {
    if (letter === 'e' && attempt === 1) {
      requestSignal = options.signal;
      return {ok: true, json: () => new Promise(resolve => {finishBody = resolve;})};
    }
    return new Response(JSON.stringify(shard(letter, attempt)));
  });
  for (const word of ['apple', 'book', 'cat', 'dog']) await h.service.lookupLocal(word);
  const controller = new AbortController();
  const pending = h.service.lookupLocal('echo', {signal: controller.signal});
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, {code: 'aborted'});
  assert.equal(requestSignal.aborted, true);
  finishBody(shard('e', 1));
  await new Promise(resolve => setImmediate(resolve));
  for (const [word, translation] of [['apple', '词义 a 1'], ['book', '词义 b 1'], ['cat', '词义 c 1'], ['dog', '词义 d 1']]) {
    assert.equal((await h.service.lookupLocal(word)).translation, translation);
  }
  assert.equal(h.requests.length, 5);
  assert.equal((await h.service.lookupLocal('echo')).translation, '词义 e 2');
});
