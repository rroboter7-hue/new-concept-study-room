'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./support/account-indexeddb.cjs');
const StudyStorage = require('../study-storage.js');
let Cache; try { Cache = require('../account-cache.js'); } catch { Cache = {}; }
function storageFixture(limit = 5 * 1024 * 1024) {
 const values = new Map();
 return {
  get length() { return values.size; }, key(i) { return [...values.keys()][i] ?? null; },
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { value = String(value); const next = new Map(values).set(key, value); if ([...next].reduce((n,[k,v]) => n + 2*(k.length+v.length),0) > limit) throw new Error('QuotaExceededError'); values.set(key,value); },
  removeItem(key) { values.delete(key); },
  bytes() { return [...values].reduce((n,[k,v]) => n+2*(k.length+v.length),0); }
 };
}
const options = (storage, indexedDB, extra = {}) => ({key:'study:account:alice',storage,indexedDB,...extra});
test('requires persistent IndexedDB instead of silently claiming a memory save', async () => {
 assert.equal(typeof Cache.open, 'function');
 await assert.rejects(Cache.open(options(storageFixture(),null)), /IndexedDB/i);
 const idb = fixture(); idb.blocked = true;
 await assert.rejects(Cache.open(options(storageFixture(),idb)), /blocked|阻止/i);
});
test('unflushed learner journal survives crash and reopens without touching guest or other accounts', async () => {
 const storage=storageFixture(), idb=fixture(); storage.setItem('guest','keep'); storage.setItem('study:account:bob','bob');
 const cache=await Cache.open(options(storage,idb)); await cache.seed({words:[],records:{}});
 const session=StudyStorage.createSession({storage:cache,key:'study:account:alice',writer:'a'}); session.read();
 assert.equal(session.commit({words:[],records:{lesson:{score:7}}}).ok,true);
 cache.close();
 const reopened=await Cache.open(options(storage,idb));
 assert.equal(StudyStorage.read({storage:reopened,key:'study:account:alice'}).data.records.lesson.score,7);
 await reopened.flush(); reopened.close();
 const durable=await Cache.open(options(storage,idb));
 assert.equal(StudyStorage.read({storage:durable,key:'study:account:alice'}).data.records.lesson.score,7);
 assert.equal(storage.getItem('guest'),'keep'); assert.equal(storage.getItem('study:account:bob'),'bob'); durable.close();
});
test('large seed uses IndexedDB while a nearly full UTF16 guest remains intact', async () => {
 const storage=storageFixture(), idb=fixture(); storage.setItem('guest','学'.repeat(2500000)); const before=storage.bytes();
 const cache=await Cache.open(options(storage,idb)); const payload={words:[],blob:'文'.repeat(1200000)};
 await cache.seed(payload); assert.ok(storage.bytes()-before < 4096);
 const session=StudyStorage.createSession({storage:cache,key:'study:account:alice',writer:'a'}); session.read();
 assert.equal(session.commit({...payload,score:1}).ok,true); assert.ok(storage.bytes()-before < 8192);
 await cache.flush(); cache.close();
 const reopened=await Cache.open(options(storage,idb)); const result=StudyStorage.read({storage:reopened,key:'study:account:alice'});
 assert.equal(result.data.blob.length,1200000); assert.equal(result.data.score,1); reopened.close();
});
test('localStorage disk full throws before changing visible state', async () => {
 const storage=storageFixture(1800), idb=fixture(); const cache=await Cache.open(options(storage,idb)); await cache.seed({words:[]});
 const slot='study:account:alice:pending:writer';
 assert.throws(()=>cache.setItem(slot,'x'.repeat(1000)),/Quota/); assert.equal(cache.getItem(slot),null); cache.close();
});
test('failed flush retains durable recovery and reports background errors', async () => {
 const storage=storageFixture(),idb=fixture(),errors=[]; const cache=await Cache.open(options(storage,idb,{onError:error=>errors.push(error)}));
 await cache.seed({words:[]}); cache.setItem('study:account:alice:pending:a','{"operations":{}}'); idb.failNext=true;
 await assert.rejects(cache.flush(),/disk full/); assert.ok(storage.length>0); cache.close();
 const reopened=await Cache.open(options(storage,idb)); assert.equal(reopened.getItem('study:account:alice:pending:a'),'{"operations":{}}'); await reopened.flush(); reopened.close();
});
test('independent tabs persist field slots without overwriting another writer with a stale base', async () => {
 const storage=storageFixture(),idb=fixture(); const a=await Cache.open(options(storage,idb)); await a.seed({words:[],records:{}});
 let external=0; const b=await Cache.open(options(storage,idb,{onExternal:()=>external++}));
 const sa=StudyStorage.createSession({storage:a,key:'study:account:alice',writer:'a'}),sb=StudyStorage.createSession({storage:b,key:'study:account:alice',writer:'b'}); sa.read(); sb.read();
 assert.equal(sa.commit({words:[],records:{one:1}}).ok,true); assert.equal(sb.commit({words:[],records:{two:2}}).ok,true);
 await b.flush(); await a.flush(); a.close(); b.close();
 const c=await Cache.open(options(storage,idb)); assert.deepEqual(StudyStorage.read({storage:c,key:'study:account:alice'}).data.records,{one:1,two:2}); assert.ok(external>0); c.close();
});
test('flush cleanup keeps a concurrent operation and seed failure preserves the prior profile', async () => {
 const storage=storageFixture(),idb=fixture(); const a=await Cache.open(options(storage,idb)); await a.seed({words:[],value:'original'});
 a.setItem('study:account:alice:pending:a','first'); idb.beforeCommit=()=>a.setItem('study:account:alice:pending:a','second'); await a.flush(); a.close();
 const b=await Cache.open(options(storage,idb)); assert.equal(b.getItem('study:account:alice:pending:a'),'second');
 idb.failNext=true; await assert.rejects(b.seed({words:[],value:'replacement'}),/disk full/);
 assert.equal(JSON.parse(b.getItem('study:account:alice')).value,'original'); assert.equal(b.getItem('study:account:alice:pending:a'),'second'); b.close();
});
test('background IDB failure invokes onError and remains recoverable after close', async () => {
 const storage=storageFixture(),idb=fixture(); let delivered;
 const errorReported=new Promise(resolve=>{delivered=resolve;});
 const cache=await Cache.open(options(storage,idb,{onError:delivered})); await cache.seed({words:[]}); idb.failNext=true;
 cache.setItem('study:account:alice:pending:a','recover this');
 let timeout; const error=await Promise.race([errorReported,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('onError was not invoked')),500);})]); clearTimeout(timeout);
 assert.match(error.message,/disk full/); cache.close();
 const reopened=await Cache.open(options(storage,idb)); assert.equal(reopened.getItem('study:account:alice:pending:a'),'recover this'); reopened.close();
});
test('successful seed replaces only this account and resets its old field journals', async () => {
 const storage=storageFixture(),idb=fixture(); storage.setItem('guest','guest');
 const cache=await Cache.open(options(storage,idb)); await cache.seed({words:[],records:{old:1}});
 const session=StudyStorage.createSession({storage:cache,key:'study:account:alice',writer:'a'}); session.read(); session.commit({words:[],records:{old:2},stale:true});
 await cache.flush(); await cache.seed({words:[],records:{fresh:3}}); cache.close();
 const reopened=await Cache.open(options(storage,idb)); assert.deepEqual(StudyStorage.read({storage:reopened,key:'study:account:alice'}).data,{words:[],records:{fresh:3}});
 assert.equal(storage.getItem('guest'),'guest'); reopened.close();
});
test('separate browser realms receive pending journals and bulk seed invalidations', async () => {
 const vm=require('node:vm'),fs=require('node:fs'),idb=fixture(),disk=storageFixture(),tabs=[];
 function tab(){
  let listener;const surface={get length(){return disk.length;},key:i=>disk.key(i),getItem:key=>disk.getItem(key),setItem(key,value){const oldValue=disk.getItem(key);disk.setItem(key,value);dispatch(key,oldValue,String(value));},removeItem(key){const oldValue=disk.getItem(key);disk.removeItem(key);dispatch(key,oldValue,null);}};
  function dispatch(key,oldValue,newValue){for(const target of tabs)if(target.surface!==surface)setImmediate(()=>target.deliver({key,oldValue,newValue,storageArea:target.surface}));}
  const context=vm.createContext({setTimeout,clearTimeout,console,addEventListener:(_name,fn)=>{listener=fn;},removeEventListener:()=>{listener=null;}});
  vm.runInContext(fs.readFileSync(require.resolve('../account-cache.js'),'utf8'),context);
  const result={surface,api:context.StudyAccountCache,deliver:event=>listener?.(event)};tabs.push(result);return result;
 }
 const first=tab(),second=tab();let external=0;
 const a=await first.api.open(options(first.surface,idb)); await a.seed({words:[],records:{}});
 const b=await second.api.open(options(second.surface,idb,{onExternal:()=>external++}));
 const session=StudyStorage.createSession({storage:a,key:'study:account:alice',writer:'a'});session.read();session.commit({words:[],records:{remote:9}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(StudyStorage.read({storage:b,key:'study:account:alice'}).data.records.remote,9);assert.ok(external>0);
 await a.flush();await a.seed({words:[],blob:'种'.repeat(50000)});
 for(let i=0;i<20&&JSON.parse(b.getItem('study:account:alice')).blob===undefined;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(StudyStorage.read({storage:b,key:'study:account:alice'}).data.blob.length,50000);a.close();b.close();
});
test('a lower-stamped concurrent seed cannot replace the winning base or clean its newer WAL', async () => {
 const vm=require('node:vm'),fs=require('node:fs'),idb=fixture(),storage=storageFixture();
 const code=fs.readFileSync(require.resolve('../account-cache.js'),'utf8');
 function realm(){let now=1000;const context=vm.createContext({setTimeout,clearTimeout,Date:{now:()=>now}});vm.runInContext(code,context);return {api:context.StudyAccountCache,setClock:value=>{now=value;}};}
 const first=realm(),second=realm(),a=await first.api.open(options(storage,idb));await a.seed({value:'original',words:[]});
 const b=await second.api.open(options(storage,idb));first.setClock(5000);
 idb.beforeCommit=()=>a.setItem('study:account:alice:pending:concurrent','newer pending edit');
 await Promise.all([a.seed({value:'newer',words:[]}),b.seed({value:'older',words:[]})]);
 assert.equal(JSON.parse(a.getItem('study:account:alice')).value,'newer');
 assert.equal(JSON.parse(b.getItem('study:account:alice')).value,'newer');
 assert.equal(b.getItem('study:account:alice:pending:concurrent'),'newer pending edit');a.close();b.close();
 const reopened=await first.api.open(options(storage,idb));assert.equal(JSON.parse(reopened.getItem('study:account:alice')).value,'newer');assert.equal(reopened.getItem('study:account:alice:pending:concurrent'),'newer pending edit');reopened.close();
});
test('async pre-import snapshot keeps a 2.4MB recovery copy out of a nearly full guest localStorage', async () => {
 const storage=storageFixture(),idb=fixture();storage.setItem('guest','学'.repeat(2500000));const before=storage.bytes();
 const cache=await Cache.open(options(storage,idb));await cache.seed({words:[],value:'account'});
 const snapshot=JSON.stringify({format:'zhixin-backup-v1',data:{words:[],blob:'文'.repeat(1200000)}});
 await cache.putSnapshot('study:account:alice:pre-import',snapshot);
 assert.ok(storage.bytes()-before<4096);assert.equal(storage.getItem('guest').length,2500000);cache.close();
 const reopened=await Cache.open(options(storage,idb));assert.equal(reopened.getItem('study:account:alice:pre-import'),snapshot);
 await assert.rejects(reopened.putSnapshot('study:account:bob:pre-import','wrong account'),/snapshot|pre-import|备份/i);
 await assert.rejects(reopened.putSnapshot('study:account:alice:field:wrong','wrong slot'),/snapshot|pre-import|备份/i);reopened.close();
});
test('an aborted async snapshot preserves its old recovery value without external notification', async () => {
 const storage=storageFixture(),idb=fixture(),a=await Cache.open(options(storage,idb));await a.seed({words:[]});
 let external=0;const b=await Cache.open(options(storage,idb,{onExternal:()=>external++}));
 await a.putSnapshot('study:account:alice:pre-import','old snapshot');assert.equal(b.getItem('study:account:alice:pre-import'),'old snapshot');const before=external;
 idb.failNext=true;await assert.rejects(a.putSnapshot('study:account:alice:pre-import','failed replacement'),/disk full/);
 assert.equal(a.getItem('study:account:alice:pre-import'),'old snapshot');assert.equal(b.getItem('study:account:alice:pre-import'),'old snapshot');assert.equal(external,before);a.close();b.close();
 const reopened=await Cache.open(options(storage,idb));assert.equal(reopened.getItem('study:account:alice:pre-import'),'old snapshot');reopened.close();
});
test('equal-clock writer stamps use binary ordering even when a realm has a different locale order', async () => {
 const vm=require('node:vm'),fs=require('node:fs'),idb=fixture(),storage=storageFixture(),code=fs.readFileSync(require.resolve('../account-cache.js'),'utf8');
 function realm(random){const math=Object.create(Math);math.random=()=>random;const context=vm.createContext({setTimeout,clearTimeout,Date:{now:()=>1000},Math:math});vm.runInContext("String.prototype.localeCompare=function(other){return this.toString()===other?0:this.toString()>other?-1:1;};",context);vm.runInContext(code,context);return context.StudyAccountCache;}
 const a=await realm(0.25).open(options(storage,idb)),b=await realm(0.75).open(options(storage,idb));
 // The writer IDs end in 9 and r respectively; code-unit order chooses r.
 await Promise.all([a.putSnapshot('study:account:alice:pre-import','lower writer'),b.putSnapshot('study:account:alice:pre-import','higher writer')]);a.close();b.close();
 const reopened=await Cache.open(options(storage,idb));assert.equal(reopened.getItem('study:account:alice:pre-import'),'higher writer');reopened.close();
});
test('ifEmpty initialization cannot replace an existing account or clear its live learner WAL', async () => {
 const storage=storageFixture(),idb=fixture(),vm=require('node:vm'),fs=require('node:fs');let external=0;
 // Hold background flush timers so only the seed under test can acknowledge
 // this WAL; the dedicated automatic-flush test exercises real timers.
 const context=vm.createContext({setTimeout:()=>({unref(){}}),clearTimeout(){}});vm.runInContext(fs.readFileSync(require.resolve('../account-cache.js'),'utf8'),context);const api=context.StudyAccountCache;
 const a=await api.open(options(storage,idb,{onExternal:()=>external++})),b=await api.open(options(storage,idb));
 // Both calls begin before either tab can observe the other one's base.
 await Promise.all([a.seed({words:[],records:{saved:{score:8}}},{ifEmpty:true}),b.seed({words:[],unwanted:'racing defaults'},{ifEmpty:true})]);
 assert.equal(StudyStorage.read({storage:b,key:'study:account:alice'}).data.records.saved.score,8);
 const session=StudyStorage.createSession({storage:a,key:'study:account:alice',writer:'a'});session.read();session.commit({words:[],records:{saved:{score:9}}});
 const beforeBytes=storage.bytes(),beforeExternal=external;
 await b.seed({words:[],records:{},unwanted:'stale defaults'},{ifEmpty:true});
 const result=StudyStorage.read({storage:b,key:'study:account:alice'});assert.equal(result.data.records.saved.score,9);assert.equal(result.data.unwanted,undefined);
 assert.equal(storage.bytes(),beforeBytes);assert.equal(external,beforeExternal);a.close();b.close();
 const reopened=await Cache.open(options(storage,idb));assert.equal(StudyStorage.read({storage:reopened,key:'study:account:alice'}).data.records.saved.score,9);reopened.close();
});
test('ifEmpty initializes a missing or tombstoned base while unflagged seed still replaces', async () => {
 const storage=storageFixture(),idb=fixture(),cache=await Cache.open(options(storage,idb));
 await cache.seed({words:[],value:'first'},{ifEmpty:true});assert.equal(JSON.parse(cache.getItem('study:account:alice')).value,'first');
 cache.removeItem('study:account:alice');await cache.flush();
 await cache.seed({words:[],value:'after tombstone'},{ifEmpty:true});assert.equal(JSON.parse(cache.getItem('study:account:alice')).value,'after tombstone');
 await cache.seed({words:[],value:'explicit replacement'});assert.equal(JSON.parse(cache.getItem('study:account:alice')).value,'explicit replacement');cache.close();
});
