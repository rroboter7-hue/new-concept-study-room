'use strict';
{
'use strict';
// Independent RED tests: these state the strict owner contract, rather than
// treating current permissive behavior as an acceptable compatibility result.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const DIR=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):path.join(__dirname,'..');
function fixture(){
 const c={document:{addEventListener(){},getElementById(){return null;}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);
 for(const m of fs.readFileSync(path.join(DIR,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){
  const f=m[1].split('?')[0];if(f==='app.js')break;
  vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),c,{filename:f});
 }
 const source=c.LESSONS.find(l=>l.book===2&&l.number===21),item=JSON.parse(JSON.stringify(source.usage[0]));
 assert(c.StudyReviewedUsage.isUsageCurrent(item,source),'genuine source approval remains valid');
 return {c,source,item};
}
test('strict registry owner contract rejects unknown markers inherited by an otherwise valid old item',()=>{
 const {c,source,item}=fixture(),inherited=Object.create({usage31To35ReviewId:'synthetic-unknown'});Object.assign(inherited,item);
 const observed=c.StudyReviewedUsage.isUsageCurrent(inherited,source);
 console.log('inheritedUnknownAccepted='+observed);
 assert.equal(observed,false,'an inherited unknown owner must not be silently ignored');
});
test('strict fallback owner contract rejects multiple owners when shared registry is absent',()=>{
 const {c,source,item}=fixture(),ambiguous={...item,usage31To35ReviewId:'synthetic-unknown'};
 assert.equal(c.StudyReviewedUsage.isUsageCurrent(ambiguous,source),false,'loaded registry already rejects own multi-owner input');
 c.StudyReviewedUsage=undefined;
 const observed=c.PhrasePractice.isGradedEligible(ambiguous,source);
 console.log('missingRegistryOwnUnknownAccepted='+observed);
 assert.equal(observed,false,'compatibility fallback must retain strict owner rejection');
});

}
{
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const DIR=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):path.join(__dirname,'..'),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function actual({oldOnly=false}={}){
 const c={document:{addEventListener(){},getElementById(){return null;}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);
 for(const m of fs.readFileSync(path.join(DIR,'index.html'),'utf8').matchAll(/<script defer src="([^"]+)"/g)){
  const f=m[1].split('?')[0];if(f==='app.js')break;if(oldOnly&&['reviewed-usage-registry.js','book2-reviewed-usage-26-30.js'].includes(f))continue;
  vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),c,{filename:f});
 }return c;
}
function practice(c,l){const records=[],p=new c.PhrasePractice({getLesson:()=>l,escapeHTML:E,wordHTML:E,saveRecord:r=>records.push(r),toast(){}});p.setLesson(l);return {p,records};}
function guardFixture(registry){
 const c={};c.window=c;vm.createContext(c);
 const provider={statusForLesson:()=>({bound:true,reason:'fixture-bound'}),isUsageCurrent:()=>true};
 c.StudyReviewedUsage21To25=provider;c.StudyReviewedUsage26To30=provider;
 for(const f of [...(registry?['reviewed-usage-registry.js']:[]),'review-engine.js','phrase-practice.js'])vm.runInContext(fs.readFileSync(path.join(DIR,f),'utf8'),c,{filename:f});
 return c;
}
function base(){return {phrase:'take care',meaning:'当心',example:'Take care when you cross the road.',usage21To25ReviewId:'fixture-old'};}
function badOwners(){
 const a=base(),inheritedUnknown=Object.assign(Object.create({usage31To35ReviewId:'x'}),a),inheritedKnown=Object.assign(Object.create({usage26To30ReviewId:'x'}),a),inheritedOnly=Object.assign(Object.create({usage31To35ReviewId:'x'}),{phrase:a.phrase,meaning:a.meaning,example:a.example}),inheritedOld=Object.assign(Object.create({usage21To25ReviewId:'fixture-old'}),{phrase:a.phrase,meaning:a.meaning,example:a.example}),deep=Object.assign(Object.create(Object.create({usage31To35ReviewId:'deep'})),a),getter={phrase:a.phrase,meaning:a.meaning,example:a.example};
 Object.defineProperty(getter,'usage21To25ReviewId',{enumerable:true,get(){throw Error('must not read owner getter');}});
 return [
  ['own known dual owner',{...a,usage26To30ReviewId:'x'}],
  ['own unknown dual owner',{...a,usage31To35ReviewId:'x'}],
  ['own unknown only',{phrase:a.phrase,meaning:a.meaning,example:a.example,usage31To35ReviewId:'x'}],
  ['inherited unknown dual owner',inheritedUnknown],['inherited known dual owner',inheritedKnown],['inherited unknown only',inheritedOnly],['inherited old only',inheritedOld],['deep inherited unknown',deep],
  ['empty old marker',{...a,usage21To25ReviewId:''}],['non-string old marker',{...a,usage21To25ReviewId:{}}],['owner getter',getter]
 ];
}
test('post-fix no-registry old-provider-only runtime retains old lesson pools, SRS and actual write scoring',()=>{
 const c=actual({oldOnly:true}),expected=[[21,8,9,8,8],[22,9,9,9,8],[23,2,2,2,2],[24,5,5,5,5],[25,7,8,7,8]];
 assert.equal(c.StudyReviewedUsage,undefined);assert.equal(c.StudyReviewedUsage26To30,undefined);
 for(const [n,g,f,m,o]of expected){const l=c.LESSONS.find(l=>l.book===2&&l.number===n),{p}=practice(c,l);assert(c.StudyReviewedUsage21To25.statusForLesson(l).bound);for(const [method,count]of [['gradedItems',g],['fillQuestions',f],['matchQuestions',m],['orderQuestions',o]])assert.equal(p[method]().length,count,'L'+n+' '+method);assert.equal(c.StudyReview.cardsForLessons([l]).filter(x=>x.kind==='phrase').length,g,'L'+n+' SRS');}
 const l=c.LESSONS.find(l=>l.book===2&&l.number===21),{p,records}=practice(c,l);p.mode='write';p.answers={phraseIndex:p.items().findIndex(x=>x.phrase==='a large sum of money'),draft:'I paid a large sum of money yesterday.'};assert(p.submit());assert.equal(records.length,1);assert.equal(records[0].score,100);
});
test('post-fix SRS and static practice reject all malformed owners with permissive providers, registry present or missing',()=>{
 for(const registry of [true,false]){
  const c=guardFixture(registry),l={id:'fixture-l21',book:2,number:21,title:'fixture'};
  assert(c.PhrasePractice.isGradedEligible(base(),l));assert.equal(c.StudyReview.cardsForLessons([{...l,usage:[base()]}]).length,1,'valid old compatibility baseline');
  for(const [label,item]of badOwners()){
   assert.equal(c.PhrasePractice.isGradedEligible(item,l),false,label+' practice registry='+registry);
   assert.equal(c.StudyReview.cardsForLessons([{...l,usage:[item]}]).length,0,label+' SRS registry='+registry);
  }
 }
});
for(const oldOnly of [false,true])test('post-fix actual phrase pool must retain inherited-owner rejection before spreading source items, oldOnly='+oldOnly,()=>{
 const c=actual({oldOnly}),l=c.LESSONS.find(l=>l.book===2&&l.number===21),item=l.usage.find(x=>x.phrase==='a large sum of money');
 Object.setPrototypeOf(item,{usage31To35ReviewId:'synthetic-unknown'});
 assert(c.StudyReviewedUsage21To25.statusForLesson(l).bound,'synthetic prototype does not change source own fields');
 if(!oldOnly)assert.equal(c.StudyReviewedUsage.isUsageCurrent(item,l),false,'direct registry rejects inherited owner');
 assert.equal(c.PhrasePractice.isGradedEligible(item,l),false,'static practice rejects inherited owner');
 assert.equal(c.StudyReview.cardsForLessons([l]).some(x=>x.kind==='phrase'&&x.target===item.phrase),false,'SRS retains owner rejection');
 const {p,records}=practice(c,l),accepted=p.gradedItems().some(x=>x.phrase===item.phrase);
 p.mode='write';p.answers={phraseIndex:p.items().findIndex(x=>x.phrase===item.phrase),draft:'I paid a large sum of money yesterday.'};p.submit();
 console.log('post-fix actualPhrasePoolInheritedUnknownAccepted='+accepted+' oldOnly='+oldOnly+' writeRecords='+records.length);
 assert.equal(accepted,false,'items must not erase inherited unknown owners before approval checks');
 assert.equal(records.length,0,'write submit must retain owner rejection');
});
test('post-fix actual additional-example pool must retain inherited-owner rejection before merging examples',()=>{
 const c=actual(),l=c.LESSONS.find(l=>l.book===2&&l.number===21),parent=l.usage.find(x=>x.additionalExamples?.length),item=parent.additionalExamples[0];
 Object.setPrototypeOf(item,{usage31To35ReviewId:'synthetic-unknown'});
 assert(c.StudyReviewedUsage21To25.statusForLesson(l).bound);
 assert.equal(c.StudyReviewedUsage.isUsageCurrent(item,l),false);
 const {p}=practice(c,l),accepted=p.examples().some(x=>x.phrase===item.phrase&&x.usageSourceId===item.usageSourceId&&x.mergedFrom===item.mergedFrom&&x.example===item.example);
 console.log('post-fix additionalExampleInheritedUnknownAccepted='+accepted);
 assert.equal(accepted,false,'examples must not erase inherited unknown owners before approval checks');
});

test('all three legitimate reviewed additional examples retain raw approval and projected practice eligibility',()=>{
 const c=actual(),seen=[];
 for(let n=21;n<=30;n++){
  const l=c.LESSONS.find(x=>x.book===2&&x.number===n),{p}=practice(c,l),examples=p.examples();
  for(const parent of l.usage)for(const child of parent.additionalExamples||[]){
   assert.equal(c.PhrasePractice.isGradedEligible(child,l),true,'raw additional approval L'+n);
   assert(examples.some(x=>x.phrase===child.phrase&&x.usageSourceId===child.usageSourceId&&x.mergedFrom===child.mergedFrom&&x.example===child.example),'projected additional retained L'+n);
   seen.push({lesson:n,phrase:child.phrase,usageSourceId:child.usageSourceId,mergedFrom:child.mergedFrom});
  }
 }
 assert.equal(seen.length,3);console.log('legitimate-reviewed-additional-examples '+JSON.stringify(seen));
});

}
