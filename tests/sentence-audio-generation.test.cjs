'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const generator=()=>require('../dev/generate-sentence-audio.cjs');
test('sentence audio planning deduplicates exact text without merging different punctuation or truncating long sentences',()=>{
 const {makePlan}=generator(),long='A'.repeat(436)+'.';
 const plan=makePlan([{id:'a',book:1,number:1,rows:[{en:'Hello.'},{en:'Hello!'},{en:long}]},{id:'b',book:1,number:2,rows:[{en:'Hello.'},{en:'. .'}]}]);
 assert.equal(plan.clips.length,3);assert.equal(plan.sentences,5);assert.equal(plan.nonSpeechUnits.length,1);assert.equal(plan.nonSpeechUnits[0].index,1);assert.equal(plan.clips[2].en.length,437);assert.equal(plan.lessons[0].rows[0].sha256,plan.lessons[1].rows[0].sha256);assert.notEqual(plan.clips[0].sha256,plan.clips[1].sha256);assert.match(plan.clips[0].src,/^audio\/sentences\/[a-f0-9]{64}\.mp3$/);
});
test('the browser map exposes only successful exact sentence assets and labels synthetic audio explicitly',()=>{
 const {makePlan,browserSource}=generator(),plan=makePlan([{id:'a',rows:[{en:'Hello.'},{en:'Missing.'},{en:'. .'}]}]),w={};
 vm.runInNewContext(browserSource(plan,new Set([plan.clips[0].sha256])),{window:w});
 assert.equal(w.STUDY_SENTENCE_AUDIO.a[0].en,'Hello.');assert.equal(w.STUDY_SENTENCE_AUDIO.a[0].source,'synthetic');assert.equal(w.STUDY_SENTENCE_AUDIO.a[1],null);assert.match(w.STUDY_SENTENCE_AUDIO.a[0].src,/\.mp3$/);assert.equal(w.STUDY_SENTENCE_AUDIO.a[2].source,'non-speech');assert.equal(w.STUDY_SENTENCE_AUDIO.a[2].en,'. .');assert.equal(w.STUDY_SENTENCE_AUDIO.a[2].src,undefined);
});
test('the production corpus is loaded through its reading model and contains all 276 source lessons',()=>{
 const {loadCorpus,makePlan}=generator(),corpus=loadCorpus(path.resolve(__dirname,'..')),plan=makePlan(corpus);
 assert.equal(corpus.length,276);assert.equal(corpus[0].rows[0].en,'Excuse me!');assert.ok(plan.sentences>4000);assert.ok(plan.clips.length<plan.sentences);assert.ok(plan.clips.some(row=>row.en.length>=437));
});
test('MP3 validation rejects invalid or truncated audio instead of treating any nonempty file as complete',()=>{
 const {mp3Info}=generator();assert.throws(()=>mp3Info(Buffer.from('RIFFfake WAV')),/MP3|MPEG/);assert.throws(()=>mp3Info(Buffer.from([255,243,80,192])),/MP3|MPEG|truncat/i);
});
test('every spoken public reading unit has a source-matched valid real MP3 while non-speech indexes remain explicit',()=>{
 const {loadCorpus,mp3Info}=generator(),root=path.resolve(__dirname,'..'),corpus=loadCorpus(root),w={};vm.runInNewContext(fs.readFileSync(path.join(root,'provided-sentence-audio.js'),'utf8'),{window:w});
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'provided-sentence-audio.metadata.json'),'utf8')),unique=new Map();let spoken=0,nonSpeech=0;
 for(const lesson of corpus){const mapped=w.STUDY_SENTENCE_AUDIO[lesson.id];assert.equal(mapped.length,lesson.rows.length,lesson.id+' keeps all indexes');for(let i=0;i<lesson.rows.length;i++){const expected=lesson.rows[i].en,entry=mapped[i];assert.equal(entry.en,expected,lesson.id+':'+i+' exact source text');if(!/[A-Za-z0-9]/.test(expected)){assert.equal(entry.source,'non-speech');assert.equal(entry.src,undefined);nonSpeech++;continue;}spoken++;assert.equal(entry.source,'synthetic');assert.match(entry.src,/^audio\/sentences\/[a-f0-9]{64}\.mp3$/);assert.equal(path.basename(entry.src,'.mp3'),require('node:crypto').createHash('sha256').update(expected,'utf8').digest('hex'));if(!unique.has(entry.src))unique.set(entry.src,mp3Info(fs.readFileSync(path.join(root,entry.src))));}}
 assert.equal(corpus.length,276);assert.equal(spoken,4334);assert.equal(nonSpeech,1);assert.equal(unique.size,4246);assert.equal(metadata.availableClipCount,4246);assert.equal(metadata.missingClipCount,0);assert.equal(metadata.nonSpeechUnits.length,1);assert.equal(metadata.totalBytes,Array.from(unique.values()).reduce((sum,row)=>sum+row.bytes,0));
});
