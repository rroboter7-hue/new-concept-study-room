'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),target=path.join(root,'learning-pipeline-questions.js');
const api=fs.existsSync(target)?require(target):{};
function get(lesson,options){assert.equal(typeof api.forLesson,'function','forLesson must provide source-bound grammar choices');return api.forLesson(lesson,options);}
const lesson=extra=>({id:'current',book:4,number:1,title:'Current',paragraphs:[{en:'He is waiting. They are working. I am reading. She was talking. We were walking. They have been here. He can be quiet. She will go home. He must have seen it. They did not go.'}],grammar:[],quiz:[],usage:[],vocabulary:[],...extra});
const objective=(extra={})=>({id:'retained-id',type:'grammar',graded:true,question:'Choose the correct form: He ___ waiting.',options:['is','are','am'],answer:0,rule:'he 是第三人称单数。',explanation:'he 是第三人称单数，be 现在式用 is。',sourceLessonId:'current',...extra});

test('retains current reviewed bank choices and their identities without modifying their question or options',()=>{
 const old=objective(),before=JSON.stringify(old),bank={hasLesson:id=>id==='current',questionsForLesson:()=>[old]};
 const result=get(lesson(),{bank});
 assert.equal(result[0].id,'retained-id');assert.equal(result[0].question,old.question);assert.deepEqual(result[0].options,old.options);
 assert.equal(JSON.stringify(old),before);assert.ok(result.length<=10);
});

test('does not turn comprehension, vocabulary, ungraded or a foreign/future lesson choice into grammar evidence',()=>{
 const bank={hasLesson:()=>true,questionsForLesson:()=>[
  objective({id:'reading',category:'reading-comprehension',question:'Why did he go?',rule:'课文细节'}),
  objective({id:'word',type:'vocabulary'}),objective({id:'ungraded',graded:false}),
  objective({id:'foreign',sourceLessonId:'future'}),objective({id:'review',pipeline:{origin:'review',sourceLessonId:'old'}})
 ]};
 assert.deepEqual(get(lesson({paragraphs:[]}),{bank}),[]);
});

test('supplements from exact local clauses using unambiguous constrained forms and source-labelled explanations',()=>{
 const current=lesson(),result=get(current);
 assert.equal(result.length,10);
 assert.ok(result.every(q=>q.type==='grammar'&&q.graded===true&&q.sourceLessonId==='current'&&q.conceptId&&q.id));
 assert.ok(result.every(q=>q.options.length>=3&&new Set(q.options).size===q.options.length&&Number.isInteger(q.answer)));
 assert.ok(result.every(q=>q.sourceType==='self-authored-source-bound-grammar'&&q.sourceLabel.includes('自编')&&q.sourceLabel.includes('非教材原题')));
 assert.ok(result.every(q=>q.explanation.includes(q.sourceEvidence.sourceText)&&current.paragraphs[0].en.includes(q.sourceEvidence.sourceText)));
 assert.ok(result.some(q=>q.grammarConceptId==='be-agreement'));
 assert.ok(result.some(q=>q.grammarConceptId==='modal-base-form'));
 assert.equal(new Set(result.map(q=>q.question)).size,10);
 assert.deepEqual(result,get(current));
});

test('does not guess ambiguous tense, subjective word meanings or arbitrary preposition alternatives',()=>{
 const current=lesson({paragraphs:[{en:'If he were here, things could improve. They dream about success. He looked at the picture.'}],usage:[{phrase:'dream of',meaning:'梦想',example:'They dream about success.'}]});
 const result=get(current);
 assert.ok(!result.some(q=>q.question.includes('If he ___')));
 assert.ok(!result.some(q=>q.grammarConceptId==='fixed-preposition'));
 assert.ok(!result.some(q=>q.question.includes('dream ___')));
});

test('uses attested fixed collocations and their actual local matched forms',()=>{
 const current=lesson({paragraphs:[{en:'It belongs to Jane. We took part in the meeting.'}],usage:[{phrase:'belong to',matchedForm:'belongs to',meaning:'属于',example:'It belongs to Jane.',sourceType:'textbook-passage'},{phrase:'take part in',matchedForm:'took part in',meaning:'参加',example:'We took part in the meeting.',sourceType:'textbook-passage'}]});
 const result=get(current).filter(q=>q.grammarConceptId==='fixed-preposition');
 assert.equal(result.length,2);
 assert.ok(result.some(q=>q.question.includes('belongs ___ Jane')&&q.options[q.answer]==='to'));
 assert.ok(result.some(q=>q.question.includes('took part ___ the meeting')&&q.options[q.answer]==='in'));
});

test('only reuses a loaded recall grammar choice when its evidence is in this exact lesson',()=>{
 const current=lesson({paragraphs:[{en:'He is here.'}]}),choice={id:'content-1',type:'choice',focus:'grammar',instructionZh:'选择 be 动词：He ___ here.',options:['is','are','am'],answer:0,explanation:'he 用 is。',evidence:{paragraphIndex:0,quote:'He is here.'}};
 const result=get(current,{readingUnits:{lessons:[{lessonId:'current',questions:[choice,{...choice,id:'reading',focus:'reading'},{...choice,id:'changed',evidence:{paragraphIndex:0,quote:'They are there.'}}]},{lessonId:'other',questions:[choice]}]}});
 const reused=result.filter(q=>q.sourceType==='existing-lesson-recall-grammar');
 assert.equal(reused.length,1);assert.equal(reused[0].originalQuestionId,'content-1');
 assert.equal(reused[0].id,'pipeline-recall:current:content-1');
 assert.equal(reused[0].question,'选择 be 动词：He ___ here.');
 assert.equal(reused[0].sourceLessonId,'current');
});

test('keeps a real shortage when there is no reliable local sentence and never pads with duplicate questions',()=>{
 const current=lesson({paragraphs:[{en:'Silence.'}],grammar:[],usage:[],vocabulary:[]});
 assert.deepEqual(get(current),[]);
 const one=get(lesson({paragraphs:[{en:'He is here. He is here.'}]}));
 assert.equal(new Set(one.map(q=>q.question)).size,one.length);
 assert.ok(one.length<10);
});

test('supports finite be with a noun subject without guessing its number or offering alternative tenses',()=>{
 const rows=get(lesson({paragraphs:[{en:'The clock is old. The doors were open.'}]}));
 const forms=rows.filter(q=>q.grammarConceptId==='finite-be-form');
 assert.equal(forms.length,2);
 assert.ok(forms.every(q=>q.options.filter(value=>['am','is','are','was','were'].includes(value)).length===1));
});

test('asks only attested countable noun forms and keeps source imperatives in the base form',()=>{
 const rows=get(lesson({paragraphs:[{en:'Open the door. These glasses are clean.'}],vocabulary:[{word:'glass',pos:'n.',meaning:'玻璃杯',example:'These glasses are clean.'}]}));
 assert.ok(rows.some(q=>q.grammarConceptId==='imperative-base-form'&&q.options[q.answer]==='Open'));
 assert.ok(rows.some(q=>q.grammarConceptId==='noun-number'&&q.options[q.answer]==='glasses'&&q.question.includes('名词复数')));
});

test('can test attested pronoun case and possessive determiners in short introductory dialogues',()=>{
 const rows=get(lesson({paragraphs:[{en:'Is this your handbag? Yes, it is. This is my handbag.'}]}));
 assert.ok(rows.some(q=>q.grammarConceptId==='possessive-determiner'&&q.options[q.answer]==='your'));
 assert.ok(rows.some(q=>q.grammarConceptId==='subject-pronoun'&&q.options[q.answer]==='it'));
 assert.ok(rows.some(q=>q.grammarConceptId==='singular-demonstrative'&&q.options[q.answer]==='this'));
});

test('does not mislabel a third-person verb as a plural noun when their spellings coincide',()=>{
 const rows=get(lesson({paragraphs:[{en:'He watches the clock. She books a room. The teacher questions them.'}]}));
 const wrong=rows.filter(q=>q.grammarConceptId==='noun-number'&&['watches','books','questions'].includes(q.options[q.answer].toLowerCase()));
 assert.deepEqual(wrong,[]);
});

test('real 276-lesson coverage is measurable, every generated source belongs to that lesson and no runtime fetch is needed',t=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),scope,{filename:name});if(name==='book34-language-support.js')break;
 }
 const lessons=scope.LESSONS.filter(row=>!row.audioOnly),report={lessons:lessons.length,atLeast7:0,atLeast10:0,shortages:[]};assert.equal(lessons.length,276);
 for(const current of lessons){
  const before=JSON.stringify(current),result=get(current,{bank:scope.StudyKnowledge.bank});
  if(result.length>=7)report.atLeast7++;if(result.length>=10)report.atLeast10++;else report.shortages.push({book:current.book,number:current.number,count:result.length});
  assert.ok(result.every(q=>q.type==='grammar'&&q.sourceLessonId===current.id));
  assert.equal(new Set(result.map(q=>q.id)).size,result.length,current.id+' duplicate IDs');
  for(const question of result.filter(q=>q.sourceType==='self-authored-source-bound-grammar'))assert.ok(JSON.stringify(current).includes(JSON.stringify(question.sourceEvidence.sourceText).slice(1,-1)),current.id+' foreign source');
  assert.equal(JSON.stringify(current),before);
 }
 assert.ok(report.atLeast7>=275,JSON.stringify(report));
 const planner=require('../learning-pipeline-core.js'),cache=new Map(lessons.map(current=>[current.id,get(current,{bank:scope.StudyKnowledge.bank})]));
 report.flowShortages=[];
 for(const current of lessons){
  const plan=planner.planQuiz({lesson:current,lessons,questionsForLesson:id=>cache.get(id)||[]});
  assert.equal(plan.actualCounts.total+plan.shortfall.total,10,current.id+': fixed flow must report every missing slot');
  if(plan.shortfall.total)report.flowShortages.push({book:current.book,number:current.number,actual:plan.actualCounts.total,missing:plan.shortfall.total});
  assert.equal(new Set(plan.questions.map(question=>question.id)).size,plan.actualCounts.total,current.id+': fixed flow has duplicated question');
  assert.ok(plan.questions.every(question=>question.pipeline.origin==='current'||question.pipeline.sourceLesson.book<current.book||question.pipeline.sourceLesson.book===current.book&&question.pipeline.sourceLesson.number<current.number),current.id+': future review source');
 }
 t.diagnostic(JSON.stringify(report));
});

test('browser module is a pure entry point with no document or asynchronous loader',()=>{
 assert.ok(fs.existsSync(target));const scope={window:{}};vm.runInNewContext(fs.readFileSync(target,'utf8'),scope);
 assert.equal(typeof scope.window.StudyPipelineQuestions.forLesson,'function');
 assert.equal(scope.window.StudyPipelineQuestions.forLesson(lesson({paragraphs:[]})).length,0);
});
