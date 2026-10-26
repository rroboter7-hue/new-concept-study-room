const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const files=['curriculum.js','textbook-lessons.js','book2-lessons.js','book2-translations.js','phrase-library.js','book2-learning-support.js','book2-vocabulary.js','book2-quality-support.js','book2-reviewed-questions.js','pilot-question-expansion.js','study-knowledge.js','knowledge-bootstrap.js','recurrence.js','review-engine.js'];
const now=1792980000000,at=now+1000,first='nce-b2-eef57c-l001',second='nce-b2-eef57c-l002';
const plain=value=>JSON.parse(JSON.stringify(value));
function load(){const scope={};scope.window=scope;vm.createContext(scope);for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope,{filename:file});const lessons=scope.LESSONS.filter(l=>l.book===2&&l.number<=10),R=scope.StudyReview,cards=R.cardsForLessons(lessons);let state=R.enroll(null,cards,{now});for(const card of cards)state=R.rate(state,card.id,'good',{now,revision:0}).state;return {scope,R,cards,state,bank:scope.StudyKnowledge.bank,questions:lessons.flatMap(l=>scope.StudyKnowledge.bank.questionsForLesson(l.id))};}

test('all 29 registered expansion vocabulary mistakes revisit their exact source cards without changing stage or other progress',()=>{
 const h=load();assert.equal(typeof h.R.revisitQuestionMistakes,'function');const questions=h.questions.filter(q=>q.type==='vocabulary'&&q.id?.includes('-expansion-'));assert.equal(questions.length,29);const before=plain(h.state);
 for(const question of questions){const next=h.R.revisitQuestionMistakes(h.state,h.cards,question.lessonId,[question.id],{now:at});const expected=h.cards.filter(c=>question.sourceConceptIds.includes(c.conceptId));assert.equal(expected.length,1,question.id);const source=expected[0];assert.equal(next.cards[source.id].dueAt,at,question.id);assert.equal(next.cards[source.id].revision,2);assert.equal(next.cards[source.id].stage,1);assert.equal(next.cards[source.id].repetitions,1);assert.equal(next.cards[source.id].lapses,0);for(const other of h.cards.filter(c=>c.id!==source.id))assert.deepEqual(plain(next.cards[other.id]),before.cards[other.id],question.id);}
 assert.deepEqual(plain(h.state),before,'original progress stays immutable');
});

test('a later lesson mistake targets its registered earlier source, never a same-word card from another lesson',()=>{
 const h=load();assert.equal(typeof h.R.revisitQuestionMistakes,'function');const id=second+'-expansion-retrieve-private',source=h.cards.find(c=>c.conceptId==='knowledge:'+first+':word:private'),other={...source,id:'review:other:word:private',conceptId:'knowledge:other:word:private',sourceLesson:{id:'other',book:2,number:3}};
 let state=h.R.enroll(h.state,[other],{now});state=h.R.rate(state,other.id,'good',{now,revision:0}).state;const before=plain(state),next=h.R.revisitQuestionMistakes(state,[...h.cards,other],second,[id,id],{now:at});assert.equal(next.cards[source.id].dueAt,at);assert.equal(next.cards[source.id].revision,2);assert.deepEqual(plain(next.cards[other.id]),before.cards[other.id]);assert.equal(h.R.revisitQuestionMistakes(null,h.cards,second,[id],{now:at}).cards[source.id],undefined,'never enrolls the earlier source');
});

test('question IDs must belong to the registered current lesson and cannot be replaced by claimed concept IDs',()=>{
 const h=load();assert.equal(typeof h.R.revisitQuestionMistakes,'function');const q=h.questions.find(q=>q.id===second+'-expansion-retrieve-private'),before=plain(h.state);
 for(const ids of [[q.id],[q.conceptId],['unregistered'],[{id:q.id}]]){const lessonId=ids[0]===q.id?first:second;assert.deepEqual(plain(h.R.revisitQuestionMistakes(h.state,h.cards,lessonId,ids,{now:at})),before);}
});

test('a source link that disagrees with the registered question record cannot advance a card',()=>{
 const h=load();assert.equal(typeof h.R.revisitQuestionMistakes,'function');const q=h.questions.find(q=>q.id===second+'-expansion-retrieve-private'),before=plain(h.state),real=h.bank;
 h.scope.StudyKnowledge.bank={...real,questionsForLesson:id=>real.questionsForLesson(id).map(row=>row.id===q.id?{...row,sourceConceptIds:['knowledge:'+second+':word:repeat']}:row)};
 assert.deepEqual(plain(h.R.revisitQuestionMistakes(h.state,h.cards,second,[q.id],{now:at})),before);
 h.scope.StudyKnowledge.bank={...real,get:id=>{const record=real.get(id);return id==='knowledge:'+first+':word:private'?{...record,lessonId:second}:record;}};
 assert.deepEqual(plain(h.R.revisitQuestionMistakes(h.state,h.cards,second,[q.id],{now:at})),before);
});
