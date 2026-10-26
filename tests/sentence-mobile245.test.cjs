const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'old-word',book:1,number:1,title:'Family <script>bad()</script>',vocabulary:[{word:'sister',meaning:'姐妹 & 家人'}],usage:[]},
  {id:'old-phrase',book:1,number:2,title:'Look "here"',vocabulary:[{word:'picture',meaning:'图画'}],usage:[{phrase:'look at',meaning:'看 <仔细>'}]},
  {id:'current',book:1,number:3,title:'Books',vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'}],usage:[{phrase:'talk about',meaning:'谈论'}]}
];

function setup({records={},drafts={},mobile=true}={}) {
  const handlers={},timers=new Map(),fields={},evidence=[];let timer=0,current=lessons[2],markup='',failure=false;
  const content={get innerHTML(){return markup;},set innerHTML(value){markup=value;const panel=value.match(/<details class="sentence-adjustments"([^>]*)>/);fields['.sentence-adjustments']=panel?{open:/\bopen\b/.test(panel[1])}:null;},querySelector:selector=>selector==='.sentence-adjustments'?fields[selector]||null:fields[selector] ||= {textContent:'',innerHTML:'',focus(){}}};
  const document={body:{classList:{contains:name=>mobile && ['mls-mobile','mls-book-workspace'].includes(name)}},addEventListener:(kind,fn)=>handlers[kind]=fn,querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const context={document,console,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)};
  context.window=context;vm.createContext(context);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const ui=new context.SentencePractice({getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>records,getDrafts:()=>drafts,saveDraft:(key,value)=>{if(failure)return false;drafts[key]=JSON.parse(JSON.stringify(value));return true;},onEvidence:value=>{evidence.push(JSON.parse(JSON.stringify(value)));return true;}});
  const render=()=>content.innerHTML=ui.render();
  function event(kind,dataset,value='',extra={}){
    const target={dataset,value,...extra,closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'&&dataset.sentenceAction?target:null};
    handlers[kind]?.({target,preventDefault(){}});
  }
  return {ui,render,drafts,records,evidence,change:(name,value)=>event('change',{sentenceSelect:name},value),source:(id,checked)=>event('change',{sentenceSource:id},id,{checked}),step:index=>event('click',{sentenceAction:'step',sentenceStep:String(index)}),input:value=>event('input',{sentenceInput:'answer'},value),check:()=>event('click',{sentenceAction:'check'}),reference:open=>event('toggle',{sentenceReference:''},'',{open}),setFailure:value=>{failure=value;},nativeOpen:open=>{content.querySelector('.sentence-adjustments').open=open;},setLesson:lesson=>{current=lesson;},toggle:open=>{content.querySelector('.sentence-adjustments').open=open;event('toggle',{sentenceAdjustments:''},'',{open});}};
}

function timeline(html){const found=html.match(/<ol class="sentence-knowledge[^\"]*"[\s\S]*?<\/ol>/);assert.ok(found,'selected knowledge should appear together before the editor');return found[0];}

test('mobile first sentence keeps all selectors reachable while only exposing its current target before writing',()=>{
  const h=setup({records:{'old-word':{completed:true},'old-phrase':{attempts:1}}});const html=h.render();
  const knowledge=timeline(html);
  assert.match(knowledge,/data-sentence-knowledge="target"[\s\S]*?<strong[^>]*>book<\/strong>/);
  assert.equal((knowledge.match(/data-sentence-knowledge=/g)||[]).length,1);
  assert.match(knowledge,/<span class="sentence-knowledge-source">第1册 · 第3课<\/span>/);
  assert.doesNotMatch(knowledge,/data-lesson="current"/,'the current lesson needs no redundant return link');
  const details=html.match(/<details class="sentence-adjustments"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.ok(details,'selectors belong in the reachable adjustment disclosure');
  assert.match(details,/<summary>调整练习用词<\/summary>/);
  assert.doesNotMatch(details,/^<details[^>]* open/);
  for(const name of ['target','old-word','old-phrase'])assert.match(details,new RegExp('data-sentence-select="'+name+'"'));
  assert.match(details,/data-sentence-source="old-word"/);
  assert.equal((html.match(/data-sentence-action="step"/g)||[]).length,5);
  assert.match(html,/sentence-step-count[^>]*>第 1 句 \/ 共 5 句/);
  assert.equal((html.match(/class="button primary"/g)||[]).length,1);
  assert.match(html,/data-sentence-action="check">检查五句基本要求<\/button>/);
});

test('combined sentence links the actual explicit selections to their own escaped source lessons',()=>{
  const h=setup({records:{'old-word':{completed:true},'old-phrase':{attempts:1}}});h.render();h.step(4);
  h.change('old-word','word:old-word:sister');h.change('old-phrase','phrase:old-phrase:look%20at');
  const html=h.render(),knowledge=timeline(html);
  assert.equal((knowledge.match(/data-sentence-knowledge=/g)||[]).length,3);
  assert.match(knowledge,/data-sentence-knowledge="target"[\s\S]*?book[\s\S]*?data-sentence-knowledge="old-word"[\s\S]*?sister[\s\S]*?data-sentence-knowledge="old-phrase"[\s\S]*?look at/);
  assert.match(knowledge,/data-sentence-knowledge="old-word"[\s\S]*?data-lesson="old-word"[^>]*aria-label="回看第 1 册 · 第 1 课 · Family &lt;script&gt;bad\(\)&lt;\/script&gt;"/);
  assert.match(knowledge,/data-sentence-knowledge="old-phrase"[\s\S]*?data-lesson="old-phrase"[^>]*aria-label="回看第 1 册 · 第 2 课 · Look &quot;here&quot;"/);
  assert.match(knowledge,/<span class="sentence-knowledge-source">第1册 · 第1课<\/span>/);
  assert.match(knowledge,/<span class="sentence-knowledge-source">第1册 · 第2课<\/span>/);
  assert.doesNotMatch(knowledge,/<span class="sentence-knowledge-source">[^<]*(?:Family|Look|Books)/,'visible source badges omit long lesson titles');
  assert.match(knowledge,/姐妹 &amp; 家人/);assert.match(knowledge,/看 &lt;仔细&gt;/);
  assert.doesNotMatch(knowledge,/<script>|<仔细>/);
  assert.ok(html.indexOf(knowledge)<html.indexOf('<textarea'),'knowledge belongs immediately before the answer flow');
  assert.match(html,/sentence-combination[^>]*>[\s\S]*?book[\s\S]*?sister[\s\S]*?look at/);
});

test('empty or withdrawn old sources never produce a made-up selected word or source link',()=>{
  const h=setup();h.render();h.step(4);
  let knowledge=timeline(h.render());
  assert.match(knowledge,/尚未选择旧词/);assert.match(knowledge,/尚未选择旧用法/);
  assert.equal((knowledge.match(/data-lesson=/g)||[]).length,0,'unselected old knowledge provides no invented source link');
  assert.doesNotMatch(knowledge,/sister|look at|private|postcard/);
  h.source('old-word',true);h.source('old-phrase',true);
  assert.match(timeline(h.render()),/尚未选择旧词/,'making knowledge available must not select it');
  h.change('old-word','word:old-word:sister');h.change('old-phrase','phrase:old-phrase:look%20at');h.input('My sister and I look at the book.');
  h.source('old-word',false);h.source('old-phrase',false);
  const html=h.render();knowledge=timeline(html);
  assert.match(knowledge,/尚未选择旧词/);assert.match(knowledge,/尚未选择旧用法/);
  assert.doesNotMatch(knowledge,/data-lesson="old-/);
  assert.match(html,/>My sister and I look at the book\.<\/textarea>/);
  assert.equal(h.ui.active.draft.oldWordKey,'');assert.equal(h.ui.active.draft.oldPhraseKey,'');
  assert.deepEqual(h.records,{});
});

test('an earlier word reused as the current practice target retains its real source return link',()=>{
  const h=setup({records:{'old-word':{completed:true}}});h.render();h.change('target','word:old-word:sister');
  const knowledge=timeline(h.render());
  assert.match(knowledge,/复习目标词/);
  assert.match(knowledge,/<span class="sentence-knowledge-source">第1册 · 第1课<\/span>/);
  assert.match(knowledge,/data-lesson="old-word"[^>]*aria-label="回看第 1 册 · 第 1 课 · Family &lt;script&gt;bad\(\)&lt;\/script&gt;"/);
});

test('mobile adjustments survive selection redraws and retain the saved step, selected knowledge and 400-character draft',()=>{
  const h=setup();h.render();h.toggle(true);h.source('old-word',true);h.source('old-phrase',true);
  h.change('old-word','word:old-word:sister');h.change('old-phrase','phrase:old-phrase:look%20at');h.step(4);h.input('A'.repeat(401));h.ui.flush();
  assert.match(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
  h.toggle(false);assert.doesNotMatch(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});const html=restored.render();
  assert.match(html,/sentence-step-count[^>]*>第 5 句 \/ 共 5 句/);
  assert.match(timeline(html),/>sister<\/strong>/);assert.match(timeline(html),/>look at<\/strong>/);
  assert.match(html,new RegExp('>'+ 'A'.repeat(400) +'<\\/textarea>'));
  assert.match(html,/maxlength="400"/);
});

test('native-open adjustments remain open through target, old knowledge and source changes before toggle delivery',()=>{
  const changes=[{field:'target',value:'word:current:pen'},{field:'old-word',value:'word:old-word:sister'},{field:'old-phrase',value:'phrase:old-phrase:look%20at'},{source:'old-word'}];
  for(const change of changes){
    const h=setup({records:change.source?{}:{'old-word':{completed:true},'old-phrase':{completed:true}}});h.render();h.nativeOpen(true);
    assert.equal(h.ui.adjustmentsOpen,false,'native state changes before its deferred toggle event');
    if(change.source)h.source(change.source,true);else h.change(change.field,change.value);
    assert.match(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/,'changing a practice selection must keep native-open adjustments available');
    h.ui.flush();
    assert.ok(Object.values(h.drafts).every(draft=>!Object.hasOwn(draft,'adjustmentsOpen')),'disclosure state never enters learning drafts');
  }
});

test('switching lessons closes the old lesson adjustment disclosure',()=>{
  const h=setup();h.render();h.nativeOpen(true);h.setLesson(lessons[1]);
  assert.doesNotMatch(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
});

test('desktop keeps the upstream flexible sentence layout outside the new mobile workspace mode',()=>{
  const h=setup({mobile:false});const html=h.render();
  assert.match(html,/一个目标，灵活写五句/);assert.doesNotMatch(html,/sentence-knowledge|sentence-adjustments|sentence-step-count/);
});

test('mobile uses flexible prompts by default and keeps optional transform mode and its answers separate',()=>{
  const h=setup();let html=h.render();
  assert.match(html,/aria-label="第 1 步 换一个语境/);
  assert.match(html,/data-sentence-select="mode"/);assert.match(html,/灵活五句/);
  h.input('I keep a book in my bag.');h.step(1);html=h.render();
  assert.match(html,/补充时间地点/);assert.doesNotMatch(html,/class="sentence-original"/);
  h.change('mode','transform');html=h.render();
  assert.match(html,/肯定句/);assert.equal(h.ui.active.draft.answers.affirmative,'');
  h.change('mode','flexible');assert.equal(h.ui.active.draft.answers.affirmative,'I keep a book in my bag.');
  h.step(4);assert.match(h.render(),/sentence-step-hint[^>]*>可[^<]*旧知[^<]*换个语境/);
});

test('mobile daily phrase target keeps native reference assistance and emits evidence only after a saved complete check',()=>{
  const h=setup();h.render();
  assert.equal(h.ui.openTarget({lessonId:'current',targetKey:'daily:phrase:talk',expression:'talk about',kind:'phrase',roundKey:'day-1'}),true);
  const html=h.render(),knowledge=timeline(html);
  assert.match(knowledge,/本课目标用法/);assert.match(knowledge,/>talk about<\/strong>/);assert.doesNotMatch(knowledge,/undefined|data-lesson="current"/);
  assert.match(html,/<details class="sentence-reference" data-sentence-reference>/);
  assert.match(html,/<summary data-sentence-action="reference">/);
  h.reference(true);h.reference(false);assert.equal(h.ui.active.draft.assisted,true);
  const answers=['We talk about books at home.','Yesterday we talked about books in class.','My sister talks about the book after dinner.','Do they talk about pens at school?','I am talking about the story with friends.'];
  answers.forEach((answer,index)=>{h.step(index);h.input(answer);});
  assert.equal(h.evidence.length,0);h.setFailure(true);h.check();assert.equal(h.evidence.length,0);
  h.setFailure(false);h.check();assert.equal(h.evidence.length,1);
  assert.deepEqual({target:h.evidence[0].target,targetKey:h.evidence[0].targetKey,kind:h.evidence[0].kind,roundKey:h.evidence[0].roundKey,mode:h.evidence[0].mode,complete:h.evidence[0].complete,assisted:h.evidence[0].assisted,rulesOnly:h.evidence[0].rulesOnly},{target:'talk about',targetKey:'daily:phrase:talk',kind:'phrase',roundKey:'day-1',mode:'flexible',complete:true,assisted:true,rulesOnly:true});
  assert.match(h.render(),/本轮已查看参考示例/);
  h.ui.reloadFromStorage();h.ui.openTarget({lessonId:'current',expression:'talk about',kind:'phrase',roundKey:'day-1'});assert.equal(h.ui.active.draft.assisted,true);
});

test('an earlier phrase used as a mobile target retains the exact escaped source return route',()=>{
  const h=setup({records:{'old-phrase':{completed:true}}});h.render();h.change('target','phrase:old-phrase:look%20at');
  const knowledge=timeline(h.render());
  assert.match(knowledge,/复习目标用法/);assert.match(knowledge,/>look at<\/strong>/);
  assert.match(knowledge,/data-lesson="old-phrase"[^>]*aria-label="回看第 1 册 · 第 2 课 · Look &quot;here&quot;"/);
});
