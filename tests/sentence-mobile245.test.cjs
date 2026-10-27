const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'old-word',book:1,number:1,title:'Family <script>bad()</script>',vocabulary:[{word:'friendly',pos:'adj.',meaning:'友好 & 热情'}],usage:[]},
  {id:'old-phrase',book:1,number:2,title:'Look "here"',vocabulary:[{word:'send',pos:'v.',meaning:'寄送'}],usage:[{phrase:'look at',meaning:'看 <仔细>'}]},
  {id:'current',book:1,number:3,title:'Books',vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'}],usage:[{phrase:'talk about',meaning:'谈论'}]}
];

function setup({records={},drafts={},mobile=true}={}) {
  const handlers={},timers=new Map(),fields={},evidence=[],focusCalls=[];let timer=0,current=lessons[2],markup='',failure=false;
  const field=selector=>fields[selector] ||= {textContent:'',innerHTML:'',focus(){},setAttribute(){}};
  const trigger={focus:options=>focusCalls.push(options)};
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector:field,querySelectorAll:()=>[],addEventListener(){}};
  const content={get innerHTML(){return markup;},set innerHTML(value){markup=value;const panel=value.match(/<details class="sentence-adjustments"([^>]*)>/);fields['.sentence-adjustments']=panel?{open:/\bopen\b/.test(panel[1])}:null;},querySelector:selector=>selector==='.sentence-word-dialog'?dialog:selector==='.sentence-adjustments'?fields[selector]||null:field(selector)};
  const document={activeElement:trigger,body:{classList:{contains:name=>mobile && ['mls-mobile','mls-book-workspace'].includes(name)}},addEventListener:(kind,fn)=>handlers[kind]=fn,querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const context={document,console,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)};
  context.window=context;vm.createContext(context);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const ui=new context.SentencePractice({getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>records,getDrafts:()=>drafts,saveDraft:(key,value)=>{if(failure)return false;drafts[key]=JSON.parse(JSON.stringify(value));return true;},onEvidence:value=>{evidence.push(JSON.parse(JSON.stringify(value)));return true;}});
  const render=()=>content.innerHTML=ui.render();
  function event(kind,dataset,value='',extra={}){
    const target={dataset,value,...extra,closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'&&dataset.sentenceAction?target:null};
    handlers[kind]?.({target,preventDefault(){}});
  }
  return {ui,render,drafts,records,evidence,dialog,focusCalls,event,open:()=>ui.openWordPicker(trigger),close:()=>ui.closeWordPicker(),change:(name,value)=>event('change',{sentenceSelect:name},value),step:index=>event('click',{sentenceAction:'step',sentenceStep:String(index)}),input:value=>event('input',{sentenceInput:'answer'},value),check:()=>event('click',{sentenceAction:'check'}),reference:open=>event('toggle',{sentenceReference:''},'',{open}),setFailure:value=>{failure=value;},nativeOpen:open=>{content.querySelector('.sentence-adjustments').open=open;},setLesson:lesson=>{current=lesson;},toggle:open=>{content.querySelector('.sentence-adjustments').open=open;event('toggle',{sentenceAdjustments:''},'',{open});}};
}

function targetPanel(html){const found=html.match(/<div class="sentence-target">[\s\S]*?<\/div>/);assert.ok(found,'the current target should appear before the editor');return found[0];}
function chips(html){const found=html.match(/<div class="sentence-selected-old"[^>]*>([\s\S]*?)<\/div>/);assert.ok(found,'selected expressions should stay beside the drawer trigger');return found[1];}
const selected=h=>Array.from(h.ui.selectedOldItems(),item=>item.label).sort();
function choose(h,labels){h.ui.setOldSelection(labels.map(label=>{const item=h.ui.wordBank().find(item=>item.label===label);assert.ok(item,`${label} should be available without course registration`);return item.key;}));}

test('mobile first sentence keeps target adjustments reachable and presents the old-word drawer before writing',()=>{
  const h=setup({records:{'old-word':{completed:true},'old-phrase':{attempts:1}}});const html=h.render();
  const target=targetPanel(html);
  assert.match(target,/本次目标[\s\S]*?<strong[^>]*>book<\/strong>/);
  assert.match(target,/书/);
  assert.doesNotMatch(target,/data-lesson=|第\s*1\s*册/);
  const details=html.match(/<details class="sentence-adjustments"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.ok(details,'selectors belong in the reachable adjustment disclosure');
  assert.match(details,/<summary>调整练习目标与方式<\/summary>/);
  assert.doesNotMatch(details,/^<details[^>]* open/);
  for(const name of ['target','mode'])assert.match(details,new RegExp('data-sentence-select="'+name+'"'));
  assert.match(html,/data-sentence-action="open-word-picker"/);
  assert.doesNotMatch(html,/data-sentence-source=|data-sentence-select="old-(?:word|phrase)"|sentence-knowledge|sentence-combination/);
  assert.ok(html.indexOf('data-sentence-action="open-word-picker"')<html.indexOf('<textarea'));
  assert.equal((html.match(/data-sentence-action="step"/g)||[]).length,5);
  assert.match(html,/sentence-step-count[^>]*>第 1 句 \/ 共 5 句/);
  assert.equal((html.match(/class="button primary"/g)||[]).length,1);
  assert.match(html,/data-sentence-action="check">检查五句基本要求<\/button>/);
});

test('combined sentence keeps explicit selections as escaped removable chips and retains their actual sources internally',()=>{
  const h=setup();h.render();h.step(4);choose(h,['friendly','look at']);
  const html=h.render(),selectedChips=chips(html);
  assert.equal((selectedChips.match(/data-sentence-action="remove-old"/g)||[]).length,2);
  assert.match(selectedChips,/>friendly<\/span>/);assert.match(selectedChips,/>look at<\/span>/);
  assert.match(selectedChips,/友好 &amp; 热情/);assert.match(selectedChips,/看 &lt;仔细&gt;/);
  assert.doesNotMatch(selectedChips,/data-lesson=|第\s*1\s*册|Family|Look|<script>|<仔细>/);
  assert.equal(h.ui.selectedOldItems().find(item=>item.label==='friendly').source.id,'old-word');
  assert.equal(h.ui.selectedOldItems().find(item=>item.label==='look at').source.id,'old-phrase');
  assert.ok(html.indexOf(selectedChips)<html.indexOf('<textarea'));
  assert.deepEqual(h.records,{});
});

test('available expressions are never automatically selected and clearing them preserves the writing draft',()=>{
  const h=setup();h.render();h.step(4);
  assert.equal(h.ui.wordBank().length,3);assert.deepEqual(selected(h),[]);assert.equal(chips(h.render()),'');
  h.open();h.ui.setWordCategory('adjective');h.close();
  assert.deepEqual(selected(h),[],'browsing available knowledge must not select it');
  choose(h,['friendly','look at']);h.input('My friendly sister and I look at the book.');
  h.event('click',{sentenceAction:'clear-old'});
  const html=h.render();
  assert.equal(chips(html),'');assert.deepEqual(selected(h),[]);
  assert.match(html,/>My friendly sister and I look at the book\.<\/textarea>/);
  assert.equal(h.ui.active.draft.oldWordKey,'');assert.equal(h.ui.active.draft.oldPhraseKey,'');
  assert.deepEqual(h.records,{});
});

test('an available earlier word used as the target keeps its true provenance without restoring source cards',()=>{
  const h=setup({records:{'old-word':{completed:true}}});h.render();h.change('target','word:old-word:friendly');
  const html=h.render(),target=targetPanel(html);
  assert.match(target,/>friendly<\/strong>/);assert.match(target,/友好 &amp; 热情/);
  assert.equal(h.ui.target().source.id,'old-word');
  assert.equal(h.ui.target().source.title,'Family <script>bad()</script>');
  assert.doesNotMatch(target,/第\s*1\s*册|data-lesson=|sentence-source-backlink/);
  assert.doesNotMatch(html,/<script>/);
});

test('mobile adjustments survive selection redraws and retain the saved step, selected knowledge and 400-character draft',()=>{
  const h=setup();h.render();h.toggle(true);choose(h,['friendly','look at']);h.step(4);h.input('A'.repeat(401));h.ui.flush();
  assert.match(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
  h.toggle(false);assert.doesNotMatch(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});const html=restored.render();
  assert.match(html,/sentence-step-count[^>]*>第 5 句 \/ 共 5 句/);
  assert.deepEqual(selected(restored),['friendly','look at']);
  assert.match(chips(html),/>friendly<\/span>/);assert.match(chips(html),/>look at<\/span>/);
  assert.match(html,new RegExp('>'+ 'A'.repeat(400) +'<\\/textarea>'));
  assert.match(html,/maxlength="400"/);
});

test('native-open adjustments remain available through target changes and drawer choices before toggle delivery',()=>{
  const changes=[h=>h.change('target','word:current:pen'),h=>choose(h,['friendly']),h=>choose(h,['look at']),h=>{h.open();h.ui.setWordCategory('adjective');h.event('input',{sentenceInput:'word-search'},'友好');h.close();}];
  for(const change of changes){
    const h=setup();h.render();h.nativeOpen(true);
    assert.equal(h.ui.adjustmentsOpen,false,'native state changes before its deferred toggle event');
    change(h);
    assert.match(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/,'changing a practice selection must keep native-open adjustments available');
    h.ui.flush();
    assert.ok(Object.values(h.drafts).every(draft=>!Object.hasOwn(draft,'adjustmentsOpen')),'disclosure state never enters learning drafts');
  }
});

test('switching lessons closes the old lesson disclosure and drawer while preserving its independent choices',()=>{
  const h=setup();h.render();h.nativeOpen(true);choose(h,['friendly']);h.open();assert.equal(h.dialog.open,true);h.setLesson(lessons[1]);
  assert.doesNotMatch(h.render(),/<details class="sentence-adjustments" open(?:\s|>)/);
  assert.equal(h.dialog.open,false);assert.deepEqual(selected(h),[]);
  h.setLesson(lessons[2]);h.render();assert.deepEqual(selected(h),['friendly']);
});

test('desktop keeps the flexible sentence layout and shares the same old-word drawer',()=>{
  const h=setup({mobile:false});const html=h.render();
  assert.match(html,/一个目标，灵活写五句/);assert.doesNotMatch(html,/sentence-knowledge|sentence-step-count/);
  assert.match(html,/data-sentence-action="open-word-picker"/);assert.match(html,/<dialog\b/);
  assert.doesNotMatch(html,/data-sentence-source=|data-sentence-select="old-(?:word|phrase)"/);
});

test('mobile uses flexible prompts by default and keeps optional transform mode and its answers separate',()=>{
  const h=setup();let html=h.render();
  assert.match(html,/aria-label="第 1 步 换一个语境/);
  assert.match(html,/data-sentence-select="mode"/);assert.match(html,/灵活五句/);
  choose(h,['friendly']);h.input('I keep a book in my bag.');h.step(1);html=h.render();
  assert.match(html,/补充时间地点/);assert.doesNotMatch(html,/class="sentence-original"/);
  h.change('mode','transform');html=h.render();
  assert.match(html,/肯定句/);assert.equal(h.ui.active.draft.answers.affirmative,'');
  assert.deepEqual(selected(h),[]);choose(h,['look at']);
  h.change('mode','flexible');assert.equal(h.ui.active.draft.answers.affirmative,'I keep a book in my bag.');assert.deepEqual(selected(h),['friendly']);
  h.step(4);assert.match(h.render(),/sentence-step-hint[^>]*>可[^<]*旧知[^<]*换个语境/);
});

test('mobile daily phrase target keeps native reference assistance and emits evidence only after a saved complete check',()=>{
  const h=setup();h.render();
  assert.equal(h.ui.openTarget({lessonId:'current',targetKey:'daily:phrase:talk',expression:'talk about',kind:'phrase',roundKey:'day-1'}),true);
  const html=h.render(),target=targetPanel(html);
  assert.match(target,/>talk about<\/strong>/);assert.doesNotMatch(target,/undefined|data-lesson="current"/);
  assert.match(html,/<details class="sentence-reference" data-sentence-reference>/);
  assert.match(html,/<summary data-sentence-action="reference">/);
  h.open();choose(h,['friendly','look at']);h.close();
  assert.equal(h.ui.active.draft.assisted,false);assert.equal(h.evidence.length,0);
  assert.equal(h.focusCalls.at(-1).preventScroll,true);
  h.reference(true);h.reference(false);assert.equal(h.ui.active.draft.assisted,true);
  const answers=['We talk about books at home.','Yesterday we talked about books in class.','My sister talks about the book after dinner.','Do they talk about pens at school?','I am talking about the story with friends.'];
  answers.forEach((answer,index)=>{h.step(index);h.input(answer);});
  assert.equal(h.evidence.length,0);h.setFailure(true);h.check();assert.equal(h.evidence.length,0);
  h.setFailure(false);h.check();assert.equal(h.evidence.length,1);
  assert.deepEqual({target:h.evidence[0].target,targetKey:h.evidence[0].targetKey,kind:h.evidence[0].kind,roundKey:h.evidence[0].roundKey,mode:h.evidence[0].mode,complete:h.evidence[0].complete,assisted:h.evidence[0].assisted,rulesOnly:h.evidence[0].rulesOnly},{target:'talk about',targetKey:'daily:phrase:talk',kind:'phrase',roundKey:'day-1',mode:'flexible',complete:true,assisted:true,rulesOnly:true});
  assert.match(h.render(),/本轮已查看参考示例/);
  h.ui.reloadFromStorage();h.ui.openTarget({lessonId:'current',expression:'talk about',kind:'phrase',roundKey:'day-1'});assert.equal(h.ui.active.draft.assisted,true);assert.deepEqual(selected(h),['friendly','look at']);
  h.ui.openTarget({lessonId:'current',expression:'talk about',kind:'phrase',roundKey:'day-2'});assert.equal(h.ui.active.draft.assisted,false);assert.deepEqual(selected(h),[]);assert.equal(h.ui.active.draft.answers.combined,'');
});

test('an earlier phrase used as a mobile target keeps exact provenance with a compact escaped target label',()=>{
  const h=setup({records:{'old-phrase':{completed:true}}});h.render();h.change('target','phrase:old-phrase:look%20at');
  const html=h.render(),target=targetPanel(html);
  assert.match(target,/>look at<\/strong>/);assert.match(target,/看 &lt;仔细&gt;/);
  assert.equal(h.ui.target().source.id,'old-phrase');assert.equal(h.ui.target().source.title,'Look "here"');
  assert.doesNotMatch(html,/Look &quot;here&quot;|Look "here"/,'source titles stay internal');
  assert.doesNotMatch(target,/data-lesson=|第\s*1\s*册|<仔细>/);
});
