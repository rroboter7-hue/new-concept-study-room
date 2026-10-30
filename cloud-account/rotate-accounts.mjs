// Offline credential rotation only. The generated SQL is one atomic UPDATE statement.
import {randomInt} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const sqlText=value=>"'"+value.replaceAll("'","''")+"'";
const bad=()=>{throw Error('Account snapshot does not match the five fixed accounts and two disabled QA accounts');};
const fields=['id','username','verifier','enabled','used_bytes','entity_count','revision'];
function predicate(a){return fields.map(k=>k+'='+(typeof a[k]==='number'?a[k]:sqlText(a[k]))).join(' AND ');}

export async function buildRotation({currentAccounts,snapshot,pepper}){
 if(!Array.isArray(currentAccounts)||currentAccounts.length!==5||!Array.isArray(snapshot)||snapshot.length!==7||typeof pepper!=='string'||pepper.length<32)bad();
 if(new Set(currentAccounts.map(a=>a.id)).size!==5||new Set(snapshot.map(a=>a.id)).size!==7||new Set(snapshot.map(a=>a.username)).size!==7)bad();
 for(const a of snapshot){
  if(!a||!/^[A-Za-z0-9_-]{1,100}$/.test(a.id)||!/^[a-z][a-z0-9_-]{2,31}$/.test(a.username)||typeof a.verifier!=='string'||!(/^[0-9a-f]{64}$/.test(a.verifier)||/^v2\$hmac-sha256\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(a.verifier))||![0,1].includes(a.enabled)||['used_bytes','entity_count','revision'].some(k=>!Number.isSafeInteger(a[k])||a[k]<0))bad();
 }
 const formal=currentAccounts.map(a=>snapshot.find(s=>s.id===a.id&&s.username===a.username&&s.enabled===1));
 const qa=snapshot.filter(a=>!currentAccounts.some(c=>c.id===a.id));
 if(formal.some(a=>!a)||qa.length!==2||qa.some(a=>a.enabled!==0||!/^qa_/.test(a.username)))bad();
 const names=currentAccounts.map((_,n)=>'a'+String(n+1).padStart(2,'0'));
 if(snapshot.some(a=>names.includes(a.username)&&!formal.some(f=>f.id===a.id&&names[formal.indexOf(f)]===a.username)))bad();
 const {makeCredential}=await import('./worker.mjs'),accounts=[],credentials=[],seen=new Set();
 for(let n=0;n<5;n++){
  let password;do{password=Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');}while(seen.has(password));seen.add(password);
  const old=formal[n],username=names[n],credential=await makeCredential(pepper,old.id,password);
  accounts.push({id:old.id,username,password});
  credentials.push(credential);
 }
 // MATERIALIZED freezes the complete seven-account snapshot before any row changes.
 // SQLite statement atomicity includes credential-change triggers and session revocation.
 const condition='(SELECT COUNT(*) FROM accounts)=7 AND '+snapshot.map(a=>`EXISTS(SELECT 1 FROM accounts WHERE ${predicate(a)})`).join(' AND ');
 const assignment=values=>'CASE id '+accounts.map((a,n)=>`WHEN ${sqlText(a.id)} THEN ${sqlText(values[n])}`).join(' ')+' END';
 const sql='WITH guard AS MATERIALIZED (SELECT CASE WHEN '+condition+" THEN 1 ELSE json('credential_rotation_conflict') END AS ok)\n"+
  'UPDATE accounts SET username='+assignment(accounts.map(a=>a.username))+',verifier='+assignment(credentials)+'\n'+
  'WHERE id IN('+accounts.map(a=>sqlText(a.id)).join(',')+') AND (SELECT ok FROM guard)=1;\n';
 return{accounts,sql};
}

function outside(checkout,filename){const relative=path.relative(checkout,filename);return relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative);}
export async function prepareRotation({snapshotFile,accountsFile,pepperFile,directory}){
 const checkout=await realpath(fileURLToPath(new URL('..',import.meta.url)));
 for(const filename of [snapshotFile,accountsFile,pepperFile,directory])if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('Use absolute private paths');
 const inputs=await Promise.all([snapshotFile,accountsFile,pepperFile].map(p=>realpath(p)));
 if(inputs.some(p=>!outside(checkout,p)))throw Error('Private inputs must stay outside the website checkout');
 const parent=await realpath(path.dirname(directory)),output=path.join(parent,path.basename(directory));
 if(!outside(checkout,output))throw Error('Credentials must stay outside the website checkout');
 const [rawSnapshot,rawAccounts,rawPepper]=await Promise.all(inputs.map(p=>readFile(p,'utf8')));
 const parsed=JSON.parse(rawSnapshot),current=JSON.parse(rawAccounts);
 const result=await buildRotation({snapshot:Array.isArray(parsed)?parsed:parsed.accounts,currentAccounts:current.accounts,pepper:rawPepper.trim()});
 // Exclusive directory creation prevents an existing handout or pending rotation being overwritten.
 await mkdir(output,{mode:0o700});
 const createdAt=new Date().toISOString(),handout='知新学习室 · 固定账号（每人使用一个账号，请妥善保管）\n\n'+result.accounts.map(a=>a.username+'\n密码：'+a.password).join('\n\n')+'\n\n使用网址：https://rroboter7-hue.github.io/new-concept-study-room/\n在“我的”登录。进度自动同步，也可点击“立即同步进度”。\n新账号沿用原账号的全部学习记录；旧账号密码及登录会话已失效，请重新登录。\n首次登录时，可按页面提示选择迁入本机记录或使用账号进度。\n';
 for(const [name,text] of Object.entries({'.gitignore':'*\n','accounts.json':JSON.stringify({createdAt,accounts:result.accounts},null,2)+'\n','rotation.sql':result.sql,'账号密码.txt':handout}))await writeFile(path.join(output,name),text,{flag:'wx',mode:0o600});
 return{count:5,directory:output,pending:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [snapshotFile,accountsFile,pepperFile,directory]=process.argv.slice(2);console.log(JSON.stringify(await prepareRotation({snapshotFile,accountsFile,pepperFile,directory})));}
 catch{console.error('Could not prepare a private rotation. Check the explicit input paths, account snapshot, and unused output directory.');process.exitCode=1;}
}
