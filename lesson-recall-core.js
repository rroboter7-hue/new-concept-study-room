(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyRecall=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const own=(o,k)=>Object.hasOwn(o||{},k),safeKey=k=>typeof k==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
 const body=l=>(l?.paragraphs||[]).map(p=>p.en||'').join('\n\n');
 function fingerprint(lesson){const text=body(lesson);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return text.length+':'+(h>>>0).toString(16);}
 function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[\p{P}\p{S}]/gu,char=>/[≠<>≤≥+−-]/.test(char)?char:' ').replace(/\s+/g,' ').trim();}
 function validateEntry(entry,lesson){
  const bad=reason=>({ok:false,reason});if(!entry||!lesson||entry.lessonId!==lesson.id||entry.book!==lesson.book||entry.number!==lesson.number||entry.title!==lesson.title)return bad('identity');
  if(entry.bodyFingerprint!==fingerprint(lesson))return bad('source-changed');
  if(!Array.isArray(entry.questions)||entry.questions.length<2||entry.questions.length>6||!entry.revision)return bad('questions');
  const ids=new Set();for(const q of entry.questions){
   if(!safeKey(q.id)||ids.has(q.id)||typeof q.prompt!=='string'||!q.prompt.trim()||!q.explanation?.trim())return bad('question');ids.add(q.id);
   const evidence=q.evidence;if(!Number.isInteger(evidence?.paragraphIndex)||!evidence.quote?.trim()||!lesson.paragraphs[evidence.paragraphIndex]?.en.includes(evidence.quote))return bad('evidence');
   if(q.type==='choice'){if(!Array.isArray(q.options)||q.options.length<2||q.options.length>5||q.options.some(x=>typeof x!=='string'||!x.trim())||new Set(q.options.map(normalize)).size!==q.options.length||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||q.options.some((_,i)=>i!==q.answer&&!q.wrongReasons?.[i]?.trim()))return bad('choice');}
   else if(q.type==='short'){if(!Array.isArray(q.answers)||!q.answers.length||q.answers.some(x=>typeof x!=='string'||!normalize(x)))return bad('short');}
   else return bad('type');
  }return {ok:true};
 }
 function grade(question,value){
  const base={questionId:question.id,evidence:question.evidence};
  if(question.type==='choice'){
   const index=typeof value==='number'?value:/^\d+$/.test(String(value??''))?Number(value):NaN;
   if(!Number.isInteger(index)||index<0||index>=question.options.length)return {...base,status:'missing',correct:null};
   const correct=index===question.answer;return {...base,status:correct?'correct':'incorrect',correct,expected:question.options[question.answer],explanation:correct?question.explanation:question.wrongReasons[index]||question.explanation};
  }
  const answer=normalize(value);if(!answer)return {...base,status:'missing',correct:null};
  const expected=question.answers[0];if(question.answers.some(x=>normalize(x)===answer))return {...base,status:'correct',correct:true,expected,explanation:question.explanation};
  const mistake=(question.commonMistakes||[]).find(m=>m.answers?.some(x=>normalize(x)===answer));
  if(mistake)return {...base,status:'incorrect',correct:false,expected,explanation:mistake.feedback||question.explanation};
  return {...base,status:'unmatched',correct:null,expected,explanation:'尚未匹配参考答案，请核对所问细节和下面的原文。不同的完整句式需要自行对照，系统不会仅因包含关键词就判为正确。'};
 }
 function sanitize(raw){
  const out={version:1,lessons:{}};if(!raw?.lessons||typeof raw.lessons!=='object'||Array.isArray(raw.lessons))return out;
  for(const [id,record] of Object.entries(raw.lessons).slice(0,500)){
   if(!safeKey(id)||!record||typeof record.revision!=='string'||record.revision.length>128)continue;
   const answers={};for(const [key,value] of Object.entries(record.answers||{}).slice(0,6)){if(!safeKey(key))continue;if(typeof value==='string')answers[key]=value.slice(0,800);else if(Number.isInteger(value)&&value>=0&&value<=4)answers[key]=value;}
   out.lessons[id]={revision:record.revision,answers,submitted:record.submitted===true,updatedAt:Number.isFinite(record.updatedAt)?record.updatedAt:0};
  }return out;
 }
 function answersFor(state,entry){const record=state?.lessons?.[entry.lessonId];return own(state?.lessons,entry.lessonId)&&record.revision===entry.revision?{...record.answers}:{};}
 function update(state,entry,id,value){const next=sanitize(state);if(!safeKey(entry.lessonId)||!entry.questions.some(q=>q.id===id))return next;next.lessons[entry.lessonId]={revision:entry.revision,answers:{...answersFor(next,entry),[id]:typeof value==='string'?value.slice(0,800):value},submitted:false,updatedAt:Date.now()};return sanitize(next);}
 function submit(state,entry){const next=sanitize(state),answers=answersFor(next,entry),results=entry.questions.map(q=>grade(q,answers[q.id]));if(results.some(r=>r.status==='missing'))return {accepted:false,state:next,results};next.lessons[entry.lessonId]={revision:entry.revision,answers,submitted:true,updatedAt:Date.now()};return {accepted:true,state:next,results};}
 return {fingerprint,normalize,validateEntry,grade,sanitize,answersFor,update,submit};
});
