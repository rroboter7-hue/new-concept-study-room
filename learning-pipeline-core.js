/* Pure, serializable learning-flow state. No DOM, storage or score migration. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudyLearningPipeline=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const BAD=new Set(['__proto__','prototype','constructor']);
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const own=(value,key)=>object(value)?Object.getOwnPropertyDescriptor(value,key)?.value:undefined;
  const safeId=value=>typeof value==='string'&&value.trim().length>0&&!BAD.has(value);
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const count=value=>integer(value)?value:0;
  const time=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<8640000000000000;
  const array=value=>Array.isArray(value)?value:[];

  // Stored drafts and histories are intentionally not length-limited. Cleaning
  // removes unsafe object keys; it never trims existing user text or old events.
  function clone(value){
    if(Array.isArray(value))return value.map(clone);
    if(!object(value))return value;
    const result={};
    for(const key of Object.keys(value)){
      if(BAD.has(key))continue;
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(descriptor&&Object.hasOwn(descriptor,'value'))result[key]=clone(descriptor.value);
    }
    return result;
  }
  function hasStudied(record){
    const progress=own(record,'learningProgress'),attempts=own(record,'attempts');
    return own(record,'completed')===true||typeof attempts==='number'&&Number.isFinite(attempts)&&Math.floor(attempts)>0||time(own(progress,'readAt'))||time(own(progress,'firstPracticedAt'));
  }
  function grammarQuestion(question){
    return object(question)&&(question.type==='grammar'||question.type==='choice'&&question.category==='grammar')&&question.graded!==false&&
      typeof (question.question||question.prompt)==='string'&&!!(question.question||question.prompt).trim()&&
      Array.isArray(question.options)&&question.options.length>=2&&question.options.every(option=>typeof option==='string'&&option.trim())&&
      integer(question.answer)&&question.answer<question.options.length;
  }
  function questionId(question,lessonId){
    if(safeId(question.id))return question.id;
    const value=JSON.stringify([lessonId,question.question||question.prompt,question.options,question.answer]);
    let hash=2166136261;
    for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return 'pipeline:'+lessonId+':'+(hash>>>0).toString(16);
  }
  const sourceLesson=lesson=>({id:lesson.id,book:Number(lesson.book),number:Number(lesson.number),title:typeof lesson.title==='string'?lesson.title:''});
  function rotate(rows,offset){
    if(!rows.length)return [];
    const start=offset%rows.length;
    return rows.slice(start).concat(rows.slice(0,start));
  }
  function planQuiz(options={}){
    const lesson=options.lesson||{},round=count(options.round),total=integer(options.count)?options.count:10;
    const records=object(options.records)?options.records:{},selected=[],seen=new Set();
    const earlier=array(options.lessons).filter(row=>safeId(row?.id)&&row.id!==lesson.id&&(
      Number(row.book)===Number(lesson.book)&&Number(row.number)<Number(lesson.number)||
      Number(row.book)<Number(lesson.book)&&hasStudied(own(records,row.id))))
      .sort((a,b)=>Number(a.book)-Number(b.book)||Number(a.number)-Number(b.number)||a.id.localeCompare(b.id));
    const get=typeof options.questionsForLesson==='function'?options.questionsForLesson:(id,source)=>source.quiz;
    function pool(source,origin){
      const rows=array(get(source.id,source)),ids=new Set();
      return rows.filter(grammarQuestion).flatMap(raw=>{
        const id=questionId(raw,source.id);
        if(ids.has(id))return [];ids.add(id);
        return [{...clone(raw),id,sourceLessonId:raw.sourceLessonId||source.id,isCurrent:origin==='current',isReview:origin==='review',
          pipeline:{origin,sourceLessonId:source.id,sourceLesson:sourceLesson(source),studied:hasStudied(own(records,source.id))}}];
      });
    }
    function take(rows,limit){
      let added=0;
      for(const question of rows){if(added>=limit)break;if(seen.has(question.id))continue;selected.push(question);seen.add(question.id);added++;}
      return added;
    }
    const availableEarlier=earlier.map(source=>({source,questions:pool(source,'review')})).filter(row=>row.questions.length);
    const desiredCurrent=availableEarlier.length?Math.round(total*0.7):total,desiredReview=total-desiredCurrent;
    const desiredCounts={current:desiredCurrent,review:desiredReview,total};
    if(safeId(lesson.id))take(rotate(pool(lesson,'current'),round*desiredCurrent),desiredCurrent);
    let remaining=desiredReview;
    for(const studied of [true,false]){
      const sources=rotate(availableEarlier.filter(row=>hasStudied(own(records,row.source.id))===studied),round);
      const pools=sources.map(row=>rotate(row.questions,round*desiredReview));
      const interleaved=[];
      for(let index=0;pools.some(rows=>index<rows.length);index++)for(const rows of pools)if(index<rows.length)interleaved.push(rows[index]);
      remaining-=take(interleaved,remaining);
      if(!remaining)break;
    }
    const actualCounts={current:selected.filter(q=>q.isCurrent).length,review:selected.filter(q=>q.isReview).length,total:selected.length};
    const shortfall={current:desiredCurrent-actualCounts.current,review:desiredReview-actualCounts.review,total:total-actualCounts.total};
    return {questions:selected,desiredCounts,actualCounts,shortfall,round,
      reason:shortfall.total?'insufficient-questions':availableEarlier.length?'planned':'no-earlier-lessons'};
  }

  function sanitize(raw){
    const state=object(raw)?clone(raw):{};
    state.version=1;
    state.activeLessonId=safeId(state.activeLessonId)?state.activeLessonId:null;
    const lessons={};
    for(const [id,value] of Object.entries(object(state.lessons)?state.lessons:{})){
      if(!safeId(id))continue;
      const record=object(value)?value:{},quiz=object(record.quiz)?record.quiz:{};
      record.stage=integer(record.stage)&&record.stage<=4?record.stage:0;
      record.round=count(record.round);
      record.quiz={...quiz,questions:array(quiz.questions),answers:object(quiz.answers)?quiz.answers:{},index:count(quiz.index),submitted:quiz.submitted===true};
      record.mistakes=object(record.mistakes)?record.mistakes:{};
      record.questionStats=object(record.questionStats)?record.questionStats:{};
      record.attempts=array(record.attempts);
      record.reading=object(record.reading)?record.reading:{};
      record.reflection=object(record.reflection)?record.reflection:{};
      lessons[id]=record;
    }
    state.lessons=lessons;
    return state;
  }

  function captureAttempt(raw,options={}){
    const state=sanitize(raw),{lessonId,question,answerIndex}=options;
    if(!safeId(lessonId)||!grammarQuestion(question)||!integer(answerIndex)||answerIndex>=question.options.length)return {accepted:false,state,result:null};
    const now=time(options.now)?options.now:Date.now(),id=questionId(question,lessonId);
    if(!state.lessons[lessonId])state.lessons[lessonId]=sanitize({lessons:{[lessonId]:{}}}).lessons[lessonId];
    const record=state.lessons[lessonId],previous=record.questionStats[id]||record.mistakes[id]||{};
    const correct=answerIndex===question.answer;
    const snapshot={...clone(question),id};
    const result={questionId:id,lessonId,sourceLessonId:question.pipeline?.sourceLessonId||question.sourceLessonId||lessonId,answerIndex,
      selectedAnswer:question.options[answerIndex],expectedAnswer:question.options[question.answer],correct,objective:true,at:now,
      explanation:question.explanation||question.rule||''};
    const consecutiveWrong=correct?0:count(previous.consecutiveWrong)+1;
    const progress={...previous,question:snapshot,attempts:count(previous.attempts)+1,wrongCount:count(previous.wrongCount)+(correct?0:1),
      correctCount:count(previous.correctCount)+(correct?1:0),consecutiveWrong,maxConsecutiveWrong:Math.max(count(previous.maxConsecutiveWrong),consecutiveWrong),
      revision:count(previous.revision)+1,lastAt:now,lastCorrect:correct,lastAnswerIndex:answerIndex,history:[...array(previous.history),clone(result)]};
    record.questionStats[id]=progress;
    if(!correct||Object.hasOwn(record.mistakes,id))record.mistakes[id]=clone(progress);
    record.attempts.push(clone(result));
    record.quiz.answers[id]=answerIndex;
    record.quiz.results={...(object(record.quiz.results)?record.quiz.results:{}),[id]:clone(result)};
    record.updatedAt=now;
    if(!state.activeLessonId)state.activeLessonId=lessonId;
    return {accepted:true,state,result};
  }

  function lessonSummary(options={}){
    const lesson=options.lesson||{},state=sanitize(options.state),record=state.lessons[lesson.id]||{};
    const sentenceSource=options.sentences===undefined?record.sentences:options.sentences;
    const sentences=Array.isArray(sentenceSource)?sentenceSource:Array.isArray(sentenceSource?.items)?sentenceSource.items:object(sentenceSource)?Object.values(sentenceSource):[];
    return {lessonId:lesson.id,title:lesson.title||'',paragraphs:clone(array(lesson.paragraphs)),grammar:clone(array(lesson.grammar)),
      vocabulary:clone(array(lesson.vocabulary)),usage:clone(array(lesson.usage)),sentences:clone(sentences),
      mistakes:clone(Object.values(record.mistakes||{})),reflection:clone(record.reflection||{}),
      attempts:clone(array(record.attempts)),stage:record.stage??0};
  }
  return Object.freeze({planQuiz,sanitize,captureAttempt,lessonSummary});
});
