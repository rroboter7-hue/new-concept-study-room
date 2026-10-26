const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const uiPath = path.join(rootPath, 'sentence-practice.js');
const corePath = path.join(rootPath, 'sentence-core.js');
const lessons = [
  { id: 'old', book: 1, number: 1, title: 'Family', vocabulary: [{word:'sister',meaning:'姐妹'}], usage:[{phrase:'look at',meaning:'看'}] },
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

test('shows one editable sentence with all five accessible steps and explicit earlier-source choices',()=>{
  const h=setup(), html=h.render();
  assert.equal((html.match(/<textarea\b/g)||[]).length,1);
  assert.equal((html.match(/data-sentence-action="step"/g)||[]).length,5);
  assert.match(html,/maxlength="400"/);
  assert.match(html,/第 1 册.*第 1 课/);
  assert.match(html,/以前学过/);
  assert.doesNotMatch(html,/<option[^>]*>[^<]*future/);
  assert.doesNotMatch(html,/100%|自动掌握/);
});

test('manual earlier source makes its old word and phrase available without changing course completion',()=>{
  const h=setup();h.render();
  h.event('change',{sentenceSource:'old'},'old',true,true);
  const html=h.render();
  assert.match(html,/<option[^>]*value="word:old:sister"/);
  assert.match(html,/<option[^>]*value="phrase:old:look%20at"/);
  h.ui.flush();
  assert.deepEqual(h.records,{});
  assert.deepEqual(Object.values(h.drafts)[0].sourceLessonIds,['old']);
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
  assert.equal(Object.keys(h.drafts).length,0);
  h.runTimers();
  assert.equal(Object.values(h.drafts)[0].answers.affirmative.length,400);
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

test('restores explicit source and old selections from a saved per-target draft',()=>{
  const h=setup();h.render();h.event('change',{sentenceSource:'old'},'old',true,true);
  h.change('old-word','word:old:sister');h.change('old-phrase','phrase:old:look%20at');h.click('step',4);
  h.input('My sister and I look at the book.');h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});
  const html=restored.render();
  assert.match(html,/>My sister and I look at the book\.<\/textarea>/);
  assert.match(html,/value="word:old:sister" selected/);
  assert.match(html,/value="phrase:old:look%20at" selected/);
  assert.match(html,/data-sentence-source="old"[^>]*checked/);
});

test('checks local requirements without grading mastery and escapes rule feedback',()=>{
  const h=setup({records:{old:{attempts:1}},grammarCheck:()=>[{message:'Inspect <b>this</b>',original:'book',replacement:'book'}]});h.render();
  h.change('old-word','word:old:sister');h.change('old-phrase','phrase:old:look%20at');
  ['You look at the book.','You do not look at the book.','Do you look at the book?','Why do you look at the book?','My sister and I look at the book.'].forEach((answer,i)=>{h.click('step',i);h.input(answer);});
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
  assert.equal(Object.keys(h.drafts).length,0);
  assert.doesNotMatch(h.render(),/Outside input/);
});

test('keeps malformed and inherited history manually selectable rather than treating it as learned',()=>{
  for (const records of [{old:{completed:'true',attempts:'2'}}, Object.create({old:{completed:true}})]) {
    const h=setup({records}), html=h.render();
    const checkbox=html.match(/<input[^>]*data-sentence-source="old"[^>]*>/)[0];
    assert.doesNotMatch(checkbox,/disabled|checked/);
    h.event('change',{sentenceSource:'old'},'old',true,true);
    assert.match(h.render(),/<option[^>]*value="phrase:old:look%20at"/);
  }
});

test('does not offer an inflected form of the target as the different old word',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));
  lessonSet[0].vocabulary.push({word:'books',meaning:'书的复数'});
  const h=setup({records:{old:{completed:true}},lessonSet}), html=h.render();
  const oldSelect=html.match(/<select[^>]*data-sentence-select="old-word"[\s\S]*?<\/select>/)[0];
  assert.doesNotMatch(oldSelect,/word:old:books/);
  assert.match(oldSelect,/word:old:sister/);
});

test('reload restores the last selected target with its step, sources and old selections',()=>{
  const h=setup();h.render();h.event('change',{sentenceSource:'old'},'old',true,true);
  h.change('target','word:now:pen');h.change('old-word','word:old:sister');h.change('old-phrase','phrase:old:look%20at');h.click('step',4);
  h.input('My sister and I look at the pen.');h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))}), html=restored.render();
  assert.match(html,/<option value="word:now:pen" selected>/);
  assert.match(html,/>My sister and I look at the pen\.<\/textarea>/);
  assert.match(html,/value="word:old:sister" selected/);
  assert.match(html,/value="phrase:old:look%20at" selected/);
  assert.match(html,/data-sentence-source="old"[^>]*checked/);
});

test('a lesson without current vocabulary can select an earlier source and restore its old target on reload',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));lessonSet[1].vocabulary=[];
  const h=setup({lessonSet});assert.doesNotMatch(h.render(),/<textarea/);
  h.event('change',{sentenceSource:'old'},'old',true,true);
  assert.match(h.render(),/<option value="word:old:sister" selected>/);
  h.ui.flush();
  const restored=setup({lessonSet,drafts:JSON.parse(JSON.stringify(h.drafts))});
  assert.match(restored.render(),/<option value="word:old:sister" selected>/);
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

test('reenabling the only earlier source restores a stable editor when the lesson has no current vocabulary',()=>{
  const lessonSet=JSON.parse(JSON.stringify(lessons));lessonSet[1].vocabulary=[];
  const h=setup({lessonSet});h.render();
  h.event('change',{sentenceSource:'old'},'old',true,true);h.input('My sister is here.');
  h.event('change',{sentenceSource:'old'},'old',true,false);
  assert.doesNotMatch(h.render(),/<textarea/);
  h.event('change',{sentenceSource:'old'},'old',true,true);
  for(let index=0;index<3;index++) {
    const html=h.render();
    assert.match(html,/>My sister is here\.<\/textarea>/);
    assert.match(html,/data-sentence-source="old"[^>]*checked/);
  }
  h.ui.flush();
  const restored=setup({lessonSet,drafts:JSON.parse(JSON.stringify(h.drafts))});
  assert.match(restored.render(),/>My sister is here\.<\/textarea>/);
});
