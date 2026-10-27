'use strict';
// Portable reviewer tests: reads only files under USAGE21_APP_DIST and exercises real submit().
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const DIR=process.env.USAGE21_APP_DIST?path.resolve(process.env.USAGE21_APP_DIST):path.join(__dirname,'..');
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(target){
 const events={},c={document:{addEventListener(k,fn){(events[k]||=[]).push(fn);},getElementById(){return null;}},setTimeout(){},clearTimeout(){}};c.window=c;vm.createContext(c);
 for(const m of fs.readFileSync(path.join(DIR,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)){const f=m[1].split(/[?#]/)[0];if(f==='app.js')break;vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),c,{filename:f});}
 const lesson=c.LESSONS.find(l=>l.usage?.some(p=>p.phrase===target))||{id:'independent-writing-fixture',usage:[{phrase:target,meaning:'学习表达'}]};
 const records=[{id:'existing-history',score:75}],pp=new c.PhrasePractice({getLesson:()=>lesson,escapeHTML:E,wordHTML:E,toast(){},saveRecord:r=>records.push(r)});pp.setLesson(lesson);pp.mode='write';
 const index=pp.items().findIndex(p=>p.phrase===target);assert(index>=0,target);pp.answers.phraseIndex=index;
 return {c,pp,records,events};
}
function reject(target,draft){const h=setup(target),item=h.pp.items()[h.pp.answers.phraseIndex];assert(h.c.PhrasePractice.hasPhrase(draft,item),'target is covered before completeness validation');h.pp.answers.draft=draft;assert.equal(h.pp.submit(),false,draft);assert.equal(h.records.length,1,'no new coverage record for the fragment');assert.equal(h.pp.answers.draft,draft);assert.equal(h.records[0].id,'existing-history');return h;}
function accept(target,draft){const h=setup(target);h.pp.answers.draft=draft;assert.equal(h.pp.submit(),true,draft);assert.equal(h.records.at(-1).score,100,draft);assert.equal(h.records.at(-1).details.scoreType,'phrase-coverage');assert.equal(h.records.at(-1).details.grammarCheckScope,'finite-rules-not-complete-proof');assert.equal(h.pp.answers.draft,draft);return h;}

test('independent writing: repeating only a noun-phrase heading cannot manufacture a sentence or full record',()=>{
 for(const text of ['a large sum of money a large sum of money','a large sum of money; a large sum of money.','“a large sum of money” “a large sum of money”'])reject('a large sum of money',text);
});
for(const [target,text]of [['for some reason','“For some reason, instead of spending”'],['know the way to','“Do you know the way to the railway”']]){
 test('independent writing: wrapping the historical '+target+' excerpt in quotes does not remove its missing-context warning',()=>reject(target,text));
}
test('independent writing: an ordinary complete if-clause plus main clause is not rejected by a finite verb whitelist',()=>{
 accept('go home','If it rains I will go home.');
 accept('a large sum of money','If it rains I will save a large sum of money.');
});
test('independent writing: a complete instead-of sentence with a noun subject and ordinary lexical predicate can earn coverage',()=>{
 accept('instead of','Instead of going home, the children played outside.');
});
test('independent writing: a genuine imperative after an instead-of adjunct is not rejected by a short verb list',()=>{
 accept('instead of','Instead of waiting, open the door.');
});
test('independent writing: object-pronoun plus adverb inside an instead-of fragment is not a main clause',()=>{
 reject('instead of','Instead of spending time with you today.');
});
test('independent writing: ordinary full questions, conventional short utterances, and placeholders keep bounded claims and draft safety',()=>{
 for(const [target,text]of [['know the way to','Do you know the way to the railway station?'],['take a seat','Take a seat.'],['no wonder','No wonder!'],['wonder','I wonder.'],['instead of','Instead of waiting, I called my friend.']]){const h=accept(target,text);assert.match(h.pp.render(),/覆盖.*不等于|不代表完整语法/);}
 for(const text of ['I know the way to sw.','I know the way to sth.','I know the way to sb.']){const h=reject('know the way to',text);assert(h.pp.writingValidationResult.issues.some(x=>x.id==='teaching-placeholder'));assert(h.pp.writingValidationResult.issues.every(x=>!Object.hasOwn(x,'replacement')));}
});
