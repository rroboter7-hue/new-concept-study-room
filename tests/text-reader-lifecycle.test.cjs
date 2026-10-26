const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('leaving a document output tab flushes pending writing before removing its editor',()=>{
 const handlers={},events=[];
 const scope={document:{addEventListener(type,fn){handlers[type]=fn;}},window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','text-reader.js'),'utf8'),scope);
 const reader=new scope.window.TextStudyLibrary({beforeChange(){events.push('flush');},onBack(){events.push('back');}});
 reader.render=()=>events.push('render');reader.doc={id:'test'};
 const target={dataset:{textAction:'tab',textTab:'text'},closest(){return target;}};
 handlers.click({target});assert.deepEqual(events,['flush','render']);
 events.length=0;target.dataset.textAction='back';handlers.click({target});
 assert.deepEqual(events,['flush','back']);
});
