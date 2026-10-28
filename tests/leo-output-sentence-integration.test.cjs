const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(canPracticeSentences, defaultMode = 'transform') {
  const lessons = [
    {id:'old',book:1,number:1,title:'Family',vocabulary:[{word:'sister'}],usage:[{phrase:'look at'}],paragraphs:[{en:'My sister looks at a book.'}]},
    {id:'now',book:1,number:2,title:'Books',vocabulary:[{word:'book'}],usage:[],paragraphs:[{en:'I read a book.'}]},
    {id:'next',book:1,number:3,title:'Pens',vocabulary:[{word:'pen'}],usage:[],paragraphs:[{en:'I have a pen.'}]}
  ];
  const drafts = {}, records = [], timers = new Map(), fields = new Map();
  const sentenceRoot = {innerHTML:'',querySelector(selector) { if (!fields.has(selector)) fields.set(selector,{textContent:'',innerHTML:'',dataset:{},focus(){}});return fields.get(selector); }};
  const outputRoot = {innerHTML:''};
  let current = lessons[1], timer = 0;
  const scope = {console,document:{addEventListener(){},querySelector(selector){return selector === '#output-content' ? outputRoot : selector === '#sentence-practice-content' ? sentenceRoot : null;}},setTimeout(callback){timers.set(++timer,callback);return timer;},clearTimeout(id){timers.delete(id);}};
  scope.window = scope;
  vm.createContext(scope);
  for (const filename of ['sentence-core.js','sentence-practice.js','output-practice.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),scope);
  const practice = new scope.SentencePractice({defaultMode,getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>({old:{completed:true}}),getDrafts:()=>drafts,saveDraft(key,draft){drafts[key]=JSON.parse(JSON.stringify(draft));return true;}});
  const output = new scope.OutputPractice({getLesson:()=>current,sentencePractice:practice,canPracticeSentences,saveRecord(result){records.push(result);return true;}});
  function sentenceEvent(dataset, value) {
    const target = {dataset,value,closest(selector){return selector === '#sentence-practice-content' ? sentenceRoot : selector === '[data-sentence-action]' ? target : null;}};
    return {target,preventDefault(){}};
  }
  function mode(value) {
    const target = {dataset:{outputAction:'mode',outputMode:value},closest(selector){return selector === '[data-output-action]' ? target : selector === '#output-content' ? outputRoot : null;}};
    output.click({target});
  }
  return {output,practice,drafts,records,lessons,mode,
    input(value){practice.handleInput(sentenceEvent({sentenceInput:'answer'},value));},
    step(value){practice.handleClick(sentenceEvent({sentenceAction:'step',sentenceStep:String(value)}));},
    check(){practice.handleClick(sentenceEvent({sentenceAction:'check'}));},
    select(field,value){practice.handleChange(sentenceEvent({sentenceSelect:field},value));},
    setLesson(lesson){current=lesson;output.setLesson(lesson);}
  };
}

test('an unavailable canonical-course context hides sentence mode while retaining existing modes', () => {
  const h = setup(() => false), html = h.output.render();
  assert.doesNotMatch(html,/data-output-mode="sentences"/);
  assert.match(html,/data-output-mode="write"/);
  assert.match(html,/data-output-mode="spell"/);
  assert.match(html,/data-output-mode="retell"/);
});

test('omitting the optional availability callback retains sentence mode', () => {
  const h = setup();
  assert.match(h.output.render(),/data-output-mode="sentences"/);
  h.mode('sentences');
  assert.equal(h.output.mode,'sentences');
  assert.equal(h.practice.target().word,'book');
});

test('when availability changes, an active sentence mode flushes its draft and falls back to retelling', () => {
  let allowed = true;
  const h = setup(() => allowed);
  h.output.render();h.mode('sentences');h.input('I keep my book.');
  assert.equal(Object.values(h.drafts).some(draft=>draft.answers?.affirmative==='I keep my book.'),false);
  assert.equal(h.practice.active.draft.answers.affirmative,'I keep my book.');
  allowed = false;
  const html = h.output.render();
  assert.equal(h.output.mode,'retell');
  assert.doesNotMatch(html,/data-output-mode="sentences"/);
  assert.match(html,/data-output-input="answer"/);
  assert.ok(Object.values(h.drafts).some(draft=>draft.answers.affirmative==='I keep my book.'));
});

test('switching output modes flushes pending sentence input without recording a score', () => {
  const h = setup();h.output.render();h.mode('sentences');h.input('I read this book.');
  h.mode('spell');
  assert.equal(h.output.mode,'spell');
  assert.ok(Object.values(h.drafts).some(draft=>draft.answers.affirmative==='I read this book.'));
  assert.deepEqual(h.records,[]);
  h.mode('sentences');
  assert.equal(h.practice.active.draft.answers.affirmative,'I read this book.');
});

test('switching courses flushes the previous sentence draft before resetting the output mode', () => {
  const h = setup();h.output.render();h.mode('sentences');h.input('This book is mine.');
  h.setLesson(h.lessons[2]);
  assert.equal(h.output.mode,'write');
  assert.ok(Object.entries(h.drafts).some(([key,draft])=>key.startsWith('v1:now:')&&draft.answers.affirmative==='This book is mine.'));
  h.mode('sentences');h.input('I have a pen.');
  h.setLesson(h.lessons[1]);h.mode('sentences');
  assert.equal(h.practice.active.draft.answers.affirmative,'This book is mine.');
  assert.deepEqual(h.records,[]);
});

test('checking all five sentences saves drafts without calling the scored output-record path', () => {
  const h = setup();h.output.render();h.mode('sentences');
  h.select('old-word','word:old:sister');h.select('old-phrase','phrase:old:look%20at');
  ['I read a book.','I do not read a book.','Do I read a book?','Where do I read a book?','My sister looks at a book.'].forEach((answer,index)=>{h.step(index);h.input(answer);});
  h.check();
  assert.equal(h.practice.result.writtenCount,5);
  assert.equal(h.practice.result.rows.length,5);
  assert.ok(Object.values(h.drafts).some(draft=>draft.answers.combined==='My sister looks at a book.'&&draft.checkedAt>0));
  assert.deepEqual(h.records,[]);
});
test('fresh flexible course drafts flush under their new namespace and restore without touching legacy drafts',()=>{const h=setup(undefined,'flexible');h.output.render();h.mode('sentences');h.input('This book is mine.');h.setLesson(h.lessons[2]);assert.ok(Object.entries(h.drafts).some(([key,d])=>key.startsWith('v2:flexible:now:')&&d.answers.affirmative==='This book is mine.'));h.mode('sentences');h.input('I have a pen.');h.setLesson(h.lessons[1]);h.mode('sentences');assert.equal(h.practice.active.draft.mode,'flexible');assert.equal(h.practice.active.draft.answers.affirmative,'This book is mine.');assert.deepEqual(h.records,[]);});
