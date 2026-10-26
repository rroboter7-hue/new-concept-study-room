const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.resolve(__dirname, '..');

function setup({drafts = {}, failSave = false, copyText = async () => {}, guided = '', grammarCheck} = {}) {
  const handlers = {}, timers = new Map(), fields = new Map(), copies = [], downloads = [], notices = [];
  let serial = 0, current = {id:'now',title:'Books'}, failing = failSave;
  const root = {innerHTML:'',querySelector(selector) {
    if (!fields.has(selector)) fields.set(selector,{innerHTML:'',textContent:'',dataset:{},focus(){this.focused=true;},select(){this.selected=true;}});
    return fields.get(selector);
  }};
  const scope = {console,document:{addEventListener(kind,handler){handlers[kind]=handler;},querySelector(selector){return selector==='#sentence-batch-content'?root:null;}},
    setTimeout(callback,delay){const id=++serial;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);}};
  scope.window=scope;
  vm.createContext(scope);
  for (const file of ['grammar-check.js','sentence-core.js','sentence-batch-core.js','sentence-batch-practice.js']) {
    const filename=path.join(directory,file);
    if(fs.existsSync(filename))vm.runInContext(fs.readFileSync(filename,'utf8'),scope);
  }
  assert.equal(typeof scope.SentenceBatchPractice,'function','standalone batch UI must be available');
  assert.ok(scope.StudySentenceBatch,'the actual batch core must be available');
  const ui = new scope.SentenceBatchPractice({getLesson:()=>current,getDrafts:()=>drafts,
    saveDraft(id,draft){if(failing)return false;drafts[id]=JSON.parse(JSON.stringify(draft));return true;},
    grammarCheck:grammarCheck || (text=>scope.StudyGrammar.check(text)),sentenceCheck:options=>scope.StudySentences.check(options),
    getGuidedText:()=>guided,toast:message=>notices.push(message),
    copyText:async text=>{copies.push(text);return copyText(text);},downloadText:(name,text)=>downloads.push({name,text})});
  const render=()=>{root.innerHTML=ui.render();return root.innerHTML;};
  function event(kind,dataset,value,{inside=true}={}) {
    const target={dataset,value,closest(selector){return selector==='#sentence-batch-content'?(inside?root:null):selector==='[data-batch-action]'&&dataset.batchAction?target:null;}};
    return handlers[kind]?.({target,preventDefault(){}});
  }
  function next(delay=0) {const pair=[...timers].find(([,job])=>job.delay===delay);if(!pair)return false;timers.delete(pair[0]);pair[1].callback();return true;}
  return {ui,scope,root,fields,drafts,timers,copies,downloads,notices,render,event,next,
    input:(value,field='raw')=>event('input',{batchInput:field},value),
    mode:value=>event('change',{batchMode:'mode'},value),click:action=>event('click',{batchAction:action}),
    finish(){while(next(0)){}},setLesson:value=>{current=value;},setFailure:value=>{failing=value;}};
}

test('standalone UI accepts arbitrary lines, escapes text, and ignores events outside its section',()=>{
  const h=setup();let html=h.render();
  assert.match(html,/id="sentence-batch-content"/);
  assert.match(html,/data-batch-input="raw"/);
  assert.doesNotMatch(html,/maxlength=/);
  const text='<img src=x onerror=alert(1)>\n'+Array.from({length:120},(_,i)=>`I read book ${i}.`).join('\n');
  h.input(text);h.event('input',{batchInput:'raw'},'outside',{inside:false});
  h.ui.flush();
  assert.equal(h.drafts.now.rawText,text);
  html=h.render();assert.match(html,/&lt;img src=x/);assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/121 句/);
});

test('checks every row in yielding chunks, pages cards, and exports all rows with real local findings',async()=>{
  const h=setup();h.render();
  h.input('I enjoys reading.\n'+Array.from({length:104},(_,i)=>`I read a book ${i}.`).join('\n'));
  await h.click('check');
  assert.equal(h.ui.results.length,25);
  assert.match(h.render(),/25 \/ 105/);
  h.finish();
  assert.equal(h.ui.results.length,105);
  let html=h.render();
  assert.equal((html.match(/class="batch-result"/g)||[]).length,50);
  assert.match(html,/仍需复核/);assert.doesNotMatch(html,/全部正确|整句正确/);
  assert.equal(h.ui.results[0].status,'needs-work');
  await h.click('more');html=h.render();assert.equal((html.match(/class="batch-result"/g)||[]).length,100);
  await h.click('export');
  assert.match(h.downloads[0].text,/I read a book 103\./);
  assert.match(h.downloads[0].text,/I enjoys reading\./);
});

test('cancel and edit invalidate late work without losing raw text',async()=>{
  const h=setup();h.render();const raw=Array.from({length:80},(_,i)=>`I read book ${i}.`).join('\n');h.input(raw);
  await h.click('check');const queued=[...h.timers.values()].find(job=>job.delay===0).callback;
  h.ui.cancelCheck();queued();assert.equal(h.ui.results.length,25);
  h.input('I keep this new sentence.');queued();assert.equal(h.ui.results.length,0);
  h.ui.flush();assert.equal(h.drafts.now.rawText,'I keep this new sentence.');
});

test('course changes and restoring storage prevent stale checks, saves and clipboard callbacks',async()=>{
  let resolveCopy;const h=setup({copyText:()=>new Promise(resolve=>{resolveCopy=resolve;})});h.render();
  h.input(Array.from({length:60},()=> 'I read a book.').join('\n'));await h.click('check');
  const late=[...h.timers.values()].find(job=>job.delay===0).callback;
  const pending=h.click('copy');h.setLesson({id:'next',title:'Pens'});h.render();resolveCopy();await pending;late();
  assert.equal(h.ui.results.length,0);assert.doesNotMatch(h.render(),/已复制/);
  h.input('unsaved old text');const oldSave=[...h.timers.values()].find(job=>job.delay===450).callback;
  h.drafts.next={mode:'free',rawText:'Restored text.',notes:'restored'};h.ui.reloadFromStorage();oldSave();
  assert.match(h.render(),/Restored text\./);assert.equal(h.drafts.next.rawText,'Restored text.');
});

test('conversion templates and guided text append without overwriting prior writing',async()=>{
  const guided='目标词：book\n原句：I read a book.\n否定句：I do not read a book.';
  const h=setup({guided});h.render();h.input('My existing writing.\n');
  await h.click('template');await h.click('guided');h.ui.flush();
  assert.ok(h.drafts.now.rawText.startsWith('My existing writing.\n'));
  assert.ok(h.drafts.now.rawText.endsWith(guided));assert.equal(h.drafts.now.mode,'conversion');
  await h.click('copy');assert.match(h.copies[0],/I read a book\./);assert.match(h.copies[0],/I do not read a book\./);
});

test('long prompts copy one complete part at a time, and clipboard failure gives escaped manual text',async()=>{
  const h=setup({copyText:async()=>{throw new Error('denied');}});h.render();
  const rows=Array.from({length:115},(_,i)=>`Sentence ${i} <b> ${'word '.repeat(35)}.`);
  h.input(rows.join('\n'));await h.click('copy');
  assert.ok(h.ui.promptChunks.length>1);assert.equal(h.copies[0],h.ui.promptChunks[0].text);
  let html=h.render();assert.match(html,/readonly/);assert.match(html,/手动复制/);assert.match(html,/\\u003cb\\u003e/);assert.doesNotMatch(html,/<b>/);
  await h.click('prompt-next');await h.click('copy');assert.equal(h.copies[1],h.ui.promptChunks[1].text);
  await h.click('prompt-previous');assert.equal(h.ui.promptIndex,0);
});

test('notes and complete drafts debounce, survive failed saves and course switches, and remain exportable',async()=>{
  const h=setup({failSave:true});h.render();const raw='I read a book.\n'+ 'long '.repeat(3000);h.input(raw);h.input('<script>notes</script>','notes');
  assert.equal(Object.keys(h.drafts).length,0);assert.equal(h.next(450),true);
  assert.match(h.render(),/未保存/);assert.match(h.render(),/&lt;script&gt;notes/);
  h.setLesson({id:'next',title:'Pens'});h.render();h.input('I have a pen.');h.setLesson({id:'now',title:'Books'});
  assert.match(h.render(),/I read a book\./);await h.click('export');assert.ok(h.downloads[0].text.includes(raw));assert.match(h.downloads[0].text,/<script>notes<\/script>/);
  h.setFailure(false);assert.equal(h.ui.flush(),true);assert.equal(h.drafts.now.rawText,raw);assert.equal(h.drafts.now.notes,'<script>notes</script>');
});

test('editing the same lesson while clipboard is pending cannot restore stale success or fallback',async()=>{
  let finish;const h=setup({copyText:()=>new Promise(resolve=>{finish=resolve;})});h.render();h.input('Old draft.');const pending=h.click('copy');h.input('New draft.');finish();await pending;
  assert.match(h.render(),/输入已改变/);assert.doesNotMatch(h.render(),/已复制第/);assert.equal(h.ui.fallback,'');assert.equal(h.ui.promptChunks.length,0);
});
