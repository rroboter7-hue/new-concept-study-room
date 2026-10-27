'use strict';
// Split trusted local text-library data without changing any source field or line.
// Running again against the generated catalog produces the same files and hashes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function readDocument(root,dataUrl){
 if(typeof dataUrl!=='string'||!dataUrl||/^[a-z]+:|^[/\\]|[\\?#]/i.test(dataUrl))throw new Error('Text documents must use a project-relative JSON path.');
 const absolute=path.resolve(root,dataUrl);
 if(!absolute.startsWith(path.resolve(root)+path.sep)||path.extname(absolute)!=='.json')throw new Error('Text document leaves the project root: '+dataUrl);
 const bytes=fs.readFileSync(absolute),document=JSON.parse(bytes.toString('utf8'));
 if(!Array.isArray(document.sections))throw new Error('Text document has no sections: '+dataUrl);
 return {file:dataUrl,bytes,sections:document.sections};
}

function readLibrary(sourceFile){
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(sourceFile,'utf8'),scope,{filename:sourceFile,timeout:15_000});
 if(!Array.isArray(scope.window.TEXT_LIBRARY))throw new Error('Source does not provide a text library.');
 return scope.window.TEXT_LIBRARY.map(row=>{
  if(Array.isArray(row.sections))return row;
  const sections=row.dataUrl?readDocument(path.dirname(sourceFile),row.dataUrl).sections:[];
  if(row.sectionCount!==sections.length)throw new Error('Text section count mismatch: '+row.id);
  const restored={};for(const [key,value]of Object.entries(row)){if(key==='sectionCount')restored.sections=sections;else if(key!=='dataUrl')restored[key]=value;}return restored;
 });
}

function extract({outputRoot=path.resolve(__dirname,'..'),sourceFile=path.join(outputRoot,'text-library.js')}={}){
 const library=readLibrary(sourceFile),directory=path.join(outputRoot,'text-library-data'),ids=new Set(),files=[];
 fs.mkdirSync(directory,{recursive:true});
 const catalog=library.map(row=>{
  if(!/^[a-z0-9-]+$/i.test(row.id)||ids.has(row.id)||!Array.isArray(row.sections))throw new Error('Invalid text document: '+row.id);ids.add(row.id);
  let dataUrl;
  if(row.sections.length){const bytes=Buffer.from(JSON.stringify({sections:row.sections})+'\n');dataUrl='text-library-data/'+row.id+'.'+sha(bytes).slice(0,12)+'.json';fs.writeFileSync(path.join(outputRoot,dataUrl),bytes);files.push(dataUrl);}
  const descriptor={};for(const [key,value]of Object.entries(row)){if(key==='sections'){descriptor.sectionCount=value.length;if(dataUrl)descriptor.dataUrl=dataUrl;}else descriptor[key]=value;}return descriptor;
 });
 const source='/* Text document metadata only. Sections load on demand from content-addressed JSON. */\nwindow.TEXT_LIBRARY = '+JSON.stringify(catalog)+';\n';
 fs.writeFileSync(path.join(outputRoot,'text-library.js'),source);
 return {documents:catalog.length,sections:library.reduce((n,row)=>n+row.sections.length,0),files,catalogBytes:Buffer.byteLength(source)};
}

module.exports={extract,readLibrary,readDocument};
if(require.main===module)console.log(JSON.stringify(extract({sourceFile:process.argv[2]||path.resolve(__dirname,'../text-library.js')}),null,2));
