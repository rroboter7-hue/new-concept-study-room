'use strict';
// Actual output module and selected real catalogue overlays; DOM/storage are
// boundaries only. No service, browser, network or generated source data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const DIST=process.env.PILOT_APP_DIST?path.resolve(process.env.PILOT_APP_DIST):fs.existsSync(path.join(__dirname,'..','index.html'))?path.resolve(__dirname,'..'):path.join(__dirname,'new-concept','dist');
const copy=value=>JSON.parse(JSON.stringify(value));
function setup(lesson,{real=false,recurrence=true}={}){
 const c={document:{addEventListener(){},removeEventListener(){},querySelector(){return null;}}};c.window=c;vm.createContext(c);
 const run=file=>vm.runInContext(fs.readFileSync(path.join(DIST,file),'utf8'),c,{filename:file});
 if(real){const selected=new Set(['curriculum.js','textbook-lessons.js','book1-first10-lessons.js','book1-first10-catalogue.js','book1-complete-lessons.js','phrase-library.js']);for(const match of fs.readFileSync(path.join(DIST,'index.html'),'utf8').matchAll(/<script\b[^>]*src="([^"]+)"/g)){const file=match[1].split(/[?#]/)[0];if(selected.has(file))run(file);}lesson=c.LESSONS.find(row=>row.id==='nce-b1-4be758-l143');}
 if(recurrence)run('recurrence.js');run('output-practice.js');const records=[];
 const output=new c.OutputPractice({getLesson:()=>lesson,saveRecord:value=>{records.push(copy(value));return true;},onEvidence:()=>true});output.setLesson(lesson);output.mode='retell';
 return {c,lesson,output,records,submit:answer=>{output.result=null;output.answer=answer;output.submit();return copy(output.result);}};
}
const fixture=(body,vocabulary=[],usage=[])=>({id:'verified-lesson',book:1,number:1,source:'provided',textbook:{verified:true},paragraphs:[{en:body,zh:'测试正文'}],vocabulary,usage,keyPoints:['旧笔记语法'],lines:['Old note sentence.']});
const entry=(word,pos='v.')=>({word,pos,meaning:'测试词义'});

test('verified L143 retains all eight real vocabulary targets and replaces unrelated note phrases with source-backed later phrases',()=>{
 const {output}=setup(null,{real:true}),keywords=copy(output.keywords());
 assert.deepEqual(keywords.slice(0,8),['surround','through','visitor','count','cover','tidy','litter','place']);
 for(const label of ['go shopping','get on','throw away','at the station'])assert(!keywords.includes(label),label+' lacks passage evidence');
 assert(keywords.includes('on Sundays'));assert(keywords.includes('go for a walk'));assert(keywords.every(label=>typeof label==='string'));
 assert.match(output.renderRetell(),/学习笔记要点（不计入课文复述覆盖）/);
});

test('the complete real L143 passage covers every displayed lexical target, including its observed inflections',()=>{
 const h=setup(null,{real:true}),result=h.submit(h.lesson.paragraphs.map(p=>p.en).join(' '));
 assert.equal(result.score,100);assert.deepEqual(result.missing,[]);assert.deepEqual(result.covered,copy(h.output.keywords()));
 for(const label of ['surround','visitor','count','cover','place'])assert(result.covered.includes(label));
 assert.equal(h.records[0].details.feedbackType,'keyword-coverage');assert.equal(h.output.pendingEvidence.evidence.complete,true);
});

test('verified targets accept the lemma and the source-observed regular noun and verb inflections without requiring recurrence',()=>{
 const lesson=fixture('The town is surrounded. Visitors counted cars, covered rubbish and placed baskets.',[entry('surround'),entry('visitor','n.'),entry('count'),entry('cover'),entry('place')]);
 for(const answer of ['surround visitor count cover place','surrounded visitors counted covered placed']){const h=setup(lesson,{recurrence:false});assert.equal(h.submit(answer).score,100);}
 const h=setup(lesson);assert.equal(h.submit('replacement discounted discovery visitorish surrounding').score,0,'related substrings are not whole target forms');
 const regular=fixture('A pupil studies, brushes and places books while trying and washing boxes.',[entry('study'),entry('brush'),entry('place'),entry('try'),entry('wash'),entry('box','n.')]);for(const answer of ['study brush place try wash box','studies brushes places trying washing boxes'])assert.equal(setup(regular,{recurrence:false}).submit(answer).score,100);
});

test('vocabulary and usage are filtered against source evidence before their display limits apply',()=>{
 const lesson=fixture('We walked through woods and went for a walk.',Array.from({length:8},(_,i)=>entry('missing'+i)).concat(entry('woods','n.')),[{phrase:'go shopping'},{phrase:'get on'},{phrase:'throw away'},{phrase:'at the station'},{phrase:'go for a walk',matchedForm:'went for a walk'}]);
 const {output}=setup(lesson);assert.deepEqual(copy(output.keywords()),['woods','go for a walk']);assert.equal(setup(lesson).submit('Woods go for a walk today.').score,100);assert.equal(setup(lesson).submit('Woods went for a walk today.').score,100);
});

test('recorded variants cannot change a phrase particle, token order or explicit negation to establish passage evidence',()=>{
 const bad=[['got off','get on',{matchedForm:'got off'}],['on got','get on',{variants:['on got']}],['got not on','get on',{variants:['got not on']}],['do hurry','do not hurry',{matchedForm:'do hurry',variants:['hurry']}]];
 for(const [body,phrase,extra]of bad){const {output}=setup(fixture('Woods '+body+' today.',[entry('woods','n.')],[{phrase,...extra}]));assert.deepEqual(copy(output.keywords()),['woods'],body+' does not prove '+phrase);}
 const negative=fixture('Woods visitors did not hurry today.',[entry('woods','n.')],[{phrase:'do not hurry',matchedForm:'did not hurry'}]);
 assert(setup(negative).submit('Woods visitors do not hurry today.').covered.includes('do not hurry'));
 assert(!setup(negative).submit('Woods visitors do hurry today.').covered.includes('do not hurry'));
 const particle=fixture('Woods visitors got on the train.',[entry('woods','n.')],[{phrase:'get on',matchedForm:'got on'}]);
 for(const answer of ['Woods visitors got off the train.','Woods visitors on got the train.','Woods visitors got not on the train.'])assert(!setup(particle).submit(answer).covered.includes('get on'));
});

test('source and answer matching respects whole tokens and phrase punctuation boundaries while accepting whitespace',()=>{
 for(const body of ['Woods visitors got. On the train.','Woods visitors got, on the train.','Woods replacement discounted today.']){const h=setup(fixture(body,[entry('woods','n.'),entry('place'),entry('count')],[{phrase:'get on',matchedForm:'got on'}]));assert.deepEqual(copy(h.output.keywords()),['woods']);}
 const lesson=fixture('Woods visitors got\n on the train.',[entry('woods','n.')],[{phrase:'get on',matchedForm:'got on'}]);assert.equal(setup(lesson).submit('Woods visitors got\n on the train.').score,100);assert(!setup(lesson).submit('Woods visitors got. On the train.').covered.includes('get on'));
});

test('verified passages with no trustworthy vocabulary fall back to actual content words',()=>{
 const {output}=setup(fixture('The ancient forest surrounds a quiet village.',[entry('replacement')],[{phrase:'go shopping'}]));const keywords=copy(output.keywords());assert(keywords.length>0);assert(keywords.includes('ancient'));assert(!keywords.includes('replacement'));assert(!keywords.includes('go shopping'));assert(!keywords.includes('the'));
});

test('morphology respects vocabulary POS: new is not news, unknown a is not as, and through stays literal',()=>{
 const lesson=fixture('News spreads as visitors walk through woods.',[entry('new','adj.'),entry('a',''),entry('through','prep.'),entry('visitor','n.')]);
 assert.deepEqual(copy(setup(lesson).output.keywords()),['through','visitor']);assert.equal(setup(lesson).submit('Through visitor walk beside quiet woods.').score,100);assert.deepEqual(setup(lesson).submit('Throughs visitor walk beside quiet woods.').missing,['through']);
});

test('notes-only and unverified imported lessons keep the legacy string keywords and retelling behavior',()=>{
 const lesson=fixture('A different paragraph.',[entry('legacy')],[{phrase:'go shopping'}]);lesson.textbook.verified=false;const h=setup(lesson);assert.deepEqual(copy(h.output.keywords()),['legacy','go shopping']);assert.equal(h.submit('Legacy pupils go shopping together.').score,100);assert.match(h.output.renderRetell(),/已有内容要点/);assert.doesNotMatch(h.output.renderRetell(),/学习笔记要点（不计入课文复述覆盖）/);
 delete lesson.textbook;assert.deepEqual(copy(setup(lesson).output.keywords()),['legacy','go shopping']);
});
