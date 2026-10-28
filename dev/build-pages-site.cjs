'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {bundleRuntime,readPackagedScripts}=require('./runtime-bundles.cjs');

const PROFILE=Object.freeze({version:1,codec:'libmp3lame',bitrate:'64k',channels:1,sampleRate:22050});
const AUDIO_MAPS=['STUDY_WORD_AUDIO','STUDY_LESSON_AUDIO','STUDY_LESSON_AUDIO_FALLBACKS','STUDY_CONTEXT_WORD_AUDIO'];
const DATA_DIRS=new Map([
 ['audio',new Set(['.wav','.mp3','.m4a','.ogg'])],
 ['resources',new Set(['.pdf'])],
 ['images',new Set(['.webp','.png','.jpg','.jpeg'])],
 ['dictionary-data',new Set(['.json'])],
 ['text-data',new Set(['.json'])],
 ['recall-data',new Set(['.json'])]
]);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const slash=value=>value.split(path.sep).join('/');
const inside=(root,target)=>target===root||target.startsWith(root+path.sep);
const privateName=name=>name.startsWith('.')||/^(?:private|secret|temp|test|spec)(?:[._-]|$)/i.test(name);

function safeRelative(value){
 if(typeof value!=='string'||!value||value.includes('\0')||value.includes('\\')||value.startsWith('/')||/^[a-z][\w+.-]*:/i.test(value))throw Error('Unsafe asset path: '+value);
 const pieces=value.split('/');
 if(pieces.some(piece=>!piece||piece==='.'||piece==='..'))throw Error('Unsafe escaping asset path: '+value);
 return value;
}
function plainPath(root,relative){
 const target=path.resolve(root,...safeRelative(relative).split('/'));
 if(!inside(root,target))throw Error('Unsafe escaping asset path: '+relative);
 return target;
}
function assertNotSymlink(target){
 if(fs.lstatSync(target).isSymbolicLink())throw Error('Symbolic links are not allowed in delivery assets: '+target);
}
function lstatIfPresent(target){
 try{return fs.lstatSync(target);}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function checkParentChain(target){
 let cursor=path.resolve(target);
 while(true){
  const stat=lstatIfPresent(cursor);if(stat){if(stat.isSymbolicLink())throw Error('Symbolic links are not allowed in delivery directories: '+cursor);if(!stat.isDirectory())throw Error('Expected a plain directory: '+cursor);}
  const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
 }
}
function runtimeFiles(sourceRoot){
 const result=[];
 const add=relative=>{
  const target=plainPath(sourceRoot,relative);assertNotSymlink(target);
  if(!fs.statSync(target).isFile())throw Error('Expected regular asset: '+relative);
  if(!inside(sourceRoot,fs.realpathSync(target)))throw Error('Asset escapes source directory: '+relative);
  result.push({relative,size:fs.statSync(target).size});
 };
 function visit(relative,extensions){
  const target=plainPath(sourceRoot,relative);assertNotSymlink(target);
  for(const entry of fs.readdirSync(target,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const next=relative+'/'+entry.name,full=plainPath(sourceRoot,next);assertNotSymlink(full);
   // "test", "private" and "secret" are legitimate vocabulary filenames.
   // Audio is already constrained by its explicit media extension allow-list.
   if(entry.name.startsWith('.')||!relative.startsWith('audio/')&&relative!=='audio'&&privateName(entry.name))continue;
   if(entry.isDirectory())visit(next,extensions);
   else if(entry.isFile()&&(extensions.has(path.extname(entry.name).toLowerCase())||relative==='dictionary-data'&&entry.name==='LICENSE'))add(next);
  }
 }
 for(const entry of fs.readdirSync(sourceRoot,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(DATA_DIRS.has(entry.name)){
   assertNotSymlink(path.join(sourceRoot,entry.name));if(!entry.isDirectory())throw Error('Expected runtime data directory: '+entry.name);visit(entry.name,DATA_DIRS.get(entry.name));continue;
  }
  if(entry.name==='.nojekyll'||entry.name==='release.json'||!privateName(entry.name)&&/\.(?:js|css|html)$/i.test(entry.name)){
   assertNotSymlink(path.join(sourceRoot,entry.name));if(entry.isFile())add(entry.name);
  }
 }
 return result;
}

async function encodeWav({input,output,profile}){
 await run('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-i',input,'-vn','-ac',String(profile.channels),'-ar',String(profile.sampleRate),'-codec:a',profile.codec,'-b:a',profile.bitrate,'-map_metadata','-1','-y',output],{maxBuffer:1024*1024});
}
async function probeMp3(file){
 const {stdout}=await run('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_name,channels,sample_rate','-show_entries','format=duration','-of','json',file],{maxBuffer:1024*1024});
 const data=JSON.parse(stdout),stream=data.streams?.[0];
 return {codec:stream?.codec_name,channels:Number(stream?.channels),sampleRate:Number(stream?.sample_rate),duration:Number(data.format?.duration)};
}
async function verifyEncoding(file,probe){
 assertNotSymlink(file);
 if(!fs.statSync(file).isFile()||fs.statSync(file).size===0)throw Error('Invalid encoded audio: empty or non-regular file');
 const details=await probe(file);
 if(details?.codec!=='mp3'||details.channels!==PROFILE.channels||details.sampleRate!==PROFILE.sampleRate||!Number.isFinite(details.duration)||details.duration<=0)throw Error('Invalid encoded audio metadata: '+file);
 return details;
}
function mapperSource(converted){
 converted=Object.fromEntries(Object.entries(converted).sort(([a],[b])=>a.localeCompare(b)));
 return '/* Generated by dev/build-pages-site.cjs; original repository audio is unchanged. */\n(function(root){\n"use strict";\nvar converted='+JSON.stringify(converted)+';\nvar names='+JSON.stringify(AUDIO_MAPS)+';\nfunction rewrite(value){if(typeof value==="string")return Object.prototype.hasOwnProperty.call(converted,value)?converted[value]:value;if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).map(function(key){return [key,rewrite(value[key])];}));return value;}\nnames.forEach(function(name){var current=root[name];if(!current||typeof current!=="object")return;var next=Object.assign({},current);Object.keys(next).forEach(function(key){next[key]=rewrite(next[key]);});root[name]=next;});\nroot.STUDY_AUDIO_DELIVERY={version:1,convertedFiles:Object.keys(converted).length,profile:'+JSON.stringify(PROFILE)+'};\n})(window);\n';
}
function relativeHtmlAsset(value){
 if(!value||/^(?:data:|https?:|#)/i.test(value))return null;
 return safeRelative(decodeURIComponent(value.split(/[?#]/)[0]));
}
function inspectAudioReferences(outputRoot){
 const html=fs.readFileSync(path.join(outputRoot,'index.html'),'utf8');
 const tags=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,tag=>tag.slice(0,tag.indexOf('>')+1));
 for(const match of tags.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)){
  const relative=relativeHtmlAsset(match[1]);
  if(relative&&!fs.existsSync(plainPath(outputRoot,relative)))throw Error('Missing runtime HTML asset: '+relative);
 }
 const scripts=Array.from(tags.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),m=>relativeHtmlAsset(m[1]));
 const packaged=scripts.length?null:readPackagedScripts({outputRoot,html}),entries=packaged?.entries||scripts.map(name=>({name}));
 if(packaged)scripts.push(...entries.map(entry=>entry.name));
 if(!scripts.includes('delivery-audio.js'))throw Error('index.html must include delivery-audio.js after audio maps and before audio.js');
 if(!scripts.includes('app.js'))throw Error('index.html app.js bootstrap was not found');
 const context={document:{addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}},URL,URLSearchParams,location:{search:'',href:'https://delivery.invalid/index.html',origin:'https://delivery.invalid'},console};
 context.window=context;vm.createContext(context);
 for(const entry of entries){
  if(entry.name==='app.js')break;
  if(!entry.name)throw Error('External bootstrap scripts cannot be verified for this static delivery');
  vm.runInContext(entry.source===undefined?fs.readFileSync(plainPath(outputRoot,entry.name),'utf8'):entry.source,context,{filename:entry.name,timeout:30000});
 }
 const references=[];
 function inspect(value,label){
  if(Array.isArray(value)){value.forEach((item,i)=>inspect(item,label+'['+i+']'));return;}
  if(value&&typeof value==='object'){for(const [key,item]of Object.entries(value))inspect(item,label+'.'+key);return;}
  if(typeof value!=='string')throw Error('Invalid runtime audio reference: '+label);
  const relative=safeRelative(value);
  if(!relative.startsWith('audio/'))throw Error('Unsafe runtime audio path: '+value);
  const file=plainPath(outputRoot,relative);
  if(!fs.existsSync(file))throw Error('Missing runtime audio file: '+relative+' ('+label+')');
  assertNotSymlink(file);if(!fs.statSync(file).isFile()||fs.statSync(file).size===0)throw Error('Empty runtime audio file: '+relative);
  references.push(relative);
 }
 for(const name of AUDIO_MAPS)for(const [key,value]of Object.entries(context[name]||{}))inspect(value,name+'.'+key);
 const lessonCounts={'1':0,'2':0,'3':0,'4':0},seen=new Set();
 for(const lesson of Array.isArray(context.LESSONS)?context.LESSONS:[]){
  if(!lesson?.textbook||!Number.isInteger(lesson.book)||lesson.book<1||lesson.book>4||typeof lesson.id!=='string'||!lesson.id.trim()||!Array.isArray(lesson.paragraphs)||!lesson.paragraphs.some(paragraph=>typeof paragraph?.en==='string'&&paragraph.en.trim()))continue;
  const key=lesson.book+':'+lesson.id;if(seen.has(key))continue;seen.add(key);lessonCounts[lesson.book]++;
 }
 if(packaged?.manifest.lessonCounts)for(const book of [1,2,3,4])if(packaged.manifest.lessonCounts[book]!==lessonCounts[book])throw Error('Published runtime lesson-count contract mismatch for book '+book);
 return {total:references.length,unique:new Set(references).size,lessonCounts};
}
function folderBytes(directory){
 return fs.readdirSync(directory,{withFileTypes:true}).reduce((total,entry)=>total+(entry.isDirectory()?folderBytes(path.join(directory,entry.name)):fs.statSync(path.join(directory,entry.name)).size),0);
}

async function buildPages({sourceRoot=path.resolve(__dirname,'..'),outputRoot,cacheRoot,encoder=encodeWav,probe=probeMp3,concurrency=4}={}){
 sourceRoot=path.resolve(sourceRoot);outputRoot=path.resolve(outputRoot||path.join(sourceRoot,'_site'));
 assertNotSymlink(sourceRoot);if(!fs.statSync(sourceRoot).isDirectory())throw Error('Expected source directory');
 if(lstatIfPresent(outputRoot))throw Error('Output directory already exists; choose a new directory: '+outputRoot);
 if(inside(outputRoot,sourceRoot))throw Error('Output directory cannot contain or replace the source tree');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw Error('Encoding concurrency must be an integer from 1 to 8');
 checkParentChain(path.dirname(outputRoot));
 cacheRoot=path.resolve(cacheRoot||path.join(sourceRoot,'.cache','encoded-audio'));
 if(!inside(sourceRoot,cacheRoot)||inside(outputRoot,cacheRoot))throw Error('Unsafe delivery cache directory');
 checkParentChain(cacheRoot);
 const files=runtimeFiles(sourceRoot),destinations=new Set(),converted=Object.create(null);
 const plans=files.map(file=>{
  const wav=file.relative.startsWith('audio/')&&/\.wav$/i.test(file.relative);
  const destination=wav?'audio/optimized/'+file.relative.slice('audio/'.length).replace(/\.wav$/i,'.mp3'):file.relative;
  if(destinations.has(destination))throw Error('Publication destination collision: '+destination);
  destinations.add(destination);return {...file,wav,destination};
 });
 if(!destinations.has('index.html'))throw Error('Source index.html is missing');
 fs.mkdirSync(outputRoot,{recursive:true});fs.mkdirSync(cacheRoot,{recursive:true});
 const conversions={count:0,cacheHits:0,sourceBytes:0,encodedBytes:0},profileHash=hash(JSON.stringify(PROFILE));
 let existingMp3Files=0,encoderVersion=null;
 const inFlight=new Map();
 async function derivative(source){
  // Keep filenames short enough for ordinary Windows paths; metadata still
  // verifies both complete SHA-256 values before a derivative is reused.
  const sourceHash=hash(fs.readFileSync(source)),key=sourceHash+'-'+profileHash.slice(0,12);
  if(inFlight.has(key))return {...await inFlight.get(key),reused:true};
  const operation=(async()=>{
   const cacheFile=path.join(cacheRoot,key+'.mp3'),metaFile=path.join(cacheRoot,key+'.json');let reused=false;
   const cachedStat=lstatIfPresent(cacheFile),metaStat=lstatIfPresent(metaFile);
   if(cachedStat?.isSymbolicLink()||metaStat?.isSymbolicLink())throw Error('Symbolic links are not allowed in encoded audio cache');
   if(cachedStat&&metaStat){
    assertNotSymlink(cacheFile);assertNotSymlink(metaFile);
    try{const metadata=JSON.parse(fs.readFileSync(metaFile,'utf8'));if(metadata.sourceHash===sourceHash&&metadata.profileHash===profileHash&&metadata.encodedHash===hash(fs.readFileSync(cacheFile))){await verifyEncoding(cacheFile,probe);reused=true;}}catch(error){if(/symbolic/i.test(error.message))throw error;}
   }
   if(!reused){
    const temporary=path.join(cacheRoot,key+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,12)+'.mp3');
    try{
     await encoder({input:source,output:temporary,profile:PROFILE});
     const details=await verifyEncoding(temporary,probe),encodedHash=hash(fs.readFileSync(temporary));
     if(lstatIfPresent(cacheFile)){assertNotSymlink(cacheFile);fs.unlinkSync(cacheFile);}
     if(lstatIfPresent(metaFile))assertNotSymlink(metaFile);
     fs.renameSync(temporary,cacheFile);fs.writeFileSync(metaFile,JSON.stringify({sourceHash,profileHash,encodedHash,details})+'\n');
    }catch(error){if(fs.existsSync(temporary)){assertNotSymlink(temporary);fs.unlinkSync(temporary);}throw Error('Audio conversion failed for '+slash(path.relative(sourceRoot,source))+': '+error.message,{cause:error});}
   }
   return {cacheFile,reused};
  })();
  inFlight.set(key,operation);return operation;
 }
 let cursor=0,failure=null;
 async function worker(){
  while(!failure&&cursor<plans.length){
   const plan=plans[cursor++];
   try{
    const source=plainPath(sourceRoot,plan.relative),destination=plainPath(outputRoot,plan.destination);fs.mkdirSync(path.dirname(destination),{recursive:true});
    if(!plan.wav){fs.copyFileSync(source,destination);if(plan.relative.startsWith('audio/')&&/\.mp3$/i.test(plan.relative))existingMp3Files++;continue;}
    const {cacheFile,reused}=await derivative(source);fs.copyFileSync(cacheFile,destination);converted[plan.relative]=plan.destination;
    conversions.count++;conversions.cacheHits+=Number(reused);conversions.sourceBytes+=plan.size;conversions.encodedBytes+=fs.statSync(destination).size;
   }catch(error){failure=failure||error;}
  }
 }
 await Promise.all(Array.from({length:concurrency},()=>worker()));if(failure)throw failure;
 if(encoder===encodeWav&&conversions.count){const {stdout}=await run('ffmpeg',['-version'],{maxBuffer:1024*1024});encoderVersion=stdout.split(/\r?\n/)[0];}
 fs.writeFileSync(path.join(outputRoot,'delivery-audio.js'),mapperSource(converted));
 // Validate the actual ordered source bootstrap and converted audio before
 // replacing the published HTML with packages. The live app is never run by
 // this inspection; its exact source remains the final packaged script.
 const audioReferences=inspectAudioReferences(outputRoot),runtime=bundleRuntime({outputRoot,lessonCounts:audioReferences.lessonCounts}),sourceBytes=files.reduce((total,file)=>total+file.size,0),baseBytes=folderBytes(outputRoot);
 const report={version:1,profile:PROFILE,encoderVersion,sourceBytes,publishedBytes:baseBytes,savedBytes:sourceBytes-baseBytes,definition:'Source counts runtime candidate files only; published size includes this report. Repository originals and history are unchanged.',sourceFiles:files.length,existingMp3Files,conversions,audioReferences,runtime};
 let json='';for(let i=0;i<12;i++){json=JSON.stringify(report,null,2)+'\n';const size=baseBytes+Buffer.byteLength(json);if(size===report.publishedBytes)break;report.publishedBytes=size;report.savedBytes=sourceBytes-size;}
 json=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(path.join(outputRoot,'delivery-report.json'),json);
 if(folderBytes(outputRoot)!==report.publishedBytes)throw Error('Delivery byte report did not converge');
 return report;
}

if(require.main===module){
 const args=process.argv.slice(2);let outputRoot;
 for(let i=0;i<args.length;i++){if(args[i]==='--out'&&args[i+1])outputRoot=args[++i];else throw Error('Usage: node dev/build-pages-site.cjs [--out NEW_DIRECTORY]');}
 buildPages({outputRoot}).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={buildPages,mapperSource,inspectAudioReferences,PROFILE};
