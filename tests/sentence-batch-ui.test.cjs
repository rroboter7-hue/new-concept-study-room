const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup({fail=false,clipboardFail=false}={}){
 const fields=new Map(),handlers={},timers=new Map(),drafts={},notices=[],copied=[];
 let id=0,lesson={id:'lesson-a',book:2,number:1,title:'One'},saveFailure=fail;
 const root={innerHTML:'',querySelector:s=>{if(!fields.has(s))fields.set(s,{innerHTML:'',textContent:'',value:'',dataset:{},focus(){},select(){}});return fields.get(s);}};
 const core={sanitizeDraft:v=>({mode:v?.mode==='conversion'?'conversion':'free',rawText:typeof v?.rawText==='string'?v.rawText:''}),parse:(rawText,mode)=>({mode,rawText,rows:rawText.split('\n').filter(x=>x.trim()).map((text,i)=>({id:'row-'+i,index:i,line:i+1,text,kind:'sentence'})),warnings:[]}),checkRow:row=>({status:'review',issues:[],notes:['有限检查']}),buildPrompt:parsed=>'批改要求\n'+parsed.rawText};
 const scope={console,document:{addEventListener:(kind,fn)=>handlers[kind]=fn,querySelector:s=>s==='#sentence-batch-content'?root:null},navigator:{clipboard:{writeText:async value=>{if(clipboardFail)throw Error('Denied');copied.push(value);}}},StudySentenceBatch:core,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:n=>timers.delete(n)};
 scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sentence-batch-practice.js'),'utf8'),scope);
 const ui=new scope.SentenceBatchPractice({getLesson:()=>lesson,getDrafts:()=>drafts,saveDraft:(key,value)=>{drafts[key]=JSON.parse(JSON.stringify(value));return !saveFailure;},toast:x=>notices.push(x)});
 const render=()=>{root.innerHTML=ui.render();return root.innerHTML;};
 const event=(dataset,value)=>({target:{dataset,value,closest:s=>s==='#sentence-batch-content'?root:s==='[data-batch-action]'&&dataset.batchAction?{dataset}:null},preventDefault(){}});
 return {ui,render,root,fields,drafts,copied,notices,input:value=>ui.handleInput(event({batchInput:'raw'},value)),change:value=>ui.handleChange(event({batchMode:'mode'},value)),click:action=>ui.handleClick(event({batchAction:action})),runTimers(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},setLesson:v=>lesson=v,setFailure:v=>saveFailure=v};
}
test('batch text has no max sentence limit and is safely rendered and saved in full',()=>{const h=setup();h.render();const text=Array.from({length:1205},(_,i)=>`Sentence ${i}.`).join('\n')+'\n<img src=x>';h.input(text);h.ui.flush();const html=h.render();assert.ok(Object.values(h.drafts).some(d=>d.rawText===text));assert.doesNotMatch(html,/maxlength=/);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x>/);});
test('course switching isolates drafts and does not replace old entries',()=>{const h=setup();h.render();h.input('First sentence.');h.setLesson({id:'lesson-b'});h.render();h.input('Second sentence.');h.setLesson({id:'lesson-a'});assert.match(h.render(),/First sentence\./);h.ui.flush();assert.equal(Object.keys(h.drafts).length,2);});
test('save failure is visible and keeps all input in memory',()=>{const h=setup({fail:true});h.render();h.input('Keep this draft.');assert.equal(h.ui.flush(),false);assert.match(h.render(),/未保存/);assert.match(h.render(),/Keep this draft/);h.setFailure(false);assert.equal(h.ui.flush(),true);});
test('editing or cancelling a yielding check prevents stale results',()=>{const h=setup();h.render();h.input(Array.from({length:300},(_,i)=>`I read book ${i}.`).join('\n'));h.ui.startCheck();assert.ok(h.ui.results.length<300);h.input('New draft.');h.runTimers();assert.equal(h.ui.results.length,0);assert.equal(h.ui.checking,false);h.ui.startCheck();h.ui.cancelCheck();h.runTimers();assert.equal(h.ui.checking,false);});
test('copy includes every row and never calls a grading or network path',async()=>{const h=setup();h.render();const text=Array.from({length:1001},(_,i)=>`Copy line ${i}.`).join('\n');h.input(text);await h.click('copy');assert.equal(h.copied.length,1);assert.ok(h.copied[0].endsWith('Copy line 1000.'));assert.ok(h.copied[0].includes('Copy line 0.'));assert.match(h.render(),/自行粘贴|手动粘贴/);});
test('clipboard rejection leaves a selectable complete fallback',async()=>{const h=setup({clipboardFail:true});h.render();h.input('A full sentence.');await h.click('copy');assert.match(h.render(),/手动复制/);assert.match(h.render(),/A full sentence\./);assert.equal(h.copied.length,0);});
test('restore clears stale timers and reloads the restored draft',()=>{const h=setup();h.render();h.input('Before backup.');h.ui.flush();Object.values(h.drafts)[0].rawText='Restored copy.';h.ui.reloadFromStorage();h.runTimers();assert.match(h.render(),/Restored copy\./);assert.doesNotMatch(h.render(),/Before backup/);});
