const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dictionaryService = require('../dictionary-service.js');
const project = path.resolve(__dirname, '..');

function classes() {
  const values = new Set();
  return {add: value=>values.add(value), remove: value=>values.delete(value), contains: value=>values.has(value)};
}
function onlineEntry(word, definition = 'An online definition.') {
  return {word, phonetic:'/test/', pos:'noun', definition, example:'An example.',
    meanings:[{partOfSpeech:'noun', definitions:[{definition,example:'An example.'}]}],
    sourceName:'Free Dictionary API',sourceUrl:'https://dictionaryapi.dev/',language:'en'};
}
function setup(vocabulary = []) {
  const requests = [], linkQueries = [], snapshots = [], notices = [], anchors = [];
  const popup = {innerHTML:'',style:{},classList:classes(),getBoundingClientRect:()=>({height:250}),querySelector:()=>null,contains:()=>false};
  const count = {textContent:0};
  const context = {
    console,AbortController,selectedWord:null,wordLookup:0,dictionaryController:null,wordAnchor:null,
    data:{words:[]},view:'study',current:{id:'source-lesson',title:'Original lesson',vocabulary},lessons:[],
    innerWidth:1000,innerHeight:800,icon:()=>'',audio:{speakWord:async()=>{}},
    $:selector=>selector==='#word-popover'?popup:selector==='#word-count'?count:null,
    $$:()=>anchors.filter(anchor=>anchor.classList.contains('selected')),
    toast:message=>notices.push(message),
    persist:()=>{snapshots.push(JSON.parse(JSON.stringify(context.data)));return true;}
  };
  context.window=context;
  context.document={activeElement:null,querySelector:context.$,documentElement:{clientWidth:1000}};
  context.StudyDictionary={
    lookup:(word,{signal})=>new Promise((resolve,reject)=>requests.push({word,signal,resolve,reject})),
    links:word=>{linkQueries.push(word);return dictionaryService.links(word);}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(project,'core.js'),'utf8'),context);
  context.E=context.StudyCore.escapeHTML;
  const app=fs.readFileSync(path.join(project,'app.js'),'utf8');
  const start=app.indexOf(' function dictionary(word)'),end=app.indexOf(' function renderWords()');
  assert.ok(start>=0&&end>start,'the actual dictionary UI functions must be available');
  vm.runInContext(app.slice(start,end),context);
  function open(word) {
    const anchor={classList:classes(),getBoundingClientRect:()=>({left:30,top:40,bottom:60})};
    anchors.push(anchor);
    return context.openWord(word,anchor);
  }
  return {context,popup,requests,linkQueries,snapshots,notices,open};
}

test('one click automatically queries online even when the course already supplies a Chinese meaning', async () => {
  const h=setup([{word:'book',meaning:'书',pos:'n.',phonetic:'/bʊk/'}]);
  const opening=h.open('book');
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].word,'book');
  assert.equal(h.context.selectedWord.pending,true);
  assert.match(h.popup.innerHTML,/书/);
  h.requests[0].resolve(onlineEntry('book','A written or printed work.'));
  await opening;
  assert.equal(h.context.selectedWord.meaning,'书');
  assert.equal(h.context.selectedWord.phonetic,'/bʊk/');
  assert.match(h.popup.innerHTML,/课程 \/ 本地释义/);
  assert.match(h.popup.innerHTML,/在线英文释义/);
  assert.match(h.popup.innerHTML,/A written or printed work\./);
  assert.equal(h.context.selectedWord.pending,false);
});

test('late replies cannot replace a newer popup, including when the same word is reopened', async () => {
  for(const [oldWord,newWord] of [['first','second'],['book','book']]) {
    const h=setup(),oldOpening=h.open(oldWord),newOpening=h.open(newWord);
    assert.equal(h.requests[0].signal.aborted,true);
    h.requests[1].resolve(onlineEntry(newWord,'The latest definition.'));
    await newOpening;
    h.requests[0].resolve(onlineEntry(oldWord,'An obsolete definition.'));
    await oldOpening;
    assert.equal(h.context.selectedWord.word,newWord);
    assert.equal(h.context.selectedWord.onlineEntry.definition,'The latest definition.');
    assert.match(h.popup.innerHTML,/The latest definition\./);
    assert.doesNotMatch(h.popup.innerHTML,/An obsolete definition/);
  }
});

test('a word saved during lookup receives the arriving definition while retaining its notebook metadata', async () => {
  const h=setup(),opening=h.open('unlisted');
  h.context.saveWord();
  const original=h.context.data.words[0];
  const addedAt=original.addedAt;
  original.mastered=true;
  original.note='Keep my note';
  h.context.current={id:'another-lesson',title:'Another lesson',vocabulary:[]};
  h.requests[0].resolve(onlineEntry('unlisted','A newly retrieved definition.'));
  await opening;
  const saved=h.context.data.words[0];
  assert.equal(saved.word,'unlisted');
  assert.equal(saved.meaning,'A newly retrieved definition.');
  assert.equal(saved.pos,'noun');
  assert.equal(saved.example,'An example.');
  assert.equal(saved.lessonId,'source-lesson');
  assert.equal(saved.lesson,'Original lesson');
  assert.equal(saved.addedAt,addedAt);
  assert.equal(saved.mastered,true);
  assert.equal(saved.note,'Keep my note');
  assert.notEqual(saved.pending,true);
  assert.equal(h.snapshots.at(-1).words[0].meaning,'A newly retrieved definition.');
  assert.equal(h.snapshots.at(-1).words[0].mastered,true);
});

test('normalizes a smart apostrophe only for online lookup and Chinese dictionary links', async () => {
  const h=setup([{word:'can\u2019t',meaning:'不能'}]);
  const opening=h.open('can\u2019t');
  assert.equal(h.requests[0].word,"can't");
  assert.ok(h.linkQueries.length>0);
  assert.ok(h.linkQueries.every(word=>word==="can't"));
  assert.match(h.popup.innerHTML,/word=can%27t&amp;lang=en/);
  h.requests[0].resolve(onlineEntry("can't",'Cannot.'));
  await opening;
  assert.equal(h.context.selectedWord.word,'can\u2019t');
  assert.equal(h.context.selectedWord.meaning,'不能');
  assert.match(h.popup.innerHTML,/<strong>can\u2019t<\/strong>/);
  h.context.saveWord();
  assert.equal(h.context.data.words[0].word,'can\u2019t');
});

test('escapes provider text and source attributes before inserting online results into popup HTML', async () => {
  const h=setup(),opening=h.open('hello');
  const entry=onlineEntry('hello','<img src=x onerror=alert(1)>');
  entry.phonetic='<svg onload=alert(1)>';
  entry.sourceName='<script>alert(1)</script>';
  entry.sourceUrl='https://dictionaryapi.dev/?x="<img src=x>';
  entry.meanings[0].partOfSpeech='<b>noun</b>';
  entry.meanings[0].definitions[0].example='<script>evil()</script>';
  h.requests[0].resolve(entry);
  await opening;
  assert.doesNotMatch(h.popup.innerHTML,/<(?:img|script|svg|b)\b/i);
  assert.match(h.popup.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(h.popup.innerHTML,/&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.match(h.popup.innerHTML,/href="https:\/\/dictionaryapi\.dev\/\?x=&quot;&lt;img src=x&gt;"/);
});

test('closing a popup cancels its lookup and a late reply keeps the popup closed', async () => {
  const h=setup(),opening=h.open('hello');
  h.context.hideWord();
  assert.equal(h.requests[0].signal.aborted,true);
  h.requests[0].resolve(onlineEntry('hello','An invisible late result.'));
  await opening;
  assert.equal(h.popup.classList.contains('hidden'),true);
  assert.doesNotMatch(h.popup.innerHTML,/An invisible late result/);
});

test('keeps popup edges inside a narrow document viewport when a scrollbar reduces its width', async () => {
  const h=setup();
  h.context.innerWidth=320;
  h.context.document.documentElement.clientWidth=305;
  const opening=h.open('book');
  const checkEdges=()=>{
    const left=parseFloat(h.popup.style.left),width=parseFloat(h.popup.style.width);
    assert.ok(left>=12,'popup must retain its left margin');
    assert.ok(left+width<=293,'popup must retain its right margin inside the 305px document viewport');
  };
  checkEdges();
  h.requests[0].resolve(onlineEntry('book'));
  await opening;
  checkEdges();
});

test('a network failure leaves the local Chinese meaning and a retry action available', async () => {
  const h=setup([{word:'book',meaning:'书'}]),opening=h.open('book');
  const error=new Error('Network unavailable');error.code='unavailable';
  h.requests[0].reject(error);
  await opening;
  assert.equal(h.context.selectedWord.meaning,'书');
  assert.equal(h.context.selectedWord.pending,false);
  assert.match(h.popup.innerHTML,/书/);
  assert.match(h.popup.innerHTML,/id="retry-online-word"/);
});
