'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const target=path.join(__dirname,'../dev/runtime-bundles.cjs');
const runtime=fs.existsSync(target)?require(target):{};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sri=bytes=>'sha384-'+crypto.createHash('sha384').update(bytes).digest('base64');

function fixture(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-runtime-bundles-'));
 t.after(()=>{const resolved=path.resolve(temp),boundary=path.resolve(os.tmpdir())+path.sep;assert(resolved.startsWith(boundary));fs.rmSync(resolved,{recursive:true,force:true});});
 const out=path.join(temp,'output');fs.mkdirSync(out);
 const write=(name,text)=>{const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 write('index.html','<!doctype html><html><head><meta name="study-build" content="fixture-v1"><title>Study fixture</title><link rel="stylesheet" href="first.css?build=one"><script defer src="first.js?build=one"></script><script defer src="second.js?build=one"></script><link rel="stylesheet" href="second.css?build=one"><script defer src="app.js?build=one"></script></head><body><main id="study">Study</main></body></html>');
 write('first.js','"use strict";\nwindow.order=["first"]; const sharedLexical=41;\n');
 write('second.js','// Leading comment and non-strict script are intentional.\nwindow.order.push("second"); window.answer=sharedLexical+1; accidentalGlobal=7;\n');
 write('app.js','window.order.push("app");window.booted=true;\n');
 write('first.css','@charset "UTF-8";\nbody {color:black;background:url("resources/book.pdf#mask")}\n');
 write('second.css','\ufeff@charset "UTF-8";\nmain {color:teal}\n');
 write('resources/book.pdf','fixture CSS-relative asset');
 return {temp,out,write};
}

function loadedEntries(out,manifest){
 const entries=[];
 const c={StudyStartup:{install:(id,next)=>{assert.equal(id,hash(JSON.stringify(next)));entries.push(...next);}}};c.window=c;
 for(const item of manifest.scripts)vm.runInNewContext(fs.readFileSync(path.join(out,item.src),'utf8'),c,{filename:item.src});
 return entries;
}

test('published packages retain exact ordered classic scripts and independent strict/global lexical semantics',t=>{
 const f=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');
 const manifest=runtime.bundleRuntime({outputRoot:f.out});
 assert.equal(manifest.version,1);assert.equal(manifest.build,'fixture-v1');assert(manifest.scripts.length<=6);assert.equal(manifest.styles.length,1);
 const entries=loadedEntries(f.out,manifest);assert.deepEqual(Array.from(entries,item=>item.name),['first.js','second.js','app.js']);
 const context={};context.window=context;vm.createContext(context);
 for(const entry of entries){assert.equal(entry.source,fs.readFileSync(path.join(f.out,entry.name),'utf8'),'no source is minified, wrapped or reinterpreted');vm.runInContext(entry.source,context,{filename:entry.name});}
 assert.equal(context.answer,42);assert.equal(context.accidentalGlobal,7,'first script strict mode does not leak into the next script');assert.equal(context.booted,true);assert.deepEqual(Array.from(context.order),['first','second','app']);
});

test('generated HTML references complete content-addressed packages while keeping the source files byte-identical',t=>{
 const f=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');const original=fs.readFileSync(path.join(f.out,'index.html'),'utf8');
 const manifest=runtime.bundleRuntime({outputRoot:f.out}),html=fs.readFileSync(path.join(f.out,'index.html'),'utf8');
 assert.notEqual(html,original);assert.match(html,/StudyStartup\.start\(/);assert.doesNotMatch(html,/<script[^>]+src="(?:first|second|app)\.js/);assert.doesNotMatch(html,/<link[^>]+href="(?:first|second)\.css/);assert.match(html,/Study fixture/);assert.match(html,/<main id="study">Study<\/main>/);
 for(const item of [...manifest.scripts,...manifest.styles]){assert.match(item.src,/^runtime-[a-z]+-[a-f0-9]{20}\.(?:js|css)$/);const bytes=fs.readFileSync(path.join(f.out,item.src));assert.equal(item.bytes,bytes.length);assert.equal(item.integrity,sri(bytes));assert(item.src.includes(hash(bytes).slice(0,20)));assert(html.includes(item.src),'the emitted HTML references each finished package');}
 assert.equal(fs.readFileSync(path.join(f.out,'first.js'),'utf8'),'"use strict";\nwindow.order=["first"]; const sharedLexical=41;\n');
});

test('changing an asset changes its package hash and unchanged builds are deterministic',t=>{
 const a=fixture(t),b=fixture(t),c=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');
 const first=runtime.bundleRuntime({outputRoot:a.out}),same=runtime.bundleRuntime({outputRoot:b.out});assert.deepEqual(first,same);
 c.write('second.js','window.changed=true;');const changed=runtime.bundleRuntime({outputRoot:c.out});assert.notDeepEqual(first.scripts.map(x=>x.src),changed.scripts.map(x=>x.src));assert.deepEqual(first.styles,changed.styles);
});

test('the source-measured passage counts reach the startup manifest without affecting isolated fixtures',t=>{
 const f=fixture(t),expected={'1':72,'2':96,'3':60,'4':48},manifest=runtime.bundleRuntime({outputRoot:f.out,lessonCounts:expected});
 assert.deepEqual(manifest.lessonCounts,expected);assert.notEqual(manifest.lessonCounts,expected,'the caller cannot mutate the published contract later');assert(fs.readFileSync(path.join(f.out,'index.html'),'utf8').includes('"lessonCounts":{"1":72,"2":96,"3":60,"4":48}'));
 const standalone=fixture(t);assert.equal(Object.hasOwn(runtime.bundleRuntime({outputRoot:standalone.out}),'lessonCounts'),false,'fixtures without a source health contract remain supported');
});

test('CSS stays at the original root URL base and later charsets cannot invalidate the combined sheet',t=>{
 const f=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');const manifest=runtime.bundleRuntime({outputRoot:f.out}),item=manifest.styles[0],css=fs.readFileSync(path.join(f.out,item.src),'utf8');
 assert.equal((css.match(/@charset/gi)||[]).length,1);assert(css.startsWith('@charset "UTF-8";'));assert(css.indexOf('body {')<css.indexOf('main {'));assert.match(css,/url\("resources\/book\.pdf#mask"\)/);assert.equal(path.dirname(item.src),'.','relative CSS URLs keep the same base as root source CSS');
});

test('missing assets and unsafe or unsupported stylesheet imports stop publication',t=>{
 for(const name of ['first.js','second.css']){const f=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');fs.unlinkSync(path.join(f.out,name));assert.throws(()=>runtime.bundleRuntime({outputRoot:f.out}),/missing|not found|ENOENT/i);}
 const imports=fixture(t);imports.write('second.css','@import "first.css"; main{color:teal}');assert.throws(()=>runtime.bundleRuntime({outputRoot:imports.out}),/import/i);
 const escaping=fixture(t);escaping.write('index.html','<html><head><script defer src="../outside.js"></script></head><body></body></html>');assert.throws(()=>runtime.bundleRuntime({outputRoot:escaping.out}),/unsafe|escaping/i);
});

test('six bounded contiguous packages replace the full production script list without losing script boundaries',t=>{
 const f=fixture(t);assert.equal(typeof runtime.bundleRuntime,'function');
 let html='<html><head><meta name="study-build" content="large">';for(let i=0;i<89;i++){f.write('source-'+i+'.js','window.order=(window.order||[]).concat('+i+');\n'+('/*padding*/'.repeat(i%4*100)));html+='<script defer src="source-'+i+'.js"></script>';}html+='</head><body>Study</body></html>';f.write('index.html',html);
 const manifest=runtime.bundleRuntime({outputRoot:f.out});assert.equal(manifest.scripts.length,6);assert.equal(manifest.styles.length,0);assert.deepEqual(loadedEntries(f.out,manifest).map(item=>item.name),Array.from({length:89},(_,i)=>'source-'+i+'.js'));
});

test('actual production packages initialize the same lesson, knowledge and audio data as the source HTML order',t=>{
 const f=fixture(t),root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const files=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g)].map(m=>m[1].split('?')[0]).filter(name=>/\.(?:js|css)$/.test(name));
 for(const name of files)f.write(name,fs.readFileSync(path.join(root,name)));f.write('index.html',html);
 const manifest=runtime.bundleRuntime({outputRoot:f.out}),entries=loadedEntries(f.out,manifest),names=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
 assert.deepEqual(entries.map(item=>item.name),names);assert.equal(manifest.scripts.length,6);assert.equal(manifest.styles.length,1);
 function initialized(list){const context={console,URL,URLSearchParams,document:{addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}},location:{href:'https://study.invalid/',origin:'https://study.invalid',search:''}};context.window=context;vm.createContext(context);for(const entry of list){if(entry.name==='app.js')break;vm.runInContext(entry.source,context,{filename:entry.name,timeout:30000});}return context;}
 const original=initialized(names.map(name=>({name,source:fs.readFileSync(path.join(root,name),'utf8')}))),packaged=initialized(entries);
 for(const key of ['LESSONS','STUDY_WORD_AUDIO','STUDY_LESSON_AUDIO','STUDY_LESSON_AUDIO_FALLBACKS','STUDY_CONTEXT_WORD_AUDIO','BOOK2_QUESTION_REVIEWS','STUDY_RECALL_CATALOGUE'])assert.equal(JSON.stringify(packaged[key]),JSON.stringify(original[key]),key+' matches source initialization');
 const id='nce-b2-eef57c-l001';assert.equal(JSON.stringify(packaged.StudyKnowledge.bank.vocabularyForLesson(id)),JSON.stringify(original.StudyKnowledge.bank.vocabularyForLesson(id)));assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),html,'source index stays untouched');
});
