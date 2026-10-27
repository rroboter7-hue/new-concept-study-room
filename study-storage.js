/* Compatible local storage reconciliation. Each changed field has one durable
   slot; a short transaction protects multi-field saves if quota interrupts
   materialization. The original key remains a readable, complete v1 payload. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyStorage=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const META='__studyStorage',BAD=new Set(['__proto__','prototype','constructor']);
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const pointer=parts=>JSON.stringify(parts);
 const stampCompare=(a,b)=>(Number(a?.[0])||0)-(Number(b?.[0])||0)||String(a?.[1]||'').localeCompare(String(b?.[1]||''));
 function clean(value){if(Array.isArray(value))return value.map(clean);if(!object(value))return value;const out={};for(const [key,item]of Object.entries(value))if(!BAD.has(key)&&key!==META)out[key]=clean(item);return out;}
 function keyed(rows,identity){return Object.fromEntries(rows.map((row,i)=>['entry:'+String(identity(row,i)),row]));}
 function project(raw){
  const value=clean(raw||{});
  for(const field of ['words','imported'])if(Array.isArray(value[field]))value[field]=keyed(value[field].filter(row=>field==='words'?row?.word:row?.id),row=>field==='words'?String(row.word).trim().toLowerCase():row.id);
  // These arrays represent independent identities, rather than one answer.
  if(Array.isArray(value.coach?.events))value.coach.events=keyed(value.coach.events,row=>row?.roundKey?JSON.stringify([row.roundKey,row.cardId||'']):JSON.stringify(row));
  if(Array.isArray(value.unitPractice?.archives))value.unitPractice.archives=keyed(value.unitPractice.archives,row=>row?.attemptId?JSON.stringify([row.lessonId,row.revision,row.attemptId]):JSON.stringify(row));
  for(const entry of Object.values(value.review?.daily||{}))if(Array.isArray(entry?.answered))entry.answered=keyed(entry.answered,id=>id);
  for(const entry of Object.values(value.game?.daily||{}))if(Array.isArray(entry?.passedLevels))entry.passedLevels=keyed(entry.passedLevels,id=>id);
  return value;
 }
 function flatten(value,parts=[],out={}){const entity=parts.length===2&&['words','imported'].includes(parts[0])||parts.length===3&&(parts[0]==='coach'&&parts[1]==='events'||parts[0]==='unitPractice'&&parts[1]==='archives'||parts[0]==='review'&&parts[1]==='cards');if(object(value)&&Object.keys(value).length&&!entity){for(const [key,item]of Object.entries(value))flatten(item,[...parts,key],out);}else if(parts.length)out[pointer(parts)]=clone(value);return out;}
 function materialize(leaves){
  const value={};for(const [path,item]of Object.entries(leaves).sort((a,b)=>JSON.parse(a[0]).length-JSON.parse(b[0]).length)){const parts=JSON.parse(path);let branch=value;for(const key of parts.slice(0,-1)){if(!object(branch[key]))branch[key]={};branch=branch[key];}branch[parts.at(-1)]=clone(item);}
  for(const field of ['words','imported'])if(object(value[field]))value[field]=Object.values(value[field]);
  if(object(value.coach?.events))value.coach.events=Object.values(value.coach.events);
  if(object(value.unitPractice?.archives))value.unitPractice.archives=Object.values(value.unitPractice.archives);
  for(const entry of Object.values(value.review?.daily||{}))if(object(entry?.answered))entry.answered=Object.values(entry.answered);
  for(const entry of Object.values(value.game?.daily||{}))if(object(entry?.passedLevels))entry.passedLevels=Object.values(entry.passedLevels);
  return value;
 }
 function changes(base,next){const before=flatten(project(base)),after=flatten(project(next)),patch={};for(const key of new Set([...Object.keys(before),...Object.keys(after)])){if(equal(before[key],after[key]))continue;patch[key]=Object.hasOwn(after,key)?{value:clone(after[key])}:{deleted:true};}return patch;}
 function cardPreference(path,op,current,version){const parts=JSON.parse(path);if(parts.length!==3||parts[0]!=='review'||parts[1]!=='cards'||op.deleted||!Number.isInteger(op.value?.revision)||!Number.isInteger(current?.revision)||op.stamp?.[2]===1)return 0;if(version?.[2]===1&&stampCompare(op.stamp,version)<=0)return -1;return Math.sign(op.value.revision-current.revision);}
 function reconcile(base,next,latest){const leaves=flatten(project(latest));for(const [path,op]of Object.entries(changes(base,next))){if(cardPreference(path,op,leaves[path])<0)continue;if(op.deleted)delete leaves[path];else leaves[path]=clone(op.value);}return materialize(leaves);}
 function withDefaults(saved,next){const leaves=flatten(project(saved.data));for(const [path,value]of Object.entries(flatten(project(next)))){if(Object.hasOwn(leaves,path)||saved.versions[path])continue;const parts=JSON.parse(path),blocked=parts.slice(1).some((_,i)=>{const parent=leaves[pointer(parts.slice(0,i+1))];return parent!==undefined&&(!object(parent)||Object.keys(parent).length>0);});if(!blocked)leaves[path]=clone(value);}return materialize(leaves);}
 function validOp(path,op){let parts;try{parts=JSON.parse(path);}catch{return false;}return Array.isArray(parts)&&parts.length>0&&parts.every(key=>typeof key==='string'&&!BAD.has(key)&&key!==META)&&object(op)&&Array.isArray(op.stamp)&&Number.isFinite(op.stamp[0])&&typeof op.stamp[1]==='string'&&(op.deleted===true||Object.hasOwn(op,'value'));}
 function read({storage,key='zhixin-study-v1'}){
  try{
   const source=storage.getItem(key),raw=source===null?{}:JSON.parse(source);if(!object(raw))throw Error('存储资料格式异常');
   const leaves=flatten(project(raw)),versions={};for(const [path,stamp]of Object.entries(object(raw[META]?.fields)?raw[META].fields:{}))if(validOp(path,{stamp,deleted:true}))versions[path]=stamp;
   const operations=[];for(let i=0;i<storage.length;i++){
    const name=storage.key(i);if(name?.startsWith(key+':field:')){
     const op=JSON.parse(storage.getItem(name)),suffix=name.slice((key+':field:').length),path=op.path||(suffix.startsWith('[')?suffix:decodeURIComponent(suffix));if(!validOp(path,op))throw Error('保存字段格式异常');operations.push([path,op]);
    }else if(name?.startsWith(key+':pending:')){
     const transaction=JSON.parse(storage.getItem(name));if(!object(transaction?.operations))throw Error('待保存资料格式异常');for(const [path,op]of Object.entries(transaction.operations)){if(!validOp(path,op))throw Error('待保存字段格式异常');operations.push([path,op]);}
    }
   }
   // Read earlier scalar-card journals too. Once a complete card is saved,
   // its stamp supersedes older scalar entries without deleting their keys.
   const newest={...versions};for(const [path,op]of operations)if(stampCompare(op.stamp,newest[path])>0)newest[path]=op.stamp;
   operations.sort((a,b)=>stampCompare(a[1].stamp,b[1].stamp));for(const [path,op]of operations){const parts=JSON.parse(path),card=parts.length>3&&parts[0]==='review'&&parts[1]==='cards'?pointer(parts.slice(0,3)):null,preference=cardPreference(path,op,leaves[path],versions[path]);if(card&&stampCompare(newest[card],op.stamp)>0||preference<0||preference===0&&stampCompare(op.stamp,versions[path])<=0)continue;if(op.deleted)delete leaves[path];else leaves[path]=clone(op.value);versions[path]=op.stamp;}
   return {ok:true,data:materialize(leaves),versions};
  }catch(error){return {ok:false,data:{},error};}
 }
 function mergeBackup(local,incoming,conflicts){if(equal(local,incoming))return clone(local);if(local===undefined)return clone(incoming);if(incoming===undefined)return clone(local);if(object(local)&&object(incoming)){const out={};for(const key of new Set([...Object.keys(incoming),...Object.keys(local)]))out[key]=mergeBackup(local[key],incoming[key],conflicts);return out;}conflicts.count++;return clone(local);}
 function previewBackup(local,raw,{mode='merge'}={}){if(!object(raw)||(raw.format!==undefined&&raw.format!=='zhixin-backup-v1')||!object(raw.data)||!Array.isArray(raw.data.words))throw Error('备份缺少生词数据。');if(mode!=='merge'&&mode!=='replace')throw Error('请选择合并或替换。');const incoming=clean(raw.data),conflicts={count:0},data=mode==='replace'?incoming:materialize(flatten(mergeBackup(project(local),project(incoming),conflicts))),summary={conflicts:conflicts.count};for(const field of ['words','records','imported','sentencePractice','sentenceBatch','sentenceBatches','coachDrafts']){const a=project(local)[field]||{},b=project(incoming)[field]||{};summary[field]={local:Object.keys(a).length,backup:Object.keys(b).length,added:Object.keys(b).filter(k=>!Object.hasOwn(a,k)).length};}const dates=Object.values(incoming.records||{}).map(record=>Number(record?.lastAt)||Number(record?.lastReadAt)||0).filter(Boolean);return {mode,data,summary,exportedAt:typeof raw.exportedAt==='string'?raw.exportedAt:null,recordDateRange:dates.length?[Math.min(...dates),Math.max(...dates)]:null,source:clone(raw)};}
 function createSession({storage,key='zhixin-study-v1',writer=String(Date.now())+'-'+Math.random().toString(36).slice(2),initial}={}){
  let baseline=clone(initial),counter=0;const transactionKey=key+':pending:'+writer,snapshotKey=key+':pre-import';
  function load(){const result=read({storage,key});if(result.ok&&baseline===undefined)baseline=clone(result.data);return result;}
  function commit(next,{replace=false}={}){const latest=load();if(!latest.ok)return latest;const patch=changes(replace?latest.data:baseline,next),latestLeaves=flatten(project(latest.data));if(!replace)for(const [path,op]of Object.entries(patch))if(cardPreference(path,op,latestLeaves[path])<0)delete patch[path];const paths=Object.keys(patch);let operations={};try{const pending=storage.getItem(transactionKey);if(pending)operations=JSON.parse(pending).operations;}catch(error){return {ok:false,data:latest.data,error};}if(!paths.length&&!Object.keys(operations).length){const data=withDefaults(latest,next);try{storage.setItem(key,JSON.stringify({...data,[META]:{version:1,fields:latest.versions}}));}catch(error){return {ok:false,data:latest.data,error};}baseline=clone(next);return {...latest,data,local:clone(next)};}counter=Object.values(latest.versions).reduce((max,stamp)=>Math.max(max,Number(stamp[0])||0),counter)+1;for(const path of paths)operations[path]={...patch[path],stamp:[counter,writer,...(replace?[1]:[])]};try{storage.setItem(transactionKey,JSON.stringify({version:1,operations}));}catch(error){return {ok:false,data:latest.data,error};}
   // Once the complete transaction is durable, a later quota error cannot lose
   // it. Readers replay pending transactions as well as compact field slots.
   let pending=false,slotsComplete=false;try{for(const [path,op]of Object.entries(operations)){const slot=key+':field:'+path,existing=storage.getItem(slot),previous=existing?JSON.parse(existing):null,preference=previous?cardPreference(path,op,previous.value,previous.stamp):0;if(previous&&(preference<0||preference===0&&stampCompare(previous.stamp,op.stamp)>0))continue;storage.setItem(slot,JSON.stringify(op));}slotsComplete=true;}catch{pending=true;}
   const saved=read({storage,key});if(!saved.ok)return {...saved,pending:true};const data=withDefaults(saved,next);try{storage.setItem(key,JSON.stringify({...data,[META]:{version:1,fields:saved.versions}}));if(slotsComplete)storage.removeItem(transactionKey);}catch{pending=true;}baseline=clone(next);return {...saved,data,ok:true,local:clone(next),pending};
  }
  function sync(local){const latest=load();if(!latest.ok)return latest;const data=reconcile(baseline,local,latest.data);baseline=clone(latest.data);return {...latest,data};}
  function snapshot(){try{const raw=JSON.parse(storage.getItem(snapshotKey));if(!object(raw?.data)||raw.format!=='zhixin-backup-v1')return null;return raw;}catch{return null;}}
  function importBackup(preview,{local}={}){const latest=load();if(!latest.ok)return latest;const before=local?reconcile(baseline,local,latest.data):latest.data;let prepared;try{prepared=previewBackup(before,preview.source,{mode:preview.mode});storage.setItem(snapshotKey,JSON.stringify({format:'zhixin-backup-v1',exportedAt:new Date().toISOString(),reason:'pre-import',data:before}));}catch(error){return {ok:false,data:before,error};}return commit(prepared.data,{replace:true});}
  return {read:load,commit,sync,previewLocal(local){const latest=load();return latest.ok?{...latest,data:reconcile(baseline,local,latest.data)}:latest;},adopt:value=>{baseline=clone(value);},importBackup,recoverySnapshot:snapshot,restoreSnapshot(){const previous=snapshot();if(!previous)return {ok:false,error:Error('没有可恢复的导入前备份。')};return commit(previous.data,{replace:true});},matchesKey:name=>name===null||name===key||name.startsWith(key+':field:')||name.startsWith(key+':pending:')};
 }
 return {createSession,read,reconcile,previewBackup,clone};
});
