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

function durableWritingWriters(){
 const storageAPI=require('../study-storage.js'),memory=new Map();
 const storage={get length(){return memory.size;},key:index=>[...memory.keys()][index]??null,getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
 const plain=value=>JSON.parse(JSON.stringify(value));
 function create(writer){
  let data=storageAPI.read({storage}).data,editorBase=plain(data.freeWriting||{});
  const session=storageAPI.createSession({storage,writer,initial:data});
  const ui=new FreeWritingPractice({getLesson:()=>lesson,getLessons:()=>[old,lesson],getTargets:fixture,getDrafts:()=>data.freeWriting||{},saveDraft:(key,draft,context={})=>{
   const latest=session.read();if(!latest.ok)return {ok:false,error:'Read failed'};
   const merged=FreeWritingPractice.mergeDraft(context.baseDraft,draft,latest.data.freeWriting?.[key]);
   if(!merged.ok)return merged;
   const next={...editorBase,[key]:merged.draft},freeWriting=storageAPI.reconcile(editorBase,next,data.freeWriting||{});
   const result=session.commit({...data,freeWriting});if(!result.ok)return {ok:false,error:'Save failed'};
   data=result.data;session.adopt(data);editorBase=plain(next);
   return {ok:true,draft:data.freeWriting[key]};
  }});
  return ui;
 }
 return {create,read:()=>storageAPI.read({storage}).data};
}

test('independent free-writing rows from two real storage writers merge without overwriting either tab',async()=>{
 const h=durableWritingWriters(),first=h.create('free-first'),key=first.targets()[0].key;
 first.editAnswer(key,0,'My first local book.');assert.equal(await first.flush(),true);
 const second=h.create('free-second');second.targets();second.editAnswer(key,1,'A book saved in another tab.');assert.equal(await second.flush(),true);
 first.editAnswer(key,2,'My third local book.');assert.equal(await first.flush(),true);
 const saved=h.read().freeWriting[first.active.key].targets[key];
 assert.deepEqual(saved.answers.slice(0,3),['My first local book.','A book saved in another tab.','My third local book.']);
 assert.equal(first.active.draft.targets[key].answers[1],'A book saved in another tab.');
});

test('conflicting edits to the same free-writing row fail visibly without replacing local or remote input',async()=>{
 const h=durableWritingWriters(),first=h.create('free-first'),key=first.targets()[0].key;
 first.editAnswer(key,0,'Our original book.');await first.flush();
 const second=h.create('free-second');second.targets();second.editAnswer(key,0,'The other tab changed this book.');assert.equal(await second.flush(),true);
 first.editAnswer(key,0,'My own changed book.');assert.equal(await first.flush(),false);
 assert.equal(first.active.draft.targets[key].answers[0],'My own changed book.');
 assert.equal(h.read().freeWriting[first.active.key].targets[key].answers[0],'The other tab changed this book.');
 assert.match(first.render(),/第\s*1\s*句.*(?:其他|另一个).*窗口|第\s*1\s*句.*冲突/);
 assert.equal(await first.flush(),false,'a retry must not silently accept an unresolved conflict');
});

test('merged rows retain matching feedback and fusion while changed sentences discard stale feedback',()=>{
 const key='word:now:book',fusion='phrase:now:on%20time';
 const base={version:1,lessonId:'now',activeTargetKey:key,targets:{[key]:{answers:['A book.','','','',''],feedback:[{sentence:'A book.',issues:[{type:'review',message:'Old feedback'}]},null],fusion:[[],[]]}},updatedAt:1};
 const local=structuredClone(base),remote=structuredClone(base);local.targets[key].answers[0]='My new book.';local.targets[key].feedback[0]=null;
 remote.targets[key].answers[1]='A remote book on time.';remote.targets[key].fusion[1]=[fusion];remote.targets[key].feedback[1]={sentence:remote.targets[key].answers[1],issues:[{type:'review',message:'Remote matching feedback'}]};
 const merged=FreeWritingPractice.mergeDraft(base,local,remote);assert.equal(merged.ok,true);
 assert.equal(merged.draft.targets[key].feedback[0],null);assert.equal(merged.draft.targets[key].feedback[1].sentence,remote.targets[key].answers[1]);
 assert.deepEqual(merged.draft.targets[key].fusion[1],[fusion]);assert.equal(base.targets[key].answers[0],'A book.');
});

test('saving feedback during an asynchronous group check keeps later feedback bound to the unchanged sentence',async()=>{
 let finishSecond;
 const {ui}=setup({checkSentence:async(sentence,context)=>context.index===1?new Promise(resolve=>{finishSecond=resolve;}):{issues:[{type:'review',message:'First feedback'}]}}),key=ui.targets()[0].key;
 ui.editAnswer(key,0,'My first book.');ui.editAnswer(key,1,'My second book.');
 const checking=ui.check(key);for(let i=0;i<5&&!finishSecond;i++)await Promise.resolve();assert.equal(typeof finishSecond,'function');
 await ui.flush();finishSecond({issues:[{type:'review',message:'Second feedback'}]});await checking;
 assert.equal(ui.active.draft.targets[key].feedback[1].sentence,'My second book.');assert.match(ui.render(),/Second feedback/);
});

test('merging a remote line updates its visible text and fusion without replacing the local focused editor',async()=>{
 const h=durableWritingWriters(),first=h.create('free-first'),key=first.targets()[0].key;
 first.editAnswer(key,0,'My first book.');await first.flush();
 const fields=[0,1,2,3,4].map(index=>({dataset:{freeAnswer:String(index)},value:index===0?'My first book.':'',selectionStart:4}));
 const fusionFields=[0,1,2,3,4].map(index=>({dataset:{freeFusion:String(index)},value:''}));let replacements=0;
 const container={set innerHTML(value){replacements++;},addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:selector=>selector==='textarea[data-free-answer]'?fields:selector==='select[data-free-fusion]'?fusionFields:[]};first.mount(container);
 const second=h.create('free-second'),phrase=second.targets().find(target=>target.label==='look at');
 second.editAnswer(key,1,'I look at the remote book.');second.setFusion(key,1,[phrase.key]);await second.flush();
 first.editAnswer(key,2,'My local third book.');fields[2].value='My local third book.';await first.flush();
 assert.equal(fields[1].value,'I look at the remote book.');assert.equal(fusionFields[1].value,phrase.key);
 assert.equal(fields[2].value,'My local third book.');assert.equal(fields[2].selectionStart,4);assert.equal(replacements,1);
});


test('a remote target selection cannot redirect the local editor or subsequent input to another target',async()=>{
 const h=durableWritingWriters(),first=h.create('free-first'),target=first.targets()[0];
 first.editAnswer(target.key,0,'My book.');await first.flush();
 const second=h.create('free-second'),otherTarget=second.targets()[1];second.selectTarget(otherTarget.key);
 second.editAnswer(otherTarget.key,0,'I arrive on time.');await second.flush();
 first.editAnswer(target.key,1,'My second book.');await first.flush();
 assert.equal(first.active.draft.activeTargetKey,target.key);assert.equal(first.currentTarget().key,target.key);
 assert.equal(first.active.draft.targets[otherTarget.key].answers[0],'I arrive on time.');
});


test('structured merged saves preserve daily groups and prior days through midnight',async()=>{
 let day='2026-10-28',stored={};
 const h=setup({dayKey:()=>day,getDrafts:()=>stored,saveDraft:(key,draft,context)=>{
  const merged=FreeWritingPractice.mergeDraft(context.baseDraft,draft,stored[key]);if(!merged.ok)return merged;
  stored[key]=structuredClone(merged.draft);return merged;
 }}),key=h.ui.targets()[0].key;
 h.ui.editAnswer(key,0,'My first book.');await h.ui.flush();const firstPlan=structuredClone(stored[h.ui.active.key].dailyPlans[day]);
 day='2026-10-29';h.ui.render();h.ui.editAnswer(key,1,'My second book.');assert.equal(await h.ui.flush(),true);
 assert.deepEqual(stored[h.ui.active.key].dailyPlans['2026-10-28'],firstPlan);
 assert.equal(stored[h.ui.active.key].dailyPlans['2026-10-29'].groups.length,1);
 assert.equal(h.ui.active.draft.dailyPlans['2026-10-29'].groups.length,1);
 assert.deepEqual(stored[h.ui.active.key].targets[key].answers.slice(0,2),['My first book.','My second book.']);
});

test('dailyPlans merge independent dates and explicitly reject two different edits to the same day',()=>{
 const key='word:now:book',plan=(day,goal)=>({day,groups:[{items:[{key,baseline:0,goal}]}]});
 const base={version:1,lessonId:'now',activeTargetKey:key,targets:{[key]:{answers:['A book.'],feedback:[null],fusion:[[]]}},dailyPlans:{'2026-10-28':plan('2026-10-28',5)}};
 const local=structuredClone(base),remote=structuredClone(base);local.dailyPlans['2026-10-29']=plan('2026-10-29',4);remote.dailyPlans['2026-10-30']=plan('2026-10-30',3);
 const merged=FreeWritingPractice.mergeDraft(base,local,remote);assert.equal(merged.ok,true);assert.deepEqual(Object.keys(merged.draft.dailyPlans),['2026-10-28','2026-10-29','2026-10-30']);
 local.dailyPlans['2026-10-28']=plan('2026-10-28',4);remote.dailyPlans['2026-10-28']=plan('2026-10-28',2);
 const conflict=FreeWritingPractice.mergeDraft(base,local,remote);assert.equal(conflict.ok,false);assert.match(conflict.error,/分组.*另一个窗口/);assert.equal(base.dailyPlans['2026-10-28'].groups[0].items[0].goal,5);
});

test('a cancelled restore-epoch saver fails without advancing saved revision or erasing local input',async()=>{
 let cancelled=false;
 const h=setup({dayKey:'2026-10-28',saveDraft:async()=>cancelled?{ok:false,error:'学习备份已恢复，此前的保存已取消；原输入仍可复制。'}:true}),key=h.ui.targets()[0].key;
 h.ui.editAnswer(key,0,'The saved book.');await h.ui.flush();const savedRevision=h.ui.active.savedRevision;
 cancelled=true;h.ui.editAnswer(key,0,'The old editor retains this unsaved book.');assert.equal(await h.ui.flush(),false);
 assert.equal(h.ui.active.savedRevision,savedRevision);assert.equal(h.ui.active.draft.targets[key].answers[0],'The old editor retains this unsaved book.');assert.match(h.ui.render(),/备份已恢复.*保存已取消/);
});
