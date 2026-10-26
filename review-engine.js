(function(global){
 'use strict';
 const DAY=86400000,OFFSET=8*3600000,INTERVALS=[1,3,7,14,30];
 const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
 const normalize=v=>String(v??'').normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase().replace(/[.!?,;:"“”'。！？]+$/g,'').replace(/\s+/g,' ');
 const timestamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<8640000000000000;
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const nowOf=options=>timestamp(options?.now)?options.now:Date.now();
 const validId=id=>typeof id==='string'&&id.startsWith('review:')&&id.length<=8000;
 function dayKey(at=Date.now()){return new Date(at+OFFSET).toISOString().slice(0,10);}

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
    if(!v?.word||!v.meaning)continue;
    add('word',v.word,v.meaning,{phonetic:text(v.phonetic,100),pos:text(v.pos,30),example:text(v.example,1000),...(v.conceptId?{conceptId:v.conceptId}:{})});
   }
   for(const p of (lesson.usage||[]).slice(0,100)){
    if(!p?.phrase||!p.meaning||/未附(?:独立)?中文释义|未提供中文释义/.test(p.meaning))continue;
    add('phrase',p.phrase,p.meaning,{example:text(p.example,1000),explanation:text(p.note,1500),matchedForm:text(p.matchedForm,200),variants:Array.isArray(p.variants)?p.variants.slice(0,20).map(v=>text(v,200)).filter(Boolean):[]});
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
  const values=card?.kind==='phrase'?[card.target,card.matchedForm,...(Array.isArray(card.variants)?card.variants:[])]:[card?.target];
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
 global.StudyReview={cardsForLessons,sanitize,enroll,queue,revisitMistakes,rate,stats,dayKey,checkAnswer,hasPhrase,intervalDays:INTERVALS.slice()};
})(window);
