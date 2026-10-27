'use strict';
// Cross-platform checkout contracts. Source text EOL normalization is distinct from raw dictionary assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),test=require('node:test'),assert=require('node:assert/strict');
const DIR=process.env.ORDINAL_APP_DIST?path.resolve(process.env.ORDINAL_APP_DIST):path.join(__dirname,'..'),buildFile=path.join(DIR,'dev/build-lesson-word-targets.cjs'),builder=require(buildFile),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),lf=x=>String(x).replace(/\r\n?/g,'\n'),eol=(s,kind)=>lf(s).replace(/\n/g,kind==='crlf'?'\r\n':kind==='cr'?'\r':'\n');
function setup(t,kind='lf'){
 const parent=path.resolve(__dirname),root=fs.mkdtempSync(path.join(parent,'ordinal-line-ending-fixture-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(root)),parent);assert(path.basename(root).startsWith('ordinal-line-ending-fixture-'));fs.rmSync(root,{recursive:true,force:true});});
 fs.mkdirSync(path.join(root,'dev'));fs.mkdirSync(path.join(root,'dictionary-data'));
 for(const [file,source]of [['dev/build-lesson-word-targets.cjs',fs.readFileSync(buildFile,'utf8')],['lexical-word-tokens.js',fs.readFileSync(path.join(DIR,'lexical-word-tokens.js'),'utf8')],['data.js','// fixture source\nwindow.LESSONS = [{id:"dates",book:1,number:1,title:"Dates",paragraphs:[{en:"April 1st in a room24."}],vocabulary:[]}];\n'],['app.js','throw Error("must stop before app");\n']])fs.writeFileSync(path.join(root,file),eol(source,kind));
 fs.writeFileSync(path.join(root,'index.html'),'<script src="lexical-word-tokens.js"></script><script src="data.js"></script><script src="app.js"></script>\n');
 const shard=JSON.stringify({entries:{room:{translation:'n. 房间'}}},null,2)+'\n',license='MIT test license\nRaw bytes are independently frozen.\n';
 fs.writeFileSync(path.join(root,'dictionary-data/a.json'),shard);fs.writeFileSync(path.join(root,'dictionary-data/LICENSE'),license);fs.writeFileSync(path.join(root,'dictionary-data/source.json'),JSON.stringify({name:'fixture',commit:'offline-only',shards:[{file:'a.json',sha256:sha(shard)}],license:{name:'MIT',sha256:sha(license)}}));
 return {root,local:require(path.join(root,'dev/build-lesson-word-targets.cjs'))};
}
const outputs=root=>['lesson-word-targets.js','lesson-word-targets-source.json'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
test('[ordinal LF RED] generated browser script is UTF8 LF even when the compiler function source was checked out as CRLF',t=>{
 const {root,local}=setup(t,'crlf'),p=local.buildLessonWordTargets({projectRoot:root}),[js]=outputs(root);assert.equal(js.includes('\r'),false,'stringified installer must not carry checkout CRLF into the generated JS');assert.equal(p.artifact.sha256,sha(js));assert.equal(p.hashEncoding.scriptInputs,'utf8-lf');assert.equal(p.hashEncoding.dictionaryShards,'raw-bytes');assert.equal(p.tokenizer.hashEncoding,'utf8-lf');
});
test('[ordinal LF RED] LF, CRLF and CR physical compiler/helper/data checkouts produce byte-identical JS and provenance',t=>{
 const cases=['lf','crlf','cr'].map(kind=>setup(t,kind)),results=cases.map(({root,local})=>{local.buildLessonWordTargets({projectRoot:root});return outputs(root);});assert.deepEqual(results[1],results[0]);assert.deepEqual(results[2],results[0]);
 const alternate=setup(t,'crlf');assert.doesNotThrow(()=>builder.buildLessonWordTargets({projectRoot:alternate.root}),'a shared helper with only checkout line endings changed is the same approved source');assert.deepEqual(outputs(alternate.root),results[0]);
});
test('[ordinal LF RED] actual script/helper drift remains recorded or rejected while dictionary and license hashes stay raw-byte exact',t=>{
 const {root}=setup(t,'lf'),before=builder.buildLessonWordTargets({projectRoot:root}),valid=outputs(root),helper=path.join(root,'lexical-word-tokens.js'),helperSource=fs.readFileSync(helper,'utf8');
 fs.writeFileSync(helper,helperSource+'\n// actual helper source drift\n');assert.throws(()=>builder.buildLessonWordTargets({projectRoot:root}),/tokenizer source mismatch/);assert.deepEqual(outputs(root),valid);fs.writeFileSync(helper,helperSource);
 for(const [file,message]of [['dictionary-data/a.json',/dictionary source mismatch/],['dictionary-data/LICENSE',/MIT license source mismatch/]]){const p=path.join(root,file),bytes=fs.readFileSync(p);fs.writeFileSync(p,eol(bytes.toString('utf8'),'crlf'));assert.throws(()=>builder.buildLessonWordTargets({projectRoot:root}),message);assert.deepEqual(outputs(root),valid);fs.writeFileSync(p,bytes);}
 const data=path.join(root,'data.js');fs.appendFileSync(data,'\n// source change must appear in provenance\n');const after=builder.buildLessonWordTargets({projectRoot:root});assert.notEqual(after.inputs.find(i=>i.file==='data.js').sha256,before.inputs.find(i=>i.file==='data.js').sha256);assert.notEqual(after.artifact.sha256,before.artifact.sha256);
});
