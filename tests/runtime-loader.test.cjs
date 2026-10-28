'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.resolve(__dirname,'../runtime-loader.js');
const factory=fs.existsSync(file)?require(file):()=>({start(){},install(){}});
function setup(){
 const nodes=new Map(),requests=[],timers=new Map(),listeners={},executions=[];let clock=0;
 const node=tag=>({tagName:tag.toUpperCase(),hidden:false,disabled:false,textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=String(v);},remove(){this.removed=true;},addEventListener(k,fn){this['on'+k]=fn;}});
 for(const id of ['study-startup','study-startup-message','study-startup-progress','study-startup-error','study-startup-retry','study-startup-reload'])nodes.set(id,node('div'));
 const document={body:node('body'),getElementById:id=>nodes.get(id),createElement:node};
 document.head={appendChild(el){if(el.tagName==='SCRIPT'&&!el.src){try{vm.runInContext(el.text||el.textContent,context);executions.push(el.text||el.textContent);}catch(error){for(const fn of listeners.error||[])fn({error,message:error.message,filename:'inline.js'});}return el;}if(el.rel!=='preload')requests.push(el);return el;}};
 const root={document,location:{href:'https://study.example/project/?build=old#study',assign(value){this.assigned=value;}},navigator:{onLine:true},setTimeout(fn,ms){timers.set(++clock,{fn,ms});return clock;},clearTimeout:id=>timers.delete(id),addEventListener(k,fn){(listeners[k]??=[]).push(fn);},removeEventListener(k,fn){listeners[k]=(listeners[k]||[]).filter(f=>f!==fn);},console};
 Object.defineProperty(root,'localStorage',{get(){throw Error('startup must never read or clear study data');}});
 root.window=root;const context=vm.createContext(root),loader=factory(root);root.StudyStartup=loader;
 const scripts=[{id:'one',src:'runtime-one.abc.js',files:['a.js'],integrity:'sha384-one'},{id:'two',src:'runtime-two.def.js',files:['b.js'],integrity:'sha384-two'}];
 const manifest={version:1,build:'test',scripts,styles:[{src:'runtime-style.abc.css',integrity:'sha384-css'}]};
 const deliver=(index,source)=>loader.install(scripts[index].id,[{name:scripts[index].files[0],source:source||'window.order=(window.order||[]).concat('+index+');'}]);
 const fireTimer=()=>{const [id,t]=[...timers].sort((a,b)=>a[1].ms-b[1].ms)[0]||[];if(t){timers.delete(id);t.fn();}return t;};
 return {root,loader,nodes,requests,timers,listeners,executions,manifest,deliver,fireTimer};
}
function canonicalManifest(h){
 h.manifest.scripts.forEach((asset,i)=>{asset.src='runtime-scripts-'+String(i+1).repeat(20)+'.js';asset.id=String(i+1).repeat(64);asset.integrity='sha384-'+Buffer.alloc(48,i+1).toString('base64');});
 h.manifest.styles[0].src='runtime-styles-'+('3'.repeat(20))+'.css';h.manifest.styles[0].integrity='sha384-'+Buffer.alloc(48,3).toString('base64');
}
function exhaustSecondScript(h){
 canonicalManifest(h);
 h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='LINK').onload();h.deliver(0);
 for(let i=0;i<3;i++){h.requests.filter(x=>x.tagName==='SCRIPT').at(-1).onerror();if(i<2)h.fireTimer();}
}
function newerHTML(h,changed=true){
 const latest=JSON.parse(JSON.stringify(h.manifest));latest.build='new';
 if(changed){latest.scripts[0].src='runtime-scripts-'+('a'.repeat(20))+'.js';latest.scripts[0].id='b'.repeat(64);latest.scripts[0].integrity='sha384-new';}
 return factory.renderHTML(latest,'window.mustNotRunFetchedHTML=true;').bodyEnd;
}
test('startup keeps the application covered until ordered scripts and stylesheet finish',()=>{
 const h=setup();h.loader.start(h.manifest);assert.equal(h.requests.filter(x=>x.tagName==='SCRIPT').length,1);
 assert.equal(h.nodes.get('study-startup').hidden,false);
 h.deliver(0);assert.equal(h.requests.filter(x=>x.tagName==='SCRIPT').length,2);h.deliver(1);
 assert.deepEqual(Array.from(h.root.order),[0,1]);assert.equal(h.nodes.get('study-startup').hidden,false,'CSS must also finish');
 h.requests.find(x=>x.tagName==='LINK').onload();assert.equal(h.nodes.get('study-startup').hidden,true);
 assert.match(h.root.document.body.className||'',/^(?!.*study-booting)/);
});
test('a failed download retries with a cache-busting URL and never reruns completed scripts',()=>{
 const h=setup();h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='LINK').onload();h.deliver(0);
 const failed=h.requests.filter(x=>x.tagName==='SCRIPT').at(-1);failed.onerror();h.fireTimer();
 const retry=h.requests.filter(x=>x.tagName==='SCRIPT').at(-1);assert.notEqual(retry,failed);assert.match(retry.src,/runtime-two\.def\.js\?retry=1/);assert.equal(retry.integrity,'sha384-two');
 h.deliver(1);h.deliver(0);h.deliver(1);assert.deepEqual(Array.from(h.root.order),[0,1]);assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('persistent network failure stops bounded retries and manual retry resumes the failed part',()=>{
 const h=setup();h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='LINK').onload();h.deliver(0);
 for(let i=0;i<3;i++){h.requests.filter(x=>x.tagName==='SCRIPT').at(-1).onerror();if(i<2)h.fireTimer();}
 assert.equal(h.requests.filter(x=>x.tagName==='SCRIPT').length,4);assert.equal(h.timers.size,0);
 assert.equal(h.nodes.get('study-startup-retry').hidden,false);assert.match(h.nodes.get('study-startup-error').textContent,/网络|连接/);
 h.nodes.get('study-startup-retry').onclick();h.deliver(1);assert.deepEqual(Array.from(h.root.order),[0,1]);assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('late timed-out downloads cannot repeat initialization or advance the wrong group',()=>{
 const h=setup();h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='LINK').onload();h.fireTimer();h.fireTimer();
 h.deliver(0);h.deliver(0);h.deliver(1);assert.deepEqual(Array.from(h.root.order),[0,1]);assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('a retry carrier can execute without waiting for an abandoned download in the browser ordered-script queue',()=>{
 const h=setup();h.loader.start(h.manifest);
 assert.equal(h.requests.find(x=>x.tagName==='SCRIPT').async,true,'the installer, rather than async=false browser queue, orders groups');
});
test('script execution failure stops later scripts and offers safe reload rather than re-executing partial initialization',()=>{
 const h=setup();h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='LINK').onload();h.deliver(0,'window.partial=1;throw Error("broken source");');
 assert.equal(h.root.partial,1);assert.equal(h.requests.filter(x=>x.tagName==='SCRIPT').length,1);
 assert.equal(h.nodes.get('study-startup-retry').hidden,true);assert.match(h.nodes.get('study-startup-error').textContent,/浏览器|初始化/);
 h.nodes.get('study-startup-reload').onclick();assert.match(h.root.location.assigned,/refresh=/);assert.match(h.root.location.assigned,/#study$/);
});
test('classic-script boundaries preserve strict scope and shared global declarations',()=>{
 const h=setup();h.manifest.scripts=[{id:'one',src:'runtime-one.js',files:['strict.js','normal.js']}];h.loader.start(h.manifest);
 h.loader.install('one',[{name:'strict.js',source:'"use strict"; var shared=7;'},{name:'normal.js',source:'window.looseThis=(function(){return this;})(); window.sharedValue=shared;'}]);
 assert.equal(h.root.sharedValue,7);assert.equal(h.root.looseThis.sharedValue,7);h.requests.find(x=>x.tagName==='LINK').onload();assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('a loaded bundle with missing install data fails clearly instead of displaying an empty shell',()=>{
 const h=setup();h.loader.start(h.manifest);h.requests.find(x=>x.tagName==='SCRIPT').onload();
 assert.equal(h.nodes.get('study-startup').hidden,false);assert.match(h.nodes.get('study-startup-error').textContent,/文件|初始化/);assert.equal(h.nodes.get('study-startup-retry').hidden,true);
});
test('stylesheet failure also recovers and does not restart successful course scripts',()=>{
 const h=setup();h.loader.start(h.manifest);h.deliver(0);h.deliver(1);h.requests.find(x=>x.tagName==='LINK').onerror();h.fireTimer();
 const link=h.requests.filter(x=>x.tagName==='LINK').at(-1);assert.match(link.href,/retry=1/);link.onload();assert.equal(h.nodes.get('study-startup').hidden,true);assert.deepEqual(Array.from(h.root.order),[0,1]);
});
test('manual recovery of a persistently failing stylesheet releases the loading screen',()=>{
 const h=setup();h.loader.start(h.manifest);h.deliver(0);h.deliver(1);
 for(let i=0;i<3;i++){h.requests.filter(x=>x.tagName==='LINK').at(-1).onerror();if(i<2)h.fireTimer();}
 assert.equal(h.nodes.get('study-startup-retry').hidden,false);h.nodes.get('study-startup-retry').onclick();
 h.requests.filter(x=>x.tagName==='LINK').at(-1).onload();assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('published bootstrap preloads each package with matching integrity and safely embeds manifest data',()=>{
 const h=setup(),render=factory.renderHTML;
 assert.equal(typeof render,'function');
 const html=render({...h.manifest,build:'</script><script>injected</script>'},fs.readFileSync(file,'utf8'));
 for(const asset of [...h.manifest.scripts,...h.manifest.styles]){
  assert.ok(html.head.includes('href="'+asset.src+'"'),'all downloads can start in parallel');
  assert.ok(html.head.includes('integrity="'+asset.integrity+'"'));
 }
 assert.ok(!html.bodyEnd.includes('</script><script>injected'));
 assert.equal((html.bodyEnd.match(/<\/script>/gi)||[]).length,1,'only the intended bootstrap closing tag');
});
test('older browsers without Element.remove still get a useful initialization recovery message',()=>{
 const h=setup(),create=h.root.document.createElement;
 h.root.document.createElement=tag=>{const node=create(tag);delete node.remove;return node;};
 h.loader.start(h.manifest);h.deliver(0,'throw new SyntaxError("unsupported syntax");');
 assert.equal(h.nodes.get('study-startup-reload').hidden,false);assert.equal(h.nodes.get('study-startup-retry').hidden,true);
 assert.match(h.nodes.get('study-startup-error').textContent,/浏览器/);
});
test('an empty or partial course catalog never becomes the misleading import-your-own-text screen',()=>{
 const h=setup();h.manifest.scripts=[{id:'one',src:'runtime-app.js',files:['app.js']}];h.manifest.lessonCounts={2:2};
 h.root.LESSONS=[{id:'lesson-one',book:2,textbook:{},paragraphs:[{en:'One real lesson.'}]}];
 h.loader.start(h.manifest);h.loader.install('one',[{name:'app.js',source:'window.startedApp=true;'}]);
 assert.equal(h.root.startedApp,undefined);assert.equal(h.nodes.get('study-startup').hidden,false);
 assert.match(h.nodes.get('study-startup-error').textContent,/课程正文未完整加载/);assert.equal(h.nodes.get('study-startup-reload').hidden,false);
});
test('a complete course catalog passes the published health check without reading local storage',()=>{
 const h=setup();h.manifest.scripts=[{id:'one',src:'runtime-app.js',files:['app.js']}];h.manifest.lessonCounts={2:1};
 h.root.LESSONS=[{id:'lesson-one',book:2,textbook:{},paragraphs:[{en:'One real lesson.'}]}];
 h.loader.start(h.manifest);h.loader.install('one',[{name:'app.js',source:'window.startedApp=true;'}]);h.requests.find(x=>x.tagName==='LINK').onload();
 assert.equal(h.root.startedApp,true);assert.equal(h.nodes.get('study-startup').hidden,true);
});
test('duplicate course rows cannot disguise a missing textbook lesson',()=>{
 const h=setup();h.manifest.scripts=[{id:'one',src:'runtime-app.js',files:['app.js']}];h.manifest.lessonCounts={2:2};
 const lesson={id:'lesson-one',book:2,textbook:{},paragraphs:[{en:'Only one real lesson.'}]};h.root.LESSONS=[lesson,lesson];
 h.loader.start(h.manifest);h.loader.install('one',[{name:'app.js',source:'window.startedApp=true;'}]);
 assert.equal(h.root.startedApp,undefined);assert.match(h.nodes.get('study-startup-error').textContent,/课程正文未完整加载/);
});

test('a proven stale package list triggers one guarded same-origin refresh without executing the fetched page',async()=>{
 const h=setup(),probes=[];h.root.location.replace=value=>{h.root.location.replaced=value;};
 h.root.fetch=(url,options)=>{probes.push({url,options});return Promise.resolve({ok:true,url:'https://study.example/project/?startup-check=now',text:async()=>newerHTML(h)});};
 exhaustSecondScript(h);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(probes.length,1);assert.match(probes[0].url,/^https:\/\/study\.example\/project\/\?startup-check=\d+$/);assert.equal(probes[0].options.cache,'no-store');assert.equal(probes[0].options.credentials,'same-origin');assert.equal(probes[0].options.redirect,'error');
 assert.match(h.root.location.replaced,/build=old/);assert.match(h.root.location.replaced,/refresh=\d+&startup-reloaded=1#study$/);assert.equal(h.root.mustNotRunFetchedHTML,undefined);assert.equal(h.timers.size,0);
});

test('ordinary network failure and an unchanged latest package list stay on manual recovery',async()=>{
 for(const response of ['same','offline','invalid','redirect']){
  const h=setup();let probes=0;h.root.fetch=()=>{probes++;return response==='offline'?Promise.reject(Error('offline')):Promise.resolve({ok:true,url:response==='redirect'?'https://outside.example/page':'https://study.example/project/',text:async()=>response==='invalid'?'<html>No manifest</html>':newerHTML(h,false)});};
  exhaustSecondScript(h);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(probes,1,response+' checks freshness without running the fetched HTML');
  assert.equal(h.root.location.assigned,undefined,response+' must not trigger a speculative reload');assert.equal(h.nodes.get('study-startup-retry').hidden,false);assert.equal(h.nodes.get('study-startup-reload').hidden,false);assert.equal(h.timers.size,0);
 }
});

test('the refresh URL guard prevents another automatic update loop',async()=>{
 const h=setup();h.root.location.href='https://study.example/project/?build=old&startup-reloaded=1#study';let probes=0;
 h.root.fetch=()=>{probes++;return Promise.resolve({ok:true,text:async()=>newerHTML(h)});};
 exhaustSecondScript(h);await new Promise(resolve=>setImmediate(resolve));assert.equal(probes,0);assert.equal(h.root.location.assigned,undefined);assert.equal(h.nodes.get('study-startup-retry').hidden,false);
});

test('a late version response cannot refresh after manual recovery has already completed',async()=>{
 const h=setup();let resolveFetch;h.root.fetch=()=>new Promise(resolve=>resolveFetch=resolve);
 exhaustSecondScript(h);assert.equal(typeof resolveFetch,'function');h.nodes.get('study-startup-retry').onclick();h.deliver(1);assert.equal(h.nodes.get('study-startup').hidden,true);
 resolveFetch({ok:true,url:'https://study.example/project/',text:async()=>newerHTML(h)});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.root.location.assigned,undefined);
});

test('a timed-out version probe cannot block retry or trigger a late automatic refresh',async()=>{
 const h=setup();let resolveFetch;h.root.fetch=()=>new Promise(resolve=>resolveFetch=resolve);
 exhaustSecondScript(h);const timer=h.fireTimer();assert.equal(timer.ms,5000);
 resolveFetch({ok:true,url:'https://study.example/project/',text:async()=>newerHTML(h)});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.root.location.assigned,undefined);assert.equal(h.nodes.get('study-startup-retry').hidden,false);h.nodes.get('study-startup-retry').onclick();h.deliver(1);assert.equal(h.nodes.get('study-startup').hidden,true);
});

test('concurrent stylesheet and script failures share one version probe and one guarded refresh',async()=>{
 const h=setup();canonicalManifest(h);let probes=0,resolveFetch;h.root.fetch=()=>{probes++;return new Promise(resolve=>resolveFetch=resolve);};
 h.loader.start(h.manifest);
 for(let i=0;i<3;i++){h.requests.filter(x=>x.tagName==='LINK').at(-1).onerror();if(i<2)h.fireTimer();}
 assert.equal(probes,1);h.deliver(0);
 for(let i=0;i<3;i++){h.requests.filter(x=>x.tagName==='SCRIPT').at(-1).onerror();if(i<2)h.fireTimer();}
 assert.equal(probes,1);resolveFetch({ok:true,url:'https://study.example/project/',text:async()=>newerHTML(h)});await new Promise(resolve=>setImmediate(resolve));
 assert.match(h.root.location.assigned,/startup-reloaded=1/);assert.deepEqual(Array.from(h.root.order),[0],'a failed stylesheet does not fabricate completion or rerun prior source scripts');
});
