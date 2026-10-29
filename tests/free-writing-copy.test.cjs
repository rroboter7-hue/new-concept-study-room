'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const FreeWritingPractice=require('../free-writing-practice.js');
const {harness}=require('./support/app-harness.cjs');
const lesson={id:'b2-l1',book:2,number:1,title:'A private conversation'};
function setup(options={}){
 const copied=[];
 const ui=new FreeWritingPractice({getLesson:()=>lesson,getDrafts:()=>({}),saveDraft:()=>true,
  getTargets:()=>({words:[{word:'private',meaning:'私人的'}],phrases:[{phrase:'pay attention',meaning:'注意'}]}),
  copyText:async value=>{copied.push(value);},...options});
 return {ui,copied,key:ui.targets()[0].key};
}

test('copies all five current sentences with review instructions, without changing drafts or feedback',async()=>{
 const {ui,copied,key}=setup();
 const answers=['This is a private room.','We had a private conversation.','Is the garden private?','Please keep this private.','They need a private office.'];
 answers.forEach((answer,index)=>ui.editAnswer(key,index,answer));
 const before=structuredClone(ui.active.draft);
 assert.match(ui.render(),/data-free-action="copy-review"[^>]*>一键复制五句话/);
 assert.equal(await ui.copyForReview(),true);
 assert.equal(copied.length,1);
 answers.forEach((answer,index)=>assert(copied[0].includes((index+1)+'. '+answer)));
 assert.match(copied[0],/第 2 册.*第 1 课/);
 assert.match(copied[0],/目标表达：private（私人的）/);
 assert.match(copied[0],/语法.*时态.*主谓一致.*拼写.*搭配.*自然度/);
 assert.match(copied[0],/原因/);assert.match(copied[0],/原意/);
 assert.deepEqual(ui.active.draft,before);
 assert.match(ui.render(),/已复制.*检查要求/);
});

test('partial groups keep original row numbers and unfilled markers, while empty groups never write the clipboard',async()=>{
 const {ui,copied,key}=setup();
 assert.equal(await ui.copyForReview(),false);assert.equal(copied.length,0);
 assert.match(ui.render(),/先写一句/);
 ui.editAnswer(key,4,'I need a private room.');
 assert.equal(await ui.copyForReview(),true);
 assert.match(copied[0],/1\. 【未填写，请勿代写】/);
 assert.match(copied[0],/5\. I need a private room\./);
 assert.doesNotMatch(copied[0],/undefined|\[object Object\]/);
});

test('clipboard denial reveals escaped manual copy text without replacing the sentence editors and clears stale text after edits',async()=>{
 const {ui,key}=setup({copyText:async()=>{throw Error('denied');}});
 const slot={innerHTML:''},handlers={};let replacements=0;
 const container={set innerHTML(value){replacements++;},addEventListener:(name,fn)=>{handlers[name]=fn;},removeEventListener(){},contains:()=>true,querySelector:s=>s==='[data-free-copy-feedback]'?slot:null};
 ui.mount(container);ui.editAnswer(key,0,'A private <room>.');
 assert.equal(await ui.copyForReview(),false);
 assert.equal(replacements,1,'copy feedback must not replace the focused editors');
 assert.match(slot.innerHTML,/readonly/);assert.match(slot.innerHTML,/data-free-copy-text/);
 assert.match(slot.innerHTML,/A private &lt;room&gt;\./);assert.doesNotMatch(slot.innerHTML,/<room>/);
 assert.match(slot.innerHTML,/全选文本/);
 ui.editAnswer(key,0,'A new private room.');
 assert.equal(slot.innerHTML,'','outdated manual copy must disappear after edits');
 ui.unmount();
});

test('a late clipboard failure cannot attach old copy text to another target',async()=>{
 let reject;
 const {ui,key}=setup({copyText:()=>new Promise((resolve,no)=>{reject=no;})});
 ui.editAnswer(key,0,'Keep this private.');
 const copying=ui.copyForReview();
 ui.selectTarget(ui.targets().find(target=>target.kind==='phrase').key);
 reject(Error('denied'));assert.equal(await copying,false);
 assert.doesNotMatch(ui.render(),/data-free-copy-text|Keep this private\./);
});

test('old-word groups copy their actual row count',async()=>{
 const source={id:'b1-l1',book:1,number:1};
 const {ui,copied,key}=setup({getTargets:()=>({priorWords:[{word:'walk',source,requiredCount:2}]})});
 ui.editAnswer(key,0,'I walk home.');ui.editAnswer(key,1,'We walk together.');
 assert.match(ui.render(),/data-free-action="copy-review"[^>]*>一键复制本组/);
 assert.equal(await ui.copyForReview(),true);
 assert.match(copied[0],/2\. We walk together\./);assert.doesNotMatch(copied[0],/3\./);
});

test('historical extra sentences remain numbered in copied content without adding empty extra rows',async()=>{
 const key='word:b2-l1:private';
 const {ui,copied}=setup({getDrafts:()=>({'free-writing:v1:b2-l1':{version:1,lessonId:'b2-l1',activeTargetKey:key,targets:{[key]:{answers:['First private room.','','','','','An extra private room.','']}}}})});
 assert.equal(await ui.copyForReview(),true);
 assert.match(copied[0],/6\. An extra private room\./);assert.doesNotMatch(copied[0],/7\./);
});

test('the real app copy button uses the pipeline clipboard bridge and preserves the five live inputs',async()=>{
 const h=await harness({realPipeline:true,pilot:false,realOutput:true});
 const copied=[];h.c.navigator.clipboard={writeText:async text=>{copied.push(text);}};
 const pipeline=h.api.learningPipeline;await h.api.selectLesson(h.api.current.id);await h.flush();await pipeline.goStage(2);await h.flush();
 const answers=['I read in private.','This is a private room.','I need some private time.','Keep the conversation private.','It is a private garden.'];
 for(let index=0;index<5;index++)await h.input('[data-free-answer="'+index+'"]',answers[index]);
 const field=h.document.querySelector('[data-free-answer="0"]');
 await h.click('[data-free-action="copy-review"]');
 assert.equal(copied.length,1);
 assert.match(copied[0],/1\. I read in private\./);assert.match(copied[0],/5\. It is a private garden\./);
 assert.match(copied[0],/检查要求/);
 assert.equal(h.document.querySelector('[data-free-answer="0"]'),field);
 assert.equal(field.value,answers[0]);assert.equal(pipeline.record().stage,2);
});
