'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'../writing-target-plan.js');
const api=fs.existsSync(file)?require(file):{};
const {harness}=require('./support/app-harness.cjs');
let corpus;
const real=()=>corpus||(corpus=harness().then(({c})=>{
  for(const name of ['person-name-targets.js','sentence-wordbank-data.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c,{filename:name});
  vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:'writing-target-plan.js'});
  const vocabulary=l=>c.StudySentenceWordbankData.vocabularyForLesson(l,c.StudyLessonWordTargets.vocabularyForLesson(l,c.StudyKnowledge.bank.hasLesson(l.id)?c.StudyKnowledge.bank.vocabularyForLesson(l.id):l.vocabulary));
  return {c,options:{lessons:c.LESSONS,learnedLessonIds:new Set(c.LESSONS.map(l=>l.id)),getVocabulary:vocabulary,getNewWords:l=>c.StudyLessonWordTargets.newWordsForLesson(l),getUsage:l=>c.StudySentenceWordbankData.usageForLesson(l)||l.usage}};
}));
const lesson=(id,number,vocabulary=[],usage=[],paragraphs=[])=>({id,book:2,number,title:id,vocabulary,usage,paragraphs});
const plan=(l,options)=>{assert.equal(typeof api.forLesson,'function','the source-aware target adapter must exist');return api.forLesson(l,options);};
const all=p=>[...p.words,...p.phrases,...p.priorWords,...p.priorPhrases];

test('Book 2 lesson 2 earlier expressions require two sentences while genuine new usages retain five',async()=>{
  assert.equal(typeof api.forLesson,'function','the source-aware target adapter must exist');
  const {c,options}=await real(),l=c.LESSONS.find(l=>l.book===2&&l.number===2),p=c.StudyWritingTargets.forLesson(l,{...options,learnedLessonIds:[c.LESSONS.find(x=>x.book===2&&x.number===1).id]});
  assert.deepEqual(Array.from(p.priorPhrases,x=>[x.phrase,x.source.number,x.requiredCount]),[['turn round',1,2],['have a conversation',1,2]]);
  assert.equal(p.phrases.some(x=>['turn round','have a conversation'].includes(x.phrase)),false);
  assert.equal(p.phrases.find(x=>x.phrase==='get up').requiredCount,5);
  assert.equal(p.phrases.find(x=>x.phrase==='next weekend').requiredCount,5);
  assert(p.priorPhrases.every(x=>x.fromCurrentLesson===true&&x.storageSourceId===l.id));
});

test('source-supported ring and repeat keep the exact old draft labels',async()=>{
  assert.equal(typeof api.forLesson,'function','the source-aware target adapter must exist');
  const {c,options}=await real(),l=c.LESSONS.find(l=>l.book===2&&l.number===2),p=c.StudyWritingTargets.forLesson(l,options);
  const rows=all(p);for(const [raw,base] of [['rang','ring'],['repeated','repeat']]){
    const target=rows.find(x=>x.word===base);assert(target,base+' must use the authored vocabulary label');
    assert.equal(target.storageLabel,raw);assert.equal(rows.some(x=>x.word===raw),false);
    assert.equal(target.source.id,l.id);assert.equal(target.requiredCount,5);
  }
});

test('canonical forms count as earlier only with earlier lexical evidence and precede optional padding',()=>{
  const old=lesson('old',1,[{word:'ring',pos:'v.',meaning:'响'},{word:'book',pos:'n.',meaning:'书'},{word:'chair',pos:'n.',meaning:'椅子'}]);
  const now=lesson('now',2,[{word:'ring',pos:'v.',meaning:'响'},{word:'rang',meaning:'ring的过去式',isLessonNew:true},{word:'novel',meaning:'小说',isLessonNew:true}],[],[{en:'The bell rang. A novel.'}]);
  const p=plan(now,{lessons:[now,old],learnedLessonIds:['old'],getNewWords:()=>now.vocabulary.slice(1)});
  assert.deepEqual(p.words.map(x=>[x.word,x.requiredCount]),[['novel',5]]);
  assert.deepEqual(p.priorWords.map(x=>[x.word,x.requiredCount]),[['ring',2],['book',2]]);
  assert.equal(p.priorWords[0].storageLabel,'rang');
});

test('no suffix stemming of nouns or ambiguous person forms and no unsupported dictionary lemma',()=>{
  const now=lesson('now',2,[{word:'sing',pos:'v.'},{word:'singer',pos:'n.',isLessonNew:true},{word:'rose',pos:'n.',isLessonNew:true},{word:'rise',pos:'v.'},{word:'rang',dictionaryHeadword:'ring',isLessonNew:true},{word:'ring',pos:'n.'}],[],[{en:'The singer held a rose and rang.'}]);
  const p=plan(now,{lessons:[now],getNewWords:()=>now.vocabulary.filter(x=>x.isLessonNew)});
  assert.deepEqual(p.words.map(x=>x.word),['singer','rose','rang']);
});

test('explicit authored source forms are supported without modifying source objects',()=>{
  const now=lesson('now',2,[{word:'wind',pos:'v.',sourceForms:['wound'],meaning:'给上发条'},{word:'wound',pos:'v.',isLessonNew:true}],[],[{en:'He wound the clock.'}]);
  const before=JSON.stringify(now),p=plan(now,{lessons:[now],getNewWords:()=>[now.vocabulary[1]]});
  assert.deepEqual(p.words.map(x=>[x.word,x.storageLabel]),[['wind','wound']]);
  assert.equal(JSON.stringify(now),before);
});

test('future lessons and unlearned padding never enter the small prior batch',()=>{
  const old=lesson('old',1,[{word:'book'},{word:'pen'},{word:'desk'}],[{phrase:'look at'},{phrase:'sit down'},{phrase:'stand up'}]);
  const now=lesson('now',2,[{word:'today',isLessonNew:true}]);
  const future=lesson('future',3,[{word:'tomorrow'}],[{phrase:'next year'}]);
  const p=plan(now,{lessons:[future,now,old],learnedLessonIds:['old','future']});
  assert.equal(p.priorWords.length,2);assert.equal(p.priorPhrases.length,2);
  assert(all(p).every(x=>x.source.number<=2));
  const none=plan(now,{lessons:[old,now,future],learnedLessonIds:[]});
  assert.equal(none.priorWords.length,0);assert.equal(none.priorPhrases.length,0);
});

test('current references are all retained while only learned earlier books establish prior knowledge',()=>{
  const older={...lesson('older',1,[],[{phrase:'get up'}]),book:1};
  const old=lesson('old',1,[],[{phrase:'turn round'},{phrase:'have a conversation'},{phrase:'look at'},{phrase:'padding'}]);
  const now=lesson('now',2,[],[{phrase:'turn round'},{phrase:'have a conversation'},{phrase:'look at'},{phrase:'get up'}]);
  const fresh=plan(now,{lessons:[older,old,now],learnedLessonIds:[]});
  assert.deepEqual(fresh.phrases.map(x=>x.phrase),['get up']);
  assert.deepEqual(fresh.priorPhrases.map(x=>x.phrase),['turn round','have a conversation','look at']);
  assert(fresh.priorPhrases.every(x=>x.fromCurrentLesson===true&&x.storageSourceId==='now'));
  const learned=plan(now,{lessons:[older,old,now],learnedLessonIds:['older','old']});
  assert.equal(learned.phrases.length,0);assert.equal(learned.priorPhrases.length,4);
  assert(!learned.priorPhrases.some(x=>x.phrase==='padding'));
});

test('an earlier noun spelling never reclassifies a newly introduced verb as old knowledge',()=>{
  const old=lesson('old',1,[{word:'ring',pos:'n.',meaning:'戒指'}]);
  const now=lesson('now',2,[{word:'ring',pos:'v.',meaning:'响'},{word:'rang',isLessonNew:true}],[],[{en:'The bell rang.'}]);
  const p=plan(now,{lessons:[old,now],getNewWords:()=>[now.vocabulary[1]]});
  assert.deepEqual(p.words.map(x=>[x.word,x.requiredCount]),[['ring',5]]);
});

test('learned lesson sets from another browser realm still enable earlier-book evidence',()=>{
  const old={...lesson('old',1,[],[{phrase:'get up'}]),book:1};
  const now=lesson('now',2,[],[{phrase:'get up'}]);
  const p=plan(now,{lessons:[old,now],learnedLessonIds:vm.runInNewContext("new Set(['old'])")});
  assert.equal(p.phrases.length,0);assert.equal(p.priorPhrases[0].source.id,'old');
});

test('all 276 real lessons keep source bindings, names excluded, quotas and unique normalized targets',async()=>{
  assert.equal(typeof api.forLesson,'function','the source-aware target adapter must exist');
  const {c,options}=await real();assert.equal(c.LESSONS.length,276);
  let currentCount=0;
  for(const l of c.LESSONS){
    const p=c.StudyWritingTargets.forLesson(l,options),seen=new Set();
    for(const rows of [p.priorWords,p.priorPhrases])assert(rows.filter(x=>!x.fromCurrentLesson).length<=Math.max(0,2-rows.filter(x=>x.fromCurrentLesson).length),l.id);
    for(const [category,rows] of Object.entries(p))for(const row of rows){
      const kind=category.toLowerCase().includes('phrase')?'phrase':'word';
      const label=row[kind].normalize('NFKC').replace(/[‘’]/g,"'").trim().toLowerCase().replace(/\s+/g,' '),key=kind+':'+label;
      assert(!seen.has(key),l.id+' '+key);seen.add(key);
      const source=c.LESSONS.find(x=>x.id===row.source.id);assert(source,l.id+' source exists');
      if(category.startsWith('prior')){assert([1,2].includes(row.requiredCount));assert(source.book<l.book||source.book===l.book&&source.number<l.number);}
      else{assert.equal(source.id,l.id);assert.equal(row.requiredCount,5);currentCount++;}
      if(kind==='word')assert.equal(c.StudyPersonNameTargets.isPersonNameTarget(row,source),false,l.id+' '+label);
    }
  }
  assert(currentCount>5000,'every current target remains cumulative, independent of daily batching');
});

test('invalid lessons return an empty plan and callbacks can safely decline targets',()=>{
  assert.deepEqual(plan(null,{}),{words:[],phrases:[],priorWords:[],priorPhrases:[]});
  const now=lesson('now',2,[{word:'fallback',isLessonNew:true}]);
  assert.deepEqual(plan(now,{lessons:[now],getNewWords:()=>[],getUsage:()=>[]}),{words:[],phrases:[],priorWords:[],priorPhrases:[]});
});
