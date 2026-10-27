const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'old',book:1,number:1,title:'An old lesson',vocabulary:[{word:'send',pos:'v.',meaning:'寄送'},{word:'friendly',pos:'adj.',meaning:'友好的'},{word:'postcard',pos:'n.',meaning:'明信片'}],usage:[{phrase:'make a decision',meaning:'作出决定'}]},
  {id:'old2',book:2,number:3,title:'Earlier',vocabulary:[{word:'receive',pos:'v.',meaning:'收到'},{word:'friendly',pos:'adj.',meaning:'友好的'}],usage:[{phrase:'pay attention',meaning:'注意'}]},
  {id:'current',book:2,number:9,title:'A cold welcome',vocabulary:[{word:'welcome',pos:'v.',meaning:'欢迎'}],usage:[]},
  {id:'future',book:2,number:10,title:'Future',vocabulary:[{word:'damage',pos:'v.',meaning:'损坏'}],usage:[]}
];

function setup({drafts={},current=lessons[2]}={}) {
  const handlers={},spoken=[],records={},notices=[];let markup='',focusCount=0;
  const trigger={focus(){focusCount++;}};
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},setAttribute(){}};
  const content={get innerHTML(){return markup;},set innerHTML(value){markup=value;},querySelector(selector){return /dialog|word-picker(?!-)/.test(selector)?dialog:null;},querySelectorAll(){return [];}};
  const document={activeElement:trigger,body:{classList:{contains:()=>true,add(){},remove(){}}},addEventListener:(kind,fn)=>(handlers[kind]||=[]).push(fn),querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const sandbox={document,console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};sandbox.window=sandbox;vm.createContext(sandbox);
  for(const name of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),sandbox);
  const ui=new sandbox.SentencePractice({getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>records,getDrafts:()=>drafts,saveDraft:(key,value)=>{drafts[key]=JSON.parse(JSON.stringify(value));return true;},speak:text=>spoken.push(text),toast:text=>notices.push(text)});
  const render=()=>{content.innerHTML=ui.render();return markup;};
  function event(kind,dataset,value='',extra={}){const node={dataset,value,...extra,closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'&&dataset.sentenceAction?node:null};for(const fn of handlers[kind]||[])fn({target:node,preventDefault(){},key:extra.key});}
  return {ui,render,drafts,spoken,records,notices,event,dialog,trigger,get focusCount(){return focusCount;},setLesson:value=>{current=value;}};
}
const find=(h,label)=>h.ui.wordBank().find(item=>item.label===label);
const selected=h=>Array.from(h.ui.selectedOldItems(),item=>item.label).sort();

test('drawer starts with all old words and offers category and selected filters',()=>{
  const h=setup();let html=h.render();
  assert.match(html,/全部旧词/);assert.doesNotMatch(html,/data-sentence-source=|data-sentence-select="old-(?:word|phrase)"|sentence-knowledge-source/);
  h.ui.openWordPicker(h.trigger);html=h.render();
  assert.match(html,/<dialog\b/);assert.match(html,/已学重点词表/);assert.match(html,/动词/);assert.match(html,/形容词/);assert.match(html,/习惯用法/);assert.match(html,/完成选择/);
  assert.ok(find(h,'send'));assert.ok(find(h,'friendly'));assert.ok(find(h,'make a decision'));
  assert.ok(find(h,'postcard'));assert.equal(find(h,'damage'),undefined);assert.equal(find(h,'welcome'),undefined);
  assert.equal(h.ui.wordCategory,'all');assert.match(html,/data-sentence-category="selected"/);
  assert.deepEqual(h.records,{});
});

test('free multi-selection spans categories, deduplicates and saves with the writing draft',()=>{
  const h=setup();h.render();const keys=['send','receive','friendly','make a decision'].map(label=>find(h,label).key);
  h.ui.setOldSelection([...keys,keys[0],'unknown']);h.ui.active.draft.step=4;h.event('input',{sentenceInput:'answer'},'Our friendly neighbours gave us a warm welcome.');h.ui.flush();
  assert.deepEqual(selected(h),['friendly','make a decision','receive','send']);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});restored.render();
  assert.deepEqual(selected(restored),selected(h));assert.equal(restored.ui.active.draft.answers.combined,'Our friendly neighbours gave us a warm welcome.');
  assert.deepEqual(restored.records,{});assert.equal(restored.ui.active.draft.assisted,false);
});

test('old single selections migrate to deduplicated chips while an explicitly cleared list stays empty',()=>{
  const h=setup();h.render();const key=h.ui.active.key;
  const drafts={[key]:{...h.ui.active.draft,oldWordKey:'word:old2:friendly',oldPhraseKey:'phrase:old:make%20a%20decision'}};delete drafts[key].selectedOldKeys;
  const migrated=setup({drafts});migrated.render();assert.deepEqual(selected(migrated),['friendly','make a decision']);
  migrated.ui.setOldSelection([]);migrated.ui.flush();
  const cleared=setup({drafts:JSON.parse(JSON.stringify(drafts))});cleared.render();assert.deepEqual(selected(cleared),[]);
});

test('checkbox, pronunciation and chip removal are independent actions',()=>{
  const h=setup();h.render();const item=find(h,'receive');
  h.event('change',{sentenceOldKey:item.key},'',{checked:true});assert.deepEqual(selected(h),['receive']);
  h.event('click',{sentenceAction:'speak-old',sentenceOldKey:item.key});assert.deepEqual(h.spoken,['receive']);assert.deepEqual(selected(h),['receive']);
  h.event('click',{sentenceAction:'remove-old',sentenceOldKey:item.key});assert.deepEqual(selected(h),[]);
});

test('search and category changes preserve choices, draft, step and assistance state',()=>{
  const h=setup();h.render();h.ui.setOldSelection([find(h,'send').key]);h.ui.active.draft.step=4;h.ui.active.draft.answers.combined='I will send you a warm welcome.';
  h.ui.openWordPicker(h.trigger);h.ui.setWordCategory('adjective');h.event('input',{sentenceInput:'word-search'},'友好');
  assert.deepEqual(selected(h),['send']);assert.equal(h.ui.active.draft.step,4);assert.equal(h.ui.active.draft.answers.combined,'I will send you a warm welcome.');assert.equal(h.ui.active.draft.assisted,false);
  assert.equal(h.ui.selectedOldItems().length,1);
});

test('closing or confirming never discards selected expressions or manufactures completion',()=>{
  const h=setup();h.render();h.ui.openWordPicker(h.trigger);h.ui.setOldSelection([find(h,'friendly').key]);h.ui.closeWordPicker();
  assert.deepEqual(selected(h),['friendly']);assert.equal(h.dialog.open,false);assert.ok(h.focusCount>=1);assert.deepEqual(h.records,{});
  h.ui.openWordPicker(h.trigger);h.event('click',{sentenceAction:'clear-old'});h.ui.closeWordPicker();assert.deepEqual(selected(h),[]);
});

test('Escape closes the picker even when the search field contains text',()=>{
  const h=setup();h.render();h.ui.openWordPicker(h.trigger);h.event('input',{sentenceInput:'word-search'},'receive');
  h.event('keydown',{sentenceInput:'word-search'},'receive',{key:'Escape'});
  assert.equal(h.dialog.open,false);assert.ok(h.focusCount>=1);
});

test('switching course and target keeps choices separate and source labels escaped',()=>{
  const h=setup();h.render();h.ui.setOldSelection([find(h,'receive').key]);h.ui.flush();h.setLesson(lessons[3]);h.render();assert.deepEqual(selected(h),[]);
  h.setLesson(lessons[2]);h.render();assert.deepEqual(selected(h),['receive']);
  const html=h.render();assert.doesNotMatch(html,/An old lesson|Earlier|第 1 册 · 第 1 课/);
});

test('new picker assets retain native dialog semantics, safe text and no external dependency',()=>{
  const h=setup();h.render();h.ui.openWordPicker(h.trigger);const html=h.render();
  assert.match(html,/aria-labelledby=/);assert.match(html,/type="search"/);assert.match(html,/type="checkbox"/);assert.match(html,/role="tablist"/);assert.match(html,/aria-selected=/);
  assert.doesNotMatch(html,/https?:\/\/|<script\b/);
});

test('optional transform mode accepts any selected old word and expression, without requiring the first chip',()=>{
  const h=setup();h.render();h.event('change',{sentenceSelect:'mode'},'transform');
  h.ui.setOldSelection(['friendly','receive','pay attention'].map(label=>find(h,label).key));
  Object.assign(h.ui.active.draft.answers,{affirmative:'We welcome visitors.',negative:'We do not welcome visitors.',yesno:'Do we welcome visitors?',wh:'Why do we welcome visitors?',combined:'We welcome visitors and receive letters when we pay attention.'});
  const combined=h.ui.evaluate().rows.find(row=>row.kind==='combined');
  assert.ok(combined);assert.doesNotMatch(combined.issues.join(' '),/friendly|未.*旧词|未.*旧用法/);
});

test('a target also selected in the word bank cannot hide a different valid selected old word',()=>{
  const h=setup();h.records.old={completed:true};h.render();h.event('change',{sentenceSelect:'target'},find(h,'send').key);
  h.event('change',{sentenceSelect:'mode'},'transform');
  assert.equal(h.ui.target().word,'send');assert.equal(h.ui.active.draft.mode,'transform');
  h.ui.setOldSelection(['send','receive','pay attention'].map(label=>find(h,label).key));
  Object.assign(h.ui.active.draft.answers,{affirmative:'We send letters.',negative:'We do not send letters.',yesno:'Do we send letters?',wh:'Why do we send letters?',combined:'We send letters and receive postcards when we pay attention.'});
  const combined=h.ui.evaluate().rows.find(row=>row.kind==='combined');
  assert.doesNotMatch(combined.issues.join(' '),/目标词不同|未.*旧词/);
});
