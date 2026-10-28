(function(global){
 'use strict';
 const DAY=86400000,OFFSET=8*3600000,INTERVALS=[1,3,7,14,30];
 const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
 const normalize=v=>String(v??'').normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase().replace(/[.!?,;:"“”'。！？]+$/g,'').replace(/\s+/g,' ');
 const timestamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<8640000000000000;
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const nowOf=options=>timestamp(options?.now)?options.now:Date.now();
 const validId=id=>typeof id==='string'&&id.startsWith('review:')&&id.length<=8000;
 const draftContext=context=>{if(['daily','practice','review'].includes(context))return true;if(typeof context!=='string'||context.length>2500)return false;try{const parts=JSON.parse(context);return Array.isArray(parts)&&parts.length===4&&parts[0]==='task'&&parts.slice(1).every(value=>typeof value==='string'&&value.length>0&&value.length<=800);}catch{return false;}};
 function draftKey(context,cardId,revision){return draftContext(context)&&validId(cardId)&&(integer(revision,0,1000000)||context==='practice'&&revision===null)?JSON.stringify([context,cardId,revision]):'';}
 function sanitizeDrafts(raw,options={}){
  const result={version:1,entries:Object.create(null)},entries=raw?.entries;
  if(!entries||typeof entries!=='object'||Array.isArray(entries))return result;
  const rows=Object.entries(entries).slice(0,2000).filter(([key,d])=>{
   if(!d||typeof d!=='object'||key!==draftKey(d.context,d.cardId,d.revision)||!key||typeof d.input!=='string'||d.input.length>10000||!timestamp(d.updatedAt)||!['writing','revealed','checked','assisted'].every(field=>typeof d[field]==='boolean'))return false;
   if(options.cards){const current=options.cards[d.cardId];if(d.revision!==(current?.revision??null)||!current&&d.context!=='practice')return false;}
   return true;
  }).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,100);
  for(const [key,d]of rows)result.entries[key]={context:d.context,cardId:d.cardId,revision:d.revision,input:d.input,writing:d.writing,revealed:d.revealed,checked:d.revealed&&d.checked,assisted:d.assisted,updatedAt:d.updatedAt};
  return result;
 }

 function cleanEvidence(value){
  if(!value||typeof value!=='object'||typeof value.correct!=='boolean'||typeof value.assisted!=='boolean'||typeof value.objective!=='boolean'||!['word','phrase','grammar'].includes(value.kind)||!timestamp(value.at))return null;
  return {correct:value.correct,assisted:value.assisted,objective:value.objective,kind:value.kind,answer:text(value.answer,10000),at:value.at};
 }
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
   const baseVocabulary=(lesson.vocabulary||[]).map(original=>registered?bank.wordForLesson(lesson.id,original?.word)||original:original);
   let reviewVocabulary=baseVocabulary;
   try{const expanded=global.StudyLessonWordTargets?.vocabularyForLesson(lesson,baseVocabulary);if(Array.isArray(expanded))reviewVocabulary=expanded;}catch{/* A missing expansion must not hide existing review cards. */}
   for(const original of reviewVocabulary.slice(0,1000)){
    let v=original;
    const corrected=global.StudyContextMeanings?.forLesson(lesson,original?.word);
    if(original?.meaningProvenance?.kind==='self-authored-context'&&!corrected)continue;
    if(corrected)v={...original,...corrected,word:original.word};
    if(v?.meaningMissing===true||v?.needsContextReview===true)continue;
    if(!v?.word)continue;const cue=lexicalCue(v,'vocabulary');if(!cue)continue;
    const provenance={};for(const field of ['sourceType','sourceLabel','exampleSourceType','exampleSourceLabel','sourceDocId'])if(text(v[field],500))provenance[field]=text(v[field],500);
    if(integer(v.sourcePage,1,100000))provenance.sourcePage=v.sourcePage;
    if(v.contextEvidence&&typeof v.contextEvidence==='object'&&!Array.isArray(v.contextEvidence))provenance.contextEvidence={...v.contextEvidence,...(Array.isArray(v.contextEvidence.matchedForms)?{matchedForms:v.contextEvidence.matchedForms.slice()}:{})};
    add('word',v.word,cue.prompt,{...cue,phonetic:text(v.phonetic,100),pos:text(v.pos,30),example:text(v.example||v.sourceSentence,1000),...provenance,...(v.meaningSource?{meaningSource:text(v.meaningSource,300)}:{}),...(v.conceptId?{conceptId:v.conceptId}:{})});
   }
   for(const p of (lesson.usage||[]).slice(0,100)){
    if(!p?.phrase||p.practiceEligible===false)continue;const reviewAPI=global.StudyReviewedUsage||global.StudyReviewedUsage21To25,ownerKeys=new Set();for(let node=p;node&&typeof node==='object';node=Object.getPrototypeOf(node))for(const key of Object.getOwnPropertyNames(node))if(/^usage\d+To\d+ReviewId$/.test(key))ownerKeys.add(key);const needsReview=typeof reviewAPI?.requiresApproval==='function'?reviewAPI.requiresApproval(p):ownerKeys.size>0,field=Object.getOwnPropertyDescriptor(p,'usage21To25ReviewId'),legacyOwner=ownerKeys.size===1&&ownerKeys.has('usage21To25ReviewId')&&field&&Object.prototype.hasOwnProperty.call(field,'value')&&typeof field.value==='string'&&field.value.trim();if(needsReview&&(!global.StudyReviewedUsage&&!legacyOwner||typeof reviewAPI?.isUsageCurrent!=='function'||reviewAPI.isUsageCurrent(p,lesson)!==true))continue;const cue=lexicalCue(p,'usage');if(!cue)continue;
    add('phrase',p.phrase,cue.prompt,{...cue,example:text(p.example,1000),explanation:text(p.note,1500),matchedForm:cue.matchedForm||text(p.matchedForm,200),variants:Array.isArray(p.variants)?p.variants.slice(0,20).map(v=>text(v,200)).filter(Boolean):[]});
   }
   for(const q of (registered?bank.quizForLesson(lesson.id):lesson.quiz||[]).slice(0,100)){
    if(q?.type==='vocabulary'||!Array.isArray(q?.options)||!integer(q.answer,0,q.options.length-1))continue;
    if(registered&&(!q.graded||!q.conceptId||seenConcepts.has(q.conceptId)))continue;if(q.conceptId)seenConcepts.add(q.conceptId);
    add('grammar',q.options[q.answer],q.question,{options:q.options.map(x=>text(x,500)),answer:q.answer,explanation:text(q.explanation,2000),...(q.conceptId?{conceptId:q.conceptId}:{}),...(q.knowledgeId?{knowledgeId:text(q.knowledgeId,8000)}:{}),...(q.grammarConceptId?{grammarConceptId:text(q.grammarConceptId,2000)}:{})});
   }
  }
  const registry=global.StudyPracticePacks?.registry;
  if(registry)for(const lesson of Array.isArray(lessons)?lessons:[]){const pack=registry.get(lesson.id);if(!pack)continue;for(const q of pack.tasks.filter(q=>q.category==='grammar'&&q.type==='choice')){const id='review:'+encodeURIComponent(lesson.id)+':grammar:'+encodeURIComponent(normalize(q.prompt));if(seen.has(id))continue;seen.add(id);cards.push({id,kind:'grammar',target:q.options[q.answer],prompt:q.prompt,options:q.options.slice(),answer:q.answer,explanation:q.rule,conceptId:q.conceptId,sourceType:'authored-practice-pack',sourceLesson:{id:String(lesson.id),book:lesson.book,number:lesson.number,title:lesson.title}});}}
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
   if(r.assistance&&r.assistance.revision===r.revision&&timestamp(r.assistance.at))state.cards[id].assistance={revision:r.revision,at:r.assistance.at,reason:text(r.assistance.reason,100)};
   const evidence=cleanEvidence(r.lastEvidence);if(evidence)state.cards[id].lastEvidence=evidence;
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
  const bank=options.knowledgeBank||global.StudyKnowledge?.bank;
  if(typeof bank?.get==='function')for(const id of [...wrong]){
   const record=bank.get(id);
   if(record?.kind==='word'&&record.status==='current-vocabulary'&&record.id===record.conceptId&&record.id==='knowledge:'+encodeURIComponent(record.lessonId)+':word:'+encodeURIComponent(normalize(record.word))&&
    (record.id===id||(Array.isArray(bank.audit?.expansionQuestions)&&bank.audit.expansionQuestions.some(row=>row.status==='approved'&&row.originalConceptId===id&&row.conceptId===record.id))))wrong.add(record.id);
   if(record?.id!==id||!id.startsWith('knowledge:'+encodeURIComponent(record.lessonId)+':'))continue;
   for(const sourceId of Array.isArray(record.sourceConceptIds)?record.sourceConceptIds:[]){const source=bank.get(sourceId);if(source?.id===sourceId&&sourceId.startsWith('knowledge:'+encodeURIComponent(source.lessonId)+':'))wrong.add(sourceId);}
  }
  for(const card of Array.isArray(cards)?cards:[]){
   const sourceId=card?.sourceLesson?.id,kind=card?.kind==='word'?'word':card?.kind==='grammar'?'grammar':null;
   if(typeof sourceId!=='string'||!kind||!validId(card.id)||!wrong.has(card.conceptId))continue;
   const source=encodeURIComponent(sourceId);
   const destination='review:'+source+':'+kind+':'+encodeURIComponent(normalize(kind==='grammar'?card.prompt:card.target));
   if(card.id!==destination||typeof card.conceptId!=='string')continue;
   const packCard=card.sourceType==='authored-practice-pack'||card.conceptId.startsWith('pack:');
   if(packCard){
    // Only an exact formal grammar task in the currently validated registry can
    // authorize a pack card. Prefixes and a plausible answer are insufficient.
    if(kind!=='grammar'||card.sourceType!=='authored-practice-pack'||!card.conceptId.startsWith('pack:'+source+':'))continue;
    const pack=global.StudyPracticePacks?.registry?.get?.(sourceId);
    const verified=pack?.lessonId===sourceId&&Array.isArray(pack.tasks)&&pack.tasks.some(q=>
     typeof q.id==='string'&&q.id.trim()&&q.category==='grammar'&&q.type==='choice'&&q.graded===true&&q.sourceLessonId===sourceId&&
     q.conceptId===card.conceptId&&q.prompt===card.prompt&&Array.isArray(q.options)&&q.options.length===4&&
     Array.isArray(card.options)&&card.options.length===q.options.length&&q.options.every((option,i)=>typeof option==='string'&&option.trim()&&option===card.options[i])&&
     integer(q.answer,0,q.options.length-1)&&card.answer===q.answer&&card.target===q.options[q.answer]);
    if(!verified)continue;
   }else if(!card.conceptId.startsWith('knowledge:'+source+':'+kind+':'))continue;
   if(kind==='word'&&card.conceptId!=='knowledge:'+source+':word:'+encodeURIComponent(normalize(card.target)))continue;
   if(kind==='word'&&typeof bank?.get==='function'){
    const word=bank.get(card.conceptId);
    if(word&&(word.kind!=='word'||word.status!=='current-vocabulary'||word.id!==card.conceptId||word.conceptId!==card.conceptId||word.lessonId!==sourceId||text(word.word,2000)!==card.target||text(word.meaning,2000)!==card.prompt))continue;
   }
   const record=state.cards[card.id];
   if(!record||record.dueAt<=now||record.revision>=1000000)continue;
   record.dueAt=now;record.revision++;
  }
  return state;
 }

 function assist(raw,id,options={}){
  const state=sanitize(raw),record=state.cards[id],now=nowOf(options);
  if(!record||record.revision!==options.revision||record.dueAt>now)return {accepted:false,changed:false,state};
  if(record.assistance?.revision===record.revision)return {accepted:true,changed:false,state};
  record.assistance={revision:record.revision,at:now,reason:text(options.reason,100)||'reference'};
  return {accepted:true,changed:true,state};
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
   if(!kind||record?.kind!==kind)continue;
   if(kind==='grammar'){if(record.id===question.conceptId&&record.conceptId===question.conceptId&&record.lessonId===lessonId)targets.add(record.id);continue;}
   const canonical='knowledge:'+encodeURIComponent(record.lessonId)+':word:'+encodeURIComponent(normalize(record.word));
   if(record.status!=='current-vocabulary'||record.id!==canonical||record.conceptId!==canonical||record.lessonId!==question.sourceLessonId||!bank.hasLesson(record.lessonId)||question.lessonId!==lessonId)continue;
   const authored=Array.isArray(bank.audit?.expansionQuestions)&&bank.audit.expansionQuestions.find(row=>row.id===question.id&&row.status==='approved'&&row.lessonId===lessonId&&row.conceptId===canonical&&row.sourceLessonId===record.lessonId);
   if(!authored||question.conceptId!==canonical&&question.conceptId!==authored.originalConceptId||question.originalConceptId&&question.originalConceptId!==authored.originalConceptId)continue;
   const sourceIds=question.sourceConceptIds;
   if(!Array.isArray(sourceIds)||sourceIds.length!==1||sourceIds[0]!==canonical||!Array.isArray(authored.sourceConceptIds)||authored.sourceConceptIds.length!==1||authored.sourceConceptIds[0]!==canonical)continue;
   const word=typeof bank.wordForLesson==='function'?bank.wordForLesson(record.lessonId,record.word):null;
   if(!word||word.conceptId!==canonical||word.word!==record.word||word.meaning!==record.meaning||question.word!==record.word||question.meaning!==record.meaning)continue;
   targets.add(canonical);
  }
  return revisitMistakes(state,cards,[...targets],{...options,knowledgeBank:bank});
 }

 function rate(raw,id,rating,options={}){
  const state=sanitize(raw),record=state.cards[id],now=nowOf(options);
  if(!record||!['again','hard','good'].includes(rating)||!integer(options.revision,0,1000000)||record.revision!==options.revision||record.dueAt>now)return {accepted:false,state};
  const supplied=Object.prototype.hasOwnProperty.call(options,'evidence'),evidence=supplied?cleanEvidence({...options.evidence,at:now}):null;
  if(rating==='good'&&(record.assistance?.revision===record.revision||supplied&&(!evidence||!evidence.correct||evidence.assisted||!evidence.objective||!evidence.answer)))return {accepted:false,state,reason:'independent-correct-required'};
  if(evidence){evidence.assisted=evidence.assisted||record.assistance?.revision===record.revision;record.lastEvidence=evidence;}
  if(rating==='good'){
   record.stage=Math.min(INTERVALS.length,record.stage+1);
   record.dueAt=now+INTERVALS[record.stage-1]*DAY;
  }else if(rating==='hard')record.dueAt=now+DAY;
  else {record.stage=Math.max(0,record.stage-1);record.dueAt=now+600000;record.lapses++;}
  record.revision++;record.repetitions++;record.lastReviewedAt=now;record.lastRating=rating;
  delete record.assistance;
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
 global.StudyReview={draftKey,sanitizeDrafts,hasStudied,matchRecurrences,cardsForLessons,sanitize,enroll,queue,revisitMistakes,revisitQuestionMistakes,assist,rate,stats,dayKey,checkAnswer,hasPhrase,intervalDays:INTERVALS.slice()};
})(window);
