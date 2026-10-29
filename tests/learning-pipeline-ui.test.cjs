const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../learning-pipeline.js');
const {harness}=require('./support/app-harness.cjs');
let LearningPipeline;if(fs.existsSync(file))LearningPipeline=require(file);
const lessons=[{id:'old',book:1,number:1,title:'Earlier',paragraphs:[{en:'A book.',zh:'一本书。'}],vocabulary:[{word:'book',meaning:'书'}],usage:[{phrase:'look at',meaning:'看'}]},{id:'now',book:1,number:3,title:'Today <script>',paragraphs:[{en:'She is here.',zh:'她在这里。'}],vocabulary:[{word:'here',meaning:'这里'}],usage:[{phrase:'on time',meaning:'准时'}]}];
const questions=id=>Array.from({length:12},(_,i)=>({id:id+'-q'+i,type:'grammar',graded:true,question:'She ___ here. '+i,options:['is','are'],answer:0,rule:'单数主语用 is。',explanation:'She is here.',sourceLabel:'已有教材语法题',origin:{page:3}}));
function setup(extra={}){
 assert.equal(typeof LearningPipeline,'function','LearningPipeline must be exported');
 let state=extra.state||{},fail=false;const writes=[],handlers={},nodes={'[data-pipeline-reading]':{}},calls=[];
 const container={innerHTML:'',scrollTop:0,addEventListener:(event,fn)=>handlers[event]=fn,removeEventListener:(event,fn)=>{if(handlers[event]===fn)delete handlers[event];},contains:()=>true,querySelector:selector=>nodes[selector]||null};
 const ui=new LearningPipeline({getLesson:()=>lessons[1],getLessons:()=>lessons,getRecords:()=>({old:{completed:true}}),getState:()=>state,saveState:async next=>{if(fail)return false;state=structuredClone(next);writes.push(state);return true;},questionsForLesson:questions,getFreeDrafts:()=>({}),saveFreeDraft:()=>true,getWritingTargets:()=>({words:[{word:'here'}],phrases:[{phrase:'on time'}]}),renderReading:()=>'<p class="existing-reading">Original reading</p>',mountReading:()=>calls.push('mount-reading'),stopReading:()=>calls.push('stop-reading'),getKeyPoints:()=>({items:[{category:'grammar',title:'主谓搭配',summary:'单数主语用 is。',example:'She is here.',sourceLabel:'本课教材',details:'已有资料'}],notice:'本地整理，非实时在线 AI。'}),onShelf:()=>calls.push('shelf'),onSelectLesson:id=>calls.push('lesson:'+id),...extra});
 return {ui,container,handlers,nodes,calls,writes,getState:()=>state,setExternal:value=>state=value,setFailure:value=>{fail=value;}};
}

test('reading stage shows only the current task with optional reading and a six-step strip',async()=>{
 const h=setup();h.ui.mount(h.container);await h.ui.setLesson(lessons[1],{resume:true});
 const html=h.ui.render();
 assert.match(html,/Original reading/);assert.match(html,/开始选择题/);assert.match(html,/本课音频/);
 assert.equal((html.match(/data-pipeline-stage=/g)||[]).length,6);
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
 const h=setup();await h.ui.setLesson(lessons[1],{resume:true});await h.ui.goStage(5);
 const html=h.ui.render();assert.match(html,/She is here\./);assert.match(html,/本课教材/);assert.match(html,/非实时在线 AI/);
 await h.ui.finish();assert(h.calls.includes('shelf'));
});

test('retelling support is source-backed in a collapsed disclosure above the writing area',async()=>{
 const h=setup({getRetellSupport:()=>({sections:[{meaning:'她到了。'},{meaning:''}],characters:[{name:'Mary',role:'学生'}],words:[{word:'arrive',meaning:'到达'}],usages:[{phrase:'on time',meaning:'准时'}],notice:'部分段落暂无译文。'})});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);
 const html=h.ui.render();assert.match(html,/data-pipeline-retell/);assert.match(html,/lang="en"/);
 assert.ok(html.indexOf('查看课文复述提示')<html.indexOf('data-pipeline-retell'));
 assert.match(html,/<details class="pipeline-disclosure pipeline-retell-support"><summary>/);
 assert.match(html,/Mary/);assert.match(html,/学生/);assert.match(html,/arrive/);assert.match(html,/on time/);assert.match(html,/暂无已核对的中文译文/);
 assert.match(html,/data-stage="5"/);
});

test('retelling autosaves exact long paragraphs without repainting the active textarea and survives reload',async()=>{
 const h=setup();h.ui.mount(h.container);await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);
 const before=h.container.innerHTML,retell='First paragraph.\n\n'+('Second paragraph. '.repeat(1000));
 h.ui.setRetellText(retell);assert.equal(await h.ui.flush(),true);
 assert.equal(h.container.innerHTML,before);assert.equal(h.getState().lessons.now.retellText,retell);
 const restored=setup({state:h.getState()});await restored.ui.setLesson(lessons[1]);
 assert.equal(restored.ui.record().stage,4);assert.match(restored.ui.render(),/First paragraph\.\n\nSecond paragraph\./);
});

test('failed retelling save retains the draft in memory until retry',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);h.setFailure(true);h.ui.setRetellText('<keep>\n\nexact');
 assert.equal(await h.ui.flush(),false);assert.equal(h.ui.record().retellText,'<keep>\n\nexact');assert.match(h.ui.render(),/保存失败/);
 h.setFailure(false);assert.equal(await h.ui.flush(),true);assert.equal(h.getState().lessons.now.retellText,'<keep>\n\nexact');
});

test('retelling copy sends only exact learner text with paragraph breaks and gives a selectable failure fallback',async()=>{
 let copied;const h=setup({copyText:async value=>{copied=value;throw Error('denied');},getRetellSupport:()=>({notice:'Chinese support',sections:[{meaning:'中文'}]})});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);h.ui.setRetellText('I arrived.\n\nShe waited.  ');
 assert.equal(await h.ui.copyRetell(),false);assert.equal(copied,'I arrived.\n\nShe waited.  ');
 const html=h.ui.render();assert.match(html,/data-pipeline-retell-copy-fallback/);assert.match(html,/I arrived\.\n\nShe waited\.  /);
});

test('retelling copy does not expose a failed old lesson clipboard request after navigation',async()=>{
 let rejectCopy;const h=setup({copyText:()=>new Promise((_,reject)=>rejectCopy=reject)});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);h.ui.setRetellText('Private lesson text.');await h.ui.flush();
 const copying=h.ui.copyRetell();await h.ui.setLesson(lessons[0]);rejectCopy(Error('denied'));assert.equal(await copying,false);
 await h.ui.goStage(4);assert.doesNotMatch(h.ui.render(),/Private lesson text|data-pipeline-retell-copy-fallback/);
});

test('retelling copy failure does not replace a newer draft with a stale fallback',async()=>{
 let rejectCopy;const h=setup({copyText:()=>new Promise((_,reject)=>rejectCopy=reject)});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);h.ui.setRetellText('Earlier draft.');
 const copying=h.ui.copyRetell();h.ui.setRetellText('Newest draft.');rejectCopy(Error('denied'));
 assert.equal(await copying,false);assert.equal(h.ui.record().retellText,'Newest draft.');
 assert.doesNotMatch(h.ui.render(),/data-pipeline-retell-copy-fallback/);
});

test('editing after failed retelling copy hides the visible old fallback without replacing the focused textarea',async()=>{
 const lessonId='nce-b2-eef57c-l002',h=await harness({realPipeline:true,pilot:false,realOutput:true,loaded:{lastLesson:lessonId}});
 await h.api.selectLesson(lessonId);const ui=h.api.learningPipeline;await ui.goStage(4);
 let input=h.document.querySelector('[data-pipeline-retell]');assert(input);
 await h.input(input,'First draft.');h.c.navigator.clipboard={writeText:async()=>{throw Error('denied');}};
 assert.equal(await ui.copyRetell(),false);
 const fallback=h.document.querySelector('[data-pipeline-retell-copy-fallback]');assert(fallback);
 assert.equal(fallback.value,'First draft.');assert.equal(fallback.closest('label').hasAttribute('hidden'),false);
 input=h.document.querySelector('[data-pipeline-retell]');assert(input);input.focus();input.selectionStart=5;input.selectionEnd=5;
 await h.input(input,'Second full draft.');
 assert.equal(h.stored.learningPipeline.lessons[lessonId].retellText,'Second full draft.');
 assert.equal(h.document.querySelector('[data-pipeline-retell]'),input);
 assert.equal(h.document.activeElement,input);assert.equal(input.selectionStart,5);assert.equal(input.selectionEnd,5);
 assert.equal(fallback.closest('label').hasAttribute('hidden'),true,'obsolete manual-copy text is no longer visible');
});

test('legacy retelling is imported only on explicit action into an empty new draft',async()=>{
 const h=setup({getLegacyRetell:()=> 'Legacy words.'});await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);
 assert.equal(h.ui.record().retellText,'');assert.match(h.ui.render(),/导入旧版复述/);
 assert.equal(await h.ui.importLegacyRetell(),true);assert.equal(h.ui.record().retellText,'Legacy words.');
 h.ui.setRetellText('My new words.');assert.equal(await h.ui.importLegacyRetell(),false);assert.equal(h.ui.record().retellText,'My new words.');
});

test('sentence copy resolves display labels from pure writing targets without changing stored target identities',async()=>{
 const h=setup({getWritingTargets:()=>({words:[{word:'ring',storageLabel:'rang',storageSourceId:'now',meaning:'响'}],phrases:[],priorWords:[{word:'book',source:lessons[0],meaning:'书'}]}),getFreeDrafts:()=>({d:{lessonId:'now',targets:{'word:now:rang':{answers:['The bell rang.']},'word:old:book':{answers:['The book is here.']}}}}),copyText:async()=>true});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(3);
 const rows=h.ui.sentences();assert.equal(rows.find(row=>row.target==='word:now:rang').targetLabel,'ring');
 assert.equal(rows.find(row=>row.target==='word:old:book').targetLabel,'book');
 assert.equal(rows.find(row=>row.target==='word:now:rang').target,'word:now:rang');
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

test('quiz feedback teaches the full supported continuous structure and collapses audit details',async()=>{
 const h=setup({questionsForLesson:id=>[{...questions(id)[0],question:'【自编语法审核】She is ___ a book.',options:['reading','read'],answer:0,rule:'用现在进行时。',explanation:'本题空格填 reading。',wrongReasons:{read:'需要现在分词。'}}]});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(1);h.ui.chooseAnswer(1);await h.ui.checkAnswer();
 const html=h.ui.render();assert.doesNotMatch(html,/<h3>【自编/);assert.match(html,/你的选择：read/);assert.match(html,/is reading/);assert.match(html,/<details[^>]*><summary>完整讲解与来源/);assert.match(html,/需要现在分词/);
});
test('current-action be blanks teach full positive and negative progressive despite generic be metadata',()=>{
 const h=setup();
 for(const [stem,phrase]of [['【自编语法审核】选择现在的 be 形式（当前正在进行的动作）：Right now, she ___ not watching a play.','is not watching'],['当前正在进行的动作：Right now, she ___ watching a play.','is watching']]){
  const question={question:stem,options:['is','was'],answer:0,rule:'一般现在时中，第三人称单数主语使用 is。',explanation:'一般现在时的 be 随主语变化。',conceptId:'be-present'};
  const before=JSON.stringify(question),rule=h.ui.shortRule(question),feedback=h.ui.feedbackHTML(question,'was');
  assert.match(rule,/现在进行时/);assert.ok(rule.includes(phrase));assert.equal(JSON.stringify(question),before);
  assert.match(feedback,/<summary>完整讲解与来源<\/summary><p>一般现在时的 be 随主语变化。/);
 }
});
test('progressive summary does not misclassify adjective, noun predicates or future arrangements as ongoing actions',()=>{
 const h=setup();
 for(const question of [
  {question:'Right now, the story ___ interesting.',options:['is','are'],answer:0,rule:'形容词 interesting 作表语。'},
  {question:'Right now, she ___ a nurse.',options:['is','are'],answer:0,rule:'名词 a nurse 作表语。'},
  {question:'She ___ travelling next weekend.',options:['is','are'],answer:0,rule:'此处表示已安排的将来活动。'}
 ])assert.equal(h.ui.shortRule(question),question.rule);
});
test('recap copy affordance describes manual clipboard use and labels legacy output kinds',async()=>{
 const h=setup({getSentences:()=>[{answer:'A dictation.',source:'outputDrafts',kind:'dictation'},{answer:'A retelling.',source:'outputDrafts',kind:'retell'}]});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(3);const html=h.ui.render();
 assert.match(html,/复制本课全部句子/);assert.match(html,/含旧版草稿，复制后手动粘贴到豆包/);assert.match(html,/本课造句与旧稿/);
});
test('recap retry returns to the original saved quiz question and rejects a stale replaced round',async()=>{
 const h=setup();await h.ui.setLesson(lessons[1]);await h.ui.goStage(1);h.ui.chooseAnswer(1);await h.ui.checkAnswer();const q=h.ui.question();
 await h.ui.goStage(3);const binding=h.ui.recapBinding(q);assert.match(h.ui.render(),/data-pipeline-action="recap-retry"/);
 assert.equal(await h.ui.retryFromRecap(binding),true);assert.equal(h.ui.record().stage,1);assert.equal(h.ui.question().id,q.id);assert.equal(h.ui.record().quiz.submitted,false);assert.equal(h.ui.record().attempts.length,1);
 await h.ui.goStage(3);const external=structuredClone(h.getState());external.lessons.now.round++;h.setExternal(external);assert.equal(await h.ui.retryFromRecap(binding),false);
});
test('manual copy includes all lesson drafts and leaves a full selectable fallback on clipboard failure',async()=>{
 const h=setup({getFreeDrafts:()=>({d:{lessonId:'now',targets:{t:{answers:['Free.']}}}}),getSentences:()=>[{answer:'Legacy.',source:'sentencePractice',sourceId:'legacy'}],copyText:async()=>{throw Error('denied');}});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(3);assert.equal(await h.ui.copySentences(),false);
 const html=h.ui.render();assert.match(html,/data-pipeline-copy-fallback/);assert.match(html,/Free\./);assert.match(html,/Legacy\./);assert.match(html,/readonly/);assert.match(html,/人工复核|人工完整复核/);
});
test('recap correction selects its writing target and recall is grounded in this lesson grammar',async()=>{
 const lesson={...lessons[1],grammar:[{title:'现在进行时',explanation:'be + V-ing'}]},selected=[];
 class Writer{flush(){return true;}unmount(){}selectTarget(key){selected.push(key);return true;}}
 const h=setup({getLesson:()=>lesson,FreeWritingPractice:Writer});await h.ui.setLesson(lesson);await h.ui.goStage(3);
 assert.match(h.ui.render(),/现在进行时/);assert.match(h.ui.render(),/回忆|回想/);
 assert.equal(await h.ui.correctSentence('word:now:here'),true);assert.deepEqual(selected,['word:now:here']);assert.equal(h.ui.record().stage,2);
});
test('an asynchronous copy failure cannot expose the previous lesson draft in the next lesson',async()=>{
 let rejectCopy;
 const h=setup({getSentences:()=>[{answer:'Private to this lesson.'}],copyText:()=>new Promise((_,reject)=>rejectCopy=reject)});
 await h.ui.setLesson(lessons[1]);await h.ui.goStage(3);const copying=h.ui.copySentences();await h.ui.setLesson(lessons[0]);rejectCopy(Error('denied'));await copying;
 assert.doesNotMatch(h.ui.render(),/Private to this lesson\.|data-pipeline-copy-fallback/);await h.ui.goStage(3);assert.doesNotMatch(h.ui.render(),/data-pipeline-copy-fallback/);
});
test('an archived recap question has an independent retry without replacing the current saved quiz',async()=>{
 const h=setup({questionsForLesson:id=>Array.from({length:24},(_,i)=>({...questions(id)[0],id:id+'-q'+i}))});await h.ui.setLesson(lessons[1]);await h.ui.goStage(1);h.ui.chooseAnswer(1);await h.ui.checkAnswer();const question=h.ui.question();
 await h.ui.newQuizRound();await h.ui.goStage(3);const savedQuiz=JSON.stringify(h.ui.record().quiz),binding=h.ui.recapBinding(question);
 assert.equal(await h.ui.retryFromRecap(binding),true);assert.equal(h.ui.record().stage,3);assert.match(h.ui.render(),/data-pipeline-action="recap-answer"/);
 assert.equal(h.ui.chooseRecapAnswer(0,binding),true);assert.equal(await h.ui.checkRecapPractice(binding),true);
 assert.equal(JSON.stringify(h.ui.record().quiz),savedQuiz);assert.equal(h.ui.record().mistakes[question.id].history.length,2);assert.equal(h.ui.record().mistakes[question.id].lastCorrect,true);
 assert.equal(await h.ui.checkRecapPractice(binding),false);
});
test('a stale archived recap check cannot write into another round or create attempt history',async()=>{
 const h=setup({questionsForLesson:id=>Array.from({length:24},(_,i)=>({...questions(id)[0],id:id+'-q'+i}))});await h.ui.setLesson(lessons[1]);await h.ui.goStage(1);h.ui.chooseAnswer(1);await h.ui.checkAnswer();const question=h.ui.question();
 await h.ui.newQuizRound();await h.ui.goStage(3);const binding=h.ui.recapBinding(question);await h.ui.retryFromRecap(binding);h.ui.chooseRecapAnswer(0,binding);await h.ui.flush();
 const external=structuredClone(h.getState());external.lessons.now.round++;h.setExternal(external);
 assert.equal(await h.ui.checkRecapPractice(binding),false);assert.equal(h.ui.record().attempts.length,1);
});
test('retelling uses verified scenes and independent hint groups without exposing reference English in the editor',async()=>{
 const h=setup({getRetellSupport:()=>({scenes:[{meaning:'第一处场景',speaker:'旁白'},{meaning:'第二处场景',speaker:'Lucy'}],sections:[{meaning:'原始大段'}],participants:[{name:'I',role:'叙述者（我）'},{name:'Lucy',role:'姨妈'}],words:[{word:'ring',meaning:'响'}],usages:[{phrase:'next weekend',meaning:'下周末',sourceKindLabel:'课堂拓展'}]})});
 h.ui.mount(h.container);await h.ui.setLesson(lessons[1]);await h.ui.goStage(4);const html=h.ui.render();
 assert.match(html,/第一处场景/);assert.match(html,/第二处场景/);assert.doesNotMatch(html,/原始大段/);
 assert.match(html,/叙述者（我）/);assert.match(html,/课堂拓展/);assert.match(html,/pipeline-retell-workspace/);
 assert.match(html,/data-retell-hint="chinese"/);assert.match(html,/data-retell-hint="keywords"/);
 assert.match(html,/data-pipeline-retell[^>]*><\/textarea>/);
});
