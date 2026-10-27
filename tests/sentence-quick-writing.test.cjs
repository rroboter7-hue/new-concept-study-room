const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../sentence-core.js');
const answers = {affirmative:'We read a book.',negative:'We do not read a book.',yesno:'Do we read a book?',wh:'Why do we read a book?',combined:''};

test('four-form completion needs exactly its four distinct answers; legacy still needs five',()=>{
  assert.equal(core.completion({mode:'four',target:'book',answers}),true);
  assert.equal(core.completion({mode:'transform',target:'book',answers}),false);
  assert.equal(core.completion({mode:'four',target:'book',answers:{...answers,wh:''}}),false);
  assert.equal(core.completion({mode:'four',target:'book',answers:{...answers,wh:answers.yesno}}),false);
  const result=core.check({mode:'four',target:'book',answers});
  assert.equal(result.rows.length,4);assert.equal(result.writtenCount,4);assert.equal(result.requiredCount,4);
});

test('phrase-writing is one contextual sentence and does not demand affirmative polarity',()=>{
  const options={mode:'phrase',target:'pay attention',answers:{affirmative:'Why do you not pay attention to the lesson?'}};
  assert.equal(core.completion(options),true);
  const result=core.check(options);
  assert.equal(result.rows.length,1);assert.equal(result.requiredCount,1);
  assert.equal(result.rows[0].issues.length,0);
  assert.equal(core.completion({...options,answers:{affirmative:'This is my lesson.'}}),false);
});

test('new writing drafts use separate keys and cannot overwrite old five-sentence drafts',()=>{
  const legacy=core.modeDraftKey('now','word:now:book','transform');
  const four=core.modeDraftKey('now','word:now:book','four');
  const phrase=core.modeDraftKey('now','word:now:book','phrase');
  assert.equal(new Set([legacy,four,phrase]).size,3);
  assert.equal(core.sanitizeDraft({mode:'four',step:4,answers}).mode,'four');
  assert.equal(core.sanitizeDraft({mode:'four',step:4,answers}).step,3);
  assert.equal(core.sanitizeDraft({mode:'phrase',step:4,answers}).step,0);
  const target={key:'word:now:book',word:'book'};
  assert.equal(core.lessonProgress({targets:[target],drafts:{four:{mode:'four',targetKey:target.key,checkedAt:10,answers}}}).done,1);
});

test('habit sentence targets use the supplied reviewed usage with a safe unavailable fallback',()=>{
  const lesson={id:'now',book:2,number:1,vocabulary:[],usage:[{phrase:'raw fragment',meaning:'原始摘录'}]};
  const options={lessons:[lesson],currentLesson:lesson,includePhrases:true,getUsage:()=>[{phrase:'pay attention to',meaning:'注意'}]};
  assert.deepEqual(core.context(options).targets.map(item=>item.word),['pay attention to']);
  assert.deepEqual(core.context({...options,getUsage:()=>{throw Error('unavailable');}}).targets.map(item=>item.word),['raw fragment']);
});

function setup({clipboard,past=[]}={}){
  const events={},notices=[],fields={};let html='';
  const node=selector=>fields[selector]||=( {value:'',textContent:'',focus(){},select(){this.selected=true;},setAttribute(){}} );
  const content={get innerHTML(){return html;},set innerHTML(value){html=value;},querySelector:node};
  const lesson={id:'now',book:2,number:1,title:'Books',vocabulary:[{word:'book',meaning:'书'}],usage:[{phrase:'pay attention',meaning:'注意'},{phrase:'look after',meaning:'照顾'}]};
  const document={body:{classList:{contains:()=>true}},addEventListener:(name,fn)=>events[name]=fn,querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const context={document,navigator:{clipboard},setTimeout:()=>1,clearTimeout(){},console};context.window=context;
  vm.createContext(context);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const drafts={};const ui=new context.SentencePractice({defaultMode:'four',getLesson:()=>lesson,getLessons:()=>[...past,lesson],getRecords:()=>Object.fromEntries(past.map(row=>[row.id,{completed:true}])),getDrafts:()=>drafts,saveDraft:(key,value)=>{drafts[key]=JSON.parse(JSON.stringify(value));return true;},toast:value=>notices.push(value)});
  content.innerHTML=ui.render();
  return {ui,content,node,notices,drafts,render:()=>content.innerHTML=ui.render()};
}

test('quick editor shows four named forms, original reuse and explicit copy action',()=>{
  const h=setup(),html=h.render();
  assert.equal((html.match(/<textarea\b/g)||[]).length,4);
  assert.equal((html.match(/data-sentence-action="step"/g)||[]).length,0);
  for(const name of ['肯定句','否定句','一般疑问句','特殊疑问句'])assert.ok(html.includes(name));
  assert.match(html,/data-sentence-action="copy-review"/);assert.match(html,/复制给豆包/);
  Object.assign(h.ui.active.draft.answers,answers);h.ui.active.draft.step=1;
  assert.match(h.render(),/data-sentence-action="reuse-original"/);
  assert.equal(h.ui.switchMode('phrase'),true);assert.equal(h.ui.target().phrase,'pay attention');
  assert.equal(h.ui.stepList().length,1);
});

test('copy exports only actual learner inputs with context and checking instructions',async()=>{
  let copied='';const h=setup({clipboard:{writeText:async value=>{copied=value;}}});
  Object.assign(h.ui.active.draft.answers,answers);h.ui.active.draft.answers.combined='LEGACY HIDDEN TEXT';
  assert.equal(await h.ui.copyForReview(),true);
  assert.match(copied,/第二册|第 2 册/);assert.match(copied,/book/);assert.match(copied,/We read a book\./);
  assert.match(copied,/特殊疑问句/);assert.match(copied,/语法/);assert.doesNotMatch(copied,/LEGACY HIDDEN TEXT/);
  assert.ok(h.notices.some(text=>/已复制/.test(text)));
});

test('clipboard denial exposes selectable copy text and reports failure honestly',async()=>{
  const h=setup({clipboard:{writeText:async()=>{throw Error('denied');}}});h.ui.active.draft.answers.affirmative='We read a book.';
  assert.equal(await h.ui.copyForReview(),false);
  assert.ok(h.notices.some(text=>/手动复制/.test(text)));
  assert.ok(!h.notices.some(text=>/^已复制/.test(text)));
  assert.match(h.content.innerHTML,/sentence-copy-fallback/);assert.match(h.content.innerHTML,/readonly/);
  assert.match(h.ui.active.draft.answers.affirmative,/We read a book/);
});

test('new daily variants emit their real count, retain assistance and detach when changing target kind',()=>{
  const h=setup();
  assert.equal(h.ui.openTarget({lessonId:'now',targetKey:'word:now:book',roundKey:'daily-one',sentenceMode:'four-forms'}),true);
  assert.equal(h.ui.active.draft.mode,'four');
  Object.assign(h.ui.active.draft.answers,answers);h.ui.active.draft.assisted=true;h.ui.flush();
  h.ui.switchMode('transform');assert.equal(h.ui.active.draft.assisted,true);
  h.ui.switchMode('four');assert.equal(h.ui.active.draft.assisted,true);assert.equal(h.ui.active.draft.answers.wh,answers.wh);
  h.ui.switchMode('phrase');assert.equal(h.ui.active.draft.roundKey,'');assert.equal(h.ui.target().kind,'phrase');
  assert.equal(h.ui.openTarget({lessonId:'now',expression:'pay attention',kind:'phrase',roundKey:'daily-two',sentenceMode:'phrase-writing'}),true);
  assert.equal(h.ui.active.draft.mode,'phrase');assert.equal(h.ui.active.draft.roundKey,'daily-two');
});

test('restored legacy drafts show direct new-mode entries without migrating or removing their sentences',()=>{
  const h=setup();h.ui.switchMode('flexible');h.ui.active.draft.answers.combined='I keep my book on the desk.';h.ui.markChanged();h.ui.flush();
  const html=h.render(),legacyKey=h.ui.active.key;
  assert.match(html,/data-sentence-action="writing-mode" data-sentence-mode="four"/);
  assert.match(html,/data-sentence-action="writing-mode" data-sentence-mode="phrase"/);
  assert.match(html,/旧版草稿.*保留/);
  h.ui.switchMode('four');assert.equal(h.drafts[legacyKey].answers.combined,'I keep my book on the desk.');
});

test('idiom progress and next-unfinished use phrase targets rather than the word queue',()=>{
  const h=setup();h.ui.switchMode('phrase');
  h.ui.active.draft.answers.affirmative='Please pay attention to my story.';h.ui.active.draft.checkedAt=10;h.ui.flush();
  assert.equal(h.ui.lessonProgress().total,2);assert.equal(h.ui.lessonProgress().done,1);
  assert.match(h.render(),/本课已练 1 \/ 2 项用法/);
  assert.equal(h.ui.nextUnfinished(),true);assert.equal(h.ui.target().phrase,'look after');assert.equal(h.ui.active.draft.mode,'phrase');
  assert.equal(h.ui.lessonProgress().total,2);
});

test('quick target controls stay bounded with a large learned history while old expressions remain searchable',()=>{
  const past=Array.from({length:100},(_,index)=>({id:'old'+index,book:1,number:index+1,vocabulary:Array.from({length:12},(_,word)=>({word:'word'+index+'x'+word,pos:'v.',meaning:'旧词'})),usage:[{phrase:'phrase '+index,meaning:'旧用法'}]}));
  const h=setup({past});let html=h.render();
  const targetOptions=value=>(value.match(/<select[^>]*data-sentence-select="target"[^>]*>([\s\S]*?)<\/select>/)?.[1].match(/<option\b/g)||[]).length;
  const phraseOptions=value=>(value.match(/<select[^>]*data-sentence-select="sheet-phrase"[^>]*>([\s\S]*?)<\/select>/)?.[1].match(/<option\b/g)||[]).length;
  assert.ok(h.ui.context.targets.length>1200);assert.ok(h.ui.wordBank().length>1200);
  assert.equal((html.match(/data-sentence-select="target"/g)||[]).length,1);
  assert.equal(targetOptions(html),1,'only the current word is listed in the primary target selector');
  assert.ok(phraseOptions(html)<=16,'the optional phrase list keeps current and recent choices bounded');
  assert.match(html,/<option value="__more__">更多前课用法/);
  assert.doesNotMatch(html,/<option[^>]*>word99x11/);
  assert.equal(h.ui.openTarget({lessonId:'now',expression:'word99x11',kind:'word',mode:'four',roundKey:'old-review'}),true);
  html=h.render();assert.match(html,/sentence-sheet-review-target[^>]*>word99x11/);
  assert.equal(targetOptions(html),0,'an explicit old review has readonly context instead of adding old selectable words');
  assert.match(html,/data-sentence-action="current-lesson"/);
  h.ui.switchMode('phrase');html=h.render();assert.equal((html.match(/<option\b/g)||[]).length,6,'two current phrases plus four training modes');
  assert.ok(h.ui.wordBank().some(item=>item.label==='word99x11'));
  h.ui.wordSearch='word99x11';assert.deepEqual(Array.from(h.ui.filteredOldItems(),item=>item.label),['word99x11']);
});
