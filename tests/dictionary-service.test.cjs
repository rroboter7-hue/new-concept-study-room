const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const servicePath = path.join(__dirname, '..', 'dictionary-service.js');
const dictionary = fs.existsSync(servicePath) ? require(servicePath) : {};
const entry = [{
  word: 'hello', phonetic: 'həˈləʊ',
  phonetics: [{ text: 'həˈləʊ', audio: '//example.invalid/hello.mp3' }],
  meanings: [
    { partOfSpeech: 'exclamation', definitions: [{ definition: 'Used as a greeting.', example: 'Hello, Katie!', synonyms: [], antonyms: [] }] },
    { partOfSpeech: 'noun', definitions: [{ definition: 'An utterance of hello.', synonyms: [], antonyms: [] }] }
  ]
}];
const payload = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
function lookup(...args) {
  assert.equal(typeof dictionary.lookup, 'function', 'online dictionary lookup must be available');
  return dictionary.lookup(...args);
}

test('queries the official endpoint and normalizes the documented meanings with explicit English source', async () => {
  const result = await lookup(' Hello ', { fetch: async (url, options) => {
    assert.equal(url, 'https://api.dictionaryapi.dev/api/v2/entries/en/hello');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.credentials, 'omit');
    return payload(entry);
  }});
  assert.deepEqual(result, {
    word: 'hello', phonetic: 'həˈləʊ', pos: 'exclamation', definition: 'Used as a greeting.', example: 'Hello, Katie!',
    meanings: [
      { partOfSpeech: 'exclamation', definitions: [{ definition: 'Used as a greeting.', example: 'Hello, Katie!' }] },
      { partOfSpeech: 'noun', definitions: [{ definition: 'An utterance of hello.', example: '' }] }
    ], sourceName: 'Free Dictionary API', sourceUrl: 'https://dictionaryapi.dev/', language: 'en'
  });
});

test('uses a phonetics fallback and skips invalid definitions instead of creating blank meanings', async () => {
  const result = await lookup('hello', { fetch: async () => payload([{ phonetics: [{audio:'unused'}, {text:' /həˈləʊ/ '}], meanings: [
    {partOfSpeech:'noun',definitions:[{definition:'   '}, {definition:42}]},
    {partOfSpeech:'verb',definitions:[null, {definition:' To greet. ',example:' Hello again. '}]}
  ]}]) });
  assert.equal(result.phonetic, '/həˈləʊ/');
  assert.equal(result.pos, 'verb');
  assert.equal(result.definition, 'To greet.');
  assert.equal(result.meanings.length, 1);
});

test('rejects absent or malformed definitions without inventing a successful entry', async () => {
  for (const data of [[], {}, null, [{meanings:[]}], [{meanings:[{definitions:[{definition:'  '}, {definition:{text:'wrong'}}]}]}]]) {
    await assert.rejects(lookup('hello', {fetch: async () => payload(data)}), {code:'unavailable'});
  }
});

test('bounds remote text and strips HTML markup and control characters', async () => {
  const result = await lookup('hello', {fetch: async () => payload([{phonetic:'<b> /hi/ </b>\u0000',meanings:Array.from({length:20},()=>({
    partOfSpeech:'<i>noun</i>',definitions:Array.from({length:20},()=>({definition:'<script>bad()</script><b>Hello</b>\u0000 '+ 'x'.repeat(3000),example:'e'.repeat(3000)}))
  }))}])});
  assert.equal(result.phonetic, '/hi/');
  assert.equal(result.pos, 'noun');
  assert.doesNotMatch(result.definition, /<|>|\u0000|bad\(\)/);
  assert.ok(result.definition.length <= 1200);
  assert.ok(result.example.length <= 1200);
  assert.ok(result.meanings.length <= 6);
  assert.ok(result.meanings.every(meaning=>meaning.definitions.length <= 4));
});

test('rejects unsafe or oversized input before making a request', async () => {
  for (const word of ['', '   ', 'https://example.com', '../hello', 'hello world', '-hello', "hello'", 'a'.repeat(65), '<b>hello</b>', '你好', 42, null]) {
    await assert.rejects(lookup(word, {fetch: async () => {throw new Error('must not fetch');}}), {code:'invalid-word'});
  }
});

test('accepts internal hyphens and apostrophes and encodes the endpoint safely', async () => {
  let request;
  await lookup("Mother-In-Law's", {fetch: async url => {request=url;return payload(entry);}});
  assert.equal(request, 'https://api.dictionaryapi.dev/api/v2/entries/en/mother-in-law%27s');
});

test('maps not-found, rate-limit, server and network failures to stable codes', async () => {
  for (const [status, code] of [[404,'not-found'],[429,'rate-limit'],[500,'unavailable'],[403,'unavailable']]) {
    await assert.rejects(lookup('hello', {fetch: async () => new Response('{}',{status})}), {code});
  }
  await assert.rejects(lookup('hello', {fetch: async () => {throw new TypeError('Failed to fetch');}}), {code:'unavailable'});
  await assert.rejects(lookup('hello', {fetch: async () => new Response('not JSON')}), {code:'unavailable'});
});

test('times out even if the underlying fetch ignores abort', async () => {
  let requestSignal;
  await assert.rejects(lookup('hello', {timeoutMs:10,fetch: (_url,{signal}) => {requestSignal=signal;return new Promise(()=>{});}}), {code:'timeout'});
  assert.equal(requestSignal.aborted, true);
});

test('times out a response whose body never completes', async () => {
  await assert.rejects(lookup('hello', {timeoutMs:10,fetch: async () => ({ok:true,status:200,json:()=>new Promise(()=>{})})}), {code:'timeout'});
});

test('returns aborted for an already cancelled request and for cancellation during fetch', async () => {
  const pre = new AbortController(); pre.abort();
  await assert.rejects(lookup('hello', {signal:pre.signal,fetch:async()=>{throw new Error('must not fetch');}}), {code:'aborted'});
  const active = new AbortController();
  let requestSignal;
  const pending = lookup('hello', {signal:active.signal,fetch:(_url,{signal})=>{requestSignal=signal;return new Promise(()=>{});}});
  active.abort();
  await assert.rejects(pending, {code:'aborted'});
  assert.equal(requestSignal.aborted,true);
});

test('performs fresh lookups and does not let a failed or aborted call poison later results', async () => {
  const first = await lookup('hello', {fetch:async()=>payload(entry)});
  assert.equal(first.definition,'Used as a greeting.');
  await assert.rejects(lookup('hello', {fetch:async()=>new Response('{}',{status:404})}), {code:'not-found'});
  const cancelled = new AbortController();
  const old = lookup('hello', {signal:cancelled.signal,fetch:()=>new Promise(()=>{})});
  const newer = await lookup('hello', {fetch:async()=>payload([{meanings:[{partOfSpeech:'verb',definitions:[{definition:'A fresh definition.'}]}]}])});
  cancelled.abort();
  await assert.rejects(old, {code:'aborted'});
  assert.equal(newer.definition,'A fresh definition.');
  assert.equal(first.definition,'Used as a greeting.');
});

test('creates only verified Chinese dictionary links with validated, encoded words', () => {
  assert.equal(typeof dictionary.links,'function','Chinese dictionary links must be available');
  assert.deepEqual(dictionary.links(" Mother's "), [{name:'有道词典（中英）',url:'https://www.youdao.com/result?word=mother%27s&lang=en',language:'zh-CN'}]);
  for (const word of ['javascript:alert(1)','hello&other=value','a/b','',null]) assert.deepEqual(dictionary.links(word),[]);
});

test('loads as a browser global without requiring CommonJS', () => {
  assert.ok(fs.existsSync(servicePath),'online dictionary service must be created');
  const context={}; context.window=context; vm.createContext(context);
  vm.runInContext(fs.readFileSync(servicePath,'utf8'),context);
  assert.equal(typeof context.StudyDictionary.lookup,'function');
  assert.equal(context.StudyDictionary.links('hello')[0].language,'zh-CN');
});
