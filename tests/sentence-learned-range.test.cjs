const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'first',book:1,number:1,vocabulary:[{word:'investigate',pos:'v.',meaning:'调查'},{word:'go',pos:'v.',meaning:'去'}],usage:[{phrase:'take into account',meaning:'考虑到'},{phrase:'look at',meaning:'看'}]},
  {id:'studied',book:1,number:3,vocabulary:[{word:'accomplish',pos:'v.',meaning:'完成'}],usage:[{phrase:'make a decision',meaning:'作出决定'},{phrase:'put up with',meaning:'忍受'},{phrase:'pay attention to',meaning:'注意'}]},
  {id:'later',book:1,number:5,vocabulary:[{word:'negotiate',pos:'v.',meaning:'谈判'},{word:'investigate',pos:'v.',meaning:'调查'}],usage:[{phrase:'in spite of',meaning:'尽管'},{phrase:'take into account',meaning:'考虑到'}]},
  {id:'now',book:2,number:1,vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'}],usage:[{phrase:'read about',meaning:'阅读'}]},
  {id:'future',book:3,number:2,vocabulary:[{word:'persuade',pos:'v.',meaning:'说服'}],usage:[]},
  {id:'fourth',book:4,number:7,vocabulary:[],usage:[]}
];
function setup({records = {}, range, drafts = {}, failRange = false} = {}) {
  const events = {}, notices = [], savedRanges = [];
  let current = lessons[3], markup = '', rangeValue = range, oldPanel = null;
  const bookFields = {};
  const content = {get innerHTML(){return markup;},set innerHTML(value){
    markup=value;
    const old=value.match(/<details class="sentence-quick-old"([^>]*)>/);
    oldPanel=old?{open:/\bopen\b/.test(old[1])}:null;
    for(const book of ['1','2','3','4'])bookFields[book]={dataset:{sentenceLearningBook:book},focus(){document.activeElement=this;}};
  },querySelector(selector){
    if(selector==='.sentence-quick-old')return oldPanel;
    const book=selector.match(/\[data-sentence-learning-book="([1-4])"\]/)?.[1];
    return book && markup.includes(`data-sentence-learning-book="${book}"`) ? bookFields[book] : null;
  },querySelectorAll(){return [];}};
  const document = {body:{classList:{contains:()=>true}},addEventListener:(name,fn)=>events[name]=fn,querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const scope = {document,console,setTimeout:()=>1,clearTimeout(){}};scope.window=scope;vm.createContext(scope);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);
  const ui = new scope.SentencePractice({defaultMode:'four',getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>records,getLearningRange:()=>rangeValue,
    saveLearningRange:value=>{savedRanges.push(JSON.parse(JSON.stringify(value)));if(failRange)return false;rangeValue=JSON.parse(JSON.stringify(value));return true;},
    getDrafts:()=>drafts,saveDraft:(key,value)=>{drafts[key]=JSON.parse(JSON.stringify(value));return true;},toast:value=>notices.push(value),random:()=>0.3});
  function changeRange(book,value){const target={dataset:{sentenceLearningBook:String(book)},value:String(value),closest:()=>content};events.change({target});}
  return {ui,records,drafts,notices,savedRanges,document,content,render:()=>content.innerHTML=ui.render(),changeRange,openOld:()=>{oldPanel.open=true;},get oldOpen(){return oldPanel?.open;},openRange:()=>events.toggle({target:{dataset:{sentenceLearningRange:''},open:true,closest:()=>content}}),setRange:value=>rangeValue=value,setLesson:value=>current=value,get range(){return rangeValue;}};
}
const labels = h => Array.from(h.ui.recommendedOldItems(),item=>item.label).sort();

test('a fresh profile gets no unstudied automatic suggestions while retaining the complete manual bank',()=>{
  const h=setup();const html=h.render();
  assert.deepEqual(labels(h),[]);
  assert.ok(h.ui.wordBank().some(item=>item.label==='negotiate'));
  assert.match(html,/前课词库/);assert.match(html,/已学范围/);assert.match(html,/尚无.*已学|暂无.*已学/);
  assert.equal((html.match(/data-sentence-learning-book="[1-4]"/g)||[]).length,0);
  h.openRange();assert.equal((h.render().match(/data-sentence-learning-book="[1-4]"/g)||[]).length,4);
  assert.deepEqual(h.records,{});
});

test('actual lesson records drive phrase-first suggestions and stale caches cannot bypass the learned source filter',()=>{
  const drafts={'selection:v1:now':{targetKey:'word:now:book',mode:'four',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:['word:later:negotiate','phrase:first:take%20into%20account']}};
  const h=setup({records:{studied:{attempts:1},later:{attempts:0},first:{attempts:Infinity}},drafts});h.render();
  assert.deepEqual(labels(h),['accomplish','make a decision','pay attention to','put up with']);
  assert.equal(h.ui.recommendedOldItems().filter(item=>item.category==='phrase').length,3);
  h.ui.setOldSelection(['word:later:negotiate']);
  const active=h.ui.active;active.draft.answers.affirmative='An unfinished book sentence.';active.draft.checkedAt=15;
  delete h.records.studied;h.render();
  assert.deepEqual(labels(h),[]);assert.equal(h.ui.active,active);
  assert.equal(active.draft.answers.affirmative,'An unfinished book sentence.');assert.equal(active.draft.checkedAt,15);
  assert.deepEqual(Array.from(active.draft.selectedOldKeys),['word:later:negotiate']);
  h.records.studied={completed:true};h.render();assert.equal(labels(h).length,4);
  const inherited=setup({records:Object.create({studied:{completed:true}})});inherited.render();assert.deepEqual(labels(inherited),[]);
});

test('a learned alias source qualifies its stable canonical expression without requiring the first source to be studied',()=>{
  const h=setup({records:{later:{completed:true}}});h.render();
  assert.deepEqual(labels(h),['in spite of','investigate','negotiate','take into account']);
  const shared=h.ui.recommendedOldItems().find(item=>item.label==='investigate');
  assert.equal(shared.key,'word:first:investigate');
  assert.ok(shared.aliases.includes('word:later:investigate'));
  assert.ok(!labels(h).includes('go'));assert.ok(!labels(h).includes('look at'));
});

test('external learned range saves real lesson numbers and updates suggestions without changing study or writing evidence',()=>{
  const h=setup();h.render();
  h.ui.openTarget({lessonId:'now',targetKey:'word:now:book',roundKey:'daily-four',sentenceMode:'four-forms'});
  const active=h.ui.active;active.draft.answers.wh='What do I read?';active.draft.assisted=true;
  h.ui.setOldSelection(['word:later:negotiate']);
  h.changeRange(1,3);
  assert.equal(h.range.version,1);assert.equal(h.range.books['1'],3);assert.ok(labels(h).length>0);
  assert.ok(!labels(h).includes('negotiate'));assert.equal(h.ui.active,active);
  assert.equal(active.draft.roundKey,'daily-four');assert.equal(active.draft.answers.wh,'What do I read?');assert.equal(active.draft.assisted,true);
  assert.deepEqual(Array.from(active.draft.selectedOldKeys),['word:later:negotiate']);assert.deepEqual(h.records,{});
  const restored=setup({range:h.range,drafts:JSON.parse(JSON.stringify(h.drafts))});restored.render();assert.deepEqual(labels(restored),labels(h));
  h.changeRange(1,0);assert.deepEqual(labels(h),[]);assert.equal(active.draft.roundKey,'daily-four');
});

test('range imports clamp to real odd-numbered lessons and fail closed for malformed data and failed saves',()=>{
  const h=setup({range:{version:1,books:{'1':4,'2':999,'3':-1,'4':'7'}}});h.render();h.openRange();const html=h.render();
  assert.match(html,/<option value="3" selected>/);assert.doesNotMatch(html,/<option value="4"/);
  assert.ok(!labels(h).includes('negotiate'));assert.ok(!labels(h).includes('persuade'));
  h.changeRange(1,999);assert.equal(h.savedRanges.length,0);
  for(const range of [{version:2,books:{'1':5}},{version:1,books:Object.create({'1':5})},{version:1,books:{'1':NaN}},null]){
    h.setRange(range);h.render();assert.deepEqual(labels(h),[]);
  }
  const failed=setup({failRange:true});failed.render();failed.changeRange(1,3);
  assert.deepEqual(labels(failed),[]);assert.match(failed.notices.join(' '),/未保存|保存失败/);assert.deepEqual(failed.records,{});
});

test('saving each book range keeps nested controls visible and returns focus to that book without losing writing',()=>{
  const h=setup();h.render();
  h.openOld();h.openRange();h.render();h.openOld();
  const active=h.ui.active;active.draft.answers.affirmative='I keep an unfinished book sentence.';
  assert.equal(h.oldOpen,true);
  h.changeRange(1,3);
  assert.equal(h.oldOpen,true,'range save must preserve its expanded parent panel');
  assert.match(h.content.innerHTML,/<details class="sentence-learning-range"[^>]*\bopen\b/);
  assert.equal(h.document.activeElement?.dataset.sentenceLearningBook,'1');
  assert.ok(labels(h).length>0);
  h.changeRange(2,1);
  assert.equal(h.oldOpen,true);
  assert.equal(h.document.activeElement?.dataset.sentenceLearningBook,'2');
  assert.equal(h.ui.active,active);assert.equal(active.draft.answers.affirmative,'I keep an unfinished book sentence.');
});
