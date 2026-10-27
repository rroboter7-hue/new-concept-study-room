'use strict';
// Small offline build fixtures. Only deployment files are needed; no PDF or work baseline is read.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto'),test=require('node:test'),assert=require('node:assert/strict');
const DIR=process.env.ORDINAL_APP_DIST?path.resolve(process.env.ORDINAL_APP_DIST):path.join(__dirname,'..');
const builder=require(path.join(DIR,'dev/build-lesson-word-targets.cjs')),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(t){
 const parent=path.resolve(__dirname),root=fs.mkdtempSync(path.join(parent,'ordinal-build-fixture-'));
 t.after(()=>{const resolved=path.resolve(root);assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('ordinal-build-fixture-'));fs.rmSync(resolved,{recursive:true,force:true});});
 const lessons=[{id:'dates-fixture',book:1,number:1,title:'Dates',paragraphs:[{en:'April1st and April24th, May 2nd, June 3rd. A 21st-century room24.'}],vocabulary:[]},{id:'saint-fixture',book:3,number:8,title:'The monastery',paragraphs:[{en:'The Great St. Bernard Pass is here. St. Bernard dogs are welcome.'}],textbook:{sourcePdfPage:44},vocabulary:[]}];
 fs.mkdirSync(path.join(root,'dictionary-data'));
 fs.copyFileSync(path.join(DIR,'lexical-word-tokens.js'),path.join(root,'lexical-word-tokens.js'));
 fs.writeFileSync(path.join(root,'data.js'),'window.LESSONS='+JSON.stringify(lessons)+';\n');
 fs.writeFileSync(path.join(root,'app.js'),'throw Error("The compiler must stop before app.js");\n');
 fs.writeFileSync(path.join(root,'index.html'),'<script defer src="lexical-word-tokens.js?v=fixture"></script><script defer src="data.js"></script><script defer src="app.js"></script>');
 const shard=JSON.stringify({entries:{st:{translation:'[计] 状态',headword:'ST'},th:{translation:'[化] 钍',headword:'Th'},century:{translation:'n. 世纪'},room:{translation:'n. 房间'}}}),license='MIT fixture license\n';
 fs.writeFileSync(path.join(root,'dictionary-data/a.json'),shard);fs.writeFileSync(path.join(root,'dictionary-data/LICENSE'),license);
 fs.writeFileSync(path.join(root,'dictionary-data/source.json'),JSON.stringify({name:'offline-test-only',commit:'fixture',shards:[{file:'a.json',sha256:hash(shard)}],license:{name:'MIT',sha256:hash(license)}}));
 return {root,lessons};
}
function output(root){return ['lesson-word-targets.js','lesson-word-targets-source.json'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));}
test('[ordinal builder portable] deterministic offline build preserves full ordinal displays and moves true dotted St to source-bound quarantine',t=>{
 const {root,lessons}=fixture(t),first=builder.buildLessonWordTargets({projectRoot:root}),before=output(root),second=builder.buildLessonWordTargets({projectRoot:root});
 assert.deepEqual(output(root),before);assert.deepEqual(second,first);assert.equal(first.status.excludedOrdinalOccurrences,5);assert.equal(first.status.quarantinedFirstOccurrences,1);assert.equal(first.status.quarantinedOccurrences,2);assert.equal(first.tokenizer.hashEncoding,'utf8-lf');assert.equal(first.tokenizer.sha256,hash(fs.readFileSync(path.join(DIR,'lexical-word-tokens.js'),'utf8').replace(/\r\n?/g,'\n')));
 const c={};c.window=c;vm.createContext(c);vm.runInContext(before[0],c);const active=c.StudyLessonWordTargets.newWordsForLesson(lessons[0],[]).map(r=>r.word);
 assert.deepEqual(Array.from(active),['Dates','April','and','May','June','A','century','room']);
 assert.equal(c.StudyLessonWordTargets.newWordsForLesson(lessons[1],[]).some(r=>r.word==='St'),false);
 const q=c.StudyLessonWordTargets.quarantinedForLesson(lessons[1]);assert.equal(q.length,2);assert.equal(q[0].sourceSentence,'The Great St. Bernard Pass is here.');assert.equal(q[1].sourceSentence,'St. Bernard dogs are welcome.');assert.ok(q.every(r=>r.practiceEligible===false&&r.active===false));
});
test('[ordinal builder portable] missing or changed helper and dictionary input hashes reject before overwriting a valid generated catalog',t=>{
 const {root}=fixture(t);builder.buildLessonWordTargets({projectRoot:root});const before=output(root),helper=path.join(root,'lexical-word-tokens.js'),originalHelper=fs.readFileSync(helper);
 fs.appendFileSync(helper,'\n/* source drift */');assert.throws(()=>builder.buildLessonWordTargets({projectRoot:root}),/tokenizer source mismatch/);assert.deepEqual(output(root),before);
 fs.unlinkSync(helper);assert.throws(()=>builder.buildLessonWordTargets({projectRoot:root}),/ENOENT/);assert.deepEqual(output(root),before);fs.writeFileSync(helper,originalHelper);
 fs.appendFileSync(path.join(root,'dictionary-data/a.json'),' ');assert.throws(()=>builder.buildLessonWordTargets({projectRoot:root}),/dictionary source mismatch/);assert.deepEqual(output(root),before);
});
test('[ordinal builder portable] bootstrap paths stay local and source guards reject malformed and drifted lesson objects',t=>{
 const {root,lessons}=fixture(t);fs.writeFileSync(path.join(root,'index.html'),'<script src="https://example.invalid/data.js"></script><script src="app.js"></script>');assert.throws(()=>builder.collectCorpus(root),/repository-local/);
 const m=builder.createManifest(lessons),c={};c.window=c;vm.createContext(c);vm.runInContext(builder.browserSource(m),c);const A=c.StudyLessonWordTargets,l=lessons[1];
 assert.equal(A.statusForLesson(l).bound,true);assert.equal(A.statusForLesson({...l,paragraphs:[{en:l.paragraphs[0].en+' drift'}]}).bound,false);assert.equal(A.quarantinedForLesson({...l,title:'different title'}).length,0);
 const hole=[];hole.length=1;assert.equal(A.statusForLesson({...l,paragraphs:hole}).bound,false);assert.throws(()=>builder.createManifest([l,{...l}]),/Duplicate reading lesson/);
});
