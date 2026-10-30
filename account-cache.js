/* Account-local Storage facade. Large profiles live in IndexedDB; synchronous
   learner writes first enter a small localStorage write-ahead journal. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyAccountCache=api;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const peers=new Set(), STORE='slots';
 const binary=(a,b)=>a===b?0:a>b?1:-1;
 const compare=(a,b)=>(Number(a?.[0])||0)-(Number(b?.[0])||0)||binary(String(a?.[1]||''),String(b?.[1]||''));
 function connect(indexedDB,name){return new Promise((resolve,reject)=>{
  if(!indexedDB?.open){reject(Error('IndexedDB is unavailable; account data cannot be saved.'));return;}
  let settled=false,request;
  try{request=indexedDB.open(name,1);}catch(error){reject(error);return;}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'name'});};
  request.onerror=()=>{settled=true;reject(request.error||Error('IndexedDB could not be opened.'));};
  request.onblocked=()=>{settled=true;reject(Error('IndexedDB open is blocked by another tab.'));};
  request.onsuccess=()=>{if(settled)request.result.close();else{settled=true;resolve(request.result);}};
 });}
 function transact(db,mode,work){return new Promise((resolve,reject)=>{
  let transaction;
  try{transaction=db.transaction(STORE,mode);transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error||Error('IndexedDB transaction aborted.'));transaction.onerror=()=>{};work(transaction.objectStore(STORE));}
  catch(error){try{transaction?.abort();}catch{}reject(error);}
 });}
 async function open(options={}){
  const {key,storage,onExternal,onError}=options,indexedDB=Object.hasOwn(options,'indexedDB')?options.indexedDB:root.indexedDB;
  if(typeof key!=='string'||!key||!storage?.getItem||!storage?.setItem)throw Error('An account key and durable localStorage are required.');
  const prefix='study-account-cache:wal:'+encodeURIComponent(key)+':',signal=prefix+'!refresh',writer=String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const db=await connect(indexedDB,'study-account-cache:'+key),records=new Map(),values=new Map();
  let clock=0,closed=false,timer=null,flushing=null,refreshing=null;
  const owns=name=>name===key||typeof name==='string'&&name.startsWith(key+':');
  const walName=name=>prefix+encodeURIComponent(name);
  const report=error=>{try{onError?.(error);}catch{}};
  const notify=()=>{try{onExternal?.();}catch(error){report(error);}};
  function assertOpen(){if(closed)throw Error('Account cache is closed.');}
  function decode(raw){const op=JSON.parse(raw);if(!op||!owns(op.name)||!Array.isArray(op.stamp)||!Number.isFinite(op.stamp[0])||typeof op.stamp[1]!=='string'||op.value!==null&&typeof op.value!=='string')throw Error('Account recovery journal is invalid.');return op;}
  function apply(op){clock=Math.max(clock,op.stamp[0]);const previous=records.get(op.name);if(previous&&compare(previous.stamp,op.stamp)>=0)return false;records.set(op.name,op);if(op.value===null)values.delete(op.name);else values.set(op.name,op.value);return true;}
  function journal(){const entries=[];for(let i=0;i<storage.length;i++){const name=storage.key(i);if(name?.startsWith(prefix)&&name!==signal){const raw=storage.getItem(name);if(raw!==null)entries.push({name,raw,op:decode(raw)});}}return entries;}
  function recover(){let changed=false;for(const {op}of journal())changed=apply(op)||changed;return changed;}
  function nextStamp(){recover();return [clock=Math.max(clock+1,Date.now()),writer];}
  function schedule(){if(closed||timer!==null)return;timer=setTimeout(()=>{timer=null;flush().catch(report);},20);timer.unref?.();}
  const peer={key,storage,receive(op){if(closed)return;if(apply(op)){notify();schedule();}},refresh(){return refresh();}};
  function broadcast(op){for(const other of peers)if(other!==peer&&other.storage===storage&&other.key===key)other.receive(op);}
  function invalidate(stamp){
   // Other browser realms fetch bulk records instead of receiving their bytes
   // through the bounded localStorage journal.
   try{storage.setItem(signal,JSON.stringify(stamp));storage.removeItem(signal);}catch(error){report(error);}
   for(const other of peers)if(other!==peer&&other.storage===storage&&other.key===key)other.refresh().catch(report);
  }
  async function readRows(){let rows=[];await transact(db,'readonly',store=>{const request=store.getAll();request.onsuccess=()=>{rows=request.result;};});return rows;}
  async function refresh(){
   if(closed)return;
   if(refreshing)return refreshing;
   refreshing=(async()=>{let changed=false;for(const op of await readRows())changed=apply(op)||changed;changed=recover()||changed;if(changed)notify();})().finally(()=>{refreshing=null;});
   return refreshing;
  }
  function eventHandler(event){
   if(closed||event.storageArea&&event.storageArea!==storage||!event.key?.startsWith(prefix))return;
   try{if(event.key===signal){refresh().catch(report);return;}const raw=event.newValue??event.oldValue;if(raw&&apply(decode(raw)))notify();if(event.newValue!==null)schedule();}catch(error){report(error);}
  }
  async function flush(){
   assertOpen();if(timer!==null){clearTimeout(timer);timer=null;}
   // Each batch contains only live durable journal entries, never a stale map
   // snapshot. Versioned tombstones stop a late flush resurrecting a removal.
   if(flushing){await flushing;if(journal().length)return flush();return;}
   const entries=journal();for(const {op}of entries)apply(op);if(!entries.length)return;
   flushing=(async()=>{
    await transact(db,'readwrite',store=>{for(const {op}of entries){const request=store.get(op.name);request.onsuccess=()=>{if(!request.result||compare(request.result.stamp,op.stamp)<0)store.put(op);};}});
    for(const entry of entries)if(storage.getItem(entry.name)===entry.raw)storage.removeItem(entry.name);
   })();
   try{await flushing;}finally{flushing=null;}
  }
  function setItem(name,value){
   assertOpen();name=String(name);value=String(value);if(!owns(name))throw Error('Account cache cannot write another profile.');recover();
   // StudyStorage has already durably written pending/field slots before it
   // materializes the full base JSON. Keeping that redundant image in memory
   // avoids copying megabytes into a 5 MiB localStorage origin.
   if(name===key&&[...values.keys()].some(slot=>slot.startsWith(key+':field:')||slot.startsWith(key+':pending:'))){values.set(name,value);return;}
   const op={name,value,stamp:nextStamp()},raw=JSON.stringify(op);
   storage.setItem(walName(name),raw); // May throw: nothing visible changed yet.
   apply(op);broadcast(op);schedule();
  }
  function removeItem(name){
   assertOpen();name=String(name);if(!owns(name))throw Error('Account cache cannot remove another profile.');recover();if(!values.has(name))return;
   const op={name,value:null,stamp:nextStamp()};storage.setItem(walName(name),JSON.stringify(op));apply(op);broadcast(op);schedule();
  }
  async function seed(data,{ifEmpty=false}={}){
   assertOpen();const value=JSON.stringify(data);if(typeof value!=='string')throw Error('Account seed must be JSON data.');
   if(flushing)await flushing;
   recover();const stamp=nextStamp(),base={name:key,value,stamp},entries=journal(),known=[...records.keys()];
   let replaced=[],won=false;
   await transact(db,'readwrite',store=>{const request=store.getAll();request.onsuccess=()=>{
    const prior=new Map(request.result.map(op=>[op.name,op])),persisted=prior.get(key);
    // Initialization and the existence check share this transaction, so a
    // second login tab cannot replace a profile created while it was opening.
    if(ifEmpty&&persisted&&persisted.value!==null)return;
    // Seeds from another tab can commit while this call waits for its IDB
    // transaction. The same ordering rule must guard the base, tombstones,
    // WAL acknowledgement and notifications as one replacement operation.
    if(persisted&&compare(persisted.stamp,stamp)>=0)return;
    won=true;for(const name of known)if(!prior.has(name))prior.set(name,records.get(name));
    replaced=[];for(const [name,previous]of prior){if(name===key||compare(previous.stamp,stamp)>0)continue;const op={name,value:null,stamp};store.put(op);replaced.push(op);}store.put(base);
   };});
   // A failed IDB transaction leaves both memory and the recovery WAL intact.
   if(!won){await refresh();return;}
   for(const op of [...replaced,base]){apply(op);broadcast(op);}
   for(const entry of entries)if(compare(entry.op.stamp,stamp)<=0&&storage.getItem(entry.name)===entry.raw)storage.removeItem(entry.name);
   // Storage events carry only a small invalidation; other tabs fetch the bulk
   // seed from IndexedDB. A full localStorage origin cannot undo a saved seed.
   invalidate(stamp);
  }
  async function putSnapshot(name,value){
   assertOpen();if(name!==key+':pre-import')throw Error('Only this account pre-import recovery snapshot may be written asynchronously.');
   const op={name,value:String(value),stamp:nextStamp()};let won=false;
   await transact(db,'readwrite',store=>{const request=store.get(name);request.onsuccess=()=>{
    if(request.result&&compare(request.result.stamp,op.stamp)>=0)return;
    won=true;store.put(op);
   };});
   // No localStorage WAL and no visible/broadcast replacement precedes the
   // IDB commit, so a quota/transaction abort preserves the previous backup.
   if(!won){await refresh();return;}
   apply(op);broadcast(op);invalidate(op.stamp);
  }
  try{for(const op of await readRows())apply(op);recover();}catch(error){db.close();throw error;}
  db.onversionchange=()=>{close();report(Error('Account IndexedDB version changed. Reopen the account.'));};
  function close(){if(closed)return;closed=true;if(timer!==null)clearTimeout(timer);peers.delete(peer);root.removeEventListener?.('storage',eventHandler);db.close();}
  peers.add(peer);root.addEventListener?.('storage',eventHandler);if(journal().length)schedule();
  return {get length(){assertOpen();recover();return values.size;},key(i){assertOpen();recover();return [...values.keys()][Number(i)]??null;},getItem(name){assertOpen();recover();return values.get(String(name))??null;},setItem,removeItem,flush,seed,putSnapshot,close};
 }
 return {open};
});
