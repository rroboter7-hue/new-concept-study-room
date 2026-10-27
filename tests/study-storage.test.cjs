'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const KEY='zhixin-study-v1',file=path.join(__dirname,'..','study-storage.js');
function api(){assert(fs.existsSync(file),'the storage reconciliation helper must exist');return require(file);}
function memory(initial={}){const map=new Map([[KEY,JSON.stringify(initial)]]);return {map,fail:false,onSet:null,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,removeItem(k){if(this.fail)throw Error('quota');map.delete(k);},setItem(k,v){if(this.fail)throw Error('quota');this.onSet?.(k,v);map.set(k,v);}};}
function session(store,id){return api().createSession({storage:store,key:KEY,writer:id});}
const copy=x=>JSON.parse(JSON.stringify(x));

test('a stale app tab marking read preserves another tab saved word',async()=>{
 const {harness}=require('./leo-coach-harness.cjs'),sharedStorage=new Map([[KEY,'{}']]);
 const a=await harness({pilot:false,sharedStorage}),b=await harness({pilot:false,sharedStorage});
 a.api.data.words.push({word:'reliable',meaning:'可靠的'});await a.api.selectLesson(a.api.current.id);
 await b.click('#complete-lesson');assert.equal(b.stored.words.some(v=>v.word==='reliable'),true);assert.equal(b.stored.records[b.api.current.id].completed,true);
});

test('three-way reconciliation preserves unrelated fields in all current draft containers and settings',()=>{
 const S=api(),initial={words:[],records:{l1:{completed:false}},settings:{voice:'en-GB'},outputDrafts:{version:1,lessons:{l1:{modes:{write:{answer:'old',notes:'old'}}}}},lessonRecall:{lessons:{l1:{answer:'old'}}},coachDrafts:{'explain:x':{rule:'old',reason:'old'}},sentencePractice:{x:{forms:{statement:'old',question:'old'}}},sentenceBatch:{l1:{text:'old'}},sentenceBatches:{l2:{text:'old'}},unitPractice:{sessions:{l1:{drafts:{a:'old',b:'old'}}}},review:{cards:{x:{stage:1}}},coach:{days:{}},game:{xp:1},futureField:{keep:true}},store=memory(initial),a=session(store,'A'),b=session(store,'B'),av=copy(a.read().data),bv=copy(b.read().data);
 av.outputDrafts.lessons.l1.modes.write.answer='A';av.coachDrafts['explain:x'].rule='A';av.sentencePractice.x.forms.statement='A';av.unitPractice.sessions.l1.drafts.a='A';av.settings.voice='en-US';assert(a.commit(av).ok);
 bv.outputDrafts.lessons.l1.modes.write.notes='B';bv.coachDrafts['explain:x'].reason='B';bv.sentencePractice.x.forms.question='B';bv.unitPractice.sessions.l1.drafts.b='B';bv.records.l1.completed=true;bv.lessonRecall.lessons.l1.answer='B';bv.sentenceBatch.l1.text='B';bv.sentenceBatches.l2.text='B';bv.review.cards.x.stage=2;bv.game.xp=2;assert(b.commit(bv).ok);
 const data=S.read({storage:store,key:KEY}).data;assert.deepEqual(data.outputDrafts.lessons.l1.modes.write,{answer:'A',notes:'B'});assert.deepEqual(data.coachDrafts['explain:x'],{rule:'A',reason:'B'});assert.deepEqual(data.sentencePractice.x.forms,{statement:'A',question:'B'});assert.deepEqual(data.unitPractice.sessions.l1.drafts,{a:'A',b:'B'});assert.equal(data.settings.voice,'en-US');assert.equal(data.records.l1.completed,true);assert.equal(data.lessonRecall.lessons.l1.answer,'B');assert.equal(data.sentenceBatch.l1.text,'B');assert.equal(data.sentenceBatches.l2.text,'B');assert.equal(data.review.cards.x.stage,2);assert.equal(data.game.xp,2);assert.equal(data.futureField.keep,true);
});

test('explicit keyed word deletion survives stale tab saves and a fresh session',()=>{
 const store=memory({words:[{word:'keep'},{word:'remove'}],records:{}}),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.words=av.words.filter(x=>x.word!=='remove');assert(a.commit(av).ok);bv.records.l1={completed:true};assert(b.commit(bv).ok);assert.deepEqual(session(store,'C').read().data.words.map(v=>v.word),['keep']);
});

test('interleaved whole-key writes recover every durable field and journals stay bounded per changed field',()=>{
 const store=memory({words:[],records:{},settings:{voice:'en-GB'}}),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.words.push({word:'first'});bv.records.l1={completed:true};let interleaved=false;store.onSet=(key)=>{if(key===KEY&&!interleaved){interleaved=true;assert(b.commit(bv).ok);}};assert(a.commit(av).ok);store.onSet=null;const recovered=session(store,'C').read().data;assert.equal(recovered.words[0].word,'first');assert.equal(recovered.records.l1.completed,true);const before=store.map.size;for(let i=0;i<20;i++){av.settings.voice='voice'+i;assert(a.commit(av).ok);}assert(store.map.size<=before+1,'one stable slot per changed field; transactions are compacted');
});

test('quota and corrupt storage cannot advance the write baseline or overwrite the recoverable source',()=>{
 const store=memory({words:[],records:{}}),s=session(store,'A'),next=s.read().data;next.words.push({word:'pending'});store.fail=true;assert.equal(s.commit(next).ok,false);store.fail=false;assert(s.commit(next).ok);assert.equal(s.read().data.words[0].word,'pending');store.map.set(KEY,'{broken');const before=store.map.get(KEY);assert.equal(s.commit({...next,records:{l1:{completed:true}}}).ok,false);assert.equal(store.map.get(KEY),before);assert.equal(api().read({storage:store,key:KEY}).ok,false);
});

test('legacy merge preview counts additions, retained local conflicts and dates without mutating input',()=>{
 const S=api(),local={words:[{word:'keep'}],records:{l1:{completed:true,lastAt:200}},settings:{voice:'en-US'},sentencePractice:{x:{answer:'local'}},outputDrafts:{version:1,lessons:{l1:{modes:{write:{answer:'local'}}}}}},raw={format:'zhixin-backup-v1',exportedAt:'2020-01-01T00:00:00Z',data:{words:[{word:'new'}],records:{l1:{completed:false,lastAt:100},l2:{completed:true,lastAt:150}},sentencePractice:{x:{answer:'old'},y:{answer:'new'}}}},before=copy(local),p=S.previewBackup(local,raw);assert.equal(p.mode,'merge');assert.equal(p.summary.words.added,1);assert.equal(p.summary.records.added,1);assert(p.summary.conflicts>=2);assert.equal(p.exportedAt,raw.exportedAt);assert.equal(p.data.records.l1.completed,true);assert.equal(p.data.sentencePractice.x.answer,'local');assert.equal(p.data.sentencePractice.y.answer,'new');assert.equal(p.data.settings.voice,'en-US');assert.deepEqual(local,before);const replace=S.previewBackup(local,raw,{mode:'replace'});assert.deepEqual(replace.data.words,[{word:'new'}]);assert.equal(replace.data.outputDrafts,undefined);
});

test('imports write a recoverable pre-import snapshot and replacement failure leaves local work intact',()=>{
 const S=api(),store=memory({words:[{word:'local'}],records:{l1:{completed:true}}}),s=session(store,'A'),raw={format:'zhixin-backup-v1',data:{words:[{word:'backup'}],records:{l2:{completed:true}}}},p=S.previewBackup(s.read().data,raw);const result=s.importBackup(p);assert(result.ok);assert.deepEqual(s.recoverySnapshot().data.words,[{word:'local'}]);assert.equal(s.read().data.words.length,2);assert(s.restoreSnapshot().ok);assert.deepEqual(s.read().data.words,[{word:'local'}]);store.fail=true;assert.equal(s.importBackup(S.previewBackup(s.read().data,raw,{mode:'replace'})).ok,false);store.fail=false;assert.deepEqual(s.read().data.words,[{word:'local'}]);
});

test('storage events preserve the live pending batch editor and its later save retains remote words and deletions',async()=>{
 const {harness}=require('./leo-coach-harness.cjs'),sharedStorage=new Map([[KEY,'{}']]),options={pilot:false,realOutput:true,sharedStorage},a=await harness(options),b=await harness(options);b.api.setTab('output');await b.click('[data-output-mode="batch"]');const input=b.document.querySelector('[data-batch-input="text"]');await b.input(input,'This batch answer is still waiting for its save timer.');
 a.api.data.words.push({word:'remote'});await a.api.selectLesson(a.api.current.id);await b.storageEvent();assert.equal(b.document.querySelector('[data-batch-input="text"]'),input);assert.equal(input.value,'This batch answer is still waiting for its save timer.');assert(b.api.batchPractice.flush());assert.equal(b.stored.words[0].word,'remote');assert.equal(b.stored.sentenceBatches[b.api.current.id].rawText,input.value);
 a.api.data.words=[];await a.api.selectLesson(a.api.current.id);await b.storageEvent();await b.input('[data-batch-input="notes"]','A later independent note.');assert(b.api.batchPractice.flush());assert.equal(b.stored.words.length,0);assert.equal(b.stored.sentenceBatches[b.api.current.id].rawText,input.value);
});

test('an editor cached before an external retell update cannot reintroduce the old answer when another mode saves',async()=>{
 const {harness}=require('./leo-coach-harness.cjs'),sharedStorage=new Map([[KEY,'{}']]),options={pilot:false,realOutput:true,sharedStorage},a=await harness(options);a.api.setTab('output');await a.click('[data-output-mode="retell"]');await a.input('[data-output-input="answer"]','The initial retell answer.');const b=await harness(options);b.api.setTab('output');await a.input('[data-output-input="answer"]','A newer retell answer from the other tab.');const oldInput=b.document.querySelector('[data-output-input="answer"]');await b.storageEvent();assert.equal(b.document.querySelector('[data-output-input="answer"]'),oldInput);await b.click('[data-output-mode="write"]');await b.input('[data-output-input="answer"]','My separate paragraph draft.');const modes=b.stored.outputDrafts.lessons[b.api.current.id].modes;assert.equal(modes.retell.answer,'A newer retell answer from the other tab.');assert.equal(modes.write.answers[0],'My separate paragraph draft.');
});

test('emergency exports contain unsaved guided, batch and coach drafts as well as independent persisted work',async()=>{
 const {harness}=require('./leo-coach-harness.cjs'),h=await harness({pilot:false,realOutput:true,realCoach:true});h.api.setTab('output');await h.click('[data-output-mode="sentences"]');h.setStorageWritable(false);await h.input('[data-sentence-input="answer"][data-sentence-kind="affirmative"]','The guided sentence must survive.');const key=h.api.sentencePractice.active.key;h.api.sentencePractice.flush();await h.click('[data-output-mode="batch"]');await h.input('[data-batch-input="text"]','The batch sentence must survive.');h.api.coach.drafts.set('explain:emergency',{rule:'Pending explanation',reason:'Pending reason',example:'This is my own example.',assisted:false});const backup=h.api.backupData();assert.equal(backup.sentencePractice[key].answers.affirmative,'The guided sentence must survive.');assert.equal(backup.sentenceBatches[h.api.current.id].rawText,'The batch sentence must survive.');assert.equal(backup.coachDrafts['explain:emergency'].rule,'Pending explanation');
});

test('the import UI previews merge conflicts before applying and exposes replace and pre-import recovery',async()=>{
 const {harness}=require('./leo-coach-harness.cjs'),h=await harness({pilot:false,loaded:{words:[{word:'local'}],records:{}}});await h.click('#open-import');await h.input('#import-text',JSON.stringify({format:'zhixin-backup-v1',exportedAt:'2020-01-01T00:00:00Z',data:{words:[{word:'backup'}],records:{old:{completed:true,lastAt:100}}}}));await h.click('#confirm-import');assert(h.document.querySelector('#backup-apply'));assert.match(h.document.querySelector('#dialog-root').innerHTML,/保留本地已有值/);assert.equal(h.stored.words.length,1);await h.click('#backup-apply');assert.deepEqual(h.stored.words.map(v=>v.word).sort(),['backup','local']);await h.click('#open-import');assert(h.document.querySelector('#backup-download-before'));await h.click('#backup-restore-before');assert.match(h.document.querySelector('#dialog-root').innerHTML,/确认替换本地数据/);await h.click('#backup-apply');assert.deepEqual(h.stored.words.map(v=>v.word),['local']);
});

test('a later save cannot overwrite an earlier quota-interrupted durable transaction',()=>{
 const store=memory({words:[],records:{}}),s=session(store,'A'),first=s.read().data;first.words.push({word:'saved-first'});const normal=store.setItem;store.setItem=function(key,value){if(!key.includes(':pending:'))throw Error('quota after transaction');normal.call(this,key,value);};const saved=s.commit(first);assert(saved.ok&&saved.pending);store.setItem=normal;const next=copy(first);next.records.l1={completed:true};assert(s.commit(next).ok);const recovered=session(store,'B').read().data;assert.equal(recovered.words[0]?.word,'saved-first');assert.equal(recovered.records.l1.completed,true);
});

test('unchanged schema defaults survive the first nested write and reserved-looking English words remain valid',()=>{
 const store=memory({}),initial={words:[],coach:{version:1,sequence:0,plans:{},events:[],items:{}}},s=api().createSession({storage:store,key:KEY,writer:'A',initial}),next=copy(initial);next.coach.sequence=1;next.coach.plans.today={task:'retell'};next.words.push({word:'constructor',meaning:'构造者'});assert(s.commit(next).ok);const data=s.read().data;assert.equal(data.coach.version,1);assert.deepEqual(data.coach.events,[]);assert.deepEqual(data.coach.items,{});assert.equal(data.words[0]?.word,'constructor');
});

test('independent coach completions and reviewed card IDs survive concurrent shared-array updates',()=>{
 const store=memory({words:[],coach:{version:1,events:[]},review:{daily:{'2026-10-27':{answered:[]}}}}),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.coach.events.push({roundKey:'round-a',taskId:'task-a',at:1});av.review.daily['2026-10-27'].answered.push('card-a');bv.coach.events.push({roundKey:'round-b',taskId:'task-b',at:2});bv.review.daily['2026-10-27'].answered.push('card-b');assert(a.commit(av).ok);assert(b.commit(bv).ok);const saved=session(store,'C').read().data;assert.deepEqual(saved.coach.events.map(e=>e.roundKey).sort(),['round-a','round-b']);assert.deepEqual(saved.review.daily['2026-10-27'].answered.sort(),['card-a','card-b']);
});

test('archives from different unit lessons and distinct passed levels retain independent progress',()=>{
 const store=memory({words:[],unitPractice:{archives:[]},game:{daily:{today:{passedLevels:[]}}}}),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.unitPractice.archives.push({lessonId:'l1',revision:'v1',attemptId:'a',answers:{q1:'first'}});bv.unitPractice.archives.push({lessonId:'l2',revision:'v1',attemptId:'b',answers:{q1:'second'}});av.game.daily.today.passedLevels.push('level-a');bv.game.daily.today.passedLevels.push('level-b');assert(a.commit(av).ok);assert(b.commit(bv).ok);const saved=session(store,'C').read().data;assert.deepEqual(saved.unitPractice.archives.map(x=>x.lessonId).sort(),['l1','l2']);assert.deepEqual(saved.game.daily.today.passedLevels.sort(),['level-a','level-b']);
});

test('review card scheduling, revision and evidence reconcile as one coherent card while other cards remain independent',()=>{
 const initial={words:[],review:{cards:{a:{stage:0,revision:0,dueAt:0,lastEvidence:null},b:{stage:0,revision:0,dueAt:0,lastEvidence:null}}}},store=memory(initial),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.review.cards.a={stage:1,revision:1,dueAt:100,lastEvidence:{answer:'first'}};av.review.cards.b={stage:1,revision:1,dueAt:100,lastEvidence:{answer:'independent'}};bv.review.cards.a={stage:0,revision:1,dueAt:10,lastEvidence:{answer:'forgotten'}};assert(a.commit(av).ok);assert(b.commit(bv).ok);const saved=session(store,'C').read().data;assert.deepEqual(saved.review.cards.a,bv.review.cards.a);assert.deepEqual(saved.review.cards.b,av.review.cards.b);
});

test('compact field slots avoid duplicated paths and read existing encoded scalar slots without stale card resurrection',()=>{
 const store=memory({words:[],review:{cards:{a:{stage:0,revision:0,dueAt:0}}}}),path=JSON.stringify(['review','cards','a','stage']);store.map.set(KEY+':field:'+encodeURIComponent(path),JSON.stringify({path,stamp:[1,'legacy'],value:1}));const s=session(store,'A'),next=s.read().data;assert.equal(next.review.cards.a.stage,1);next.review.cards.a={stage:0,revision:2,dueAt:10};assert(s.commit(next).ok);const saved=session(store,'B').read().data;assert.deepEqual(saved.review.cards.a,next.review.cards.a);const current=[...store.map].filter(([key])=>key.startsWith(KEY+':field:['));assert(current.length>0);for(const [key,value]of current){assert.equal(Object.hasOwn(JSON.parse(value),'path'),false,'path occurs only once, in the key');assert.doesNotThrow(()=>JSON.parse(key.slice((KEY+':field:').length)));}
});

test('a stale hint cannot downgrade a completed card revision but an explicit backup replacement can',()=>{
 const initial={words:[],review:{cards:{a:{stage:0,revision:0,dueAt:0,repetitions:0}}}},store=memory(initial),a=session(store,'A'),b=session(store,'B'),av=a.read().data,bv=b.read().data;av.review.cards.a={stage:1,revision:1,dueAt:100,repetitions:1,lastEvidence:{answer:'remembered'}};bv.review.cards.a.assistance={revision:0,at:1,reason:'answer'};assert(a.commit(av).ok);assert(b.commit(bv).ok);assert.deepEqual(session(store,'C').read().data.review.cards.a,av.review.cards.a);const restore=session(store,'D');assert(restore.commit(initial,{replace:true}).ok);assert.deepEqual(session(store,'E').read().data.review.cards.a,initial.review.cards.a);
});

test('every storage-boundary preemption preserves a completed review against a concurrent stale hint',t=>{
 function run(target=Infinity,phase='before'){
  const base=memory({words:[],review:{cards:{a:{stage:0,revision:0,dueAt:0,repetitions:0}}}});let armed=false,busy=false,count=0,injected=false,b,bv;
  function access(action){if(!armed||busy)return action();const index=++count,inject=()=>{if(!injected&&index===target){injected=true;busy=true;assert(b.commit(bv).ok);busy=false;}};if(phase==='before')inject();const result=action();if(phase==='after')inject();return result;}
  const store={get length(){return access(()=>base.length);},key:i=>access(()=>base.key(i)),getItem:key=>access(()=>base.getItem(key)),setItem:(key,value)=>access(()=>base.setItem(key,value)),removeItem:key=>access(()=>base.removeItem(key))},a=session(store,'A');b=session(store,'B');const av=a.read().data;bv=b.read().data;av.review.cards.a={stage:1,revision:1,dueAt:100,repetitions:1,lastEvidence:{answer:'remembered'}};bv.review.cards.a.assistance={revision:0,at:1,reason:'answer'};armed=true;assert(a.commit(av).ok);armed=false;if(Number.isFinite(target))assert(injected);assert.deepEqual(session(store,'C').read().data.review.cards.a,av.review.cards.a);return count;
 }
 const boundaries=run();for(const phase of ['before','after'])for(let index=1;index<=boundaries;index++)run(index,phase);t.diagnostic(boundaries*2+' same-card storage preemptions');
});
