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
function localEntry(word, translation = '词典中文释义', definition = 'A local English definition.', headword = word) {
  return {word,headword,translation,definition,phonetic:'/local/',pos:'noun',
    meanings:definition?[{partOfSpeech:'noun',definitions:[{definition,example:''}]}]:[],
    sourceName:'ECDICT',sourceUrl:'https://github.com/skywind3000/ECDICT',language:'en-zh'};
}
const settled = () => new Promise(resolve => setImmediate(resolve));
function setup(vocabulary = [], {local = false, savedWords = []} = {}) {
  const requests = [], localRequests = [], linkQueries = [], snapshots = [], notices = [], anchors = [], spoken = [];
  const popup = {innerHTML:'',style:{},classList:classes(),getBoundingClientRect:()=>({height:250}),querySelector:()=>null,contains:()=>false};
  const count = {textContent:0},notebook={innerHTML:''};
  const context = {
    console,AbortController,selectedWord:null,wordLookup:0,dictionaryController:null,wordAnchor:null,
    data:{words:savedWords},view:'study',query:'',current:{id:'source-lesson',title:'Original lesson',vocabulary},lessons:[],
    innerWidth:1000,innerHeight:800,icon:()=>'',audio:{speakWord:async word=>{spoken.push(word);}},
    $:selector=>selector==='#word-popover'?popup:selector==='#word-count'?count:selector==='#words-view'?notebook:null,
    $$:()=>anchors.filter(anchor=>anchor.classList.contains('selected')),
    toast:message=>notices.push(message),
    // Storage IO is an isolated boundary here; full-app storage tests cover
    // remote changes and failures. Keep the real pre-action sync helper below.
    storageSession:{sync:local=>({ok:true,data:local})},
    adoptStore:next=>Object.assign(context.data,next),
    persist:()=>{snapshots.push(JSON.parse(JSON.stringify(context.data)));return true;}
  };
  context.window=context;
  context.document={activeElement:null,querySelector:context.$,documentElement:{clientWidth:1000}};
  context.StudyDictionary={
    lookup:(word,{signal})=>new Promise((resolve,reject)=>requests.push({word,signal,resolve,reject})),
    links:word=>{linkQueries.push(word);return dictionaryService.links(word);}
  };
  if(local)context.StudyDictionary.lookupLocal=(word,{signal})=>new Promise((resolve,reject)=>localRequests.push({word,signal,resolve,reject}));
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(project,'core.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(project,'dictionary-context.js'),'utf8'),context);
  context.E=context.StudyCore.escapeHTML;
  const app=fs.readFileSync(path.join(project,'app.js'),'utf8');
  const syncStart=app.indexOf(' function syncBeforeWordAction()'),syncEnd=app.indexOf("\n window.addEventListener('storage'",syncStart);
  assert.ok(syncStart>=0&&syncEnd>syncStart,'the actual dictionary storage sync helper must be available');
  vm.runInContext(app.slice(syncStart,syncEnd),context);
  const start=app.indexOf(' function dictionary('),end=app.indexOf(' function renderRecords()');
  assert.ok(start>=0&&end>start,'the actual dictionary UI functions must be available');
  vm.runInContext(app.slice(start,end),context);
  function open(word) {
    const anchor={classList:classes(),getBoundingClientRect:()=>({left:30,top:40,bottom:60})};
    anchors.push(anchor);
    return context.openWord(word,anchor);
  }
  return {context,popup,notebook,requests,localRequests,linkQueries,snapshots,notices,spoken,open};
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
  assert.match(h.popup.innerHTML,/本课词表/);
  assert.match(h.popup.innerHTML,/在线英文释义/);
  assert.match(h.popup.innerHTML,/A written or printed work\./);
  assert.equal(h.context.selectedWord.pending,false);
});

test('an unrelated lesson cannot supply a malformed Chinese meaning or suppress the local dictionary', async () => {
  const h=setup([],{local:true});
  h.context.lessons=[{id:'unrelated',vocabulary:[{word:'may',meaning:'现在完成时',example:'May I have some water?'}]}];
  const opening=h.open('may');
  assert.notEqual(h.context.selectedWord.meaning,'现在完成时');
  h.localRequests[0].resolve(localEntry('may','可能；也许'));
  h.requests[0].resolve(onlineEntry('may','Used to express possibility.'));
  await opening;
  assert.equal(h.context.selectedWord.meaning,'可能；也许');
  assert.doesNotMatch(chineseSection(h),/May I have some water|现在完成时/);
});

test('a corrected lookup repairs a bad legacy saved gloss without losing the learner record', async () => {
  const h=setup([],{local:true,savedWords:[{word:'may',meaning:'现在完成时',lessonId:'old-source',mastered:true,note:'keep my note'}]});
  const opening=h.open('may');
  h.localRequests[0].resolve(localEntry('may','可能；也许'));
  h.requests[0].resolve(onlineEntry('may','Used to express possibility.'));
  await opening;
  const saved=h.context.data.words[0];
  assert.equal(saved.meaning,'可能；也许');
  assert.equal(saved.legacyMeaning,'现在完成时');
  assert.equal(saved.lessonId,'old-source');
  assert.equal(saved.note,'keep my note');
  assert.equal(saved.mastered,true);
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

test('parallel local bilingual results appear immediately and online English later replaces only the English section', async () => {
  const h=setup([],{local:true}),opening=h.open('walked');
  assert.equal(h.localRequests.length,1);assert.equal(h.requests.length,1);
  assert.equal(h.localRequests[0].signal,h.requests[0].signal);
  assert.deepEqual(h.spoken,['walked']);
  h.localRequests[0].resolve(localEntry('walked','行走','To move on foot.','walk'));await settled();
  assert.match(h.popup.innerHTML,/中文释义/);assert.match(h.popup.innerHTML,/行走/);
  assert.match(h.popup.innerHTML,/英文释义/);assert.match(h.popup.innerHTML,/To move on foot\./);
  assert.match(h.popup.innerHTML,/原形[：:]\s*walk/);assert.equal(h.context.selectedWord.pending,true);
  h.requests[0].resolve(onlineEntry('walked','To travel by walking.'));await opening;
  assert.equal(h.context.selectedWord.meaning,'行走');assert.equal(h.context.selectedWord.englishMeaning,'To travel by walking.');
  assert.match(h.popup.innerHTML,/行走/);assert.match(h.popup.innerHTML,/To travel by walking\./);
  assert.doesNotMatch(h.popup.innerHTML,/To move on foot\./);assert.equal(h.context.selectedWord.pending,false);
});

test('English arriving first is labeled English and a later local translation keeps that online definition', async () => {
  const h=setup([],{local:true}),opening=h.open('walked');
  h.requests[0].resolve(onlineEntry('walked','A past-tense action.'));await settled();
  assert.match(h.popup.innerHTML,/在线英文释义/);assert.equal(h.context.selectedWord.pending,true);
  const chinese=h.popup.innerHTML.match(/<section class="word-chinese-result">([\s\S]*?)<\/section>/);
  assert.ok(chinese);assert.doesNotMatch(chinese[1],/A past-tense action\./);
  h.localRequests[0].resolve(localEntry('walked','行走','The local explanation.','walk'));await opening;
  assert.match(h.popup.innerHTML,/行走/);assert.match(h.popup.innerHTML,/A past-tense action\./);
  assert.doesNotMatch(h.popup.innerHTML,/The local explanation\./);
});

test('local bilingual fallback remains usable when online lookup fails', async () => {
  const h=setup([],{local:true}),opening=h.open('walked');
  h.requests[0].reject(Object.assign(new Error('offline'),{code:'unavailable'}));
  h.localRequests[0].resolve(localEntry('walked','行走','To move on foot.','walk'));await opening;
  assert.match(h.popup.innerHTML,/行走/);assert.match(h.popup.innerHTML,/To move on foot\./);
  assert.match(h.popup.innerHTML,/ECDICT/);assert.equal(h.context.selectedWord.pending,false);
});

test('a missing or failed local lookup never blocks online English and never calls it a Chinese meaning', async () => {
  for(const fail of [false,true]){
    const h=setup([],{local:true}),opening=h.open('unlisted');
    if(fail)h.localRequests[0].reject(new Error('local unavailable'));else h.localRequests[0].resolve(null);
    h.requests[0].resolve(onlineEntry('unlisted','Only English is available.'));await opening;
    assert.match(h.popup.innerHTML,/中文释义暂未收录/);assert.match(h.popup.innerHTML,/在线英文释义/);
    assert.match(h.popup.innerHTML,/Only English is available\./);assert.equal(h.context.selectedWord.pending,false);
    h.context.saveWord();assert.equal(h.context.data.words[0].englishMeaning,'Only English is available.');
  }
});

test('both provider failures offer one retry that starts both providers with a fresh shared request', async () => {
  const h=setup([],{local:true}),opening=h.open('retry');
  h.localRequests[0].reject(new Error('failed'));h.requests[0].reject(new Error('failed'));await opening;
  assert.match(h.popup.innerHTML,/id="retry-online-word"/);
  const retry=h.context.lookupOnlineWord();assert.equal(h.localRequests.length,2);assert.equal(h.requests.length,2);
  assert.equal(h.localRequests[1].signal,h.requests[1].signal);
  h.localRequests[1].resolve(localEntry('retry','重试'));h.requests[1].resolve(onlineEntry('retry'));await retry;
  assert.match(h.popup.innerHTML,/重试/);assert.equal(h.context.selectedWord.pending,false);
});

test('both providers ignore stale replies after changing words or reopening the same word', async () => {
  for(const [first,next] of [['first','second'],['book','book']]){
    const h=setup([],{local:true}),old=h.open(first),latest=h.open(next);
    assert.equal(h.localRequests[0].signal.aborted,true);assert.equal(h.requests[0].signal.aborted,true);
    h.localRequests[1].resolve(localEntry(next,'最新中文','Current local English.'));h.requests[1].resolve(onlineEntry(next,'Current online English.'));await latest;
    h.localRequests[0].resolve(localEntry(first,'过期中文','Obsolete local English.'));h.requests[0].resolve(onlineEntry(first,'Obsolete online English.'));await old;
    assert.equal(h.context.selectedWord.word,next);assert.equal(h.context.selectedWord.meaning,'最新中文');
    assert.match(h.popup.innerHTML,/Current online English\./);assert.doesNotMatch(h.popup.innerHTML,/过期中文|Obsolete/);
  }
});

test('closing aborts both provider branches and late local or English results cannot change saved words', async () => {
  const h=setup([],{local:true}),opening=h.open('closed');h.context.saveWord();h.context.hideWord();
  assert.equal(h.localRequests[0].signal.aborted,true);assert.equal(h.requests[0].signal.aborted,true);
  h.localRequests[0].resolve(localEntry('closed','不应保存'));h.requests[0].resolve(onlineEntry('closed','Should not be saved.'));await opening;
  assert.equal(h.popup.classList.contains('hidden'),true);assert.equal(h.context.data.words[0].meaning,'');
  assert.doesNotMatch(h.popup.innerHTML,/不应保存|Should not be saved/);
});

test('saved bilingual fields fill independently in either arrival order without changing notebook metadata', async () => {
  for(const localFirst of [true,false]){
    const h=setup([],{local:true}),opening=h.open('walked');h.context.saveWord();
    const original=h.context.data.words[0],addedAt=original.addedAt;original.note='Keep my note';original.mastered=true;
    h.context.current={id:'another',title:'Another lesson',vocabulary:[]};
    if(localFirst)h.localRequests[0].resolve(localEntry('walked','行走','Local English.','walk'));
    else h.requests[0].resolve(onlineEntry('walked','Online English.'));
    await settled();
    if(localFirst)h.requests[0].resolve(onlineEntry('walked','Online English.'));
    else h.localRequests[0].resolve(localEntry('walked','行走','Local English.','walk'));
    await opening;
    const saved=h.context.data.words[0];
    assert.equal(saved.meaning,'行走');assert.equal(saved.englishMeaning,'Online English.');
    assert.equal(saved.definitionSource,'Free Dictionary API');assert.equal(saved.note,'Keep my note');assert.equal(saved.mastered,true);
    assert.equal(saved.addedAt,addedAt);assert.equal(saved.lessonId,'source-lesson');assert.equal(saved.lesson,'Original lesson');
    assert.equal(saved.pending,undefined);assert.equal(h.snapshots.at(-1).words[0].meaning,'行走');
    assert.equal(h.snapshots.at(-1).words[0].englishMeaning,'Online English.');
  }
});

test('valid course Chinese stays authoritative while a review notice cannot suppress dictionary fallback', async () => {
  for(const meaning of ['本课行走的意思']){
    const h=setup([{word:'walked',meaning}],{local:true}),opening=h.open('walked');
    h.localRequests[0].resolve(localEntry('walked','通用行走'));h.requests[0].resolve(onlineEntry('walked'));await opening;
    assert.equal(h.context.selectedWord.meaning,meaning);assert.match(h.popup.innerHTML,new RegExp(meaning));
    assert.doesNotMatch(h.popup.innerHTML,/通用行走/);
  }
  const pending=setup([{word:'walked',meaning:'本课词义暂待复核'}],{local:true}),waiting=pending.open('walked');
  pending.localRequests[0].resolve(localEntry('walked','通用行走'));pending.requests[0].resolve(onlineEntry('walked'));await waiting;
  assert.equal(pending.context.selectedWord.meaning,'通用行走');assert.match(chineseSection(pending),/通用词典释义/);
  const h=setup([{word:'walked',meaning:'The course English meaning.'}],{local:true}),opening=h.open('walked');
  assert.match(h.popup.innerHTML,/英文释义/);assert.doesNotMatch(h.popup.innerHTML,/课程 \/ 本地释义<\/p><p class="meaning">[^<]*The course English/);
  h.localRequests[0].resolve(localEntry('walked','行走'));h.requests[0].resolve(onlineEntry('walked'));await opening;
  assert.equal(h.context.selectedWord.meaning,'行走');
});

test('arriving dictionary data never overwrites existing saved Chinese or its notebook metadata', async () => {
  const original={word:'walked',meaning:'我的中文笔记',note:'Keep',mastered:true,lesson:'Old lesson',lessonId:'old',addedAt:123};
  const h=setup([],{local:true,savedWords:[original]}),opening=h.open('walked');
  h.localRequests[0].resolve(localEntry('walked','通用行走'));h.requests[0].resolve(onlineEntry('walked','Online English.'));await opening;
  const saved=h.context.data.words[0];
  assert.equal(saved.meaning,'我的中文笔记');assert.equal(saved.englishMeaning,'Online English.');
  assert.equal(saved.note,'Keep');assert.equal(saved.mastered,true);assert.equal(saved.lesson,'Old lesson');assert.equal(saved.lessonId,'old');assert.equal(saved.addedAt,123);
  assert.deepEqual(h.snapshots.at(-1).words[0],JSON.parse(JSON.stringify(saved)));
  h.context.saveWord();assert.equal(h.context.data.words.length,1);
});

test('untrusted local provider text is escaped and cannot supply an authoritative Chinese translation', async () => {
  const h=setup([],{local:true}),opening=h.open('walked');
  const entry=localEntry('walked','中文<img src=x onerror=alert(1)>','<b>Unsafe English</b>','<svg onload=alert(1)>');
  entry.sourceName='<script>source()</script>';entry.sourceUrl='https://github.com/skywind3000/ECDICT?x="<img src=x>';
  entry.meanings[0].partOfSpeech='<i>noun</i>';entry.meanings[0].definitions[0].example='<script>example()</script>';
  h.localRequests[0].resolve(entry);h.requests[0].reject(new Error('offline'));await opening;
  assert.doesNotMatch(h.popup.innerHTML,/<(?:img|script|svg|b|i)\b/i);
  assert.match(h.popup.innerHTML,/中文释义暂未收录/);assert.doesNotMatch(h.popup.innerHTML,/中文&lt;img/);assert.match(h.popup.innerHTML,/原形：&lt;svg/);
  assert.match(h.popup.innerHTML,/&lt;script&gt;example\(\)&lt;\/script&gt;/);
  assert.match(h.popup.innerHTML,/href="https:\/\/github\.com\/skywind3000\/ECDICT\?x=&quot;&lt;img src=x&gt;"/);
});

test('the notebook shows saved Chinese followed by separately labeled and escaped English without altering metadata controls', () => {
  const saved={word:'walked',meaning:'行走',englishMeaning:'To <b>move</b> on foot.',definitionSource:'<script>source()</script>',mastered:true,note:'Keep this note',lesson:'Original lesson',addedAt:123};
  const h=setup([],{savedWords:[saved]});h.context.renderWords();
  assert.match(h.notebook.innerHTML,/行走/);assert.match(h.notebook.innerHTML,/英文释义/);
  assert.ok(h.notebook.innerHTML.indexOf('行走')<h.notebook.innerHTML.indexOf('英文释义'));
  assert.match(h.notebook.innerHTML,/To &lt;b&gt;move&lt;\/b&gt; on foot\./);assert.doesNotMatch(h.notebook.innerHTML,/<(?:b|script)\b/);
  assert.match(h.notebook.innerHTML,/data-master="walked"/);assert.match(h.notebook.innerHTML,/data-remove-word="walked"/);
  assert.match(h.notebook.innerHTML,/取消掌握|标记掌握|已掌握/);assert.equal(saved.note,'Keep this note');assert.equal(saved.mastered,true);assert.equal(saved.addedAt,123);
});

test('legacy English-only notebook meanings are labeled English and Chinese-only entries keep their meaning', () => {
  const h=setup([],{savedWords:[{word:'legacy',meaning:'An English-only legacy definition.',lesson:'Old lesson',mastered:false}]});
  h.context.renderWords();assert.match(h.notebook.innerHTML,/中文释义暂未收录/);
  assert.match(h.notebook.innerHTML,/英文释义[\s\S]*An English-only legacy definition\./);
  h.context.data.words=[{word:'book',meaning:'书',lesson:'Old lesson',mastered:false}];h.context.renderWords();
  assert.match(h.notebook.innerHTML,/<p>书<\/p>/);assert.doesNotMatch(h.notebook.innerHTML,/英文释义|中文释义暂未收录/);
});

test('local English keeps all four bounded raw noun and verb senses while online groups keep two each', async () => {
  const h=setup([],{local:true}),opening=h.open('spoil');
  const entry=localEntry('spoil','损坏；宠坏','n. The plunder taken from an enemy.');
  entry.meanings=[{partOfSpeech:'',definitions:[
    {definition:'n. The plunder taken from an enemy.',example:''},
    {definition:'n. Material removed during excavation.',example:''},
    {definition:'v. To damage something good.',example:''},
    {definition:'v. To give a child too much.',example:''}
  ]}];
  h.localRequests[0].resolve(entry);await settled();
  for(const definition of ['n. The plunder taken from an enemy.','n. Material removed during excavation.','v. To damage something good.','v. To give a child too much.'])assert.ok(h.popup.innerHTML.includes(definition));
  const online=onlineEntry('spoil','Online noun one.');
  online.meanings=[
    {partOfSpeech:'noun',definitions:['Online noun one.','Online noun two.','Online noun three.','Online noun four.'].map(definition=>({definition,example:''}))},
    {partOfSpeech:'verb',definitions:['Online verb one.','Online verb two.','Online verb three.','Online verb four.'].map(definition=>({definition,example:''}))}
  ];
  h.requests[0].resolve(online);await opening;
  for(const definition of ['Online noun one.','Online noun two.','Online verb one.','Online verb two.'])assert.ok(h.popup.innerHTML.includes(definition));
  assert.doesNotMatch(h.popup.innerHTML,/Online (?:noun|verb) (?:three|four)\./);
});

function beautifulEntries() {
  const local=localEntry('beautiful','a. 美丽的','a. Delighting the senses.');local.pos='';
  const online=onlineEntry('beautiful','A person who is beautiful.');online.pos='noun';online.example='Hey, beautiful!';
  online.meanings[0].partOfSpeech='noun';online.meanings[0].definitions[0].example='Hey, beautiful!';
  return {local,online};
}
function chineseSection(h) {
  const section=h.popup.innerHTML.match(/<section class="word-chinese-result">([\s\S]*?)<\/section>/);
  assert.ok(section,'the actual popup must show a distinct Chinese source section');return section[1];
}

test('online noun labels and examples never enter the ECDICT Chinese section in either arrival order', async () => {
  for(const localFirst of [true,false]){
    const h=setup([],{local:true}),opening=h.open('beautiful'),entries=beautifulEntries();
    if(localFirst)h.localRequests[0].resolve(entries.local);else h.requests[0].resolve(entries.online);
    await settled();
    if(localFirst)h.requests[0].resolve(entries.online);else h.localRequests[0].resolve(entries.local);
    await opening;
    const chinese=chineseSection(h);assert.match(chinese,/ECDICT/);assert.match(chinese,/a\. 美丽的/);
    assert.doesNotMatch(chinese,/noun|Hey, beautiful!/);
    assert.match(h.popup.innerHTML,/<strong>noun<\/strong>/);assert.match(h.popup.innerHTML,/Hey, beautiful!/);
  }
});

test('course Chinese keeps only its own part of speech and example, including when either field is absent', async () => {
  for(const fields of [{pos:'adj.',example:'This is a beautiful painting.'},{pos:'adj.'},{example:'This is a beautiful painting.'},{}]){
    for(const localFirst of [true,false]){
      const h=setup([{word:'beautiful',meaning:'本课：美丽的',...fields}],{local:true}),opening=h.open('beautiful'),entries=beautifulEntries();
      if(localFirst)h.localRequests[0].resolve(entries.local);else h.requests[0].resolve(entries.online);
      await settled();
      if(localFirst)h.requests[0].resolve(entries.online);else h.localRequests[0].resolve(entries.local);
      await opening;
      const chinese=chineseSection(h);assert.match(chinese,/本课：美丽的/);assert.doesNotMatch(chinese,/noun|Hey, beautiful!|ECDICT/);
      if(fields.pos)assert.match(chinese,/adj\./);if(fields.example)assert.match(chinese,/This is a beautiful painting\./);
      assert.match(h.popup.innerHTML,/<strong>noun<\/strong>/);assert.match(h.popup.innerHTML,/Hey, beautiful!/);
    }
  }
});

test('reopening saved ECDICT Chinese ignores legacy online POS and example without changing saved metadata', async () => {
  const saved={word:'beautiful',meaning:'a. 美丽的',translationSource:'ECDICT',englishMeaning:'A person who is beautiful.',definitionSource:'Free Dictionary API',pos:'noun',example:'Hey, beautiful!',mastered:true,note:'Keep my note',lessonId:'old',lesson:'Old lesson',addedAt:123};
  const h=setup([],{local:true,savedWords:[saved]}),opening=h.open('beautiful');
  assert.match(chineseSection(h),/a\. 美丽的/);assert.doesNotMatch(chineseSection(h),/noun|Hey, beautiful!/);
  const entries=beautifulEntries();h.requests[0].resolve(entries.online);h.localRequests[0].resolve(entries.local);await opening;
  assert.doesNotMatch(chineseSection(h),/noun|Hey, beautiful!/);assert.match(h.popup.innerHTML,/Hey, beautiful!/);
  assert.equal(saved.pos,'noun');assert.equal(saved.example,'Hey, beautiful!');assert.equal(saved.note,'Keep my note');assert.equal(saved.mastered,true);assert.equal(saved.addedAt,123);
});

test('course sense and example stay visible while unrelated dictionary meanings are collapsed',async()=>{const h=setup([{word:'outside',meaning:'在外面',pos:'adv.',example:'It was dark outside.'}]);const opening=h.open('outside');h.requests[0].resolve(onlineEntry('outside','The outer surface.'));await opening;const html=h.popup.innerHTML,details=html.match(/<details[^>]*data-word-other-senses[^>]*>[\s\S]*?<\/details>/)?.[0];assert(details,'other senses have a disclosure');assert.doesNotMatch(details,/<details[^>]*\bopen\b/);assert.match(details,/The outer surface/);assert.match(html.replace(details,''),/adv\.|在外面/);assert.match(html.replace(details,''),/It was dark outside/);});
