const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),plain=x=>JSON.parse(JSON.stringify(x)),now=Date.UTC(2026,9,26,1),later=now+1000;
const normalize=value=>String(value).normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase().replace(/[.!?,;:"“”'。！？]+$/g,'').replace(/\s+/g,' ');
const cardId=(lessonId,prompt)=>'review:'+encodeURIComponent(lessonId)+':grammar:'+encodeURIComponent(normalize(prompt));
function load(){const c={};c.window=c;vm.createContext(c);for(const file of ['curriculum.js','textbook-lessons.js','book2-lessons.js','book2-translations.js','book2-reading-alignment.js','phrase-library.js','book2-learning-support.js','book2-vocabulary.js','book2-additional-context-fixes.js','book2-quality-support.js','book2-practice-packs.js','book2-reviewed-questions.js','study-knowledge.js','practice-pack-core.js','review-engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});const bank=c.StudyKnowledge.install(c.LESSONS,{grammarAudit:c.BOOK2_QUESTION_REVIEWS}),registry=c.StudyPracticePacks.create(c.BOOK2_PRACTICE_PACKS,c.LESSONS,bank);assert.equal(registry.issues.length,0);c.StudyPracticePacks.registry=registry;const lesson=c.LESSONS.find(l=>l.book===2&&l.number===1),cards=c.StudyReview.cardsForLessons([lesson]),packCards=cards.filter(card=>card.sourceType==='authored-practice-pack');assert.equal(packCards.length,3);return {c,review:c.StudyReview,bank,registry,lesson,cards,packCards};}
function future(review,cards){let state=review.enroll(null,cards,{now});for(const card of cards){const result=review.rate(state,card.id,'good',{now,revision:0});assert.equal(result.accepted,true);state=result.state;}return state;}

test('a real verified pack grammar mistake is due today while correct pack and original grammar cards keep their schedules',()=>{
 const {review,cards,packCards}=load(),wrong=packCards[0],state=future(review,cards),before=plain(state),next=review.revisitMistakes(state,cards,[wrong.conceptId,wrong.conceptId],{now:later});assert.equal(next.cards[wrong.id].dueAt,later);assert.equal(next.cards[wrong.id].revision,before.cards[wrong.id].revision+1);assert.equal(next.cards[wrong.id].stage,before.cards[wrong.id].stage);assert.equal(next.cards[wrong.id].repetitions,before.cards[wrong.id].repetitions);assert.equal(next.cards[wrong.id].lapses,before.cards[wrong.id].lapses);for(const card of cards.filter(card=>card.id!==wrong.id))assert.deepEqual(plain(next.cards[card.id]),before.cards[card.id],card.id);assert(cards.some(card=>card.kind==='grammar'&&card.sourceType!=='authored-practice-pack'));assert.deepEqual(Array.from(review.queue(next,cards,{now:later}),card=>card.id),[wrong.id]);assert.deepEqual(plain(state),before,'input state stays immutable');assert.deepEqual(plain(review.revisitMistakes(next,cards,[wrong.conceptId],{now:later})),plain(next),'an already-due card is not revised twice');assert.equal(review.rate(next,wrong.id,'good',{now:later,revision:before.cards[wrong.id].revision}).accepted,false,'open stale review answers remain invalid');
});

test('source, concept, prompt, options, answer, target and card ID forgeries cannot reschedule a pack card',()=>{
 const {review,packCards}=load(),original=plain(packCards[0]),other=plain(packCards[1]),forgeries=[
  {...original,sourceLesson:{...original.sourceLesson,id:'other'},id:cardId('other',original.prompt)},
  {...original,conceptId:other.conceptId},
  {...original,conceptId:'pack:'+encodeURIComponent(original.sourceLesson.id)+':grammar:invented'},
  {...original,conceptId:'knowledge:'+encodeURIComponent(original.sourceLesson.id)+':grammar:invented'},
  {...original,prompt:original.prompt+' Another prompt.',id:cardId(original.sourceLesson.id,original.prompt+' Another prompt.')},
  {...original,prompt:original.prompt+'!',id:cardId(original.sourceLesson.id,original.prompt+'!')},
  {...original,options:original.options.slice(0,3)},
  {...original,options:original.options.map((option,index)=>index===0?option+' forged':option)},
  {...original,options:original.options.slice().reverse(),answer:3-original.answer},
  {...original,answer:(original.answer+1)%original.options.length,target:original.options[(original.answer+1)%original.options.length]},
  {...original,target:'another target'},
  {...original,id:other.id},
  {...original,sourceType:'unverified-pack'},
  {...original,kind:'word'}
 ];for(const forged of forgeries){const state=future(review,[forged]),next=review.revisitMistakes(state,[forged],[forged.conceptId],{now:later});assert.deepEqual(plain(next),plain(state),JSON.stringify(forged));}
});

test('comprehension tasks, followups, unavailable registries and source-stale packs are not accepted as formal pack grammar cards',()=>{
 const {c,review,registry,lesson,packCards}=load(),pack=registry.get(lesson.id),formal=pack.tasks.find(q=>q.category==='grammar'),notGrammar=pack.tasks.find(q=>q.category==='comprehension');for(const q of [notGrammar,formal.followup]){const forged={id:cardId(lesson.id,q.prompt),kind:'grammar',target:q.options[q.answer],prompt:q.prompt,options:q.options.slice(),answer:q.answer,conceptId:q.conceptId,sourceType:'authored-practice-pack',sourceLesson:{id:lesson.id}},state=future(review,[forged]);assert.deepEqual(plain(review.revisitMistakes(state,[forged],[forged.conceptId],{now:later})),plain(state));}
 const original=packCards[0],state=future(review,[original]);c.StudyPracticePacks.registry=null;assert.deepEqual(plain(review.revisitMistakes(state,[original],[original.conceptId],{now:later})),plain(state));const staleManifest=plain(c.BOOK2_PRACTICE_PACKS);staleManifest.lessons.find(p=>p.lessonId===lesson.id).sourcePassages[0]+=' Stale edit.';c.StudyPracticePacks.registry=c.StudyPracticePacks.create(staleManifest,c.LESSONS,c.StudyKnowledge.bank);assert.equal(c.StudyPracticePacks.registry.get(lesson.id),null);assert.deepEqual(plain(review.revisitMistakes(state,[original],[original.conceptId],{now:later})),plain(state));
});

test('original canonical word and grammar mistake scheduling remains source-bound and cannot enroll unknown cards',()=>{
 const {review,cards}=load(),word=cards.find(card=>card.kind==='word'),grammar=cards.find(card=>card.kind==='grammar'&&card.sourceType!=='authored-practice-pack'),state=future(review,cards),before=plain(state),next=review.revisitMistakes(state,cards,[word.conceptId,grammar.conceptId],{now:later});assert.equal(next.cards[word.id].dueAt,later);assert.equal(next.cards[grammar.id].dueAt,later);for(const card of cards.filter(card=>![word.id,grammar.id].includes(card.id)))assert.deepEqual(plain(next.cards[card.id]),before.cards[card.id]);for(const original of [word,grammar]){const forged={...original,conceptId:original.conceptId.replace(original.sourceLesson.id,'other')};assert.deepEqual(plain(review.revisitMistakes(state,[forged],[forged.conceptId],{now:later})),before);}assert.equal(review.revisitMistakes(null,cards,[word.conceptId,grammar.conceptId],{now:later}).cards[word.id],undefined);
});
