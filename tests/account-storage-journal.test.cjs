'use strict';const test=require('node:test'),assert=require('node:assert/strict');const S=require('../study-storage.js');
test('local edit stamps share the same durable transaction as records, cloud apply does not become a new local edit',()=>{
 const map=new Map(),storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};let calls=0;
 const session=S.createSession({storage,initial:{records:{}},decoratePatch:patch=>{calls++;return {'["_accountEdits","record"]':{value:{at:100,id:'edit'}}};}});assert(session.commit({records:{l1:{score:20}}}).ok);const loaded=session.read().data;assert.equal(loaded.records.l1.score,20);assert.equal(loaded._accountEdits.record.at,100);const before=calls;assert(session.commit({...loaded,records:{l1:{score:100}}},{source:'cloud'}).ok);assert.equal(calls,before);assert.equal(session.read().data._accountEdits.record.at,100);
});
