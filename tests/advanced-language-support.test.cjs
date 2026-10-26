const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),target=path.join(root,'dev/build-advanced-language.cjs');
const builder=fs.existsSync(target)?require(target):{};
function fixture(){
 const source={id:'advanced-source',book:3,number:1,title:'Fixture',textbook:{title:'Fixture',sourceSha256:'a'.repeat(64),sourcePdfPage:16,sourceUrl:'resources/source.pdf'},paragraphs:[{en:'She looked after the cat. It was safe.'}],usage:[{phrase:'old expression',meaning:'原笔记表达',example:'An old note.'}]};
 const entry={lessonId:source.id,book:3,number:1,title:'Fixture',sourceSha256:'a'.repeat(64),paragraphs:[{index:0,rows:[{en:'She looked after the cat.',zh:'她照看了那只猫。',kind:'narration',speaker:'旁白'},{en:'It was safe.',zh:'它平安无事。',kind:'narration',speaker:'旁白'}]}],usage:[{phrase:'look after',matchedForm:'looked after',meaning:'照顾',note:'后接被照顾的人或动物；课文用过去式。',example:'She looked after the cat.',exampleZh:'她照看了那只猫。',sourceParagraphIndex:0,sourceSentenceIndex:0,sourceType:'textbook-passage'}]};
 return {source,entry};
}
function browser(lessons,payload){const w={LESSONS:lessons};w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync(path.join(root,'reading-layout.js'),'utf8'),w);vm.runInContext(builder.browserSource(payload),w);return w;}
test('advanced language builder exists and validates exact source evidence before emitting content',()=>{
 assert.equal(typeof builder.validateEntry,'function');const {source,entry}=fixture();assert.doesNotThrow(()=>builder.validateEntry(entry,source));
 for(const mutate of [x=>x.paragraphs[0].rows[0].en='A different sentence.',x=>x.paragraphs[0].rows[0].zh='',x=>x.usage[0].matchedForm='take care of',x=>x.usage[0].exampleZh='错配译文',x=>x.lessonId='other',x=>x.sourceSha256='b'.repeat(64),x=>x.usage[0].sourceSentenceIndex=2]){
  const altered=structuredClone(entry);mutate(altered);assert.throws(()=>builder.validateEntry(altered,source));
 }
});
test('browser applies aligned Chinese and source-backed usage without changing English or legacy notes',()=>{
 assert.equal(typeof builder.browserSource,'function');const {source,entry}=fixture(),before=source.paragraphs[0].en;
 const w=browser([source],{label:'自编中文译文（非教材官方译文）',lessons:[entry]});
 assert.equal(source.paragraphs[0].en,before);assert.equal(source.paragraphs[0].zh,'她照看了那只猫。它平安无事。');
 assert.equal(source.usage[0].matchedForm,'looked after');assert.equal(source.usage[1].phrase,'old expression');assert.equal(source.usage[0].sourcePage,16);
 assert.equal(source.translation.label,'自编中文译文（非教材官方译文）');assert.equal(w.BOOK34_LANGUAGE_STATUS.applied,1);
 const m=w.StudyReading.model(source);assert.equal(m.hasAligned,true);assert.deepEqual(Array.from(m.rows,r=>r.zh),['她照看了那只猫。','它平安无事。']);
 assert.doesNotMatch(w.StudyReading.render(source,{showTranslation:false}),/她照看|平安无事/);
});
test('runtime rejects changed source, wrong identities and malformed evidence while retaining other lessons',()=>{
 assert.equal(typeof builder.browserSource,'function');
 for(const mutate of [x=>x.paragraphs[0].en='Changed source. It was safe.',x=>x.id='different-id',x=>x.book=4,x=>x.number=2,x=>x.textbook.title='Different title',x=>x.textbook.sourceSha256='b'.repeat(64)]){
  const {source,entry}=fixture();mutate(source);const originalUsage=JSON.stringify(source.usage),w=browser([source],{lessons:[entry]});
  assert.equal(w.BOOK34_LANGUAGE_STATUS.applied,0);assert.equal(w.BOOK34_LANGUAGE_STATUS.rejected.length,1);assert.equal(w.BOOK34_READING_ALIGNMENT.lessons.length,0);assert.equal(JSON.stringify(source.usage),originalUsage);assert.equal(source.translation,undefined);
 }
 const a=fixture(),b=fixture();b.source.id='valid';b.entry.lessonId='valid';a.entry.usage[0].sourceSentenceIndex=9;
 const w=browser([a.source,b.source],{lessons:[a.entry,b.entry]});assert.equal(w.BOOK34_LANGUAGE_STATUS.applied,1);assert.equal(a.source.translation,undefined);assert.ok(b.source.translation);
});
test('unfinished note glosses remain preserved as source data but do not dilute the completed phrase study list',()=>{
 const {source,entry}=fixture();source.usage.push({phrase:'go on',meaning:'原笔记习惯表达（未附独立中文释义）',note:'待整理'});
 browser([source],{lessons:[entry]});assert.ok(Array.isArray(source.sourceNoteUsage),'original note usage is retained');assert.ok(source.sourceNoteUsage.some(p=>p.phrase==='go on'));assert.ok(source.usage.some(p=>p.phrase==='old expression'));assert.ok(!source.usage.some(p=>p.phrase==='go on'));
});
test('builder source identities match the real HTML bootstrap, including audio-created later lessons',()=>{
 const w={URL,URLSearchParams,TextEncoder,TextDecoder,document:{addEventListener(){},querySelector(){return null;}},addEventListener(){},location:{href:'http://localhost/',origin:'http://localhost',search:''}};w.window=w;vm.createContext(w);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)){
  const name=match[1].split('?')[0];if(name==='book34-language-support.js')break;vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),w,{filename:name});
 }
 const actual=w.LESSONS.filter(l=>[3,4].includes(l.book));
 for(const source of builder.loadSources())assert.equal(source.id,actual.find(l=>l.book===source.book&&l.number===source.number)?.id,source.book+':'+source.number);
});
