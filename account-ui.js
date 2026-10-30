/* Account panel; identity changes happen only after local flush and verified cloud reads. */
(function(root,factory){const C=factory(root);if(typeof module==='object'&&module.exports)module.exports=C;else root.StudyAccountPanel=C;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stamp=row=>({at:row.modifiedAt,id:row.writeId}),uuid=()=>crypto.randomUUID();
 class AccountPanel{
  constructor(options={}){this.o=options;Object.assign(this,options.deps||{D:root.StudyAccountData,I:root.StudyAccountIdentity,S:root.StudyAccountSync,Storage:root.StudyStorage,Cache:root.StudyAccountCache});this.config=this.I.config(options.config);this.browser=options.browserStorage;this.fetcher=options.fetcher||root.fetch.bind(root);this.container=null;this.engine=null;this.busy=false;this.pending=null;this.error='';this.operation='';this.localFailure='';this.status={phase:'idle',pending:0,lastSyncedAt:0};this.generation=0;this.disposed=false;this.reauth=false;
   this.click=event=>{const b=event.target.closest?.('[data-account-action]');if(!b)return;event.preventDefault();const a=b.dataset.accountAction;if(a==='sync')this.syncNow();if(a==='logout')this.logout();if(a==='guest')this.chooseGuest(true);if(a==='cloud')this.chooseGuest(false);if(a==='reauth'){this.reauth=true;this.render();}};this.submit=event=>{if(event.target.hasAttribute?.('data-account-form')){event.preventDefault();this.login();}};this.foreground=()=>{if(root.document?.visibilityState==='visible')this.syncNow(false);};
  }
  identity(){return this.I.current(this.browser,this.config);}
  hasGuestData(guest){return Object.entries(this.D.project(guest)).some(([key,value])=>{const p=JSON.parse(key);if(p[0]==='shelf')return Object.values(value?.favorites||{}).some(Boolean);if(['lastLesson','coach','game','sentenceBatch'].includes(p[0])||p[0]==='mixedReview'&&p[1]==='session')return false;if(p[0]==='unitPractice'&&p[1]==='archives')return Array.isArray(value)&&value.length>0;if(p[0]==='grammarTranslation'&&p[1]==='session')return !!value&&typeof value==='object'&&Object.keys(value).length>0;if(p[0]==='settings'&&p[1]==='learnedRange')return Object.keys(value?.books||{}).length>0;return true;});}
  guestIssue(error){return /过大|容量|超过/.test(error?.message||'')?'本机旧记录超出同步容量限制，请先备份；也可使用账号进度继续':'本机旧记录暂时无法读取或格式异常，请先备份；也可使用账号进度继续';}
  actorMatches(before){const now=this.identity();return (now?.user.id||'')===(before?.user.id||'')&&(now?.token||'')===(before?.token||'');}
  mount(node){if(this.container){this.container.removeEventListener('click',this.click);this.container.removeEventListener('submit',this.submit);}this.container=node;node.addEventListener('click',this.click);node.addEventListener('submit',this.submit);this.render();}
  render(){if(!this.container)return;const a=this.identity();if(!this.config.enabled){this.container.innerHTML='';return;}let html='<div class="account-panel-heading"><span class="account-symbol" aria-hidden="true">☁</span><div><h2>账号与进度</h2><p>'+(a?e(a.user.username):'登录后，在不同设备继续学习')+'</p></div></div>';
   if(this.pending)html+='<div class="account-migration"><strong>迁入账号：'+e(this.pending.candidate.user.username)+'</strong><p>这台设备有本机旧记录。</p><p>可以补入账号中尚未有的记录；已有账号内容保留，本机原记录也会保留。</p><button type="button" class="button primary" data-account-action="guest">迁入本机记录</button><button type="button" class="button" data-account-action="cloud">使用账号进度</button></div>';
   else if(!a||this.reauth)html+='<form data-account-form class="account-login"><strong>登录以同步</strong><label>账号<input data-account-username name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="32" value="'+e(a?.user.username||'')+'"></label><label>密码<input data-account-password name="password" type="password" autocomplete="current-password" maxlength="128"></label><button type="submit" class="button primary">'+(this.busy?'正在连接…':'登录')+'</button><p class="account-note">使用分配给你的固定账号。</p></form>';
   else html+='<div class="account-sync-state"><p data-account-status role="status"></p><p class="account-note">最近同步：<span data-account-time>尚未同步</span></p><button type="button" class="button primary account-sync-button" data-account-action="sync">立即同步进度</button><details class="account-settings"><summary>账号设置</summary><button type="button" class="account-text-button" data-account-action="reauth">重新登录</button><button type="button" class="account-text-button" data-account-action="logout">退出账号</button><p class="account-note">退出后本机记录仍保留；账号间独立保存。</p></details></div>';
   html+='<p class="account-note" data-account-operation role="status" aria-live="polite"></p><p class="account-error" data-account-error role="alert"></p>';this.container.innerHTML=html;this.updateStatus();this.setBusy(this.busy);
  }
  updateStatus(){const s=this.status,node=this.container?.querySelector('[data-account-status]'),time=this.container?.querySelector('[data-account-time]'),error=this.container?.querySelector('[data-account-error]'),operation=this.container?.querySelector('[data-account-operation]'),upload=s.phase==='syncing'&&Number.isSafeInteger(s.total)&&s.total>0&&Number.isSafeInteger(s.completed)?'正在上传 '+Math.min(s.total,Math.max(0,s.completed))+'/'+s.total+' 项…':'';if(node)node.textContent=this.localFailure?'本机保存未完成':({idle:'本机记录已保存',syncing:upload||'正在同步进度…',synced:'进度已同步',pending:'有 '+s.pending+' 项待同步',offline:'离线保存在本机，联网后继续同步',limit:'同步记录超出限制，本机记录保留，请先备份', 'login-required':'登录已失效，本机记录保留'}[s.phase]||'本机记录已保存');if(time)time.textContent=s.lastSyncedAt?new Date(s.lastSyncedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未同步';if(error)error.textContent=this.localFailure||this.error;if(operation)operation.textContent=this.operation+(this.operation&&upload?' '+upload:'');const button=this.container?.querySelector('[data-account-action="sync"]');if(button)button.disabled=this.busy||s.phase==='syncing';}
  progress(message){this.operation=message;this.updateStatus();}
  localError(message){this.localFailure=message||'本机保存未完成，请先备份当前输入。';this.updateStatus();}
  localSaved(){this.localFailure='';this.updateStatus();}
  setBusy(value){this.busy=value;for(const button of this.container?.querySelectorAll('button')||[])button.disabled=value;this.updateStatus();}
  makeEngine(options){return this.S.create({...options,onStatus:s=>{this.status=s;this.updateStatus();}});}
  async start(){if(this.engine||!this.identity()||this.disposed)return;this.engine=this.makeEngine({identity:()=>this.identity(),storage:this.o.accountStore,key:this.I.GUEST+':account:'+this.identity().user.id,snapshot:this.o.getSnapshot,applyRemote:this.o.applyRemote,transport:this.S.transport(()=>this.identity(),this.fetcher)});const result=await this.engine.sync();if(root.document&&!this.interval){this.interval=setInterval(()=>{if(root.document.visibilityState==='visible')this.engine?.sync();},60000);this.interval.unref?.();root.addEventListener?.('online',this.foreground);root.document.addEventListener('visibilitychange',this.foreground);}return result;}
  changed(){this.engine?.changed();}
  async syncNow(showMessage=true){if(this.busy||this.disposed)return false;if(showMessage&&await this.o.flushLocal?.()===false){this.error='当前输入尚未保存，请先保存或备份。';this.updateStatus();return false;}const result=this.engine?await this.engine.sync():await this.start();if(showMessage)this.o.toast?.(result?'进度已更新':'本机记录保留，稍后继续同步');return result===true;}
  async applyStore(session,cache,key,changes,args){let source=session.read();if(!source.ok)return false;let received=this.D.receive(source.data,changes,args);if(received.correctedClock){await cache.putSnapshot(key+':pre-import',JSON.stringify({format:'zhixin-backup-v1',exportedAt:new Date().toISOString(),reason:'clock-recovery',data:source.data}));source=session.read();if(!source.ok)return false;received=this.D.receive(source.data,changes,args);}return session.commit(received.data,{replace:true,source:'cloud'}).ok;}
  async login(){
   if(this.busy||this.disposed)return false;
   const username=(this.container?.querySelector('[data-account-username]')?.value||'').trim().toLowerCase(),password=this.container?.querySelector('[data-account-password]')?.value||'',before=this.identity(),generation=++this.generation;
   this.error='';this.setBusy(true);this.progress('正在验证账号…');let temporary,openingCache,handedOff=false,stage='login';
   try{
    if(await this.o.flushLocal?.()===false)throw Error('local-save');
    const controller=new AbortController();let timer,result;
    try{
     const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('login-timeout'));},20000);});
     result=await Promise.race([(async()=>{const response=await this.fetcher(this.config.endpoint+'/v1/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password}),credentials:'omit',cache:'no-store',signal:controller.signal,referrerPolicy:'no-referrer'});if(!response.ok){const error=Error('login');error.status=response.status;throw error;}return response.json();})(),deadline]);
    }finally{clearTimeout(timer);const input=this.container?.querySelector('[data-account-password]');if(input)input.value='';}
    const candidate={endpoint:this.config.endpoint,user:result.user,token:result.token};this.I.activate({setItem(){}},this.config,candidate.user,candidate.token);
    if(before&&before.user.id!==candidate.user.id)throw Error('switch-account');
    if(generation!==this.generation||!this.actorMatches(before)||this.disposed)throw Error('identity-change');
    stage='local-cache';this.progress('账号验证已通过，正在打开本机账号记录…');
    const key=this.I.GUEST+':account:'+candidate.user.id,cache=await this.Cache.open({key,storage:this.browser});openingCache=cache;
    if(cache.getItem(key)===null)await cache.seed({words:[]},{ifEmpty:true});
    const session=this.Storage.createSession({storage:cache,key}),alive=()=>generation===this.generation&&!this.disposed&&this.actorMatches(before)?candidate:null;
    if(!alive())throw Error('identity-change');
    stage='initial-sync';this.progress('账号验证已通过，正在读取账号进度…');
    temporary=this.makeEngine({identity:alive,storage:cache,key,snapshot:()=>{const r=session.read();if(!r.ok)throw Error('local-save');return r.data;},applyRemote:(changes,args)=>this.applyStore(session,cache,key,changes,args),transport:this.S.transport(alive,this.fetcher)});
    if(!await temporary.sync()){const error=Error('initial-sync');error.phase=temporary.state?.().phase||this.status.phase;throw error;}
    temporary.stop();temporary=null;if(!alive())throw Error('identity-change');
    this.pending={candidate,key,cache,session,before,generation};handedOff=true;
    this.progress('');this.setBusy(false);
    if(!before){let hasGuest=true;try{hasGuest=this.hasGuestData(this.o.getGuestData?.()||{words:[]});}catch(error){this.error=this.guestIssue(error);}if(hasGuest){this.render();return true;}}
    return await this.chooseGuest(false);
   }catch(error){
    temporary?.stop();this.error=error.message==='switch-account'?'请先退出当前账号，再切换账号':error.message==='identity-change'?'账号已切换，本机记录保留，请重新打开页面':error.message==='local-save'?'请先保存或备份当前输入，再登录':stage==='initial-sync'?(error.phase==='login-required'?'账号验证已通过，但会话已失效，请重新登录；本机记录保留':error.phase==='limit'?'账号验证已通过，但同步记录超出容量限制；本机记录保留，请先备份':'账号验证已通过，但账号进度暂未读取完成；本机记录保留，请稍后重试同步'):stage==='local-cache'?'账号验证已通过，但本机账号缓存未能打开；请关闭其他标签页后重试':error.status===401?'账号或密码不正确':error.status===429?'尝试次数较多，请稍后再试':error.message==='login-timeout'?'登录请求超时，本机记录保留，请检查网络后重试':'登录未完成，本机记录保留，请检查网络后重试';
    return false;
   }finally{if(openingCache&&!handedOff)openingCache.close?.();const input=this.container?.querySelector('[data-account-password]');if(input)input.value='';this.progress('');this.setBusy(false);}
  }
  async chooseGuest(includeGuest){
   const p=this.pending;if(!p||this.busy||this.disposed)return false;
   const valid=()=>this.pending===p&&p.generation===this.generation&&!this.disposed&&this.actorMatches(p.before),check=()=>{if(!valid())throw Error('identity-change');};
   this.setBusy(true);this.error='';this.progress(includeGuest?'正在准备迁入本机记录…':'正在打开账号进度…');
   try{
    if(await this.o.flushLocal?.()===false)throw Error('local-save');check();
    // Let the browser paint the disabled controls and progress before CPU work.
    await new Promise(resolve=>setTimeout(resolve,0));check();
    if(includeGuest){
     let guest;try{guest=this.D.project(this.o.getGuestData?.()||{});}catch(cause){const error=Error('guest-data');error.cause=cause;throw error;}
     const read=p.session.read();if(!read.ok)throw Error('local-save');
     if(!p.snapshotSaved){await p.cache.putSnapshot(p.key+':pre-import',JSON.stringify({format:'zhixin-backup-v1',exportedAt:new Date().toISOString(),reason:'account-import',data:read.data}));p.snapshotSaved=true;}check();
     const count=Object.keys(guest).length;this.progress('正在保存 '+count+' 项本机记录；已有账号记录会保留…');
     await new Promise(resolve=>setTimeout(resolve,0));check();
     // Work against the transaction's latest account view. The cache commits
     // all field changes to IndexedDB atomically without a giant localStorage WAL.
     const saved=await p.cache.writeBatch(store=>{
      check();const session=this.Storage.createSession({storage:store,key:p.key}),current=session.read();if(!current.ok)throw Error('local-save');
      const projected=this.D.project(current.data),known=JSON.parse(store.getItem(p.key+':cloud-sync-v1')||'null')?.entries||{},changes={},encoder=new TextEncoder(),size=(key,value)=>encoder.encode(key).length+encoder.encode(JSON.stringify(value)).length;
      let total=Object.entries(projected).reduce((sum,[key,value])=>sum+size(key,value),0);
      for(const [key,value]of Object.entries(guest))if(!Object.hasOwn(projected,key)&&!Object.hasOwn(current.data._accountEdits||{},key)&&!Object.hasOwn(known,key)){total+=size(key,value);if(total>this.D.MAX_TOTAL)throw Error('sync-limit');changes[key]={value};}
      const next=this.D.apply(current.data,changes);next._accountEdits||={};const at=Math.round(Date.now()+(Number(next._accountClock?.offset)||0));
      for(const key of Object.keys(changes))next._accountEdits[key]={at:Math.max(at,(Number(next._accountEdits[key]?.at)||0)+1),id:uuid()};
      const result=session.commit(next,{replace:true,source:'cloud'});if(!result.ok)throw result.error||Error('local-save');return result;
     },{guard:valid});
     if(!saved?.ok)throw Error('local-save');check();p.session.adopt(saved.data);this.progress('本机记录已迁入账号缓存，进入后继续上传同步…');
    }
    await p.cache.flush();check();this.engine?.stop();this.I.activate(this.browser,this.config,p.candidate.user,p.candidate.token);this.pending=null;
    try{if(p.cache!==this.o.accountStore)p.cache.close?.();}catch{}this.o.reload?.();return true;
   }catch(error){this.error=error.message==='identity-change'?'账号已切换，原记录保留，请重新打开页面':error.message==='guest-data'?this.guestIssue(error.cause):error.message==='sync-limit'?'合并后的记录超出同步容量限制，原记录保留，请先备份':error.message==='local-save'?'本机记录暂未迁入，原记录保留，请先备份后重试':'账号切换未完成，原记录保留，可以重试。';return false;}
   // A transaction already committed before disposal remains safely on this
   // device; the identity guard prevents activating or uploading it afterward.
   finally{this.progress('');this.setBusy(false);if(!this.disposed)this.render();}
  }
  async logout(){if(this.busy||this.disposed)return false;this.setBusy(true);try{if(await this.o.flushLocal?.()===false){this.error='当前输入尚未保存，请先导出备份。';return false;}if(this.engine)await this.engine.sync({pull:false});await this.o.accountStore?.flush?.();const identity=this.identity();this.engine?.stop();this.generation++;if(identity)try{await this.S.transport(()=>identity,this.fetcher)('/v1/logout',{method:'POST',body:{}});}catch{}this.I.clear(this.browser,this.config);this.o.reload?.();return true;}catch{this.error='退出未完成，本机记录保留。';return false;}finally{this.setBusy(false);}}
  dispose(){if(this.disposed)return;this.pending?.cache?.close?.();this.pending=null;this.disposed=true;this.generation++;this.engine?.stop();clearInterval(this.interval);root.removeEventListener?.('online',this.foreground);root.document?.removeEventListener('visibilitychange',this.foreground);if(this.container){this.container.removeEventListener('click',this.click);this.container.removeEventListener('submit',this.submit);}}
 }
 return AccountPanel;
});
