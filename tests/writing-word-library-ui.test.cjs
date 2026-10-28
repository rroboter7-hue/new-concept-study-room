'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const UI=require('../writing-word-library-ui.js'),library=require('../writing-word-library.js');
const {harness}=require('./support/app-harness.cjs');
const lesson={id:'current',book:2,number:3},target={key:'word:current:outside',label:'outside'};
const items=[['walk','走','verb',1],['happy','高兴的','adjective',1],['look after','照顾','phrase',2],['quietly','安静地','adverb',2],['garden','花园','noun',1]].map(([label,meaning,category,book],i)=>({key:'reference:'+i,label,meaning,category,source:{id:'previous-'+i,book,number:1},sources:[{id:'previous-'+i,book,number:1}],example:'This is an existing source example.'}));
async function setup(options={}){
 const h=await harness({pilot:false}),host=h.document.createElement('div');h.document.body.appendChild(host);let reads=0,saved;
 const ui=new UI({library,getEntries:()=>{reads++;return items;},getLessons:()=>[{id:'b1',book:1,number:1},{id:'future',book:2,number:9}],saveState:async(_,state)=>{saved=state;return true;},...options});
 ui.mount(host,{lesson,target});return {h,host,ui,get reads(){return reads;},get saved(){return saved;}};
}
test('word library is lazy, recommends mixed categories and stores references without editing sentence drafts',async()=>{
 const f=await setup(),before=JSON.stringify(f.h.api.data.freeWriting);assert.equal(f.reads,0);
 const disclosure=f.host.querySelector('[data-library-disclosure]');disclosure.open=true;await f.h.document.dispatch('toggle',disclosure);
 assert.equal(f.reads,1);const cards=f.host.querySelectorAll('[data-library-key]');assert(cards.length>=3);
 await f.h.document.click(cards[0]);assert.equal(f.saved.selectedByTarget[target.key].length,1);
 assert.equal(JSON.stringify(f.h.api.data.freeWriting),before);
 assert.match(f.host.querySelector('[data-library-selected]').innerHTML,/这组可融合/);
});
test('book and part-of-speech filters combine and queries preserve the active search element',async()=>{
 const f=await setup({getState:()=>({open:true})});
 const book=f.host.querySelector('[data-library-book]');book.value='1';await f.h.document.dispatch('change',book);
 const category=f.host.querySelector('[data-library-category]');category.value='adjective';await f.h.document.dispatch('change',category);
 assert.match(f.host.querySelector('[data-library-results]').innerHTML,/happy/);assert.doesNotMatch(f.host.querySelector('[data-library-results]').innerHTML,/look after/);
 const query=f.host.querySelector('[data-library-query]');query.focus();await f.h.document.input(query,'高兴');
 assert.equal(f.host.querySelector('[data-library-query]'),query);assert.equal(f.h.document.activeElement,query);
 assert.equal(f.saved.query,'高兴');
});
test('selected references survive remount and are independent for each writing target',async()=>{
 const f=await setup({getState:()=>({open:true})});await f.h.document.click(f.host.querySelector('[data-library-key]'));
 const chosen=f.saved.selectedByTarget[target.key][0];f.ui.mount(f.host,{lesson,target:{key:'word:current:ring',label:'ring'}});
 assert(!f.host.querySelector('[data-library-selected]').innerHTML.includes('这组可融合'));
 f.ui.mount(f.host,{lesson,target});assert(f.ui.selected().some(row=>row.key===chosen));
});
test('failed preference saving preserves references and reports a local failure',async()=>{
 const f=await setup({getState:()=>({open:true}),saveState:async()=>false});await f.h.document.click(f.host.querySelector('[data-library-key]'));
 assert.equal(f.ui.selected().length,1);assert.match(f.host.querySelector('[data-library-error]').textContent,/暂未保存/);
});
test('range controls exclude future courses and do not claim mastery',async()=>{
 const f=await setup({getState:()=>({open:true})});const html=f.host.querySelector('[data-library-body]').innerHTML;
 assert.match(html,/不会标记完成或掌握/);assert(!html.includes('value="9"'));
});
test('manual selection lists the full classified library and recommendations can be restored',async()=>{
 const more=Array.from({length:13},(_,i)=>({...items[i%items.length],key:'manual:'+i,label:'entry'+i}));
 const f=await setup({getState:()=>({open:true}),getEntries:()=>more});
 const manual=f.host.querySelector('[data-library-action="manual"]');assert(manual,'manual picker is explicit beside the recommendation controls');
 await f.h.document.click(manual);assert.equal(f.saved.manual,true);
 assert(f.host.querySelector('.writing-library-browse').hasAttribute('open'));
 assert.equal(f.host.querySelectorAll('.writing-library-card').length,8);assert(f.host.querySelector('[data-library-action="next"]'));
 await f.h.document.click(f.host.querySelector('[data-library-action="rotate"]'));
 assert.equal(f.saved.manual,false);assert.equal(f.host.querySelectorAll('.writing-library-card').length,6);
});
