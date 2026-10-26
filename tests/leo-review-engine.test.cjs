const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../review-engine.js'),'utf8'),ctx);
const R=ctx.window.StudyReview;
const DAY=86400000, NOW=Date.parse('2026-10-24T06:00:00Z');
const lesson={id:'nce-b2-l001',book:2,number:1,title:'A private conversation',vocabulary:[{word:'seat',meaning:'座位',example:'I had a very good seat.'},{word:'SEAT',meaning:'座位'}],usage:[{phrase:'pay attention',meaning:'注意',example:'They did not pay any attention.'}],quiz:[{type:'grammar',question:'They did not ____ any attention.',options:['pay','paid'],answer:0,explanation:'did not 后用动词原形。'}]};
const cards=()=>R.cardsForLessons([lesson]);
test('cards have stable source identities, distinct exercise types and no duplicate vocabulary',()=>{
 const a=cards(),b=R.cardsForLessons([{...lesson,vocabulary:[...lesson.vocabulary].reverse()}]);
 assert.equal(a.length,3);assert.deepEqual(Array.from(a,x=>x.id).sort(),Array.from(b,x=>x.id).sort());
 assert.deepEqual(Array.from(a,x=>x.kind).sort(),['grammar','phrase','word']);
 assert.ok(a.every(c=>c.sourceLesson.book===2&&c.sourceLesson.number===1));
});
test('only enrolled knowledge becomes due and a second enrollment preserves prior progress',()=>{
 const cs=cards();let s=R.sanitize();assert.equal(R.queue(s,cs,{now:NOW}).length,0);
 s=R.enroll(s,cs,{now:NOW});assert.equal(R.queue(s,cs,{now:NOW}).length,3);
 let out=R.rate(s,cs[0].id,'good',{now:NOW,revision:0});assert.equal(out.accepted,true);s=out.state;
 const again=R.enroll(s,cs,{now:NOW+1000});assert.equal(again.cards[cs[0].id].dueAt,NOW+DAY);assert.equal(again.cards[cs[0].id].revision,1);
});
test('remembered cards advance through one then three days, never from duplicate or early submissions',()=>{
 const cs=cards();let s=R.enroll(R.sanitize(),cs,{now:NOW});const id=cs[0].id;
 const first=R.rate(s,id,'good',{now:NOW,revision:0});assert.equal(first.state.cards[id].dueAt,NOW+DAY);
 assert.equal(R.rate(first.state,id,'good',{now:NOW,revision:0}).accepted,false);
 assert.equal(R.rate(first.state,id,'good',{now:NOW+1000,revision:1}).accepted,false);
 const second=R.rate(first.state,id,'good',{now:NOW+DAY,revision:1});assert.equal(second.accepted,true);assert.equal(second.state.cards[id].dueAt,NOW+4*DAY);
 assert.equal(s.cards[id].revision,0,'rating must not mutate old state');
});
test('forgotten cards reappear after ten minutes and unique daily completion does not double count',()=>{
 const cs=cards(),id=cs[0].id;let s=R.enroll(R.sanitize(),cs,{now:NOW});
 s=R.rate(s,id,'again',{now:NOW,revision:0}).state;
 assert.equal(s.cards[id].dueAt,NOW+600000);assert.equal(R.queue(s,cs,{now:NOW+599999}).some(c=>c.id===id),false);
 assert.equal(R.queue(s,cs,{now:NOW+600000}).some(c=>c.id===id),true);
 s=R.rate(s,id,'good',{now:NOW+600000,revision:1}).state;
 assert.equal(R.stats(s,cs,{now:NOW+600000}).reviewedToday,1);assert.equal(s.cards[id].lapses,1);
});
test('hard recall retains its stage and postpones one day',()=>{
 const cs=cards(),id=cs[0].id;let s=R.enroll(R.sanitize(),cs,{now:NOW});
 s=R.rate(s,id,'good',{now:NOW,revision:0}).state;
 s=R.rate(s,id,'hard',{now:NOW+DAY,revision:1}).state;
 assert.equal(s.cards[id].stage,1);assert.equal(s.cards[id].dueAt,NOW+2*DAY);
});
test('daily statistics switch at Shanghai midnight, preserved across JSON reload',()=>{
 const at=Date.parse('2026-10-24T15:59:59Z');assert.equal(R.dayKey(at),'2026-10-24');assert.equal(R.dayKey(at+1000),'2026-10-25');
 const cs=cards();let s=R.enroll(R.sanitize(),cs,{now:at});s=R.rate(s,cs[0].id,'good',{now:at,revision:0}).state;
 const loaded=R.sanitize(JSON.parse(JSON.stringify(s)));assert.equal(R.stats(loaded,cs,{now:at}).reviewedToday,1);assert.equal(R.stats(loaded,cs,{now:at+1000}).reviewedToday,0);
});
test('malformed persisted records and missing or invalid ratings cannot corrupt state',()=>{
 const cs=cards(),s=R.sanitize({cards:{bad:{dueAt:'nonsense',stage:1000}},daily:{}});
 assert.equal(Object.keys(s.cards).length,0);assert.equal(R.rate(s,'missing','good',{now:NOW,revision:0}).accepted,false);
 const enrolled=R.enroll(s,cs,{now:NOW});assert.equal(R.rate(enrolled,cs[0].id,'unknown',{now:NOW,revision:0}).accepted,false);
 assert.equal(R.rate(enrolled,cs[0].id,'good',{now:NOW}).accepted,false);
});
test('spelling ignores case and terminal punctuation but never accepts blank or a different word',()=>{
 const word=cards().find(c=>c.kind==='word');assert.equal(R.checkAnswer(word,' Seat. ').correct,true);
 assert.equal(R.checkAnswer(word,'sit').correct,false);assert.equal(R.checkAnswer(word,'').correct,false);
 const grammar=cards().find(c=>c.kind==='grammar');assert.equal(R.checkAnswer(grammar,'pay').correct,true);assert.equal(R.checkAnswer(grammar,'paid').correct,false);
 const phrase=cards().find(c=>c.kind==='phrase');assert.equal(R.checkAnswer(phrase,'pay attention').correct,true);assert.equal(R.checkAnswer(phrase,'repay attention').correct,false);
});
