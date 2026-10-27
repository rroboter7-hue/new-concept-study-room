'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const originals=[
 ['4be758839e0f6e4b',73,'b7e99c7984836e697962b3a38c93b4d7db21c1cb491f3f750faba2478abd772d'],
 ['eef57c5b3d1610c5',97,'dad9f9e41cdc6f2378082fc2f19200fa6112cb3041c794318347b9f85f581fe9'],
 ['fa48747323fc53ae',41,'6e7063c959c9c47527cd9f97575c0d281db7da9264fd5493b93168d6e86fa9ef'],
 ['140ed4ab10acacb9',1,'b829a2b9621a581b16c57eaa97cdc199b3b007cdf7a72a44413395ed973ebe62'],
 ['f4cefe7e62d44321',1,'646eb4df3a25d3ff43b4b69f4bbbe88655272c163277761cc35a55999ee32f50'],
 ['63de957c3ab2bad6',1,'b1c060ca62c9ea8e1c009649af66dd8a1bb721c4d737e5164cf1081db40f6e5f'],
 ['8160be3cf9fa3485',1,'456b6a144d5da61a9e932b8ac14457035e116968ec5f71de869e4156527f72b1'],
 ['1917f5bc7eb81a23',97,'6939bb8c348f13543be32c4a2913eb1463acad1e3c4f38a3a957ec1ab46d0ab7'],
 ['0b92dea40ee26216',72,'bb84dc277a80f057772dbdc4b1c5d63e93da35687165848d35e3cacbf1483465'],
 ['cebcdf4e922d21aa',0,'cb0743bc9f83bff9da218cfb2be117d38820d3a54f8edd3e610cb75cc5d8a2b0']
];
function catalogue(){const c={};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'text-library.js'),'utf8'),c);return c.TEXT_LIBRARY;}
const doc=(id='one')=>({id,title:'Notes '+id,book:2,pages:4,source:'user-provided-pdf-text',hasFullLessonText:false,sections:[{id:id+'-intro',title:'Introduction',pageStart:1,pageEnd:1,lines:['说明'],english:[]},{id:id+'-lesson',title:'A parcel',pageStart:2,pageEnd:3,lines:['A turquoise parcel arrived.'],english:['A turquoise parcel arrived.'],vocabulary:[],grammar:[],usage:[],keyPoints:[]}]});
function descriptor(d){return {id:d.id,title:d.title,book:d.book,pages:d.pages,source:d.source,sectionCount:d.sections.length,defaultSectionIndex:1,dataUrl:'text-data/'+d.id+'.json?sha256='+hash(JSON.stringify(d)+'\n'),contentSha256:hash(JSON.stringify(d)+'\n')};}
function setup(data=[descriptor(doc())]){
 const handlers={},requests=[],timers=new Map(),container={innerHTML:''},lessons=[],events=[];let timerId=0,active=true;
 const document={addEventListener:(kind,fn)=>(handlers[kind]??=[]).push(fn)};
 const c={document,URL,location:{href:'https://study.example/project/',origin:'https://study.example'},AbortController,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url:String(url),options,resolve,reject}))};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'text-reader.js'),'utf8'),c);
 const escape=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const reader=new c.TextStudyLibrary({data,container,isActive:()=>active,escapeHTML:escape,wordHTML:escape,icon:()=>'',output:{setLesson:l=>lessons.push(l),render:()=>''},beforeChange:()=>events.push('flush'),onBack:()=>{container.innerHTML='library';events.push('back');},onLessonSelected:()=>{},toast:message=>events.push(message)});
 const respond=(index,value=doc())=>requests[index].resolve({ok:true,json:async()=>value});
 const action=name=>{const button={dataset:{textAction:name}};const event={target:{closest:()=>button}};for(const fn of handlers.click||[])fn(event);};
 return {c,reader,data,requests,timers,container,lessons,events,respond,action,setActive:x=>active=x};
}

test('small startup catalogue retains exact source documents and every PDF section in lazy JSON',()=>{
 const rows=catalogue();assert.equal(rows.length,10);assert(fs.statSync(path.join(root,'text-library.js')).size<12000,'startup does not parse full source notes');
 for(const [id,count,sha]of originals){const d=rows.find(x=>x.id===id);assert(d,id);assert.equal(Object.hasOwn(d,'sections'),false,id+' stays unloaded');assert.equal(d.sectionCount,count);assert.match(d.dataUrl,new RegExp('^text-data/'+id+'\\.json\\?sha256=[a-f0-9]{64}$'));
  const bytes=fs.readFileSync(path.join(root,d.dataUrl.split('?')[0])),full=JSON.parse(bytes);assert.equal(hash(bytes),d.contentSha256);assert.equal(hash(JSON.stringify(full)),sha,id+' exact source object');assert.equal(full.sections.length,count);assert.equal(full.title,d.title);assert.equal(full.pages,d.pages);assert.equal(full.source,d.source);
 }
 const blank=rows.find(d=>d.noText);assert.equal(blank.sectionCount,0);assert.match(blank.emptyReason,/空白/);
});

test('opening one document loads one file and repeated opens share one pending request and cache',async()=>{
 const h=setup([descriptor(doc('one')),descriptor(doc('two'))]);const a=h.reader.open('one'),b=h.reader.open('one');assert.equal(h.requests.length,1,'same pending document is fetched once');h.respond(0);await Promise.all([a,b]);assert.equal(h.reader.section,1);assert.match(h.container.innerHTML,/A turquoise parcel arrived/);assert.equal(h.data[1].sections,undefined);
 await h.reader.open('one');assert.equal(h.requests.length,1,'loaded note is reused');assert.equal(h.timers.size,0);
});

test('failed and timed-out loads offer a direct retry and never poison the pending cache',async()=>{
 const h=setup();const first=h.reader.open('one');h.requests[0].reject(Error('offline'));await first;assert.match(h.container.innerHTML,/data-text-action="retry"/);h.action('retry');assert.equal(h.requests.length,2);h.respond(1);await new Promise(resolve=>setImmediate(resolve));assert.match(h.container.innerHTML,/A turquoise parcel arrived/);
 const next=setup(),waiting=next.reader.open('one');for(const timer of [...next.timers.values()])timer();await waiting;assert.match(next.container.innerHTML,/重新加载|重试/);assert.equal(next.data[0].sections,undefined);assert(next.requests[0].options.signal.aborted,'timeout aborts the request');const retry=next.reader.open('one');assert.equal(next.requests.length,2);next.respond(1);await retry;assert.match(next.container.innerHTML,/A turquoise parcel arrived/);
});

test('late responses never overwrite a newer document or a returned library view',async()=>{
 const h=setup([descriptor(doc('one')),descriptor(doc('two'))]),old=h.reader.open('one'),fresh=h.reader.open('two');h.respond(1,doc('two'));await fresh;h.respond(0,doc('one'));await old;assert.equal(h.reader.doc.id,'two');assert.match(h.container.innerHTML,/Notes two/);
 const returned=setup(),pending=returned.reader.open('one');returned.action('back');returned.respond(0);await pending;assert.equal(returned.container.innerHTML,'library');assert.equal(returned.reader.doc,null);
 const inactive=setup(),paused=inactive.reader.open('one');inactive.setActive(false);inactive.requests[0].reject(Error('offline'));await paused;assert.doesNotMatch(inactive.container.innerHTML,/暂时未能加载/,'inactive failure does not repaint another app view');
});

test('loader rejects external URLs, cross-document data and malformed source rows',async()=>{
 const external=setup([{...descriptor(doc()),dataUrl:'https://other.example/private.json'}]);await external.reader.open('one');assert.equal(external.requests.length,0);assert.match(external.container.innerHTML,/重试|重新加载/);
 for(const invalid of [{...doc(),id:'other'},{...doc(),sections:[{title:'Bad row',lines:'not-an-array'}]}]){const h=setup(),pending=h.reader.open('one');h.respond(0,invalid);await pending;assert.equal(h.data[0].sections,undefined);assert.doesNotMatch(h.container.innerHTML,/A turquoise parcel arrived/);assert.match(h.container.innerHTML,/重试|重新加载/);}
});

test('blank source documents remain usable and explicit section indexes are bounded',async()=>{
 const full={...doc(),sections:[],noText:true,emptyReason:'空白书写纸'},d={...descriptor(full),defaultSectionIndex:0};const h=setup([d]),pending=h.reader.open('one',999);h.respond(0,full);await pending;assert.match(h.container.innerHTML,/没有可提取的文字层/);assert.equal(h.reader.section,0);
 const normal=setup(),opening=normal.reader.open('one',999);normal.respond(0);await opening;assert.equal(normal.reader.section,1,'out-of-range selection returns to the first useful section');
});

test('dictionary offline corpus extraction includes and hashes lazily loaded note text',()=>{
 const {collectProjectWords}=require('../dev/build-bilingual-dictionary.cjs'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'lazy-notes-corpus-'));
 try{fs.mkdirSync(path.join(temp,'text-data'));const full=doc(),bytes=JSON.stringify(full)+'\n';fs.writeFileSync(path.join(temp,'text-data','one.json'),bytes);fs.writeFileSync(path.join(temp,'index.html'),'<script defer src="data.js"></script>');fs.writeFileSync(path.join(temp,'data.js'),'window.LESSONS=[];window.TEXT_LIBRARY='+JSON.stringify([descriptor(full)])+';');const result=collectProjectWords(temp);assert(result.words.has('turquoise'),'note-only vocabulary remains in future dictionary builds');assert(result.inputs.some(x=>x.file==='text-data/one.json'&&x.sha256===hash(bytes)));
 fs.writeFileSync(path.join(temp,'text-data','one.json'),JSON.stringify({...full,title:'Tampered'}));assert.throws(()=>collectProjectWords(temp),/hash|digest|integrity|checksum/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
