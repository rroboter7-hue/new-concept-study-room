/* Optional source-backed vocabulary and usage reference for free writing. */
(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./sentence-core.js'):root.StudySentences,
  typeof module==='object'&&module.exports?require('./person-name-targets.js'):root.StudyPersonNameTargets,
  typeof module==='object'&&module.exports?require('./sentence-wordbank-data.js'):root.StudySentenceWordbankData);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StudyWritingLibrary=api;
})(typeof window!=='undefined'?window:globalThis,function(sentences,people,corrections){
 'use strict';
 const list=value=>Array.isArray(value)?value:[];
 const text=value=>typeof value==='string'?value.trim():'';
 const normalize=value=>text(value).normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s+/g,' ').toLowerCase();
 // Display spelling is independent of the normalized identity used by saved references.
 const displayLabel=value=>/^(?:japanese|german|korean)$/i.test(text(value))?text(value).charAt(0).toUpperCase()+text(value).slice(1).toLowerCase():value;
 const before=(a,b)=>a.book<b.book||a.book===b.book&&a.number<b.number;
 const valid=lesson=>lesson&&typeof lesson.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(lesson.id)&&Number.isInteger(lesson.book)&&lesson.book>=1&&lesson.book<=4&&Number.isInteger(lesson.number)&&lesson.number>=1&&lesson.number<=10000;
 const names=new Set(['mr','mrs','ms','dr','sir','madam','prof','rev','esq','mister','madame','mademoiselle','monsieur']);
 const metaGlosses=new Set(['特殊疑问词','一般疑问词','一般疑问句','特殊疑问句','肯定句','否定句','陈述句','祈使句','多模仿少创造','动词原形','原型']);
 const isMetaGloss=value=>metaGlosses.has(text(value).replace(/[。.!！\s]+$/g,''));
 const categoryLabels=Object.freeze({verb:'动词',adjective:'形容词',noun:'名词',adverb:'副词',word:'其他单词',phrase:'用法表达'});
 const posCategory=pos=>{
  const tokens=normalize(pos).match(/[a-z]+|[\u3400-\u9fff]+/g)||[];
  if(tokens.some(token=>['v','vt','vi','verb','verbs','动词','及物动词','不及物动词','助动词'].includes(token)))return 'verb';
  if(tokens.some(token=>['a','adj','adjective','adjectives','形容词'].includes(token)))return 'adjective';
  if(tokens.some(token=>['n','noun','nouns','名词'].includes(token)))return 'noun';
  if(tokens.some(token=>['adv','adverb','adverbs','副词'].includes(token)))return 'adverb';
  return 'word';
 };
 const posLabels=Object.freeze({v:'verb',vt:'verb',vi:'verb',verb:'verb',n:'noun',noun:'noun',a:'adjective',adj:'adjective',adjective:'adjective',adv:'adverb',adverb:'adverb'});
 function dictionarySections(meaning){
  const sections=[];
  for(const line of text(meaning).split(/[\r\n]+/)){
   const cleaned=line.replace(/^\s*(?:\[[^\]]+\]\s*)+/,'').trim();
   const match=cleaned.match(/^(vt|vi|v|noun|n|adj|adjective|a|adverb|adv)\.\s*/i);
   if(match)sections.push({category:posLabels[match[1].toLowerCase()],text:cleaned.slice(match[0].length)});
   else if(cleaned&&!/^\[[^\]]+\]/.test(line))sections.push({category:'word',text:cleaned});
  }
  return sections;
 }
 function briefGloss(meaning,category){
  const sections=dictionarySections(meaning);
  const selected=sections.find(section=>section.category===category)||sections[0];
  if(!selected)return '';
  const clauses=selected.text.replace(/\[[^\]]+\]/g,'').split(/[,，;；。]/).map(part=>part.trim()).filter(Boolean);
  const complete=part=>{
   let depth=0;
   for(const char of part.replace(/（/g,'(').replace(/）/g,')')){
    if(char==='(')depth++;
    if(char===')'&&--depth<0)return false;
   }
   const bare=part.replace(/^[（(\s]+/,'').replace(/[）)\s]+$/,'');
   return depth===0&&/[\u3400-\u9fff]/.test(part)&&
    !/^(?:尤当|尤其当|仅当|注意|用于|用在|语法|词形)/.test(bare)&&
    !/^(?:缩写|略语|助动词|前缀|后缀)$/.test(bare);
  };
  return clauses.find(complete)||'';
 }
 function preparedWord(row){
  const word=normalize(row.word),sections=row.meaningSource==='ECDICT'?dictionarySections(row.meaning):[];
  const multiPos=new Set(sections.map(section=>section.category).filter(category=>category!=='word')).size>1;
  if(/(?:'(?:s|m|re|ve|ll|d)|n't)$/i.test(word))return {...row,pos:''};
  if(row.meaningSource==='ECDICT'&&word==='very'&&/^thank you very much[.!?]?$/i.test(text(row.sourceSentence))&&sections.some(section=>section.category==='adverb'))return {...row,pos:'adv.'};
  if(row.meaningSource==='ECDICT'&&multiPos&&!text(row.sourceSentence)&&!text(row.contextEvidence?.sourceText))return {...row,pos:''};
  return row;
 }
 function supplied(provider,lesson,field){
  if(typeof provider==='function')try{const value=provider(lesson);if(Array.isArray(value))return value;}catch(_){}
  return list(lesson[field]);
 }
 function forLesson(lesson,options={}){
  if(!valid(lesson)||!sentences||typeof sentences.wordBank!=='function')return [];
  options=options&&typeof options==='object'?options:{};
  const learned=new Set(list(options.learnedLessonIds).filter(id=>typeof id==='string'));
  const range=options.learningRange?.version===1?options.learningRange.books:null;
  const known=source=>source.id===lesson.id||before(source,lesson)&&(options.includeEarlierLessons===true||learned.has(source.id)||
   (range&&Number.isInteger(range[source.book])&&range[source.book]>=source.number));
  const selected=new Map();
  for(const source of [...list(options.lessons),lesson])if(valid(source)&&known(source)&&!selected.has(source.id))selected.set(source.id,source);
  selected.set(lesson.id,lesson);
  const person=typeof options.isPersonNameTarget==='function'?options.isPersonNameTarget:people?.isPersonNameTarget;
  function safe(row,source,kind){
   if(!row||typeof row!=='object'||Array.isArray(row)||row.practiceEligible===false||row.needsContextReview===true||row.contextMeaningStale===true||row.meaningSource==='unavailable'||row.isPersonName===true||row.isHonorific===true||row.isPersonNameTarget===true||isMetaGloss(row.meaning))return false;
   if(kind==='word'){
    const word=text(row.word);
    if(!word||names.has(normalize(word).replace(/\.$/,'')))return false;
    try{if(person?.({...row,kind:'word',source:{id:source.id,book:source.book,number:source.number,title:source.title}},source)===true)return false;}catch(_){return false;}
   }
   return true;
  }
  const targets=options.writingTargets&&typeof options.writingTargets==='object'?options.writingTargets:{};
  const prepared=[],referenceAliases=new Map(),acceptedOriginals=new Map();
  for(const source of selected.values()){
   let sourceTargets={};
   if(typeof options.getWritingTargets==='function')try{sourceTargets=options.getWritingTargets(source)||{};}catch(_){}
   const referenced=(field)=>{
    const fromPlan=(plan,assumeSource)=>[...list(plan[field]),...list(plan[field==='words'?'priorWords':'priorPhrases'])].filter(row=>
     row&&typeof row==='object'&&(row.source?.id?row.source.id===source.id:assumeSource));
    return fromPlan(targets,source.id===lesson.id).concat(fromPlan(sourceTargets,true));
   };
   const providerWords=supplied(options.getVocabulary,source,'vocabulary');
   const quarantined=new Set(providerWords.filter(row=>row?.contextMeaningStale===true||row?.needsContextReview===true||row?.meaningSource==='unavailable')
    .map(row=>normalize(row.word)).filter(Boolean));
   const targetWords=referenced('words').filter(row=>safe(row,source,'word')&&!quarantined.has(normalize(row.word)));
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
   const corrected=typeof corrections?.vocabularyForLesson==='function'?corrections.vocabularyForLesson(source,list(source.vocabulary)):list(source.vocabulary);
   const originalWords=list(corrected).filter(row=>safe(row,source,'word')&&!quarantined.has(normalize(row.word)));
   acceptedOriginals.set(source.id,new Set(originalWords));
   const vocabulary=originalWords.concat(providerWords).filter(row=>
    safe(row,source,'word')&&!(row.meaningSource==='ECDICT'&&aliases.has(normalize(row.word)))).map(preparedWord);
   const usage=supplied(options.getUsage,source,'usage').filter(row=>safe(row,source,'phrase')).slice();
   vocabulary.push(...targetWords.map(preparedWord));
   usage.push(...referenced('phrases').filter(row=>safe(row,source,'phrase')));
   for(const row of referenced('words')){
    if(quarantined.has(normalize(row.word)))continue;
    const key=source.id+'|'+normalize(row.word),values=[];
    for(const alias of [row.storageLabel,...list(row.sourceForms)])if(normalize(alias)&&normalize(alias)!==normalize(row.word)){
     try{const value='word:'+encodeURIComponent(source.id)+':'+encodeURIComponent(normalize(alias));if(value.length<=600)values.push(value);}catch(_){/* Damaged imported labels do not form identity aliases. */}
    }
    if(values.length)referenceAliases.set(key,values);
   }
   prepared.push({...source,vocabulary,usage});
  }
  const bank=sentences.wordBank({currentLesson:{id:'writing-library-horizon',book:4,number:10000},lessons:prepared});
  const rowsBySource=new Map(prepared.map(source=>[source.id,source]));
  function cardMeaning(item){
   const field=item.category==='phrase'?'phrase':'word',key=normalize(item.label);
   const candidates=[];
   for(const origin of item.sources){
    const preparedSource=rowsBySource.get(origin.id);
    for(const row of list(preparedSource?.[field==='word'?'vocabulary':'usage'])){
     const context=!!(list(row?.contextCorrections).length||row?.meaningProvenance?.kind==='self-authored-context'||/context|passage|textbook/i.test(text(row?.sourceType))||/语境|校对|复核/.test(text(row?.meaningSource)));
     candidates.push({row,priority:row?.source?.id===origin.id?5:context?4:field==='word'&&acceptedOriginals.get(origin.id)?.has(row)?2:1});
    }
   }
   const matching=candidates.filter(({row})=>normalize(row?.[field])===key&&row?.meaningSource!=='ECDICT'&&!isMetaGloss(row?.meaning)&&
    (field==='phrase'||posCategory(preparedWord(row).pos)===item.category)).sort((a,b)=>b.priority-a.priority);
   for(const {row} of matching){const gloss=briefGloss(row.meaning,item.category);if(gloss)return gloss;}
   const source=rowsBySource.get(item.source.id),rows=list(source?.[field==='word'?'vocabulary':'usage']);
   for(const row of rows)if(normalize(row?.[field])===key&&(field==='phrase'||posCategory(row?.pos)===item.category)){
    const gloss=briefGloss(row.meaning,item.category);if(gloss)return gloss;
   }
   return briefGloss(item.meaning,item.category);
  }
  const entries=bank.map(item=>{
   const source=rowsBySource.get(item.source.id);
   const rows=item.category==='phrase'?source.usage:source.vocabulary;
   const field=item.category==='phrase'?'phrase':'word';
   const evidence=rows.find(row=>normalize(row?.[field])===normalize(item.label)&&
    (field==='phrase'||normalize(row?.pos)===normalize(item.pos))&&
    text(row?.example)&&/[A-Za-z]/.test(row.example)&&!row.example.includes('___'));
   const aliases=[...list(item.aliases)];
   if(field==='word')for(const origin of item.sources)aliases.push(...list(referenceAliases.get(origin.id+'|'+normalize(item.label))));
   const meaning=cardMeaning(item);
   const result={key:item.key,aliases:[...new Set(aliases)],label:displayLabel(item.label),meaning,category:item.category,pos:item.pos,source:{...item.source},sources:item.sources.map(origin=>({...origin}))};
   if(meaning!==item.meaning)result.detailMeaning=item.meaning;
   if(evidence)result.example=evidence.example.trim();
   return result;
  });
  const taughtLabels=new Set(entries.filter(item=>item.category!=='word'&&item.category!=='phrase'&&item.sources.some(origin=>
   list(rowsBySource.get(origin.id)?.vocabulary).some(row=>normalize(row?.word)===normalize(item.label)&&row?.meaningSource!=='ECDICT'))).map(item=>normalize(item.label)));
  const useful=entries.filter(item=>item.meaning).filter(item=>{
   if(item.category!=='word'||!taughtLabels.has(normalize(item.label)))return true;
   return !item.sources.every(origin=>list(rowsBySource.get(origin.id)?.vocabulary).filter(row=>normalize(row?.word)===normalize(item.label)).every(row=>
    row.meaningSource==='ECDICT'&&new Set(dictionarySections(row.meaning).map(section=>section.category).filter(category=>category!=='word')).size>1&&
    !text(row.sourceSentence)&&!text(row.contextEvidence?.sourceText)));
  });
  return useful.filter(item=>item.category!=='phrase').concat(useful.filter(item=>item.category==='phrase'));
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
