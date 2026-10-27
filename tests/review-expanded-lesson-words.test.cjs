'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const builder=require('../dev/build-lesson-word-targets.cjs'),root=path.join(__dirname,'..');
const plain=value=>JSON.parse(JSON.stringify(value));
const original={id:'fourth',book:4,number:48,title:'Individual aims',paragraphs:[{en:'My aims include a quiet seat and inventedwordzz.'}],vocabulary:[{word:'seat',meaning:'座位',pos:'n.'}],usage:[],quiz:[]};
function setup(){
 const scope={};scope.window=scope;vm.createContext(scope);
 const manifest=builder.createManifest([original],{individual:{translation:'a. 个人的'},aims:{translation:'n. 目标（aim的复数）'},my:{translation:'pron. 我的'},include:{translation:'v. 包括'},a:{translation:'art. 一个'},quiet:{translation:'a. 安静的'},and:{translation:'conj. 和'}});
 vm.runInContext(builder.browserSource(manifest),scope);
 vm.runInContext(fs.readFileSync(path.join(root,'review-engine.js'),'utf8'),scope);
 return {scope,R:scope.StudyReview};
}
test('expanded source-bound lesson words enter review while existing word card identity stays stable',()=>{
 const {R}=setup(),cards=R.cardsForLessons([original]);
 assert.ok(cards.some(c=>c.kind==='word'&&c.target==='aims'&&c.prompt.includes('目标')),'a defined generated new word must be reviewable');
 assert.equal(cards.filter(c=>c.target.toLowerCase()==='seat').length,1);
 assert.equal(cards.find(c=>c.target==='seat').id,'review:fourth:word:seat');
 assert.ok(!cards.some(c=>c.target==='inventedwordzz'),'missing definitions must not become word-meaning questions');
});
test('enrolling expanded vocabulary keeps existing due date, evidence, revision and stage unchanged',()=>{
 const {R}=setup(),at=Date.parse('2026-10-27T08:00:00Z');
 const oldCard={id:'review:fourth:word:seat',kind:'word',target:'seat',prompt:'座位',sourceLesson:{id:'fourth',book:4,number:48,title:'Individual aims'}};
 let state=R.enroll(null,[oldCard],{now:at});state=R.rate(state,oldCard.id,'good',{now:at,revision:0}).state;
 const before=plain(state.cards[oldCard.id]),next=R.enroll(state,R.cardsForLessons([original]),{now:at+1000});
 assert.deepEqual(plain(next.cards[oldCard.id]),before);
 assert.ok(next.cards['review:fourth:word:aims'],'new vocabulary is enrolled alongside the old schedule');
 assert.deepEqual(plain(state.cards[oldCard.id]),before,'previous state is immutable');
});
test('changed lesson text does not inherit stale generated definitions',()=>{
 const {R}=setup(),edited={...original,paragraphs:[{en:'This source has changed.'}]};
 const words=R.cardsForLessons([edited]).filter(c=>c.kind==='word');
 assert.deepEqual(Array.from(words,c=>c.target),['seat']);
});
test('copied self-authored meanings cannot bypass source text or identity drift in review cards',()=>{
 const meanings=require('../context-meanings.js'),lessons=builder.collectCorpus(root).lessons;
 const lesson=lessons.find(l=>l.book===3&&l.number===1),reviewed=meanings.forLesson(lesson,'cornered');
 assert.ok(reviewed,'the literal shipped context has an explicit reviewed sense');
 const {R,scope}=setup();scope.StudyContextMeanings=meanings;
 const withCopied={...lesson,vocabulary:[reviewed]};
 assert.ok(R.cardsForLessons([withCopied]).some(c=>c.target==='cornered'));
 for(const changed of [{...withCopied,paragraphs:withCopied.paragraphs.map((p,i)=>i===0?{...p,en:p.en+' '}:p)},{...withCopied,textbook:{...withCopied.textbook,sourceUrl:'other.pdf'}}]){
  assert.equal(meanings.forLesson(changed,'cornered'),null);
  assert.ok(!R.cardsForLessons([changed]).some(c=>c.target==='cornered'),'stale copied provenance must not become a reviewed prompt');
 }
});
