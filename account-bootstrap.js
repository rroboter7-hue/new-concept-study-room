/* Synchronous local partition selection; no network or login dependency on first paint. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyAccountIdentity=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';const GUEST='zhixin-study-v1',ACTIVE='zhixin-account-v1';
 function config(raw={}){try{const u=new URL(raw.endpoint);if(!raw.enabled||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.protocol!=='https:'&&!(raw.allowLocal&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))return {enabled:false};return {enabled:true,endpoint:u.origin,...(raw.allowLocal?{allowLocal:true}:{})};}catch{return {enabled:false};}}
 const userOK=u=>u&&typeof u.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(u.id)&&typeof u.username==='string'&&/^[a-z][a-z0-9_-]{2,31}$/.test(u.username);
 function current(storage,raw){const c=config(raw);if(!c.enabled)return null;try{const a=JSON.parse(storage.getItem(ACTIVE));return a?.endpoint===c.endpoint&&userOK(a.user)&&typeof a.token==='string'&&a.token.length>0&&a.token.length<500?{endpoint:a.endpoint,user:{id:a.user.id,username:a.user.username},token:a.token}:null;}catch{return null;}}
 function key(storage,c){const a=current(storage,c);return a?GUEST+':account:'+a.user.id:GUEST;}
 function activate(storage,raw,user,token){const c=config(raw);if(!c.enabled||!userOK(user)||typeof token!=='string'||!token||token.length>=500)throw Error('账号资料异常');storage.setItem(ACTIVE,JSON.stringify({endpoint:c.endpoint,user:{id:user.id,username:user.username},token}));}
 function clear(storage){storage.removeItem(ACTIVE);}
 function decorator({dataCore,now=Date.now,id=()=>crypto.randomUUID()}={}){return (patch,{latest})=>{const extra={},keys=new Set(Object.keys(patch).map(path=>dataCore.entityKeyForPath(path)).filter(Boolean)),offset=Number(latest?._accountClock?.offset)||0;for(const key of keys){const previous=latest?._accountEdits?.[key],at=Math.max(Math.round(now()+offset),(Number(previous?.at)||0)+1);extra[JSON.stringify(['_accountEdits',key])]={value:{at,id:id()}};}return extra;};}
 return Object.freeze({config,current,key,activate,clear,decorator,ACTIVE,GUEST});
});
