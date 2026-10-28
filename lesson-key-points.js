/* Selects brief points from existing lesson material; no network or new examples. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.StudyLessonKeyPoints=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const list=value=>Array.isArray(value)?value:[];
 const text=value=>typeof value==='string'?value.trim():'';
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const NOTICE='根据本课已有教材与校对笔记整理；采用本地整理逻辑，非实时在线 AI。';
 const reading=/reading|comprehension|main[-_ ]?idea|阅读理解|课文理解|细节理解|理解题/i;
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
 function exampleFor(row,lesson){
  const candidates=[row.example,...list(row.supportingExamples),row.sourceEvidence?.sourceText,row.evidence?.sourceSentence,row.sourceExample].map(text).filter(value=>value&&/[A-Za-z]/.test(value)&&!value.includes('___'));
  const backed=candidates.filter(value=>inPassage(value,lesson));
  const selected=value=>({example:value,exampleDetails:candidates[0]||value,bodyBound:inPassage(value,lesson)});
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
 function forLesson(lesson,options={}){
  lesson=lesson&&typeof lesson==='object'?lesson:{};
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
   const {bodyBound,...example}=exampleFor(row,lesson);
   items.push({title,summary:shortSummary(note,title),...example,details:text(details)||note,category,
    sourceLabel:text(row.sourceLabel||row.label||row.source)||fallback,
    exampleSourceLabel:bodyBound?'本课教材正文原句（英文）':text(row.exampleSourceLabel)||'本课已有资料中的例句或摘句',
    sourceLessonId:lesson.id,sourceReference:reference(row)});
  }
  const grammarLimit=3;
  for(const row of list(reviewed))if(items.length<grammarLimit)add(row,'grammar',row.title,row.note||row.rule,'本课已校对语法笔记 · 中文整理');
  for(const row of list(lesson.grammar))if(items.length<grammarLimit)add(row,'grammar',row.title,row.note||row.rule||row.explanation,'本课语法笔记 · 学习整理');
  const questionRules=new Set();
  for(const row of questions){
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
   const sentence=point.details.split(/(?<=[。！？；;])\s*/).map(text).find(part=>/(?:注意|易错|不要|避免|切勿|不能|不可)/.test(part));
   if(sentence)pitfalls.push({text:sentence,sourceLessonId:point.sourceLessonId,sourceLabel:point.sourceLabel,sourceReference:{...point.sourceReference}});
  }
  return {items,grammar,usages,pitfalls,vocabulary,usage,notice:NOTICE};
 }
 return Object.freeze({forLesson});
});
