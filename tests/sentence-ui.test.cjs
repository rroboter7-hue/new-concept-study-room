const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const uiPath = path.join(rootPath, 'sentence-practice.js');
const corePath = path.join(rootPath, 'sentence-core.js');
const lessons = [
  { id: 'old', book: 1, number: 1, title: 'Family', vocabulary: [{word:'friendly',pos:'adj.',meaning:'友好的'}], usage:[{phrase:'look at',meaning:'看'}] },
  { id: 'now', book: 1, number: 2, title: 'Books', vocabulary: [{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'}], usage:[] },
  { id: 'future', book: 1, number: 3, title: 'Tomorrow', vocabulary: [{word:'future',meaning:'将来'}], usage:[{phrase:'go to',meaning:'去'}] }
];

function setup({records = {}, drafts = {}, failure = false, grammarCheck, lessonSet = lessons} = {}) {
  const handlers = {}, timers = new Map(), fields = {}, notices = [];
  const content = { innerHTML:'', querySelector: selector => fields[selector] ||= {textContent:'',innerHTML:''} };
  let timerId = 0, current = lessonSet[1], fail = failure;
  const document = {addEventListener:(kind,callback)=>handlers[kind]=callback, querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const context = {document, console, setTimeout:callback=>{timers.set(++timerId,callback);return timerId;}, clearTimeout:id=>timers.delete(id)};
  context.window = context;
  vm.createContext(context);
  if (fs.existsSync(corePath)) vm.runInContext(fs.readFileSync(corePath,'utf8'),context);
  if (fs.existsSync(uiPath)) vm.runInContext(fs.readFileSync(uiPath,'utf8'),context);
  assert.equal(typeof context.SentencePractice,'function','five-sentence component must be available');
  const ui = new context.SentencePractice({getLesson:()=>current,getLessons:()=>lessonSet,getRecords:()=>records,getDrafts:()=>drafts,saveDraft:(key,draft)=>{if(fail)return false;drafts[key]=JSON.parse(JSON.stringify(draft));return true;},grammarCheck,toast:message=>notices.push(message)});
  const render=()=>{content.innerHTML=ui.render();return content.innerHTML;};
  function event(kind,dataset,value,inside=true,checked=false) {
    const target={dataset,value,checked,closest:selector=>selector==='#sentence-practice-content'?(inside?content:null):selector==='[data-sentence-action]'&&dataset.sentenceAction?target:null};
    handlers[kind]?.({target,preventDefault(){}});
  }
  const change=(key,value)=>event('change',{sentenceSelect:key},value);
  const input=value=>event('input',{sentenceInput:'answer'},value);
  const click=(action,step)=>event('click',{sentenceAction:action,sentenceStep:String(step??'')});
  return {ui,render,event,change,input,click,drafts,records,notices,context,timers,setLesson:l=>{current=l;},setFailure:v=>{fail=v;},runTimers:()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}};
}

const selected = h => Array.from(h.ui.selectedOldItems(), item => item.label).sort();
function choose(h, labels) {
  const keys=labels.map(label=>{const item=h.ui.wordBank().find(item=>item.label===label);assert.ok(item,`${label} should be available from earlier lessons`);return item.key;});
  h.ui.setOldSelection(keys);
}

test('shows one editable sentence with five accessible steps and a focused old-word drawer',()=>{
  const h=setup(), html=h.render();
  assert.equal((html.match(/<textarea\b/g)||[]).length,1);
  assert.equal((html.match(/data-sentence-action="step"/g)||[]).length,5);
  assert.match(html,/maxlength="400"/);
  assert.match(html,/data-sentence-select="target"/);
  assert.match(html,/data-sentence-action="open-word-picker"/);
  assert.match(html,/<dialog[^>]*aria-labelledby=/);
  assert.match(html,/data-sentence-input="word-search"/);
  assert.doesNotMatch(html,/data-sentence-source=|data-sentence-select="old-(?:word|phrase)"|sentence-knowledge-source/);
  assert.doesNotMatch(html,/<option[^>]*>[^<]*future/);
  assert.doesNotMatch(html,/100%|自动掌握/);
});

test('earlier vocabulary is selectable without site records and does not change course completion',()=>{
  const h=setup();h.render();
  for(const label of ['friendly','look at']) {
    const item=h.ui.wordBank().find(item=>item.label===label);assert.ok(item);
    h.event('change',{sentenceOldKey:item.key},item.key,true,true);
  }
  assert.deepEqual(selected(h),['friendly','look at']);
  h.ui.flush();
  assert.deepEqual(h.records,{});
  assert.deepEqual(Object.values(h.drafts)[0].sourceLessonIds,[]);
  assert.equal(h.ui.active.draft.assisted,false);
});

test('keeps different targets and lessons isolated while preserving the current step',()=>{
  const h=setup({records:{old:{completed:true}}});h.render();
  h.input('I have a book.');h.click('step',2);h.input('Do I have a book?');
  h.change('target','word:now:pen');h.input('I have a pen.');
  h.change('target','word:now:book');
  assert.match(h.render(),/>Do I have a book\?<\/textarea>/);
  h.setLesson(lessons[2]);h.render();h.input('The future is bright.');
  h.setLesson(lessons[1]);
  assert.match(h.render(),/>Do I have a book\?<\/textarea>/);
  h.ui.flush();
  const entries=Object.values(h.drafts);
  assert.ok(entries.some(d=>d.answers.affirmative==='I have a book.'&&d.answers.yesno==='Do I have a book?'&&d.step===2));
  assert.ok(entries.some(d=>d.answers.affirmative==='I have a pen.'));
});

test('debounces draft input, enforces 400 characters, and escapes stored HTML when rendering',()=>{
  const h=setup();h.render();h.input('<img src=x onerror=alert(1)>'.repeat(25));
  assert.equal(h.drafts[h.ui.active.key],undefined);
  h.runTimers();
  assert.equal(h.drafts[h.ui.active.key].answers.affirmative.length,400);
  assert.match(h.render(),/&lt;img src=x/);
  assert.doesNotMatch(h.render(),/<img src=x/);
});

test('reports failed persistence honestly and retains unsaved text across target changes',()=>{
  const h=setup({failure:true});h.render();h.input('I keep this book.');
  assert.equal(h.ui.flush(),false);
  assert.match(h.render(),/未保存/);
  assert.match(h.render(),/>I keep this book\.<\/textarea>/);
  h.change('target','word:now:pen');h.change('target','word:now:book');
  assert.match(h.render(),/>I keep this book\.<\/textarea>/);
  h.setFailure(false);
  assert.equal(h.ui.flush(),true);
  assert.ok(Object.values(h.drafts).some(d=>d.answers.affirmative==='I keep this book.'));
});

test('restores multiple old selections with a saved per-target writing draft',()=>{
  const h=setup();h.render();choose(h,['friendly','look at']);h.click('step',4);
  h.input('My friendly sister and I look at the book.');h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});
  const html=restored.render();
  assert.match(html,/>My friendly sister and I look at the book\.<\/textarea>/);
  assert.deepEqual(selected(restored),['friendly','look at']);
  assert.equal(restored.ui.active.draft.step,4);
  assert.match(html,/data-sentence-action="remove-old"[^>]*aria-label="移除 friendly/);
  assert.match(html,/data-sentence-action="remove-old"[^>]*aria-label="移除 look at/);
});

test('checks local requirements without grading mastery and escapes rule feedback',()=>{
  const h=setup({records:{old:{attempts:1}},grammarCheck:()=>[{message:'Inspect <b>this</b>',original:'book',replacement:'book'}]});h.render();
  choose(h,['friendly','look at']);
  ['You look at the book.','You do not look at the book.','Do you look at the book?','Why do you look at the book?','My friendly sister and I look at the book.'].forEach((answer,i)=>{h.click('step',i);h.input(answer);});
  h.click('check');const html=h.render();
  assert.match(html,/sentence-feedback-row/);
  assert.match(html,/Inspect &lt;b&gt;this&lt;\/b&gt;/);
  assert.doesNotMatch(html,/Inspect <b>/);
  assert.match(html,/句意|自然/);
  assert.deepEqual(h.records,{old:{attempts:1}});
  assert.doesNotMatch(html,/100%|本次得分/);
});

test('ignores delegated events that originate outside its own root',()=>{
  const h=setup();h.render();h.event('input',{sentenceInput:'answer'},'Outside input',false);h.ui.flush();
  assert.equal(h.drafts[h.ui.active.key],undefined);
  assert.doesNotMatch(h.render(),/Outside input/);
});

test('malformed and inherited history neither blocks earlier choices nor treats them as learned targets',()=>{
  for (const records of [{old:{completed:'true',attempts:'2'}}, Object.create({old:{completed:true}})]) {
    const originalRecords=JSON.stringify(records),ownedOld=Object.hasOwn(records,'old');
    const h=setup({records}), html=h.render();
    assert.doesNotMatch(html,/<option[^>]*value="(?:word|phrase):old:/);
    assert.deepEqual(selected(h),[]);
    choose(h,['friendly','look at']);h.ui.flush();
    assert.deepEqual(selected(h),['friendly','look at']);
    assert.deepEqual(Object.values(h.drafts)[0].sourceLessonIds,[]);
    assert.equal(JSON.stringify(h.records),originalRecords);
    assert.equal(Object.hasOwn(h.records,'old'),ownedOld);
  }
});

test('a freely selected inflected target cannot satisfy the different-old-word transform requirement',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));
  lessonSet[0].vocabulary.push({word:'books',pos:'v.',meaning:'预订'});
  const h=setup({lessonSet});h.render();choose(h,['books','friendly','look at']);
  assert.deepEqual(selected(h),['books','friendly','look at']);
  assert.equal(h.ui.oldWord().word,'friendly');
  assert.equal(h.ui.oldPhrase().phrase,'look at');
});

test('reload restores the last selected target with its step and multiple old selections',()=>{
  const h=setup();h.render();
  h.change('target','word:now:pen');choose(h,['friendly','look at']);h.click('step',4);
  h.input('My friendly sister and I look at the pen.');h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))}), html=restored.render();
  assert.match(html,/<option value="word:now:pen" selected>/);
  assert.match(html,/>My friendly sister and I look at the pen\.<\/textarea>/);
  assert.equal(restored.ui.active.draft.step,4);
  assert.deepEqual(selected(restored),['friendly','look at']);
});

test('a lesson without current vocabulary restores an available learned target while an empty range stays explicit',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));lessonSet[1].vocabulary=[];
  const empty=setup({lessonSet});assert.doesNotMatch(empty.render(),/<textarea/);assert.match(empty.render(),/暂无可用/);
  const records={old:{completed:true}},h=setup({lessonSet,records});
  assert.match(h.render(),/<option value="word:old:friendly" selected>/);
  h.input('My friendly neighbour is here.');
  h.ui.flush();
  const restored=setup({lessonSet,records,drafts:JSON.parse(JSON.stringify(h.drafts))});
  assert.match(restored.render(),/<option value="word:old:friendly" selected>/);
  assert.match(restored.render(),/>My friendly neighbour is here\.<\/textarea>/);
});

test('reloading restored storage cancels stale pending drafts and displays the imported target and answers',()=>{
  const h=setup();h.render();h.input('Old unsaved book.');
  const imported=setup();imported.render();imported.change('target','word:now:pen');imported.click('step',2);imported.input('Do you have the imported pen?');imported.ui.flush();
  Object.keys(h.drafts).forEach(key=>delete h.drafts[key]);Object.assign(h.drafts,JSON.parse(JSON.stringify(imported.drafts)));
  assert.equal(typeof h.ui.reloadFromStorage,'function');
  h.ui.reloadFromStorage();
  assert.equal(h.timers.size,0,'stale pending save timer must be cancelled');
  const html=h.render();
  assert.match(html,/<option value="word:now:pen" selected>/);
  assert.match(html,/>Do you have the imported pen\?<\/textarea>/);
  assert.doesNotMatch(html,/Old unsaved book/);
  h.runTimers();h.ui.flush();
  assert.equal(JSON.stringify(h.drafts).includes('Old unsaved book.'),false,'old in-memory input must not overwrite imported storage');
});

test('clearing and reselecting old expressions never removes an available learned target or its draft',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));lessonSet[1].vocabulary=[];
  const records={old:{completed:true}},h=setup({lessonSet,records});h.render();
  choose(h,['look at']);h.input('My friendly sister is here.');h.click('clear-old');
  assert.deepEqual(selected(h),[]);
  assert.match(h.render(),/>My friendly sister is here\.<\/textarea>/);
  choose(h,['look at']);
  for(let index=0;index<3;index++) {
    const html=h.render();
    assert.match(html,/>My friendly sister is here\.<\/textarea>/);
    assert.deepEqual(selected(h),['look at']);
    assert.equal(h.ui.target().key,'word:old:friendly');
  }
  h.ui.flush();
  const restored=setup({lessonSet,records,drafts:JSON.parse(JSON.stringify(h.drafts))});
  assert.match(restored.render(),/>My friendly sister is here\.<\/textarea>/);
  assert.deepEqual(selected(restored),['look at']);
});
