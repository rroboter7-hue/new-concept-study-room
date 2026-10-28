'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const filename=path.resolve(__dirname,'../writing-word-library.js');
const library=fs.existsSync(filename)?require(filename):{};
const lesson=(id,book,number,vocabulary=[],usage=[])=>({id,book,number,title:id,paragraphs:[],vocabulary,usage});
const word=(word,pos,meaning,extra={})=>({word,pos,meaning,...extra});
const phrase=(phrase,meaning,extra={})=>({phrase,meaning,...extra});
const current=lesson('b2-l9',2,9,[word('write','v.','写')]);
function entries(options){assert.equal(typeof library.forLesson,'function');return library.forLesson(current,options);}

test('only current and explicitly learned earlier sources enter the bank before deduplication',()=>{
 const known=lesson('b1-l2',1,2,[word('kind','adj.','友善的')]);
 const unknown=lesson('b1-l3',1,3,[word('KIND','adj.','种类')]);
 const sameBook=lesson('b2-l8',2,8,[word('run','v.','跑')]);
 const future=lesson('b2-l10',2,10,[word('future','adj.','未来的')]);
 const result=entries({lessons:[unknown,future,sameBook,known,current],learnedLessonIds:['b1-l2']});
 assert.deepEqual(result.map(item=>item.label),['kind','write']);
 assert.equal(result[0].meaning,'友善的');
 assert.deepEqual(result[0].sources.map(source=>source.id),['b1-l2']);
 assert.equal(result[1].source.id,current.id);
});

test('explicit learned range admits older books but never future or current-book later lessons',()=>{
 const older=lesson('b1-l10',1,10,[word('bright','adj.','明亮的')]);
 const unconfirmed=lesson('b1-l11',1,11,[word('quiet','adj.','安静的')]);
 const future=lesson('b2-l10',2,10,[word('quick','adj.','快速的')]);
 const result=entries({lessons:[older,unconfirmed,future],learningRange:{version:1,books:{1:10,2:100}}});
 assert.deepEqual(result.map(item=>item.label),['bright','write']);
});

test('excludes source-bound names, honorifics, unsafe flags and placeholder meanings',()=>{
 const old=lesson('b1-l1',1,1,[
  word('Lucy','n.','露西'),word('Mr.','n.','先生'),word('safe','adj.','安全的'),
  word('bad','v.','释义待补充'),word('manual','v.','手动', {practiceEligible:false}),
  word('suspect','adj.','可疑的',{needsContextReview:true}),word('flagged','adj.','标记',{isPersonName:true})
 ],[phrase('look at','看'),phrase('bad usage','习惯表达'),phrase('skip this','跳过',{practiceEligible:false})]);
 const result=entries({lessons:[old],learnedLessonIds:['b1-l1'],isPersonNameTarget:(target,source)=>source.id==='b1-l1'&&target.word==='Lucy'});
 assert.deepEqual(result.map(item=>item.label),['safe','write','look at']);
});

test('provider corrections and target references are used without mutating source rows',()=>{
 const old=lesson('b1-l1',1,1,[word('fix','v.','释义待补充')]);
 const target=word('draft','v.','起草',{example:'I draft a letter.'});
 const before=JSON.stringify([old,current,target]);
 const result=entries({lessons:[old],learnedLessonIds:['b1-l1'],getVocabulary:source=>source.id==='b1-l1'?[word('fix','v.','修理',{example:'I fix it.'})]:source.vocabulary,
  writingTargets:{words:[target],phrases:[]}});
 assert.deepEqual(result.map(item=>item.label),['fix','write','draft']);
 assert.equal(result[0].example,'I fix it.');
 assert.equal(result[2].source.id,current.id);
 assert.equal(JSON.stringify([old,current,target]),before);
 result[0].sources[0].title='changed';
 assert.equal(old.title,'b1-l1');
});

test('filter scopes by source book and category, and searches label or meaning',()=>{
 const old=lesson('b1-l1',1,1,[word('quiet','adj.','安静的'),word('read','v.','阅读')],[phrase('look at','看')]);
 const all=entries({lessons:[old],learnedLessonIds:['b1-l1']});
 assert.deepEqual(library.filter(all,{book:1,category:'adjective'}).map(item=>item.label),['quiet']);
 assert.deepEqual(library.filter(all,{query:'阅读'}).map(item=>item.label),['read']);
 assert.deepEqual(library.filter(all,{category:'usage'}).map(item=>item.label),['look at']);
});

test('recommendations are stable, target-aware and mix useful categories without including the target',()=>{
 const old=lesson('b1-l1',1,1,[word('write','v.','写'),word('read','v.','阅读'),word('bright','adj.','明亮的'),word('quiet','adj.','安静的'),word('book','n.','书')],[phrase('write down','写下'),phrase('look at','看')]);
 const all=entries({lessons:[old],learnedLessonIds:['b1-l1']});
 const target={word:'write',meaning:'写',category:'verb'};
 const first=library.recommend(all,{target,count:4});
 assert.deepEqual(library.recommend(all,{target,count:4}).map(item=>item.key),first.map(item=>item.key));
 assert.equal(first.length,4);
 assert.ok(!first.some(item=>item.label.toLowerCase()==='write'));
 assert.ok(first.some(item=>item.category==='verb'));
 assert.ok(first.some(item=>item.category==='adjective'));
 assert.ok(first.some(item=>item.category==='phrase'));
 assert.ok(first.some(item=>item.label==='write down'));
 assert.notDeepEqual(library.recommend(all,{target,count:4,rotation:1}).map(item=>item.key),first.map(item=>item.key));
});

test('browser export works with existing StudySentences and no DOM',()=>{
 assert.ok(fs.existsSync(filename));
 const scope={window:{StudySentences:require('../sentence-core.js')}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),scope);
 assert.equal(typeof scope.window.StudyWritingLibrary.forLesson,'function');
});

test('real Book 2 Lesson 2 canonical targets replace generic repeated and rang aliases',()=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};
 scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8'),scope,{filename:name});
  if(name==='writing-target-plan.js')break;
 }
 const selected=scope.LESSONS.find(row=>row.book===2&&row.number===2);
 const vocabulary=source=>scope.StudyLessonWordTargets.vocabularyForLesson(source,scope.StudyKnowledge.bank.vocabularyForLesson(source.id));
 const targets=scope.StudyWritingTargets.forLesson(selected,{lessons:scope.LESSONS,learnedLessonIds:[],getVocabulary:vocabulary,getNewWords:source=>scope.StudyLessonWordTargets.newWordsForLesson(source),getUsage:source=>source.usage});
 const result=library.forLesson(selected,{lessons:scope.LESSONS,writingTargets:targets,getVocabulary:vocabulary});
 assert.ok(result.some(item=>item.label==='repeat'&&item.category==='verb'&&item.meaning==='重复'));
 assert.ok(result.some(item=>item.label==='ring'&&item.category==='verb'));
 assert.ok(!result.some(item=>item.label==='repeated'&&item.category==='adjective'));
 assert.ok(!result.some(item=>item.label==='rang'));
});

test('explicit alias suppression retains an independently backed homograph in the same lesson',()=>{
 const selected=lesson('b2-l9',2,9,[
  word('recorded','v.','记录的通用词义',{meaningSource:'ECDICT'}),
  word('recorded','n.','录音资料',{meaningSource:'本课正文整理',sourceType:'textbook-passage',example:'The recorded was available.'})
 ]);
 const canonical=word('record','v.','记录',{storageLabel:'recorded',sourceForms:['recorded'],source:{id:selected.id,book:2,number:9}});
 const result=library.forLesson(selected,{lessons:[selected],writingTargets:{words:[canonical]}});
 assert.deepEqual(result.filter(item=>item.label==='recorded').map(item=>[item.category,item.meaning]),[['noun','录音资料']]);
 assert.ok(result.some(item=>item.label==='record'&&item.category==='verb'));
});

test('a selected verb card uses its verb example, not an earlier noun homograph example',()=>{
 const selected=lesson('b2-l9',2,9,[
  word('book','n.','书',{example:'This is my book.'}),
  word('book','v.','预订',{example:'I book a room.'})
 ]);
 const result=library.forLesson(selected,{lessons:[selected]});
 const card=result.find(item=>item.label==='book');
 assert.equal(card.category,'verb');
 assert.equal(card.meaning,'预订');
 assert.equal(card.example,'I book a room.');
});

test('a verb card omits an example when only the noun homograph has one',()=>{
 const selected=lesson('b2-l9',2,9,[
  word('book','n.','书',{example:'This is my book.'}),
  word('book','v.','预订')
 ]);
 const card=library.forLesson(selected,{lessons:[selected]}).find(item=>item.label==='book');
 assert.equal(card.category,'verb');
 assert.equal(card.example,undefined);
});

test('an earlier learned lesson uses its own canonical targets to suppress explicit generic aliases',()=>{
 const older=lesson('b2-l2',2,2,[
  word('repeat','v.','重复'),
  word('repeated','a.','反复的',{meaningSource:'ECDICT',sourceSentence:'I repeated.'})
 ]);
 const canonical=word('repeat','v.','重复',{storageLabel:'repeated',sourceForms:['repeated'],source:{id:older.id,book:older.book,number:older.number}});
 const result=entries({lessons:[older],learnedLessonIds:[older.id],getWritingTargets:source=>source.id===older.id?{words:[canonical]}:{words:[]}});
 assert.ok(result.some(item=>item.label==='repeat'&&item.source.id===older.id));
 assert.ok(!result.some(item=>item.label==='repeated'));
});

test('a current canonical alias does not suppress the same label in an earlier source',()=>{
 const older=lesson('b1-l1',1,1,[word('recorded','a.','录制的',{meaningSource:'ECDICT'})]);
 const selected=lesson('b2-l9',2,9,[word('record','v.','录制')]);
 const canonical=word('record','v.','录制',{storageLabel:'recorded',sourceForms:['recorded'],source:{id:selected.id,book:2,number:9}});
 const result=library.forLesson(selected,{lessons:[older,selected],learnedLessonIds:[older.id],writingTargets:{words:[canonical]}});
 assert.ok(result.some(item=>item.label==='recorded'&&item.source.id===older.id));
});
