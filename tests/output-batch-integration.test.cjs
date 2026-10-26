const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
 const calls=[],root={innerHTML:''};let lesson={id:'a',paragraphs:[{en:'I read.'}]};
 const scope={document:{addEventListener(){},querySelector(){return root;}}};scope.window=scope;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','output-practice.js'),'utf8'),scope);
 const batchPractice={render(){calls.push('render');return '<section id="batch-sentence-content">bulk</section>';},flush(){calls.push('flush');},cancel(){calls.push('cancel');}};
 const output=new scope.OutputPractice({getLesson:()=>lesson,batchPractice});
 function mode(value){const target={dataset:{outputAction:'mode',outputMode:value},closest(s){return s==='[data-output-action]'?target:root;}};output.click({target});}
 return {output,calls,mode,setLesson(next){lesson=next;output.setLesson(next);}};
}
test('bulk is available without a canonical vocabulary list and saves before leaving mode',()=>{
 const h=setup();assert.match(h.output.render(),/data-output-mode="batch"/);
 h.mode('batch');assert.match(h.output.render(),/id="batch-sentence-content"/);
 h.calls.length=0;h.mode('write');
 assert.deepEqual(h.calls,['flush','cancel']);
});
test('a lesson switch flushes and cancels the previous bulk job before reset',()=>{
 const h=setup();h.mode('batch');h.calls.length=0;h.setLesson({id:'b',paragraphs:[]});
 assert.deepEqual(h.calls,['flush','cancel']);assert.equal(h.output.mode,'write');
});
