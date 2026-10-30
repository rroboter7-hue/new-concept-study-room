'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('../account-data.js');
const entity=i=>JSON.stringify(['records','lesson-'+i]);
function fixture(){
 const stats={projects:0,snapshots:0,applies:0,checkpoints:0,puts:0},events=[],remote=new Map(),meta=new Map(),statuses=[];
 const measured={...D,project(value){stats.projects++;return D.project(value);}},module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../account-sync-client.js'),'utf8'),{module,exports:module.exports,require:()=>measured,AbortController,setTimeout,clearTimeout,Date,fetch}, {filename:'account-sync-client.js'});
 let data={words:[]},active={endpoint:'https://synthetic.invalid',user:{id:'synthetic',username:'a01'},token:'x'.repeat(43)},hook=null,applyHook=null,canApply=true,revision=0;
 const response=extra=>({user:{id:'synthetic',username:'a01'},serverTime:Date.now(),...extra});
 const engine=module.exports.create({identity:()=>active,key:'profile',storage:{getItem:key=>meta.get(key)||null,setItem(key,value){stats.checkpoints++;meta.set(key,value);}},snapshot(){stats.snapshots++;return D.copy(data);},
  async transport(route,args){if(route==='/v1/entry'){stats.puts++;events.push({kind:'put',body:D.copy(args.body)});}if(hook)await hook(route,args,stats.puts);
   if(route==='/v1/manifest')return response({entries:[...remote.values()].map(({value,...row})=>row),next:'',version:revision,unchanged:args.body.knownVersion===revision});
   if(route==='/v1/read')return response({entries:args.body.keys.filter(key=>remote.has(key)).map(key=>D.copy(remote.get(key))),remaining:[]});
   assert.equal(route,'/v1/entry');const body=args.body,old=remote.get(body.key);if(!old||D.compare({at:body.modifiedAt,id:body.writeId},{at:old.modifiedAt,id:old.writeId})>0){remote.set(body.key,{key:body.key,version:(old?.version||0)+1,modifiedAt:body.modifiedAt,writeId:body.writeId,deleted:body.deleted,...(!body.deleted?{value:D.copy(body.value)}:{})});revision++;}return response({entry:D.copy(remote.get(body.key))});
  },async applyRemote(changes,args){stats.applies++;if(!canApply)return false;if(applyHook)await applyHook(changes,args);data=D.receive(data,changes,args).data;return true;},onStatus:status=>statuses.push(status)});
 function edit(i,score=100,at=Date.now(),id='edit-'+i){data=D.apply(data,{[entity(i)]:{value:{score}}});data._accountEdits||={};data._accountEdits[entity(i)]={at,id};}
 function seed(count,payload=0){const at=Date.now()-1000;data={words:[],records:{},_accountEdits:{}};for(let i=0;i<count;i++){data.records['lesson-'+i]={score:i,...(payload?{note:'x'.repeat(payload)}:{})};data._accountEdits[entity(i)]={at,id:'seed-'+i};}}
 return {engine,stats,remote,meta,statuses,events,seed,edit,setHook:fn=>hook=fn,setApplyHook:fn=>applyHook=fn,setActive:value=>active=value,setApply:value=>canApply=value,get data(){return data;},reset(){for(const key of Object.keys(stats))stats[key]=0;events.length=0;statuses.length=0;}};
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
