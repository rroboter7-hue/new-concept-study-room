const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lessons = [
  {id:'old',book:1,number:1,vocabulary:['accomplish','investigate','negotiate','persuade','send','warm','book'].map(word=>({word,pos:word==='warm'?'adj.':word==='book'?'n.':'v.',meaning:'旧词'})),usage:[{phrase:'take into account',meaning:'考虑到'},{phrase:'put up with',meaning:'忍受'},{phrase:'make a decision',meaning:'作出决定'},{phrase:'pay attention to',meaning:'注意'},{phrase:'in spite of',meaning:'尽管'},{phrase:'be accustomed to',meaning:'习惯于'},{phrase:'on behalf of',meaning:'代表'},{phrase:'as a result',meaning:'因此'},{phrase:'look at',meaning:'看'},{phrase:'go to',meaning:'去'}]},
  {id:'now',book:1,number:2,vocabulary:['book','pen','shelf','desk','page','cover','story','library'].map(word=>({word,meaning:'本课词',isLessonNew:true})).concat([{word:'send',meaning:'旧词',isLessonNew:false}]),usage:[{phrase:'read about',meaning:'阅读'}]},
  {id:'later',book:1,number:3,vocabulary:[{word:'letter',meaning:'信',isLessonNew:true}],usage:[]}
];

function setup({drafts={},getVocabulary,getUsage,random=()=>0.3,lessonSet=lessons}={}) {
  let current=lessons[1],markup='';const handlers={},focus=[],saves=[];
  const fields={};const field=selector=>fields[selector]||=( {innerHTML:'',textContent:'',focus(){focus.push(selector);},setAttribute(){},querySelector:field} );
  const trigger={focus(){focus.push('trigger');}};
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;},querySelector:field,querySelectorAll:()=>[],addEventListener(){}};
  const content={get innerHTML(){return markup;},set innerHTML(value){markup=value;},querySelector:selector=>selector==='.sentence-word-dialog'?dialog:field(selector)};
  const document={activeElement:trigger,body:{classList:{contains:()=>true}},addEventListener:(type,fn)=>handlers[type]=fn,querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const sandbox={document,console,setTimeout:()=>1,clearTimeout(){}};sandbox.window=sandbox;vm.createContext(sandbox);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
  const ui=new sandbox.SentencePractice({getLesson:()=>current,getLessons:()=>lessonSet,getRecords:()=>({}),getDrafts:()=>drafts,getVocabulary,getUsage,random,saveDraft:(key,value)=>{saves.push(key);drafts[key]=JSON.parse(JSON.stringify(value));return true;}});
  const render=()=>content.innerHTML=ui.render();
  function event(type,dataset,value='',extra={}){const node={dataset,value,...extra,closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'&&dataset.sentenceAction?node:null};handlers[type]?.({target:node,preventDefault(){},key:extra.key});}
  const action=(name,key)=>event('click',{sentenceAction:name,sentenceTargetKey:key,sentenceOldKey:key});
  const answer=value=>event('input',{sentenceInput:'answer'},value);
  return {ui,render,drafts,focus,saves,trigger,dialog,action,answer,event,setLesson:value=>{current=value;},core:sandbox.StudySentences};
}
const queue=html=>html.match(/<section class="sentence-lesson-queue"[\s\S]*?<\/section>/)?.[0]||'';
const recommendationKeys=h=>Array.from(h.ui.lessonSelections.get(h.ui.currentLesson.id).recommendedOldKeys||[]);
function complete(h,word){['I keep a','We read a','She likes this','Do you have a','They open a'].forEach((text,index)=>{h.event('click',{sentenceAction:'step',sentenceStep:String(index)});h.answer(`${text} ${word}.`);});h.action('check');}

const valuableWords=[{word:'accomplish',pos:'v.',meaning:'完成'},{word:'investigate',pos:'v.',meaning:'调查'}];
const valuablePhrases=[{phrase:'take into account',meaning:'考虑到'},{phrase:'put up with',meaning:'忍受'},{phrase:'make a decision',meaning:'作出决定'},{phrase:'pay attention to',meaning:'注意'}];
const valuableKeys=['word:old:accomplish','phrase:old:take%20into%20account','phrase:old:put%20up%20with','phrase:old:make%20a%20decision'];
const recommendationVocabulary=lesson=>lesson.id==='old'?valuableWords.concat([{word:'book',pos:'n.',meaning:'书'},{word:'warm',pos:'adj.',meaning:'温暖的'},{word:'send',pos:'v.',meaning:'寄送'}]):lesson.vocabulary;
const recommendationUsage=lesson=>lesson.id==='old'?valuablePhrases.concat([{phrase:'look at',meaning:'看'}]):lesson.usage;

test('old recommendation caches migrate away from nouns and basic terms without losing writing or manual history',()=>{
  const oldKeys=['word:old:book','word:old:warm','word:old:send','phrase:old:look%20at'];
  const draft={targetKey:'word:now:book',mode:'flexible',step:2,selectedOldKeys:['word:old:book','word:old:warm'],recommendedOldKeys:['word:old:investigate'],answers:{affirmative:'I send a book to my friend.',yesno:'Do I need this book?'}};
  const h=setup({drafts:{'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendedOldKeys:oldKeys},'v2:flexible:now:word%3Anow%3Abook':draft},getVocabulary:recommendationVocabulary,getUsage:recommendationUsage});
  h.render();const items=Array.from(h.ui.recommendedOldItems());
  assert.equal(items.length,4);assert.equal(items.filter(item=>item.category==='phrase').length,3);assert.equal(items.filter(item=>item.category==='verb').length,1);
  assert.ok(recommendationKeys(h).every(key=>!oldKeys.includes(key)));
  assert.equal(h.ui.active.draft.answers.affirmative,'I send a book to my friend.');assert.equal(h.ui.active.draft.answers.yesno,'Do I need this book?');assert.equal(h.ui.active.draft.step,2);
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:book','word:old:warm']);
  assert.ok(['word:old:investigate',...oldKeys].every(key=>h.ui.active.draft.recommendedOldKeys.includes(key)));
  assert.doesNotMatch(h.ui.recommendationsHTML(),/data-sentence-old-key="(?:word:old:(?:book|warm|send)|phrase:old:look%20at)"/);
  const writes=h.saves.length;h.render();h.render();assert.equal(h.saves.length,writes);
});

test('eligible cached recommendations stay fixed through typing target changes and reload',()=>{
  const drafts={'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:valuableKeys}};
  const h=setup({drafts,getVocabulary:recommendationVocabulary,getUsage:recommendationUsage});h.render();assert.deepEqual(recommendationKeys(h),valuableKeys);assert.equal(h.saves.length,0);
  h.answer('I keep this book.');h.action('lesson-target','word:now:pen');h.render();assert.deepEqual(recommendationKeys(h),valuableKeys);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts)),getVocabulary:recommendationVocabulary,getUsage:recommendationUsage,random:()=>0.9});restored.render();assert.deepEqual(recommendationKeys(restored),valuableKeys);
  assert.equal(restored.ui.lessonSelections.get('now').recommendationProfile,'phrases-verbs-v1');
});

test('an eligible alias-key cache normalizes once without randomizing its expressions or losing writing and history',()=>{
  const current={...lessons[1],number:3};
  const lessonSet=[lessons[0],{id:'old-copy',book:1,number:2,vocabulary:valuableWords,usage:valuablePhrases},current,{...lessons[2],number:4}];
  const aliases=['word:old-copy:accomplish','phrase:old-copy:take%20into%20account','phrase:old-copy:put%20up%20with','phrase:old-copy:make%20a%20decision'];
  const drafts={
    'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:aliases},
    'v2:flexible:now:word%3Anow%3Abook':{targetKey:'word:now:book',mode:'flexible',step:2,selectedOldKeys:['word:old:warm'],recommendedOldKeys:['word:old:investigate'],answers:{affirmative:'I accomplish the task in this book.',yesno:'Do we need the book?'}}
  };
  let randomCalls=0;const h=setup({drafts,lessonSet,random:()=>{randomCalls++;return 0.9;}});h.setLesson(current);const html=h.render();
  assert.deepEqual(Array.from(h.ui.recommendedOldItems(),item=>item.label),['accomplish','take into account','put up with','make a decision']);
  assert.match(html,/data-sentence-action="refresh-recommendations"/);assert.deepEqual(recommendationKeys(h),valuableKeys);assert.equal(randomCalls,0);
  assert.deepEqual(h.drafts['selection:v1:now'].recommendedOldKeys,valuableKeys);
  assert.equal(h.ui.active.draft.answers.affirmative,'I accomplish the task in this book.');assert.equal(h.ui.active.draft.answers.yesno,'Do we need the book?');assert.equal(h.ui.active.draft.step,2);
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:warm']);assert.ok(['word:old:investigate',...valuableKeys].every(key=>h.ui.active.draft.recommendedOldKeys.includes(key)));
  assert.equal(h.saves.filter(key=>key==='selection:v1:now').length,1);const writes=h.saves.length;h.render();assert.equal(h.saves.length,writes);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts)),lessonSet,random:()=>{throw Error('valid alias migration must not randomize on reload');}});restored.setLesson(current);restored.render();
  assert.deepEqual(recommendationKeys(restored),valuableKeys);assert.equal(restored.ui.recommendedOldItems().length,4);assert.equal(restored.saves.length,0);
});

test('an eligible old-policy one-phrase three-verb cache migrates once to the phrase-first profile',()=>{
  const oldKeys=['word:old:accomplish','word:old:investigate','word:old:negotiate','phrase:old:put%20up%20with'];
  const h=setup({drafts:{'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendedOldKeys:oldKeys}}});h.render();
  const items=Array.from(h.ui.recommendedOldItems());assert.equal(items.length,4);assert.equal(items.filter(item=>item.category==='phrase').length,3);assert.equal(items.filter(item=>item.category==='verb').length,1);
  assert.equal(h.drafts['selection:v1:now'].recommendationProfile,'phrases-verbs-v1');
  assert.ok(oldKeys.every(key=>h.ui.active.draft.recommendedOldKeys.includes(key)));
  const keys=recommendationKeys(h),writes=h.saves.length;h.render();assert.deepEqual(recommendationKeys(h),keys);assert.equal(h.saves.length,writes);
});

test('an empty eligible pool stays quiet while manual selection retains basic words and phrases',()=>{
  const getVocabulary=lesson=>lesson.id==='old'?[{word:'book',pos:'n.',meaning:'书'},{word:'warm',pos:'adj.',meaning:'温暖的'},{word:'send',pos:'v.',meaning:'寄送'}]:lesson.vocabulary;
  const getUsage=lesson=>lesson.id==='old'?[{phrase:'look at',meaning:'看'}]:lesson.usage;
  const h=setup({getVocabulary,getUsage});h.render();assert.deepEqual(recommendationKeys(h),[]);
  const writes=h.saves.length;h.render();h.render();assert.equal(h.saves.length,writes);
  h.ui.openWordPicker(h.trigger);assert.equal(h.ui.filteredOldItems().length,4);h.ui.setOldSelection(['word:old:book','word:old:warm','word:old:send','phrase:old:look%20at']);assert.equal(h.ui.selectedOldItems().length,4);
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts)),getVocabulary,getUsage});restored.render();assert.deepEqual(recommendationKeys(restored),[]);assert.equal(restored.saves.length,0);
});

test('current queue reaches every new text word and keeps previously learned terms optional',()=>{
  const h=setup();let html=h.render(),list=queue(html);
  assert.match(list,/本课新词/);assert.match(list,/0\s*\/\s*8/);
  assert.equal((list.match(/data-sentence-action="lesson-target"/g)||[]).length,4);
  assert.match(list.match(/<div class="sentence-lesson-heading">[\s\S]*?<\/div>/)?.[0]||'',/data-sentence-action="expand-lesson-targets"/);
  h.answer('I keep this book.');
  h.action('expand-lesson-targets');list=queue(h.render());
  assert.equal((list.match(/data-sentence-action="lesson-target"/g)||[]).length,8);
  for(const word of ['book','pen','shelf','desk','page','cover','story','library'])assert.match(list,new RegExp(`>${word}<`));
  assert.doesNotMatch(list,/>send<|>read about</);
  assert.match(list,/0\/5/);assert.match(list,/下一个未练/);assert.match(list,/已练[^<]*不代表掌握/);
  assert.ok(html.indexOf('<textarea')<html.indexOf('class="sentence-adjustments"'),'writing precedes advanced controls');
  assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');
  h.action('expand-lesson-targets');assert.equal((queue(h.render()).match(/data-sentence-action="lesson-target"/g)||[]).length,4);
  assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');
});

test('queue uses supplied text vocabulary and falls back to legacy current words only without flags',()=>{
  const h=setup({getVocabulary:lesson=>lesson.id==='now'?[{word:'window',meaning:'窗',isLessonNew:true},{word:'send',isLessonNew:false}]:lesson.vocabulary});
  assert.match(queue(h.render()),/>window</);assert.doesNotMatch(queue(h.render()),/>book<|>send</);
  const legacy=setup({getVocabulary:lesson=>lesson.id==='now'?[{word:'window',meaning:'窗'},{word:'glass',meaning:'玻璃'}]:lesson.vocabulary});
  assert.match(queue(legacy.render()),/0\s*\/\s*2/);
});

test('a lesson opens its first newly appearing word when the supplied vocabulary starts with an old word',()=>{
  const h=setup({getVocabulary:lesson=>lesson.id==='now'?[{word:'send',isLessonNew:false},{word:'window',meaning:'窗',isLessonNew:true}]:lesson.vocabulary});
  h.render();assert.equal(h.ui.target().word,'window');
});

test('queue switching saves an unfinished draft and next-unfinished restores progress across modes and reload',()=>{
  const h=setup();h.render();h.answer('I keep this book.');h.action('lesson-target','word:now:pen');h.answer('I have a pen.');
  h.action('lesson-target','word:now:book');assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');
  h.ui.openTarget({lessonId:'now',expression:'book',kind:'word',roundKey:'daily-1'});complete(h,'book');
  assert.match(queue(h.render()),/1\s*\/\s*8/);assert.match(queue(h.render()),/已练/);
  h.event('change',{sentenceSelect:'mode'},'transform');
  assert.equal(h.ui.active.draft.answers.affirmative,'');assert.match(queue(h.render()),/1\s*\/\s*8/);
  h.action('next-unfinished');assert.equal(h.ui.target().word,'pen');
  h.ui.flush();const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts))});
  assert.match(queue(restored.render()),/1\s*\/\s*8/);restored.action('next-unfinished');assert.equal(restored.ui.target().word,'shelf');
});

test('typing five unchecked answers and changing old selections never manufactures queue completion',()=>{
  const h=setup();h.render();Object.assign(h.ui.active.draft.answers,{affirmative:'I keep a book.',negative:'We read a book.',yesno:'She likes this book.',wh:'Do you have a book?',combined:'They open a book.'});
  h.ui.setOldSelection([h.ui.wordBank()[0].key]);h.ui.flush();
  assert.match(queue(h.render()),/0\s*\/\s*8/);assert.match(queue(h.render()),/5\/5/);
});

test('transform practice keeps old knowledge optional while completion still needs five checked target sentences',()=>{
  const h=setup();h.render();h.event('change',{sentenceSelect:'mode'},'transform');
  ['We read a book.','We do not read a book.','Do we read a book?','Why do we read a book?','She keeps a book in her bag.'].forEach((answer,index)=>{h.event('click',{sentenceAction:'step',sentenceStep:String(index)});h.answer(answer);});
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),[]);
  const result=h.ui.evaluate(),combined=result.rows.find(row=>row.kind==='combined');
  assert.doesNotMatch(combined.issues.join(' '),/旧词|旧用法|先选择/);assert.equal(result.rulesOnly,true);
  const html=h.render();assert.match(html,/sentence-step-hint[^>]*>[^<]*可[^<]*旧知/);assert.doesNotMatch(html,/选一个旧词和一个旧用法/);
  assert.equal(h.ui.lessonProgress().done,0);h.action('check');assert.equal(h.ui.lessonProgress().done,1);
});

test('an imported checked oversized answer cannot become completed when its text is bounded for the editor',()=>{
  const drafts={'v2:flexible:now:word%3Anow%3Abook':{targetKey:'word:now:book',mode:'flexible',checkedAt:10,answers:{affirmative:'I keep a book.',negative:'We read a book.',yesno:'She likes this book.',wh:'Do you have a book?',combined:'We use book '+'x'.repeat(500)}}};
  const h=setup({drafts});const html=h.render();
  assert.equal(h.ui.lessonProgress().done,0);assert.match(queue(html),/0\s*\/\s*8/);
});

test('recommendation chips show a short first Chinese sense while preserving the full meaning for access',()=>{
  const accomplishMeaning='accomplish v.完成；顺利完成具有挑战性的任务和目标';
  const longMeaning='v.把许多不同的因素全部考虑进去；考虑到';
  const drafts={'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:valuableKeys}};
  const h=setup({drafts,getVocabulary:lesson=>lesson.id==='old'?lesson.vocabulary.map(item=>({...item,meaning:item.word==='accomplish'?accomplishMeaning:item.meaning})):lesson.vocabulary,getUsage:lesson=>lesson.id==='old'?lesson.usage.map(item=>({...item,meaning:item.phrase==='take into account'?longMeaning:item.phrase==='put up with'?'v.忍受；容忍':item.meaning})):lesson.usage});
  h.render();const html=h.ui.recommendationsHTML();
  assert.match(html,/sentence-recommendation-label" lang="en">accomplish<\/span>/);
  assert.match(html,/sentence-recommendation-meaning">完成<\/span>/);
  assert.match(html,/sentence-recommendation-meaning">忍受<\/span>/);
  assert.match(html,/title="accomplish v.完成；顺利完成具有挑战性的任务和目标"/);
  const senses=Array.from(html.matchAll(/class="sentence-recommendation-meaning">([^<]*)<\/span>/g),match=>match[1]);
  assert.equal(senses.length,4);assert.ok(senses.every(sense=>(sense.match(/[\u3400-\u9fff]/g)||[]).length<=12));
  assert.equal(h.ui.wordBank().find(item=>item.label==='accomplish').meaning,accomplishMeaning);
});

test('optional recommendations remain stable through target switches, renders and reload and can toggle without replacing text',()=>{
  const h=setup();assert.match(h.render(),/sentence-recommendations/);const keys=recommendationKeys(h);
  assert.equal(keys.length,4);assert.deepEqual(Array.from(h.ui.selectedOldItems()),[]);
  h.answer('I keep this book.');h.action('toggle-recommended-old',keys[0]);assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');assert.equal(h.ui.target().word,'book');
  h.action('lesson-target','word:now:pen');assert.deepEqual(recommendationKeys(h),keys);h.ui.flush();
  const restored=setup({drafts:JSON.parse(JSON.stringify(h.drafts)),random:()=>0.9});restored.render();assert.deepEqual(recommendationKeys(restored),keys);
  const draft=restored.ui.active.draft;restored.answer('I have a pen.');restored.action('refresh-recommendations');
  assert.equal(restored.ui.active.draft,draft);assert.equal(draft.answers.affirmative,'I have a pen.');assert.notDeepEqual(recommendationKeys(restored),keys);
});

test('a checked old expression actually written rotates out of recommendations in the next lesson',()=>{
  const h=setup();h.render();const accomplish=h.ui.wordBank().find(item=>item.label==='accomplish');h.ui.setOldSelection([accomplish.key]);
  complete(h,'book');h.event('click',{sentenceAction:'step',sentenceStep:'4'});h.answer('I accomplish the task in this book.');h.action('check');
  h.setLesson(lessons[2]);h.render();assert.equal(recommendationKeys(h).length,4);assert.ok(!recommendationKeys(h).includes(accomplish.key));
});

test('using an unselected recommendation consumes it after checking while shown unused terms stay eligible',()=>{
  const keys=valuableKeys;
  const drafts={'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:keys}};
  const h=setup({drafts});h.render();
  ['I keep a book.','We read a book.','She likes this book.','Do you have a book?','I accomplish the task in this book.'].forEach((answer,index)=>{h.event('click',{sentenceAction:'step',sentenceStep:String(index)});h.answer(answer);});
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),[]);
  h.action('check');
  assert.deepEqual(Array.from(h.drafts[h.ui.active.key].recommendedOldKeys),keys);
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),[]);
  assert.equal(h.ui.active.draft.answers.combined,'I accomplish the task in this book.');
  assert.equal(h.ui.target().word,'book');
  h.setLesson(lessons[2]);h.render();
  assert.ok(!recommendationKeys(h).includes('word:old:accomplish'));
  const eligible=h.core.recommendOldWords({profile:'phrases-verbs',items:h.ui.wordBank().filter(item=>['accomplish','put up with'].includes(item.label)),drafts:h.drafts,lessonId:'later',count:4,random:()=>0});
  assert.deepEqual(Array.from(eligible,item=>item.label),['put up with'],'showing a recommendation without writing it must leave it eligible');
});

for(const checkedBeforeRefresh of [true,false])test(checkedBeforeRefresh?'checking unchanged answers after swapping recommendations preserves earlier used-word evidence':'swapping recommendations before the first check preserves words shown while writing',()=>{
  const keys=valuableKeys;
  const h=setup({drafts:{'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:keys}}});h.render();
  ['I keep a book.','We read a book.','She likes this book.','Do you have a book?','I accomplish the task in this book.'].forEach((answer,index)=>{h.event('click',{sentenceAction:'step',sentenceStep:String(index)});h.answer(answer);});
  const answers=JSON.stringify(h.ui.active.draft.answers);
  if(checkedBeforeRefresh)h.action('check');
  h.action('refresh-recommendations');
  assert.ok(!recommendationKeys(h).includes('word:old:accomplish'),'the new group must replace the originally shown accomplish suggestion');
  h.action('check');
  assert.ok(keys.every(key=>h.drafts[h.ui.active.key].recommendedOldKeys.includes(key)));
  assert.equal(JSON.stringify(h.ui.active.draft.answers),answers);assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),[]);
  const eligible=h.core.recommendOldWords({profile:'phrases-verbs',items:h.ui.wordBank().filter(item=>['accomplish','put up with'].includes(item.label)),drafts:h.drafts,lessonId:'later',count:4,random:()=>0});
  assert.deepEqual(Array.from(eligible,item=>item.label),['put up with']);
  h.setLesson(lessons[2]);h.render();assert.ok(!recommendationKeys(h).includes('word:old:accomplish'));
});

test('a used current recommendation survives a full history of unused suggestions',()=>{
  const historyWords=Array.from({length:20},(_,index)=>'unused'+String.fromCharCode(97+index));
  const history=historyWords.map(word=>'word:old:'+word);
  const shown=valuableKeys;
  const drafts={
    'selection:v1:now':{targetKey:'word:now:book',mode:'flexible',recommendationProfile:'phrases-verbs-v1',recommendedOldKeys:shown},
    'v2:flexible:now:word%3Anow%3Abook':{targetKey:'word:now:book',mode:'flexible',recommendedOldKeys:history}
  };
  const h=setup({drafts,getVocabulary:lesson=>lesson.id==='old'?lesson.vocabulary.concat(historyWords.map(word=>({word,pos:'n.',meaning:'未用词'}))):lesson.vocabulary});h.render();
  ['I keep a book.','We read a book.','She likes this book.','Do we read a book?','I accomplish the task in this book.'].forEach((answer,index)=>{h.event('click',{sentenceAction:'step',sentenceStep:String(index)});h.answer(answer);});
  h.action('check');
  const saved=h.drafts[h.ui.active.key];assert.equal(saved.recommendedOldKeys.length,20);
  assert.ok(saved.recommendedOldKeys.includes('word:old:accomplish'));assert.ok(shown.every(key=>saved.recommendedOldKeys.includes(key)));
  assert.deepEqual(Array.from(saved.selectedOldKeys),[]);
  const eligible=h.core.recommendOldWords({profile:'phrases-verbs',items:h.ui.wordBank().filter(item=>['accomplish','put up with'].includes(item.label)),drafts:h.drafts,lessonId:'later',count:4,random:()=>0});
  assert.deepEqual(Array.from(eligible,item=>item.label),['put up with']);
  h.setLesson(lessons[2]);h.render();assert.ok(!recommendationKeys(h).includes('word:old:accomplish'));
});

test('picker defaults to all categories and opening, clearing and removing the last chip never focuses search',()=>{
  const h=setup();h.render();h.ui.openWordPicker(h.trigger);
  assert.equal(h.ui.wordCategory,'all');assert.equal(h.ui.filteredOldItems().length,17);
  assert.ok(!h.focus.includes('[data-sentence-input="word-search"]'));
  h.ui.setOldSelection([h.ui.wordBank()[0].key]);h.action('clear-old');
  h.ui.setOldSelection([h.ui.wordBank()[0].key]);h.action('remove-old',h.ui.wordBank()[0].key);
  assert.ok(!h.focus.includes('[data-sentence-input="word-search"]'));
  const html=h.ui.wordPickerHTML()+h.ui.wordPickerListHTML();assert.match(html,/data-sentence-category="all"/);assert.match(html,/data-sentence-category="selected"/);assert.match(html,/data-category="phrase"/);assert.match(html,/sentence-word-copy/);
  assert.doesNotMatch(h.ui.wordPickerFooterHTML(),/sentence-word-chips|sentence-word-footer-note/);
});

test('old-word access shares the recommendations heading and retains one accessible standalone fallback',()=>{
  const h=setup();let html=h.render();
  assert.equal((html.match(/data-sentence-action="open-word-picker"/g)||[]).length,1);
  const heading=html.match(/<div class="sentence-recommendation-heading">[\s\S]*?<\/div>/)?.[0]||'';
  assert.match(heading,/<button[^>]*data-sentence-action="open-word-picker"[^>]*aria-haspopup="dialog"[^>]*aria-controls="sentence-word-picker"[\s\S]*?全部旧词/);
  h.setLesson(lessons[0]);html=h.render();
  assert.doesNotMatch(html,/class="sentence-recommendation-heading"/);
  assert.equal((html.match(/data-sentence-action="open-word-picker"/g)||[]).length,1);
  assert.match(html,/<button[^>]*data-sentence-action="open-word-picker"[^>]*aria-haspopup="dialog"[^>]*aria-controls="sentence-word-picker"[\s\S]*?全部旧词/);
});

function largePickerSetup(){return setup({getVocabulary:lesson=>lesson.id==='old'?Array.from({length:200},(_,index)=>({word:'term'+String(index).padStart(3,'0'),pos:'v.',meaning:'词语释义'})):lesson.vocabulary});}
const pickerRows=html=>(html.match(/class="sentence-word-row(?:\s|")/g)||[]).length;

test('a closed large old-word picker renders no word rows and releases them again on close',()=>{
  const h=largePickerSetup();const html=h.render();assert.equal(h.ui.wordBank().length,210);assert.equal(pickerRows(html),0);
  h.ui.openWordPicker(h.trigger);const list=h.dialog.querySelector('.sentence-word-list');assert.equal(pickerRows(list.innerHTML),80);
  h.ui.closeWordPicker();assert.equal(list.innerHTML,'');assert.equal(h.dialog.open,false);assert.equal(h.focus.at(-1),'trigger');
});

test('large picker pages explicitly while searches reach later words and preserve writing and selections',()=>{
  const h=largePickerSetup();h.render();h.answer('I keep this book.');h.ui.setOldSelection(['word:old:term150']);h.ui.openWordPicker(h.trigger);
  const list=h.dialog.querySelector('.sentence-word-list');assert.equal(pickerRows(list.innerHTML),80);assert.match(list.innerHTML,/显示更多[^<]*80\s*\/\s*总\s*210/);
  list.scrollTop=231;h.action('more-words');assert.equal(pickerRows(list.innerHTML),160);assert.equal(list.scrollTop,231);assert.equal(h.focus.at(-1),'[data-sentence-action="more-words"]');
  assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:term150']);
  h.event('input',{sentenceInput:'word-search'},'term199');assert.equal(pickerRows(list.innerHTML),1);assert.match(list.innerHTML,/>term199<\/span>/);
  h.event('input',{sentenceInput:'word-search'},'');assert.equal(pickerRows(list.innerHTML),80);h.action('more-words');assert.equal(pickerRows(list.innerHTML),160);
  h.ui.setWordCategory('verb');assert.equal(pickerRows(list.innerHTML),80);h.action('more-words');h.action('more-words');assert.equal(pickerRows(list.innerHTML),200);assert.doesNotMatch(list.innerHTML,/data-sentence-action="more-words"/);
  h.ui.closeWordPicker();h.ui.openWordPicker(h.trigger);assert.equal(pickerRows(list.innerHTML),80);
  assert.equal(h.ui.active.draft.answers.affirmative,'I keep this book.');assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:term150']);
});
