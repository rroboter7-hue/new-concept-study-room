const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const scope = {};
  scope.window = scope;
  vm.createContext(scope);
  for (const file of ['recurrence.js', 'review-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), scope, {filename:file});
  }
  return {recurrence:scope.StudyRecurrence, review:scope.StudyReview};
}
const lesson = (id, book, number, extra = {}) => ({id, book, number, title:id, paragraphs:[], vocabulary:[], usage:[], grammar:[], quiz:[], ...extra});
const plain = value => JSON.parse(JSON.stringify(value));
const concept = (lessonId, kind, key) => 'knowledge:' + encodeURIComponent(lessonId) + ':' + kind + ':' + encodeURIComponent(key);

test('learned origins are selected before the display limit and identify the displayed source', () => {
  const {recurrence} = setup();
  const oldWords = ['apple','bread','chair','door','egg','fish','glass','house','ice'];
  const earlier = lesson('earlier',1,1,{vocabulary:oldWords.concat('recall').map(word=>({word,meaning:'旧词'}))});
  const learned = lesson('learned',2,1,{vocabulary:[{word:'recall',meaning:'回忆'}]});
  const current = lesson('current',2,2,{paragraphs:[{en:oldWords.join(' ') + ' recall.'}]});
  const index = recurrence.build([current,earlier,learned]);
  const rows = index.forLesson('current',{studiedIds:['learned'],limit:1});
  assert.equal(rows.length,1);
  assert.equal(rows[0].label,'recall');
  assert.equal(rows[0].origin.lessonId,'learned');
  assert.equal(rows[0].origin.studied,true);
  assert.equal(rows[0].studied,true);
  assert.equal(index.forLesson('current',{limit:100}).find(row=>row.label==='recall').origin.lessonId,'earlier', 'a prior request must not change cached provenance');
});

test('a small recurrence display includes available words, phrases and explicit grammar', () => {
  const {recurrence} = setup();
  const source = lesson('source',1,1,{
    vocabulary:['apple','bread','chair','door','egg','fish','glass','house','ice'].map(word=>({word,meaning:'词义'}))
  });
  const phraseSource = lesson('phrase-source',1,2,{
    usage:[{phrase:'look at',meaning:'看'}],
    grammar:[{title:'现在时',knowledgeId:'present'}]
  });
  const current = lesson('current',1,3,{paragraphs:[{en:'Apple bread chair door egg fish glass house ice. Look at the door.'}],grammar:[{title:'现在时',knowledgeId:'present',example:'I look at the door.'}]});
  const rows = recurrence.build([source,phraseSource,current]).forLesson('current',{limit:3});
  assert.deepEqual(Array.from(rows,row=>row.kind).sort(),['grammar','usage','vocabulary']);
  assert.ok(rows.every(row=>row.hasStudiedOrigin===false), 'unlearned source links remain available as prerequisites');
});

test('practice card selection requires an exact word or phrase and a learned source by default', () => {
  const {recurrence} = setup();
  assert.equal(typeof recurrence.selectReviewCards,'function');
  const items = [
    {kind:'vocabulary',label:'ＢＯＯＫ',origins:[{lessonId:'old',studied:true}]},
    {kind:'usage',label:'take part in',variants:['join in'],origins:[{lessonId:'old',studied:true}]},
    {kind:'vocabulary',label:'pen',origins:[{lessonId:'unlearned',studied:false}]}
  ];
  const cards = [
    {id:'word',kind:'word',target:' book ',prompt:'书',sourceLesson:{id:'old'}},
    {id:'alias',kind:'phrase',target:'join in',prompt:'参加',sourceLesson:{id:'old'}},
    {id:'prefix',kind:'phrase',target:'take part',prompt:'参加',sourceLesson:{id:'old'}},
    {id:'wrong-source',kind:'word',target:'book',prompt:'书',sourceLesson:{id:'other'}},
    {id:'new',kind:'word',target:'pen',prompt:'笔',sourceLesson:{id:'unlearned'}},
    {id:'word',kind:'word',target:'book',prompt:'书',sourceLesson:{id:'old'}}
  ];
  const before = JSON.stringify({items,cards});
  assert.deepEqual(Array.from(recurrence.selectReviewCards(items,cards),card=>card.id),['word','alias']);
  assert.deepEqual(Array.from(recurrence.selectReviewCards(items,cards,{studiedOnly:false}),card=>card.id),['word','alias','new']);
  assert.equal(JSON.stringify({items,cards}),before,'selection is pure');
});

test('one card per recurring concept prefers the displayed learned origin and a usable definition', () => {
  const {recurrence} = setup();
  const origins=[{lessonId:'first',studied:true},{lessonId:'second',studied:true}];
  const items=[
    {key:'usage:look at',kind:'usage',label:'look at',origin:origins[0],origins},
    {key:'usage:go on',kind:'usage',label:'go on',origin:origins[0],origins},
    {key:'usage:look at',kind:'usage',label:'look at',origin:origins[0],origins}
  ];
  const cards=[
    {id:'look-second',kind:'phrase',target:'look at',prompt:'注视',sourceLesson:{id:'second'}},
    {id:'look-first',kind:'phrase',target:'look at',prompt:'看',sourceLesson:{id:'first'}},
    {id:'go-first',kind:'phrase',target:'go on',prompt:'原笔记习惯表达（未附独立中文释义）',sourceLesson:{id:'first'}},
    {id:'go-second',kind:'phrase',target:'go on',prompt:'继续',sourceLesson:{id:'second'}}
  ];
  assert.deepEqual(Array.from(recurrence.selectReviewCards(items,cards),card=>card.id),['look-first','go-second']);
});

test('grammar practice matches explicit canonical concepts instead of all questions in the source lesson', () => {
  const {recurrence,review} = setup();
  assert.equal(typeof recurrence.selectReviewCards,'function');
  const source = lesson('source',1,1,{grammar:[{title:'现在时',knowledgeId:'present'}],quiz:[
    {type:'grammar',question:'She ___ here.',options:['is','are'],answer:0,knowledgeId:concept('source','grammar','present')},
    {type:'grammar',question:'They ___ here yesterday.',options:['was','were'],answer:1,conceptId:concept('source','grammar','past')}
  ]});
  const current = lesson('current',1,2,{grammar:[{title:'现在时',knowledgeId:'present',example:'She is here.'}]});
  const items = recurrence.build([source,current]).forLesson('current',{studiedIds:['source']});
  const cards = review.cardsForLessons([source]);
  const selected = recurrence.selectReviewCards(items,cards);
  assert.equal(selected.length,1);
  assert.equal(selected[0].prompt,'She ___ here.');
  assert.deepEqual(Array.from(recurrence.selectReviewCards([{kind:'grammar',label:'现在时',origins:[{lessonId:'source',studied:true}]}],cards)),[], 'matching titles alone cannot identify a quiz concept');
  assert.deepEqual(Array.from(recurrence.selectReviewCards(items,[{...cards[0],knowledgeId:concept('other','grammar','present')} ])),[], 'a scoped identity must belong to the card source');
});

test('placeholder phrase definitions cannot become recall prompts', () => {
  const {review} = setup();
  const cards = review.cardsForLessons([lesson('source',2,1,{usage:[
    {phrase:'at large',meaning:'原笔记习惯表达（未附独立中文释义）'},
    {phrase:'go on',meaning:'未提供中文释义'},
    {phrase:'look at',meaning:'看；注视'}
  ]})]);
  assert.deepEqual(Array.from(cards,card=>card.target),['look at']);
});

test('wrong known concepts are brought forward without changing other schedules or accepting cross-source IDs', () => {
  const {review} = setup();
  assert.equal(typeof review.revisitMistakes,'function');
  const start = Date.UTC(2026,9,26,1), later = start+86400000;
  const cards = review.cardsForLessons([
    lesson('source',2,1,{vocabulary:[{word:'book',meaning:'书',conceptId:concept('source','word','book')},{word:'pen',meaning:'笔',conceptId:concept('source','word','pen')}]}),
    lesson('other',2,2,{vocabulary:[{word:'book',meaning:'预订',conceptId:concept('other','word','book')}]})
  ]);
  let state = review.enroll(null,cards,{now:start});
  for (const card of cards) state = review.rate(state,card.id,'good',{now:start,revision:0}).state;
  const before = plain(state), next = review.revisitMistakes(state,cards,[concept('source','word','book')],{now:start+1000});
  assert.equal(next.cards[cards[0].id].dueAt,start+1000);
  assert.equal(next.cards[cards[0].id].revision,2);
  assert.equal(next.cards[cards[0].id].stage,1);
  assert.equal(next.cards[cards[0].id].repetitions,1);
  assert.deepEqual(plain(next.cards[cards[1].id]),before.cards[cards[1].id]);
  assert.deepEqual(plain(next.cards[cards[2].id]),before.cards[cards[2].id]);
  assert.deepEqual(plain(state),before,'input state is not mutated');
  const forged = {...cards[2],conceptId:concept('source','word','book')};
  assert.equal(review.revisitMistakes(state,[forged],[forged.conceptId],{now:start+1000}).cards[cards[2].id].dueAt,later);
  const wrongDestination = {...cards[0],id:cards[1].id};
  assert.equal(review.revisitMistakes(state,[wrongDestination],[wrongDestination.conceptId],{now:start+1000}).cards[cards[1].id].dueAt,later, 'a source-bound concept cannot target a different card ID');
  assert.equal(review.revisitMistakes(null,cards,[cards[0].conceptId],{now:start+1000}).cards[cards[0].id],undefined,'mistake handling never enrolls an unknown card');
  assert.equal(review.rate(next,cards[0].id,'good',{now:later,revision:1}).accepted,false,'bringing a card forward invalidates stale open questions');
});

test('review due boundaries and lapse timing use an injected clock without advancing wall time', () => {
  const {review} = setup();
  const start=Date.UTC(2026,9,26,1),cards=review.cardsForLessons([lesson('source',1,1,{vocabulary:[{word:'book',meaning:'书'}]})]);
  let now=start,state=review.enroll(null,cards,{now});
  for (const days of [1,3,7,14,30,30]) {
    const record=state.cards[cards[0].id],result=review.rate(state,cards[0].id,'good',{now,revision:record.revision});
    assert.equal(result.accepted,true);
    assert.equal(result.nextDueAt-now,days*86400000);
    assert.equal(review.queue(result.state,cards,{now:result.nextDueAt-1}).length,0);
    assert.equal(review.queue(result.state,cards,{now:result.nextDueAt}).length,1);
    assert.equal(review.rate(result.state,cards[0].id,'good',{now:result.nextDueAt,revision:record.revision}).accepted,false);
    state=result.state;now=result.nextDueAt;
  }
  const again=review.rate(state,cards[0].id,'again',{now,revision:state.cards[cards[0].id].revision});
  assert.equal(again.nextDueAt-now,600000);
  assert.equal(again.state.cards[cards[0].id].lapses,1);
  assert.equal(review.queue(again.state,cards,{now:start-1}).length,0);
});
