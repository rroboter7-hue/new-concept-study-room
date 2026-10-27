'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test');
const dir=path.join(__dirname,'..'),file='book2-complete-word-audio.js',plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function load(skip=false){const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);for(const m of fs.readFileSync(path.join(dir,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){const f=m[1].split('?')[0];if(f==='app.js')break;if(skip&&f===file)continue;vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c,{filename:f});}return c;}
const c=load(),before=load(true);
test('all printed Book 2 word forms and declared lesson vocabulary have local audio without device TTS',()=>{
 const keys=new Set(),add=w=>{if(typeof w==='string'&&w)keys.add(w.toLowerCase());};
 const lessons=c.LESSONS.filter(l=>l.book===2);assert.equal(lessons.length,96);
 for(const l of lessons){const forms=new Set((l.vocabulary||[]).flatMap(v=>v.sourceForms||[]).map(w=>w.toLowerCase()));for(const p of l.paragraphs)for(const m of c.StudyLexicalWords.scan(p.en).filter(t=>t.kind==='word'&&!c.StudyLexicalWords.isDottedSt(p.en,t))){let w=m.surface,tail=p.en.slice(m.end,m.end+1);if(/s$/i.test(w)&&/[’']/.test(tail)&&forms.has((w+tail).toLowerCase()))w+=tail;add(w);}for(const v of [...l.vocabulary||[],...l.notesVocabularyExtensions||[]]){add(v.word);for(const f of v.sourceForms||[])add(f);}}
 assert.equal(keys.size,2599);assert.equal(c.STUDY_WORD_AUDIO.st,undefined);assert.deepEqual([...keys].filter(w=>!c.STUDY_WORD_AUDIO[w]),[]);
 for(const w of keys){const p=c.STUDY_WORD_AUDIO[w];assert.match(p,/^audio\/words\/[^/\\]+\.wav$/);assert(!p.includes('..'));assert(fs.statSync(path.join(dir,p)).size>1000,w);}
 assert(c.STUDY_WORD_AUDIO.deserted);assert(c.STUDY_WORD_AUDIO.critics);assert(c.STUDY_WORD_AUDIO['fools’']);assert.equal(c.STUDY_WORD_AUDIO['fools’'],c.STUDY_WORD_AUDIO["fools'"]);assert.equal(c.STUDY_WORD_AUDIO['musn’t'],undefined);
});
test('new static word files have intact hashes, real mono PCM samples and disclosed synthetic provenance',()=>{
 const files=new Map();for(const s of Object.values(c.BOOK2_COMPLETE_WORD_AUDIO_SOURCES)){if(s.sourceType==='existing-local-audio-alias')continue;assert.equal(s.notTextbookOriginalRecording,true);assert.match(s.voice,/Zira/);assert.equal(s.culture,'en-US');assert(s.synthesisText);files.set(s.file,s);}
 assert.equal(files.size,1427);let bytes=0;
 for(const [relative,s] of files){assert.match(relative,/^audio\/words\/[a-z0-9_-]+\.wav$/);const b=fs.readFileSync(path.join(dir,relative));assert.equal(sha(b),s.sha256);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(4)+8,b.length);assert.equal(b.toString('ascii',8,12),'WAVE');let at=12,fmt,data;while(at+8<=b.length){const size=b.readUInt32LE(at+4),type=b.toString('ascii',at,at+4);assert(at+8+size<=b.length);if(type==='fmt ')fmt=b.subarray(at+8,at+8+size);if(type==='data')data=b.subarray(at+8,at+8+size);at+=8+size+(size%2);}assert.equal(at,b.length);assert(fmt&&data);assert.equal(fmt.readUInt16LE(0),1);assert.equal(fmt.readUInt16LE(2),1);assert.equal(fmt.readUInt32LE(4),16000);assert.equal(fmt.readUInt16LE(14),16);assert(data.length>3200&&data.length<256000);let sum=0;for(let i=0;i<data.length;i+=2){const n=data.readInt16LE(i);assert(n!==32767&&n!==-32768);sum+=n*n;}assert(Math.sqrt(sum/(data.length/2))>20);bytes+=b.length;}
 assert.equal(bytes,67034948);
});
test('the word supplement preserves every existing mapping and contextual desert pronunciation, and is idempotent',()=>{
 assert.equal(Object.keys(before.STUDY_WORD_AUDIO).length,2269);for(const [key,value] of Object.entries(before.STUDY_WORD_AUDIO))assert.equal(c.STUDY_WORD_AUDIO[key],value,key);assert.deepEqual(plain(c.STUDY_CONTEXT_WORD_AUDIO),plain(before.STUDY_CONTEXT_WORD_AUDIO));assert.notEqual(c.STUDY_CONTEXT_WORD_AUDIO['nce-b2-eef57c-l029'].desert,c.STUDY_WORD_AUDIO.desert);assert.equal(Object.keys(c.STUDY_WORD_AUDIO).length,3724);
 const state=JSON.stringify([c.STUDY_WORD_AUDIO,c.BOOK2_COMPLETE_WORD_AUDIO_SOURCES,c.BOOK2_COMPLETE_WORD_AUDIO_STATUS]);vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(dir,'ordinal-audio-alias-correction.js'),'utf8'),c);assert.equal(JSON.stringify([c.STUDY_WORD_AUDIO,c.BOOK2_COMPLETE_WORD_AUDIO_SOURCES,c.BOOK2_COMPLETE_WORD_AUDIO_STATUS]),state);
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert(html.indexOf(file)<html.indexOf('delivery-audio.js'));assert(html.indexOf('delivery-audio.js')<html.indexOf('src="audio.js'));
});
