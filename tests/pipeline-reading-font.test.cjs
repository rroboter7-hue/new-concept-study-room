const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={pilot:false,realOutput:true,realPipeline:true,realFont:true};
async function enter(loaded={}){const h=await harness({...options,loaded});await h.api.selectLesson(h.api.current.id);await h.flush();return h;}
function tools(h){const node=h.document.querySelector('[data-pipeline-reading-font]');assert(node,'the active pipeline reading screen exposes its own font controls');return node;}
async function font(h,action){const node=tools(h).querySelector('[data-reading-font="'+action+'"]');assert(node&&!node.disabled);await h.click(node);}

test('active pipeline font controls persist size across stages, course changes and reload',async()=>{
 const h=await enter(),before=JSON.stringify(h.api.data.records),first=tools(h);assert(h.document.querySelector('.pipeline-font-settings'));
 await font(h,'increase');assert.equal(h.stored.settings.readingFontPercent,110);assert.equal(h.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1.1');
 assert.equal(first.querySelector('[data-reading-font="value"]').textContent,'110%');
 await h.api.learningPipeline.goStage(1);assert.equal(h.document.querySelector('[data-pipeline-reading-font]'),null,'font actions belong only to reading');
 await h.api.learningPipeline.goStage(0);assert.equal(tools(h).querySelector('[data-reading-font="value"]').textContent,'110%');
 const next=h.c.LESSONS.find(l=>l.book===2&&l.number===3);assert(next);await h.api.selectLesson(next.id);assert.equal(tools(h).querySelector('[data-reading-font="value"]').textContent,'110%');
 assert.equal(JSON.stringify(h.api.data.records),before,'changing readability must not create practice evidence');
 const reloaded=await enter(h.stored);assert.equal(tools(reloaded).querySelector('[data-reading-font="value"]').textContent,'110%');
 await font(reloaded,'reset');assert.equal(reloaded.stored.settings.readingFontPercent,100);
});

test('pipeline font controls retain readable temporary size and report a failed settings save',async()=>{
 const h=await enter({settings:{readingFontPercent:100}});h.setStorageWritable(false);await font(h,'increase');
 assert.equal(h.api.data.settings.readingFontPercent,100);assert.equal(h.document.documentElement.style.getPropertyValue('--reading-font-scale'),'1.1');
 assert.match(tools(h).querySelector('[data-reading-font="status"]').textContent,/未保存|仅本次/);
 h.setStorageWritable(true);await font(h,'increase');assert.equal(h.stored.settings.readingFontPercent,120);
});
