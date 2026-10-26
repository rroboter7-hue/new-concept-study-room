(function(global){
 'use strict';
 const text=value=>typeof value==='string'?value.trim():'';
 const norm=value=>text(value).normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').toLowerCase();
 const clone=value=>JSON.parse(JSON.stringify(value));
 const list=value=>Array.isArray(value)?value:[];
 const conceptId=(lessonId,kind,key)=>'knowledge:'+encodeURIComponent(lessonId)+':'+kind+':'+encodeURIComponent(norm(key));
 const validQuestion=q=>text(q?.question)&&list(q.options).length>=2&&q.options.every(o=>text(o))&&new Set(q.options.map(norm)).size===q.options.length&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length;
 const wordFromQuestion=q=>text(q.sourceWord)||text(q.word)||text(q.question?.match(/[“"]([^”"]+)[”"]/)?.[1]);
 const slotFor=(id,total)=>Array.from(id).reduce((value,c)=>(Math.imul(value,31)+c.charCodeAt(0))>>>0,7)%total;
 let revision=0;
 function vocabularySource(lesson){
  const previous=lesson.vocabularyAudit,current=list(lesson.vocabulary);
  if(!previous)return clone(current);
  const source=list(previous.sourceVocabulary||previous.originalVocabulary);
  if(JSON.stringify(current)===JSON.stringify(previous.confirmedVocabulary))return clone(source);
  const groups=values=>{const map=new Map();for(const value of values){const key=norm(value?.word);if(!map.has(key))map.set(key,[]);map.get(key).push(value);}return map;};
  const active=groups(current),raw=groups(source),visible=new Set(list(previous.confirmedVocabulary).map(v=>norm(v.word))),result=[];
  const asSource=value=>{const {conceptId,sourceLessonId,...word}=clone(value);return word;};
  for(const [key,values] of raw){if(active.has(key)){result.push(...active.get(key).map(asSource));active.delete(key);}else if(!visible.has(key))result.push(...clone(values));}
  for(const values of active.values())result.push(...values.map(asSource));
  return result;
 }
 function auditRows(manifest){
  if(manifest?.schemaVersion===1&&manifest.book===2)return list(manifest.entries).map(review=>{
   const old=review.originalQuestion||{},rule=text(review.rule),wrongReasons=review.wrongReasons||{},contrastExamples=list(review.contrastExamples),sourceSentence=text(old.explanation?.split('原句：').at(-1)?.split(' 巩固')[0]);
   return {...review,index:review.originalIndex,status:review.status==='revised'?'revise':review.status,grammarConceptId:review.conceptId,originalQuestion:old.question,originalSnapshot:old,rule,wrongReasons,contrastExamples,explanation:rule+'\n'+Object.entries(wrongReasons).map(([option,reason])=>'“'+option+'”：'+reason).join('\n')+'\n对比例句：'+contrastExamples.join(' / '),evidence:{sourceSentence,sourceDocId:old.origin?.docId||old.sourceDocId,sourcePage:old.sourcePage||old.sourcePdfPage,reviewEvidence:review.sourceEvidence,sourceType:review.sourceType,sourceLabel:review.sourceLabel},review};
  });
  return list(manifest?.items);
 }

 function create(input,options={}){
  const lessons=list(input).filter(l=>l?.id&&Number(l.book)===2),byLesson=new Map(lessons.map(l=>[l.id,l])),records=new Map(),words=new Map(),pools=new Map(),quizzes=new Map(),legacyByLesson=new Map(),vocabularySources=new Map(),originalVocabulary=new Map(),vocabularyAudits=new Map();
  const audit={legacyQuestions:[],vocabularyEntries:[],issues:[]},grammarRows=auditRows(options.grammarAudit);
  for(const lesson of lessons){
   const grouped=new Map(),local=new Map(),source=vocabularySource(lesson);
   vocabularySources.set(lesson.id,source);originalVocabulary.set(lesson.id,clone(list(lesson.vocabularyAudit?.originalVocabulary||lesson.vocabulary)));
   for(const word of source){const key=norm(word?.word);if(!key)continue;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(word);}
   for(const [key,values] of grouped){
    const meanings=new Set(values.map(v=>norm(v.meaning)).filter(Boolean)),v=values[0];
    const code=meanings.size>1?'ambiguous-meaning':meanings.size!==1||!/[\u3400-\u9fff]/.test(text(v.meaning))?'missing-definition':values.some(v=>v.needsContextReview===true)?'needs-context-review':'';
    if(code){audit.issues.push({lessonId:lesson.id,word:v.word,code,reason:{'ambiguous-meaning':'同课同词存在冲突释义，暂不计分','missing-definition':'缺少已确认的中文释义，暂不计分','needs-context-review':'该词仍待语境复核，暂不计分'}[code]});continue;}
    const id=conceptId(lesson.id,'word',key),record={id,conceptId:id,kind:'word',lessonId:lesson.id,word:text(v.word),meaning:text(v.meaning),status:'current-vocabulary',source:{vocabulary:clone(v),lesson:{id:lesson.id,book:lesson.book,number:lesson.number,title:lesson.title}}};
    records.set(id,record);local.set(key,record);
   }
   const entries=source.map((word,index)=>{const record=local.get(norm(word?.word)),issue=audit.issues.find(item=>item.lessonId===lesson.id&&norm(item.word)===norm(word?.word));return {lessonId:lesson.id,index,word:text(word?.word),original:clone(word),status:record?'confirmed':'excluded',...(record?{conceptId:record.id}:{}),reasonCode:record?'confirmed':issue?.code||'invalid-word',reason:record?'采用本课已确认词义':issue?.reason||'缺少可识别词形，不参与计分'};});
   vocabularyAudits.set(lesson.id,entries);audit.vocabularyEntries.push(...entries);
   words.set(lesson.id,local);pools.set(lesson.id,[]);quizzes.set(lesson.id,[]);legacyByLesson.set(lesson.id,clone(list(lesson.quizAudit?.legacyQuiz||lesson.quiz)));
  }
  const allWords=Array.from(records.values()).filter(r=>r.kind==='word'),wordQuestions=new Map();
  for(const record of allWords){
   const excluded=new Set(allWords.filter(r=>norm(r.word)===norm(record.word)).map(r=>norm(r.meaning))),seen=new Set([norm(record.meaning)]),wrong=[];
   for(const other of allWords){const key=norm(other.meaning);if(excluded.has(key)||seen.has(key))continue;seen.add(key);wrong.push(other.meaning);if(wrong.length===3)break;}
   if(!wrong.length)continue;
   const options=wrong.slice(),answer=slotFor(record.id,options.length+1);options.splice(answer,0,record.meaning);
   const q={type:'vocabulary',question:'“'+record.word+'” 在本课中的意思是？',options,answer,explanation:record.word+'：'+record.meaning+'。释义以本课词表为准。',conceptId:record.id,knowledgeId:record.id,sourceWord:record.word,sourceLessonId:record.lessonId,sourceType:'self-authored-knowledge-practice',sourceLabel:'自编配套训练 · 按本课词义校对（非教材原配练习）',graded:true};
   wordQuestions.set(record.id,q);pools.get(record.lessonId).push(q);
  }
  for(const lesson of lessons){
   const seenWordQuiz=new Set(),legacy=legacyByLesson.get(lesson.id);
   legacy.forEach((old,index)=>{
    const entry={lessonId:lesson.id,index,legacy:clone(old),status:'excluded',reason:''};audit.legacyQuestions.push(entry);
    if(old.type==='vocabulary'){
     const word=wordFromQuestion(old),record=words.get(lesson.id).get(norm(word)),q=record&&wordQuestions.get(record.id);
     if(!q){entry.reason='无法从本课已确认词义生成唯一有效答案';return;}
     entry.status='rebuilt';entry.conceptId=record.id;entry.reason='旧答案停用；从当前课内词义重建选项、正确键与解析';
     if(!seenWordQuiz.has(record.id)){quizzes.get(lesson.id).push(q);seenWordQuiz.add(record.id);}return;
    }
    const matches=grammarRows.filter(row=>row?.lessonId===lesson.id&&row.index===index),row=matches.length===1?matches[0]:null;
    if(!row||!['approved','revise'].includes(row.status)){entry.reason=text(row?.reason)||'语法题尚未审核或仍有歧义，不参与计分';return;}
    const evidence=row.evidence,q={type:'grammar',question:row.question,options:row.options,answer:row.answer,explanation:row.explanation};
    const stale=row.originalSnapshot&&(JSON.stringify(row.originalSnapshot.options)!==JSON.stringify(old.options)||row.originalSnapshot.answer!==old.answer),incomplete=row.review&&(!text(row.rule)||!list(row.contrastExamples).length||list(row.options).some((option,i)=>i!==row.answer&&!text(row.wrongReasons?.[option])));
    if(stale||incomplete||row.originalQuestion!==old.question||!text(row.grammarConceptId)||!validQuestion(q)||!text(q.explanation)||!text(evidence?.sourceSentence)||!text(evidence?.sourceDocId)||!Number.isFinite(Number(evidence?.sourcePage))||Number(evidence.sourcePage)<1){entry.reason='审核记录不完整或未绑定原题，不参与计分';return;}
    const id=conceptId(lesson.id,'grammar',row.grammarConceptId);
    if(!records.has(id))records.set(id,{id,conceptId:id,kind:'grammar',lessonId:lesson.id,label:row.grammarConceptId,status:'approved',source:{evidence:clone(evidence)}});
    Object.assign(q,{options:q.options.slice(),conceptId:id,knowledgeId:id,sourceLessonId:lesson.id,sourceType:'reviewed-grammar-practice',sourceLabel:'自编配套训练 · 语法题已复核（非教材原配练习）',rule:text(row.rule)||q.explanation,wrongReasons:clone(row.wrongReasons||{}),contrastExamples:clone(list(row.contrastExamples)),evidence:clone(evidence),graded:true});
    quizzes.get(lesson.id).push(q);pools.get(lesson.id).push(q);entry.status='approved';entry.reviewStatus=row.review?.status||row.status;entry.review=clone(row.review||row);entry.conceptId=id;entry.reason=text(row.reason)||'采用审核后的题干、唯一答案和解析';
   });
  }
  const bank={
   revision:++revision,audit,
   hasLesson:id=>byLesson.has(id),
   get:id=>records.has(id)?clone(records.get(id)):null,
   wordForLesson(lessonId,word){const record=words.get(lessonId)?.get(norm(word));return record?{...clone(record.source.vocabulary),word:record.word,meaning:record.meaning,conceptId:record.id,sourceLessonId:lessonId}:null;},
   vocabularyForLesson(lessonId){return Array.from(words.get(lessonId)?.values()||[],record=>({...clone(record.source.vocabulary),word:record.word,meaning:record.meaning,conceptId:record.id,sourceLessonId:lessonId}));},
   questionsForLesson:id=>clone(pools.get(id)||[]),
   quizForLesson:id=>clone(quizzes.get(id)||[]),
   apply(target=lessons){for(const lesson of list(target)){if(!byLesson.has(lesson.id))continue;lesson.quizAudit={legacyQuiz:clone(legacyByLesson.get(lesson.id)),entries:clone(audit.legacyQuestions.filter(a=>a.lessonId===lesson.id))};lesson.quiz=bank.quizForLesson(lesson.id);const vocabulary=bank.vocabularyForLesson(lesson.id);lesson.vocabularyAudit={originalVocabulary:clone(originalVocabulary.get(lesson.id)),sourceVocabulary:clone(vocabularySources.get(lesson.id)),confirmedVocabulary:clone(vocabulary),entries:clone(vocabularyAudits.get(lesson.id))};lesson.vocabulary=vocabulary;}return bank;}
  };
  return bank;
 }
 const API={version:'1.1.0',create,conceptId,bank:null,install(lessons,options){const bank=create(lessons,options);bank.apply(lessons);API.bank=bank;return bank;},wordForLesson(lessonId,word){return API.bank?.wordForLesson(lessonId,word)||null;},vocabularyForLesson(lessonId){return API.bank?.vocabularyForLesson(lessonId)||[];},questionsForLesson(lessonId){return API.bank?.questionsForLesson(lessonId)||[];}};
 global.StudyKnowledge=API;
})(window);
