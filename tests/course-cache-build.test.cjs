'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {bundleRuntime}=require('../dev/runtime-bundles.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('inline vector covers do not download old raster covers into the offline cache',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'inline-cover-cache-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'runtime.js'),'window.ready=true;');fs.mkdirSync(path.join(root,'images/books'),{recursive:true});
 for(let book=1;book<=4;book++)fs.writeFileSync(path.join(root,'images/books/book-'+book+'.webp'),'legacy cover');
 const builder=require('../dev/course-cache.cjs'),manifest={scripts:[{src:'runtime.js',files:['book-covers.js']}],styles:[]};
 assert.deepEqual(builder.courseAssets(root,manifest).map(row=>row.src),['runtime.js']);
 manifest.scripts[0].files=['legacy.js'];assert.equal(builder.courseAssets(root,manifest).length,5,'legacy builds retain their actual dependencies');
});
test('published worker binds exact final HTML, bounded runtime/covers/text/recall assets and inline client',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'course-cache-build-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(name,body)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);};
 write('index.html','<html><head><script defer src="app.js"></script><link rel="stylesheet" href="app.css"></head><body>study</body></html>');write('app.js','window.loaded=true;');write('app.css','body{color:black}');
 for(let book=1;book<=4;book++)write('images/books/book-'+book+'.webp','cover '+book);
 write('recall-data/book1.json','{"lessons":[]}\n');write('text-data/notes.json','{"sections":[]}');write('audio/track.mp3','audio');write('resources/book.pdf','pdf');write('dictionary-data/a.json','dictionary');
 const manifest=bundleRuntime({outputRoot:root}),html=fs.readFileSync(path.join(root,'index.html')),source=fs.readFileSync(path.join(root,'course-cache-worker.js'),'utf8');let config;
 const context={module:{exports:{}},self:{StudyCourseCache:(scope,next)=>{config=next;}}};vm.runInNewContext(source,context);
 assert.equal(config.index.sha256,sha(html));assert.equal(config.index.bytes,html.length);assert.equal(config.version,manifest.courseCache.version);assert.match(html.toString(),/StudyCourseCacheClient/);assert.equal(manifest.courseCache.worker,'course-cache-worker.js');
 assert.equal(config.assets.length,8);assert(config.assets.some(asset=>asset.src==='images/books/book-4.webp'));assert(config.assets.some(asset=>asset.src==='text-data/notes.json'));assert(!config.assets.some(asset=>/^(?:audio|resources|dictionary-data)\//.test(asset.src)));
 for(const asset of config.assets){const bytes=fs.readFileSync(path.join(root,asset.src));assert.equal(asset.sha256,sha(bytes));assert.equal(asset.bytes,bytes.length);}
 assert.equal(config.assets.find(asset=>asset.src==='recall-data/book1.json').build,sha('{"lessons":[]}').slice(0,16));
});
