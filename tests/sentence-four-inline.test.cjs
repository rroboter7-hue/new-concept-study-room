const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const kinds=['affirmative','negative','yesno','wh'];
const labels=['肯定句','否定句','一般疑问句','特殊疑问句'];
const answers={affirmative:'We read a book.',negative:'We do not read a book.',yesno:'Do we read a book?',wh:'Why do we read a book?'};
const decode=value=>String(value||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

function setup({drafts={},clipboard,failSave=false}={}) {
  const events={},fields={},counters={},extras={},evidence=[],notices=[],focus=[];let markup='',renderCount=0,fail=failSave;
  const document={body:{classList:{contains:()=>true}},activeElement:null,addEventListener:(name,fn)=>(events[name]||=[]).push(fn)};
  const fire=(type,target)=>{for(const fn of events[type]||[])fn({target,preventDefault(){}});};
  function fieldFor(kind) {
    return fields[kind]||=( {dataset:{sentenceInput:'answer',sentenceKind:kind},value:'',selectionStart:0,selectionEnd:0,
      focus(){focus.push(kind);document.activeElement=this;fire('focusin',this);},
      setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},
      closest:selector=>selector==='#sentence-practice-content'?content:null} );
  }
  function find(selector) {
    const kindMatch=selector.match(/data-sentence-kind=["']([^"']+)["']/)||selector.match(/#sentence-answer-(affirmative|negative|yesno|wh)/);
    if(kindMatch)return fieldFor(kindMatch[1]);
    const counterMatch=selector.match(/data-sentence-counter=["']([^"']+)["']/);
    if(counterMatch)return counters[counterMatch[1]]||=( {textContent:''} );
    if(selector==='.sentence-textarea'||selector==='#sentence-answer')return fieldFor('affirmative');
    return extras[selector]||=( {textContent:'',innerHTML:'',setAttribute(){},focus(){},select(){},remove(){},querySelector:find,querySelectorAll:()=>[]} );
  }
  const content={get innerHTML(){return markup;},set innerHTML(value){
    renderCount++;
    markup=value;
    for(const match of value.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
      const kind=match[1].match(/data-sentence-kind="([^"]+)"/)?.[1];
      if(!kind)continue;
      const field=fieldFor(kind);field.value=decode(match[2]);field.selectionStart=field.selectionEnd=field.value.length;
    }
  },querySelector:find,querySelectorAll:selector=>selector.includes('textarea')?kinds.map(fieldFor):[]};
  document.querySelector=selector=>selector==='#sentence-practice-content'?content:find(selector);
  const context={document,navigator:{clipboard},console,setTimeout:()=>1,clearTimeout(){}};context.window=context;
  vm.createContext(context);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const lesson={id:'now',book:2,number:1,title:'Books',vocabulary:[{word:'book',meaning:'书'}],usage:[{phrase:'pay attention',meaning:'注意'}]};
  const ui=new context.SentencePractice({defaultMode:'four',getLesson:()=>lesson,getLessons:()=>[lesson],getDrafts:()=>drafts,
    saveDraft:(key,value)=>{if(fail)return false;drafts[key]=JSON.parse(JSON.stringify(value));return true;},
    onEvidence:value=>{evidence.push(JSON.parse(JSON.stringify(value)));return true;},toast:value=>notices.push(value)});
  const render=()=>content.innerHTML=ui.render();render();
  function input(kind,value) {const node=fieldFor(kind);node.value=value;node.selectionStart=node.selectionEnd=value.length;fire('input',node);}
  function click(action,kind) {const node={dataset:{sentenceAction:action,...(kind?{sentenceKind:kind}:{})},closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'?node:null};fire('click',node);}
  return {ui,drafts,evidence,notices,focus,content,fields,counters,render,input,click,field:fieldFor,get renderCount(){return renderCount;},setFailure:value=>{fail=value;}};
}

test('four sentence forms are simultaneously labelled and editable without step or next controls',()=>{
  const h=setup(),html=h.render(),textareas=[...html.matchAll(/<textarea\b([^>]*)>/g)];
  assert.equal(textareas.length,4);
  kinds.forEach((kind,index)=>{
    const attributes=textareas.find(row=>row[1].includes(`data-sentence-kind="${kind}"`))?.[1];assert.ok(attributes,kind);
    const id=attributes.match(/id="([^"]+)"/)?.[1];assert.ok(id,kind+' has a unique label target');
    const label=html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)<textarea`))?.[1];assert.ok(label?.includes(labels[index]),kind+' is labelled');
  });
  assert.doesNotMatch(html,/data-sentence-action="(?:step|previous|next)"/);
  assert.equal((html.match(/data-sentence-action="copy-review"/g)||[]).length,1);
});

test('typing into each field updates only its named answer and counter independent of saved step',()=>{
  const h=setup();h.ui.active.draft.step=3;
  for(const kind of ['negative','affirmative','wh','yesno'])h.input(kind,answers[kind]);
  for(const kind of kinds)assert.equal(h.ui.active.draft.answers[kind],answers[kind]);
  assert.equal(h.ui.active.draft.answers.combined,'');
  for(const kind of kinds)assert.match(h.counters[kind]?.textContent||'',new RegExp(String(answers[kind].length)));
  h.input('negative','x'.repeat(420));assert.equal(h.ui.active.draft.answers.negative.length,400);
  assert.equal(h.ui.active.draft.answers.affirmative,answers.affirmative);
  assert.equal(h.evidence.length,0);h.ui.flush();
  assert.equal(h.drafts[h.ui.active.key].answers.yesno,answers.yesno);
});

test('insertion and original reuse act on their clicked field and return focus there',()=>{
  const h=setup();h.input('affirmative',answers.affirmative);h.input('yesno','Do we read ?');h.ui.active.draft.step=0;
  h.field('yesno').setSelectionRange(11,11);h.click('insert-target','yesno');
  assert.equal(h.ui.active.draft.answers.yesno,'Do we read book?');
  assert.equal(h.ui.active.draft.answers.affirmative,answers.affirmative);
  assert.equal(h.focus.at(-1),'yesno');
  h.click('reuse-original','negative');assert.equal(h.ui.active.draft.answers.negative,answers.affirmative);assert.equal(h.focus.at(-1),'negative');
  h.input('negative',answers.negative);h.click('reuse-original','negative');assert.equal(h.ui.active.draft.answers.negative,answers.negative);
});

test('existing four drafts restore all four fields on one page without losing hidden legacy text',()=>{
  const key='v3:four:now:word%3Anow%3Abook';
  const h=setup({drafts:{[key]:{targetKey:'word:now:book',mode:'four',step:3,assisted:true,answers:{...answers,combined:'Legacy fifth sentence.'}},'selection:v1:now':{targetKey:'word:now:book',mode:'four',step:3}}});
  const html=h.render();for(const kind of kinds){assert.equal(h.field(kind).value,answers[kind]);assert.ok(html.includes(answers[kind]));}
  assert.equal(h.ui.active.draft.assisted,true);assert.equal(h.ui.active.draft.answers.combined,'Legacy fifth sentence.');
  assert.doesNotMatch(html,/Legacy fifth sentence\.<\/textarea>/);
});

test('one copy exports all four labels and exact originals with contextual grammar instructions',async()=>{
  let copied='';const h=setup({clipboard:{writeText:async value=>{copied=value;}}});
  for(const kind of kinds)h.input(kind,answers[kind]);assert.equal(await h.ui.copyForReview(),true);
  kinds.forEach((kind,index)=>assert.ok(copied.includes(labels[index]+'：'+answers[kind])));
  assert.match(copied,/第 2 册.*第 1 课/);assert.match(copied,/目标表达.*book/);assert.match(copied,/语法.*时态/);assert.match(copied,/四句.*同一/);
  assert.equal(h.evidence.length,0,'copy is not a completed daily task');
});

test('partial copy keeps empty forms explicit and never fills them from another field',async()=>{
  let copied='';const h=setup({clipboard:{writeText:async value=>{copied=value;}}});h.input('wh',answers.wh);
  assert.equal(await h.ui.copyForReview(),true);
  assert.match(copied,/肯定句：【未填写，请勿代写】/);assert.match(copied,/否定句：【未填写，请勿代写】/);assert.match(copied,/一般疑问句：【未填写，请勿代写】/);
  assert.ok(copied.includes('特殊疑问句：'+answers.wh));assert.equal((copied.match(/Why do we read a book\?/g)||[]).length,1);
  assert.equal(h.ui.active.draft.answers.affirmative,'');assert.equal(h.evidence.length,0);
});

test('four draft reload and explicit saved check preserve count, assistance and completion evidence',()=>{
  const h=setup();assert.equal(h.ui.openTarget({lessonId:'now',targetKey:'word:now:book',roundKey:'daily-four',sentenceMode:'four-forms'}),true);h.render();
  for(const kind of kinds)h.input(kind,answers[kind]);h.ui.markAssisted();h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});assert.equal(restored.ui.active.draft.roundKey,'daily-four');
  for(const kind of kinds)assert.equal(restored.field(kind).value,answers[kind]);assert.equal(restored.evidence.length,0);
  restored.setFailure(true);restored.click('check');assert.equal(restored.evidence.length,0);
  restored.setFailure(false);restored.click('check');assert.equal(restored.evidence.length,1);
  const evidence=restored.evidence[0];assert.equal(evidence.requiredCount,4);assert.equal(evidence.sentenceMode,'four-forms');assert.equal(evidence.assisted,true);assert.equal(evidence.roundKey,'daily-four');
  for(const kind of kinds)assert.equal(evidence.answers[kind],answers[kind]);assert.equal(evidence.complete,true);
});

test('typing keeps the active field and its siblings in place without redrawing the writing form',()=>{
  const h=setup();h.field('negative').focus();const renders=h.renderCount,focusCount=h.focus.length;
  h.input('negative',answers.negative);h.input('negative',answers.negative+' ');
  assert.equal(h.renderCount,renders,'ordinary input must not replace all four fields or dismiss the keyboard');
  assert.equal(h.focus.length,focusCount);assert.equal(h.focus.at(-1),'negative');
  assert.equal(h.ui.active.draft.answers.negative,answers.negative+' ');assert.equal(h.ui.active.draft.answers.affirmative,'');
});

test('unknown fields and reuse with no affirmative original cannot invent another answer or task evidence',()=>{
  const h=setup();h.input('combined','A hidden fifth answer.');h.input('unknown','A different hidden answer.');
  for(const kind of kinds)assert.equal(h.ui.active.draft.answers[kind],'');assert.equal(h.ui.active.draft.answers.combined,'');
  h.click('reuse-original','negative');assert.equal(h.ui.active.draft.answers.negative,'');
  assert.ok(h.notices.some(value=>/先写肯定原句/.test(value)));h.click('check');assert.equal(h.evidence.length,0);
});
