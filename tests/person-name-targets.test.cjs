'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const policy=require('../person-name-targets.js');
const artifact=fs.readFileSync(path.join(__dirname,'../lesson-word-targets.js'),'utf8');
const beginning=artifact.indexOf('var api=factory(')+'var api=factory('.length;
const payload=JSON.parse(artifact.slice(beginning,artifact.indexOf('\n',beginning)).trim().replace(/\);$/,''));
function actual(book,number,word){
 const row=payload.lessons.find(item=>item.book===book&&item.number===number);assert(row,'actual reading lesson exists');
 const source=JSON.parse(row.sourceBinding),entry=row.targets.find(item=>item.word.toLowerCase().replace(/[‘’]/g,"'")===word.toLowerCase().replace(/[‘’]/g,"'"));assert(entry,'actual target exists: '+word);
 return {target:{...entry,sourceSentence:row.sourceSentences[entry.sourceSentenceIndex],source:{id:row.id,book,number}},lesson:{id:row.id,book,number,title:source[0],paragraphs:source[1].map(en=>({en}))}};
}

test('curated source rules exclude real people even when dictionary senses describe ordinary words or omit the meaning',()=>{
 for(const [book,number,word] of [[1,5,'Sophie'],[1,5,'Luming'],[1,5,'Xiaohui'],[1,7,'Robert'],[1,39,'Penny'],[1,65,'Tom'],[1,79,'Carol'],[2,31,'Frank'],[2,65,'Gates'],[3,14,'Hawkwood'],[3,36,'Bussman'],[4,10,'Mead'],[4,32,'Galileo']]){
  const {target,lesson}=actual(book,number,word);assert.equal(policy.isPersonNameTarget(target,lesson),true,'person B'+book+'L'+number+' '+word);
 }
});

test('normal words, places, brands, nationalities and nonhuman names survive misleading name dictionary senses',()=>{
 for(const [book,number,word] of [[1,51,'May'],[1,97,'name'],[1,113,'Trafalgar'],[1,119,'Henry'],[2,29,'Rockall'],[2,39,'weeks'],[2,59,'Rex'],[2,66,'Merlin'],[3,8,'Bernard'],[3,9,'Sabrina'],[3,19,'anonymous'],[3,21,'Stilton'],[3,30,'Hay'],[3,42,'Berger'],[4,10,'Stanford'],[4,17,'burrows'],[4,26,'rivers'],[4,33,'wells'],[4,35,'cousins'],[4,46,"Fortune's"],[4,47,'Mercedes'],[4,47,'Germans']]){
  const {target,lesson}=actual(book,number,word);assert.equal(policy.isPersonNameTarget(target,lesson),false,'nonperson B'+book+'L'+number+' '+word);
 }
});

test('name exclusions require the reviewed lesson and actual English context, without a global ambiguous-name blacklist',()=>{
 const {target,lesson}=actual(2,31,'Frank');
 assert.equal(policy.isPersonNameTarget({...target,word:'frank'},lesson),true,'casing is normalized within a reviewed rule');
 assert.equal(policy.isPersonNameTarget({...target,source:{id:'different',book:2,number:31}},lesson),false);
 assert.equal(policy.isPersonNameTarget({...target,source:{id:lesson.id,book:1,number:31}},lesson),false);
 assert.equal(policy.isPersonNameTarget({...target,source:{id:lesson.id,book:2,number:30}},lesson),false);
 assert.equal(policy.isPersonNameTarget(target,{...lesson,id:'different'}),false);
 assert.equal(policy.isPersonNameTarget(target,{...lesson,number:30}),false);
 assert.equal(policy.isPersonNameTarget(target,{...lesson,paragraphs:[{en:'Be frank with your friend.'}]}),false);
 assert.equal(policy.isPersonNameTarget({...target,sourceSentence:'Be frank with your friend.'},lesson),false);
 const imported={id:'imported',book:2,number:31,title:'Own practice',paragraphs:[{en:'A rose grew outside. The victor told us his name.'}]};
 for(const word of ['name','rose','Rose','victor','Victor','frank'])assert.equal(policy.isPersonNameTarget({word},imported),false,word+' stays outside explicit human rules');
});

test('exact honorifics are excluded but useful generic nouns and ambiguous miss are not globally blacklisted',()=>{
 const lesson={id:'imported',book:1,number:1,title:'Address',paragraphs:[{en:'Mr. Smith greeted Mrs. Brown. Sir, please come in.'}]};
 for(const word of ['Mr','MR.','Mrs.','Ms.','Dr.','Sir','Madam','Prof.','Rev.','Esq.'])assert.equal(policy.isPersonNameTarget({word},lesson),true,word);
 for(const word of ['name','doctor','teacher','captain','king','queen','miss'])assert.equal(policy.isPersonNameTarget({word,meaning:'一个人的称谓'},lesson),false,word+' is not an exact unambiguous honorific');
 const title=actual(1,5,'Miss');assert.equal(policy.isPersonNameTarget(title.target,title.lesson),true,'reviewed Miss Sophie is an honorific');
 const ordinary={...lesson,paragraphs:[{en:'I miss the train. Miss a step and you may fall.'}]};assert.equal(policy.isPersonNameTarget({word:'Miss',sourceSentence:'Miss a step and you may fall.'},ordinary),false);
});

test('policy is pure, standalone and documents its finite curated scope',()=>{
 const data=actual(1,5,'Sophie'),before=JSON.stringify(data);Object.freeze(data.target.source);Object.freeze(data.target);Object.freeze(data.lesson);
 assert.equal(policy.isPersonNameTarget(data.target,data.lesson),true);assert.equal(JSON.stringify(data),before);
 assert.equal(policy.isPersonNameTarget(null,null),false);assert.equal(policy.isPersonNameTarget({word:'name'},null),false);
 assert(policy.scope.personTokens>150);assert(policy.scope.lessons>60);assert.match(policy.scope.policy,/source|context/i);
 const context={};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../person-name-targets.js'),'utf8'),context);
 assert.equal(typeof context.StudyPersonNameTargets.isPersonNameTarget,'function');
 assert.equal(context.StudyPersonNameTargets.isPersonNameTarget(data.target,data.lesson),true);
});


test('the finite four-book registry remains bound to its declared source lessons and token counts',()=>{
 const counts={1:0,2:0,3:0,4:0};
 for(const row of payload.lessons){
  const source=JSON.parse(row.sourceBinding),lesson={id:row.id,book:row.book,number:row.number,title:source[0],paragraphs:source[1].map(en=>({en}))};
  for(const entry of row.targets){
   const target={...entry,sourceSentence:row.sourceSentences[entry.sourceSentenceIndex],source:{id:row.id,book:row.book,number:row.number}};
   if(policy.isPersonNameTarget(target,lesson))counts[row.book]++;
  }
 }
 // Six exact conventional honorific tokens occur in the current source corpus;
 // four additional title occurrences are explicitly context-bound in the map.
 assert.deepEqual(counts,{1:106,2:84,3:57,4:36});
 assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),policy.scope.personTokens+policy.scope.sourceBoundTitles+6);
});
