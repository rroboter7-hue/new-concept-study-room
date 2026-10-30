'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Cache=require('../account-cache.js'),Storage=require('../study-storage.js'),fixture=require('./support/account-indexeddb.cjs');
const key='study:account:bulk';
function disk(){const values=new Map();let reads=0;return {values,get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem(k){reads++;return values.get(k)??null},setItem(k,v){values.set(k,String(v))},removeItem:k=>values.delete(k),get reads(){return reads},reset(){reads=0}};}
test('bulk migration writes field increments durably, preserves recovery/meta and avoids guest quota',async()=>{
 const storage=disk(),indexedDB=fixture(),c=await Cache.open({key,storage,indexedDB});await c.seed({words:[],records:{remote:{score:99}}});
 await c.putSnapshot(key+':pre-import','original recovery');c.setItem(key+':cloud-sync-v1','cloud-meta');await c.flush();storage.setItem('guest','original guest');
 const set=storage.setItem;storage.setItem=()=>{throw Error('QuotaExceededError')};
 assert.equal(typeof c.writeBatch,'function');
 const result=await c.writeBatch(view=>{const s=Storage.createSession({storage:view,key,writer:'migration'}),r=s.read();assert(r.ok);r.data.records.added={score:7};r.data._accountEdits={'["records","added"]':{at:Date.now(),id:'new'}};return s.commit(r.data,{replace:true,source:'cloud'});});
 assert(result.ok);assert.equal(c.getItem(key+':pre-import'),'original recovery');assert.equal(c.getItem(key+':cloud-sync-v1'),'cloud-meta');assert.equal(storage.getItem('guest'),'original guest');
 storage.setItem=set;c.close();const opened=await Cache.open({key,storage,indexedDB});assert.deepEqual(Storage.read({storage:opened,key}).data.records,{remote:{score:99},added:{score:7}});opened.close();
});
test('bulk failure and identity guard leave account and recovery intact',async()=>{
 const storage=disk(),indexedDB=fixture(),c=await Cache.open({key,storage,indexedDB});await c.seed({words:[],records:{remote:1}});await c.putSnapshot(key+':pre-import','snapshot');
 assert.equal(typeof c.writeBatch,'function');indexedDB.failNext=true;
 await assert.rejects(c.writeBatch(view=>{const s=Storage.createSession({storage:view,key});const data=s.read().data;data.records.added=2;return s.commit(data,{replace:true});}),/disk full/);
 assert.deepEqual(Storage.read({storage:c,key}).data.records,{remote:1});assert.equal(c.getItem(key+':pre-import'),'snapshot');
 await assert.rejects(c.writeBatch(()=>{throw Error('must not run')},{guard:()=>false}),/账号|身份|切换/);c.close();
});
test('bulk transaction merges a fresh peer edit and keeps an edit arriving while it commits',async()=>{
 const storage=disk(),indexedDB=fixture(),a=await Cache.open({key,storage,indexedDB});await a.seed({words:[],records:{remote:1}});const b=await Cache.open({key,storage,indexedDB}),sb=Storage.createSession({storage:b,key,writer:'other'});sb.read();
 sb.commit({words:[],records:{remote:8,peer:3}});await b.flush();
 assert.equal(typeof a.writeBatch,'function');
 indexedDB.beforeCommit=()=>{sb.commit({words:[],records:{remote:9,peer:3,later:4}});};
 await a.writeBatch(view=>{const s=Storage.createSession({storage:view,key,writer:'migration'}),data=s.read().data;assert.equal(data.records.remote,8);data.records.added=2;return s.commit(data,{replace:true,source:'cloud'});});
 await b.flush();a.close();b.close();const c=await Cache.open({key,storage,indexedDB});assert.deepEqual(Storage.read({storage:c,key}).data.records,{remote:9,peer:3,later:4,added:2});c.close();
});
test('account reads use one stable cache snapshot without scanning the WAL per field',async()=>{
 const storage=disk(),indexedDB=fixture(),c=await Cache.open({key,storage,indexedDB});await c.seed({words:[]});
 assert.equal(typeof c.writeBatch,'function');await c.writeBatch(view=>{const s=Storage.createSession({storage:view,key}),data=s.read().data;data.records=Object.fromEntries(Array.from({length:400},(_,i)=>['l'+i,{score:i}]));return s.commit(data,{replace:true});});
 storage.reset();const read=Storage.read({storage:c,key});assert(read.ok);assert.equal(Object.keys(read.data.records).length,400);assert(storage.reads<20,'one recovery pass instead of field-count squared');c.close();
});
test('snapshot reader retains localStorage fallback and reports a failed snapshot without partial data',()=>{
 const storage=disk();storage.setItem(key,JSON.stringify({words:[],records:{one:1}}));assert.equal(Storage.read({storage,key}).data.records.one,1);
 const result=Storage.read({storage:{...storage,readEntries(){throw Error('snapshot unavailable')}},key});assert.equal(result.ok,false);assert.match(result.error.message,/snapshot unavailable/);
});
test('snapshot reader takes exactly one immutable field view and never mixes later storage reads',()=>{
 let calls=0;const storage={readEntries(){calls++;return [[key,JSON.stringify({words:[],records:{one:1}})],[key+':field:["records","one"]',JSON.stringify({value:2,stamp:[1,'writer']})]]},getItem(){throw Error('mixed snapshot')},get length(){throw Error('mixed snapshot')},key(){throw Error('mixed snapshot')}};
 const result=Storage.read({storage,key});assert(result.ok);assert.equal(result.data.records.one,2);assert.equal(calls,1);
});
