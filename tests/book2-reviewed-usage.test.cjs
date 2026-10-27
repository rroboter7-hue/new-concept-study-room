'use strict';
// Independent portable contracts; reads deployed scripts only, with no audit
// fixture, generator, private PDF, report or test-harness dependency.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const DIST=process.env.USAGE_APP_DIST?path.resolve(process.env.USAGE_APP_DIST):fs.existsSync(path.join(__dirname,'..','index.html'))?path.resolve(__dirname,'..'):path.join(__dirname,'new-concept/dist');
const FIX='book2-reviewed-usage.js',plain=x=>JSON.parse(JSON.stringify(x));
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fix=fs.readFileSync(path.join(DIST,FIX),'utf8');
function apply(c){vm.runInContext(fix,c,{filename:FIX});}
function load({reviewed=true,stopBeforeUsage=false,mutate}={}){
 const files=Array.from(fs.readFileSync(path.join(DIST,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),m=>m[1].split(/[?#]/)[0]);
 const wired=files.includes(FIX);if(process.env.USAGE_EXPECT_WIRED==='1')assert(wired,'reviewed usage is wired in actual index');
 const c={document:{addEventListener(){}},setTimeout(){},clearTimeout(){}};c.window=c;vm.createContext(c);let inserted=false;
 for(const f of files){if(f==='app.js')break;
  if(f===FIX||!wired&&!inserted&&f==='book2-practice-packs.js'){inserted=true;if(mutate)mutate(c);if(stopBeforeUsage)return c;if(reviewed)apply(c);if(f===FIX)continue;}
  vm.runInContext(fs.readFileSync(path.join(DIST,f),'utf8'),c,{filename:f});
 }
 assert(inserted,'known insertion point exists');return c;
}
const l=(c,n)=>c.LESSONS.find(x=>x.book===2&&x.number===n),phrase=(c,n,p)=>l(c,n).usage.find(x=>x.phrase===p);
const before=load({reviewed:false}),after=load();
const invalid=[[3,'Do you have to make this decision'],[6,'have done'],[8,'Do you enter for the garden competition'],[10,'for a long time. Has it belonged to'],[17,'At least, they will be giving five'],[19,'at once immediately']];
function practice(c,lesson){return new c.PhrasePractice({getLesson:()=>lesson,escapeHTML:E,wordHTML:E});}
test('independent: every original usage object is recoverable and all102 legal first20 notes items remain separate from the six archived fragments',()=>{
 assert.equal(after.BOOK2_REVIEWED_USAGE_STATUS.appliedLessons,96);
 const first20=after.LESSONS.filter(l=>l.book===2&&l.number<=20);assert.equal(first20.reduce((n,l)=>n+l.usageSourceAudit.originalUsage.length,0),182);assert.equal(first20.reduce((n,l)=>n+l.usage.length,0),177);assert.equal(first20.flatMap(l=>l.usage).filter(p=>p.sourceType==='lesson-notes').length,102);
 for(const a of after.LESSONS.filter(x=>x.book===2)){
  const b=l(before,a.number);assert.deepEqual(plain(a.usageSourceAudit.originalUsage),plain(b.usage),a.id+' complete original object history');
  for(let i=0;i<b.usage.length;i++){const old=b.usage[i],bad=invalid.some(([n,p])=>n===a.number&&p===old.phrase),id='b2-l'+String(a.number).padStart(3,'0')+'-usage-'+(i+1),current=a.usage.find(p=>p.usageSourceId===id);
   if(bad){assert(!current);assert(a.usageSourceAudit.archivedEntries.some(e=>e.id===id&&e.active===false&&e.countsTowardPractice===false));continue;}
   assert(current,id);for(const key of ['phrase','matchedForm','meaning','note','example','exercises'])assert.deepEqual(plain(current[key]??null),plain(old[key]??null),id+' '+key);
   if(a.number>20){for(const key of Object.keys(old))assert.deepEqual(plain(current[key]),plain(old[key]),id+' original later-lesson field '+key);assert.equal(current.usageReview.status,'not-individually-reviewed');}
  }
 }
});
test('independent: six repairs retain full L3/L10 questions, L17 parking and L13 clue, and L6 grammar is visible outside phrase scoring',()=>{
 for(const [n,p] of invalid)assert(!phrase(after,n,p));
 const decision=phrase(after,3,'make a decision');assert.equal(decision.example,'Did you make a decision?');const edited=decision.additionalExamples.find(p=>p.rawExample==='Do you have to make this decision everyday?');assert.equal(edited.example,'Do you have to make this decision every day?');assert.equal(edited.exampleSourceType,'edited-lesson-notes');
 const belong=phrase(after,10,'belong to');assert.equal(belong.example,'How long has it belonged to your family?');assert(belong.additionalExamples.some(p=>p.example==='Has it belonged to your family for a long time?'&&p.exampleSourceType==='lesson-notes'));
 const time=phrase(after,10,'for a long time');assert.equal(time.example,'It has belonged to our family for a long time.');assert.equal(time.exampleSourceType,'lesson-passage');
 const at=phrase(after,17,'at least');assert.equal(at.example,'At least, let me park my car here.');assert.equal(at.exampleSourceType,'lesson-notes');assert.equal(at.exampleSourcePage,84);const performance=at.additionalExamples.find(p=>p.example==='At least, they will be giving five performances.');assert.deepEqual(plain(performance.relatedPriorLessons),[13]);
 const positive=[[6,'make a decision'],[8,'have breakfast'],[8,'be full of'],[17,'have a difficult time'],[19,'in a hurry']];for(const [n,p] of positive){assert.equal(phrase(after,n,p).sourceType,'lesson-notes',p);}
 const pp=practice(after,l(after,6)),html=pp.render();assert.match(html,/本课笔记 · 语法复习/);assert.match(html,/have\/has \+ 过去分词/);assert.match(html,/He has just moved to Hainan/);assert(!pp.items().some(p=>/have done|have\/has/.test(p.phrase)));
});
test('independent: a changed textbook source URL or conflicting declared body hash never acquires reviewed provenance',()=>{
 const cases=[x=>x.textbook.sourceUrl='resources/wrong.pdf',x=>x.textbook.bodySha256='0'.repeat(64)];
 for(const mutate of cases){const c=load({reviewed:false,stopBeforeUsage:true}),target=l(c,17);mutate(target);const previous=plain(target.usage);apply(c);assert.deepEqual(plain(target.usage),previous,'source drift keeps usage unchanged');assert.equal(target.usageSourceAudit,undefined,'unverified source must not gain an audit record');assert.match(c.BOOK2_REVIEWED_USAGE_STATUS.rows.find(r=>r.number===17).status,/^skipped-/);assert.equal(c.BOOK2_REVIEWED_USAGE_STATUS.rows.find(r=>r.number===16).status,'applied');}
});
test('independent: withdrawing approval preserves a user edit to the valid L10 replacement instead of deleting the new expression',()=>{
 const c=load({stopBeforeUsage:true});apply(c);const item=phrase(c,10,'for a long time');assert(item);item.meaning='用户已校正的自定义释义';apply(c);const preserved=phrase(c,10,'for a long time');assert(preserved,'valid replacement with a user edit must remain');assert.equal(preserved.meaning,'用户已校正的自定义释义');assert.equal(preserved.usageReview,undefined);assert.equal(l(c,10).usageSourceAudit.approvalRevoked,true);for(const [n,p] of invalid)assert(!phrase(c,n,p));
});
test('independent: raw everyday examples in scored/referenced modes always disclose their explicit correction',()=>{
 const pp=practice(after,l(after,2));pp.setLesson(l(after,2));const index=pp.items().findIndex(p=>p.phrase==='get up');assert(index>=0);
 for(const mode of ['fill','match','order','write']){pp.mode=mode;pp.submitted=true;pp.answers={phraseIndex:index};const html=pp.render();assert.match(html,/everyday|every day/,mode+' contains the relevant source example');assert.match(html,/校订|校正/,mode+' must disclose that the raw source spelling is editorially corrected');}
});
test('independent: actual phrase renderer escapes source, raw and edited examples, supplemental examples and grammar metadata',()=>{
 const payload='<img src=x onerror="attack()"><svg onload="attack()">',meta={example:'A safe complete example '+payload,rawExample:'Original sentence '+payload,exampleSourceType:'edited-lesson-notes',exampleSourceLabel:'校订来源 '+payload,editorialCorrection:{from:payload,to:payload}};
 const item={phrase:'at least',matchedForm:'at least',meaning:'至少 '+payload,note:payload,sourceType:'lesson-passage',sourceLabel:'正文 '+payload,exampleSourceType:'lesson-notes',exampleSourceLabel:'笔记 '+payload,example:'At least, I tried '+payload+'.',editorialExample:meta,additionalExamples:[meta],synonymNote:payload};
 const lesson={id:'escape-probe',usage:[item,{phrase:'in the end',meaning:'最后',example:'In the end I went home.'}],notesUsageGrammarReview:[{title:payload,note:payload,...meta}]},pp=practice(after,lesson);pp.setLesson(lesson);
 for(const mode of ['learn','fill','match','order','write']){pp.mode=mode;pp.submitted=true;pp.answers={};const html=pp.render();assert.doesNotMatch(html,/<img\b|<svg\b|onerror="attack\(\)"|onload="attack\(\)"/i,mode);assert(html.includes('&lt;img'),mode+' payload remains literal visible text');}
});
test('independent: all276 bodies, translations, vocabulary and grammar, twenty packs and all877 expansion bindings survive this usage-only batch',()=>{
 assert.equal(before.LESSONS.length,276);assert.equal(after.LESSONS.length,276);
 for(const a of after.LESSONS){const b=before.LESSONS.find(l=>l.id===a.id);for(const key of ['paragraphs','textbook','translation','vocabulary','grammar','quiz','lines','title'])assert.deepEqual(plain(a[key]??null),plain(b[key]??null),a.id+' '+key);if(a.book!==2)assert.deepEqual(plain(a),plain(b));}
 assert.equal(after.StudyPracticePacks.registry.lessonIds().length,20);for(const id of before.StudyPracticePacks.registry.lessonIds())assert.deepEqual(plain(after.StudyPracticePacks.registry.get(id)),plain(before.StudyPracticePacks.registry.get(id)),id);
 assert.equal(after.StudyKnowledge.bank.audit.expansionQuestions.length,877);assert.deepEqual(plain(after.StudyKnowledge.bank.audit.expansionQuestions),plain(before.StudyKnowledge.bank.audit.expansionQuestions));assert.deepEqual(plain(after.StudyKnowledge.bank.audit.expansionIssues),[]);assert.deepEqual(plain(after.STUDY_WORD_AUDIO),plain(before.STUDY_WORD_AUDIO));
});
module.exports={DIST,FIX,load,apply,l,phrase,practice,plain,E,before,after};
