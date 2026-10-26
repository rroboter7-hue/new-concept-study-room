const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const target=path.join(__dirname,'..','reading-layout.js');
const core=fs.existsSync(target)?require(target):{};
test('sentence boundaries preserve abbreviations, decimals and quote attributions',()=>{
 assert.equal(typeof core.splitEnglish,'function');
 const text='Dr. Smith met R.E. Byrd at 8.25. “What a day!” I thought. “Are you ready?” she asked. “Yes!”';
 assert.deepEqual(core.splitEnglish(text),['Dr. Smith met R.E. Byrd at 8.25.','“What a day!” I thought.','“Are you ready?” she asked.','“Yes!”']);
});
test('every source character except boundary whitespace survives segmentation',()=>{
 assert.equal(typeof core.splitEnglish,'function');
 for(const text of ['He watched the B.B.C. news. It happened in 55 B.C. in Britain.',"‘I'm going to ...’ ‘Stop!’ she cried.",'I found this. note on my car: “Do not park here.”','Mr. and Mrs. Smith waited.']){
  assert.equal(core.splitEnglish(text).join(' ').replace(/\s+/g,' ').trim(),text.replace(/\s+/g,' ').trim());
  assert.ok(core.splitEnglish(text).every(s=>/[A-Za-z]/.test(s)));
 }
});
test('joins inverted and present-tense attribution, without swallowing the following action',()=>{
 assert.deepEqual(core.splitEnglish('“You must give up fishing!” my friends say. “Oh, is it?” said the sheriff with a sneer.'),['“You must give up fishing!” my friends say.','“Oh, is it?” said the sheriff with a sneer.']);
 assert.deepEqual(core.splitEnglish('“Stop!” I continued driving to the park.'),['“Stop!”','I continued driving to the park.']);
 assert.deepEqual(core.splitEnglish('It was broadcast by the B.B.C. If the Houses were rebuilt, he would be happy.'),['It was broadcast by the B.B.C.','If the Houses were rebuilt, he would be happy.']);
 assert.deepEqual(core.splitEnglish('“Your what?” he called. “Good heavens!” exclaimed his wife.'),['“Your what?” he called.','“Good heavens!” exclaimed his wife.']);
});
test('advanced passages keep numbered abbreviations, time and speed units inside their sentences',()=>{
 assert.deepEqual(core.splitEnglish('He flew in No. XI. At 4.15 a.m., Bleriot set off. At 300 m.p.h.—the possibilities seemed endless.'),['He flew in No. XI.','At 4.15 a.m., Bleriot set off.','At 300 m.p.h.—the possibilities seemed endless.']);
 assert.deepEqual(core.splitEnglish('It was built in 500 B.C. Its missing head was found. Another dated to 100 B.C. By correlating the evidence, they agreed.'),['It was built in 500 B.C.','Its missing head was found.','Another dated to 100 B.C.','By correlating the evidence, they agreed.']);
});
const lesson={id:'book2-test',book:2,number:2,paragraphs:[{en:'It was Sunday. “Are you ready?” she asked. “Yes!” I said.',zh:'原来的整段译文。'}]};
const aligned=[{lessonId:'book2-test',book:2,number:2,paragraphs:[{index:0,rows:[
 {en:'It was Sunday.',zh:'那天是星期天。',kind:'narration',speaker:'旁白'},
 {en:'“Are you ready?” she asked.',zh:'“你准备好了吗？”她问。',kind:'speech',speaker:'露西阿姨'},
 {en:'“Yes!” I said.',zh:'“准备好了！”我说。',kind:'speech',speaker:'我'}
]}]}];
test('translation rows use exact source identity and turn boundaries without changing source data',()=>{
 assert.equal(typeof core.model,'function');const before=JSON.stringify(lesson),m=core.model(lesson,aligned);
 assert.deepEqual(m.rows.map(r=>[r.index,r.zh,r.speaker]),[[0,'那天是星期天。','旁白'],[1,'“你准备好了吗？”她问。','露西阿姨'],[2,'“准备好了！”我说。','我']]);
 assert.equal(m.groups.length,3);assert.equal(m.fallbacks.length,0);assert.equal(JSON.stringify(lesson),before);
 const drift=JSON.parse(JSON.stringify(lesson));drift.paragraphs[0].en='It was Monday. “Are you ready?” she asked. “Yes!” I said.';
 const fallback=core.model(drift,aligned);assert.ok(fallback.rows.every(r=>!r.zh));assert.equal(fallback.fallbacks[0].zh,'原来的整段译文。');
 assert.ok(core.model({...lesson,id:'another-import'},aligned).rows.every(r=>!r.zh));
});
test('paired rendering hides only translations, escapes content, and preserves every audio index',()=>{
 assert.equal(typeof core.render,'function');
 const html=core.render(lesson,{alignments:aligned,showTranslation:true});
 assert.equal((html.match(/class="reading-pair"/g)||[]).length,3);
 assert.match(html,/露西阿姨/);assert.match(html,/那天是星期天。/);
 assert.deepEqual([...html.matchAll(/data-sentence="(\d+)"/g)].map(m=>Number(m[1])),[0,1,2]);
 const hidden=core.render(lesson,{alignments:aligned,showTranslation:false});
 assert.doesNotMatch(hidden,/那天是星期天。|reading-translation/);assert.match(hidden,/露西阿姨/);
 const malicious=[{...aligned[0],paragraphs:[{index:0,rows:aligned[0].paragraphs[0].rows.map(r=>({...r,zh:'<img src=x>',speaker:'<script>'}))}]}];
 const escaped=core.render(lesson,{alignments:malicious});assert.doesNotMatch(escaped,/<img|<script>/);assert.match(escaped,/&lt;img/);
});
test('untranslated paragraphs are still separated, with one honest missing-translation note',()=>{
 const bare={id:'third',book:3,number:1,paragraphs:[{en:'First sentence. Second sentence. Third sentence. Fourth sentence.'},{en:'A new paragraph.'}]};
 const m=core.model(bare,[]);assert.equal(m.rows.length,5);assert.equal(m.groups.length,3);
 const html=core.render(bare,{alignments:[]});assert.equal((html.match(/暂无译文/g)||[]).length,1);
 assert.equal((html.match(/data-sentence="/g)||[]).length,5);
});

test("printed source speaker labels survive unaligned Book1 reading",()=>{const lesson={id:"b1",book:1,number:5,paragraphs:[{speaker:"MR. BLAKE",en:"Good morning.",zh:""}]};const result=core.model(lesson,[]);assert.equal(result.groups[0].speaker,"MR. BLAKE");assert.equal(result.groups[0].kind,"speech");});
