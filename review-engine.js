(function(global){
 'use strict';
 const DAY=86400000,OFFSET=8*3600000,INTERVALS=[1,3,7,14,30];
 const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
 const normalize=v=>String(v??'').normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase().replace(/[.!?,;:"“”'。！？]+$/g,'').replace(/\s+/g,' ');
 const timestamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<8640000000000000;
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const nowOf=options=>timestamp(options?.now)?options.now:Date.now();
 const validId=id=>typeof id==='string'&&id.startsWith('review:')&&id.length<=8000;
 const own=(value,key)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.getOwnPropertyDescriptor(value,key)?.value:undefined;
 function dayKey(at=Date.now()){return new Date(at+OFFSET).toISOString().slice(0,10);}

 function hasStudied(record){
  const attempts=own(record,'attempts'),progress=own(record,'learningProgress');
  return own(record,'completed')===true||typeof attempts==='number'&&Number.isFinite(attempts)&&Math.floor(attempts)>0||timestamp(own(progress,'readAt'))||timestamp(own(progress,'firstPracticedAt'));
 }

 function grammarIds(item,sourceId){
  const values=[],ids=[];
  for(const value of [item,own(item,'evidence'),own(item,'metadata')])for(const field of ['knowledgeId','conceptId','grammarConceptId']){const id=own(value,field);if(typeof id==='string'&&id.trim())values.push(id);}
  const key=own(item,'key');if(typeof key==='string'&&key.startsWith('grammar:id:'))values.push(key.slice('grammar:id:'.length));
  for(let value of values){
   const scoped=value.match(/^knowledge:([^:]+):grammar:(.+)$/);
   if(scoped){try{if(sourceId!==undefined&&decodeURIComponent(scoped[1])!==sourceId)return [];value=decodeURIComponent(scoped[2]);}catch{return [];}}
   else if(value.startsWith('knowledge:'))return [];
   value=normalize(value);if(value&&!ids.includes(value))ids.push(value);
  }
  return ids;
 }

 function matchRecurrences(cards,hits,options={}){
  const seen=new Set(),concepts=new Set(),selected=[],studiedOnly=options.studiedOnly!==false;
  const forms=(item,primary)=>[own(item,primary),own(item,'matchedForm'),...(Array.isArray(own(item,'variants'))?item.variants:[])].filter(value=>typeof value==='string'&&value.trim()).map(normalize);
  for(const hit of Array.isArray(hits)?hits:[]){
   if(!hit)continue;const concept=hit.key||hit.kind+':'+normalize(hit.label);if(concepts.has(concept))continue;
   const candidates=(Array.isArray(cards)?cards:[]).filter(card=>{
    const id=own(card,'id'),sourceId=own(own(card,'sourceLesson'),'id'),kind=own(card,'kind');
    if(typeof id!=='string'||typeof sourceId!=='string'||seen.has(id)||/未附(?:独立)?中文释义|未提供中文释义/.test(text(card.prompt)))return false;
    if(!(Array.isArray(hit?.origins)?hit.origins:[]).some(origin=>own(origin,'lessonId')===sourceId&&(!studiedOnly||own(origin,'studied')===true)))return false;
    if(hit.kind==='grammar')return kind==='grammar'&&grammarIds(hit).some(key=>grammarIds(card,sourceId).includes(key));
    return kind===(hit.kind==='vocabulary'?'word':hit.kind==='usage'?'phrase':null)&&forms(hit,'label').some(form=>forms(card,'target').includes(form));
   });
   candidates.sort((a,b)=>Number(b.sourceLesson.id===hit.origin?.lessonId)-Number(a.sourceLesson.id===hit.origin?.lessonId));
   if(candidates.length){selected.push(candidates[0]);seen.add(candidates[0].id);concepts.add(concept);}
  }
  return selected;
 }

 function lexicalCue(item,kind){
  const rawMeaning=text(item.meaning),knownBad={make:'多模仿少创造',catch:'特殊疑问词',live:'国家城市'};
  const unusable=item.needsContextReview===true||/未附(?:独立)?中文释义|未提供中文释义|暂无释义|待(?:补充|复核)|原笔记习惯表达/.test(rawMeaning)||knownBad[normalize(item.word)]===rawMeaning;
  const definition=global.StudyRecurrence?.definitionFor(item,kind,global.STUDY_GLOSSARY),meaning=definition?definition.meaning:unusable?'':rawMeaning;
  if(meaning)return {prompt:meaning,promptType:'meaning-recall'};
  const example=text(item.example,1000),target=text(kind==='vocabulary'?item.word:item.phrase),forms=[text(item.matchedForm),target];
  for(const form of forms.filter(Boolean)){
   const escaped=form.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'),pattern='(^|[^A-Za-z0-9’\'\\-])('+escaped+')(?=$|[^A-Za-z0-9’\'\\-])',match=new RegExp(pattern,'i').exec(example);
   if(!match)continue;
   const cloze=example.replace(new RegExp(pattern,'gi'),(_,prefix)=>prefix+'____');
   if((cloze.match(/[A-Za-z]+/g)||[]).length<2)continue;
   return {prompt:'根据来源例句补全表达：'+cloze,promptType:'source-cloze',matchedForm:match[2]};
  }
  return null;
 }

 function cardsForLessons(lessons){
  const cards=[],seen=new Set();
  for(const lesson of Array.isArray(lessons)?lessons:[]){
   if(!lesson?.id||!integer(Number(lesson.book),1,4)||!Number.isFinite(Number(lesson.number)))continue;
   const bank=global.StudyKnowledge?.bank,registered=bank?.hasLesson(lesson.id),seenConcepts=new Set();
   const sourceLesson={id:String(lesson.id),book:Number(lesson.book),number:Number(lesson.number),title:text(lesson.title,180)};
   function add(kind,target,prompt,extra={}){
    target=text(target,2000);prompt=text(prompt,2000);if(!target||!prompt)return;
    const id='review:'+encodeURIComponent(sourceLesson.id)+':'+kind+':'+encodeURIComponent(normalize(kind==='grammar'?prompt:target));
    if(seen.has(id)||!validId(id))return;seen.add(id);
    cards.push({id,kind,target,prompt,sourceLesson,...extra});
   }
   for(const original of (lesson.vocabulary||[]).slice(0,100)){
    const v=registered?bank.wordForLesson(lesson.id,original?.word):original;
    if(!v?.word)continue;const cue=lexicalCue(v,'vocabulary');if(!cue)continue;
    add('word',v.word,cue.prompt,{...cue,phonetic:text(v.phonetic,100),pos:text(v.pos,30),example:text(v.example,1000),...(v.conceptId?{conceptId:v.conceptId}:{})});
   }
   for(const p of (lesson.usage||[]).slice(0,100)){
    if(!p?.phrase)continue;const cue=lexicalCue(p,'usage');if(!cue)continue;
    add('phrase',p.phrase,cue.prompt,{...cue,example:text(p.example,1000),explanation:text(p.note,1500),matchedForm:cue.matchedForm||text(p.matchedForm,200),variants:Array.isArray(p.variants)?p.variants.slice(0,20).map(v=>text(v,200)).filter(Boolean):[]});
   }
   for(const q of (registered?bank.quizForLesson(lesson.id):lesson.quiz||[]).slice(0,100)){
    if(q?.type==='vocabulary'||!Array.isArray(q?.options)||!integer(q.answer,0,q.options.length-1))continue;
    if(registered&&(!q.graded||!q.conceptId||seenConcepts.has(q.conceptId)))continue;if(q.conceptId)seenConcepts.add(q.conceptId);
    add('grammar',q.options[q.answer],q.question,{options:q.options.map(x=>text(x,500)),answer:q.answer,explanation:text(q.explanation,2000),...(q.conceptId?{conceptId:q.conceptId}:{}),...(q.knowledgeId?{knowledgeId:text(q.knowledgeId,8000)}:{}),...(q.grammarConceptId?{grammarConceptId:text(q.grammarConceptId,2000)}:{})});
   }
  }
  return cards;
 }

 function sanitize(raw){
  const state={version:1,cards:Object.create(null),daily:Object.create(null)};
  if(!raw||typeof raw!=='object')return state;
  for(const [id,r] of Object.entries(raw.cards||{}).slice(0,20000)){
   if(!validId(id)||!r||!timestamp(r.dueAt)||!timestamp(r.createdAt)||!integer(r.stage,0,INTERVALS.length)||!integer(r.revision,0,1000000))continue;
   state.cards[id]={stage:r.stage,dueAt:r.dueAt,createdAt:r.createdAt,revision:r.revision,
    repetitions:integer(r.repetitions,0,1000000)?r.repetitions:0,lapses:integer(r.lapses,0,1000000)?r.lapses:0,
    lastReviewedAt:timestamp(r.lastReviewedAt)?r.lastReviewedAt:null,lastRating:['again','hard','good'].includes(r.lastRating)?r.lastRating:null};
  }
  for(const [day,entry] of Object.entries(raw.daily||{}).filter(([d])=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort(([a],[b])=>b.localeCompare(a)).slice(0,90)){
   const answered=Array.isArray(entry?.answered)?entry.answered.filter(validId).slice(0,20000):[];
   state.daily[day]={answered:[...new Set(answered)]};
  }
  return state;
 }

 function enroll(raw,cards,options={}){
  const state=sanitize(raw),now=nowOf(options);
  for(const card of Array.isArray(cards)?cards:[]){
   if(!validId(card?.id)||state.cards[card.id])continue;
   state.cards[card.id]={stage:0,dueAt:now,createdAt:now,revision:0,repetitions:0,lapses:0,lastReviewedAt:null,lastRating:null};
  }
  return state;
 }

 function queue(raw,cards,options={}){
  const state=sanitize(raw),now=nowOf(options),limit=integer(options.limit,0,20000)?options.limit:20000;
  return (Array.isArray(cards)?cards:[]).filter(c=>{
   const r=state.cards[c.id];return r&&r.dueAt<=now&&(!options.lessonId||c.sourceLesson.id===options.lessonId)&&(!options.kind||c.kind===options.kind);
  }).sort((a,b)=>state.cards[a.id].dueAt-state.cards[b.id].dueAt||a.id.localeCompare(b.id)).slice(0,limit).map(c=>({...c,progress:{...state.cards[c.id]}}));
 }

 // A wrong lesson answer may revisit an existing card, but cannot enroll one
 // or move a similarly named concept from another lesson. No review rating is
 // inferred: stage and repetition/lapse counts change only after actual review.
 function revisitMistakes(raw,cards,conceptIds,options={}){
  const state=sanitize(raw),now=nowOf(options),wrong=new Set((Array.isArray(conceptIds)?conceptIds:[]).filter(id=>typeof id==='string'));
  for(const card of Array.isArray(cards)?cards:[]){
   const sourceId=card?.sourceLesson?.id,kind=card?.kind==='word'?'word':card?.kind==='grammar'?'grammar':null;
   if(typeof sourceId!=='string'||!kind||!validId(card.id)||!wrong.has(card.conceptId))continue;
   const source=encodeURIComponent(sourceId);
   const destination='review:'+source+':'+kind+':'+encodeURIComponent(normalize(kind==='grammar'?card.prompt:card.target));
   if(card.id!==destination||typeof card.conceptId!=='string'||!card.conceptId.startsWith('knowledge:'+source+':'+kind+':'))continue;
   if(kind==='word'&&card.conceptId!=='knowledge:'+source+':word:'+encodeURIComponent(normalize(card.target)))continue;
   const record=state.cards[card.id];
   if(!record||record.dueAt<=now||record.revision>=1000000)continue;
   record.dueAt=now;record.revision++;
  }
  return state;
 }

 // Expansion questions have their own IDs. Resolve their verified provenance
 // through the installed bank instead of guessing a vocabulary card by its word.
 function revisitQuestionMistakes(raw,cards,lessonId,questionIds,options={}){
  const state=sanitize(raw),bank=global.StudyKnowledge?.bank,targets=new Set();
  if(typeof lessonId!=='string'||typeof bank?.hasLesson!=='function'||typeof bank.questionsForLesson!=='function'||typeof bank.get!=='function'||!bank.hasLesson(lessonId))return state;
  const requested=new Set((Array.isArray(questionIds)?questionIds:[]).filter(id=>typeof id==='string'));
  for(const question of bank.questionsForLesson(lessonId)){
   if(!question?.graded||!requested.has(question.id)||typeof question.conceptId!=='string')continue;
   const record=bank.get(question.conceptId),kind=question.type==='vocabulary'?'word':question.type==='grammar'?'grammar':null;
   if(!kind||record?.id!==question.conceptId||record.conceptId!==question.conceptId||record.lessonId!==lessonId||record.kind!==kind)continue;
   if(kind==='grammar'){targets.add(record.id);continue;}
   const sourceIds=record.sourceConceptIds;
   if(record.status!=='approved'||record.source?.authoredQuestionId!==question.id||record.sourceLessonId!==question.sourceLessonId||!bank.hasLesson(record.sourceLessonId)||!Array.isArray(sourceIds)||!sourceIds.length||!Array.isArray(question.sourceConceptIds)||sourceIds.length!==question.sourceConceptIds.length||!sourceIds.every((id,i)=>id===question.sourceConceptIds[i]))continue;
   const sources=sourceIds.map(id=>bank.get(id));
   if(sources.some((source,i)=>source?.id!==sourceIds[i]||source.conceptId!==sourceIds[i]||source.kind!=='word'||source.status!=='current-vocabulary'||source.lessonId!==record.sourceLessonId||source.id!=='knowledge:'+encodeURIComponent(source.lessonId)+':word:'+encodeURIComponent(normalize(source.word))))continue;
   for(const source of sources)targets.add(source.id);
  }
  return revisitMistakes(state,cards,[...targets],options);
 }

 function rate(raw,id,rating,options={}){
  const state=sanitize(raw),record=state.cards[id],now=nowOf(options);
  if(!record||!['again','hard','good'].includes(rating)||!integer(options.revision,0,1000000)||record.revision!==options.revision||record.dueAt>now)return {accepted:false,state};
  if(rating==='good'){
   record.stage=Math.min(INTERVALS.length,record.stage+1);
   record.dueAt=now+INTERVALS[record.stage-1]*DAY;
  }else if(rating==='hard')record.dueAt=now+DAY;
  else {record.stage=Math.max(0,record.stage-1);record.dueAt=now+600000;record.lapses++;}
  record.revision++;record.repetitions++;record.lastReviewedAt=now;record.lastRating=rating;
  const day=dayKey(now),entry=state.daily[day]||(state.daily[day]={answered:[]});
  if(!entry.answered.includes(id))entry.answered.push(id);
  return {accepted:true,state,nextDueAt:record.dueAt};
 }

 function stats(raw,cards,options={}){
  const state=sanitize(raw),now=nowOf(options),known=new Set((cards||[]).map(c=>c.id));
  const records=Object.entries(state.cards).filter(([id])=>known.has(id));
  const today=dayKey(now),end=Date.parse(today+'T00:00:00Z')-OFFSET+DAY;
  const due=records.filter(([,r])=>r.dueAt<=now).length;
  const todayRemaining=records.filter(([,r])=>r.dueAt<end).length;
  const reviewedToday=(state.daily[today]?.answered||[]).filter(id=>known.has(id)).length;
  const next=records.map(([,r])=>r.dueAt).filter(t=>t>now).sort((a,b)=>a-b)[0]??null;
  return {enrolled:records.length,due,todayRemaining,reviewedToday,nextDueAt:next};
 }

 function answerForms(card){
  const values=card?.kind==='phrase'?[card.target,card.matchedForm,...(Array.isArray(card.variants)?card.variants:[])]:card?.promptType==='source-cloze'?[card.target,card.matchedForm]:[card?.target];
  return [...new Set(values.map(v=>text(v)).filter(Boolean).map(normalize).filter(Boolean))];
 }

 function hasPhrase(card,input){
  if(card?.kind!=='phrase')return false;
  const tokens=value=>normalize(value).match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g)||[];
  const answer=' '+tokens(input).join(' ')+' ';
  const phraseForms=global.StudyRecurrence?.phraseForms;
  const forms=answerForms(card).flatMap(form=>typeof phraseForms==='function'?[form,...phraseForms(form)]:[form]);
  return forms.some(form=>{
   const phrase=tokens(form).join(' ');
   return Boolean(phrase)&&answer.includes(' '+phrase+' ');
  });
 }

 function checkAnswer(card,input){
  const answer=normalize(input);
  return {correct:Boolean(answer&&answerForms(card).includes(answer)),expected:card?.target||'',answer:String(input??'')};
 }
 global.StudyReview={hasStudied,matchRecurrences,cardsForLessons,sanitize,enroll,queue,revisitMistakes,revisitQuestionMistakes,rate,stats,dayKey,checkAnswer,hasPhrase,intervalDays:INTERVALS.slice()};
})(window);
