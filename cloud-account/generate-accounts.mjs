// Offline provisioning only. Output must stay outside the website checkout.
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifier} from './worker.mjs';

export async function generate(directory){
 const checkout=await realpath(fileURLToPath(new URL('..',import.meta.url)));
 if(!path.isAbsolute(directory))throw Error('Use an absolute private output directory');
 await mkdir(directory,{recursive:true});const output=await realpath(directory),relative=path.relative(checkout,output);
 if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw Error('Credentials must stay outside the website checkout');
 const pepper=randomBytes(48).toString('base64url'),accounts=[];
 for(let i=1;i<=5;i++){const id='u_'+randomUUID().replaceAll('-',''),username='learner'+String(i).padStart(2,'0'),password=randomBytes(32).toString('base64url');accounts.push({id,username,password,verifier:await verifier(pepper,id,password)});}
 const files={
  'pepper.txt':pepper+'\n',
  'accounts.json':JSON.stringify({createdAt:new Date().toISOString(),accounts:accounts.map(({verifier,...a})=>a)},null,2)+'\n',
  'seed.sql':accounts.map(a=>`INSERT INTO accounts(id,username,verifier) VALUES('${a.id}','${a.username}','${a.verifier}');`).join('\n')+'\n',
  '账号密码.txt':'知新学习室 · 固定账号（请妥善保管，每人使用一个账号）\n\n'+accounts.map(a=>a.username+'\n密码：'+a.password).join('\n\n')+'\n\n使用网址：https://rroboter7-hue.github.io/new-concept-study-room/\n在“我的”登录；进度自动同步，也可点击“立即同步进度”。\n'
 };
 for(const [name,value]of Object.entries(files))await writeFile(path.join(output,name),value,{flag:'wx',mode:0o600});
 return {count:accounts.length,directory:output};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await generate(process.argv[2]||'');console.log(JSON.stringify(result));}catch(error){console.error(error.message);process.exitCode=1;}
}
