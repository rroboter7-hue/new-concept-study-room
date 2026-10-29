/* Inlined with the published bootstrap. Course-cache status is independent of
   learner storage. The app alone decides when a reload is safe, after its draft flush. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.StudyCourseCacheClient=factory(root);
}(typeof window==='object'?window:this,function(root){
  'use strict';
  var registration=null,config=null,hooks=null,applying=false,reloadGuard=null,applyTimer=null,state='preparing',listeners=[],pendingVersion=null,reloadStarted=false,retryTimer=null,retries=0,checking=false;
  var copy={preparing:'正在缓存课文与练习，完成后再次打开会更快。',ready:'课文与练习已缓存；音频和 PDF 仍需联网。',waiting:'新版课程已缓存，可在书架应用更新；也可关闭本站所有标签页后重新打开。',failed:'课程缓存未完成（网络或浏览器空间受限），本次可继续联网学习。',unsupported:'当前浏览器不支持课程缓存，可继续联网学习。',missing:'课程缓存暂不可用，可继续联网学习。',online:'已更新到当前版本；缓存空间不足，本次联网学习，学习记录不受影响。',updated:'新版已就绪，返回书架后自动更新；正在编辑的内容不会被刷新。'};
  function safe(){try{return !!(hooks&&hooks.canApply&&hooks.canApply());}catch(_){return false;}}
  function snapshot(){return {state:state,text:copy[state]||copy.missing,canApply:state==='waiting'&&!applying&&safe()};}
  function emit(next){if(next)state=next;var value=snapshot();listeners.forEach(function(fn){fn(value);});var target=root.document.getElementById('study-startup-cache');if(target)target.textContent=value.text;tryAutomaticReload();}
  function waiting(){if(registration&&registration.waiting){emit('waiting');return true;}return false;}
  function tryAutomaticReload(){
    if(!pendingVersion||reloadStarted||applying||!safe()||root.navigator.onLine===false)return;
    applying=true;var target=pendingVersion;
    Promise.resolve().then(function(){return hooks.prepare();}).then(function(guard){
      if(target!==pendingVersion||typeof guard!=='function'||!safe()||!guard()){applying=false;return;}
      reloadStarted=true;root.location.reload();
    },function(){applying=false;});
  }
  function retry(){
    if(retryTimer||retries>=2)return;
    retryTimer=root.setTimeout(function(){retryTimer=null;retries++;checkUpdate();},30000);
  }
  function checkUpdate(){
    if(checking||root.navigator.onLine===false)return;
    if(!registration)return registerWorker();
    if(typeof registration.update!=='function')return;
    checking=true;
    return Promise.resolve().then(function(){return registration.update();}).catch(function(){retry();}).then(function(){checking=false;});
  }
  function resume(event){
    if(event&&event.type==='pageshow'&&!event.persisted)return;
    checkUpdate();if(registration)inspect(root.navigator.serviceWorker.controller||registration.active,true);
  }
  function inspect(worker,automatic){
    if(!worker||typeof root.MessageChannel!=='function')return;
    var channel=new root.MessageChannel(),closed=false,timer=root.setTimeout(function(){closed=true;channel.port1.close();if(!waiting())emit('missing');},3000);
    channel.port1.onmessage=function(event){if(closed)return;closed=true;root.clearTimeout(timer);channel.port1.close();if(automatic&&event.data.version&&event.data.version!==config.version){pendingVersion=event.data.version;emit('updated');return;}
      if(!waiting())emit(event.data.version===config.version&&['ready','online'].indexOf(event.data.state)!==-1?event.data.state:registration&&registration.installing?'preparing':'missing');};
    try{worker.postMessage({type:'study-course-cache-status'},[channel.port2]);}catch(_){root.clearTimeout(timer);channel.port1.close();}
  }
  function watch(worker){if(!worker)return;worker.addEventListener('statechange',function(){if(worker.state==='installed'){if(!waiting())inspect(registration.active||worker);}else if(worker.state==='redundant'&&!waiting()){emit('failed');retry();}});}
  function start(next){
    if(config)return;config=next;
    var nav=root.navigator;
    if(!root.isSecureContext||!nav||!nav.serviceWorker||!root.caches){emit('unsupported');return;}
    var base=new URL('./',root.location.href),url=new URL(next.worker,base);
    if(url.origin!==base.origin||url.pathname!==base.pathname+'course-cache-worker.js'){emit('unsupported');return;}
    emit('preparing');
    if(root.addEventListener){root.addEventListener('online',resume);root.addEventListener('pageshow',resume);}
    if(root.document.addEventListener)root.document.addEventListener('visibilitychange',function(){if(root.document.visibilityState==='visible')resume();});
    nav.serviceWorker.addEventListener('message',function(event){
      if(event.data&&event.data.type==='study-course-cache-version'&&event.ports&&event.ports[0]){event.ports[0].postMessage({version:config.version});return;}
      if(event.data&&event.data.type==='study-course-cache'){if(event.data.state==='failed'){emit('failed');retry();}else if(event.data.version===config.version&&!waiting())inspect(registration&&registration.active);}
    });
    nav.serviceWorker.addEventListener('controllerchange',function(){
      // A page reload always requires the app's current shelf/draft guard.
      // Existing editors in this and other tabs stay mounted.
      if(reloadGuard){var guard=reloadGuard;reloadGuard=null;applying=false;root.clearTimeout(applyTimer);if(safe()&&guard()){root.location.reload();return;}}
      if(!waiting())inspect(nav.serviceWorker.controller,true);emit();
    });
    registerWorker();
  }
  function registerWorker(){
    if(checking||root.navigator.onLine===false)return;
    var base=new URL('./',root.location.href),url=new URL(config.worker,base);
    checking=true;emit('preparing');
    return root.navigator.serviceWorker.register(url.href,{scope:base.pathname,updateViaCache:'none'}).then(function(value){
      checking=false;registration=value;watch(value.installing);checkUpdate();value.addEventListener('updatefound',function(){watch(value.installing);if(!value.active)emit('preparing');});
      if(!waiting()){if(value.active)inspect(value.active);else if(!value.installing)emit('missing');}
    },function(){checking=false;emit('failed');retry();});
  }
  async function applyUpdate(){
    if(applying||!registration||!registration.waiting||!safe())return false;
    applying=true;emit();
    try{
      var worker=registration.waiting,guard=await hooks.prepare();
      if(typeof guard!=='function'||!safe()||!guard()||worker!==registration.waiting){applying=false;emit();return false;}
      reloadGuard=guard;worker.postMessage({type:'study-course-cache-apply'});
      applyTimer=root.setTimeout(function(){reloadGuard=null;applying=false;emit();},15000);return true;
    }catch(_){applying=false;reloadGuard=null;emit();return false;}
  }
  return {start:start,configureUpdate:function(value){hooks=value;emit();},snapshot:snapshot,refresh:function(){emit();},subscribe:function(fn){listeners.push(fn);fn(snapshot());return function(){listeners=listeners.filter(function(item){return item!==fn;});};},applyUpdate:applyUpdate};
}));
