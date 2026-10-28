'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const target=path.join(__dirname,'../dev/build-pages-site.cjs');
const delivery=fs.existsSync(target)?require(target):{};

function fixture(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-pages-delivery-'));
 t.after(()=>{const resolved=path.resolve(temp),boundary=path.resolve(os.tmpdir())+path.sep;assert(resolved.startsWith(boundary));fs.rmSync(resolved,{recursive:true,force:true});});
 const source=path.join(temp,'source');fs.mkdirSync(source);
 const write=(file,body)=>{const p=path.join(source,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);};
 // Keep the media fixture larger than the fixed startup/recovery UI overhead,
 // so the whole-artifact savings assertion still measures a realistic delivery.
 const wav=Buffer.concat([Buffer.from('RIFFtestWAVE'),Buffer.alloc(50000,7)]);
 const existing=Buffer.concat([Buffer.from('ID3already-encoded'),Buffer.alloc(1200,9)]);
 write('index.html','<!doctype html><title>study</title><link rel="stylesheet" href="styles.css?build=test"><script defer src="generated-audio.js"></script><script defer src="delivery-audio.js"></script><script defer src="audio.js"></script><script defer src="app.js"></script>');
 write('generated-audio.js','window.STUDY_WORD_AUDIO={word:"audio/words/same.wav"};window.STUDY_LESSON_AUDIO={lesson:"audio/lessons/story.wav",original:"audio/words/same.mp3"};window.STUDY_LESSON_AUDIO_FALLBACKS={lesson:"audio/words/same.wav"};');
 write('delivery-audio.js','/* source checkout uses original audio */');write('audio.js','window.AudioEngineLoaded=true;');write('app.js','throw Error("the build must not initialize the live app");');write('styles.css','body{color:black}');write('.nojekyll','');write('release.json','{"build":"test"}');
 write('audio/words/same.wav',wav);write('audio/lessons/story.wav',wav);write('audio/words/same.mp3',existing);
 write('resources/book.pdf','%PDF-1.7 fixture');write('dictionary-data/a.json','{"a":"one"}');write('dictionary-data/LICENSE','MIT fixture');write('dictionary-data/source.json','{"license":"MIT"}');write('text-data/notes.json','{"sections":[]}');write('recall-data/book1.json','{"lessons":[]}');
 for(const name of ['dev/source.json','tests/check.cjs','docs/private.md','.env','.git/config','outputs/transient.json','node_modules/private/index.js','package.json','private.js','dictionary-data/.env','dictionary-data/private.json','text-data/secret.json'])write(name,'must not be published');
 let encodes=0,probes=0;
 const encoder=async({input,output,profile})=>{encodes++;assert.equal(profile.bitrate,'64k');assert.equal(profile.channels,1);assert.equal(profile.sampleRate,22050);const bytes=fs.readFileSync(input);fs.writeFileSync(output,Buffer.concat([Buffer.from('ID3fixture-'+bytes.length),Buffer.alloc(256,encodes)]));};
 const probe=async()=>{probes++;return {codec:'mp3',channels:1,sampleRate:22050,duration:1};};
 return {temp,source,write,wav,existing,encoder,probe,get encodes(){return encodes;},get probes(){return probes;},out:name=>path.join(temp,name)};
}

test('publish artifact keeps runtime assets and licenses, converts WAV without duplicate originals and preserves existing MP3 bytes',async t=>{
 assert.equal(typeof delivery.buildPages,'function');const f=fixture(t),out=f.out('site'),sourceIndex=fs.readFileSync(path.join(f.source,'index.html'),'utf8');
 const report=await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe});
 for(const file of ['index.html','app.js','styles.css','.nojekyll','release.json','resources/book.pdf','dictionary-data/a.json','dictionary-data/LICENSE','dictionary-data/source.json','text-data/notes.json','recall-data/book1.json','delivery-audio.js','delivery-report.json'])assert(fs.existsSync(path.join(out,file)),file);
 for(const file of ['dev','tests','docs','.env','.git','outputs','node_modules','package.json','private.js','dictionary-data/.env','dictionary-data/private.json','text-data/secret.json','audio/words/same.wav','audio/lessons/story.wav'])assert.equal(fs.existsSync(path.join(out,file)),false,file);
 assert.deepEqual(fs.readFileSync(path.join(out,'audio/words/same.mp3')),f.existing);
 assert(fs.existsSync(path.join(out,'audio/optimized/words/same.mp3')));assert(fs.existsSync(path.join(out,'audio/optimized/lessons/story.mp3')));
 assert.equal(f.encodes,1,'identical source bytes reuse one content-addressed derivative');assert.equal(report.conversions.count,2);assert.equal(report.conversions.cacheHits,1);assert.equal(report.audioReferences.total,4);assert(report.savedBytes>0);
 const saved=JSON.parse(fs.readFileSync(path.join(out,'delivery-report.json'),'utf8'));assert.equal(saved.publishedBytes,report.publishedBytes);assert.equal(saved.savedBytes,saved.sourceBytes-saved.publishedBytes);
 const total=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?total(path.join(dir,e.name)):fs.statSync(path.join(dir,e.name)).size),0);assert.equal(saved.publishedBytes,total(out),'reported delivered size includes its own report');
 assert.deepEqual(fs.readFileSync(path.join(f.source,'audio/words/same.wav')),f.wav,'source repository remains byte-identical');
 assert.equal(fs.readFileSync(path.join(f.source,'index.html'),'utf8'),sourceIndex,'runtime packaging changes only the published copy');
 assert.equal(report.runtime.styles.length,1);assert(report.runtime.scripts.length<=6);const scriptNames=report.runtime.scripts.flatMap(item=>item.files);assert.deepEqual(scriptNames,['generated-audio.js','delivery-audio.js','audio.js','app.js']);
 for(const item of [...report.runtime.scripts,...report.runtime.styles])assert(fs.existsSync(path.join(out,item.src)),item.src+' is present in the final artifact');
});

test('generated mapper changes only converted exact paths, including the fallback map',async t=>{
 const f=fixture(t),out=f.out('site');await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe});
 const c={STUDY_WORD_AUDIO:{a:'audio/words/same.wav',other:'audio/words/same.wav?legacy=1'},STUDY_LESSON_AUDIO:{a:'audio/words/same.mp3',other:'audio/elsewhere/same.wav'},STUDY_LESSON_AUDIO_FALLBACKS:{a:'audio/lessons/story.wav'}};c.window=c;
 vm.runInNewContext(fs.readFileSync(path.join(out,'delivery-audio.js'),'utf8'),c);
 assert.equal(c.STUDY_WORD_AUDIO.a,'audio/optimized/words/same.mp3');assert.equal(c.STUDY_WORD_AUDIO.other,'audio/words/same.wav?legacy=1');assert.equal(c.STUDY_LESSON_AUDIO.a,'audio/words/same.mp3');assert.equal(c.STUDY_LESSON_AUDIO.other,'audio/elsewhere/same.wav');assert.equal(c.STUDY_LESSON_AUDIO_FALLBACKS.a,'audio/optimized/lessons/story.mp3');
});

test('already cached previous HTML keeps its exact stylesheet available without loading it in new pages',async t=>{
 const name='runtime-styles-69a0cf19e86bb4795158.css',bytes=fs.readFileSync(path.join(__dirname,'..',name));
 assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),'69a0cf19e86bb479515825810b21010f1ebb3bb7e8c8b9721ef437dc4db4fa9c','the cached previous HTML integrity value must remain valid');
 const f=fixture(t),out=f.out('cached-compatibility');f.write(name,bytes);
 const report=await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe});
 assert.deepEqual(fs.readFileSync(path.join(out,name)),bytes,'old cached URLs remain resolvable in a fresh publication');
 assert.equal(report.runtime.styles.length,1);assert.equal(report.runtime.styles[0].files.includes(name),false,'new pages load only their current stylesheet');
});

test('published startup health contract counts actual unique canonical passages before packaging',async t=>{
 const f=fixture(t),out=f.out('health'),lessons=[
  {id:'book-one',book:1,textbook:{verified:true},paragraphs:[{en:'The first passage.'}]},
  {id:'book-two',book:2,textbook:{verified:true},paragraphs:[{en:'The second passage.'}]},
  {id:'book-two',book:2,textbook:{verified:true},paragraphs:[{en:'Duplicate identity must not mask a missing course.'}]},
  {id:'empty-three',book:3,textbook:{verified:true},paragraphs:[{en:'   '}]},
  {id:'notes-four',book:4,paragraphs:[{en:'Notes are not a canonical passage.'}]},
  {id:'book-four',book:4,textbook:{verified:true},paragraphs:[{zh:'Only Chinese.'},{en:'A real fourth-book passage.'}]}
 ];
 fs.appendFileSync(path.join(f.source,'generated-audio.js'),'\nwindow.LESSONS='+JSON.stringify(lessons)+';\n');
 const report=await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe}),expected={'1':1,'2':1,'3':0,'4':1};
 assert.deepEqual(report.audioReferences.lessonCounts,expected);assert.deepEqual(report.runtime.lessonCounts,expected);assert(fs.readFileSync(path.join(out,'index.html'),'utf8').includes('"lessonCounts":{"1":1,"2":1,"3":0,"4":1}'),'the inline manifest carries the measured source health contract');
 assert.deepEqual(delivery.inspectAudioReferences(out),report.audioReferences,'reinspection verifies the real packaged sources without starting the app');
});

test('reinspection rejects a corrupted published package before evaluating any of its source scripts',async t=>{
 const f=fixture(t),out=f.out('integrity'),report=await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe}),asset=report.runtime.scripts[0],file=path.join(out,asset.src),original=fs.readFileSync(file);
 fs.appendFileSync(file,'\nthrow Error("corrupt package must never be evaluated");\n');
 assert.throws(()=>delivery.inspectAudioReferences(out),/integrity|digest|checksum|hash|package size/i);
 const altered=Buffer.from(original);altered[0]=altered[0]===47?35:47;fs.writeFileSync(file,altered);
 assert.throws(()=>delivery.inspectAudioReferences(out),/hash integrity/i,'same-length corruption must fail its digest before VM parsing');
 fs.writeFileSync(file,original);assert.deepEqual(delivery.inspectAudioReferences(out),report.audioReferences);
 const style=report.runtime.styles[0],styleFile=path.join(out,style.src),styleBytes=fs.readFileSync(styleFile),alteredStyle=Buffer.from(styleBytes);alteredStyle[0]=35;fs.writeFileSync(styleFile,alteredStyle);
 assert.throws(()=>delivery.inspectAudioReferences(out),/hash integrity/i,'stylesheets are included in finished-package integrity validation');
 fs.writeFileSync(styleFile,styleBytes);assert.deepEqual(delivery.inspectAudioReferences(out),report.audioReferences);
});

test('normal vocabulary audio named test, private or secret is retained inside the audio asset directory',async t=>{
 const f=fixture(t),out=f.out('site');for(const word of ['test','private','secret'])f.write('audio/words/'+word+'.wav',f.wav);
 fs.appendFileSync(path.join(f.source,'generated-audio.js'),'\nObject.assign(window.STUDY_WORD_AUDIO,{test:"audio/words/test.wav",private:"audio/words/private.wav",secret:"audio/words/secret.wav"});\n');
 const report=await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe});for(const word of ['test','private','secret'])assert(fs.existsSync(path.join(out,'audio/optimized/words/'+word+'.mp3')),word);assert.equal(report.audioReferences.total,7);
});

test('cache is reusable across new output folders and corrupted bytes cannot be reused',async t=>{
 const f=fixture(t),settings={sourceRoot:f.source,encoder:f.encoder,probe:f.probe};
 await delivery.buildPages({...settings,outputRoot:f.out('one')});assert.equal(f.encodes,1);
 const second=await delivery.buildPages({...settings,outputRoot:f.out('two')});assert.equal(f.encodes,1);assert.equal(second.conversions.cacheHits,2);
 const cache=path.join(f.source,'.cache/encoded-audio'),file=fs.readdirSync(cache).find(x=>x.endsWith('.mp3'));fs.writeFileSync(path.join(cache,file),'corrupted cache');
 await delivery.buildPages({...settings,outputRoot:f.out('three')});assert.equal(f.encodes,2,'hash mismatch causes actual re-encoding');
});

test('encoding has bounded parallelism while same-content files share the in-flight derivative',{timeout:10000},async t=>{
 const f=fixture(t);f.write('audio/lessons/story.wav',Buffer.concat([f.wav,Buffer.from('different')]));f.write('audio/lessons/duplicate.wav',f.wav);
 let active=0,peak=0,started=0,release;const together=new Promise(resolve=>release=resolve);
 const encoder=async options=>{active++;peak=Math.max(peak,active);started++;if(started===2)release();await together;await f.encoder(options);active--;};
 const report=await delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('parallel'),encoder,probe:f.probe,concurrency:2});
 assert.equal(peak,2);assert.equal(f.encodes,2);assert.equal(report.conversions.count,3);assert.equal(report.conversions.cacheHits,1);
});

test('existing output directory is refused without deleting or modifying its contents',async t=>{
 const f=fixture(t),out=f.out('existing');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'keep.txt'),'keep');
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe}),/already exists/i);assert.equal(fs.readFileSync(path.join(out,'keep.txt'),'utf8'),'keep');assert.equal(f.encodes,0);
});

test('conversion failure blocks publication rather than emitting a broken audio map',async t=>{
 const f=fixture(t),out=f.out('failed');
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:async()=>{throw Error('encoder unavailable');},probe:f.probe}),/encoder unavailable/);
 assert.equal(fs.existsSync(path.join(out,'delivery-report.json')),false);assert.equal(fs.readFileSync(path.join(f.source,'delivery-audio.js'),'utf8'),'/* source checkout uses original audio */');
});

test('invalid encoded metadata cannot enter the delivery cache',async t=>{
 const f=fixture(t);await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('bad'),encoder:f.encoder,probe:async()=>({codec:'pcm_s16le',channels:2,sampleRate:44100,duration:0})}),/encoded audio/i);
});

test('runtime audio references are verified against the finished actual HTML bootstrap',async t=>{
 const f=fixture(t);f.write('generated-audio.js','window.STUDY_WORD_AUDIO={missing:"audio/words/missing.mp3"};');
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('broken'),encoder:f.encoder,probe:f.probe}),/missing.*audio|audio.*missing/i);
});

test('mapper loaded before source audio data is rejected by finished-bootstrap validation',async t=>{
 const f=fixture(t);f.write('index.html','<script defer src="delivery-audio.js"></script><script defer src="generated-audio.js"></script><script defer src="audio.js"></script><script defer src="app.js"></script>');
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('wrong-order'),encoder:f.encoder,probe:f.probe}),/missing.*audio|audio.*missing/i);
});

test('source symlinks and escaped audio paths cannot publish files outside the intended source tree',async t=>{
 const f=fixture(t),outside=f.out('outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'secret.pdf'),'private');
 fs.unlinkSync(path.join(f.source,'resources/book.pdf'));fs.rmdirSync(path.join(f.source,'resources'));
 try{fs.symlinkSync(outside,path.join(f.source,'resources'),process.platform==='win32'?'junction':'dir');}catch(e){if(e.code==='EPERM'){t.skip('OS does not allow directory symlinks');return;}throw e;}
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('symlink'),encoder:f.encoder,probe:f.probe}),/symlink|symbolic/i);
 fs.unlinkSync(path.join(f.source,'resources'));fs.mkdirSync(path.join(f.source,'resources'));
 f.write('generated-audio.js','window.STUDY_WORD_AUDIO={escape:"../outside/secret.pdf"};');
 await assert.rejects(()=>delivery.buildPages({sourceRoot:f.source,outputRoot:f.out('escape'),encoder:f.encoder,probe:f.probe}),/unsafe|escape|audio path/i);
});

test('dangling cached metadata symlinks cannot write outside the source directory',async t=>{
 const f=fixture(t),settings={sourceRoot:f.source,encoder:f.encoder,probe:f.probe};await delivery.buildPages({...settings,outputRoot:f.out('first')});
 const cache=path.join(f.source,'.cache/encoded-audio'),meta=path.join(cache,fs.readdirSync(cache).find(x=>x.endsWith('.json'))),outside=f.out('must-not-be-created.json');
 fs.unlinkSync(meta);try{fs.symlinkSync(outside,meta,'file');}catch(error){if(error.code==='EPERM'){t.skip('OS does not allow file symlinks');return;}throw error;}
 await assert.rejects(()=>delivery.buildPages({...settings,outputRoot:f.out('second')}),/symlink|symbolic/i);assert.equal(fs.existsSync(outside),false);
});

test('cover image delivery is explicit and preserves binary assets while excluding unrelated files',async t=>{
 const f=fixture(t),out=f.out('covers'),bytes=Buffer.from('RIFFbook-cover-WEBP');
 f.write('images/books/book-2.webp',bytes);f.write('images/private.json','do not publish');f.write('images/books/test-cover.webp','private');
 await delivery.buildPages({sourceRoot:f.source,outputRoot:out,encoder:f.encoder,probe:f.probe});
 assert.deepEqual(fs.readFileSync(path.join(out,'images/books/book-2.webp')),bytes);
 assert.equal(fs.existsSync(path.join(out,'images/private.json')),false);
 assert.equal(fs.existsSync(path.join(out,'images/books/test-cover.webp')),false);
});
