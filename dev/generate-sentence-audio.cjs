#!/usr/bin/env node
'use strict';
// Real offline sentence synthesis. Files are generated from the exact public
// StudyReading units; these are Microsoft Zira synthetic audio, not source recordings.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const PROFILE=Object.freeze({voice:'Microsoft Zira Desktop',language:'en-US',sampleRate:22050,channels:1,bitrateKbps:40,encoderPackage:'imageio-ffmpeg',encoderPackageVersion:'0.6.0'});
const hash=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
function loadCorpus(projectRoot=ROOT){
 const document={addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{},body:{classList:{add(){},remove(){},contains(){return false;}}}};
 const w={console,document,URL,URLSearchParams,TextEncoder,TextDecoder,navigator:{},location:{href:'https://sentence-audio-build.invalid/',origin:'https://sentence-audio-build.invalid',search:''},setTimeout(){return 0;},clearTimeout(){},addEventListener(){},removeEventListener(){}};
 w.window=w;vm.createContext(w);
 for(const match of fs.readFileSync(path.join(projectRoot,'index.html'),'utf8').matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)){
  const file=match[1].split(/[?#]/)[0];if(file==='app.js')break;if(file==='provided-sentence-audio.js')continue;
  const absolute=path.resolve(projectRoot,file);if(!absolute.startsWith(path.resolve(projectRoot)+path.sep))throw Error('Bootstrap path leaves project root');
  vm.runInContext(fs.readFileSync(absolute,'utf8'),w,{filename:file,timeout:15000});
 }
 if(!Array.isArray(w.LESSONS)||!w.StudyReading?.units)throw Error('Public lessons/reading model did not load');
 return w.LESSONS.map(lesson=>({id:lesson.id,book:lesson.book,number:lesson.number,rows:Array.from(w.StudyReading.units(lesson),row=>({en:row.en}))}));
}
function makePlan(corpus){
 const clips=new Map(),nonSpeechUnits=[];let sentences=0;
 const lessons=corpus.map(lesson=>({id:lesson.id,book:lesson.book,number:lesson.number,rows:lesson.rows.map((row,index)=>{
  if(typeof row.en!=='string'||!row.en.trim())throw Error('Empty English reading unit in '+lesson.id);
  sentences++;
  if(!/[A-Za-z0-9]/.test(row.en)){nonSpeechUnits.push({lessonId:lesson.id,book:lesson.book,number:lesson.number,index,en:row.en});return {en:row.en,source:'non-speech'};}
  const sha256=hash(row.en),clip={en:row.en,sha256,src:'audio/sentences/'+sha256+'.mp3'};if(!clips.has(sha256))clips.set(sha256,clip);return clip;
 })}));
 return {lessons,clips:Array.from(clips.values()),sentences,nonSpeechUnits};
}
function browserSource(plan,available){
 const map=Object.fromEntries(plan.lessons.map(lesson=>[lesson.id,lesson.rows.map(row=>row.source==='non-speech'?{en:row.en,source:'non-speech'}:available.has(row.sha256)?{en:row.en,src:row.src,source:'synthetic'}:null)]));
 return '/* Exact-source, offline Microsoft Zira sentence synthesis. Non-original recordings. */\nwindow.STUDY_SENTENCE_AUDIO='+JSON.stringify(map)+';\n';
}
function mp3Info(bytes){
 let offset=0,frames=0,duration=0;
 if(bytes.toString('latin1',0,3)==='ID3'){
  if(bytes.length<10||[6,7,8,9].some(i=>bytes[i]&128))throw Error('Invalid MP3 ID3 header');
  offset=10+bytes[6]*2097152+bytes[7]*16384+bytes[8]*128+bytes[9];
 }
 while(offset<bytes.length){
  if(bytes.length-offset===128&&bytes.toString('latin1',offset,offset+3)==='TAG')break;
  if(offset+4>bytes.length)throw Error('Truncated MP3 MPEG header');
  const b=bytes.subarray(offset,offset+4),version=(b[1]>>3)&3,layer=(b[1]>>1)&3,index=b[2]>>4,rateIndex=(b[2]>>2)&3;
  if(b[0]!==255||(b[1]&224)!==224||version!==2||layer!==1||index<1||index>14||rateIndex>2)throw Error('Invalid MP3 MPEG-2 Layer III frame');
  const bitrate=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160][index],sampleRate=[22050,24000,16000][rateIndex],channels=(b[3]>>6)===3?1:2;
  if(bitrate!==PROFILE.bitrateKbps||sampleRate!==PROFILE.sampleRate||channels!==PROFILE.channels)throw Error('MP3 profile differs from the documented sentence audio profile');
  const length=Math.floor(72000*bitrate/sampleRate)+((b[2]>>1)&1);if(offset+length>bytes.length)throw Error('Truncated MP3 MPEG frame');
  offset+=length;frames++;duration+=576/sampleRate;
 }
 if(frames<2)throw Error('MP3 has no complete audio');
 return {bytes:bytes.length,frames,durationSeconds:duration,sampleRate:22050,channels:1,bitrateKbps:40};
}
function inspectClip(root,clip){try{return mp3Info(fs.readFileSync(path.join(root,clip.src)));}catch{return null;}}
function worker(args,index){
 return new Promise((resolve,reject)=>{
  const child=spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'generate-sentence-audio.ps1'),...args],{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stdout.on('data',data=>process.stdout.write('worker '+index+': '+data));child.stderr.on('data',data=>{stderr+=data.toString();if(stderr.length>16000)stderr=stderr.slice(-16000);});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Worker '+index+' exited '+code+': '+stderr)));
 });
}
async function generate(options={}){
 const root=path.resolve(options.root||ROOT),cache=path.join(root,'.cache','sentence-audio'),plan=makePlan(loadCorpus(root));
 fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(path.join(root,'audio','sentences'),{recursive:true});
 const settingsFile=path.join(cache,'settings.json'),settings=JSON.stringify(PROFILE);
 if(fs.existsSync(settingsFile)&&fs.readFileSync(settingsFile,'utf8')!==settings)throw Error('Cached synthesis settings changed. Keep existing audio separate before regenerating with another voice/profile.');
 fs.writeFileSync(settingsFile,settings);
 const pending=plan.clips.filter(clip=>!inspectClip(root,clip)),words=plan.clips.reduce((sum,clip)=>sum+(clip.en.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length,0);
 console.log(JSON.stringify({lessons:plan.lessons.length,sentences:plan.sentences,unique:plan.clips.length,pending:pending.length,uniqueWords:words,estimatedAudioMiB:Math.round((words/2.65+plan.clips.length*.35)*5000/1048576),profile:PROFILE}));
 if(options.plan)return {plan,pending};
 const encoder=path.resolve(options.encoder||path.join(root,'.cache','speech-tools','imageio_ffmpeg','binaries','ffmpeg-win-x86_64-v7.1.exe'));
 if(!fs.existsSync(encoder))throw Error('MP3 encoder missing. Install imageio-ffmpeg==0.6.0 from official PyPI into .cache/speech-tools, or supply --encoder.');
 const selected=options.benchmark?pending.slice(0,1):pending,concurrency=Math.max(1,Math.min(4,options.concurrency||3)),groups=Array.from({length:concurrency},()=>[]);
 selected.forEach((clip,i)=>groups[i%groups.length].push({sha256:clip.sha256,text:clip.en,output:path.join(root,clip.src),wav:path.join(cache,clip.sha256+'.wav')}));
 const started=Date.now(),workerFailures=[];
 const results=await Promise.allSettled(groups.map(async(jobs,index)=>{
  if(!jobs.length)return;const jobFile=path.join(cache,'worker-'+index+'.json'),resultFile=path.join(cache,'worker-'+index+'-results.jsonl');
  fs.writeFileSync(jobFile,JSON.stringify({profile:PROFILE,root,jobs}));fs.writeFileSync(resultFile,'');
  await worker(['-JobFile',jobFile,'-Encoder',encoder,'-ResultFile',resultFile],index);
 }));
 results.forEach((result,index)=>{if(result.status==='rejected')workerFailures.push({worker:index,error:result.reason.message});});
 const available=new Set(),inventory=[],failed=[];
 for(const clip of plan.clips){const info=inspectClip(root,clip);if(info){available.add(clip.sha256);inventory.push({sha256:clip.sha256,src:clip.src,...info});}else failed.push({sha256:clip.sha256,en:clip.en,src:clip.src,lessons:plan.lessons.filter(lesson=>lesson.rows.some(row=>row.sha256===clip.sha256)).map(lesson=>lesson.id)});}
 const metadata={version:1,generatedAt:new Date().toISOString(),source:'synthetic',profile:PROFILE,lessonCount:plan.lessons.length,sentenceCount:plan.sentences,spokenSentenceCount:plan.sentences-plan.nonSpeechUnits.length,nonSpeechUnits:plan.nonSpeechUnits,uniqueClipCount:plan.clips.length,availableClipCount:inventory.length,missingClipCount:failed.length,totalBytes:inventory.reduce((sum,row)=>sum+row.bytes,0),totalUniqueDurationSeconds:inventory.reduce((sum,row)=>sum+row.durationSeconds,0),wallTimeSeconds:(Date.now()-started)/1000,workerFailures,clips:inventory};
 fs.writeFileSync(path.join(cache,'failures.json'),JSON.stringify({workerFailures,failed},null,2)+'\n');
 if(!options.benchmark){fs.writeFileSync(path.join(root,'provided-sentence-audio.js'),browserSource(plan,available));fs.writeFileSync(path.join(root,'provided-sentence-audio.metadata.json'),JSON.stringify(metadata,null,2)+'\n');}
 else fs.writeFileSync(path.join(cache,'benchmark-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
 const {clips,...summary}=metadata;console.log(JSON.stringify(summary));
 if(workerFailures.length||!options.benchmark&&failed.length)throw Error('Sentence audio incomplete; rerun the same command to resume. See .cache/sentence-audio/failures.json.');
 return metadata;
}
module.exports={PROFILE,loadCorpus,makePlan,browserSource,mp3Info,generate};
if(require.main===module){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i++){if(args[i]==='--benchmark')options.benchmark=true;else if(args[i]==='--plan')options.plan=true;else if(args[i]==='--concurrency')options.concurrency=Number(args[++i]);else if(args[i]==='--encoder')options.encoder=args[++i];else throw Error('Unknown option: '+args[i]);}
 generate(options).catch(error=>{console.error(error.message);process.exitCode=1;});
}
