/* Published builds append an exact, bounded manifest. This worker owns only
   site-scoped course caches; learner records are never opened here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.StudyCourseCache = factory;
}(typeof self === 'object' ? self : this, function (root, config) {
  'use strict';
  const base = new URL(root.registration.scope), prefix = 'study-course-v1-' + encodeURIComponent(base.pathname) + '-';
  const cacheName = prefix + config.version, marker = new URL('.__study_course_ready__', base).href;
  const assets = new Map(config.assets.map(asset => [new URL(asset.src, base).href, asset]));
  const indexURL = new URL('index.html', base).href;
  let onlineOnly = false;
  const owned = name => name.startsWith(prefix) && /^[a-f0-9]{64}$/.test(name.slice(prefix.length));
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  async function complete(name) {
    if (!(await root.caches.keys()).includes(name)) return null;
    const saved = await (await root.caches.open(name)).match(marker);
    if (!saved) return null;
    try { const value = await saved.json(); return value.version === name.slice(prefix.length) ? value : null; } catch (_) { return null; }
  }
  async function notify(value) {
    try { for (const client of await root.clients.matchAll({type:'window',includeUncontrolled:true})) if(client.url&&client.url.startsWith(base.href))client.postMessage({type:'study-course-cache',...value}); } catch (_) {}
  }
  async function verified(response, asset) {
    if (!response || !response.ok || response.type === 'opaque' || response.redirected) throw Error('Unavailable course asset');
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength !== asset.bytes || hex(await root.crypto.subtle.digest('SHA-256', bytes)) !== asset.sha256) throw Error('Course asset integrity mismatch');
    // Fetch checks SRI too; the filename digest is independently verified above.
    return response;
  }
  async function download(asset, fresh) {
    const url = new URL(asset.src, base).href;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    try {
      // A Promise deadline also bounds browsers whose fetch/abort stalls.
      return await Promise.race([
        (async () => {
          const options = {cache:fresh?'no-store':'force-cache',credentials:'same-origin',mode:'same-origin',redirect:'error'};
          if (asset.integrity) options.integrity = asset.integrity;
          if (controller) options.signal = controller.signal;
          return verified(await root.fetch(url, options), asset);
        })(),
        new Promise((_, reject) => { timer = root.setTimeout(() => { if(controller)controller.abort(); reject(Error('Course cache download timed out')); }, 20000); })
      ]);
    } finally { root.clearTimeout(timer); }
  }
  async function reusable(asset, names) {
    const url = new URL(asset.src, base).href;
    for (const name of names) {
      if (!owned(name) || name === cacheName || !await complete(name)) continue;
      try { const saved = await (await root.caches.open(name)).match(url); if(saved)return await verified(saved,asset); } catch (_) {}
    }
    try { return await download(asset, false); } catch (_) { return download(asset, true); }
  }
  async function install() {
    if (await complete(cacheName)) return;
    try {
      await prune(2);
      const completeNames=[];let retainedBytes=0;
      for(const name of await root.caches.keys())if(owned(name)){const meta=await complete(name);if(meta){completeNames.push(name);retainedBytes+=meta.bytes||0;}}
      const nextBytes=config.index.bytes+config.assets.reduce((sum,asset)=>sum+asset.bytes,0);
      // Suspended tabs can temporarily pin extra old versions. Refuse another
      // update at the budget instead of deleting a tab's compatible course.
      if(completeNames.length>=4||retainedBytes+nextBytes>128*1024*1024){const error=Error('Course cache retention budget reached');error.name='CourseCacheBudgetError';throw error;}
      const names = await root.caches.keys(), cache = await root.caches.open(cacheName);
      // Verify the compatible HTML first. A deployment racing this worker cannot
      // publish a mixed version; its partial cache is discarded on any failure.
      await cache.put(indexURL, await download(config.index, true));
      let cursor = 0, failure;
      async function consume() {
        while (!failure && cursor < config.assets.length) {
          const asset = config.assets[cursor++];
          try { await cache.put(new URL(asset.src,base).href, await reusable(asset,names)); } catch (error) { failure = error; }
        }
      }
      await Promise.all(Array.from({length:Math.min(3,config.assets.length)},consume));
      if (failure) throw failure;
      await cache.put(marker, new Response(JSON.stringify({version:config.version,installedAt:Date.now(),bytes:nextBytes,assets:config.assets}),{headers:{'Content-Type':'application/json'}}));
      await notify({state:'ready',version:config.version});
    } catch (error) {
      try { await root.caches.delete(cacheName); } catch (_) {}
      await notify({state:'failed'}); throw error;
    }
  }
  async function prune(retainPrevious) {
    const names = await root.caches.keys(), previous = [];
    const pinned = new Set();let uncertain=false;
    // An explicit update may activate while another tab edits an older course.
    // Ask those pages which immutable cache they still use before pruning.
    const clients=(await root.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url&&client.url.startsWith(base.href));
    if(typeof root.MessageChannel!=='function'&&clients.length)uncertain=true;
    if(typeof root.MessageChannel==='function')await Promise.all(clients.map(client=>new Promise(resolve=>{
      const channel=new root.MessageChannel();let closed=false;
      const finish=()=>{if(closed)return;closed=true;root.clearTimeout(timer);channel.port1.close();resolve();};
      const timer=root.setTimeout(()=>{uncertain=true;finish();},1000);
      channel.port1.onmessage=event=>{if(/^[a-f0-9]{64}$/.test(event.data?.version))pinned.add(prefix+event.data.version);else uncertain=true;finish();};
      try{client.postMessage({type:'study-course-cache-version'},[channel.port2]);}catch(_){uncertain=true;finish();}
    })));
    for(const name of names)if(owned(name)&&name!==cacheName){const meta=await complete(name);if(meta)previous.push({name,time:meta.installedAt,order:previous.length});else await root.caches.delete(name);}
    previous.sort((a,b)=>(b.time-a.time)||(b.order-a.order));
    if(!uncertain)for(const entry of previous.slice(retainPrevious))if(!pinned.has(entry.name))await root.caches.delete(entry.name);
  }
  async function installAndActivate() {
    try { await install(); }
    catch (error) {
      // A full offline cache must not permanently pin the site to an old UI.
      // Keep all compatible caches and run this verified release online instead.
      if(!/^(?:CourseCacheBudgetError|QuotaExceededError)$/.test(error.name)&&!/QuotaExceededError/.test(error.message||''))throw error;
      await download(config.index,true);
      onlineOnly=true;
      await notify({state:'online',version:config.version});
    }
    // Activation changes fetch handling only. Never navigate/reload an editor.
    if(typeof root.skipWaiting==='function')await root.skipWaiting();
  }
  async function activate() {
    await prune(1);
    // Claiming clients does not navigate them; pinned old resources are retained.
    await root.clients.claim();
  }
  function keyFor(request) {
    if(request.method!=='GET')return null;
    let url;try{url=new URL(request.url);}catch(_){return null;}
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return null;
    const relative=url.pathname.slice(base.pathname.length), keys=Array.from(url.searchParams.keys());
    if(request.mode==='navigate'&&(relative===''||relative==='index.html')){
      // Recovery checks and refresh deliberately reach the network; never
      // canonicalize arbitrary URL parameters into the cached document.
      return keys.every(key=>(key==='build'||key==='v')&&url.searchParams.getAll(key).length===1&&/^[A-Za-z0-9._-]{1,100}$/.test(url.searchParams.get(key)))?indexURL:null;
    }
    const canonical=new URL(url.pathname,base.origin).href,asset=assets.get(canonical);
    const runtime=/^runtime-(?:scripts|styles)-[a-f0-9]{20}\.(?:js|css)$/.test(relative);
    if(runtime&&(!keys.length||keys.length===1&&keys[0]==='retry'&&/^[12]$/.test(url.searchParams.get('retry'))))return canonical;
    if(!asset)return null;
    if(!keys.length)return canonical;
    if(/^(?:text-data|recall-data)\//.test(relative)&&keys.length===1&&keys[0]==='sha256'&&/^[a-f0-9]{64}$/.test(url.searchParams.get('sha256')))return canonical;
    if(/^recall-data\//.test(relative)&&keys.length===1&&keys[0]==='build'&&/^[a-f0-9]{16}$/.test(url.searchParams.get('build')))return canonical;
    return null;
  }
  async function latestDocument(request) {
    const controller=typeof AbortController==='function'?new AbortController():null;let timer;
    try {
      return await Promise.race([
        (async()=>{
          const response=await root.fetch(request.url,{cache:'no-store',credentials:'same-origin',mode:'same-origin',redirect:'error',...(controller?{signal:controller.signal}:{})});
          if(!response||!response.ok||response.redirected||response.type==='opaque')throw Error('Latest document unavailable');
          if(!/<(?:!doctype\s+html|html)(?:\s|>)/i.test(await response.clone().text()))throw Error('Not an HTML document');
          return response;
        })(),
        new Promise((_,reject)=>{timer=root.setTimeout(()=>{if(controller)controller.abort();reject(Error('Document check timed out'));},2500);})
      ]);
    }catch(_){return null;}finally{root.clearTimeout(timer);}
  }
  async function respond(request) {
    const key=keyFor(request);if(!key)return null;
    if(key===indexURL&&request.mode==='navigate'){const latest=await latestDocument(request);if(latest)return latest;}
    const url=new URL(request.url),revision=url.searchParams.get('sha256'),build=url.searchParams.get('build');
    const immutable=/\/runtime-(?:scripts|styles)-[a-f0-9]{20}\.(?:js|css)$/.test(key);
    const candidates=[cacheName];
    if(immutable||revision||build&&key!==indexURL)for(const name of await root.caches.keys())if(owned(name)&&name!==cacheName)candidates.push(name);
    for(const name of candidates){
      const meta=await complete(name);if(!meta)continue;
      if(revision||build&&key!==indexURL){const descriptor=(meta.assets||[]).find(asset=>new URL(asset.src,base).href===key);if(!descriptor||revision&&descriptor.sha256!==revision||build&&descriptor.build!==build)continue;}
      const saved=await (await root.caches.open(name)).match(key);if(saved)return saved;
    }
    return null;
  }
  async function status(){return {state:await complete(cacheName)?'ready':onlineOnly?'online':'missing',version:config.version};}
  root.addEventListener('install',event=>event.waitUntil(installAndActivate()));
  root.addEventListener('activate',event=>event.waitUntil(activate()));
  root.addEventListener('fetch',event=>{
    if(!keyFor(event.request))return;
    event.respondWith(respond(event.request).catch(()=>null).then(cached=>cached||root.fetch(event.request)));
  });
  root.addEventListener('message',event=>{
    if(event.data?.type==='study-course-cache-apply'&&event.source?.url){
      const source=new URL(event.source.url);
      if(source.origin===base.origin&&source.pathname.startsWith(base.pathname))event.waitUntil(root.skipWaiting());
      return;
    }
    if(event.data?.type!=='study-course-cache-status')return;
    const reply=status().catch(()=>({state:'failed'})).then(value=>{if(event.ports?.[0])event.ports[0].postMessage(value);});
    if(event.waitUntil)event.waitUntil(reply);
  });
  return {install,activate,respond,status};
}));
