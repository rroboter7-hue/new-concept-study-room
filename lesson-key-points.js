/* Selects brief points from existing lesson material; no network or new examples. */
(function(root,factory){
 'use strict';
 const api=factory(root,typeof module==='object'&&module.exports?require('./lesson-grammar-focus.js'):root.StudyLessonGrammarFocus);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StudyLessonKeyPoints=api;
})(typeof window!=='undefined'?window:globalThis,function(root,curatedRegistry){
 'use strict';
 const list=value=>Array.isArray(value)?value:[];
 const text=value=>typeof value==='string'?value.trim():'';
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const NOTICE='根据本课已有教材与校对笔记整理；采用本地整理逻辑，非实时在线 AI。';
 const reading=/reading|comprehension|main[-_ ]?idea|阅读理解|课文理解|细节理解|理解题/i;
 const officialLesson=/^nce-(?:b[123]-[a-f\d]{6}|nativeears-b[34]|textbook-b4)-l\d{3}$/;
 function sameLesson(row,lesson){
  if(!row||typeof row!=='object')return false;
  if(row.isReview===true||row.pipeline?.origin==='review')return false;
  for(const id of [row.lessonId,row.sourceLessonId,row.pipeline?.sourceLessonId])if(id&&id!==lesson.id)return false;
  return true;
 }
 function shortSummary(note,title){
  const value=text(note).replace(/^【(?:自编学习整理|学习整理|自编说明)】\s*/,'');
  // Select a complete sentence, never a character-limited prefix. If its
  // condition itself is long, show the existing heading and retain the note.
  const first=value.match(/^[\s\S]*?[。！？](?:[”’"']|$)?/)?.[0];
  return first&&first.length<=110?first:value.length<=110?value||title:title;
 }
 function inPassage(value,lesson){return !!text(value)&&list(lesson.paragraphs).some(paragraph=>typeof paragraph.en==='string'&&paragraph.en.includes(value));}
 // Editorial selections for the audited lesson only. Exact inclusion is required
 // on every read; these do not replace the authored rule or its note example.
 function auditedExample(row,lesson){
  if(lesson.id!=='nce-b2-eef57c-l002'||lesson.book!==2||lesson.number!==2||lesson.title!=='第2课 · Breakfast or lunch?')return '';
  const value={'一般现在时':'I never get up early on Sundays.','现在进行时':'‘But I\'m still having breakfast,’ I said.','一般疑问句':'Do you always get up so late?'}[row.title];
  return inPassage(value,lesson)?value:'';
 }
 function exampleFor(row,lesson){
  const candidates=[row.example,...list(row.supportingExamples),row.sourceEvidence?.sourceText,row.evidence?.sourceSentence,row.sourceExample,...list(row.contextEvidence?.paragraphs).map(item=>item.sourceText)].map(text).filter(value=>value&&/[A-Za-z]/.test(value)&&!value.includes('___'));
  const backed=candidates.filter(value=>inPassage(value,lesson));
  const selected=value=>({example:value,exampleDetails:candidates[0]||value,bodyBound:inPassage(value,lesson)});
  const audited=auditedExample(row,lesson);if(audited)return selected(audited);
  const short=backed.find(value=>value.length<=220);
  if(short)return selected(short);
  for(const value of backed){
   // A complete existing sentence may be selected from a multi-sentence note;
   // punctuation inside a long single sentence is not a truncation point.
   const sentences=value.match(/[\s\S]+?[.!?](?=\s+["“']?[A-Z]|$)/g)||[];
   const sentence=sentences.map(text).find(part=>part.length<=220);
   if(sentence)return selected(sentence);
  }
  const fallback=candidates.find(value=>value.length<=220);
  if(fallback)return selected(fallback);
  for(const value of candidates){
   const sentence=(value.match(/[\s\S]+?[.!?](?=\s+["“']?[A-Z]|$)/g)||[]).map(text).find(part=>part.length<=220);
   if(sentence)return selected(sentence);
  }
  return {example:'',exampleDetails:candidates[0]||'',bodyBound:false};
 }
 function reference(row){
  const page=row.sourcePage||row.sourcePdfPage||row.sourceEvidence?.sourcePage||row.evidence?.sourcePage;
  return {page:Number.isSafeInteger(page)&&page>0?page:null,url:text(row.sourceUrl),docId:text(row.sourceDocId||row.sourceEvidence?.sourceDocId||row.evidence?.sourceDocId||row.origin?.docId)};
 }
 function sourceKind(row,lesson,bodyBound){
  const passage=bodyBound&&(!row.phrase||['lesson-passage','textbook-passage'].includes(row.sourceType)||inPassage(row.phrase,lesson));
  const prior=list(row.contextEvidence?.relatedPriorLessons).some(item=>text(item.lessonId)&&item.lessonId!==lesson.id);
  const kind=passage?'passage':prior?'prior-revision':'lesson-extension';
  return {sourceKind:kind,sourceKindLabel:passage?'本课正文用法':prior?'本课笔记 · 旧知复习线索':'本课笔记扩展（非正文）'};
 }
 function forLesson(lesson,options={}){
  lesson=lesson&&typeof lesson==='object'?lesson:{};
  const curated=curatedRegistry?.forLesson?.(lesson)||(officialLesson.test(text(lesson.id))?{status:'needs-review',points:[],errors:['本课作者语法资料暂缺，请重新核对。']}:null);
  const items=[],seen=new Set(),vocabulary=clone(list(lesson.vocabulary)),usage=clone(list(lesson.usage));
  let reviewed=options.reviewedGrammar;
  if(reviewed===undefined){
   const provider=root.StudyReviewedUsage||root.StudyReviewedUsage21To25;
   if(typeof provider?.grammarNotesFor==='function')reviewed=provider.grammarNotesFor(lesson);
  }
  const questions=options.questions===undefined?list(lesson.quiz):list(options.questions);
  function add(row,category,title,note,fallback,details){
   if(items.length>=5||!sameLesson(row,lesson))return;
   title=text(title);note=text(note);
   if(!title||!note||reading.test(category==='grammar'?[title,row.category,row.focus,row.kind,row.conceptId,row.grammarConceptId].join(' '):''))return;
   const key=category+':'+title.normalize('NFKC').toLowerCase();
   if(seen.has(key))return;
   seen.add(key);
   const {bodyBound,...example}=row.editorial&&inPassage(row.example,lesson)?{bodyBound:true,example:row.example,exampleDetails:row.example}:exampleFor(row,lesson);
   items.push({title,summary:row.editorial?text(row.summary):shortSummary(note,title),...(row.editorial?{curated:true,pitfall:text(row.pitfall)}:{}),...example,details:text(details)||note,category,...sourceKind(row,lesson,bodyBound||['lesson-passage','textbook-passage'].includes(row.sourceType)&&list(row.sourceForms).some(form=>inPassage(form,lesson))),
    sourceLabel:text(row.sourceLabel||row.label||row.source)||fallback,
    exampleSourceLabel:bodyBound?'本课教材正文原句（英文）':text(row.exampleSourceLabel)||'本课已有资料中的例句或摘句',
    exampleSourceKind:bodyBound?'passage':'lesson-extension',
    exampleDetailsSourceLabel:example.exampleDetails!==example.example?(text(row.exampleSourceLabel)||'原有学习笔记例句（非所选课文原句）'):'',
    sourceLessonId:lesson.id,sourceReference:reference(row)});
  }
  if(curated?.status==='ready')for(const point of curated.points)add({...point,editorial:true,sourceLabel:'本课原句语法提示 · 自编整理',sourcePage:lesson.textbook?.sourcePdfPage},'grammar',point.title,point.summary+' 注意：'+point.pitfall,'本课原句语法提示 · 自编整理');
  const grammarLimit=3;
  const grammarCandidates=curated?[]:[...list(reviewed).map(row=>({row,fallback:'本课已校对语法笔记 · 中文整理'})),...list(lesson.grammar).map(row=>({row,fallback:'本课语法笔记 · 学习整理'}))];
  grammarCandidates.sort((a,b)=>Number(exampleFor(b.row,lesson).bodyBound)-Number(exampleFor(a.row,lesson).bodyBound));
  for(const {row,fallback} of grammarCandidates)if(items.length<grammarLimit)add(row,'grammar',row.title,row.note||row.rule||row.explanation,fallback);
  const questionRules=new Set();
  for(const row of curated?[]:questions){
   if(items.length>=grammarLimit)break;
   if(row?.type!=='grammar'||row.graded===false||!sameLesson(row,lesson)||reading.test([row.category,row.focus,row.kind,row.conceptId,row.grammarConceptId,row.question].join(' ')))continue;
   const original=text(row.explanation).match(/^原句：([\s\S]+?)\s+巩固原句中的动词形式。$/);
   const rule=text(row.rule)||(original?'巩固原句中的动词形式。':'');
   if(!rule||questionRules.has(rule))continue;
   questionRules.add(rule);
   if(original)add({...row,example:original[1]},'grammar','句式观察 · '+original[1],rule,'本课已有练习解析 · 句式观察',row.explanation);
   else add(row,'grammar',text(row.title)||'语法运用：'+shortSummary(rule,'本课校对规则'),rule,'本课校对语法练习 · 学习整理');
  }
  const passageUsage=row=>sameLesson(row,lesson)&&['lesson-passage','textbook-passage'].includes(row.sourceType)&&inPassage(text(row.example)||text(row.sourceEvidence?.sourceText),lesson);
  const orderedUsage=list(lesson.usage).slice().sort((a,b)=>Number(passageUsage(b))-Number(passageUsage(a)));
  for(const row of orderedUsage){
   if(row.practiceEligible===false||row.needsContextReview===true)continue;
   const meaning=text(row.meaning);
   if(!meaning||/未附|未提供|暂无|待(?:补|核|审)|原笔记习惯表达/.test(meaning))continue;
   const note=text(row.note),brief=!note||/^整理说明[，,；; ]*(?:非原\s*PDF\s*译文)?[。.]?$/i.test(note)?meaning:note;
   add(row,'usage',text(row.phrase),brief,'本课表达用法 · 原有资料整理',note||meaning);
  }
  const grammar=items.filter(item=>item.category==='grammar'),usages=items.filter(item=>item.category==='usage');
  // Cautions are direct sentences from the current source note, not inferred
  // learner error rates or rewritten grammar advice.
  const pitfalls=[];
  for(const point of grammar){
   if(point.curated){pitfalls.push({text:point.pitfall,sourceLessonId:point.sourceLessonId,sourceLabel:point.sourceLabel,sourceReference:{...point.sourceReference}});continue;}
   const sentence=point.details.split(/(?<=[。！？；;])\s*/).map(text).find(part=>/(?:注意|易错|不要|避免|切勿|不能|不可)/.test(part));
   if(sentence)pitfalls.push({text:sentence,sourceLessonId:point.sourceLessonId,sourceLabel:point.sourceLabel,sourceReference:{...point.sourceReference}});
  }
  const reminderRules=new Set();
  for(const row of curated?[]:questions){
   if(pitfalls.length>=3)break;
   if(row?.type!=='grammar'||row.graded!==true||!sameLesson(row,lesson)||reading.test([row.category,row.focus,row.kind,row.conceptId,row.grammarConceptId,row.question].join(' ')))continue;
   const question=text(row.question),choices=list(row.options),correctAnswer=text(choices[row.answer]);
   if(!question||!Number.isInteger(row.answer)||!correctAnswer)continue;
   const wrongAnswer=choices.map(text).find((choice,index)=>index!==row.answer&&choice&&text(row.wrongReasons?.[choice]));
   if(!wrongAnswer)continue;
   const reason=text(row.wrongReasons[wrongAnswer]),key=text(row.rule)||reason;
   if(reminderRules.has(key))continue;
   reminderRules.add(key);
   pitfalls.push({text:question+' 误选：'+wrongAnswer+'；应选：'+correctAnswer+'。'+reason,question,wrongAnswer,correctAnswer,reason,sourceLessonId:lesson.id,sourceLabel:text(row.sourceLabel)||'本课已有语法练习解析',sourceReference:reference(row)});
  }
  return {items,grammar,usages,pitfalls,vocabulary,usage,contentStatus:curated?.status||'existing-notes',notice:curated?.status==='ready'?'语法与易错提示依据本课英文原句自编整理；例句引自本课，非教材官方语法讲义或实时在线 AI。':curated?'本课语法资料暂缺或与当前正文不匹配，请重新核对；暂不显示通用补位内容。':NOTICE};
 }
 return Object.freeze({forLesson});
});
