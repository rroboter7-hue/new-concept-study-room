'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const integrity=bytes=>'sha384-'+crypto.createHash('sha384').update(bytes).digest('base64');

function attribute(tag,name){
 const match=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\'])([\\s\\S]*?)\\1','i'));
 return match?match[2]:null;
}
function assetPath(root,value){
 if(typeof value!=='string'||!value||/[\\\0\r\n]/.test(value)||/^[a-z][\w+.-]*:|^\//i.test(value))throw Error('Unsafe runtime asset: '+value);
 let relative;try{relative=decodeURIComponent(value.split(/[?#]/)[0]);}catch{throw Error('Unsafe runtime asset encoding: '+value);}
 if(/[\\\0\r\n]/.test(relative)||relative.split('/').some(part=>!part||part==='.'||part==='..')||relative.includes('/'))throw Error('Unsafe or escaping runtime asset: '+value);
 const target=path.join(root,relative);
 let stat;try{stat=fs.lstatSync(target);}catch(error){if(error.code==='ENOENT')throw Error('Missing runtime bundle asset: '+relative);throw error;}
 if(stat.isSymbolicLink()||!stat.isFile())throw Error('Runtime bundle asset must be a plain file: '+relative);
 return {name:relative,source:fs.readFileSync(target,'utf8')};
}
function contiguousGroups(entries,count){
 const groups=[];let cursor=0;
 while(cursor<entries.length){
  const remaining=entries.length-cursor,slots=Math.min(count-groups.length,remaining);
  if(slots===1){groups.push(entries.slice(cursor));break;}
  const total=entries.slice(cursor).reduce((sum,entry)=>sum+Buffer.byteLength(entry.source),0),target=total/slots;
  let end=cursor+1,size=Buffer.byteLength(entries[cursor].source),latest=entries.length-(slots-1);
  while(end<latest){const next=Buffer.byteLength(entries[end].source);if(Math.abs(target-size)<=Math.abs(target-size-next))break;size+=next;end++;}
  groups.push(entries.slice(cursor,end));cursor=end;
 }
 return groups;
}
function publish(root,kind,extension,source,files,extra={}){
 const bytes=Buffer.from(source,'utf8'),src='runtime-'+kind+'-'+hash(bytes).slice(0,20)+'.'+extension;
 const target=path.join(root,src);
 if(fs.existsSync(target)){const stat=fs.lstatSync(target);if(stat.isSymbolicLink()||!stat.isFile()||!fs.readFileSync(target).equals(bytes))throw Error('Runtime package path collision: '+src);}
 else fs.writeFileSync(target,bytes,{flag:'wx'});
 return {...extra,src,files,bytes:bytes.length,integrity:integrity(bytes)};
}
function combinedCSS(entries){
 const sections=entries.map(entry=>{
  let source=entry.source.replace(/^\uFEFF/,'').replace(/^\s*@charset\s+["']UTF-8["']\s*;/i,'');
  // Moving imports beneath preceding rules silently disables them. A future
  // imported stylesheet must be resolved explicitly instead of being corrupted.
  const withoutComments=source.replace(/\/\*[\s\S]*?\*\//g,'');
  if(/@import\b/i.test(withoutComments))throw Error('CSS @import is not supported in runtime bundles: '+entry.name);
  if(/@charset\b/i.test(withoutComments))throw Error('Unsupported CSS charset in runtime bundle: '+entry.name);
  return '/* '+entry.name+' */\n'+source+'\n';
 });
 return '@charset "UTF-8";\n'+sections.join('\n');
}
function bundleRuntime({outputRoot,loaderSource,lessonCounts}={}){
 if(!outputRoot)throw Error('Runtime bundle outputRoot is required');
 const root=path.resolve(outputRoot),index=path.join(root,'index.html'),original=fs.readFileSync(index,'utf8');
 const scripts=[],styles=[],scriptTags=[],styleTags=[],names=new Set();
 for(const match of original.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)){
  const tag=match[0],open=tag.slice(0,tag.indexOf('>')+1),src=attribute(open,'src');
  if(src===null){if(tag.replace(/^<script\b[^>]*>|<\/script\s*>$/gi,'').trim())throw Error('Inline runtime scripts require explicit ordering before bundling');continue;}
  const type=attribute(open,'type');
  if(type&&!/^(?:text|application)\/javascript$/i.test(type)||/\basync(?:\s|=|>)/i.test(open)||!/\bdefer(?:\s|=|>)/i.test(open))throw Error('Unsupported runtime script loading mode: '+src);
  const entry=assetPath(root,src);if(!/\.js$/i.test(entry.name))throw Error('Unsupported runtime script asset: '+src);
  if(names.has(entry.name))throw Error('Duplicate runtime script: '+entry.name);names.add(entry.name);scripts.push(entry);scriptTags.push(tag);
 }
 for(const match of original.matchAll(/<link\b[^>]*>/gi)){
  const tag=match[0],rel=attribute(tag,'rel');if(!rel||!rel.toLowerCase().split(/\s+/).includes('stylesheet'))continue;
  const href=attribute(tag,'href'),media=attribute(tag,'media');
  if(media&&media.toLowerCase()!=='all'||/\bdisabled(?:\s|=|>)/i.test(tag)||rel.toLowerCase().includes('alternate'))throw Error('Unsupported runtime stylesheet mode: '+href);
  const entry=assetPath(root,href);if(!/\.css$/i.test(entry.name))throw Error('Unsupported runtime stylesheet asset: '+href);
  styles.push(entry);styleTags.push(tag);
 }
 if(!scripts.length)throw Error('No runtime scripts were found');
 const build=attribute(original.match(/<meta\b[^>]*\bname\s*=\s*["']study-build["'][^>]*>/i)?.[0]||'','content')||'';
 const manifest={version:1,build,scripts:[],styles:[]};
 if(lessonCounts!==undefined&&lessonCounts!==null){
  if(typeof lessonCounts!=='object'||Array.isArray(lessonCounts))throw Error('Invalid runtime lesson-count contract');
  manifest.lessonCounts={};for(const book of [1,2,3,4]){const count=lessonCounts[book];if(!Number.isInteger(count)||count<0)throw Error('Invalid runtime lesson count for book '+book);manifest.lessonCounts[book]=count;}
 }
 for(const group of contiguousGroups(scripts,6)){
  const data=JSON.stringify(group),id=hash(data),source='/* Generated classic-script package; boundaries and source text are preserved. */\nwindow.StudyStartup.install('+JSON.stringify(id)+','+data+');\n';
  manifest.scripts.push(publish(root,'scripts','js',source,group.map(entry=>entry.name),{id}));
 }
 if(styles.length)manifest.styles.push(publish(root,'styles','css',combinedCSS(styles),styles.map(entry=>entry.name)));
 // Use the checked-in loader implementation even for isolated build fixtures.
 // It owns startup UI and is deliberately inlined so it cannot itself be a
 // missing request that leaves users with an inert page.
 const loaderFile=path.resolve(__dirname,'../runtime-loader.js'),loader=require(loaderFile);
 const rendered=loader.renderHTML(manifest,loaderSource===undefined?fs.readFileSync(loaderFile,'utf8'):loaderSource);
 if(!rendered||typeof rendered.head!=='string'||typeof rendered.bodyStart!=='string'||typeof rendered.bodyEnd!=='string')throw Error('Invalid runtime startup HTML');
 let html=original;for(const tag of [...scriptTags,...styleTags])html=html.replace(tag,'');
 if(!/<\/head\s*>/i.test(html))html='<head></head>'+html;
 html=html.replace(/<\/head\s*>/i,rendered.head+'</head>');
 if(/<body\b[^>]*>/i.test(html))html=html.replace(/<body\b[^>]*>/i,match=>match+rendered.bodyStart);
 else html+='<body>'+rendered.bodyStart+'</body>';
 html=html.replace(/<\/body\s*>/i,rendered.bodyEnd+'</body>');
 fs.writeFileSync(index,html);
 return manifest;
}

function readPackagedScripts({outputRoot,html}={}){
 const root=path.resolve(outputRoot),marker='\nwindow.StudyStartup.start(';
 let manifest;
 // Parse the final JSON argument only. Do not run the inline loader or app in
 // order to inspect an artifact: both have real browser-side effects.
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){
  const at=match[1].lastIndexOf(marker);if(at<0)continue;
  const tail=match[1].slice(at+marker.length).trim();
  if(!tail.endsWith(');'))throw Error('Invalid packaged runtime manifest');
  try{manifest=JSON.parse(tail.slice(0,-2));}catch{throw Error('Invalid packaged runtime manifest JSON');}
 }
 if(!manifest||manifest.version!==1||!Array.isArray(manifest.scripts)||!manifest.scripts.length||!Array.isArray(manifest.styles))throw Error('Published runtime manifest was not found or is invalid');
 const verified=[];
 function verify(asset,kind,extension){
  if(!asset||typeof asset.src!=='string'||!new RegExp('^runtime-'+kind+'-[a-f0-9]{20}\\.'+extension+'$').test(asset.src)||!Number.isInteger(asset.bytes)||asset.bytes<1||typeof asset.integrity!=='string')throw Error('Invalid runtime package descriptor');
  const file=path.join(root,asset.src),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile())throw Error('Runtime package must be a plain file: '+asset.src);
  const bytes=fs.readFileSync(file);
  if(bytes.length!==asset.bytes)throw Error('Runtime package size integrity mismatch: '+asset.src);
  if(asset.integrity!==integrity(bytes)||asset.src!=='runtime-'+kind+'-'+hash(bytes).slice(0,20)+'.'+extension)throw Error('Runtime package hash integrity mismatch: '+asset.src);
  return bytes;
 }
 // Verify every package before evaluating even a registration wrapper.
 for(const asset of manifest.scripts)verified.push({asset,bytes:verify(asset,'scripts','js')});
 for(const asset of manifest.styles)verify(asset,'styles','css');
 const entries=[],names=new Set();
 for(const {asset,bytes}of verified){
  if(typeof asset.id!=='string'||!/^[a-f0-9]{64}$/.test(asset.id)||!Array.isArray(asset.files)||!asset.files.length)throw Error('Invalid runtime script package descriptor');
  let calls=0,registered;
  const context={StudyStartup:{install(id,next){calls++;if(calls!==1||id!==asset.id||!Array.isArray(next)||hash(JSON.stringify(next))!==asset.id)throw Error('Runtime script package ID integrity mismatch: '+asset.src);registered=next;}}};context.window=context;
  vm.runInNewContext(bytes.toString('utf8'),context,{filename:asset.src,timeout:30000});
  if(calls!==1||registered.length!==asset.files.length)throw Error('Runtime script package entry count mismatch: '+asset.src);
  for(let i=0;i<registered.length;i++){
   const entry=registered[i];
   if(!entry||typeof entry.name!=='string'||entry.name!==asset.files[i]||typeof entry.source!=='string'||names.has(entry.name))throw Error('Runtime script package entry integrity mismatch: '+asset.src);
   names.add(entry.name);entries.push({name:entry.name,source:entry.source});
  }
 }
 return {manifest,entries};
}
module.exports={bundleRuntime,readPackagedScripts};
