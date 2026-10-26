const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const DIST=path.join(__dirname,'..');
function harness(lesson,{knowledge=true}={}){
 const context={document:{addEventListener(){},querySelector:()=>null}};context.window=context;vm.createContext(context);
 if(knowledge){vm.runInContext(fs.readFileSync(path.join(DIST,'study-knowledge.js'),'utf8'),context);context.StudyKnowledge.install([lesson],{grammarAudit:{version:1,items:[]}});}
 vm.runInContext(fs.readFileSync(path.join(DIST,'output-practice.js'),'utf8'),context);const records=[],messages=[],ui=new context.OutputPractice({getLesson:()=>lesson,saveRecord:r=>{records.push(r);return true;},toast:m=>messages.push(m)});ui.setLesson(lesson);return {context,ui,records,messages};
}
const lesson=extra=>({id:'output-gate',book:2,number:1,title:'Output gate',paragraphs:[{en:'This mystery remains beside the window.',zh:'这个谜团仍然在窗边。'}],vocabulary:[],usage:[],quiz:[],...extra});

test('a registered lesson with zero confirmed words cannot reintroduce paragraph vocabulary into spelling',()=>{
 const l=lesson({vocabulary:[{word:'mystery',meaning:'待核释义',needsContextReview:true}]}),h=harness(l);assert.equal(l.vocabulary.length,0);assert.equal(h.context.StudyKnowledge.bank.vocabularyForLesson(l.id).length,0);assert.deepEqual(Array.from(h.ui.spellWords()),[]);h.ui.mode='spell';let html;assert.doesNotThrow(()=>html=h.ui.render());assert.match(html,/暂无已核对词表/);assert.doesNotMatch(html,/data-output-spell|data-output-action="submit"|undefined/);h.ui.spellAnswers[0]='mystery';h.ui.submit();assert.equal(h.ui.result,null);assert.equal(h.records.length,0);
});

test('spelling reads confirmed bank words and meanings even if a legacy consumer mutates raw vocabulary',()=>{
 const l=lesson({vocabulary:[{word:'sand',meaning:'沙子'},{word:'food',meaning:'食物'},{word:'mystery',meaning:'待核',needsContextReview:true}]}),h=harness(l);l.vocabulary[0].meaning='过去进行时';l.vocabulary.push({word:'mystery',meaning:'待核',needsContextReview:true});assert.deepEqual(Array.from(h.ui.spellWords(),v=>[v.word,v.meaning]),[['sand','沙子'],['food','食物']]);h.ui.mode='spell';h.ui.spellAnswers={0:'sand',1:'food'};h.ui.submit();assert.equal(h.ui.result.correct,2);assert.equal(h.ui.result.score,100);assert.equal(h.records.length,1);assert.deepEqual(Array.from(h.ui.result.items,item=>item.word),['sand','food']);
});

test('courses outside the bank retain their existing explicit vocabulary and paragraph fallback',()=>{
 for(const knowledge of [true,false]){const explicit=harness(lesson({book:1,vocabulary:[{word:'legacy',meaning:'旧课词表'}]}),{knowledge});assert.deepEqual(Array.from(explicit.ui.spellWords(),v=>[v.word,v.meaning]),[['legacy','旧课词表']]);const fallback=harness(lesson({book:1,paragraphs:[{en:'Clever rabbits gather beside trees.'}]}),{knowledge});assert.deepEqual(Array.from(fallback.ui.spellWords(),v=>v.word),['clever','rabbits','gather','beside','trees']);}
});

test('an empty confirmed spelling list does not prevent unchanged passage writing and comparison',()=>{
 const l=lesson({vocabulary:[{word:'mystery',meaning:'待核',needsContextReview:true}]}),h=harness(l);h.ui.mode='write';assert.match(h.ui.render(),/这个谜团仍然在窗边/);h.ui.answer=l.paragraphs[0].en;h.ui.submit();assert.equal(h.ui.result.score,100);assert.equal(h.records[0].mode,'write');
});
