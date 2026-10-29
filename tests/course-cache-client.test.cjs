'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const client=require('../course-cache-client.js');
function setup({supported=true,waiting=true,statusVersion=null,registerFailures=0}={}){
 const handlers={},workerHandlers={},registrationHandlers={},timers=new Map(),messages=[];let tick=0,reloads=0;
 const worker={state:'installed',postMessage(value,ports){messages.push(value);if(value.type==='study-course-cache-status'&&ports?.[0])ports[0].channel.port1.onmessage({data:{state:'ready',version:statusVersion}});},addEventListener(name,fn){workerHandlers[name]=fn;}};
 const registration={waiting:waiting?worker:null,active:worker,installing:null,addEventListener(name,fn){registrationHandlers[name]=fn;}};
 const root={addEventListener(name,fn){handlers[name]=fn;},isSecureContext:supported,caches:{},document:{getElementById(){return null;}},location:{href:'https://study.example/project/index.html?build=old#study',reload(){reloads++;}},navigator:{serviceWorker:{controller:worker,addEventListener(name,fn){handlers[name]=fn;},async register(url,options){messages.push({url,options});if(registerFailures-->0)throw Error('temporary registration failure');return registration;}}},setTimeout(fn,ms){timers.set(++tick,fn);return tick;},clearTimeout(id){timers.delete(id);}};
 Object.defineProperty(root,'localStorage',{get(){throw Error('do not open learner storage');}});Object.defineProperty(root,'indexedDB',{get(){throw Error('do not open learner storage');}});
 if(statusVersion)root.MessageChannel=function(){this.port1={close(){}};this.port2={channel:this};};
 const api=client(root);api.start({worker:'course-cache-worker.js',version:'a'.repeat(64)});
 return {api,root,handlers,messages,registration,worker,timers,get reloads(){return reloads;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('client registers exact HTTPS subdirectory worker scope and honestly reports unsupported or installing',async()=>{const h=setup();await settle();assert.equal(h.messages[0].url,'https://study.example/project/course-cache-worker.js');assert.equal(h.messages[0].options.scope,'/project/');assert.equal(h.messages[0].options.updateViaCache,'none');assert.equal(h.api.snapshot().state,'waiting');assert.equal(h.api.snapshot().canApply,false);const unsupported=setup({supported:false});assert.equal(unsupported.messages.length,0);assert.equal(unsupported.api.snapshot().state,'unsupported');const first=setup({waiting:false});assert.notEqual(first.api.snapshot().state,'ready');});
test('unsafe apply and failed draft preparation never activate worker or reload editor',async()=>{const h=setup();await settle();h.api.configureUpdate({canApply:()=>false,prepare:async()=>()=>true});assert.equal(await h.api.applyUpdate(),false);h.api.configureUpdate({canApply:()=>true,prepare:async()=>false});assert.equal(await h.api.applyUpdate(),false);h.handlers.controllerchange();assert.equal(h.reloads,0);assert.equal(h.messages.filter(m=>m.type==='study-course-cache-apply').length,0);});
test('explicit safe shelf update activates once and only initiating tab reloads',async()=>{const h=setup();await settle();h.api.configureUpdate({canApply:()=>true,prepare:async()=>()=>true});assert.equal(h.api.snapshot().canApply,true);assert.equal(await h.api.applyUpdate(),true);assert.equal(await h.api.applyUpdate(),false);assert.equal(h.messages.filter(m=>m.type==='study-course-cache-apply').length,1);h.handlers.controllerchange();assert.equal(h.reloads,1);h.handlers.controllerchange();assert.equal(h.reloads,1);const other=setup();await settle();other.handlers.controllerchange();assert.equal(other.reloads,0);});
test('navigation during awaited draft flush or after activation never reloads the new editor',async()=>{const h=setup();await settle();let safe=true,resolve;h.api.configureUpdate({canApply:()=>safe,prepare:()=>new Promise(done=>resolve=done)});const apply=h.api.applyUpdate();safe=false;resolve(()=>safe);assert.equal(await apply,false);assert.equal(h.messages.filter(m=>m.type==='study-course-cache-apply').length,0);safe=true;h.api.configureUpdate({canApply:()=>safe,prepare:async()=>()=>safe});assert.equal(await h.api.applyUpdate(),true);safe=false;h.handlers.controllerchange();assert.equal(h.reloads,0);});
test('worker version pin response uses build identity without accessing learner data',async()=>{const h=setup();await settle();let reply;h.handlers.message({data:{type:'study-course-cache-version'},ports:[{postMessage(value){reply=value;}}]});assert.equal(reply.version,'a'.repeat(64));});

test('ready status is claimed only for the exact page version, never for a stale controlling worker',async()=>{const matching=setup({waiting:false,statusVersion:'a'.repeat(64)});await settle();assert.equal(matching.api.snapshot().state,'ready');const stale=setup({waiting:false,statusVersion:'b'.repeat(64)});await settle();assert.equal(stale.api.snapshot().state,'missing');});

test('returning online and resuming a mobile page rechecks the existing registration without touching records',async()=>{
 const h=setup({waiting:false});await settle();let checks=0;h.registration.update=async()=>{checks++;};
 assert.equal(typeof h.handlers.online,'function');assert.equal(typeof h.handlers.pageshow,'function');
 await h.handlers.online();await h.handlers.pageshow({persisted:true});await settle();assert(checks>=1);assert.equal(h.reloads,0);
});

test('a newly activated version reloads only after the safe shelf draft guard approves, and defers an active editor',async()=>{
 const h=setup({waiting:false,statusVersion:'b'.repeat(64)});await settle();let safe=false,flushes=0;
 h.api.configureUpdate({canApply:()=>safe,prepare:async()=>{flushes++;return ()=>safe;}});
 h.handlers.controllerchange();await settle();assert.equal(h.reloads,0);assert.equal(flushes,0);
 safe=true;h.api.refresh();await settle();assert.equal(flushes,1);assert.equal(h.reloads,1);h.api.refresh();await settle();assert.equal(h.reloads,1);
});

test('automatic version handoff never reloads when saving drafts fails or navigation starts during a save',async()=>{
 for(const failed of [true,false]){const h=setup({waiting:false,statusVersion:'b'.repeat(64)});await settle();let safe=true;
 h.api.configureUpdate({canApply:()=>safe,prepare:async()=>{if(failed)return false;safe=false;return ()=>safe;}});
 h.handlers.controllerchange();await settle();assert.equal(h.reloads,0);}
});

test('failed update checks schedule a bounded retry rather than leaving a failed installation stuck forever',async()=>{
 const h=setup({waiting:false});await settle();let checks=0;h.registration.update=async()=>{checks++;throw Error('temporary network failure');};
 assert.equal(typeof h.handlers.online,'function');await h.handlers.online();await settle();
 for(let i=0;i<5;i++){const tasks=[...h.timers.values()];h.timers.clear();for(const fn of tasks)fn();await settle();}
 assert(checks>=2);assert(checks<=3);assert.equal(h.reloads,0);
});

test('a temporary worker registration failure retries on reconnect without clearing any storage',async()=>{const h=setup({registerFailures:1,waiting:false});await settle();assert.equal(h.api.snapshot().state,'failed');await h.handlers.online();await settle();assert.equal(h.messages.filter(m=>m.url).length,2);assert.notEqual(h.api.snapshot().state,'failed');assert.equal(h.reloads,0);});
