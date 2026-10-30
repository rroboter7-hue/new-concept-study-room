'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./support/app-harness.cjs'),fixture=require('./support/account-indexeddb.cjs'),Storage=require('../study-storage.js');
const identity={endpoint:'https://sync.example',user:{id:'u_alice',username:'alice'},token:'t'.repeat(43)};
test('actual app receives large cloud records without a localStorage WAL and preserves its guest and live editor',async()=>{
 const h=await harness({pilot:false,realPipeline:true,loaded:{words:[{word:'guest',meaning:'保留'}]},accounts:{identity,profile:{words:[],records:{existing:{score:99}}}}});
 const before=JSON.stringify(h.stored),editor=h.document.createElement('textarea');editor.value='Unsubmitted learner text';h.document.body.appendChild(editor);h.setStorageWritable(false);
 const changes=Object.fromEntries(['a','b'].map(k=>['["records","'+k+'"]',{value:{notes:'学'.repeat(60000)},modifiedAt:1700000000000,writeId:'cloud-'+k}]));
 try{assert.equal(await h.api.applyAccountRemote(changes),true);assert.equal(h.api.data.records.a.notes.length,60000);assert.equal(h.api.data.records.existing.score,99);assert.equal(JSON.stringify(h.stored),before);assert.equal(editor.value,'Unsubmitted learner text');assert.equal(editor.isConnected,true);}
 finally{h.setStorageWritable(true);h.api.accountStorage.close();}
});
test('actual app bulk failure leaves its last visible and durable account copy available to retry',async()=>{
 const indexedDB=fixture(),h=await harness({pilot:false,realPipeline:true,accounts:{identity,indexedDB,profile:{words:[],records:{existing:{score:99}}}}}),changes={'["records","new"]':{value:{score:7},modifiedAt:1700000000000,writeId:'cloud-new'}};
 try{indexedDB.failNext=true;let result;try{result=await h.api.applyAccountRemote(changes)}catch{result=false}assert.equal(result,false);assert.equal(h.api.data.records.new,undefined);assert.equal(Storage.read({storage:h.api.accountStorage,key:h.api.storageKey}).data.records.new,undefined);assert.equal(await h.api.applyAccountRemote(changes),true);assert.equal(h.api.data.records.new.score,7);}
 finally{h.api.accountStorage.close();}
});
