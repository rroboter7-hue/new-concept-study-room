'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const readerSource=fs.readFileSync(path.join(root,'text-reader.js'),'utf8');
function catalog(file=path.join(root,'text-library.js')){const scope={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),scope);return JSON.parse(JSON.stringify(scope.window.TEXT_LIBRARY));}
function restored(directory,rows){return rows.map(row=>{const sections=row.dataUrl?JSON.parse(fs.readFileSync(path.join(directory,row.dataUrl),'utf8')).sections:[];const result={};for(const [key,value]of Object.entries(row)){if(key==='sectionCount')result.sections=sections;else if(key!=='dataUrl')result[key]=value;}return result;});}
function temporary(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zhixin-text-lazy-'));t.after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});});return directory;}

test('the initial text catalog contains metadata only and nine content-addressed documents retain all 384 original sections',()=>{
 const rows=catalog();assert.equal(rows.length,10);assert.ok(rows.every(row=>!Object.hasOwn(row,'sections')),'initial catalog must not eagerly parse sections');
 const documents=rows.filter(row=>row.dataUrl);assert.equal(documents.length,9);assert.equal(rows.reduce((n,row)=>n+row.sectionCount,0),384);
 for(const row of documents){assert.match(row.dataUrl,new RegExp('^text-library-data/'+row.id+'\\.[a-f0-9]{12}\\.json$'));const bytes=fs.readFileSync(path.join(root,row.dataUrl));assert.equal(row.dataUrl.split('.').at(-2),sha(bytes).slice(0,12));assert.equal(JSON.parse(bytes).sections.length,row.sectionCount);}
 assert.equal(fs.readdirSync(path.join(root,'text-library-data')).filter(file=>file.endsWith('.json')).length,9);
 const paper=rows.find(row=>row.id==='cebcdf4e922d21aa');assert.equal(paper.noText,true);assert.equal(paper.sectionCount,0);assert.equal(paper.dataUrl,undefined);
 const json=JSON.stringify(restored(root,rows));assert.equal(Buffer.byteLength(json),2654532);assert.equal(sha(json),'431c1841799bf9b50c3cc8974d7af7e4e220549dbcab3ea8b0b1de3478cb1df7','every original field, line and section must survive reconstruction');
});

test('the extractor deterministically rebuilds a catalog from inline and already split trusted sources',t=>{
 const extractorFile=path.join(root,'dev/extract-text-library.cjs');assert.ok(fs.existsSync(extractorFile),'an explicit deterministic extractor is shipped');const {extract}=require(extractorFile);
 const directory=temporary(t),sourceFile=path.join(directory,'original.js'),outputRoot=path.join(directory,'published');fs.mkdirSync(outputRoot);
 const original=[{id:'fixture',title:'Original title',book:2,pages:1,sections:[{id:'one',lines:['Exact 原文.'],english:['Exact original.']}]},{id:'paper',title:'Paper',book:0,sections:[],noText:true,emptyReason:'Empty 原文'}];
 fs.writeFileSync(sourceFile,'window.TEXT_LIBRARY = '+JSON.stringify(original)+';\n');extract({sourceFile,outputRoot});const first=fs.readFileSync(path.join(outputRoot,'text-library.js'),'utf8'),files=fs.readdirSync(path.join(outputRoot,'text-library-data'));
 assert.deepEqual(restored(outputRoot,catalog(path.join(outputRoot,'text-library.js'))),original);
 extract({outputRoot});assert.equal(fs.readFileSync(path.join(outputRoot,'text-library.js'),'utf8'),first);assert.deepEqual(fs.readdirSync(path.join(outputRoot,'text-library-data')),files);
});

test('the offline dictionary corpus explicitly reads lazy text JSON without losing any original vocabulary',t=>{
 const builder=require('../dev/build-bilingual-dictionary.cjs'),directory=temporary(t);fs.mkdirSync(path.join(directory,'text-library-data'));
 fs.writeFileSync(path.join(directory,'index.html'),'<script src="data.js"></script>');fs.writeFileSync(path.join(directory,'data.js'),'window.TEXT_LIBRARY=[{id:"fixture",dataUrl:"text-library-data/fixture.json"}];');
 fs.writeFileSync(path.join(directory,'text-library-data/fixture.json'),JSON.stringify({sections:[{lines:['An orchard grows quietly.']}]}));
 const sample=builder.collectProjectWords(directory);assert.ok(sample.words.has('orchard'),'a word that exists only in lazy JSON is included');assert.ok(sample.inputs.some(input=>input.file==='text-library-data/fixture.json'));
 const actual=builder.collectProjectWords(root),words=[...actual.words].sort();assert.equal(words.length,11573);assert.equal(sha(JSON.stringify(words)),'5e30a9ff1f1138f647c6ec4c2c59775304d0a790ac6cfa9f41b1983a21f3a2ca');assert.equal(actual.inputs.filter(input=>input.file.startsWith('text-library-data/')).length,9);
});

const section=title=>({id:'one',title,pageStart:1,pageEnd:1,lines:[title+' original.'],english:[title+' original.'],vocabulary:[],grammar:[],usage:[],keyPoints:[]});
const descriptor=id=>({id,title:'Document '+id,book:2,sectionCount:1,dataUrl:'text-library-data/'+id+'.json'});
const response=title=>({ok:true,json:async()=>({sections:[section(title)]})});
function pending(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(fetcher,{data=['a','b','c','d'].map(descriptor)}={}){
 const events=[],handlers={},calls=[],selected=[],container={innerHTML:''};let active=true;
 const scope={console,URL,location:{href:'https://example.test/study/',origin:'https://example.test'},document:{addEventListener(type,fn){handlers[type]=fn;}},fetch:async(url,options)=>{const id=path.posix.basename(new URL(url).pathname,'.json');calls.push(id);return fetcher?fetcher(id,options):response(id.toUpperCase());}};scope.window=scope;vm.runInNewContext(readerSource,scope);
 const options={data,container,isActive:()=>active,beforeChange(){events.push('flush');},onBack(){container.innerHTML='<p>Library list</p>';events.push('back');},onLessonSelected(lesson){selected.push(lesson.id);events.push('selected');},output:{setLesson(){events.push('output');},render(){return '<p>Draft editor</p>';}},escapeHTML:String,wordHTML:String,icon:()=>'',toast(message){events.push(message);}};
 const reader=new scope.TextStudyLibrary(options);return {reader,data,container,events,calls,selected,setActive:value=>{active=value;},click(action){const target={dataset:{textAction:action},closest:()=>target};handlers.click({target});}};
}

test('constructing the reader performs no fetch and opening one document loads and renders only that document',async()=>{
 const h=harness();assert.deepEqual(h.calls,[]);await h.reader.open('a');assert.deepEqual(h.calls,['a']);assert.match(h.container.innerHTML,/A original\./);assert.equal(h.selected.at(-1),'note-a-one');assert.equal(Object.hasOwn(h.data[0],'sections'),false,'the shared catalog stays lightweight');
 await h.reader.open('a');assert.deepEqual(h.calls,['a'],'a recently viewed document reuses its sections');
});

test('a third document evicts the least recently read sections while the current document stays reusable',async()=>{
 const h=harness();await h.reader.open('a');await h.reader.open('b');await h.reader.open('a');await h.reader.open('c');await h.reader.open('a');assert.deepEqual(h.calls,['a','b','c']);await h.reader.open('b');assert.deepEqual(h.calls,['a','b','c','b'],'only two document bodies remain cached');
});

test('two opens of one pending document share its request and render only the latest selection',async()=>{
 const deferred=pending(),h=harness(()=>deferred.promise);const first=h.reader.open('a'),latest=h.reader.open('a');assert.deepEqual(h.calls,['a']);deferred.resolve(response('A'));await Promise.all([first,latest]);assert.equal(h.selected.length,1);assert.match(h.container.innerHTML,/A original/);
});

test('out-of-order document responses cannot reopen an older selection or evict the visible document',async()=>{
 const later=pending(),h=harness(id=>id==='c'?later.promise:response(id.toUpperCase()));await h.reader.open('a');await h.reader.open('b');const old=h.reader.open('c');await h.reader.open('a');later.resolve(response('C'));await old;assert.match(h.container.innerHTML,/A original/);assert.equal(h.reader.doc.id,'a');await h.reader.open('a');assert.deepEqual(h.calls,['a','b','c']);await h.reader.open('b');assert.deepEqual(h.calls,['a','b','c','b']);
});

test('returning to the library flushes a draft and ignores a late document response',async()=>{
 const deferred=pending(),h=harness(()=>deferred.promise);const loading=h.reader.open('a');h.events.length=0;h.click('back');assert.deepEqual(h.events,['flush','back']);deferred.resolve(response('A'));await loading;assert.equal(h.reader.doc,null);assert.equal(h.container.innerHTML,'<p>Library list</p>');assert.equal(h.selected.length,0);
});

test('leaving the library prevents both success and failure from overwriting another view',async()=>{
 for(const reject of [false,true]){const deferred=pending(),h=harness(()=>deferred.promise);const loading=h.reader.open('a');h.setActive(false);h.container.innerHTML='<p>Another view</p>';if(reject)deferred.reject(new Error('Unavailable'));else deferred.resolve(response('A'));await loading;assert.equal(h.container.innerHTML,'<p>Another view</p>');assert.equal(h.selected.length,0);}
});

test('a replaced loading panel stays closed even if the library becomes active again before the response arrives',async()=>{
 const deferred=pending(),h=harness(()=>deferred.promise);const loading=h.reader.open('a');h.setActive(false);h.container.innerHTML='<p>Library list</p>';h.setActive(true);deferred.resolve(response('A'));await loading;assert.equal(h.container.innerHTML,'<p>Library list</p>');assert.equal(h.selected.length,0);
});

test('failed and malformed documents remain retryable and an external data URL never fetches',async()=>{
 let attempt=0;const h=harness(()=>++attempt===1?Promise.reject(new Error('Unavailable')):attempt===2?{ok:true,json:async()=>({sections:null})}:response('Recovered'));
 await h.reader.open('a');assert.match(h.container.innerHTML,/未能加载/);await h.reader.open('a');assert.match(h.container.innerHTML,/未能加载/);await h.reader.open('a');assert.match(h.container.innerHTML,/Recovered original/);assert.deepEqual(h.calls,['a','a','a']);
 const external=harness(null,{data:[{...descriptor('remote'),dataUrl:'https://untrusted.test/book.json'}]});await external.reader.open('remote');assert.deepEqual(external.calls,[]);assert.match(external.container.innerHTML,/未能加载/);
});

test('inline fixtures still render without a request and every document transition flushes pending writing first',async()=>{
 const h=harness(null,{data:[{id:'inline',title:'Inline',book:1,sections:[section('Inline')]}]});await h.reader.open('inline');assert.deepEqual(h.calls,[]);assert.equal(h.events[0],'flush');assert.match(h.container.innerHTML,/Inline original/);h.events.length=0;h.click('tab');assert.equal(h.events[0],'flush');h.events.length=0;h.click('back');assert.deepEqual(h.events,['flush','back']);
});
