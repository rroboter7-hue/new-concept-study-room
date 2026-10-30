'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database}=require('./support/account-d1.cjs');
const pepper='synthetic-rotation-pepper-at-least-32-bytes';
async function fixture(t){
 const DB=database(fs.readFileSync(path.join(__dirname,'../cloud-account/schema.sql'),'utf8'));t.after(()=>DB.raw.close());
 const W=await import('../cloud-account/worker.mjs'),currentAccounts=[];
 for(let n=1;n<=7;n++){const id='u_'+n,username=n<=5?'learner0'+n:'qa_release_'+n,enabled=n<=5?1:0;
  DB.raw.prepare('INSERT INTO accounts(id,username,verifier,enabled) VALUES(?,?,?,?)').run(id,username,await W.verifier(pepper,id,'x'.repeat(43)),enabled);
  DB.raw.prepare('INSERT INTO entries(user_id,key,version,payload,deleted,modified_at,write_id) VALUES(?,?,1,?,0,?,?)').run(id,'progress/book-2',JSON.stringify({lesson:n}),1700000000000,'synthetic-'+n);
  DB.raw.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run('hash-'+n,id,1700000000000,1900000000000);
  if(n<=5)currentAccounts.push({id,username,password:'x'.repeat(43)});
 }
 return{DB,currentAccounts,snapshot:DB.raw.prepare('SELECT * FROM accounts ORDER BY id').all()};
}
function entries(DB){return DB.raw.prepare('SELECT * FROM entries ORDER BY user_id,key').all();}
function counters(DB){return DB.raw.prepare('SELECT id,enabled,used_bytes,entity_count,revision FROM accounts ORDER BY id').all();}
test('rotation preserves account IDs, full entries, counters and disabled QA while revoking formal sessions',async t=>{
 const f=await fixture(t),R=await import('../cloud-account/rotate-accounts.mjs'),W=await import('../cloud-account/worker.mjs');
 const beforeEntries=entries(f.DB),beforeCounters=counters(f.DB),qa=f.snapshot.filter(a=>!a.enabled);
 const result=await R.buildRotation({currentAccounts:f.currentAccounts,snapshot:f.snapshot,pepper});
 assert.equal(result.accounts.length,5);assert.equal(new Set(result.accounts.map(a=>a.password)).size,5);
 assert.deepEqual(result.accounts.map(a=>a.username),['a01','a02','a03','a04','a05']);
 for(const a of result.accounts){assert.match(a.password,/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{8}$/);assert.equal(a.id,f.currentAccounts[result.accounts.indexOf(a)].id);assert(!result.sql.includes(a.password));}
 assert.equal(result.sql.split(';').filter(s=>s.trim()).length,1,'rotation is exactly one SQLite statement');
 f.DB.raw.exec(result.sql);
 assert.deepEqual(entries(f.DB),beforeEntries);assert.deepEqual(counters(f.DB),beforeCounters);
 assert.deepEqual(f.DB.raw.prepare('SELECT * FROM accounts WHERE enabled=0 ORDER BY id').all(),qa);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id IN(SELECT id FROM accounts WHERE enabled=1)').get().n,0);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id IN(SELECT id FROM accounts WHERE enabled=0)').get().n,2);
 for(const a of result.accounts){const stored=f.DB.raw.prepare('SELECT verifier FROM accounts WHERE id=?').get(a.id).verifier;assert(await W.verifyCredential(pepper,a.id,a.password,stored));assert(!await W.verifyCredential(pepper,a.id,'x'.repeat(43),stored));}
});
test('a stale account snapshot rejects the single statement without changing credentials or sessions',async t=>{
 const f=await fixture(t),R=await import('../cloud-account/rotate-accounts.mjs');
 const result=await R.buildRotation({currentAccounts:f.currentAccounts,snapshot:f.snapshot,pepper});
 f.DB.raw.prepare('UPDATE accounts SET revision=revision+1 WHERE id=?').run('u_4');
 const before=f.DB.raw.prepare('SELECT * FROM accounts ORDER BY id').all(),beforeSessions=f.DB.raw.prepare('SELECT * FROM sessions ORDER BY user_id').all();
 assert.throws(()=>f.DB.raw.exec(result.sql),/malformed JSON/);
 assert.deepEqual(f.DB.raw.prepare('SELECT * FROM accounts ORDER BY id').all(),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM sessions ORDER BY user_id').all(),beforeSessions);
});
test('failure during a later row of the single UPDATE automatically rolls back earlier credentials and session triggers',async t=>{
 const f=await fixture(t),R=await import('../cloud-account/rotate-accounts.mjs');
 const result=await R.buildRotation({currentAccounts:f.currentAccounts,snapshot:f.snapshot,pepper});
 f.DB.raw.exec("CREATE TRIGGER synthetic_reject_fourth BEFORE UPDATE OF username ON accounts WHEN NEW.id='u_4' BEGIN SELECT RAISE(ABORT,'synthetic_late_rotation_failure'); END;");
 const before=f.DB.raw.prepare('SELECT * FROM accounts ORDER BY id').all(),beforeSessions=f.DB.raw.prepare('SELECT * FROM sessions ORDER BY user_id').all();
 assert.throws(()=>f.DB.raw.exec(result.sql),/synthetic_late_rotation_failure/);
 assert.deepEqual(f.DB.raw.prepare('SELECT * FROM accounts ORDER BY id').all(),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM sessions ORDER BY user_id').all(),beforeSessions);
});
test('rotation rejects missing, duplicate, enabled QA and mismatched current account identities before producing SQL',async t=>{
 const f=await fixture(t),R=await import('../cloud-account/rotate-accounts.mjs');
 for(const change of [
  {snapshot:f.snapshot.slice(1)},
  {currentAccounts:[...f.currentAccounts.slice(0,4),f.currentAccounts[0]]},
  {snapshot:f.snapshot.map(a=>a.id==='u_7'?{...a,enabled:1}:a)},
  {currentAccounts:f.currentAccounts.map((a,n)=>n? a:{...a,username:'different'})},
 ])await assert.rejects(R.buildRotation({currentAccounts:f.currentAccounts,snapshot:f.snapshot,pepper,...change}));
});
test('private pending output is exclusive, does not expose secrets in its result, and refuses checkout output',async t=>{
 const f=await fixture(t),R=await import('../cloud-account/rotate-accounts.mjs'),os=require('node:os');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'zhixin-synthetic-rotation-'));
 t.after(()=>{for(const dir of [path.join(temporary,'pending'),temporary]){if(!fs.existsSync(dir))continue;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(fs.statSync(p).isFile())fs.unlinkSync(p);}fs.rmdirSync(dir);}});
 const snapshotFile=path.join(temporary,'snapshot.json'),accountsFile=path.join(temporary,'current.json'),pepperFile=path.join(temporary,'pepper.txt'),directory=path.join(temporary,'pending');
 fs.writeFileSync(snapshotFile,JSON.stringify({accounts:f.snapshot}));fs.writeFileSync(accountsFile,JSON.stringify({accounts:f.currentAccounts}));fs.writeFileSync(pepperFile,pepper);
 const args={snapshotFile,accountsFile,pepperFile,directory};
 const result=await R.prepareRotation(args);assert.deepEqual(Object.keys(result).sort(),['count','directory','pending']);assert.equal(result.count,5);assert.equal(result.pending,true);
 const before=fs.readFileSync(path.join(directory,'accounts.json'),'utf8');assert.equal(JSON.parse(before).accounts.length,5);assert.equal(fs.readFileSync(path.join(directory,'.gitignore'),'utf8'),'*\n');
 await assert.rejects(R.prepareRotation(args));assert.equal(fs.readFileSync(path.join(directory,'accounts.json'),'utf8'),before);
 await assert.rejects(R.prepareRotation({...args,directory:path.join(__dirname,'../cloud-account/unsafe-private-output')}),/outside the website checkout/);
 await assert.rejects(R.prepareRotation({...args,snapshotFile:'relative.json'}),/absolute private paths/);
});
