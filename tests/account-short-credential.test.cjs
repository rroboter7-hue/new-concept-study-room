'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database}=require('./support/account-d1.cjs');
const pepper='synthetic-short-credential-pepper-32-bytes',password='F7mQ3xB9';
test('short credentials are versioned, randomly salted, peppered and bound to the stable account ID',async()=>{
 const W=await import('../cloud-account/worker.mjs');assert.equal(typeof W.makeCredential,'function');assert.equal(typeof W.verifyCredential,'function');
 const a=await W.makeCredential(pepper,'u_alice',password),b=await W.makeCredential(pepper,'u_alice',password);
 assert.match(a,/^v2\$hmac-sha256\$[0-9a-f]{32}\$[0-9a-f]{64}$/);assert.notEqual(a,b);assert(!a.includes(password));
 assert(await W.verifyCredential(pepper,'u_alice',password,a));assert(!await W.verifyCredential(pepper,'u_bravo',password,a));assert(!await W.verifyCredential('different-synthetic-pepper','u_alice',password,a));assert(!await W.verifyCredential(pepper,'u_alice','N6rT2pA8',a));
 for(const broken of [a.replace('v2$','v3$'),a.replace('hmac-sha256','pbkdf2-sha256$20000'),a.replace(/\$[0-9a-f]{32}\$/,'$bad$')])assert(!await W.verifyCredential(pepper,'u_alice',password,broken));
 const legacy=await W.verifier(pepper,'u_alice','a'.repeat(43));assert(await W.verifyCredential(pepper,'u_alice','a'.repeat(43),legacy));assert(!await W.verifyCredential(pepper,'u_alice',password,await W.verifier(pepper,'u_alice',password)));
});
async function fixture(t){const W=await import('../cloud-account/worker.mjs'),DB=database(fs.readFileSync(path.join(__dirname,'../cloud-account/schema.sql'),'utf8'));t.after(()=>DB.raw.close());const env={DB,PASSWORD_PEPPER:pepper,ALLOWED_ORIGINS:'https://rroboter7-hue.github.io'};async function call(route,body,token){const headers={Origin:env.ALLOWED_ORIGINS};if(body)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;const r=await W.default.fetch(new Request('https://sync.example'+route,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,data:await r.json()};}return{W,DB,call};}
test('an 8-character fixed secret logs in, session stays 43 characters, and the ninth attempt is limited',async t=>{
 const f=await fixture(t);assert.equal(typeof f.W.makeCredential,'function');f.DB.raw.prepare('INSERT INTO accounts(id,username,verifier) VALUES(?,?,?)').run('u_alice','a01',await f.W.makeCredential(pepper,'u_alice',password));
 const login=await f.call('/v1/login',{username:'a01',password});assert.equal(login.status,200);assert.match(login.data.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(login.data.user.id,'u_alice');assert.equal((await f.call('/v1/me',undefined,password)).status,401);
 let last;for(let i=0;i<8;i++)last=await f.call('/v1/login',{username:'a01',password:'N6rT2pA8'});assert.equal(last.status,429);
});
test('a credential changed after lookup cannot create a fresh session from the old secret',async t=>{
 const f=await fixture(t),legacy='a'.repeat(43);f.DB.raw.prepare('INSERT INTO accounts(id,username,verifier) VALUES(?,?,?)').run('u_alice','alice',await f.W.verifier(pepper,'u_alice',legacy));
 const original=f.DB.prepare.bind(f.DB);let rotated=false;f.DB.prepare=sql=>{const s=original(sql);if(/^SELECT id,username,verifier FROM accounts/.test(sql)){const read=s.first.bind(s);s.first=async()=>{const row=await read();if(!rotated){rotated=true;f.DB.raw.prepare('UPDATE accounts SET username=?,verifier=? WHERE id=?').run('a01','f'.repeat(64),'u_alice');}return row;};}return s;};
 assert.equal((await f.call('/v1/login',{username:'alice',password:legacy})).status,401);assert.equal(rotated,true);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
});
