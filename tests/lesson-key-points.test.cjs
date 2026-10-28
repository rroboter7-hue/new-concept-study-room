'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),filename=path.join(root,'lesson-key-points.js');
const api=fs.existsSync(filename)?require(filename):{};
function summarize(lesson,options){assert.equal(typeof api.forLesson,'function','forLesson must produce source-backed lesson points');return api.forLesson(lesson,options);}
const fixture=()=>({id:'current',book:2,number:22,title:'A letter',paragraphs:[{en:'Jane received a letter. She is happy.'}],grammar:[{title:'一般过去时',note:'过去发生的动作使用过去式。注意 did 后用动词原形。',example:'Jane received a letter.'}],vocabulary:[{word:'letter',meaning:'信',example:'Jane received a letter.'},{word:'happy',meaning:'高兴的',example:'She is happy.'}],usage:[{phrase:'receive a letter',meaning:'收到一封信',note:'receive 后接收到的事物。',example:'Jane received a letter.',sourceLabel:'本课正文用法'}]});

test('collects three to five short points with complete local examples and honest provenance',()=>{
 const result=summarize(fixture());
 assert.ok(result.items.length>=1&&result.items.length<=5);
 assert.ok(result.items.every(item=>['grammar','usage'].includes(item.category)));
 assert.ok(result.items.some(item=>item.category==='grammar'&&item.summary==='过去发生的动作使用过去式。'));
 assert.ok(result.items.some(item=>item.category==='usage'));
 assert.ok(result.items.every(item=>item.sourceLessonId==='current'&&item.sourceLabel));
 assert.equal(result.items[0].example,'Jane received a letter.');
 assert.match(result.notice,/根据本课已有教材与校对笔记整理/);
 assert.match(result.notice,/非实时在线\s*AI/);
});

test('verified grammar notes take priority while their notes example keeps its exact source label',()=>{
 const reviewed=[{lessonId:'current',title:'介词后用动名词',note:'介词 of 后接动名词。',example:'She dreamed of taking part in the play.',sourceLabel:'校对笔记中文整理',exampleSourceLabel:'本课学习笔记例句（非教材正文）',sourcePage:104}];
 const result=summarize(fixture(),{reviewedGrammar:reviewed});
 assert.equal(result.items[0].title,'介词后用动名词');
 assert.equal(result.items[0].example,'She dreamed of taking part in the play.');
 assert.equal(result.items[0].exampleSourceLabel,'本课学习笔记例句（非教材正文）');
 assert.equal(result.items[0].sourceReference.page,104);
});

test('keeps the full original note in details and never cuts a rule or English sentence midstream',()=>{
 const lesson=fixture(),note='只有在这个条件已经满足而且另一个条件也成立时才可以使用这个形式'.repeat(12)+'。';
 lesson.grammar=[{title:'条件限制',note,example:'Jane received a letter.'}];
 const result=summarize(lesson),point=result.items.find(item=>item.title==='条件限制');
 assert.equal(point.details,note);
 assert.equal(point.summary,'条件限制');
 assert.equal(point.example,'Jane received a letter.');
 assert.ok(!point.summary.endsWith('…'));
});

test('filters cross-lesson and reading comprehension questions rather than labeling them as grammar',()=>{
 const lesson=fixture();lesson.grammar=[];
 const result=summarize(lesson,{reviewedGrammar:[{lessonId:'foreign',title:'外课笔记',note:'外课规则。',example:'Foreign sentence.'}],questions:[
  {type:'grammar',graded:true,lessonId:'foreign',sourceLessonId:'foreign',rule:'FOREIGN RULE',evidence:{sourceSentence:'Foreign sentence.'}},
  {type:'grammar',graded:true,sourceLessonId:'current',category:'reading-comprehension',rule:'READING ANSWER',question:'Why did Jane receive a letter?',evidence:{sourceSentence:'Jane received a letter.'}},
  {type:'grammar',graded:true,sourceLessonId:'current',rule:'一般过去时用动词过去式。',evidence:{sourceSentence:'Jane received a letter.'},sourceLabel:'校对练习'},
  {type:'vocabulary',sourceLessonId:'current',rule:'VOCAB QUESTION'}
 ]});
 assert.ok(result.items.some(item=>item.summary==='一般过去时用动词过去式。'&&item.category==='grammar'));
 assert.ok(!JSON.stringify(result.items).includes('FOREIGN RULE'));
 assert.ok(!JSON.stringify(result.items).includes('READING ANSWER'));
 assert.ok(!JSON.stringify(result.items).includes('外课笔记'));
});

test('uses existing expression notes for advanced lessons without inventing grammar or new examples',()=>{
 const lesson={id:'advanced',book:4,number:1,title:'Advanced',paragraphs:[{en:'We can read of old things.'}],grammar:[],vocabulary:[],usage:[
  {phrase:'read of',meaning:'读到',note:'后接所读到的事物。',example:'We can read of old things.'},
  {phrase:'hand down',meaning:'传下',note:'常见于被动结构。',example:'Stories are handed down.'},
  {phrase:'learn to',meaning:'学会',note:'后接动词原形。',example:'People learned to write.'}
 ]};
 const result=summarize(lesson);
 assert.equal(result.items.length,3);
 assert.ok(result.items.every(item=>item.category==='usage'));
 assert.deepEqual(result.items.map(item=>item.example),lesson.usage.map(item=>item.example));
});

test('an attribution-only usage note does not replace the actual phrase meaning in a key point',()=>{
 const lesson=fixture();lesson.usage[0].note='整理说明，非原PDF译文';
 const point=summarize(lesson).items.find(item=>item.category==='usage');
 assert.equal(point.summary,'收到一封信');
 assert.equal(point.details,'整理说明，非原PDF译文');
});

test('current passage expressions and existing passage-backed grammar examples precede note extensions',()=>{
 const lesson=fixture();lesson.grammar[0].example='A note-only sentence.';lesson.grammar[0].supportingExamples=['She is happy.'];
 lesson.usage=[
  {phrase:'turn round',meaning:'转身',note:'笔记复习表达。',example:'He turned round.',sourceType:'lesson-notes'},
  {phrase:'have a conversation',meaning:'交谈',note:'笔记扩展。',example:'We have a conversation.',sourceType:'lesson-notes'},
  {phrase:'receive a letter',meaning:'收到一封信',note:'本课正文表达。',example:'Jane received a letter.',sourceType:'lesson-passage'},
  {phrase:'be happy',meaning:'高兴',note:'本课正文表达。',example:'She is happy.',sourceType:'lesson-passage'}
 ];
 const before=JSON.stringify(lesson),result=summarize(lesson);
 assert.deepEqual(result.items.filter(item=>item.category==='usage').slice(0,2).map(item=>item.title),['receive a letter','be happy']);
 assert.equal(result.items[0].example,'She is happy.');
 assert.match(result.items[0].exampleSourceLabel,/本课教材正文/);
 assert.equal(JSON.stringify(lesson),before);
});

test('returns complete vocabulary and usage without mutating or silently truncating supplied lesson data',()=>{
 const lesson=fixture();lesson.vocabulary=Array.from({length:150},(_,i)=>({word:'word'+i,meaning:'词义'+i}));
 const before=JSON.stringify(lesson),result=summarize(lesson);
 assert.equal(result.vocabulary.length,150);
 assert.equal(result.usage.length,1);
 assert.equal(JSON.stringify(lesson),before);
 result.vocabulary[0].meaning='changed';
 assert.equal(lesson.vocabulary[0].meaning,'词义0');
});

test('real public data yields source-scoped, nonempty points and at least one existing English example for all 276 lessons',()=>{
 const scope={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};
 scope.window=scope;vm.createContext(scope);
 for(const match of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),scope,{filename:name});
  if(name==='book34-language-support.js')break;
 }
 const lessons=scope.LESSONS.filter(lesson=>!lesson.audioOnly);assert.equal(lessons.length,276);
 for(const lesson of lessons){
  const reviewed=scope.StudyReviewedUsage.grammarNotesFor(lesson),questions=scope.StudyKnowledge.bank.hasLesson(lesson.id)?scope.StudyKnowledge.bank.questionsForLesson(lesson.id):lesson.quiz;
  const before=JSON.stringify(lesson),result=summarize(lesson,{reviewedGrammar:reviewed,questions});
  assert.ok(result.items.length<=5,lesson.id+': at most five points');
  assert.ok(result.items.every(item=>['grammar','usage'].includes(item.category)),lesson.id+': current grammar and usage only');
  assert.ok(result.items.every(item=>item.sourceLessonId===lesson.id&&item.title&&item.summary&&item.sourceLabel),lesson.id+': source scope');
  const corpus=JSON.stringify([lesson,reviewed,questions]);
  assert.ok(result.items.some(item=>item.example&&/[A-Za-z]/.test(item.example)),lesson.id+': existing English example');
  for(const item of result.items)if(item.example)assert.ok(corpus.includes(JSON.stringify(item.example).slice(1,-1)),lesson.id+': example must already exist');
  assert.equal(JSON.stringify(lesson),before,lesson.id+': source must remain unchanged');
 }
});

test('browser entry point exposes the local module without DOM or network access',()=>{
 assert.ok(fs.existsSync(filename));const scope={window:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8'),scope);
 assert.equal(typeof scope.window.StudyLessonKeyPoints.forLesson,'function');
 assert.match(scope.window.StudyLessonKeyPoints.forLesson(fixture()).notice,/非实时在线\s*AI/);
});

test('separates current lesson grammar and optional usages while retaining compatible items',()=>{
 const result=summarize(fixture());
 assert.deepEqual(result.grammar.map(item=>item.title),['一般过去时']);
 assert.deepEqual(result.usages.map(item=>item.title),['receive a letter']);
 assert.deepEqual(result.items,[...result.grammar,...result.usages]);
});

test('pitfalls quote explicit current grammar cautions and preserve their source',()=>{
 const result=summarize(fixture());
 assert.equal(result.pitfalls.length,1);
 assert.match(result.pitfalls[0].text,/did 后用动词原形/);
 assert.equal(result.pitfalls[0].sourceLessonId,'current');
 assert.equal(result.pitfalls[0].sourceLabel,result.grammar[0].sourceLabel);
});

test('does not invent an error warning when current rules give no caution',()=>{
 const lesson=fixture();lesson.grammar=[{title:'一般过去时',note:'过去发生的动作使用过去式。',example:'Jane received a letter.'}];
 assert.deepEqual(summarize(lesson).pitfalls,[]);
});

test('cross-lesson and reading notes cannot create pitfall warnings',()=>{
 const lesson=fixture();lesson.grammar=[];lesson.usage=[];
 const result=summarize(lesson,{reviewedGrammar:[
  {lessonId:'old',title:'一般现在时',note:'注意第三人称单数。'},
  {lessonId:'current',category:'reading-comprehension',title:'阅读理解',note:'注意文章细节。'}
 ]});
 assert.deepEqual(result.pitfalls,[]);
});

test('present simple and present continuous cautions come from their own current notes',()=>{
 for(const [title,note,expected] of [
  ['一般现在时','第三人称单数主语后，动词通常加 s。注意 does 后用动词原形。','注意 does 后用动词原形。'],
  ['现在进行时','现在进行时使用 be 加现在分词。注意不要漏掉 be 动词。','注意不要漏掉 be 动词。']
 ]){
  const lesson=fixture();lesson.grammar=[{title,note,example:'She is happy.'}];lesson.usage=[];
  const result=summarize(lesson);
  assert.equal(result.grammar[0].title,title);
  assert.deepEqual(result.pitfalls.map(item=>item.text),[expected]);
 }
});

test('sparse imported lesson returns only available source points',()=>{
 const sparse={id:'sparse',book:2,number:1,title:'Sparse',paragraphs:[],grammar:[],usage:[],vocabulary:[]};
 const result=summarize(sparse,{reviewedGrammar:[],questions:[]});
 assert.deepEqual(result.items,[]);
 assert.deepEqual(result.grammar,[]);
 assert.deepEqual(result.usages,[]);
 assert.deepEqual(result.pitfalls,[]);
});
