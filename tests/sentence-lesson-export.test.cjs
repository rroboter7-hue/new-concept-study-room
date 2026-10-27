const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'old',book:1,number:1,title:'Old lesson',vocabulary:[{word:'send',pos:'v.',meaning:'寄送'}],usage:[{phrase:'look at',meaning:'看'}]},
  {id:'old-again',book:1,number:2,title:'Another old lesson',vocabulary:[{word:'send',pos:'v.',meaning:'发送'},{word:'warm',pos:'adj.',meaning:'温暖的'}],usage:[{phrase:'look at',meaning:'看'}]},
  {id:'now',book:1,number:3,title:'Current lesson',vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'}],usage:[{phrase:'read about',meaning:'阅读有关内容'}]},
  {id:'later',book:1,number:4,title:'Later lesson',vocabulary:[{word:'letter',meaning:'信'}],usage:[]}
];
const copy = value => JSON.parse(JSON.stringify(value));

function setup({drafts = {}, getVocabulary, getUsage, failSave = false} = {}) {
  const handlers = {}, timers = new Map(); let timer = 0, current = lessons[2];
  const root = {innerHTML:'',querySelector:()=>null};
  const document = {addEventListener:(type,handler)=>handlers[type]=handler,querySelector:selector=>selector==='#sentence-practice-content'?root:null};
  const scope = {document,setTimeout:handler=>{timers.set(++timer,handler);return timer;},clearTimeout:id=>timers.delete(id)};
  scope.window=scope;vm.createContext(scope);
  for (const file of ['sentence-core.js','sentence-practice.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),scope);
  const ui = new scope.SentencePractice({getLesson:()=>current,getLessons:()=>lessons,getRecords:()=>({}),getDrafts:()=>drafts,getVocabulary,getUsage,random:()=>0.2,saveDraft:(key,value)=>{if(failSave)return false;drafts[key]=copy(value);return true;}});
  function answer(value) { const target={dataset:{sentenceInput:'answer'},value,closest:selector=>selector==='#sentence-practice-content'?root:null}; handlers.input({target}); }
  return {ui,drafts,answer,setLesson:lesson=>{current=lesson;},core:scope.StudySentences};
}

test('lesson export includes every namespace and target without bringing in other lessons or selection metadata',()=>{
  const drafts = {
    'v1:now:word%3Anow%3Abook':{targetKey:'word:now:book',answers:{affirmative:'I read a book.',negative:'I do not read a book.'}},
    'v2:flexible:now:word%3Anow%3Abook':{targetKey:'word:now:book',mode:'flexible',answers:{affirmative:'This book belongs to me.'}},
    'round:v1:now:phrase%3Anow%3Aread%2520about:day-1:transform':{targetKey:'phrase:now:read%20about',mode:'flexible',answers:{affirmative:'We read about birds.'}},
    'round:v1:now:word%3Anow%3Apen:day-2:flexible':{targetKey:'word:now:pen',mode:'transform',answers:{combined:'She writes with a pen.'}},
    'selection:v1:now':{targetKey:'word:now:book',answers:{affirmative:'Selection must not be exported.'}},
    'v1:later:word%3Alater%3Aletter':{answers:{affirmative:'Other lesson writing.'}},
    'v1:now:word%3Anow%3Aempty':{answers:{affirmative:'  ',negative:'\n'}},
    'round:v1:now:word%3Anow%3Abook:bad%2Fround:flexible':{answers:{affirmative:'Invalid round.'}},
    'round:v1:now:word%3Anow%3Abook::flexible':{answers:{affirmative:'Missing round.'}},
    'v1:now:bad%ZZ':{answers:{affirmative:'Malformed encoding.'}},
    'v1:now:word%3Anow%3Abook:extra':{answers:{affirmative:'Extra key segment.'}}
  };
  const h=setup({drafts}), bundles=copy(h.ui.exportLessonDrafts());
  assert.deepEqual(bundles.map(item=>[item.sourceKey,item.mode,item.roundKey]),[
    ['v1:now:word%3Anow%3Abook','transform',''],
    ['v2:flexible:now:word%3Anow%3Abook','flexible',''],
    ['round:v1:now:phrase%3Anow%3Aread%2520about:day-1:transform','transform','day-1'],
    ['round:v1:now:word%3Anow%3Apen:day-2:flexible','flexible','day-2']
  ]);
  assert.ok(bundles.every(item=>item.lessonId==='now'));
  assert.equal(bundles[2].target.label,'read about');
  assert.equal(bundles[3].answers.combined,'She writes with a pen.');
  assert.equal(bundles[0].answers.wh,'');
});

test('lesson export retains the latest pending draft even when saving fails',()=>{
  const key='v2:flexible:now:word%3Anow%3Abook';
  const h=setup({drafts:{[key]:{targetKey:'word:now:book',mode:'flexible',answers:{affirmative:'Previously saved.'}}},failSave:true});
  h.ui.ensureState();h.answer('The latest book sentence has not saved.');h.ui.flush();
  const bundles=h.ui.exportLessonDrafts();
  assert.equal(bundles.find(item=>item.sourceKey===key).answers.affirmative,'The latest book sentence has not saved.');
  assert.equal(h.drafts[key].answers.affirmative,'Previously saved.');
});

test('lesson export resolves an older target and all selected old-word aliases for the current practice lesson',()=>{
  const key='v2:flexible:now:word%3Aold-again%3Asend';
  const h=setup({drafts:{[key]:{targetKey:'word:old-again:send',sourceLessonIds:['old-again'],selectedOldKeys:['word:old-again:send','word:old:send','word:old-again:warm','phrase:old-again:look%20at'],answers:{affirmative:'I send a warm note.'}}}});
  const bundle=copy(h.ui.exportLessonDrafts()[0]);
  assert.equal(bundle.target.label,'send');assert.equal(bundle.target.source.id,'old-again');
  assert.deepEqual(bundle.selectedOldItems.map(item=>[item.label,item.category]),[['send','verb'],['warm','adjective'],['look at','phrase']]);
  assert.equal(bundle.selectedOldItems[0].word,'send');assert.equal(bundle.selectedOldItems[2].phrase,'look at');
});

test('lesson export resolves supplied vocabulary and usage without changing the UI selection',()=>{
  const drafts={
    'v1:now:word%3Anow%3Aextra':{targetKey:'word:now:extra',oldWordKey:'word:old:extra-old',oldPhraseKey:'phrase:old:extra%20phrase',answers:{affirmative:'An extra sentence.'}},
    'v2:flexible:now:phrase%3Anow%3Aextra%2520usage':{targetKey:'phrase:now:extra%20usage',answers:{yesno:'We try extra usage.'}}
  };
  const h=setup({drafts,getVocabulary:lesson=>lesson.id==='now'?[...lesson.vocabulary,{word:'extra',meaning:'额外的'}]:lesson.id==='old'?[...lesson.vocabulary,{word:'extra-old',pos:'adj.',meaning:'旧的额外词'}]:lesson.vocabulary,getUsage:lesson=>[...lesson.usage,{phrase:lesson.id==='now'?'extra usage':'extra phrase',meaning:'额外用法'}]});
  h.ui.ensureState();
  const before={active:h.ui.active,context:h.ui.context,lesson:h.ui.currentLesson,selections:copy([...h.ui.lessonSelections]),drafts:copy(h.drafts),entries:copy([...h.ui.entries])};
  const bundles=copy(h.ui.exportLessonDrafts());
  assert.equal(bundles.find(item=>item.targetKey==='word:now:extra').target.label,'extra');
  assert.deepEqual(bundles.find(item=>item.targetKey==='word:now:extra').selectedOldItems.map(item=>item.label),['extra-old','extra phrase']);
  assert.equal(bundles.find(item=>item.targetKey==='phrase:now:extra%20usage').target.label,'extra usage');
  assert.equal(h.ui.active,before.active);assert.equal(h.ui.context,before.context);assert.equal(h.ui.currentLesson,before.lesson);
  assert.deepEqual(copy([...h.ui.lessonSelections]),before.selections);assert.deepEqual(copy(h.drafts),before.drafts);assert.deepEqual(copy([...h.ui.entries]),before.entries);
});

test('lesson export preserves unresolved retired targets and original answer text without editor truncation',()=>{
  const answer='  An old expression.\n'+'x'.repeat(500);
  const h=setup({drafts:{
    'v1:now:word%3Anow%3Aretired%2520word':{targetKey:'word:now:retired%20word',answers:{affirmative:answer}},
    'v2:flexible:now:phrase%3Along%3Aabcdef0123456789':{targetKey:'phrase:long:abcdef0123456789',answers:{combined:'Unresolved compact target remains recoverable.'}}
  }});
  const bundles=h.ui.exportLessonDrafts();
  assert.equal(bundles[0].target.label,'retired word');assert.equal(bundles[0].answers.affirmative,answer);
  assert.equal(bundles[1].target.key,'phrase:long:abcdef0123456789');assert.ok(bundles[1].target.label);
  assert.equal(bundles[1].answers.combined,'Unresolved compact target remains recoverable.');
});

test('lesson export returns detached snapshots and accepts an explicit lesson without switching the UI',()=>{
  const h=setup({drafts:{'v1:now:word%3Anow%3Abook':{targetKey:'word:now:book',selectedOldKeys:['word:old:send'],answers:{affirmative:'A book sentence.'}},'v1:later:word%3Alater%3Aletter':{targetKey:'word:later:letter',answers:{affirmative:'A letter sentence.'}}}});
  h.ui.ensureState();const active=h.ui.active,context=h.ui.context;
  const first=h.ui.exportLessonDrafts();first[0].answers.affirmative='Changed export';first[0].target.source.title='Changed source';first[0].selectedOldItems[0].label='Changed selected word';
  const second=h.ui.exportLessonDrafts();
  assert.equal(second[0].answers.affirmative,'A book sentence.');assert.equal(second[0].target.source.title,'Current lesson');assert.equal(second[0].selectedOldItems[0].label,'send');
  const other=h.ui.exportLessonDrafts(lessons[3]);assert.equal(other.length,1);assert.equal(other[0].answers.affirmative,'A letter sentence.');
  assert.equal(h.ui.active,active);assert.equal(h.ui.context,context);assert.equal(h.ui.currentLesson.id,'now');
});
