'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const corePath = path.join(__dirname, '..', 'learning-pipeline-core.js');
// A missing implementation is an explicit assertion failure during RED.
const pipeline = fs.existsSync(corePath) ? require(corePath) : {};
const api = name => {
  assert.equal(typeof pipeline[name], 'function', `${name} must implement the pipeline contract`);
  return pipeline[name];
};
const lesson = number => ({id:'lesson-'+number,book:2,number,title:'Lesson '+number,paragraphs:[{en:'He is here.',zh:'他在这里。'}],vocabulary:[{word:'here',meaning:'这里'}],usage:[{phrase:'be here',meaning:'在这里'}]});
const questions = (id,count=12) => Array.from({length:count},(_,i)=>({id:id+'-q'+i,type:'grammar',graded:true,question:'Question '+i+' in '+id,options:['is','are','was'],answer:0,conceptId:id+'-grammar-'+i,rule:'单数主语用 is。',explanation:'He is here.',origin:{kind:'authored',page:i+1}}));
const bank = id => questions(id);

test('plans seven current and three earlier grammar questions, preserving provenance',()=>{
  const lessons=[lesson(1),lesson(2),lesson(3)];
  const result=api('planQuiz')({lesson:lessons[2],lessons,questionsForLesson:bank,records:{'lesson-1':{completed:true}}});
  assert.deepEqual(result.desiredCounts,{current:7,review:3,total:10});
  assert.deepEqual(result.actualCounts,{current:7,review:3,total:10});
  assert.equal(new Set(result.questions.map(q=>q.id)).size,10);
  assert.equal(result.questions.filter(q=>q.isCurrent).length,7);
  assert.ok(result.questions.filter(q=>q.isReview).every(q=>q.pipeline.sourceLessonId==='lesson-1'&&q.pipeline.studied));
  assert.deepEqual(result.questions[0].origin,{kind:'authored',page:1});
  assert.equal(result.questions[0].question,'Question 0 in lesson-3');
});

test('rolling review rotates across earlier lessons and never samples a later lesson or another book',()=>{
  const lessons=[lesson(1),lesson(2),lesson(3),lesson(4),{...lesson(1),id:'other-book',book:1}];
  const options={lesson:lessons[2],lessons,questionsForLesson:bank,records:{'lesson-1':{completed:true},'lesson-2':{attempts:1}}};
  const first=api('planQuiz')({...options,round:0});
  const second=pipeline.planQuiz({...options,round:1});
  assert.deepEqual(new Set(first.questions.filter(q=>q.isReview).map(q=>q.pipeline.sourceLessonId)),new Set(['lesson-1','lesson-2']));
  assert.notDeepEqual(first.questions.filter(q=>q.isReview).map(q=>q.id),second.questions.filter(q=>q.isReview).map(q=>q.id));
  assert.ok(second.questions.every(q=>['lesson-1','lesson-2','lesson-3'].includes(q.pipeline.sourceLessonId)));
  assert.deepEqual(first,pipeline.planQuiz({...options,round:0}));
});

test('first lesson uses only current questions and reports the honest ten-question goal',()=>{
  const current=lesson(1);
  const result=api('planQuiz')({lesson:current,lessons:[current,lesson(2)],questionsForLesson:bank});
  assert.deepEqual(result.desiredCounts,{current:10,review:0,total:10});
  assert.deepEqual(result.actualCounts,{current:10,review:0,total:10});
  assert.equal(result.reason,'no-earlier-lessons');
  assert.ok(result.questions.every(q=>q.isCurrent&&!q.isReview));
});

test('reports unavailable slots instead of duplicating questions or pretending to meet 70/30',()=>{
  const lessons=[lesson(1),lesson(2)];
  const result=api('planQuiz')({lesson:lessons[1],lessons,questionsForLesson:id=>questions(id,id==='lesson-1'?1:2)});
  assert.deepEqual(result.desiredCounts,{current:7,review:3,total:10});
  assert.deepEqual(result.actualCounts,{current:2,review:1,total:3});
  assert.deepEqual(result.shortfall,{current:5,review:2,total:7});
  assert.equal(result.reason,'insufficient-questions');
});

test('filters vocabulary, ungraded and malformed items without changing the source bank',()=>{
  const rows=questions('lesson-1',2);
  rows.push({...rows[0],id:'vocab',type:'vocabulary'},{...rows[0],id:'ungraded',graded:false},{...rows[0],id:'broken',answer:9},{...rows[0]});
  const before=JSON.stringify(rows);
  const result=api('planQuiz')({lesson:lesson(1),lessons:[lesson(1)],questionsForLesson:()=>rows});
  assert.deepEqual(result.questions.map(q=>q.id),['lesson-1-q0','lesson-1-q1']);
  assert.equal(JSON.stringify(rows),before);
});

test('uses actual learning evidence rather than a score or inherited record to prioritize review',()=>{
  const lessons=[lesson(1),lesson(2),lesson(3)];
  const records=Object.create({'lesson-1':{completed:true}});
  records['lesson-2']={best:100,learningProgress:{readAt:0}};
  const result=api('planQuiz')({lesson:lessons[2],lessons,records,questionsForLesson:bank});
  assert.ok(result.questions.filter(q=>q.isReview).every(q=>q.pipeline.sourceLessonId==='lesson-2'&&q.pipeline.studied));
});

test('first lesson of a later book reviews studied earlier books and retains book/lesson provenance',()=>{
  const current=lesson(1),old={...lesson(8),id:'book1-8',book:1},unlearned={...lesson(9),id:'book1-9',book:1};
  const result=api('planQuiz')({lesson:current,lessons:[unlearned,current,old],questionsForLesson:bank,records:{'book1-8':{completed:true}}});
  assert.deepEqual(result.actualCounts,{current:7,review:3,total:10});
  assert.ok(result.questions.filter(q=>q.isReview).every(q=>q.pipeline.sourceLessonId==='book1-8'&&q.pipeline.sourceLesson.book===1&&q.pipeline.sourceLesson.number===8));
});

test('uses all current questions when earlier lessons have no eligible grammar questions',()=>{
  const lessons=[lesson(1),lesson(2)];
  const result=api('planQuiz')({lesson:lessons[1],lessons,questionsForLesson:id=>id==='lesson-1'?[]:questions(id)});
  assert.deepEqual(result.desiredCounts,{current:10,review:0,total:10});
  assert.deepEqual(result.actualCounts,{current:10,review:0,total:10});
  assert.equal(result.reason,'no-earlier-lessons');
});

test('sanitize restores the active lesson, stage, selected quiz answers, drafts and long histories',()=>{
  const history=Array.from({length:400},(_,i)=>({at:i,answerIndex:1,correct:false}));
  const state={version:1,activeLessonId:'lesson-2',custom:{backup:'keep'},lessons:{'lesson-2':{stage:3,round:5,quiz:{questions:questions('lesson-2',2),answers:{'lesson-2-q0':1},index:1,submitted:false},reading:{audioTime:42},sentences:{draft:'A'.repeat(20000)},reflection:{notes:'自己回顾'},mistakes:{q:{history}},attempts:history}}};
  const before=JSON.stringify(state);
  const result=api('sanitize')(JSON.parse(before));
  assert.equal(result.activeLessonId,'lesson-2');
  assert.equal(result.lessons['lesson-2'].stage,3);
  assert.equal(result.lessons['lesson-2'].quiz.index,1);
  assert.equal(result.lessons['lesson-2'].quiz.answers['lesson-2-q0'],1);
  assert.equal(result.lessons['lesson-2'].sentences.draft.length,20000);
  assert.equal(result.lessons['lesson-2'].attempts.length,400);
  assert.equal(result.lessons['lesson-2'].mistakes.q.history.length,400);
  assert.deepEqual(result.custom,{backup:'keep'});
  assert.equal(JSON.stringify(state),before);
});

test('sanitize supplies usable defaults and strips unsafe keys without discarding other lessons',()=>{
  const result=api('sanitize')(JSON.parse('{"activeLessonId":"lesson-1","lessons":{"lesson-1":{"stage":99,"quiz":{"index":-2}},"old":{"stage":4},"__proto__":{"polluted":true}},"constructor":{"polluted":true}}'));
  assert.equal(result.lessons['lesson-1'].stage,0);
  assert.equal(result.lessons['lesson-1'].quiz.index,0);
  assert.deepEqual(result.lessons['lesson-1'].quiz.answers,{});
  assert.equal(result.lessons.old.stage,4);
  assert.equal(Object.hasOwn(result.lessons,'__proto__'),false);
  assert.equal(Object.hasOwn(result,'constructor'),false);
  assert.equal({}.polluted,undefined);
});

test('captureAttempt automatically collects a wrong answer snapshot and saves the quiz selection',()=>{
  const question=questions('lesson-1',1)[0];
  const source={activeLessonId:'lesson-1',lessons:{'lesson-1':{stage:1}}};
  const before=JSON.stringify(source);
  const result=api('captureAttempt')(source,{lessonId:'lesson-1',question,answerIndex:1,now:100});
  assert.equal(result.accepted,true);
  assert.equal(result.result.correct,false);
  const record=result.state.lessons['lesson-1'];
  assert.equal(record.stage,1);
  assert.equal(record.quiz.answers[question.id],1);
  assert.equal(record.mistakes[question.id].wrongCount,1);
  assert.equal(record.mistakes[question.id].consecutiveWrong,1);
  assert.equal(record.mistakes[question.id].revision,1);
  assert.equal(record.mistakes[question.id].question.options[0],'is');
  assert.equal(record.mistakes[question.id].history[0].selectedAnswer,'are');
  question.options[0]='changed';
  assert.equal(record.mistakes['lesson-1-q0'].question.options[0],'is');
  assert.equal(JSON.stringify(source),before);
});

test('repeated errors increment consecutive counts; later correct answers retain the error history',()=>{
  const question=questions('lesson-1',1)[0];
  let state={};
  for(const [answerIndex,now] of [[1,100],[2,200],[0,300]])state=api('captureAttempt')(state,{lessonId:'lesson-1',question,answerIndex,now}).state;
  const record=state.lessons['lesson-1'].mistakes[question.id];
  assert.equal(record.wrongCount,2);
  assert.equal(record.correctCount,1);
  assert.equal(record.consecutiveWrong,0);
  assert.equal(record.maxConsecutiveWrong,2);
  assert.equal(record.revision,3);
  assert.deepEqual(record.history.map(row=>row.correct),[false,false,true]);
  assert.equal(record.question.question,question.question);
  assert.equal(record.mastered,undefined);
});

test('correct objective answers are recorded but do not create an error or claim mastery',()=>{
  const question=questions('lesson-1',1)[0];
  const result=api('captureAttempt')({}, {lessonId:'lesson-1',question,answerIndex:0,now:100});
  assert.equal(result.accepted,true);
  assert.equal(result.result.correct,true);
  assert.deepEqual(result.state.lessons['lesson-1'].mistakes,{});
  assert.equal(result.state.lessons['lesson-1'].questionStats[question.id].correctCount,1);
  assert.equal(result.state.lessons['lesson-1'].mastered,undefined);
});

test('rejects free writing, invalid answer indices and unsafe identities without creating evidence',()=>{
  const question=questions('lesson-1',1)[0];
  for(const change of [{question:{...question,type:'free-writing'}},{answerIndex:-1},{answerIndex:7},{answerIndex:'1'},{lessonId:'__proto__'},{question:{...question,graded:false}}]){
    const result=api('captureAttempt')({}, {lessonId:'lesson-1',question,answerIndex:1,now:100,...change});
    assert.equal(result.accepted,false);
    assert.deepEqual(result.state.lessons,{});
  }
});

test('lessonSummary aggregates all source text, sentences, vocabulary and errors without updating old scores',()=>{
  const current=lesson(1);
  current.grammar=[{title:'be动词',explanation:'与主语一致。'}];
  const question=questions(current.id,1)[0];
  const state=api('captureAttempt')({}, {lessonId:current.id,question,answerIndex:2,now:100}).state;
  const sentences=Array.from({length:55},(_,i)=>({id:'s'+i,text:'I am here '+i,kind:'affirmative',feedback:'仅供自主对照'}));
  const records={[current.id]:{best:90,lastScore:80,attempts:2}};
  const before=JSON.stringify({current,state,sentences,records});
  const result=api('lessonSummary')({lesson:current,state,sentences,records});
  assert.equal(result.lessonId,'lesson-1');
  assert.deepEqual(result.paragraphs,[{en:'He is here.',zh:'他在这里。'}]);
  assert.deepEqual(result.vocabulary,[{word:'here',meaning:'这里'}]);
  assert.deepEqual(result.usage,[{phrase:'be here',meaning:'在这里'}]);
  assert.equal(result.sentences.length,55);
  assert.equal(result.mistakes.length,1);
  assert.equal(result.grammar.length,1);
  assert.equal(result.mastered,undefined);
  assert.equal(JSON.stringify({current,state,sentences,records}),before);
});

test('real knowledge bank questions retain reviewed explanations and register review mistakes under the active lesson',()=>{
  const root=path.dirname(corePath),window={},context=vm.createContext({window});
  for(const filename of ['curriculum.js','textbook-lessons.js','book2-lessons.js','book2-translations.js','book2-reading-alignment.js','phrase-library.js','book2-learning-support.js','book2-vocabulary.js','book2-additional-context-fixes.js','book2-quality-support.js','book2-reviewed-questions.js','study-knowledge.js','book2-later-question-expansion.js']){
    vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),context,{filename});
  }
  const bank=window.StudyKnowledge.create(window.LESSONS,{grammarAudit:window.BOOK2_QUESTION_REVIEWS,extraQuestions:window.BOOK2_LATER_QUESTION_EXPANSION});
  const current=window.LESSONS.find(row=>row.book===2&&row.number===20);
  const previous=window.LESSONS.find(row=>row.book===2&&row.number===19);
  const original=JSON.stringify(bank.questionsForLesson(current.id));
  const result=api('planQuiz')({lesson:current,lessons:window.LESSONS,questionsForLesson:id=>bank.questionsForLesson(id),records:{[previous.id]:{attempts:1}}});
  assert.ok(result.actualCounts.current>0);
  assert.equal(result.actualCounts.review,3);
  assert.equal(result.questions.length,result.actualCounts.total);
  assert.ok(result.questions.every(row=>row.type==='grammar'&&row.graded===true&&row.explanation&&row.pipeline.sourceLesson.number<=20));
  const review=result.questions.find(row=>row.isReview);
  assert.equal(review.pipeline.sourceLessonId,previous.id);
  const captured=pipeline.captureAttempt({}, {lessonId:current.id,question:review,answerIndex:(review.answer+1)%review.options.length,now:100});
  assert.ok(captured.state.lessons[current.id].mistakes[review.id]);
  assert.equal(captured.state.lessons[previous.id],undefined);
  assert.equal(captured.result.sourceLessonId,previous.id);
  assert.equal(JSON.stringify(bank.questionsForLesson(current.id)),original);
});

test('browser build exposes the same pure API without a module loader or DOM',()=>{
  assert.ok(fs.existsSync(corePath),'core file must exist');
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(corePath,'utf8'),context);
  assert.equal(typeof context.window.StudyLearningPipeline.planQuiz,'function');
  assert.equal(context.window.StudyLearningPipeline.sanitize(null).version,1);
});

test('earlier review prioritizes real unresolved mistakes then overdue questions across active lesson histories',()=>{
 const lessons=[lesson(1),lesson(2),lesson(3),lesson(4)],now=20*86400000;
 const pipelineState={lessons:{'lesson-3':{questionStats:{
  'lesson-2-q8':{question:questions('lesson-2')[8],lastCorrect:false,lastAt:now-100,wrongCount:2,consecutiveWrong:2},
  'lesson-1-q9':{question:questions('lesson-1')[9],lastCorrect:true,lastAt:0},
  'lesson-4-q0':{question:questions('lesson-4')[0],lastCorrect:false,lastAt:0}
 }}}};
 const result=api('planQuiz')({lesson:lessons[2],lessons,questionsForLesson:bank,pipelineState,now,records:{'lesson-1':{completed:true}}});
 assert.deepEqual(result.questions.filter(row=>row.isReview).slice(0,2).map(row=>row.id),['lesson-2-q8','lesson-1-q9']);
 assert.equal(result.actualCounts.current,7);assert.equal(result.actualCounts.review,3);
 assert.ok(result.questions.every(row=>row.pipeline.sourceLesson.number<=3));
});
