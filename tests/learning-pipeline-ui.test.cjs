const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../learning-pipeline.js');
let LearningPipeline;if(fs.existsSync(file))LearningPipeline=require(file);
const lessons=[{id:'old',book:1,number:1,title:'Earlier',paragraphs:[{en:'A book.',zh:'一本书。'}],vocabulary:[{word:'book',meaning:'书'}],usage:[{phrase:'look at',meaning:'看'}]},{id:'now',book:1,number:3,title:'Today <script>',paragraphs:[{en:'She is here.',zh:'她在这里。'}],vocabulary:[{word:'here',meaning:'这里'}],usage:[{phrase:'on time',meaning:'准时'}]}];
const questions=id=>Array.from({length:12},(_,i)=>({id:id+'-q'+i,type:'grammar',graded:true,question:'She ___ here. '+i,options:['is','are'],answer:0,rule:'单数主语用 is。',explanation:'She is here.',sourceLabel:'已有教材语法题',origin:{page:3}}));
function setup(extra={}){
 assert.equal(typeof LearningPipeline,'function','LearningPipeline must be exported');
 let state=extra.state||{},fail=false;const writes=[],handlers={},nodes={'[data-pipeline-reading]':{}},calls=[];
 const container={innerHTML:'',scrollTop:0,addEventListener:(event,fn)=>handlers[event]=fn,removeEventListener:(event,fn)=>{if(handlers[event]===fn)delete handlers[event];},contains:()=>true,querySelector:selector=>nodes[selector]||null};
 const ui=new LearningPipeline({getLesson:()=>lessons[1],getLessons:()=>lessons,getRecords:()=>({old:{completed:true}}),getState:()=>state,saveState:async next=>{if(fail)return false;state=structuredClone(next);writes.push(state);return true;},questionsForLesson:questions,getFreeDrafts:()=>({}),saveFreeDraft:()=>true,getWritingTargets:()=>({words:[{word:'here'}],phrases:[{phrase:'on time'}]}),renderReading:()=>'<p class="existing-reading">Original reading</p>',mountReading:()=>calls.push('mount-reading'),stopReading:()=>calls.push('stop-reading'),getKeyPoints:()=>({items:[{title:'主谓搭配',summary:'单数主语用 is。',example:'She is here.',sourceLabel:'本课教材',details:'已有资料'}],notice:'本地整理，非实时在线 AI。'}),onShelf:()=>calls.push('shelf'),onSelectLesson:id=>calls.push('lesson:'+id),...extra});
 return {ui,container,handlers,nodes,calls,writes,getState:()=>state,setExternal:value=>state=value,setFailure:value=>{fail=value;}};
}

test('reading stage shows only the current task with optional reading and a five-step strip',async()=>{
 const h=setup();h.ui.mount(h.container);await h.ui.setLesson(lessons[1],{resume:true});
 const html=h.ui.render();
 assert.match(html,/Original reading/);assert.match(html,/开始选择题/);assert.match(html,/本课音频/);
 assert.equal((html.match(/data-pipeline-stage=/g)||[]).length,5);
 assert.doesNotMatch(html,/data-pipeline-answer|data-free-answer|data-pipeline-recap/);
 assert.match(html,/Today &lt;script&gt;/);assert.equal(h.calls.filter(x=>x==='mount-reading').length>=1,true);
 h.ui.destroy();assert.deepEqual(h.handlers,{});
});

test('quiz creates seven current and three review questions and keeps the snapshot across renders',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);
 const first=h.ui.record().quiz.questions.map(q=>q.id);assert.equal(first.length,10);
 assert.equal(h.ui.record().quiz.plan.actualCounts.current,7);assert.equal(h.ui.record().quiz.plan.actualCounts.review,3);
 h.ui.render();h.ui.render();await h.ui.setLesson(lessons[1],{resume:true});
 assert.deepEqual(h.ui.record().quiz.questions.map(q=>q.id),first);
 await h.ui.newQuizRound();assert.notDeepEqual(h.ui.record().quiz.questions.map(q=>q.id),first);
});

test('each real check is captured once, an explicit retry adds a new attempt and a later correct answer retains mistakes',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);
 h.ui.chooseAnswer(1);await Promise.all([h.ui.checkAnswer(),h.ui.checkAnswer()]);
 assert.equal(h.ui.record().attempts.length,1);assert.equal(h.ui.record().quiz.submitted,true);
 const id=h.ui.record().quiz.questions[0].id;assert.equal(h.ui.record().mistakes[id].consecutiveWrong,1);
 assert.match(h.ui.render(),/单数主语用 is|She is here/);assert.match(h.ui.render(),/已有教材语法题/);
 await h.ui.retryQuestion();h.ui.chooseAnswer(0);await h.ui.checkAnswer();
 assert.equal(h.ui.record().attempts.length,2);assert.equal(h.ui.record().mistakes[id].consecutiveWrong,0);assert.equal(h.ui.record().mistakes[id].history.length,2);
 assert.doesNotMatch(h.ui.render(),/已掌握|得分|100%/);
});

test('resume restores stage, question index, selected answer and checked state',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);h.ui.chooseAnswer(0);await h.ui.checkAnswer();await h.ui.nextQuestion();h.ui.chooseAnswer(1);await h.ui.checkAnswer();
 const restored=setup({state:h.getState()});await restored.ui.setLesson(lessons[1],{resume:true});
 assert.equal(restored.ui.record().stage,1);assert.equal(restored.ui.record().quiz.index,1);assert.equal(restored.ui.record().quiz.submitted,true);
 assert.equal(restored.ui.record().quiz.answers['now-q1'],1);
});

test('short question banks report actual counts and never duplicate unavailable slots',async()=>{
 const h=setup({questionsForLesson:id=>questions(id).slice(0,id==='now'?2:1)});await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);
 assert.equal(h.ui.record().quiz.questions.length,3);assert.match(h.ui.render(),/实际 3|本次 3/);assert.match(h.ui.render(),/不足|尚缺/);
});

test('changes merge into the latest state without deleting another lesson or its drafts',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});h.setExternal({...h.getState(),lessons:{...h.getState().lessons,other:{stage:3,recapText:'Do not delete'}}});
 h.ui.setRecapText('My review');await h.ui.flush();
 assert.equal(h.getState().lessons.other.recapText,'Do not delete');assert.equal(h.getState().lessons.now.recapText,'My review');
});

test('failed async saves retain recap text, show failure and succeed on explicit retry',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(3);h.setFailure(true);h.ui.setRecapText('<b>keep my review</b>');
 assert.equal(await h.ui.flush(),false);assert.match(h.ui.render(),/保存失败/);assert.match(h.ui.render(),/&lt;b&gt;keep my review&lt;\/b&gt;/);
 h.setFailure(false);assert.equal(await h.ui.flush(),true);assert.equal(h.getState().lessons.now.recapText,'<b>keep my review</b>');
});

test('recap includes automatic error history, all saved sentences and source material in focused disclosures',async()=>{
 const h=setup({getFreeDrafts:()=>({d:{version:1,lessonId:'now',targets:{archived:{answers:['A saved sentence.','<img src=x>']}}}})});
 await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);h.ui.chooseAnswer(1);await h.ui.checkAnswer();await h.ui.goStage(3);
 const html=h.ui.render();assert.match(html,/连错/);assert.match(html,/来源/);assert.match(html,/A saved sentence\./);assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/data-pipeline-recap/);
 assert.match(html,/<details[^>]*open/);assert.match(html,/本课词汇与用法/);
});

test('recap autosave does not replace the actively edited textarea',async()=>{
 const h=setup();h.ui.mount(h.container);await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(3);
 const before=h.container.innerHTML;h.ui.setRecapText('A new thought.');await h.ui.flush();assert.equal(h.container.innerHTML,before);
});

test('writing stage mounts the independent component and can advance before all sentences are written',async()=>{
 const h=setup();h.nodes['[data-pipeline-writing]']={innerHTML:'',addEventListener(){},removeEventListener(){},querySelector(){return null;}};
 h.ui.mount(h.container);await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(2);
 assert.match(h.nodes['[data-pipeline-writing]'].innerHTML,/data-free-answer/);assert.match(h.ui.render(),/进入复盘/);
 await h.ui.goStage(3);assert.equal(h.ui.record().stage,3);
});

test('key points show actual examples and sources without pretending they came from online AI',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(4);
 const html=h.ui.render();assert.match(html,/She is here\./);assert.match(html,/本课教材/);assert.match(html,/非实时在线 AI/);
 await h.ui.finish();assert(h.calls.includes('shelf'));
});

test('each stage restores its own scroll position and a new stage starts at the top',async()=>{
 const scrolls=[],win={scrollY:70,scrollTo:position=>scrolls.push(position.top),addEventListener(){},removeEventListener(){}};
 const h=setup({window:win});h.ui.mount(h.container);await h.ui.setLesson(lessons[1],{resume:true});
 h.container.scrollTop=500;await h.ui.goStage(1);await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(h.container.scrollTop,0);assert.equal(scrolls.at(-1),0);
 h.container.scrollTop=200;win.scrollY=90;await h.ui.goStage(0);await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(h.container.scrollTop,500);assert.equal(scrolls.at(-1),70);
 h.ui.destroy();
});

test('mounting again and destroying removes every container and window listener',()=>{
 const listeners=new Map(),win={scrollY:0,addEventListener:(name,fn)=>{const set=listeners.get(name)||new Set();set.add(fn);listeners.set(name,set);},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
 const h=setup({window:win});h.ui.mount(h.container);h.ui.mount(h.container);
 assert.equal(listeners.get('scroll').size,1);assert.equal(listeners.get('pagehide').size,1);
 h.ui.destroy();assert.equal(listeners.get('scroll').size,0);assert.equal(listeners.get('pagehide').size,0);assert.deepEqual(h.handlers,{});
});

test('edits made during an asynchronous save are saved afterward rather than overwritten',async()=>{
 let resolveSave,stored={},attempt=0;
 const h=setup({getState:()=>stored,saveState:async next=>{attempt++;if(attempt===2)await new Promise(resolve=>{resolveSave=resolve;});stored=structuredClone(next);return true;}});
 await h.ui.setLesson(lessons[1],{resume:true});h.ui.setRecapText('First thought.');const saving=h.ui.flush();await Promise.resolve();h.ui.setRecapText('Second thought.');resolveSave();
 assert.equal(await saving,true);assert.equal(stored.lessons.now.recapText,'Second thought.');
});

test('recap retains only current sentence feedback and separates concrete writing corrections from general review',async()=>{
 const answers=['I has a book.','I have a book.','My edited sentence.','I need a book.','I look on the book.'];
 const draft={version:1,lessonId:'now',targets:{'word:now:book':{answers,feedback:[
  {sentence:answers[0],issues:[{type:'tense',message:'主语搭配需核对 <unsafe>',original:'has',replacement:'have'}],reference:'I have a book.',reviewNeeded:['整句仍需复核。']},
  {sentence:answers[1],issues:[],reviewNeeded:['语义、自然度需复核。']},
  {sentence:'My stale sentence.',issues:[{type:'spelling',message:'Do not show stale feedback',replacement:'stale'}]},
  {sentence:answers[3],issues:[],incomplete:true,reviewNeeded:['搭配检查未完成。']},
  {sentence:answers[4],issues:[{type:'collocation',message:'融合用法 look at 需保留搭配。',original:'look on',replacement:'look at'}],reviewNeeded:[]}
 ]}}};
 const before=JSON.stringify(draft),h=setup({getFreeDrafts:()=>({saved:draft})});
 await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(3);
 const sentences=h.ui.sentences(),html=h.ui.render();
 assert.equal(sentences[0].feedback.issues[0].type,'tense');assert.equal(Boolean(sentences[2].feedback),false);
 assert.match(html,/造句待订正（3）/);assert.match(html,/时态|动词形式/);assert.match(html,/搭配/);assert.match(html,/look at/);assert.match(html,/局部修改参考/);assert.match(html,/整句仍需复核/);
 assert.match(html,/主语搭配需核对 &lt;unsafe&gt;/);assert.doesNotMatch(html,/Do not show stale feedback|<unsafe>/);
 assert.match(html,/自动整理的错题（0）/);assert.equal(h.ui.record().attempts.length,0);assert.equal(JSON.stringify(draft),before);
});

test('recap vocabulary and usage use actual current writing targets and exclude earlier practice items',async()=>{
 const h=setup({getWritingTargets:()=>({words:[{word:'focused',meaning:'实际练习的新词'}],phrases:[{phrase:'in focus',meaning:'实际练习的用法'}],priorWords:[{word:'earlier-only',meaning:'旧词',source:lessons[0]}],priorPhrases:[{phrase:'look at',meaning:'旧用法',source:lessons[0]}]})});
 await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(3);
 const section=h.ui.render().split('<summary>本课词汇与用法</summary>')[1].split('</details>')[0];
 assert.match(section,/>focused</);assert.match(section,/>in focus</);assert.match(section,/实际练习的新词/);
 assert.doesNotMatch(section,/>here<|>on time<|earlier-only|look at/);
});

test('a choice from an old rendered question cannot be written into a question advanced in another tab',async()=>{
 const notices=[],h=setup({toast:message=>notices.push(message)});await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);
 const oldQuestion=h.ui.question().id,external=structuredClone(h.getState());external.lessons.now.quiz.index=1;external.lessons.now.quiz.submitted=false;h.setExternal(external);
 assert.equal(h.ui.chooseAnswer(1),false);await h.ui.flush();
 assert.equal(h.ui.record().quiz.answers[oldQuestion],undefined);assert.equal(h.ui.record().quiz.answers['now-q1'],undefined);assert.equal(h.ui.record().attempts.length,0);
 assert.match(notices.join(' '),/更新|变化/);assert.equal(h.ui.question().id,'now-q1');
});

test('stale check, retry and next actions cannot change a new quiz round or create attempt history',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(1);h.ui.chooseAnswer(1);
 const expected={lessonId:'now',questionId:h.ui.question().id,round:0},external=structuredClone(h.getState());external.lessons.now.round=1;external.lessons.now.quiz.plan.round=1;h.setExternal(external);
 assert.equal(await h.ui.checkAnswer(expected),false);assert.equal(await h.ui.retryQuestion(expected),false);assert.equal(await h.ui.nextQuestion(expected),false);await h.ui.flush();
 assert.equal(h.ui.record().round,1);assert.equal(h.ui.record().quiz.index,0);assert.equal(h.ui.record().quiz.submitted,false);assert.equal(h.ui.record().attempts.length,0);assert.deepEqual(h.ui.record().mistakes,{});
});
