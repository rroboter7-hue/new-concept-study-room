const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const NOW=Date.parse('2026-10-24T06:00:00Z');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// A small DOM boundary double, not a browser. The production event handlers,
// scheduler, phrase matcher, grammar checker and generated HTML all run as-is.
class Container{
 constructor(){this.listeners={};this.generation=0;this.nodes=[];this.html='';}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 contains(node){return node?.owner===this&&node.generation===this.generation;}
 set innerHTML(value){
  this.html=value;this.generation++;this.nodes=[];
  const add=(tag,attrs,body='')=>{
   const values={},dataset={};
   for(const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){values[a[1]]=decode(a[2]??'');if(a[1].startsWith('data-'))dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=decode(a[2]??'');}
   const node={owner:this,generation:this.generation,tagName:tag.toUpperCase(),dataset,disabled:Object.hasOwn(values,'disabled'),value:tag==='textarea'?decode(body):values.value||'',innerHTML:body,closest:selector=>selector==='[data-review-action]'&&dataset.reviewAction?node:null};
   this.nodes.push(node);return node;
  };
  for(const m of value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g))add('button',m[1],m[2]);
  for(const m of value.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g))add('textarea',m[1],m[2]);
  for(const m of value.matchAll(/<select\b([^>]*)>/g))add('select',m[1]);
  const start=value.indexOf('<div data-review-feedback');
  if(start>=0){const open=value.indexOf('>',start)+1,end=value.indexOf('<div class="review-ratings">',open);add('div','data-review-feedback',value.slice(open,end).replace(/<\/div>$/,''));}
 }
 get innerHTML(){return this.html;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){
  if(selector.includes(','))return [...new Set(selector.split(',').flatMap(part=>this.querySelectorAll(part.trim())))];
  if(selector==='[data-review-feedback]')return this.nodes.filter(n=>n.dataset.reviewFeedback!==undefined);
  if(selector==='[data-review-rating]')return this.nodes.filter(n=>n.dataset.reviewRating!==undefined);
  if(selector==='[data-review-input]')return this.nodes.filter(n=>n.dataset.reviewInput!==undefined);
  return [];
 }
 button(action,value){return this.nodes.find(n=>n.dataset.reviewAction===action&&(value===undefined||n.dataset.reviewRating===value||n.dataset.reviewOption===String(value)));}
 dispatch(type,node){for(const fn of this.listeners[type]||[])fn({target:node});}
 click(action,value){const button=this.button(action,value);assert.ok(button,'button '+action+' exists');if(!button.disabled)this.dispatch('click',button);return button;}
 type(value){const node=this.querySelector('[data-review-input]');assert.ok(node,'answer input exists');node.value=value;this.dispatch('input',node);return node;}
 filter(value){const node=this.nodes.find(n=>n.dataset.reviewFilter!==undefined);node.value=value;this.dispatch('change',node);}
}
const lesson=(book,extra={})=>({id:`source-b${book}-l001`,book,number:1,title:book===1?'Book one source':'A private conversation',vocabulary:[],usage:[],quiz:[],...extra});
function harness(lessons,{grammar=true,saveMode='ok',enroll=true}={}){
 const clock={now:NOW};class ClockDate extends Date{static now(){return clock.now;}}
 const context={window:{},Date:ClockDate,Intl};
 for(const file of ['review-engine.js',...(grammar?['grammar-check.js']:[]),'review-practice.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 const R=context.window.StudyReview,container=new Container();let state=enroll?R.enroll(null,R.cardsForLessons(lessons),{now:NOW}):R.sanitize(),persisted=JSON.stringify(state),saved=0,changed=0,mode=saveMode;
 const toasts=[],opened=[],spoken=[];
 const options={container,getLessons:()=>lessons,getState:()=>state,saveState:next=>{if(mode==='throw')throw Error('storage unavailable');if(mode==='fail')return false;state=next;persisted=JSON.stringify(next);saved++;return true;},escapeHTML,wordHTML:escapeHTML,toast:m=>toasts.push(m),getCurrentLesson:()=>lessons[0],enrollCurrent:()=>{},openLesson:id=>opened.push(id),backup:()=>{},speak:word=>spoken.push(word),onChange:()=>changed++};
 const ui=new context.window.ReviewPractice(options);ui.render();
 return {R,ui,container,clock,toasts,opened,spoken,get state(){return state;},get saved(){return saved;},get changed(){return changed;},get persisted(){return persisted;},setSaveMode:value=>mode=value,setState:next=>{state=next;},reload:()=>{const c=new Container();const next=new context.window.ReviewPractice({...options,container:c});state=R.sanitize(JSON.parse(persisted));next.render();return {ui:next,container:c};}};
}
const wordLessons=()=>[lesson(1,{vocabulary:[{word:'seat',meaning:'座位',example:'This is a seat.'}]})];
const phraseLessons=()=>[lesson(2,{usage:[{phrase:"can't stand",meaning:'无法忍受',matchedForm:"can't stand",variants:['cannot stand'],example:'I cannot stand this noise.'}]})];

test('rating stays disabled until an answer is checked or explicitly revealed',()=>{
 const h=harness(wordLessons());const buttons=h.container.querySelectorAll('[data-review-rating]');assert.equal(buttons.length,3);assert.ok(buttons.every(b=>b.disabled));
 h.container.click('rate','good');h.ui.action('rate',{dataset:{reviewRating:'good'}});assert.equal(h.saved,0);
 h.container.click('check');assert.equal(h.ui.revealed,false);assert.equal(h.saved,0);
 h.container.type('sit');h.container.click('check');assert.equal(h.ui.feedback.correct,false);assert.equal(h.container.button('rate','good').disabled,true);assert.equal(h.container.button('rate','again').disabled,false);assert.equal(h.container.button('rate','hard').disabled,false);
 const r=harness(wordLessons());r.container.click('reveal');assert.equal(r.ui.revealed,true);assert.equal(r.container.button('rate','good').disabled,true);assert.equal(r.container.button('rate','again').disabled,false);assert.equal(r.container.button('rate','hard').disabled,false);
});

test('editing an answer clears old feedback and revokes all rating buttons',()=>{
 const h=harness(wordLessons());h.container.type('seat');h.container.click('check');assert.equal(h.ui.feedback.correct,true);assert.ok(h.container.querySelector('[data-review-feedback]').innerHTML.includes('回答正确'));
 h.container.type('sit');assert.equal(h.ui.feedback,null);assert.equal(h.ui.revealed,false);assert.equal(h.container.querySelector('[data-review-feedback]').innerHTML,'');assert.ok(h.container.querySelectorAll('[data-review-rating]').every(b=>b.disabled));h.container.click('rate','good');assert.equal(h.state.cards[h.ui.active.id].repetitions,0);assert.equal(h.state.cards[h.ui.active.id].assistance.revision,0);
});

test('grammar choice changes invalidate the previous answer and cannot be rated unsubmitted',()=>{
 const h=harness([lesson(2,{quiz:[{type:'grammar',question:'He ____ here.',options:['is','are'],answer:0,explanation:'he用is'}]})]);
 h.container.click('choice',0);h.container.click('check');assert.equal(h.ui.feedback.correct,true);
 h.container.click('choice',1);assert.equal(h.ui.feedback,null);assert.equal(h.ui.revealed,false);assert.ok(h.container.querySelectorAll('[data-review-rating]').every(b=>b.disabled));h.container.click('check');assert.equal(h.ui.feedback.correct,false);
});

test('phrase writing accepts explicit source variants and contraction apostrophes with complete boundaries',()=>{
 const h=harness(phraseLessons());h.container.click('writing');h.container.type('I cannot stand this loud noise.');h.container.click('check');assert.equal(h.ui.feedback.covered,true);
 h.container.type('I can’t stand this loud noise.');h.container.click('check');assert.equal(h.ui.feedback.covered,true);
 h.container.type('I cant stand this loud noise.');h.container.click('check');assert.equal(h.ui.feedback.covered,false);
 const a=harness([lesson(1,{usage:[{phrase:'at large',meaning:'未被捕获'}]})]);a.container.click('writing');a.container.type('The cat large is sitting here.');a.container.click('check');assert.equal(a.ui.feedback.covered,false);a.container.type('The animal is at large today.');a.container.click('check');assert.equal(a.ui.feedback.covered,true);
});

test('applying real grammar suggestions changes the draft and requires checking again',()=>{
 const h=harness([lesson(2,{usage:[{phrase:'pay attention',meaning:'注意'}]})]);h.container.click('writing');h.container.type('They was ready to pay attention.');h.container.click('check');assert.equal(h.ui.feedback.covered,true);assert.equal(h.ui.feedback.issues.length,1);assert.ok(h.container.button('apply'));
 h.container.click('apply');assert.equal(h.ui.input,'They were ready to pay attention.');assert.equal(h.ui.feedback,null);assert.equal(h.ui.revealed,false);assert.ok(h.container.querySelectorAll('[data-review-rating]').every(b=>b.disabled));h.container.click('check');assert.equal(h.ui.feedback.issues.length,0);
});

test('unavailable grammar checker is disclosed instead of reporting no covered problems',()=>{
 const h=harness(phraseLessons(),{grammar:false});h.container.click('writing');h.container.type('I cannot stand this loud noise.');h.container.click('check');assert.match(h.container.querySelector('[data-review-feedback]').innerHTML,/语法检查暂不可用/);assert.doesNotMatch(h.container.querySelector('[data-review-feedback]').innerHTML,/暂未发现规则覆盖范围内的问题/);
});

test('a failed persistence keeps the same due card and revision available for retry',()=>{
 const h=harness(wordLessons(),{saveMode:'fail'}),id=h.ui.active.id;h.container.type('seat');h.container.click('check');h.container.click('rate','good');assert.equal(h.saved,0);assert.equal(h.changed,0);assert.equal(h.ui.active.id,id);assert.equal(h.ui.revealed,true);assert.equal(h.state.cards[id].revision,0);assert.equal(h.R.queue(h.state,h.ui.cards()).length,1);
 h.setSaveMode('ok');h.container.click('rate','good');assert.equal(h.saved,1);assert.equal(h.state.cards[id].revision,1);assert.equal(h.ui.active,null);
});

test('a thrown storage error is contained and leaves the current card retryable',()=>{
 const h=harness(wordLessons(),{saveMode:'throw'}),id=h.ui.active.id;h.container.type('seat');h.container.click('check');assert.doesNotThrow(()=>h.container.click('rate','good'));assert.equal(h.ui.active.id,id);assert.equal(h.state.cards[id].revision,0);assert.equal(h.saved,0);assert.ok(h.toasts.some(m=>/保存|存储/.test(m)));h.setSaveMode('ok');h.container.click('rate','good');assert.equal(h.saved,1);
});

test('double clicks and JSON reload do not score the committed card twice',()=>{
 const h=harness(wordLessons());h.container.type('seat');h.container.click('check');const stale=h.container.click('rate','good');h.container.dispatch('click',stale);assert.equal(h.saved,1);assert.equal(h.changed,1);assert.equal(h.state.cards[Object.keys(h.state.cards)[0]].repetitions,1);const reloaded=h.reload();assert.equal(reloaded.ui.active,null);assert.match(reloaded.container.innerHTML,/当前没有到期项目/);
});

test('an externally changed revision refreshes instead of applying a stale rating',()=>{
 const h=harness(wordLessons()),c=h.ui.active;h.container.type('seat');h.container.click('check');const external=h.R.rate(h.state,c.id,'good',{revision:0,now:NOW}).state;h.setState(external);h.container.click('rate','good');assert.equal(h.saved,0);assert.equal(h.ui.active,null);assert.ok(h.toasts.some(m=>/状态已变化/.test(m)));
});

test('mixed books retain visible source labels and source navigation as cards advance',()=>{
 const h=harness([lesson(1,{vocabulary:[{word:'seat',meaning:'座位'}]}),lesson(2,{vocabulary:[{word:'seat',meaning:'座位'}]})]);assert.equal(h.ui.due().length,2);assert.equal(h.ui.active.sourceLesson.book,1);assert.match(h.container.innerHTML,/学自第1册第1课/);h.container.click('source');assert.deepEqual(h.opened,['source-b1-l001']);h.container.click('reveal');h.container.click('rate','hard');assert.equal(h.ui.active.sourceLesson.book,2);assert.match(h.container.innerHTML,/学自第2册第1课/);assert.match(h.container.innerHTML,/A private conversation/);
});

test('imported prompt, title, answer and grammar strings remain escaped in generated HTML',()=>{
 const h=harness([lesson(2,{title:'<img src=x onerror=alert(1)>',vocabulary:[{word:'<script>x</script>',meaning:'<b>meaning</b>'}]})]);h.container.type('</textarea><img src=x>');h.container.click('check');assert.doesNotMatch(h.container.innerHTML,/<img|<script|<b>meaning/);assert.match(h.container.innerHTML,/&lt;img/);assert.match(h.container.innerHTML,/&lt;script/);
});
