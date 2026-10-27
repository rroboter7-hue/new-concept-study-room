'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const readerSource=fs.readFileSync(path.join(root,'text-reader.js'),'utf8');

test('the combined lazy documents preserve every field and all 384 sections from the original source',()=>{
 const documents=require('../dev/split-text-library.cjs').documents(root),json=JSON.stringify(documents);
 assert.equal(documents.length,10);assert.equal(documents.reduce((n,doc)=>n+doc.sections.length,0),384);
 assert.equal(Buffer.byteLength(json),2654532);assert.equal(sha(json),'431c1841799bf9b50c3cc8974d7af7e4e220549dbcab3ea8b0b1de3478cb1df7');
});

const documentFor=id=>({id,title:'Notes '+id,book:2,pages:1,source:'user-provided-pdf-text',hasFullLessonText:false,sections:[{id:id+'-lesson',title:'Lesson '+id,pageStart:1,pageEnd:1,lines:[id.toUpperCase()+' original.'],english:[id.toUpperCase()+' original.'],vocabulary:[],grammar:[],usage:[],keyPoints:[]}]});
function descriptorFor(id){const {sections,...metadata}=documentFor(id),contentSha256=sha(JSON.stringify(documentFor(id)));return {...metadata,sectionCount:sections.length,defaultSectionIndex:0,dataUrl:'text-data/'+id+'.json?sha256='+contentSha256,contentSha256};}
const response=id=>({ok:true,json:async()=>documentFor(id)});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(fetcher,{frozen=false}={}){
 const data=['a','b','c','d'].map(descriptorFor);if(frozen)data.forEach(Object.freeze);
 const calls=[],selected=[],container={innerHTML:''};let active=true;
 const scope={console,URL,AbortController,setTimeout,clearTimeout,location:{href:'https://study.example/project/',origin:'https://study.example'},document:{addEventListener(){}},fetch:async(url,options)=>{const id=path.posix.basename(new URL(url).pathname,'.json');calls.push(id);return fetcher?fetcher(id,options):response(id);}};scope.window=scope;vm.runInNewContext(readerSource,scope);
 const reader=new scope.TextStudyLibrary({data,container,isActive:()=>active,beforeChange(){},onBack(){container.innerHTML='<p>Library list</p>';},onLessonSelected(lesson){selected.push(lesson.id);},output:{setLesson(){},render(){return '';}},escapeHTML:String,wordHTML:String,icon:()=>'',toast(){}});
 return {reader,data,container,calls,selected,setActive:value=>{active=value;}};
}

test('opening and caching a document works with immutable catalog descriptors and performs no startup fetch',async()=>{
 const h=harness(null,{frozen:true});assert.deepEqual(h.calls,[]);await h.reader.open('a');assert.deepEqual(h.calls,['a']);assert.match(h.container.innerHTML,/A original\./);assert.equal(h.selected.at(-1),'note-a-a-lesson');
 assert.ok(h.data.every(row=>!Object.hasOwn(row,'sections')),'document bodies never accumulate on shared catalog rows');await h.reader.open('a');assert.deepEqual(h.calls,['a'],'a recently viewed document reuses its sections');
});

test('a third document evicts the least recently read sections while the current document stays reusable',async()=>{
 const h=harness();await h.reader.open('a');await h.reader.open('b');await h.reader.open('a');await h.reader.open('c');await h.reader.open('a');assert.deepEqual(h.calls,['a','b','c']);await h.reader.open('b');assert.deepEqual(h.calls,['a','b','c','b'],'only two document bodies remain cached');
});

test('a late unused document cannot evict or reopen the currently visible cached document',async()=>{
 const later=deferred(),h=harness(id=>id==='c'?later.promise:response(id));await h.reader.open('a');await h.reader.open('b');const old=h.reader.open('c');await h.reader.open('a');later.resolve(response('c'));await old;
 assert.equal(h.reader.doc.id,'a');assert.match(h.container.innerHTML,/A original/);await h.reader.open('a');assert.deepEqual(h.calls,['a','b','c']);await h.reader.open('b');assert.deepEqual(h.calls,['a','b','c','b']);
});

test('navigating between pending documents keeps a shared request usable by the latest open',async()=>{
 const pendingA=deferred(),pendingB=deferred(),h=harness(id=>id==='a'?pendingA.promise:pendingB.promise);
 const first=h.reader.open('a'),second=h.reader.open('b'),latest=h.reader.open('a');assert.deepEqual(h.calls,['a','b']);pendingB.resolve(response('b'));await second;pendingA.resolve(response('a'));await Promise.all([first,latest]);
 assert.equal(h.reader.doc.id,'a');assert.deepEqual(h.selected,['note-a-a-lesson']);assert.match(h.container.innerHTML,/A original/);
});

test('a replaced loading panel stays closed when the library becomes active again before a success or failure',async()=>{
 for(const fail of [false,true]){const pending=deferred(),h=harness(()=>pending.promise),opening=h.reader.open('a');h.setActive(false);h.container.innerHTML='<p>Library list</p>';h.setActive(true);if(fail)pending.reject(Error('Unavailable'));else pending.resolve(response('a'));await opening;assert.equal(h.container.innerHTML,'<p>Library list</p>');assert.equal(h.selected.length,0);}
});
