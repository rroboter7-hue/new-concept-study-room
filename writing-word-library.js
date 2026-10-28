/* Optional source-backed vocabulary and usage reference for free writing. */
(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./sentence-core.js'):root.StudySentences,
  typeof module==='object'&&module.exports?require('./person-name-targets.js'):root.StudyPersonNameTargets);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StudyWritingLibrary=api;
})(typeof window!=='undefined'?window:globalThis,function(sentences,people){
 'use strict';
 const list=value=>Array.isArray(value)?value:[];
 const text=value=>typeof value==='string'?value.trim():'';
 const normalize=value=>text(value).normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s+/g,' ').toLowerCase();
 const before=(a,b)=>a.book<b.book||a.book===b.book&&a.number<b.number;
 const valid=lesson=>lesson&&typeof lesson.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(lesson.id)&&Number.isInteger(lesson.book)&&lesson.book>=1&&lesson.book<=4&&Number.isInteger(lesson.number)&&lesson.number>=1&&lesson.number<=10000;
 const names=new Set(['mr','mrs','ms','dr','sir','madam','prof','rev','esq','mister','madame','mademoiselle','monsieur']);
 const categoryLabels=Object.freeze({verb:'动词',adjective:'形容词',noun:'名词',adverb:'副词',word:'其他单词',phrase:'用法表达'});
 function supplied(provider,lesson,field){
  if(typeof provider==='function')try{const value=provider(lesson);if(Array.isArray(value))return value;}catch(_){}
  return list(lesson[field]);
 }
 function forLesson(lesson,options={}){
  if(!valid(lesson)||!sentences||typeof sentences.wordBank!=='function')return [];
  options=options&&typeof options==='object'?options:{};
  const learned=new Set(list(options.learnedLessonIds).filter(id=>typeof id==='string'));
  const range=options.learningRange?.version===1?options.learningRange.books:null;
  const known=source=>source.id===lesson.id||before(source,lesson)&&(learned.has(source.id)||
   (range&&Number.isInteger(range[source.book])&&range[source.book]>=source.number));
  const selected=new Map();
  for(const source of [...list(options.lessons),lesson])if(valid(source)&&known(source)&&!selected.has(source.id))selected.set(source.id,source);
  selected.set(lesson.id,lesson);
  const person=typeof options.isPersonNameTarget==='function'?options.isPersonNameTarget:people?.isPersonNameTarget;
  function safe(row,source,kind){
   if(!row||typeof row!=='object'||Array.isArray(row)||row.practiceEligible===false||row.needsContextReview===true||row.isPersonName===true||row.isHonorific===true||row.isPersonNameTarget===true)return false;
   if(kind==='word'){
    const word=text(row.word);
    if(!word||names.has(normalize(word).replace(/\.$/,'')))return false;
    try{if(person?.({...row,kind:'word',source:{id:source.id,book:source.book,number:source.number,title:source.title}},source)===true)return false;}catch(_){return false;}
   }
   return true;
  }
  const targets=options.writingTargets&&typeof options.writingTargets==='object'?options.writingTargets:{};
  const prepared=[];
  for(const source of selected.values()){
   let sourceTargets={};
   if(typeof options.getWritingTargets==='function')try{sourceTargets=options.getWritingTargets(source)||{};}catch(_){}
   const referenced=(field)=>{
    const fromPlan=(plan,assumeSource)=>[...list(plan[field]),...list(plan[field==='words'?'priorWords':'priorPhrases'])].filter(row=>
     row&&typeof row==='object'&&(row.source?.id?row.source.id===source.id:assumeSource));
    return fromPlan(targets,source.id===lesson.id).concat(fromPlan(sourceTargets,true));
   };
   const targetWords=referenced('words').filter(row=>safe(row,source,'word'));
   const aliases=new Set();
   for(const row of targetWords){
    // An alias is evidence for this source only when the canonical target
    // names that source. Never infer a lemma from a suffix or an ECDICT gloss.
    if(row.source?.id!==source.id||!/[\u3400-\u9fff]/.test(text(row.meaning)))continue;
    for(const alias of [row.storageLabel,...list(row.sourceForms)]){
     const form=normalize(alias);
     if(form&&form!==normalize(row.word))aliases.add(form);
    }
   }
   const vocabulary=supplied(options.getVocabulary,source,'vocabulary').filter(row=>
    safe(row,source,'word')&&!(row.meaningSource==='ECDICT'&&aliases.has(normalize(row.word)))).slice();
   const usage=supplied(options.getUsage,source,'usage').filter(row=>safe(row,source,'phrase')).slice();
   vocabulary.push(...targetWords);
   usage.push(...referenced('phrases').filter(row=>safe(row,source,'phrase')));
   prepared.push({...source,vocabulary,usage});
  }
  const bank=sentences.wordBank({currentLesson:{id:'writing-library-horizon',book:4,number:10000},lessons:prepared});
  const rowsBySource=new Map(prepared.map(source=>[source.id,source]));
  const entries=bank.map(item=>{
   const source=rowsBySource.get(item.source.id);
   const rows=item.category==='phrase'?source.usage:source.vocabulary;
   const field=item.category==='phrase'?'phrase':'word';
   const evidence=rows.find(row=>normalize(row?.[field])===normalize(item.label)&&
    (field==='phrase'||normalize(row?.pos)===normalize(item.pos))&&
    text(row?.example)&&/[A-Za-z]/.test(row.example)&&!row.example.includes('___'));
   const result={key:item.key,label:item.label,meaning:item.meaning,category:item.category,pos:item.pos,source:{...item.source},sources:item.sources.map(origin=>({...origin}))};
   if(evidence)result.example=evidence.example.trim();
   return result;
  });
  return entries.filter(item=>item.category!=='phrase').concat(entries.filter(item=>item.category==='phrase'));
 }
 function filter(entries,options={}){
  const book=Number(options.book),category=options.category==='usage'?'phrase':options.category,query=normalize(options.query);
  return list(entries).filter(item=>item&&(!Number.isInteger(book)||book<1||list(item.sources).some(source=>source.book===book))&&
   (!category||category==='all'||item.category===category)&&(!query||normalize(item.label+' '+item.meaning+' '+item.pos).includes(query)));
 }
 function recommend(entries,options={}){
  const count=Number.isInteger(options.count)?Math.max(0,Math.min(options.count,50)):6;
  const target=options.target||{},label=normalize(target.label||target.word||target.phrase),words=new Set(label.split(/[^a-z]+/).filter(part=>part.length>=3));
  const pool=list(entries).filter(item=>item&&normalize(item.label)!==label);
  const rank=item=>{
   const itemWords=normalize(item.label).split(/[^a-z]+/);
   const overlap=itemWords.filter(part=>words.has(part)).length;
   const current=target.source?.id&&item.sources?.some(source=>source.id===target.source.id)?1:0;
   return overlap*20+current*5+(item.category==='phrase'?3:item.category==='verb'?2:item.category==='adjective'?1:0);
  };
  pool.sort((a,b)=>rank(b)-rank(a)||a.key.localeCompare(b.key));
  const rotation=Number.isInteger(options.rotation)?Math.max(0,options.rotation):0;
  if(pool.length&&rotation)pool.push(...pool.splice(0,rotation%pool.length));
  const selected=[],used=new Set();
  for(const category of ['phrase','verb','adjective']){
   const candidate=pool.find(item=>item.category===category&&!used.has(item.key));
   if(candidate&&selected.length<count){selected.push(candidate);used.add(candidate.key);}
  }
  for(const item of pool)if(selected.length<count&&!used.has(item.key)){selected.push(item);used.add(item.key);}
  return selected;
 }
 return Object.freeze({forLesson,recommend,filter,categoryLabels});
});
