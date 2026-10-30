import Data from '../account-data.js';
const encoder=new TextEncoder(),DAY=86400000,MAX_BODY=280*1024;
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function verifier(pepper,id,password){const k=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,encoder.encode('zhixin-credential-v1\0'+id+'\0'+password)));}
const SHORT_PASSWORD=/^[A-Za-z0-9]{8}$/;
const LEGACY_PASSWORD=/^[A-Za-z0-9_-]{43}$/;
const V2_CREDENTIAL=/^v2\$hmac-sha256\$([0-9a-f]{32})\$([0-9a-f]{64})$/;
const DUMMY_CREDENTIAL='v2$hmac-sha256$'+'0'.repeat(32)+'$'+'0'.repeat(64);
async function shortTag(pepper,id,password,salt){
 const pepperKey=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',pepperKey,encoder.encode('zhixin-assigned-credential-v2\0'+id+'\0'+salt+'\0'+password)));
}
export async function makeCredential(pepper,id,password){
 if(!SHORT_PASSWORD.test(password))throw new Error('Fixed credentials require an 8-character alphanumeric secret');
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
 return 'v2$hmac-sha256$'+salt+'$'+await shortTag(pepper,id,password,salt);
}
export async function verifyCredential(pepper,id,password,stored){
 if(typeof password!=='string'||typeof stored!=='string')return false;
 const v2=V2_CREDENTIAL.exec(stored);
 if(v2)return SHORT_PASSWORD.test(password)&&same(await shortTag(pepper,id,password,v2[1]),v2[2]);
 if(/^[0-9a-f]{64}$/.test(stored)&&LEGACY_PASSWORD.test(password))return same(await verifier(pepper,id,password),stored);
 return false;
}
async function hash(token){return hex(await crypto.subtle.digest('SHA-256',encoder.encode('zhixin-session-v1\0'+token)));}
function same(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;let n=0;for(let i=0;i<64;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
function fault(status,message){const e=new Error(message);e.status=status;throw e;}
async function jsonBody(request){if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fault(415,'请求格式异常');if(Number(request.headers.get('content-length'))>MAX_BODY)fault(413,'单项记录过大');let text='',size=0;const reader=request.body?.getReader(),decoder=new TextDecoder();if(!reader)fault(400,'缺少请求内容');for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();fault(413,'单项记录过大');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();try{const b=JSON.parse(text);if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}catch{fault(400,'请求格式异常');}}
const publicUser=u=>({id:u.id,username:u.username});
const entry=row=>({key:row.key,version:row.version,deleted:row.deleted===1,modifiedAt:row.modified_at,writeId:row.write_id,...(row.deleted===1?{}:{value:JSON.parse(row.payload)})});
async function throttle(db,pepper,ip,username,now){const window=Math.floor(now/(15*60000));for(const [scope,limit]of [['ip:'+ip,60],['account:'+username,8]]){const bucket=await verifier(pepper,'rate',scope),r=await db.prepare('INSERT INTO login_attempts(bucket,window,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(bucket,window).first();if(r.count>limit)fault(429,'尝试次数较多，请稍后再试');}await db.prepare('DELETE FROM login_attempts WHERE bucket IN(SELECT bucket FROM login_attempts WHERE window<? LIMIT 100)').bind(window-96).run();}
async function owner(request,db,now){const auth=request.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))fault(401,'请重新登录以继续同步');const tokenHash=await hash(auth.slice(7)),u=await db.prepare('SELECT a.id,a.username,a.used_bytes,a.entity_count,a.revision FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.enabled=1').bind(tokenHash,now).first();if(!u)fault(401,'登录已失效，请重新登录');return {...u,tokenHash};}
async function route(request,env,url){const db=env.DB,now=Date.now();if(url.pathname==='/health'&&request.method==='GET')return {service:'zhixin-account-sync',version:1,serverTime:now};if(!db||typeof env.PASSWORD_PEPPER!=='string'||env.PASSWORD_PEPPER.length<32)fault(503,'云端账号尚未配置');
 if(url.pathname==='/v1/login'&&request.method==='POST'){
  const b=await jsonBody(request),name=typeof b.username==='string'?b.username.trim().toLowerCase():'';
  await throttle(db,env.PASSWORD_PEPPER,request.headers.get('CF-Connecting-IP')||'local',name.slice(0,40),now);
  if(!/^[a-z][a-z0-9_-]{2,31}$/.test(name)||typeof b.password!=='string'||!(SHORT_PASSWORD.test(b.password)||LEGACY_PASSWORD.test(b.password)))fault(401,'账号或密码不正确');
  const u=await db.prepare('SELECT id,username,verifier FROM accounts WHERE username=? AND enabled=1').bind(name).first();
  const valid=await verifyCredential(env.PASSWORD_PEPPER,u?.id||'unknown',b.password,u?.verifier||(SHORT_PASSWORD.test(b.password)?DUMMY_CREDENTIAL:'0'.repeat(64)));
  if(!u||!valid)fault(401,'账号或密码不正确');
  const token=random(),expiresAt=now+30*DAY;
  await db.prepare('DELETE FROM sessions WHERE token_hash IN(SELECT token_hash FROM sessions WHERE user_id=? AND (expires_at<=? OR token_hash NOT IN(SELECT token_hash FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 9)))').bind(u.id,now,u.id).run();
  // The credential may rotate while hashing. Insert only if the verified row is still current.
  const inserted=await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) SELECT ?,id,?,? FROM accounts WHERE id=? AND username=? AND enabled=1 AND verifier=?').bind(await hash(token),now,expiresAt,u.id,u.username,u.verifier).run();
  if(inserted.meta?.changes!==1)fault(401,'账号或密码不正确');
  return {user:publicUser(u),token,expiresAt,serverTime:now};
 }
 const u=await owner(request,db,now),result={user:publicUser(u),serverTime:now};
 if(url.pathname==='/v1/me'&&request.method==='GET')return {...result,usedBytes:u.used_bytes,entityCount:u.entity_count};
 if(url.pathname==='/v1/logout'&&request.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(u.tokenHash).run();return {...result,ok:true};}
 if(url.pathname==='/v1/manifest'&&['GET','POST'].includes(request.method)){const input=request.method==='POST'?await jsonBody(request):{},after=input.after||url.searchParams.get('after')||'';if(!after&&input.knownVersion===u.revision)return {...result,entries:[],next:'',version:u.revision,unchanged:true};if(after&&!Data.validKey(after))fault(400,'分页标记异常');const rows=(await db.prepare('SELECT key,version,deleted,modified_at,write_id FROM entries WHERE user_id=? AND key>? ORDER BY key LIMIT 101').bind(u.id,after).all()).results;const entries=[];let bytes=0;for(const row of rows.slice(0,100)){const item={key:row.key,version:row.version,deleted:row.deleted===1,modifiedAt:row.modified_at,writeId:row.write_id};const size=encoder.encode(JSON.stringify(item)).length;if(entries.length&&bytes+size>128*1024)break;entries.push(item);bytes+=size;}return {...result,entries,next:rows.length>entries.length?entries.at(-1)?.key||'':'',usedBytes:u.used_bytes,version:u.revision};}
 if(url.pathname==='/v1/read'&&request.method==='POST'){const b=await jsonBody(request);if(!Array.isArray(b.keys)||!b.keys.length||b.keys.length>16||b.keys.some(k=>!Data.validKey(k)))fault(400,'记录标记异常');const keys=[...new Set(b.keys)],rows=(await db.prepare('SELECT key,version,payload,deleted,modified_at,write_id FROM entries WHERE user_id=? AND key IN('+keys.map(()=>'?').join(',')+') ORDER BY key').bind(u.id,...keys).all()).results;const entries=[];let bytes=0;for(const row of rows){const item=entry(row),size=encoder.encode(JSON.stringify(item)).length;if(entries.length&&bytes+size>512*1024)break;entries.push(item);bytes+=size;}return {...result,entries,remaining:keys.filter(k=>!entries.some(e=>e.key===k)&&rows.some(r=>r.key===k))};}
 if(url.pathname==='/v1/entry'&&request.method==='PUT'){const b=await jsonBody(request);if(!Data.validKey(b.key)||!Number.isSafeInteger(b.modifiedAt)||b.modifiedAt<1577836800000||b.modifiedAt>now+300000||typeof b.writeId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(b.writeId)||b.deleted!==undefined&&typeof b.deleted!=='boolean')fault(400,'记录版本异常');let payload='null';if(b.deleted!==true){try{const safe=Data.apply({}, {[b.key]:{value:b.value}});Data.project(safe);payload=JSON.stringify(Data.validate(b.value));}catch(e){fault(/过大|容量/.test(e.message)?413:400,'记录格式或大小不符合要求');}}
  await db.prepare('INSERT INTO entries(user_id,key,version,payload,deleted,modified_at,write_id) VALUES(?,?,1,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET version=entries.version+1,payload=excluded.payload,deleted=excluded.deleted,modified_at=excluded.modified_at,write_id=excluded.write_id WHERE excluded.modified_at>entries.modified_at OR (excluded.modified_at=entries.modified_at AND excluded.write_id>entries.write_id)').bind(u.id,b.key,payload,b.deleted===true?1:0,b.modifiedAt,b.writeId).run();const current=await db.prepare('SELECT key,version,payload,deleted,modified_at,write_id FROM entries WHERE user_id=? AND key=?').bind(u.id,b.key).first();return {...result,entry:entry(current)};
 }
 fault(404,'接口不存在');
}
export default {async fetch(request,env){const origin=request.headers.get('origin'),allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;try{const url=new URL(request.url);if(origin&&!allowed.includes(origin))fault(403,'当前来源未获允许');if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))fault(400,'请使用安全连接');if(request.method==='OPTIONS'){if(!origin)fault(403,'当前来源未获允许');return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}});}return new Response(JSON.stringify(await route(request,env,url)),{headers});}catch(e){const quota=String(e.message).includes('ACCOUNT_QUOTA');return new Response(JSON.stringify({error:e.status?e.message:quota?'账号同步容量不足，请先导出备份':'云端暂时不可用，请稍后重试',serverTime:Date.now()}),{status:e.status|| (quota?413:503),headers});}}};
