'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),NOW=Date.parse('2026-10-28T08:00:00Z'),json=x=>JSON.parse(JSON.stringify(x));
function harness({lessons,saveDrafts=true,saveRating=true}={}){
 lessons??=[{id:'draft-source',book:2,number:1,title:'Source',vocabulary:[{word:'seat',meaning:'座位'}],usage:[],quiz:[]}];
 class Clock extends Date{static now(){return NOW;}}
 const c={Date:Clock,Intl};c.window=c;vm.createContext(c);for(const name of ['review-engine.js','grammar-check.js','review-practice.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),c,{filename:name});
 const R=c.StudyReview;let state=R.enroll({},R.cardsForLessons(lessons),{now:NOW}),drafts={version:1,entries:{}},draftWritable=saveDrafts,ratingWritable=saveRating,ui,container,ratingWrites=0,draftWrites=0;const notices=[],evidence=[];
 function make(){container={innerHTML:'',listeners:{},addEventListener(k,f){(this.listeners[k]??=[]).push(f);},contains:()=>true,querySelector:selector=>selector==='[data-review-draft-status]'?{set innerHTML(value){container.innerHTML=container.innerHTML.replace(/(<div data-review-draft-status[^>]*>)[\s\S]*?<\/div>/,'$1'+value+'</div>');}}:null,querySelectorAll:()=>[]};ui=new c.ReviewPractice({container,getLessons:()=>lessons,getState:()=>state,saveState:n=>{if(!ratingWritable)return false;state=n;ratingWrites++;return true;},getDrafts:()=>drafts,saveDrafts:n=>{if(draftWritable==='throw')throw Error('quota');if(!draftWritable)return false;drafts=json(n);draftWrites++;return true;},escapeHTML:String,wordHTML:String,toast:n=>notices.push(n),getCurrentLesson:()=>lessons[0],backup(){},onEvidence:e=>evidence.push(e)});ui.render();return ui;}
 make();return {R,lessons,notices,evidence,get ui(){return ui;},get html(){return container.innerHTML;},get state(){return state;},get drafts(){return drafts;},get ratingWrites(){return ratingWrites;},get draftWrites(){return draftWrites;},edit(value){for(const fn of container.listeners.input||[])fn({target:{dataset:{reviewInput:''},value}});},act(action,value){ui.action(action,{dataset:{reviewRating:value,reviewOption:value}});},reload(){drafts=json(drafts);state=R.sanitize(json(state));return make();},setDrafts:n=>{drafts=json(n);},setDraftWritable:n=>draftWritable=n,setRatingWritable:n=>ratingWritable=n};
}
const phrase=()=>[{id:'draft-source',book:2,number:1,title:'Source',vocabulary:[],usage:[{phrase:'pay attention',meaning:'注意',example:'Please pay attention to this example.'}],quiz:[]}];
test('a pending phrase-writing draft survives return and JSON reload without grading',()=>{
 const h=harness({lessons:phrase()});h.act('writing');h.edit('We should pay attention to this example.');const id=h.ui.active.id;
 h.ui.clearFilters();h.ui.render();assert.equal(h.ui.input,'We should pay attention to this example.');assert.equal(h.ui.writing,true);
 h.reload();assert.equal(h.ui.active.id,id);assert.equal(h.ui.input,'We should pay attention to this example.');assert.equal(h.ui.writing,true);assert.equal(h.ui.revealed,false);assert.equal(h.state.cards[id].repetitions,0);assert.equal(h.ratingWrites,1,'only existing assistance persistence may write review state');assert.equal(h.evidence.length,0);
});
test('checked objective feedback is reconstructed and may be rated once after reload',()=>{
 const h=harness();h.edit('seat');h.act('check');const id=h.ui.active.id;assert.equal(h.ui.feedback.correct,true);h.reload();assert.equal(h.ui.input,'seat');assert.equal(h.ui.revealed,true);assert.equal(h.ui.feedback.correct,true);assert.equal(h.ui.independentlyCorrect(),true);
 h.act('rate','good');h.act('rate','good');assert.equal(h.state.cards[id].repetitions,1);assert.equal(h.state.cards[id].stage,1);assert.equal(h.evidence.length,1);assert.equal(Object.keys(h.drafts.entries).length,0);
});
test('answer exposure and an edited correction stay assisted across refresh',()=>{
 const h=harness();h.act('reveal');h.reload();assert.equal(h.ui.revealed,true);h.edit('seat');h.act('check');h.reload();assert.equal(h.ui.feedback.correct,true);assert.equal(h.ui.independentlyCorrect(),false);h.act('rate','good');assert.equal(h.state.cards[h.ui.active.id].repetitions,0);h.act('rate','hard');assert.equal(h.evidence.length,1);assert.equal(h.evidence[0].assisted,true);
});
test('wrong feedback followed by editing keeps its revoked check and assistance after refresh',()=>{
 const h=harness();h.edit('sit');h.act('check');h.edit('seat');h.reload();assert.equal(h.ui.input,'seat');assert.equal(h.ui.revealed,false);assert.equal(h.ui.feedback,null);h.act('check');assert.equal(h.ui.independentlyCorrect(),false);h.act('rate','good');assert.equal(h.state.cards[h.ui.active.id].repetitions,0);
});
test('persisted feedback correctness is ignored after the canonical answer changes',()=>{
 const lessons=[{id:'grammar-source',book:2,number:1,title:'Source',vocabulary:[],usage:[],quiz:[{type:'grammar',question:'He ____ ready.',options:['is','are'],answer:0}]}],h=harness({lessons});h.act('choice',0);h.act('check');const id=h.ui.active.id;
 for(const draft of Object.values(h.drafts.entries))draft.correct=true;
 lessons[0].quiz[0].answer=1;h.reload();assert.equal(h.ui.active.id,id);assert.equal(h.ui.input,'is');assert.equal(h.ui.feedback.correct,false);assert.equal(h.ui.independentlyCorrect(),false);h.act('rate','good');assert.equal(h.state.cards[id].repetitions,0);
});
test('drafts cannot cross daily, practice, task rounds, or changed revisions',()=>{
 const h=harness(),id=h.ui.active.id;h.edit('daily draft');h.ui.startPractice([id]);h.ui.render();assert.equal(h.ui.input,'');h.edit('practice draft');h.ui.clearFilters();h.ui.render();assert.equal(h.ui.input,'daily draft');
 const task=key=>({id:'task',day:'2026-10-28',roundKey:key,cardRevisions:{[id]:0}});
 h.ui.startReview([id],task('a'));h.ui.render();assert.equal(h.ui.input,'');h.edit('task a draft');h.ui.startReview([id],task('b'));h.ui.render();assert.equal(h.ui.input,'');h.ui.startReview([id],task('a'));h.ui.render();assert.equal(h.ui.input,'task a draft');
 h.state.cards[id].revision++;h.ui.clearFilters();h.ui.render();assert.equal(h.ui.input,'');assert.equal(Object.keys(h.ui.snapshotDrafts().entries).length,0);
});
test('a practice draft survives reload in its scope and an explicit new round clears it',()=>{
 const h=harness(),id=h.ui.active.id;h.ui.startPractice([id]);h.ui.render();h.edit('practice draft');h.reload();h.ui.startPractice([id]);h.ui.render();assert.equal(h.ui.input,'practice draft');assert.equal(h.state.cards[id].repetitions,0);h.ui.startPractice([id],{newRound:true});h.ui.render();assert.equal(h.ui.input,'');
});
test('failed draft saving retains text for return, backup and a visible retry',()=>{
 const h=harness({saveDrafts:false});h.edit('A pending answer that must not disappear.');assert.match(h.html,/重试保存草稿|草稿暂未保存/);assert.equal(Object.values(h.ui.snapshotDrafts().entries)[0].input,'A pending answer that must not disappear.');h.ui.clearFilters();h.ui.render();assert.equal(h.ui.input,'A pending answer that must not disappear.');assert.equal(Object.keys(h.drafts.entries).length,0);h.setDraftWritable(true);h.act('retry-draft');assert.equal(Object.values(h.drafts.entries)[0].input,'A pending answer that must not disappear.');assert.doesNotMatch(h.html,/草稿暂未保存/);h.reload();assert.equal(h.ui.input,'A pending answer that must not disappear.');
});
test('a failed rating keeps the checked draft, and retry clears it only after commit',()=>{
 const h=harness({saveRating:false});h.edit('seat');h.act('check');h.act('rate','good');assert.equal(h.ui.input,'seat');assert.equal(h.ui.feedback.correct,true);assert.equal(Object.keys(h.drafts.entries).length,1);h.reload();assert.equal(h.ui.feedback.correct,true);h.setRatingWritable(true);h.act('rate','good');assert.equal(Object.keys(h.drafts.entries).length,0);assert.equal(h.evidence.length,1);
});
test('draft validation bounds storage, rejects oversized text and discards old revisions',()=>{
 const h=harness(),id=h.ui.active.id;h.edit('seat');assert.equal(typeof h.R.sanitizeDrafts,'function');const base=Object.values(h.drafts.entries)[0],entries={};
 for(let i=0;i<150;i++){const d={...base,cardId:'review:source:word:w'+i,updatedAt:NOW+i};entries[h.R.draftKey(d.context,d.cardId,d.revision)]=d;}
 const bounded=h.R.sanitizeDrafts({entries});assert(Object.keys(bounded.entries).length<=100);const d={...base,input:'x'.repeat(10001)};assert.equal(Object.keys(h.R.sanitizeDrafts({entries:{[h.R.draftKey(d.context,d.cardId,d.revision)]:d}}).entries).length,0);
 assert.equal(Object.keys(h.R.sanitizeDrafts(h.drafts,{cards:{[id]:{revision:1}}}).entries).length,0);
});
test('oversized text remains intact in memory and backup, while durable drafts stay bounded',()=>{
 const h=harness(),text='x'.repeat(10001);h.edit(text);assert.equal(h.ui.input,text);assert.match(h.html,/超过10000字/);assert.equal(Object.keys(h.drafts.entries).length,0);assert.equal(Object.values(h.ui.snapshotDrafts().entries)[0].input,text);h.ui.clearFilters();h.ui.render();assert.equal(h.ui.input,text);h.edit('seat');h.act('retry-draft');h.reload();assert.equal(h.ui.input,'seat');assert.doesNotMatch(h.html,/草稿暂未保存/);
});
test('a thrown draft write is retryable and never writes review scores or completion evidence',()=>{
 const h=harness({saveDrafts:'throw'});h.edit('seat');h.act('check');assert.equal(h.ui.feedback.correct,true);assert.equal(h.ratingWrites,0);assert.equal(h.evidence.length,0);assert.equal(Object.values(h.ui.snapshotDrafts().entries)[0].input,'seat');h.setDraftWritable(true);h.act('retry-draft');h.reload();assert.equal(h.ui.feedback.correct,true);assert.equal(h.ui.input,'seat');assert.equal(h.ratingWrites,0);
});

test('storage replacement reload discards pending memory without writing it over the imported draft',()=>{
 const h=harness();h.edit('seat');h.act('check');const saved=JSON.parse(JSON.stringify(h.drafts));h.setDraftWritable(false);h.edit('a newer unsaved answer');h.setDrafts(saved);const before=h.draftWrites;
 assert.equal(typeof h.ui.reloadFromStorage,'function');h.ui.reloadFromStorage();assert.equal(h.ui.input,'seat');assert.equal(h.ui.feedback.correct,true);assert.equal(h.draftWrites,before);assert.equal(h.ratingWrites,1,'only the earlier edit revoked independent recall; reload must not rate');assert.equal(Object.values(h.ui.snapshotDrafts().entries)[0].input,'seat');
});
test('an installed draft provider returning no data never falls back to the old local cache',()=>{
 const h=harness();h.edit('seat');assert.equal(Object.keys(h.ui.snapshotDrafts().entries).length,1);h.setDrafts(null);assert.equal(Object.keys(h.ui.snapshotDrafts().entries).length,0);const writes=h.draftWrites;h.ui.reloadFromStorage();assert.equal(h.ui.input,'');assert.equal(h.draftWrites,writes);
});
test('reloading a changed canonical answer recomputes feedback without any persistence writes',()=>{
 const lessons=[{id:'grammar-source',book:2,number:1,title:'Source',vocabulary:[],usage:[],quiz:[{type:'grammar',question:'He ____ ready.',options:['is','are'],answer:0}]}],h=harness({lessons});h.act('choice',0);h.act('check');const draftWrites=h.draftWrites,ratingWrites=h.ratingWrites;lessons[0].quiz[0].answer=1;h.ui.reloadFromStorage();assert.equal(h.ui.input,'is');assert.equal(h.ui.feedback.correct,false);assert.equal(h.ui.independentlyCorrect(),false);assert.equal(h.draftWrites,draftWrites);assert.equal(h.ratingWrites,ratingWrites);
});