const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dictionary-service.js'),'utf8');
const response=entries=>({ok:true,json:async()=>({version:1,entries})});
const row={translation:'n. 剧院；戏剧',definition:'A building for dramatic performances.\nThe dramatic arts.',phonetic:'/ˈθɪətə/',headword:'theatre'};
function setup(fetch){const scope={fetch,AbortController,setTimeout,clearTimeout};scope.window=scope;vm.createContext(scope);vm.runInContext(source,scope);return scope.StudyDictionary;}
function local(service,...args){assert.equal(typeof service.lookupLocal,'function','bundled bilingual lookup is available');return service.lookupLocal(...args);}
test('loads a same-origin bilingual shard, with explicit source, headword and separated languages',async()=>{
 const seen=[],service=setup(async(url,options)=>{seen.push({url,options});return response({theatre:row});});
 const item=await local(service,' Theatre ');assert.equal(seen.length,1);assert.match(seen[0].url,/^dictionary-data\/t\.json(?:\?|$)/);assert.equal(seen[0].options.credentials,'omit');assert.equal(seen[0].options.referrerPolicy,'no-referrer');assert.equal(item.word,'theatre');assert.equal(item.translation,'n. 剧院；戏剧');assert.equal(item.definition,'A building for dramatic performances.');assert.equal(item.meanings[0].definitions.length,2);assert.equal(item.headword,'theatre');assert.equal(item.sourceName,'ECDICT');assert.equal(item.sourceUrl,'https://github.com/skywind3000/ECDICT');assert.equal(item.language,'en-zh');
});
test('one successfully loaded letter serves later words without another request and misses stay honest',async()=>{
 let count=0;const service=setup(async()=>{count++;return response({theatre:row,theatres:{...row,headword:'theatre'}});});
 await local(service,'theatre');const plural=await local(service,'theatres');assert.equal(plural.headword,'theatre');assert.equal(await local(service,'totallyunknownword'),null);assert.equal(count,1);
});
test('validates a single word before fetching and never turns unknown entries into definitions',async()=>{
 let calls=0;const service=setup(async()=>{calls++;return response({constructor:{translation:'n. 构造者',definition:'A person who constructs.'}});});
 for(const word of ['../hello','hello world','<script>x</script>','a'.repeat(65),''])await assert.rejects(local(service,word),{code:'invalid-word'});
 assert.equal(calls,0);assert.equal(await local(service,'absent'),null);assert.equal((await local(service,'constructor')).translation,'n. 构造者');
});
test('bounds and strips bundled fields, rejects malformed shards, and does not label English as Chinese',async()=>{
 const service=setup(async()=>response({theatre:{translation:'<script>bad()</script>剧院\u0000'+ '词'.repeat(1800),definition:'<b>A theatre.</b>',phonetic:'<i>/test/</i>',headword:'javascript:alert(1)'},token:{translation:'An English definition.',definition:'A unit of text.'}}));
 const item=await local(service,'theatre');assert.doesNotMatch(item.translation,/bad\(\)|<|\u0000/);assert.ok(item.translation.length<=1200);assert.equal(item.definition,'A theatre.');assert.equal(item.phonetic,'/test/');assert.equal(item.headword,'theatre');assert.equal((await local(service,'token')).translation,'');
 for(const body of [null,[],{version:1,entries:[]},{version:2,entries:{}},{version:1,entries:null}]){const bad=setup(async()=>({ok:true,json:async()=>body}));await assert.rejects(local(bad,'hello'),{code:'unavailable'});}
});
test('an absent shard or word is not found, while network failures remain retryable',async()=>{
 const absent=setup(async()=>({ok:false,status:404}));assert.equal(await local(absent,'hello'),null);
 let attempts=0;const service=setup(async()=>{if(++attempts===1)throw Error('offline');return response({hello:{translation:'你好',definition:'Used as a greeting.'}});});
 await assert.rejects(local(service,'hello'),{code:'unavailable'});assert.equal((await local(service,'hello')).translation,'你好');assert.equal(attempts,2);
});
test('aborts and times out even when fetch ignores cancellation, without caching a late result',async()=>{
 let finish,calls=0,signal;const service=setup(async(_url,options)=>{calls++;signal=options.signal;if(calls===1)return new Promise(resolve=>{finish=resolve;});return response({theatre:{...row,translation:'新的中文'}});});
 const controller=new AbortController(),pending=local(service,'theatre',{signal:controller.signal});controller.abort();await assert.rejects(pending,{code:'aborted'});assert.equal(signal.aborted,true);finish(response({theatre:{...row,translation:'过期释义'}}));await Promise.resolve();await Promise.resolve();assert.equal((await local(service,'theatre')).translation,'新的中文');assert.equal(calls,2);
 const timeout=setup(()=>new Promise(()=>{}));await assert.rejects(local(timeout,'hello',{timeoutMs:10}),{code:'timeout'});
 const already=new AbortController();already.abort();await assert.rejects(local(timeout,'hello',{signal:already.signal}),{code:'aborted'});
});
test('a stalled JSON body times out and its eventual data cannot replace a later successful shard',async()=>{
 let body,calls=0;const service=setup(async()=>{calls++;if(calls===1)return {ok:true,json:()=>new Promise(resolve=>{body=resolve;})};return response({hello:{translation:'你好',definition:'Used as a greeting.'}});});
 await assert.rejects(local(service,'hello',{timeoutMs:10}),{code:'timeout'});
 body({version:1,entries:{hello:{translation:'过期内容',definition:'Old.'}}});await Promise.resolve();await Promise.resolve();
 assert.equal((await local(service,'hello')).translation,'你好');assert.equal(calls,2);
});
