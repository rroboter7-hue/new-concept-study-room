'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function courseAssets(root,manifest){
 const entries=[...manifest.scripts,...manifest.styles].map(asset=>({src:asset.src,integrity:asset.integrity}));
 const inlineCovers=manifest.scripts.some(asset=>Array.isArray(asset.files)&&asset.files.includes('book-covers.js'));
 if(!inlineCovers)for(let book=1;book<=4;book++){const src='images/books/book-'+book+'.webp';if(fs.existsSync(path.join(root,src)))entries.push({src});}
 for(const folder of ['text-data','recall-data']){
  const directory=path.join(root,folder);if(!fs.existsSync(directory))continue;
  for(const name of fs.readdirSync(directory).sort())if(/^[a-z0-9-]+\.json$/.test(name))entries.push({src:folder+'/'+name});
 }
 const descriptors=entries.map(entry=>{
  const target=path.join(root,entry.src),stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Course cache requires a plain file: '+entry.src);
  const bytes=fs.readFileSync(target),descriptor={...entry,bytes:bytes.length,sha256:hash(bytes)};
  if(/^recall-data\//.test(entry.src))descriptor.build=hash(bytes.toString('utf8').trimEnd()).slice(0,16);
  return descriptor;
 });
 if(descriptors.length>40||descriptors.reduce((sum,entry)=>sum+entry.bytes,0)>48*1024*1024)throw Error('Course cache exceeded bounded text/practice budget');
 return descriptors;
}
function prepare({root,manifest,original,loaderSource}){
 const workerSource=fs.readFileSync(path.resolve(__dirname,'../course-cache-worker.js'),'utf8'),clientSource=fs.readFileSync(path.resolve(__dirname,'../course-cache-client.js'),'utf8');
 const assets=courseAssets(root,manifest),version=hash(JSON.stringify({original,loaderSource,clientSource,workerSource,assets}));
 manifest.courseCache={worker:'course-cache-worker.js',version};
 return {assets,version,workerSource};
}
function publish({root,html,prepared}){
 const bytes=Buffer.from(html),config={version:prepared.version,index:{src:'index.html',bytes:bytes.length,sha256:hash(bytes)},assets:prepared.assets};
 const source=prepared.workerSource+'\nself.StudyCourseCache(self,'+JSON.stringify(config)+');\n';
 fs.writeFileSync(path.join(root,'course-cache-worker.js'),source);
 return config;
}
module.exports={prepare,publish,courseAssets};
