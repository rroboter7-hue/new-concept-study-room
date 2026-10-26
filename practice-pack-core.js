/* Source-bound authored exercises. Free writing is never graded as fully grammatical. */
(function(global){
 'use strict';
 const list=x=>Array.isArray(x)?x:[],text=x=>typeof x==='string'?x.trim():'',clone=x=>JSON.parse(JSON.stringify(x));
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
 const normalize=x=>String(x??'').normalize('NFKC').replace(/[‘’]/g,"'").trim().toLowerCase().replace(/[.!?。！？]+$/g,'').trim().replace(/\s+/g,' ');
 const counts={vocabulary:3,grammar:3,listening:2,comprehension:2,production:2};
 const kinds=new Set(['choice','spelling','dictation','transform']);
 const time=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:Date.now();
 function labelled(examples){return list(examples).map(e=>({...clone(e),sourceLabel:e.sourceType==='lesson-passage'?'本课课文原句':'自编对比例句'}));}
 function create(manifest,lessons,bank){
  const issues=[],packs=new Map(),allIds=new Set(),wordRecords=new Map(),lessonMap=new Map(list(lessons).map(l=>[l.id,l]));
  for(const original of list(manifest?.lessons)){
   const lesson=lessonMap.get(original.lessonId),pack=clone(original),before=issues.length;
   const issue=(code,taskId,detail)=>issues.push({lessonId:pack.lessonId,taskId:taskId||'',code,detail});
   if(!lesson||lesson.book!==2||lesson.number!==pack.number){issue('source-lesson-mismatch');continue;}
   const passages=list(lesson.paragraphs).map(p=>String(p.en||''));
   if(JSON.stringify(passages)!==JSON.stringify(pack.sourcePassages)||!text(pack.revision))issue('stale-source');
   if(pack.tasks?.length!==12)issue('task-count');
   for(const [kind,count] of Object.entries(counts))if(list(pack.tasks).filter(q=>q.category===kind).length!==count)issue('category-count',kind);
   const targets=new Set(),taskMap=new Map();
   function resolve(raw,parent){
    const q=clone(raw),id=text(q.id);if(!id||allIds.has(id)){issue('duplicate-task-id',id);return q;}allIds.add(id);
    if(!Object.hasOwn(counts,q.category)||!kinds.has(q.type)||!text(q.prompt)||!text(q.rule)||!text(q.conceptKey))issue('incomplete-task',id);
    if(parent&&q.conceptKey!==parent.conceptKey)issue('followup-concept-mismatch',id);
    const evidence=object(q.sourceEvidence),quote=text(evidence.quote);
    if(!Number.isInteger(evidence.paragraphIndex)||!quote||!passages[evidence.paragraphIndex]?.includes(quote))issue('invalid-source-evidence',id);
    if(list(q.contrastExamples).length<2)issue('missing-contrast-examples',id);
    for(const e of list(q.contrastExamples)){
     if(!text(e.en)||!['lesson-passage','self-authored-example'].includes(e.sourceType))issue('invalid-example',id);
     if(e.sourceType==='lesson-passage'&&!passages.some(p=>p.includes(e.en)))issue('example-not-in-source',id);
    }
    q.contrastExamples=labelled(q.contrastExamples);
    const word=q.word&&bank?.wordForLesson(pack.lessonId,q.word);
    if(q.word){
     if(!word||!text(word.meaning)||normalize(word.word)!==normalize(q.word)){issue('unconfirmed-word',id);}
     else{
      q.word=word.word;q.conceptId=word.conceptId;wordRecords.set(id,clone(word));
      if(q.type==='choice'){
       const expected=q.direction==='meaning-to-word'?word.word:word.meaning;
       if(q.options?.[q.answer]!==expected)issue('canonical-answer-mismatch',id);
      }else if(JSON.stringify(list(q.expected).map(normalize))!==JSON.stringify([normalize(word.word)]))issue('canonical-answer-mismatch',id);
     }
    }else q.conceptId='pack:'+encodeURIComponent(pack.lessonId)+':'+q.conceptKey;
    if(q.type==='choice'){
     if(list(q.options).length!==4||new Set(list(q.options).map(normalize)).size!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||q.options.some(o=>!text(o)))issue('invalid-choice',id);
     if(list(q.options).some((o,i)=>i!==q.answer&&!text(q.wrongReasons?.[o])))issue('missing-wrong-reason',id);
    }else if(!list(q.expected).length||q.expected.some(a=>!text(a))||!text(q.defaultMistakeReason))issue('incomplete-typed-answer',id);
    if(!parent&&['vocabulary','listening'].includes(q.category)){
     const key=normalize(q.word);if(!key||targets.has(key))issue('duplicate-word-target',id);targets.add(key);
    }
    if(!parent){if(!q.followup)issue('missing-followup',id);else q.followup=resolve(q.followup,q);}
    q.sourceLessonId=pack.lessonId;q.sourceLabel='自编配套训练（非教材原配练习）';q.graded=!parent;
    return q;
   }
   pack.tasks=list(pack.tasks).map(q=>resolve(q));
   for(const q of pack.tasks)if(q.transferOf){const target=pack.tasks.find(t=>t.id===q.transferOf&&!t.transferOf);if(!target||target.id===q.id)issue('invalid-transfer-target',q.id);else {q.conceptId=target.conceptId;q.countsAsIndependentGameConcept=false;if(q.followup)q.followup.conceptId=target.conceptId;}}
   for(const q of pack.tasks)taskMap.set(q.id,q);
   if(issues.length===before)packs.set(pack.lessonId,{...pack,taskMap});
  }
  return {issues,get:id=>{const p=packs.get(id);if(!p)return null;const {taskMap,...value}=p;return clone(value);},has:id=>packs.has(id),wordForTask:q=>wordRecords.has(q?.id)?clone(wordRecords.get(q.id)):null,lessonIds:()=>Array.from(packs.keys())};
 }
 function grade(q,value){
  const choice=q?.type==='choice',valid=choice?Number.isInteger(value)&&value>=0&&value<list(q.options).length:typeof value==='string'&&value.trim().length>0&&value.length<=1000;
  const expected=choice?[q.options?.[q.answer]]:list(q?.expected),correct=valid&&(choice?value===q.answer:expected.some(a=>normalize(a)===normalize(value)));
  const entered=choice?q.options?.[value]:String(value??''),common=Object.entries(object(q?.commonMistakes)).find(([wrong])=>normalize(wrong)===normalize(value));
  return {valid,correct,correctAnswer:expected[0]||'',acceptedAnswers:expected.slice(),selectedAnswer:entered||'',rule:text(q?.rule),reason:!valid?'请先完成本题。':correct?'符合本题要求。':choice?text(q.wrongReasons?.[entered]):common?.[1]||text(q.defaultMistakeReason),contrastExamples:labelled(q?.contrastExamples),gradingLabel:q?.type==='transform'?'指定句型校对':choice?'选项校对':'拼写校对'};
 }
 function start(pack,options={}){
  const mode=['practice','retest','correction'].includes(options.mode)?options.mode:'practice',ids=pack.tasks.map(q=>q.id);
  return {version:1,lessonId:pack.lessonId,revision:pack.revision,attemptId:text(options.attemptId)||'attempt-'+Date.now()+'-'+Math.random().toString(36).slice(2),mode,queue:mode==='correction'?list(options.queue).filter((id,i,a)=>ids.includes(id)&&a.indexOf(id)===i):ids,cursor:0,answers:{},followups:{},audioPlayed:{},startedAt:time(options.now),completeAt:null,resultSaved:false};
 }
 function restore(raw,pack){
  if(!raw||typeof raw!=='object')return null;
  if(raw.revision!==pack.revision||raw.lessonId!==pack.lessonId)return {stale:true,revision:text(raw.revision),original:clone(raw)};
  const session=start(pack,{mode:raw.mode,queue:raw.queue,attemptId:raw.attemptId,now:raw.startedAt}),known=new Map(pack.tasks.map(q=>[q.id,q]));
  for(const [id,at] of Object.entries(object(raw.audioPlayed)))if(known.get(id)?.category==='listening'&&typeof at==='number'&&Number.isFinite(at)&&at>=0)session.audioPlayed[id]=at;
  for(const kind of ['answers','followups'])for(const [id,item] of Object.entries(object(raw[kind]))){
   const q=kind==='followups'?known.get(id)?.followup:known.get(id);if(!q||!session.queue.includes(id))continue;
   const value=item?.value;if(typeof value!=='string'&&!Number.isInteger(value))continue;if(typeof value==='string'&&value.length>1000)continue;
   session[kind][id]={value,submittedAt:typeof item.submittedAt==='number'&&Number.isFinite(item.submittedAt)&&grade(q,value).valid&&(q.category!=='listening'||session.audioPlayed[id]!=null)?item.submittedAt:null};
  }
  session.cursor=Math.max(0,Math.min(session.queue.length,Number.isInteger(raw.cursor)?raw.cursor:0));
  // A damaged cursor cannot jump over unanswered tasks.
  const first=session.queue.findIndex(id=>session.answers[id]?.submittedAt==null);if(first!==-1&&session.cursor>first)session.cursor=first;
  session.completeAt=result(session,pack).answered===session.queue.length&&session.cursor===session.queue.length?time(raw.completeAt):null;
  session.resultSaved=raw.resultSaved===true&&result(session,pack).complete;
  return session;
 }
 function draft(session,pack,id,value){
  const q=pack.tasks.find(q=>q.id===id);if(!q||!session.queue.includes(id)||session.answers[id]?.submittedAt!=null||typeof value!=='string'||value.length>1000)return session;
  return {...clone(session),answers:{...clone(session.answers),[id]:{value,submittedAt:null}}};
 }
 function submit(session,pack,id,value,options={}){
  const q=pack.tasks.find(q=>q.id===id);if(!q||session.queue[session.cursor]!==id||session.answers[id]?.submittedAt!=null||q.category==='listening'&&session.audioPlayed?.[id]==null)return {accepted:false,session};
  const feedback=grade(q,value);if(!feedback.valid)return {accepted:false,session,feedback};
  const next=clone(session);next.answers[id]={value,submittedAt:time(options.now)};return {accepted:true,session:next,feedback};
 }
 function submitFollowup(session,pack,id,value,options={}){
  const q=pack.tasks.find(q=>q.id===id)?.followup;if(!q||session.answers[id]?.submittedAt==null||session.followups[id]?.submittedAt!=null)return {accepted:false,session};
  const feedback=grade(q,value);if(!feedback.valid)return {accepted:false,session,feedback};
  const next=clone(session);next.followups[id]={value,submittedAt:time(options.now)};return {accepted:true,session:next,feedback};
 }
 function advance(session,pack,options={}){
  if(session.cursor>=session.queue.length||session.answers[session.queue[session.cursor]]?.submittedAt==null)return session;
  const next=clone(session);next.cursor++;if(next.cursor===next.queue.length)next.completeAt=time(options.now);return next;
 }
 function result(session,pack){
  const map=new Map(pack.tasks.map(q=>[q.id,q])),graded=list(session?.queue).map(id=>({q:map.get(id),answer:session?.answers?.[id]})).filter(x=>x.q),answered=graded.filter(x=>x.answer?.submittedAt!=null),wrong=answered.filter(x=>!grade(x.q,x.answer.value).correct),correct=answered.length-wrong.length,total=graded.length,full=session?.mode!=='correction'&&total===pack.tasks.length&&graded.every((x,i)=>x.q.id===pack.tasks[i].id);
  return {answered:answered.length,total,correct,percent:total?Math.round(correct/total*100):0,complete:total>0&&answered.length===total&&session?.cursor===total,full,wrongTaskIds:wrong.map(x=>x.q.id),wrongConceptIds:Array.from(new Set(wrong.map(x=>x.q.conceptId||x.q.conceptKey))),categories:Object.fromEntries(Object.keys(counts).map(kind=>{const a=answered.filter(x=>x.q.category===kind);return [kind,{answered:a.length,total:graded.filter(x=>x.q.category===kind).length,correct:a.filter(x=>grade(x.q,x.answer.value).correct).length}];}))};
 }
 function retryWrong(session,pack,options={}){const wrong=new Set(result(session,pack).wrongTaskIds),seen=new Set(),queue=pack.tasks.filter(q=>wrong.has(q.id)&&!seen.has(q.conceptId||q.conceptKey)&&seen.add(q.conceptId||q.conceptKey)).map(q=>q.id);return start(pack,{...options,mode:'correction',queue});}
 global.StudyPracticePacks={version:'1.0.0',create,normalize,grade,start,restore,draft,submit,submitFollowup,advance,result,retryWrong};
})(window);
