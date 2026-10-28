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

test('requested course-history references include first-book words and usages plus all previous lessons without future content',()=>{
 const firstBook=lesson('b1-final',1,143,[word('garden','n.','花园')],[phrase('look at','看')]);
 const earlier=lesson('b2-l8',2,8,[word('wait','v.','等待')],[phrase('give up','放弃')]);
 const future=lesson('b2-l10',2,10,[word('future','adj.','未来的')]),nextBook=lesson('b3-l1',3,1,[word('advanced','adj.','进阶的')]);
 const input={includeEarlierLessons:true,lessons:[current,earlier,firstBook,future,nextBook]},before=JSON.stringify(input);
 const rows=entries(input),labels=new Set(rows.map(row=>row.label));
 for(const label of ['garden','look at','wait','give up','write'])assert(labels.has(label),label);
 assert(!labels.has('future'));assert(!labels.has('advanced'));assert.equal(JSON.stringify(input),before);
});

test('expanded references retain old source keys and explicit inflection aliases for selection migration',()=>{
 const early=lesson('b1-l1',1,1,[word('ring','v.','响')],[phrase('get up','起床')]);
 const now=lesson('b2-l2',2,2,[word('rang','n.','阶级',{meaningSource:'ECDICT'})],[phrase('get up','起床')]);
 const rows=library.forLesson(now,{includeEarlierLessons:true,lessons:[early,now],writingTargets:{words:[word('ring','v.','响',{source:{id:now.id},storageLabel:'rang',sourceForms:['rang']})]}});
 assert(rows.find(row=>row.label==='ring').aliases.includes('word:b2-l2:rang'));
 assert(rows.find(row=>row.label==='get up').aliases.includes('phrase:b2-l2:get%20up'));
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

test('a taught noun gloss outranks merged generic dictionary meanings from other lessons',()=>{
 const taught=lesson('b1-l1',1,1,[word('book','n.','书',{meaningSource:'本课词表'})]);
 const generic=lesson('b1-l3',1,3,[word('book','n.','n. 书籍,账簿,预约册\n[计]图书资料\nv. 预订房间',{meaningSource:'ECDICT'})]);
 const selected=lesson('b1-l5',1,5);
 const result=library.forLesson(selected,{lessons:[generic,taught,selected],includeEarlierLessons:true});
 const card=result.find(item=>item.label==='book');
 assert.equal(card.category,'noun');
 assert.equal(card.meaning,'书');
 assert.deepEqual(card.sources.map(source=>source.id),['b1-l1']);
 assert.equal(result.filter(item=>item.label==='book').length,1,'ambiguous generic duplicate must not compete with taught noun');
});

test('generic dictionary fallback shows a brief POS-matching gloss without markup or unrelated senses',()=>{
 const selected=lesson('b1-l1',1,1,[word('Excuse','vt.','vt. 原谅, 申辩, 做为...的托辞\nn. 致歉, 理由, 饶恕, 借口\n[法] 抗辩',{meaningSource:'ECDICT',sourceSentence:'Excuse me!'})]);
 const card=library.forLesson(selected,{lessons:[selected]})[0];
 assert.equal(card.category,'verb');
 assert.equal(card.meaning,'原谅');
 assert.match(card.detailMeaning,/致歉/);
});

test('generic multi-POS word without source context stays in Other words',()=>{
 const selected=lesson('b1-l1',1,1,[word('present','v.','v. 赠送,呈递\nn. 礼物,现在',{meaningSource:'ECDICT'})]);
 const card=library.forLesson(selected,{lessons:[selected]})[0];
 assert.equal(card.category,'word');
 assert.equal(card.meaning,'赠送');
});

test('apostrophe-s forms remain available as Other words instead of lexical verbs',()=>{
 const selected=lesson('b1-l1',1,1,[
  word("Here's",'adv. + v.','这是……；这里有……（here is 的缩写）',{sourceSentence:"Here's your book."}),
  word("She's",'pron. + v.','她是（she is 的缩写）',{sourceSentence:"She's ready."}),
  word("name's",'n. + v.','名字的',{sourceSentence:"The name's spelling is clear."})
 ]);
 const result=library.forLesson(selected,{lessons:[selected]});
 assert.deepEqual(result.map(item=>[item.label,item.category]),[["Here's",'word'],["She's",'word'],["name's",'word']]);
});

test('very in the actual thank-you source is an adverb while adjective context stays adjective',()=>{
 const thankYou=lesson('b1-l1',1,1,[word('very','a.','a. 真正的, 恰好的\nadv. 非常, 完全',{meaningSource:'ECDICT',sourceSentence:'Thank you very much.'})]);
 const adjective=lesson('b1-l3',1,3,[word('very','a.','a. 真正的, 恰好的\nadv. 非常, 完全',{meaningSource:'ECDICT',sourceSentence:'The very person came.'})]);
 const first=library.forLesson(thankYou,{lessons:[thankYou]})[0],second=library.forLesson(adjective,{lessons:[adjective]})[0];
 assert.deepEqual([first.category,first.meaning],['adverb','非常']);
 assert.deepEqual([second.category,second.meaning],['adjective','真正的']);
});

test('real first-book sources keep original taught book and brief Excuse, very, and contraction senses',()=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};
 scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8'),scope,{filename:name});
  if(name==='writing-target-plan.js')break;
 }
 const selected=scope.LESSONS.find(row=>row.book===1&&row.number===5);
 const vocabulary=source=>scope.StudyLessonWordTargets.vocabularyForLesson(source,scope.StudyKnowledge.bank.vocabularyForLesson(source.id));
 const result=library.forLesson(selected,{lessons:scope.LESSONS,includeEarlierLessons:true,getVocabulary:vocabulary});
 for(const [label,category,meaning] of [
  ['book','noun','书'],['Excuse','verb','原谅'],['very','adverb','非常'],["Here's",'word','这是……'],["She's",'word','她是（she is 的缩写）']
 ]){
  const item=result.find(row=>row.label===label);
  assert.ok(item,label+' is available from the real lesson sources');
  assert.deepEqual([item.category,item.meaning],[category,meaning],label);
 }
});

test('real Book 1 Lesson 11 catch uses corrected provider gloss and rejects the original grammar label',()=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};
 scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8'),scope,{filename:name});
  if(name==='writing-target-plan.js')break;
 }
 const selected=scope.LESSONS.find(row=>row.book===1&&row.number===11);
 const vocabulary=source=>scope.StudySentenceWordbankData.vocabularyForLesson(source,
  scope.StudyLessonWordTargets.vocabularyForLesson(source,scope.StudyKnowledge.bank.vocabularyForLesson(source.id)));
 const corrected=library.forLesson(selected,{lessons:[selected],getVocabulary:vocabulary}).find(row=>row.label.toLowerCase()==='catch');
 assert.ok(corrected);
 assert.equal(corrected.category,'verb');
 assert.equal(corrected.meaning,'接住');
 const uncorrected=lesson('imported-b1-l12',1,12,[word('catch','v.','特殊疑问词')]);
 assert.ok(!library.forLesson(uncorrected,{lessons:[uncorrected]}).some(row=>row.label.toLowerCase()==='catch'));
});

test('real Book 1 Lesson 7 I am contraction remains an Other word',()=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};
 scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8'),scope,{filename:name});
  if(name==='writing-target-plan.js')break;
 }
 const selected=scope.LESSONS.find(row=>row.book===1&&row.number===7);
 const vocabulary=source=>scope.StudyLessonWordTargets.vocabularyForLesson(source,scope.StudyKnowledge.bank.vocabularyForLesson(source.id));
 const contraction=library.forLesson(selected,{lessons:[selected],getVocabulary:vocabulary}).find(row=>row.label==="I'm");
 assert.ok(contraction);
 assert.equal(contraction.category,'word');
 assert.equal(contraction.meaning,'我是（I am 的缩写）');
});

test('a provider quarantine prevents an original same-source gloss from returning',()=>{
 const older=lesson('b1-l1',1,1,[word('bank','n.','河岸',{meaningSource:'本课词表'})]);
 const selected=lesson('b1-l3',1,3);
 const result=library.forLesson(selected,{lessons:[older,selected],includeEarlierLessons:true,
  getVocabulary:source=>source.id===older.id?[word('bank','n.','释义待补充',{contextMeaningStale:true,meaningSource:'unavailable'})]:[]});
 assert.ok(!result.some(row=>row.label==='bank'));
});

test('explicit reviewed provider context meaning outranks the same source original gloss',()=>{
 const selected=lesson('b1-l1',1,1,[word('ring','v.','铃响；打电话',{meaningSource:'本课词表'})]);
 const result=library.forLesson(selected,{lessons:[selected],getVocabulary:()=>[
  word('ring','v.','电话铃响',{meaningSource:'本课语境校对',sourceType:'self-authored-context-correction',sourceSentence:'The telephone rang.'})
 ]});
 assert.equal(result.find(row=>row.label==='ring').meaning,'电话铃响');
});

test('fragmented contraction note falls through to an existing complete gloss',()=>{
 const selected=lesson('b1-l1',1,1,[word("What's",'pron. + v.',"(尤当has为助动词时, 什么是",{meaningSource:'ECDICT'})]);
 const card=library.forLesson(selected,{lessons:[selected]}).find(row=>row.label==="What's");
 assert.ok(card);
 assert.equal(card.meaning,'什么是');
});

test('note-only fragments are omitted while a complete parenthetical lexical gloss remains',()=>{
 const selected=lesson('b1-l1',1,1,[
  word("Who's",'pron. + v.',"(尤当has为助动词时, [语]缩写)",{meaningSource:'ECDICT'}),
  word('change','v.','(使)改变,变化',{meaningSource:'ECDICT'})
 ]);
 const result=library.forLesson(selected,{lessons:[selected]});
 assert.ok(!result.some(row=>row.label==="Who's"));
 assert.equal(result.find(row=>row.label==='change').meaning,'(使)改变');
});

test('flag-only stale provider and same-source target cannot revive a quarantined word',()=>{
 const selected=lesson('b1-l1',1,1,[word('bank','n.','河岸')]);
 const result=library.forLesson(selected,{lessons:[selected],
  getVocabulary:()=>[word('bank','n.','河岸',{contextMeaningStale:true})],
  writingTargets:{words:[word('bank','n.','河岸',{source:{id:selected.id,book:1,number:1}})]}});
 assert.ok(!result.some(row=>row.label==='bank'));
});
