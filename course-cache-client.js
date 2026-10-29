/* Inlined with the published bootstrap. Course-cache status is independent of
   learner storage. The app alone decides when an explicit update is safe. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.StudyCourseCacheClient=factory(root);
}(typeof window==='object'?window:this,function(root){
  'use strict';
  var registration=null,config=null,hooks=null,applying=false,reloadGuard=null,applyTimer=null,state='preparing',listeners=[];
  var copy={preparing:'正在缓存课文与练习，完成后再次打开会更快。',ready:'课文与练习已缓存；音频和 PDF 仍需联网。',waiting:'新版课程已缓存，可在书架应用更新；也可关闭本站所有标签页后重新打开。',failed:'课程缓存未完成（网络或浏览器空间受限），本次可继续联网学习。',unsupported:'当前浏览器不支持课程缓存，可继续联网学习。',missing:'课程缓存暂不可用，可继续联网学习。'};
  function safe(){try{return !!(hooks&&hooks.canApply&&hooks.canApply());}catch(_){return false;}}
  function snapshot(){return {state:state,text:copy[state]||copy.missing,canApply:state==='waiting'&&!applying&&safe()};}
  function emit(next){if(next)state=next;var value=snapshot();listeners.forEach(function(fn){fn(value);});var target=root.document.getElementById('study-startup-cache');if(target)target.textContent=value.text;}
  function waiting(){if(registration&&registration.waiting){emit('waiting');return true;}return false;}
  function inspect(worker){
    if(!worker||typeof root.MessageChannel!=='function')return;
    var channel=new root.MessageChannel(),closed=false,timer=root.setTimeout(function(){closed=true;channel.port1.close();if(!waiting())emit('missing');},3000);
    channel.port1.onmessage=function(event){if(closed)return;closed=true;root.clearTimeout(timer);channel.port1.close();if(!waiting())emit(event.data.state==='ready'&&event.data.version===config.version?'ready':registration&&registration.installing?'preparing':'missing');};
    try{worker.postMessage({type:'study-course-cache-status'},[channel.port2]);}catch(_){root.clearTimeout(timer);channel.port1.close();}
  }
  function watch(worker){if(!worker)return;worker.addEventListener('statechange',function(){if(worker.state==='installed'){if(!waiting())inspect(registration.active||worker);}else if(worker.state==='redundant'&&!waiting())emit('failed');});}
  function start(next){
    if(config)return;config=next;
    var nav=root.navigator;
    if(!root.isSecureContext||!nav||!nav.serviceWorker||!root.caches){emit('unsupported');return;}
    var base=new URL('./',root.location.href),url=new URL(next.worker,base);
    if(url.origin!==base.origin||url.pathname!==base.pathname+'course-cache-worker.js'){emit('unsupported');return;}
    emit('preparing');
    nav.serviceWorker.addEventListener('message',function(event){
      if(event.data&&event.data.type==='study-course-cache-version'&&event.ports&&event.ports[0]){event.ports[0].postMessage({version:config.version});return;}
      if(event.data&&event.data.type==='study-course-cache'){if(event.data.state==='failed')emit('failed');else if(event.data.version===config.version&&!waiting())inspect(registration&&registration.active);}
    });
    nav.serviceWorker.addEventListener('controllerchange',function(){
      // Only the tab that explicitly requested activation may reload, and only
      // while the app's original navigation/draft guard is still valid.
      if(reloadGuard){var guard=reloadGuard;reloadGuard=null;applying=false;root.clearTimeout(applyTimer);if(safe()&&guard()){root.location.reload();return;}}
      if(!waiting())inspect(nav.serviceWorker.controller);emit();
    });
    nav.serviceWorker.register(url.href,{scope:base.pathname,updateViaCache:'none'}).then(function(value){
      registration=value;watch(value.installing);value.addEventListener('updatefound',function(){watch(value.installing);if(!value.active)emit('preparing');});
      if(!waiting()){if(value.active)inspect(value.active);else if(!value.installing)emit('missing');}
    },function(){emit('failed');});
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
