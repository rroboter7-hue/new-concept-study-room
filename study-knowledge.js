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
 // These two exact reviewed variants test a skill already represented in Game.
 // Keep their exercise/knowledge identities for legacy quiz history and feedback.
 const gameSkillVariants={
  'nce-b2-eef57c-l005-expansion-current-perfect-agreement':{key:'auxiliary-perfect',question:'【自编练习 · 语法运用】指定用现在完成时：Mr. Scott ___ just bought twelve pigeons.',options:['have','did','is','has'],answer:3},
  'nce-b2-eef57c-l007-expansion-current-past-continuous':{key:'be-past',question:'【自编练习 · 语法运用】描述昨日上午十点正在发生的动作：The detectives ___ waiting at the airport at ten yesterday morning.',options:['was','are','were','is'],answer:2}
 };
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
  const lessons=list(input).filter(l=>l?.id&&Number(l.book)===2),byLesson=new Map(lessons.map(l=>[l.id,l])),records=new Map(),sourceAliases=new Map(),words=new Map(),pools=new Map(),quizzes=new Map(),legacyByLesson=new Map(),vocabularySources=new Map(),originalVocabulary=new Map(),vocabularyAudits=new Map();
  const audit={legacyQuestions:[],vocabularyEntries:[],issues:[],expansionQuestions:[],expansionIssues:[]},grammarRows=auditRows(options.grammarAudit);
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
  // Separate authored batches preserve the legacy quiz and its historical indices.
  // Every addition must bind to a real passage and to confirmed source concepts.
  const extraManifests=Array.isArray(options.extraQuestions)?options.extraQuestions:[options.extraQuestions],extraIds=new Set();
  for(const manifest of extraManifests){
   if(!manifest)continue;
   if(manifest.schemaVersion!==1||manifest.book!==2){audit.expansionIssues.push({code:'invalid-manifest',reason:'自编扩展题批次版本或册数不受支持'});continue;}
   for(const raw of list(manifest.entries)){
    const fail=(code,reason)=>audit.expansionIssues.push({id:text(raw?.id),lessonId:text(raw?.lessonId),code,reason});
    const destination=byLesson.get(raw?.lessonId),source=byLesson.get(raw?.sourceLessonId),sourceIds=list(raw?.sourceConceptIds),evidence=raw?.sourceEvidence;
    if(extraIds.has(raw?.id)){fail('duplicate-question-id','相同稳定题目编号已注册，忽略重复项');continue;}
    if(!destination||!source||Number(source.number)>Number(destination.number)){fail('invalid-source-lesson','题目或知识来源课不存在，或引用了尚未学习的后续课');continue;}
    const expectedPrefix='knowledge:'+encodeURIComponent(destination.id)+':'+(raw.type==='vocabulary'?'word':'grammar')+':';
    if(!text(raw.id)||!text(raw.conceptId).startsWith(expectedPrefix)||!['grammar','vocabulary'].includes(raw.type)||!validQuestion(raw)||raw.reviewStatus!=='self-reviewed'||raw.sourceType!=='self-authored-reviewed-expansion'||raw.sourceLabel!=='自编练习 · 非教材原配习题'||raw.containsOriginalWorkbookExercise!==false){fail('incomplete-reviewed-question','缺少有效题干、稳定知识编号、唯一答案结构或明确的自编审核标签');continue;}
    if(!text(raw.rule)||list(raw.contrastExamples).length<2||!raw.contrastExamples.every(x=>text(x))||raw.options.some((option,i)=>i!==raw.answer&&!text(raw.wrongReasons?.[option]))){fail('incomplete-explanation','题目必须提供规则、每个错项原因及至少两个自编对比例句');continue;}
    if(!Number.isInteger(evidence?.sourceParagraphIndex)||!text(evidence?.sourceText)||!text(source.paragraphs?.[evidence.sourceParagraphIndex]?.en).includes(evidence.sourceText)||sourceIds.some(id=>!records.has(id)||records.get(id).lessonId!==source.id)||source.id!==destination.id&&!sourceIds.length){fail('unsupported-source','未能将来源片段和知识编号绑定到真实的已确认来源课');continue;}
    let sourceWord=null;
    if(raw.type==='vocabulary'){
     sourceWord=sourceIds.map(id=>records.get(id)).find(r=>r.kind==='word'&&norm(r.word)===norm(raw.word));
     const optionRecords=list(raw.optionConceptIds).map(id=>records.get(id));
     if(raw.direction!=='meaning-to-word'||!sourceWord||sourceWord.meaning!==raw.meaning||norm(raw.options[raw.answer])!==norm(sourceWord.word)||optionRecords.length!==raw.options.length||optionRecords.some((record,i)=>!record||record.kind!=='word'||norm(record.word)!==norm(raw.options[i])||(record.meaning===sourceWord.meaning)!==(i===raw.answer))){fail('unsupported-vocabulary-answer','反向词汇题的词义、正确词及所有备选词必须与已确认词库完全一致');continue;}
    }
    // Question variants have their own IDs, but a reverse/retrieval word question
    // tests the existing source word. Do not fork its meaning or knowledge ID.
    // Grammar/comprehension sourceConceptIds are provenance, not automatic aliases.
    const record=sourceWord||{id:raw.conceptId,conceptId:raw.conceptId,kind:'grammar',lessonId:destination.id,sourceLessonId:source.id,sourceConceptIds:sourceIds.slice(),label:text(raw.category)||raw.type,status:'approved',source:{evidence:clone(evidence),authoredQuestionId:raw.id}};
    if(!sourceWord&&(records.has(record.id)||sourceAliases.has(record.id))||sourceWord&&((records.has(raw.conceptId)&&raw.conceptId!==sourceWord.id)||(sourceAliases.has(raw.conceptId)&&sourceAliases.get(raw.conceptId)!==sourceWord.id))){fail('duplicate-concept-id','扩展知识编号已使用，不能覆盖原有知识记录');continue;}
    const q={...clone(raw),conceptId:record.id,knowledgeId:record.id,originalConceptId:raw.conceptId,...(sourceWord?{word:sourceWord.word,sourceWord:sourceWord.word,meaning:sourceWord.meaning}:{}),graded:true,explanation:text(raw.explanation)||raw.rule+'\n'+Object.entries(raw.wrongReasons).map(([option,reason])=>'“'+option+'”：'+reason).join('\n')+'\n自编对比例句：'+raw.contrastExamples.join(' / ')};
    delete q.gameConceptId; // A manifest cannot claim an unreviewed skill alias.
    const gameVariant=gameSkillVariants[q.id],gameRecord=gameVariant&&records.get(conceptId(destination.id,'grammar',gameVariant.key));
    if(q.type==='grammar'&&gameRecord?.kind==='grammar'&&gameRecord.lessonId===destination.id&&q.question===gameVariant.question&&q.answer===gameVariant.answer&&JSON.stringify(q.options)===JSON.stringify(gameVariant.options))q.gameConceptId=gameRecord.id;
    if(!sourceWord)records.set(record.id,record);else if(raw.conceptId!==record.id)sourceAliases.set(raw.conceptId,record.id);
    extraIds.add(q.id);quizzes.get(destination.id).push(q);pools.get(destination.id).push(q);
    audit.expansionQuestions.push({id:q.id,lessonId:destination.id,conceptId:record.id,originalConceptId:raw.conceptId,sourceLessonId:source.id,sourceConceptIds:sourceIds.slice(),status:'approved'});
   }
  }
  const bank={
   revision:++revision,audit,
   hasLesson:id=>byLesson.has(id),
   // Compatibility aliases resolve the one canonical record, never a new sense.
   get:id=>{const sourceId=sourceAliases.get(id)||id;return records.has(sourceId)?clone(records.get(sourceId)):null;},
   wordForLesson(lessonId,word){const record=words.get(lessonId)?.get(norm(word));return record?{...clone(record.source.vocabulary),word:record.word,meaning:record.meaning,conceptId:record.id,sourceLessonId:lessonId}:null;},
   vocabularyForLesson(lessonId){return Array.from(words.get(lessonId)?.values()||[],record=>({...clone(record.source.vocabulary),word:record.word,meaning:record.meaning,conceptId:record.id,sourceLessonId:lessonId}));},
   questionsForLesson:id=>clone(pools.get(id)||[]),
   quizForLesson:id=>clone(quizzes.get(id)||[]),
   apply(target=lessons){for(const lesson of list(target)){if(!byLesson.has(lesson.id))continue;lesson.quizAudit={legacyQuiz:clone(legacyByLesson.get(lesson.id)),entries:clone(audit.legacyQuestions.filter(a=>a.lessonId===lesson.id))};lesson.quiz=bank.quizForLesson(lesson.id);const vocabulary=bank.vocabularyForLesson(lesson.id);lesson.vocabularyAudit={originalVocabulary:clone(originalVocabulary.get(lesson.id)),sourceVocabulary:clone(vocabularySources.get(lesson.id)),confirmedVocabulary:clone(vocabulary),entries:clone(vocabularyAudits.get(lesson.id))};lesson.vocabulary=vocabulary;}return bank;}
  };
  return bank;
 }
 const API={version:'1.2.2',create,conceptId,bank:null,install(lessons,options){const bank=create(lessons,options);bank.apply(lessons);API.bank=bank;return bank;},wordForLesson(lessonId,word){return API.bank?.wordForLesson(lessonId,word)||null;},vocabularyForLesson(lessonId){return API.bank?.vocabularyForLesson(lessonId)||[];},questionsForLesson(lessonId){return API.bank?.questionsForLesson(lessonId)||[];}};
 global.StudyKnowledge=API;
})(window);
