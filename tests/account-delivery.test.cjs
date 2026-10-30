'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{bundleRuntime}=require('../dev/runtime-bundles.cjs');
test('all account dependencies and My layout ship inside fingerprinted course-cache packages',()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'zhixin-account-delivery-'));
 try{const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),names=['account-config.js','account-data.js','account-bootstrap.js','account-cache.js','account-sync-client.js','account-ui.js','account-loader.js'];
 for(const name of names)assert(index.includes('src="'+name));
 for(const name of [...names,'account-ui.css','profile-layout.css'])fs.copyFileSync(path.join(root,name),path.join(dir,name));
 fs.writeFileSync(path.join(dir,'index.html'),'<html><head><meta name="study-build" content="account-fixture">'+names.map(name=>'<script defer src="'+name+'"></script>').join('')+'<link rel="stylesheet" href="account-ui.css"><link rel="stylesheet" href="profile-layout.css"></head><body></body></html>');
 const manifest=bundleRuntime({outputRoot:dir});assert.deepEqual(manifest.scripts.flatMap(row=>row.files),names);assert(manifest.styles[0].files.includes('profile-layout.css'));const published=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert(!/src="account-/.test(published));assert(!fs.existsSync(path.join(dir,'seed.sql')));assert(!fs.existsSync(path.join(dir,'pepper.txt')));
 }finally{const target=path.resolve(dir);assert(target.startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(target,{recursive:true,force:true});}
});
