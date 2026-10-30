'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../account-data.js');
const entity=i=>JSON.stringify(['records','lesson-'+i]);
function fixture({asyncMeta=false}={}){
 const stats={projects:0,snapshots:0,applies:0,checkpoints:0,asyncCheckpoints:0,puts:0},events=[],remote=new Map(),meta=new Map(),statuses=[];
 const measured={...D,project(value){stats.projects++;return D.project(value);}},module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../account-sync-client.js'),'utf8'),{module,exports:module.exports,require:()=>measured,AbortController,setTimeout,clearTimeout,Date,fetch}, {filename:'account-sync-client.js'});
 let data={words:[]},active={endpoint:'https://synthetic.invalid',user:{id:'synthetic',username:'a01'},token:'x'.repeat(43)},hook=null,applyHook=null,metaHook=null,canApply=true,revision=0;
 const response=extra=>({user:{id:'synthetic',username:'a01'},serverTime:Date.now(),...extra});
 const storage={getItem:key=>meta.get(key)||null,setItem(key,value){if(asyncMeta)throw Error('synchronous sync metadata would exceed the local quota');stats.checkpoints++;meta.set(key,value);}};
 if(asyncMeta)storage.putSyncMeta=async value=>{stats.checkpoints++;stats.asyncCheckpoints++;if(metaHook)await metaHook(value,stats.asyncCheckpoints);meta.set('profile:cloud-sync-v1',value);};
 const engine=module.exports.create({identity:()=>active,key:'profile',storage,snapshot(){stats.snapshots++;return D.copy(data);},
  async transport(route,args){if(route==='/v1/entry'){stats.puts++;events.push({kind:'put',body:D.copy(args.body)});}if(hook)await hook(route,args,stats.puts);
   if(route==='/v1/manifest')return response({entries:[...remote.values()].map(({value,...row})=>row),next:'',version:revision,unchanged:args.body.knownVersion===revision});
   if(route==='/v1/read')return response({entries:args.body.keys.filter(key=>remote.has(key)).map(key=>D.copy(remote.get(key))),remaining:[]});
   assert.equal(route,'/v1/entry');const body=args.body,old=remote.get(body.key);if(!old||D.compare({at:body.modifiedAt,id:body.writeId},{at:old.modifiedAt,id:old.writeId})>0){remote.set(body.key,{key:body.key,version:(old?.version||0)+1,modifiedAt:body.modifiedAt,writeId:body.writeId,deleted:body.deleted,...(!body.deleted?{value:D.copy(body.value)}:{})});revision++;}return response({entry:D.copy(remote.get(body.key))});
  },async applyRemote(changes,args){stats.applies++;if(!canApply)return false;if(applyHook)await applyHook(changes,args);data=D.receive(data,changes,args).data;return true;},onStatus:status=>statuses.push(status)});
 function edit(i,score=100,at=Date.now(),id='edit-'+i){data=D.apply(data,{[entity(i)]:{value:{score}}});data._accountEdits||={};data._accountEdits[entity(i)]={at,id};}
 function seed(count,payload=0){const at=Date.now()-1000;data={words:[],records:{},_accountEdits:{}};for(let i=0;i<count;i++){data.records['lesson-'+i]={score:i,...(payload?{note:'x'.repeat(payload)}:{})};data._accountEdits[entity(i)]={at,id:'seed-'+i};}}
 return {engine,storage,stats,remote,meta,statuses,events,seed,edit,setHook:fn=>hook=fn,setApplyHook:fn=>applyHook=fn,setMetaHook:fn=>metaHook=fn,setActive:value=>active=value,setApply:value=>canApply=value,get data(){return data;},reset(){for(const key of Object.keys(stats))stats[key]=0;events.length=0;statuses.length=0;}};
}
test('a hundred pending entities project and persist once per bounded batch, with numeric progress',async()=>{
 const f=fixture();await f.engine.sync();f.reset();f.seed(100);assert.equal(await f.engine.sync({pull:false}),true);
 assert.equal(f.stats.puts,100);assert(f.stats.projects<=7,'one full projection per at most 16 entities');assert(f.stats.applies<=7,'one local ACK apply per batch');assert(f.stats.checkpoints<=8,'one checkpoint per batch plus final successful time');assert(f.stats.snapshots<=32,'snapshot work grows with batches, not entities');
 assert.equal(f.remote.size,100);assert(f.statuses.some(s=>s.completed===16&&s.total===100));assert(f.statuses.some(s=>s.completed===100&&s.total===100));assert.equal(f.engine.state().phase,'synced');
});
test('upload batches yield to a real task before uploading the seventeenth entity',async()=>{
 const f=fixture();await f.engine.sync();f.seed(33);let painted=false,observed;
 const timer=setTimeout(()=>{painted=true;},0);f.setHook((route,args,count)=>{if(route==='/v1/entry'&&count===17)observed=painted;});
 try{assert.equal(await f.engine.sync({pull:false}),true);assert.equal(observed,true);}finally{clearTimeout(timer);f.engine.stop();}
});
test('edits made during an in-flight batch survive its ACK and reach the cloud on retry',async()=>{
 const f=fixture();await f.engine.sync();f.seed(20);f.setHook((route,args,count)=>{if(route==='/v1/entry'&&count===5){f.edit(0,700,Date.now()+10,'new-same');f.edit(6,706,Date.now()+10,'new-later-in-batch');f.edit('new',999,Date.now()+10,'new-entity');}});
 assert.equal(await f.engine.sync({pull:false}),false);assert.equal(f.data.records['lesson-0'].score,700);assert.equal(f.data.records['lesson-6'].score,706);assert.equal(f.data.records['lesson-new'].score,999);assert.equal(f.engine.state().pending,3);
 f.setHook(null);assert.equal(await f.engine.sync({pull:false}),true);for(const [i,score]of [[0,700],[6,706],['new',999]])assert.equal(f.remote.get(entity(i)).value.score,score);assert.equal(f.engine.state().pending,0);
});
test('an edit saved while the batch ACK is being applied is not replaced by its earlier value',async()=>{
 const f=fixture();await f.engine.sync();f.seed(16);let release,entered;
 const gate=new Promise(resolve=>release=resolve),hit=new Promise(resolve=>entered=resolve);
 f.setApplyHook(async()=>{entered();await gate;});const run=f.engine.sync({pull:false});await hit;f.edit(0,900,Date.now()+10,'during-local-apply');release();
 assert.equal(await run,false);assert.equal(f.data.records['lesson-0'].score,900);assert.equal(f.engine.state().pending,1);
 f.setApplyHook(null);assert.equal(await f.engine.sync({pull:false}),true);assert.equal(f.remote.get(entity(0)).value.score,900);
});
test('partial network failure checkpoints ACKs once and retries the rest without duplicate versions',async()=>{
 const f=fixture();await f.engine.sync();f.seed(20);f.reset();f.setHook((route,args,count)=>{if(route==='/v1/entry'&&count===5)throw Error('synthetic network failure');});
 assert.equal(await f.engine.sync({pull:false}),false);assert.equal(f.remote.size,4);assert.equal(f.stats.applies,1);assert.equal(f.stats.checkpoints,1);assert.equal(f.engine.state().pending,16);assert.equal(f.engine.state().phase,'offline');
 f.setHook(null);assert.equal(await f.engine.sync({pull:false}),true);assert.equal(f.remote.size,20);assert([...f.remote.values()].every(row=>row.version===1));
});
test('failed local batch apply leaves all ACKs pending and replay remains idempotent',async()=>{
 const f=fixture();await f.engine.sync();f.seed(16);f.reset();f.setApply(false);assert.equal(await f.engine.sync({pull:false}),false);assert.equal(f.engine.state().pending,16);assert.equal(f.stats.checkpoints,0);assert.equal(f.remote.size,16);
 f.setApply(true);assert.equal(await f.engine.sync({pull:false}),true);assert([...f.remote.values()].every(row=>row.version===1));
});
test('an identity switch during a PUT prevents every buffered ACK from changing the local profile',async()=>{
 const f=fixture();await f.engine.sync();f.seed(20);f.reset();const before=D.copy(f.data);
 f.setHook((route,args,count)=>{if(route==='/v1/entry'&&count===5)f.setActive({endpoint:'https://synthetic.invalid',user:{id:'another',username:'a02'},token:'z'.repeat(43)});});
 assert.equal(await f.engine.sync({pull:false}),false);assert.deepEqual(f.data,before);assert.equal(f.stats.applies,0);assert.equal(f.stats.checkpoints,0);
});
for(const [status,phase]of [[401,'login-required'],[413,'limit']])test('a '+status+' response keeps unacknowledged entities local and reports '+phase,async()=>{
 const f=fixture();await f.engine.sync();f.seed(20);f.reset();f.setHook((route,args,count)=>{if(route==='/v1/entry'&&count===5){const e=Error('synthetic denial');e.status=status;throw e;}});
 assert.equal(await f.engine.sync({pull:false}),false);assert.equal(f.engine.state().phase,phase);assert.equal(f.engine.state().pending,16);assert.equal(f.stats.puts,5);assert.equal(f.remote.size,4);assert.equal(f.data.records['lesson-19'].score,19);
});
test('a realistic thousand-record profile keeps whole-profile work proportional to batches',async()=>{
 const f=fixture();await f.engine.sync();f.seed(1024,512);f.reset();assert.equal(await f.engine.sync({pull:false}),true);
 assert.equal(f.remote.size,1024);assert.equal(f.stats.projects,64);assert.equal(f.stats.applies,64);assert.equal(f.stats.checkpoints,65);assert(f.stats.snapshots<=4*64+8);assert([...f.remote.values()].every(row=>row.version===1));
});
test('a successful sync waits for its final asynchronous metadata transaction before reporting synced',async t=>{
 const f=fixture({asyncMeta:true});assert.equal(await f.engine.sync(),true);f.seed(2);f.reset();let release,started=false,finished=false;
 const gate=new Promise(resolve=>release=resolve);t.after(release);f.setMetaHook(async(value,count)=>{if(count===2){started=true;await gate;}});
 const run=f.engine.sync({pull:false}).then(value=>{finished=true;return value;});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(started,true);assert.equal(finished,false);assert.equal(f.engine.state().phase,'syncing');assert(!f.statuses.some(status=>status.phase==='synced'));
 release();assert.equal(await run,true);assert.equal(f.engine.state().phase,'synced');assert.equal(f.stats.asyncCheckpoints,2);
});
test('a failed asynchronous ACK checkpoint stays pending and retries with the original write IDs',async()=>{
 const f=fixture({asyncMeta:true});assert.equal(await f.engine.sync(),true);f.seed(17);f.reset();f.setMetaHook(()=>{throw Error('synthetic IDB transaction failed');});
 assert.equal(await f.engine.sync({pull:false}),false);assert.equal(f.engine.state().phase,'offline');assert.equal(f.engine.state().pending,17);assert.equal(f.remote.size,16);assert.equal(Object.keys(JSON.parse(f.meta.get('profile:cloud-sync-v1')).entries).length,0);
 f.setMetaHook(null);assert.equal(await f.engine.sync({pull:false}),true);assert.equal(f.remote.size,17);assert([...f.remote.values()].every(row=>row.version===1));assert.equal(f.engine.state().pending,0);
});
test('a failed asynchronous pull checkpoint cannot acknowledge a cloud version before durable save',async()=>{
 const f=fixture({asyncMeta:true});f.setMetaHook(()=>{throw Error('synthetic pull metadata failure');});assert.equal(await f.engine.sync(),false);
 assert.equal(f.meta.size,0);assert.equal(f.engine.state().lastSyncedAt,0);f.setMetaHook(null);assert.equal(await f.engine.sync(),true);assert.equal(JSON.parse(f.meta.get('profile:cloud-sync-v1')).knownVersion,0);
});
test('an identity switch while async metadata persists stops the next batch and cannot report synced',async t=>{
 const f=fixture({asyncMeta:true});assert.equal(await f.engine.sync(),true);f.seed(20);f.reset();let release,started;
 const gate=new Promise(resolve=>release=resolve),hit=new Promise(resolve=>started=resolve);t.after(release);f.setMetaHook(async()=>{started();await gate;});
 const run=f.engine.sync({pull:false});await hit;f.setActive({endpoint:'https://synthetic.invalid',user:{id:'another',username:'a02'},token:'z'.repeat(43)});release();
 assert.equal(await run,false);assert.equal(f.stats.puts,16);assert.equal(f.engine.state().pending,20);assert(!f.statuses.some(status=>status.phase==='synced'));
});
test('legacy storage fallback is also awaited when its setItem adapter is asynchronous',async t=>{
 const f=fixture();await f.engine.sync();f.seed(1);f.reset();let release,started,finished=false;
 const gate=new Promise(resolve=>release=resolve),hit=new Promise(resolve=>started=resolve),set=f.storage.setItem;t.after(release);
 f.storage.setItem=async(key,value)=>{started();await gate;set(key,value);};const run=f.engine.sync({pull:false}).then(value=>{finished=true;return value;});await hit;
 assert.equal(finished,false);assert.equal(f.engine.state().pending,1);release();assert.equal(await run,true);assert.equal(f.engine.state().pending,0);
});
test('imported records upload with a nearly full guest origin while ACKs and sync metadata stay in IDB',async()=>{
 const Cache=require('../account-cache.js'),Storage=require('../study-storage.js'),idbFixture=require('./support/account-indexeddb.cjs'),Sync=require('../account-sync-client.js');
 const rows=new Map(),limit=5*1024*1024,key='near-full:account',used=()=>[...rows].reduce((sum,[k,v])=>sum+2*(k.length+v.length),0);
 const disk={get length(){return rows.size},key:i=>[...rows.keys()][i]??null,getItem:k=>rows.get(k)??null,setItem(k,value){value=String(value);const old=rows.get(k);rows.set(k,value);if(used()>limit){if(old===undefined)rows.delete(k);else rows.set(k,old);throw Error('QuotaExceededError');}},removeItem:k=>rows.delete(k)};
 const guest={words:[],records:Object.fromEntries(Array.from({length:48},(_,i)=>['lesson-'+i,{notes:'学'.repeat(500)}]))},guestRaw=JSON.stringify(guest);disk.setItem('guest',guestRaw);
 const indexedDB=idbFixture(),cache=await Cache.open({key,storage:disk,indexedDB});await cache.seed({words:[]});
 try{await cache.writeBatch(view=>{const s=Storage.createSession({storage:view,key}),data=s.read().data;Object.assign(data,guest);data._accountEdits=Object.fromEntries(Object.keys(D.project(guest)).map((name,i)=>[name,{at:Date.now()-1000,id:'near-full-'+i}]));return s.commit(data,{replace:true,source:'cloud'});});
  const fillerKey='other-local-data',filler='x'.repeat(Math.floor((limit-used()-1024)/2)-fillerKey.length);disk.setItem(fillerKey,filler);const before=used(),identity={endpoint:'https://synthetic.invalid',user:{id:'synthetic',username:'a01'},token:'x'.repeat(43)},remote=new Map();
  const engine=Sync.create({identity:()=>identity,storage:cache,key,snapshot:()=>Storage.read({storage:cache,key}).data,applyRemote:(changes,args)=>cache.writeBatch(view=>{const s=Storage.createSession({storage:view,key});return s.commit(D.receive(s.read().data,changes,args).data,{replace:true,source:'cloud'});}).then(result=>result.ok),transport:async(route,{body})=>({user:identity.user,serverTime:Date.now(),...(route==='/v1/manifest'?{version:0,entries:[],next:''}:(assert.equal(route,'/v1/entry'),remote.set(body.key,{...body,version:1}),{entry:remote.get(body.key)}))})});
  try{assert.equal(await engine.sync(),true);assert.equal(engine.state().pending,0);assert.equal(remote.size,48);assert.equal(disk.getItem('guest'),guestRaw);assert.equal(disk.getItem(fillerKey),filler);assert.equal(used(),before);assert.equal(Object.keys(JSON.parse(cache.getItem(key+':cloud-sync-v1')).entries).length,48);}finally{engine.stop();}
 }finally{cache.close();}
});
