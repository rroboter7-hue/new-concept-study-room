const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const modulePath = path.resolve(__dirname, '../free-writing-practice.js');
let FreeWritingPractice;
try { FreeWritingPractice = require(modulePath); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }

const old = {id:'old',book:1,number:1,title:'Earlier',vocabulary:[{word:'walk',meaning:'步行'}],usage:[{phrase:'look at',meaning:'看'}]};
const lesson = {id:'now',book:1,number:3,title:'Today',vocabulary:[{word:'book',meaning:'书',isLessonNew:true}],usage:[{phrase:'on time',meaning:'准时'}]};
const future = {id:'later',book:1,number:5,title:'Later'};
const fixture = () => ({words:[{word:'book',meaning:'书'},{word:'Mr.',meaning:'先生'},{word:'Tom',isPersonName:true},{word:'known',isLessonNew:false}],phrases:[{phrase:'on time',meaning:'准时'}],priorWords:[{word:'walk',source:old,requiredCount:2},{word:'future',source:future}],priorPhrases:[{phrase:'look at',meaning:'看',source:old}]});
function setup(options = {}) {
  assert.equal(typeof FreeWritingPractice,'function','independent free writing component must be available');
  let current = lesson;
  const writes = [], drafts = {}, notices = [];
  const ui = new FreeWritingPractice({getLesson:()=>current,getLessons:()=>[old,lesson,future],getTargets:fixture,getDrafts:()=>drafts,saveDraft:(key,draft)=>{writes.push([key,structuredClone(draft)]);drafts[key]=structuredClone(draft);return true;},onStatus:s=>notices.push(s),...options});
  return {ui,writes,drafts,notices,setLesson:value=>{current=value;}};
}

test('gives every current word and usage five free rows and earlier learned targets one or two',()=>{
  const {ui}=setup(), targets=ui.targets();
  assert.deepEqual(targets.map(t=>[t.label,t.requiredCount]),[['book',5],['on time',5],['walk',2],['look at',1]]);
  assert.equal(targets.some(t=>/Mr|Tom|future|known/.test(t.label)),false);
  const html=ui.render();
  assert.equal((html.match(/data-free-answer="/g)||[]).length,5);
  assert.match(html,/句型自由，可融合学过的用法/);
  assert.doesNotMatch(html,/一般疑问句|特殊疑问句|第[一1]句改/);
  assert.equal((html.match(/class="button primary"/g)||[]).length,1);
});

test('saves independent free answers without reading or mutating legacy drafts',async()=>{
  const legacy={version:3,answers:{affirmative:'The old book is here.',negative:'It is not here.'}};
  const h=setup({getDrafts:()=>({legacy})}), target=h.ui.targets()[0];
  h.ui.editAnswer(target.key,0,'Is the book here?');
  h.ui.editAnswer(target.key,1,'Is that your book?');
  assert.equal(await h.ui.flush(),true);
  const [key,draft]=h.writes.at(-1);
  assert.equal(key,'free-writing:v1:now');
  assert.deepEqual(draft.targets[target.key].answers,['Is the book here?','Is that your book?','','','']);
  assert.deepEqual(legacy,{version:3,answers:{affirmative:'The old book is here.',negative:'It is not here.'}});
  assert.equal(draft.version,1);
});

test('failed asynchronous saving retains text and visibly reports failure until retry succeeds',async()=>{
  let failing=true;
  const {ui}=setup({saveDraft:async()=>{if(failing)throw new Error('Quota exceeded');return true;}}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'My book is here.');
  assert.equal(await ui.flush(),false);
  assert.match(ui.render(),/保存失败/);
  assert.match(ui.render(),/My book is here\./);
  failing=false;
  assert.equal(await ui.flush(),true);
  assert.match(ui.render(),/草稿已保存/);
});

test('serializes saves and persists edits made while an earlier asynchronous save is pending',async()=>{
  let release;
  const snapshots=[];
  const {ui}=setup({saveDraft:async(key,draft)=>{snapshots.push(structuredClone(draft));if(snapshots.length===1)await new Promise(resolve=>{release=resolve;});return true;}}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'First book.');
  const saving=ui.flush();
  await Promise.resolve();
  ui.editAnswer(key,0,'My second book.');
  release();
  assert.equal(await saving,true);
  assert.equal(snapshots.at(-1).targets[key].answers[0],'My second book.');
});

test('lesson switches preserve unsaved work in each independent lesson',async()=>{
  const h=setup({getTargets:l=>({words:[{word:l.id==='now'?'book':'walk'}]})}), key=h.ui.targets()[0].key;
  h.ui.editAnswer(key,0,'A book for me.');
  h.setLesson(old); h.ui.render();
  h.ui.editAnswer(h.ui.targets()[0].key,0,'I walk today.');
  h.setLesson(lesson);
  assert.match(h.ui.render(),/A book for me\./);
  assert.equal(await h.ui.flush(),true);
  assert.equal(new Set(h.writes.map(w=>w[0])).size,2);
});

test('checks each written free sentence with optional lesson or earlier usage fusion',async()=>{
  const seen=[];
  const {ui}=setup({checkSentence:async(sentence,context)=>{seen.push({sentence,context});return {issues:[{type:'collocation',message:'核对搭配',original:'look on',replacement:'look at'}],reviewNeeded:['语义与自然度']};}}), target=ui.targets()[0], phrase=ui.targets().find(t=>t.label==='look at');
  ui.editAnswer(target.key,0,'I look on the book.');
  ui.editAnswer(target.key,2,'Do you look at the book?');
  ui.setFusion(target.key,0,[phrase.key]);
  await ui.check(target.key);
  assert.equal(seen.length,2);
  assert.equal(seen[0].context.fusionTargets[0].label,'look at');
  const html=ui.render();
  assert.match(html,/搭配/);
  assert.match(html,/look at/);
  assert.match(html,/修改参考/);
  assert.doesNotMatch(html,/100%|得分|已掌握|语法完全正确/);
});

test('never attaches stale asynchronous feedback after the checked text changes',async()=>{
  let resolveCheck;
  const {ui}=setup({checkSentence:()=>new Promise(resolve=>{resolveCheck=resolve;})}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'I has a book.');
  const checking=ui.check(key);
  await Promise.resolve();
  ui.editAnswer(key,0,'I have a book.');
  resolveCheck({issues:[{type:'tense',message:'Old feedback'}]});
  await checking;
  assert.doesNotMatch(ui.render(),/Old feedback/);
});

test('local feedback classifies grammar, capitalization and punctuation and admits spelling coverage limits',async()=>{
  const {ui}=setup({grammarCheck:()=>[{rule:'did-base',message:'did 后用原形',original:'did went',replacement:'did go'}]}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'i did went to buy a book');
  await ui.check(key);
  const html=ui.render();
  assert.match(html,/时态/);
  assert.match(html,/大小写/);
  assert.match(html,/标点/);
  assert.match(html,/拼写.*复核/);
  assert.match(html,/did go/);
});

test('restores version one drafts and escapes answer and feedback HTML',()=>{
  const key='word:now:book';
  const {ui}=setup({getDrafts:()=>({'free-writing:v1:now':{version:1,lessonId:'now',activeTargetKey:key,targets:{[key]:{answers:['<img src=x onerror=alert(1)>'],feedback:[]}}}})});
  const html=ui.render();
  assert.match(html,/&lt;img/);
  assert.doesNotMatch(html,/<img/);
});

test('default source APIs provide lesson new words, reviewed phrases, and confirmed learned earlier material',()=>{
  const context={console,setTimeout,clearTimeout};context.window=context;context.globalThis=context;
  context.StudyLessonWordTargets={newWordsForLesson:()=>[{word:'book'}]};
  context.PhrasePractice={isGradedEligible:p=>p.practiceEligible!==false,practiceView:p=>p};
  vm.createContext(context);vm.runInContext(fs.readFileSync(modulePath,'utf8'),context);
  const ui=new context.FreeWritingPractice({getLesson:()=>lesson,getLessons:()=>[old,lesson,future],getLearnedLessonIds:()=>['old']});
  assert.deepEqual(Array.from(ui.targets(),t=>t.label),['book','on time','walk','look at']);
});

test('preserves drafts for temporarily removed targets and restores them after targets return',async()=>{
  let includeBook=true;
  const h=setup({getTargets:()=>({words:includeBook?[{word:'book'},{word:'pen'}]:[{word:'pen'}]})}), book=h.ui.targets()[0];
  h.ui.editAnswer(book.key,0,'My book stays safe.');
  includeBook=false; h.ui.setLesson(lesson);
  h.ui.editAnswer(h.ui.targets()[0].key,0,'My pen works.');
  await h.ui.flush();
  assert.equal(h.writes.at(-1)[1].targets[book.key].answers[0],'My book stays safe.');
  includeBook=true; h.ui.setLesson(lesson); h.ui.selectTarget(book.key);
  assert.match(h.ui.render(),/My book stays safe\./);
});

test('restoring a changed target list preserves archived target answers and extra written lines',()=>{
  const key='word:now:book', archived='word:now:pen';
  const {ui}=setup({getDrafts:()=>({'free-writing:v1:now':{version:1,lessonId:'now',targets:{[key]:{answers:['One book.','','','','','An extra book.']},[archived]:{answers:['My pen.']}}}})});
  ui.render();
  assert.equal(ui.active.draft.targets[archived].answers[0],'My pen.');
  assert.equal(ui.active.draft.targets[key].answers[5],'An extra book.');
});

test('mount confines delegated editing to its container and detaches handlers on unmount',()=>{
  const {ui}=setup(), handlers={};
  const container={innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn;},removeEventListener:(name,fn)=>{if(handlers[name]===fn)delete handlers[name];},querySelector:()=>null,contains:()=>true};
  assert.equal(ui.mount(container),true);
  handlers.input({target:{dataset:{freeAnswer:'0'},value:'A mounted book.'}});
  assert.match(ui.render(),/A mounted book\./);
  ui.unmount();
  assert.deepEqual(handlers,{});
});

test('invalid checker output is visibly treated as an incomplete check',async()=>{
  const {ui}=setup({checkSentence:async()=>null}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'A book.');
  await ui.check(key);
  assert.match(ui.render(),/检查失败/);
  assert.doesNotMatch(ui.render(),/有限规则未发现已覆盖的问题/);
});

test('autosaving updates status without replacing the textareas being edited',async()=>{
  const {ui}=setup(), status={dataset:{},textContent:''}, retry={hidden:true};
  let replacements=0;
  const container={set innerHTML(value){replacements++;},addEventListener(){},removeEventListener(){},querySelector:selector=>selector==='[data-free-save-status]'?status:selector==='[data-free-action="save"]'?retry:null};
  ui.mount(container);
  ui.editAnswer(ui.targets()[0].key,0,'My cursor stays in this book sentence.');
  await ui.flush();
  assert.equal(replacements,1,'saving must not replace focused textareas or reset their caret');
  assert.equal(status.textContent,'草稿已保存');
});

test('setting the same lesson with newly loaded source data refreshes its goals without losing answers',()=>{
  const {ui}=setup({getTargets:source=>({words:source.vocabulary})}), key=ui.targets()[0].key;
  ui.editAnswer(key,0,'Keep this book.');
  ui.setLesson({...lesson,vocabulary:[...lesson.vocabulary,{word:'pen'}]});
  assert.deepEqual(ui.targets().map(target=>target.label),['book','pen']);
  assert.equal(ui.active.draft.targets[key].answers[0],'Keep this book.');
});

test('daily groups persist remaining work across reload and roll over without resetting answers',async()=>{
  let day='2026-10-28';
  const saved={}, getTargets=()=>({words:[{word:'book'},{word:'pen'},{word:'table'}],phrases:[{phrase:'on time'}],priorWords:[{word:'walk',source:old,requiredCount:2}]});
  const opts={dayKey:()=>day,getTargets,getDrafts:()=>saved,saveDraft:(key,value)=>{saved[key]=structuredClone(value);return true;}};
  const {ui}=setup(opts), key=ui.targets()[0].key;
  assert.match(ui.render(),/今日已写 0 \/ 12 句/);
  ui.editAnswer(key,0,'One book.');
  await ui.flush();
  const reloaded=setup(opts).ui;
  assert.match(reloaded.render(),/今日已写 1 \/ 12 句/);
  assert.deepEqual(reloaded.active.draft.dailyPlans[day].groups[0].items.map(item=>item.key),['word:now:book','word:now:pen','word:old:walk']);
  day='2026-10-29';
  assert.match(reloaded.render(),/今日已写 0 \/ 11 句/);
  assert.equal(reloaded.active.draft.targets[key].answers[0],'One book.');
  assert.ok(reloaded.active.draft.dailyPlans['2026-10-28']);
  await reloaded.flush();
});

test('completed daily group waits for explicit another group while full cumulative goals remain accessible',async()=>{
  const {ui}=setup({dayKey:'2026-10-28',getTargets:()=>({words:[{word:'book'},{word:'pen'},{word:'table'}]})});
  ui.render();
  for (const target of ui.targets().slice(0,2)) for(let index=0;index<5;index++) ui.editAnswer(target.key,index,'A '+target.label+'.');
  assert.match(ui.render(),/今日已写 10 \/ 10 句/);
  assert.match(ui.render(),/本课累计 10 \/ 15 句/);
  assert.match(ui.render(),/再来一组/);
  assert.equal(ui.active.draft.dailyPlans['2026-10-28'].groups.length,1);
  assert.equal(ui.anotherGroup(),true);
  assert.equal(ui.currentTarget().label,'table');
  assert.match(ui.render(),/今日已写 10 \/ 15 句/);
  assert.equal(ui.anotherGroup(),false,'unfinished group cannot be skipped by requesting another');
  await ui.flush();
});

test('renamed display target keeps storage identity, extra answers, feedback and selected row fusion',async()=>{
  const key='word:now:rang', phrase='phrase:now:on%20time';
  const saved={'free-writing:v1:now':{version:1,lessonId:'now',activeTargetKey:key,targets:{[key]:{answers:['The bell rang.','','','','','Extra sentence.'],fusion:[[phrase]],feedback:[{sentence:'The bell rang.',issues:[{type:'review',message:'Keep me'}]}]}}}};
  const seen=[];
  const {ui}=setup({getDrafts:()=>saved,getTargets:()=>({words:[{word:'ring',storageLabel:'rang'}],phrases:[{phrase:'on time'}]}),checkSentence:(sentence,context)=>{seen.push(context);return {issues:[]};}});
  assert.equal(ui.targets()[0].key,key);
  assert.equal(ui.currentTarget().label,'ring');
  assert.equal(ui.active.draft.targets[key].answers[5],'Extra sentence.');
  assert.match(ui.render(),/Keep me/);
  assert.equal((ui.render().match(/data-free-fusion=/g)||[]).length,0,'reference help is shared, not repeated for each sentence');
  await ui.check(key);
  assert.equal(seen[0].fusionTargets[0].label,'on time');
});

test('daily plan storage failure keeps plan and cursor intact through pending save and retry',async()=>{
  let release, failing=true, replacements=0;
  const {ui}=setup({dayKey:'2026-10-28',saveDraft:async()=>{if(failing){await new Promise(resolve=>{release=resolve;});throw new Error('full');}return true;}});
  const status={dataset:{},textContent:''}, today={textContent:''};
  const container={set innerHTML(value){replacements++;},addEventListener(){},removeEventListener(){},querySelector:s=>s==='[data-free-save-status]'?status:s==='[data-free-today-progress]'?today:null};
  ui.mount(container);
  const key=ui.targets()[0].key;
  ui.editAnswer(key,0,'One book.');
  const saving=ui.flush();await Promise.resolve();
  ui.editAnswer(key,1,'Two books.');
  release();assert.equal(await saving,false);
  assert.match(status.textContent,/保存失败/);
  assert.equal(replacements,1);
  assert.match(today.textContent,/2 \/ 12/);
  failing=false;assert.equal(await ui.flush(),true);
  assert.equal(ui.active.draft.targets[key].answers[1],'Two books.');
  assert.equal(replacements,1);
});

test('previous and next target navigation follows the current small group without hiding other drafts',()=>{
  const {ui}=setup({dayKey:'2026-10-28'});
  ui.render();
  assert.equal(ui.navigateTarget(1),true);
  assert.equal(ui.currentTarget().label,'on time');
  assert.equal(ui.navigateTarget(1),true);
  assert.equal(ui.currentTarget().label,'walk');
  assert.equal(ui.navigateTarget(1),false);
  assert.equal(ui.navigateTarget(-1),true);
  assert.equal(ui.currentTarget().label,'on time');
  assert.equal(ui.selectTarget(ui.targets().find(item=>item.label==='look at').key),true);
  assert.match(ui.render(),/look at/);
});

test('same-day quota reclassification keeps old storage source, nonempty extra rows and coherent daily goals',async()=>{
  let prior=false;
  const {ui}=setup({dayKey:'2026-10-28',getTargets:()=>prior ? {priorWords:[{word:'ring',storageLabel:'rang',storageSourceId:'now',source:old,requiredCount:2}]} : {words:[{word:'rang'}]}});
  const key=ui.targets()[0].key;
  ui.editAnswer(key,0,'The bell rang.');
  ui.editAnswer(key,4,'It rang again.');
  prior=true;ui.setLesson(lesson);
  assert.equal(ui.targets()[0].key,'word:now:rang');
  assert.equal(ui.active.draft.targets[key].answers.length,5,'stored empty and written rows stay intact');
  const html=ui.render();
  assert.equal((html.match(/data-free-answer="/g)||[]).length,3,'show two required rows plus the historical written extra');
  assert.match(html,/今日已写 2 \/ 2 句/);
  assert.match(html,/本课累计 2 \/ 2 句/);
  await ui.flush();
});

test('crossing midnight while editing keeps the visible selected target and its answer binding',async()=>{
  let day='2026-10-28';
  const {ui}=setup({dayKey:()=>day});
  const phrase=ui.targets().find(target=>target.label==='on time');
  ui.selectTarget(phrase.key);
  day='2026-10-29';
  assert.equal(ui.currentTarget().key,phrase.key);
  ui.editAnswer(ui.currentTarget().key,0,'I arrive on time.');
  assert.equal(ui.active.draft.targets[phrase.key].answers[0],'I arrive on time.');
  assert.equal(ui.active.draft.targets['word:now:book'].answers[0],'');
  await ui.flush();
});

test('daily helper counts only remaining work and does not mutate caller state or silently move groups',()=>{
  const targets=[{key:'word:now:a',requiredCount:5,prior:false},{key:'word:now:b',requiredCount:5,prior:false},{key:'word:now:c',requiredCount:5,prior:false}];
  const rows={'word:now:a':{answers:['One.','Two.','Three.','Four.','Five.','Extra.']},'word:now:b':{answers:['One.','Two.']}};
  const plan=FreeWritingPractice.dailyPlan(targets,rows,'2026-10-28');
  assert.deepEqual(plan.groups[0].items,[{key:'word:now:b',baseline:2,goal:3},{key:'word:now:c',baseline:0,goal:5}]);
  const snapshot=structuredClone(plan);
  rows['word:now:b'].answers.push('Three.','Four.','Five.');
  const unchanged=FreeWritingPractice.dailyPlan(targets,rows,'2026-10-28',plan,true);
  assert.deepEqual(plan,snapshot);
  assert.equal(unchanged.groups.length,1);
});

test('prior references present in the current lesson all remain goals while only optional padding is capped',()=>{
  const {ui}=setup({dayKey:'2026-10-28',getTargets:()=>({priorWords:[{word:'optional one',source:old},{word:'optional two',source:old},{word:'optional three',source:old},{word:'ring',source:old,fromCurrentLesson:true,requiredCount:2},{word:'repeat',source:old,fromCurrentLesson:true,requiredCount:2},{word:'send',source:old,fromCurrentLesson:true,requiredCount:2}]})});
  assert.deepEqual(ui.targets().map(target=>target.label),['optional one','optional two','ring','repeat','send']);
  assert.match(ui.render(),/本课累计 0 \/ 8 句/);
  assert.deepEqual(ui.active.draft.dailyPlans['2026-10-28'].groups[0].items.map(item=>item.key),['word:old:optional%20one']);
});

test('midnight before a pending autosave preserves input and selected target without replacing textareas',async()=>{
  let day='2026-10-28', replacements=0;
  const status={dataset:{},textContent:''};
  const {ui,writes}=setup({dayKey:()=>day});
  const phrase=ui.targets().find(target=>target.label==='on time');
  ui.selectTarget(phrase.key);
  ui.mount({set innerHTML(value){replacements++;},addEventListener(){},removeEventListener(){},querySelector:s=>s==='[data-free-save-status]'?status:null});
  ui.editAnswer(phrase.key,0,'I arrive on time.');
  day='2026-10-29';
  assert.equal(await ui.flush(),true);
  assert.equal(writes.at(-1)[1].targets[phrase.key].answers[0],'I arrive on time.');
  assert.equal(writes.at(-1)[1].activeTargetKey,phrase.key);
  assert.equal(replacements,1);
  assert.match(status.textContent,/草稿已保存/);
});

test('midnight while awaiting an asynchronous save preserves its answer and selected target',async()=>{
  let day='2026-10-28', release, replacements=0;
  const snapshots=[],status={dataset:{},textContent:''};
  const {ui}=setup({dayKey:()=>day,saveDraft:async(key,draft)=>{snapshots.push(structuredClone(draft));await new Promise(resolve=>{release=resolve;});return true;}});
  const phrase=ui.targets().find(target=>target.label==='on time');
  ui.selectTarget(phrase.key);
  ui.mount({set innerHTML(value){replacements++;},addEventListener(){},removeEventListener(){},querySelector:s=>s==='[data-free-save-status]'?status:null});
  ui.editAnswer(phrase.key,0,'I arrive on time.');
  const saving=ui.flush();await Promise.resolve();
  day='2026-10-29';release();
  assert.equal(await saving,true);
  assert.equal(snapshots.at(-1).targets[phrase.key].answers[0],'I arrive on time.');
  assert.equal(ui.active.draft.activeTargetKey,phrase.key);
  assert.equal(replacements,1);
  assert.match(status.textContent,/草稿已保存/);
});

test('removed daily targets keep archived drafts without blocking the remaining visible group',async()=>{
  let includeBook=true;
  const {ui,writes}=setup({dayKey:'2026-10-28',getTargets:()=>({words:(includeBook?['book','pen','table']:['pen','table']).map(word=>({word}))})});
  const book=ui.targets()[0].key;
  ui.editAnswer(book,0,'Keep my book.');
  includeBook=false;ui.setLesson(lesson);
  const pen=ui.targets().find(target=>target.label==='pen');
  for(let index=0;index<5;index++)ui.editAnswer(pen.key,index,'My pen works.');
  assert.match(ui.render(),/今日已写 5 \/ 5 句/);
  assert.equal(ui.anotherGroup(),true);
  assert.equal(ui.currentTarget().label,'table');
  assert.match(ui.render(),/今日已写 5 \/ 10 句/);
  await ui.flush();
  assert.equal(writes.at(-1)[1].targets[book].answers[0],'Keep my book.');
  includeBook=true;ui.setLesson(lesson);ui.selectTarget(book);
  assert.match(ui.render(),/Keep my book\./);
});
