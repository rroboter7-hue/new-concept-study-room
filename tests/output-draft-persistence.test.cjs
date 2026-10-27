'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function setup(initial={}){
 const lessons=[{id:'book4-l1',title:'Finding fossils',paragraphs:[{en:'We can read the rocks and find ancient fossils.'},{en:'The river carries stones down to the sea.'}],vocabulary:[{word:'fossils',meaning:'化石'}]},{id:'book4-l2',title:'A new lesson',paragraphs:[{en:'We learn another story today.'}],vocabulary:[{word:'story'}]}];
 let current=lessons[0],stored=JSON.parse(JSON.stringify(initial)),writable=true;
 const records=[],evidence=[],root={innerHTML:'',querySelector(){return null;}},document={addEventListener(){},removeEventListener(){},querySelector:s=>s==='#output-content'?root:null};
 const scope={document};scope.window=scope;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','output-practice.js'),'utf8'),scope);
 function create(){const ui=new scope.OutputPractice({getLesson:()=>current,getState:()=>stored,saveState:state=>{if(!writable)return false;stored=JSON.parse(JSON.stringify(state));return true;},saveRecord:record=>{records.push(record);return true;},onEvidence:item=>{evidence.push(item);return true;}});ui.render();return ui;}
 let ui=create();
 function action(name,extra={}){const node={dataset:{outputAction:name,...extra},closest:s=>s==='[data-output-action]'?node:s==='#output-content'?root:null};ui.click({target:node});}
 return {get ui(){return ui;},sanitize:scope.OutputPractice.sanitizeDrafts,records,evidence,get stored(){return stored;},action,mode:mode=>action('mode',{outputMode:mode}),input(value){ui.input({target:{value,dataset:{outputInput:'answer'},closest:()=>root}});},spell(value){ui.input({target:{value,dataset:{outputSpell:'0'},closest:()=>root}});},paragraph(index){ui.change({target:{value:String(index),dataset:{outputParagraph:'true'},closest:()=>root}});},lesson(index){current=lessons[index];ui.setLesson(current);ui.render();},reload(){ui=create();},writable(value){writable=value;}};
}

test('retell typing survives lesson navigation and reload without creating scored output',()=>{
 const h=setup(),answer='We read ancient rocks and found twelve fossils along the river today.';
 h.mode('retell');h.input(answer);h.lesson(1);h.mode('retell');h.input('Another lesson has its own unfinished story.');h.lesson(0);
 assert.equal(h.ui.mode,'retell');assert.equal(h.ui.answer,answer);h.reload();assert.equal(h.ui.mode,'retell');assert.equal(h.ui.answer,answer);
 assert.match(h.ui.render(),/草稿已保存/);assert.equal(h.records.length,0);assert.equal(h.evidence.length,0);
});

test('dictation keeps each paragraph answer separate from retell and spelling',()=>{
 const h=setup();h.input('My unfinished first paragraph.');h.paragraph(1);h.input('My second paragraph waits here.');h.mode('retell');h.input('My own summary of these ancient fossils.');h.mode('spell');h.spell('foss');h.mode('write');
 assert.equal(h.ui.paragraphIndex,1);assert.equal(h.ui.answer,'My second paragraph waits here.');h.paragraph(0);assert.equal(h.ui.answer,'My unfinished first paragraph.');h.reload();assert.equal(h.ui.answer,'My unfinished first paragraph.');h.mode('retell');assert.equal(h.ui.answer,'My own summary of these ancient fossils.');h.mode('spell');assert.equal(h.ui.spellAnswers[0],'foss');
});

test('seen-reference task drafts preserve their round and assistance after navigation and reload',()=>{
 const h=setup();h.ui.startTask({lessonId:'book4-l1',mode:'retell',roundKey:'today-retell'});h.action('original');h.action('original');h.input('We read the rocks and found many ancient fossils.');h.lesson(1);h.lesson(0);h.reload();
 assert.equal(h.ui.roundKey,'today-retell');assert.equal(h.ui.assisted,true);h.ui.startTask({lessonId:'book4-l1',mode:'retell',roundKey:'today-retell'});assert.equal(h.ui.answer,'We read the rocks and found many ancient fossils.');h.ui.submit();assert.equal(h.evidence[0].assisted,true);assert.equal(h.evidence[0].roundKey,'today-retell');
});

test('switching output modes after seeing a reference cannot create independent evidence after reload',()=>{
 const h=setup();h.ui.startTask({lessonId:'book4-l1',mode:'retell',roundKey:'seen-round'});h.action('original');h.action('original');h.mode('write');h.input('We can read the rocks and find ancient fossils.');h.reload();assert.equal(h.ui.assisted,true);assert.equal(h.ui.roundKey,'seen-round');h.ui.submit();assert.equal(h.evidence[0].assisted,true);assert.equal(h.evidence[0].roundKey,'seen-round');
});

test('a new task round clears only its selected mode while retry keeps exposure history',()=>{
 const h=setup();h.input('Keep my ordinary dictation.');h.mode('retell');h.ui.startTask({lessonId:'book4-l1',mode:'retell',roundKey:'round-one'});h.action('original');h.input('We find ancient fossils along the river.');h.ui.submit();h.action('retry');assert.equal(h.ui.answer,'');assert.equal(h.ui.assisted,true);h.input('A second assisted answer about ancient fossils.');
 h.ui.startTask({lessonId:'book4-l1',mode:'retell',roundKey:'round-two'});assert.equal(h.ui.answer,'');assert.equal(h.ui.assisted,false);h.mode('write');assert.equal(h.ui.answer,'Keep my ordinary dictation.');assert.equal(h.ui.assisted,true,'starting a new retell round does not erase reference exposure on the existing dictation draft');
});

test('failed draft writes stay in memory through navigation and offer an honest retry',()=>{
 const h=setup();h.mode('retell');h.writable(false);h.input('Keep this answer when the device store is full.');
 assert.match(h.ui.render(),/草稿未保存/);assert.doesNotMatch(h.ui.render(),/草稿已保存/);h.lesson(1);h.lesson(0);assert.equal(h.ui.answer,'Keep this answer when the device store is full.');h.writable(true);h.action('draft-save');assert.match(h.ui.render(),/草稿已保存/);h.reload();assert.equal(h.ui.answer,'Keep this answer when the device store is full.');
});

test('backup snapshots include unsaved input without falsely declaring a successful device write',()=>{
 const h=setup();h.mode('retell');h.writable(false);h.input('My answer must be available to an emergency backup.');assert.equal(typeof h.ui.snapshot,'function');
 const backup=h.ui.snapshot();assert.equal(backup.lessons['book4-l1'].modes.retell.answer,'My answer must be available to an emergency backup.');assert.match(h.ui.render(),/草稿未保存/);backup.lessons['book4-l1'].modes.retell.answer='changed backup';assert.equal(h.ui.answer,'My answer must be available to an emergency backup.');
});

test('import sanitization rejects unsafe keys, unknown modes and excessive draft payloads',()=>{
 const h=setup();assert.equal(typeof h.sanitize,'function');
 const raw=JSON.parse('{"lessons":{"__proto__":{"mode":"retell"},"constructor":{},"book4-l1":{"mode":"retell","modes":{"retell":{"answer":"safe draft","assisted":true,"roundKey":"today"},"evil":{"answer":"ignore"},"write":{"paragraphIndex":-5,"answers":{"__proto__":"bad","0":"keep"}},"spell":{"spellAnswers":{"constructor":"bad","0":"fossils"}}}}}}');
 raw.lessons['book4-l2']={mode:'retell',modes:{retell:{answer:'x'.repeat(60000)}}};
 const clean=h.sanitize(raw);assert.equal(Object.hasOwn(clean.lessons,'__proto__'),false);assert.equal(Object.hasOwn(clean.lessons,'constructor'),false);assert.equal(clean.lessons['book4-l1'].modes.evil,undefined);assert.equal(clean.lessons['book4-l1'].modes.retell.answer,'safe draft');assert.equal(clean.lessons['book4-l1'].modes.retell.assisted,true);assert.equal(clean.lessons['book4-l1'].modes.write.answers[0],'keep');assert.equal(clean.lessons['book4-l1'].modes.write.paragraphIndex,0);assert.equal(clean.lessons['book4-l2'].modes.retell.answer.length,30000);
 const many={lessons:{}};for(let i=0;i<1000;i++)many.lessons['lesson-'+i]={mode:'retell',modes:{retell:{answer:'x'.repeat(30000)}}};const bounded=h.sanitize(many);assert(JSON.stringify(bounded).length<2100000);assert.equal({}.polluted,undefined);
});
