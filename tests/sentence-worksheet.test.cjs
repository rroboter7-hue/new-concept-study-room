const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const answers={affirmative:'She looks for her book.',negative:'She does not look for her book.',yesno:'Does she look for her book?',wh:'Where does she look for her book?',combined:''};

function setup({drafts={},failSave=false,getUsage,vocabulary,isPersonNameTarget}={}){
  const events={},notices=[],saved=[],navigation=[],fields={},frames=[];let html='',failure=failSave,renderCount=0,worksheetFields=[];
  const node=selector=>fields[selector]||=( {value:'',textContent:'',innerHTML:'',dataset:{},focus(){},select(){},setAttribute(){},remove(){},querySelectorAll:()=>[]} );
  const content={get innerHTML(){return html;},set innerHTML(value){html=value;renderCount++;},querySelector:node,querySelectorAll:selector=>selector.includes('data-sentence-input="answer"')?worksheetFields:[]};
  const document={body:{classList:{contains:()=>false}},addEventListener:(name,fn)=>(events[name]||=[]).push(fn),querySelector:selector=>selector==='#sentence-practice-content'?content:null};
  const context={document,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},console};context.window=context;vm.createContext(context);
  for(const file of ['sentence-core.js','sentence-practice.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const old={id:'old',book:1,number:1,title:'Old',vocabulary:[{word:'friend',meaning:'朋友',pos:'n.'}],usage:[{phrase:'look after',meaning:'照顾'},{phrase:'look back',meaning:'回顾'}]};
  const lesson={id:'now',book:2,number:1,title:'Books',vocabulary:[{word:'book',meaning:'书'},{word:'seat',meaning:'座位'}],usage:[{phrase:'look for',meaning:'寻找'},{phrase:'pay attention to',meaning:'注意'}]};
  if(vocabulary)lesson.vocabulary=vocabulary;
  const future={id:'later',book:2,number:2,title:'Future',usage:[{phrase:'go beyond',meaning:'超出'}]};
  const ui=new context.SentencePractice({defaultMode:'four',getLesson:()=>lesson,getLessons:()=>[old,lesson,future],getUsage,isPersonNameTarget,getRecords:()=>({old:{completed:true}}),getDrafts:()=>drafts,
    saveDraft:(key,draft)=>{if(failure)return false;drafts[key]=JSON.parse(JSON.stringify(draft));saved.push(key);return true;},toast:value=>notices.push(value),onBack:()=>navigation.push('back'),onNavigateMode:mode=>navigation.push(mode)});
  const render=()=>content.innerHTML=ui.render();render();
  const change=(field,value)=>{const target={dataset:{sentenceSelect:field},value,closest:selector=>selector==='#sentence-practice-content'?content:null};for(const fn of events.change||[])fn({target});};
  const click=(action,mode)=>{const target={dataset:{sentenceAction:action,sentenceMode:mode},closest:selector=>selector==='#sentence-practice-content'?content:selector==='[data-sentence-action]'?target:null};for(const fn of events.click||[])fn({target,preventDefault(){}});};
  return {ui,lesson,old,drafts,saved,notices,navigation,render,change,click,node,document,frames,get renderCount(){return renderCount;},setWorksheetFields:value=>{worksheetFields=value;},flushFrames:()=>{while(frames.length)frames.shift()();},dispatchInput:target=>{for(const fn of events.input||[])fn({target});},setFailure:value=>{failure=value;}};
}

test('worksheet has a single practice header and four empty fields with compact shared context',()=>{
  const h=setup(),html=h.render();
  assert.match(html,/sentence-quick-workspace sentence-worksheet/);
  assert.match(html,/sentence-sheet-header/);assert.match(html,/>造句练习<\/h3>/);
  assert.equal((html.match(/data-sentence-select="target"/g)||[]).length,1);
  assert.equal((html.match(/data-sentence-select="sheet-phrase"/g)||[]).length,1);
  assert.equal((html.match(/data-sentence-kind="(?:affirmative|negative|yesno|wh)" rows=/g)||[]).length,4);
  assert.match(html,/class="sentence-sheet-menu"(?! open)/);
  assert.doesNotMatch(html,/data-sentence-action="writing-mode"/);
  assert.match(html,/>检查这组<\/button>/);assert.match(html,/>复制给豆包<\/button>/);
  assert.doesNotMatch(html,/四句话放在一起，围绕同一/);
  assert.equal(h.ui.feedbackHTML(),'');
  for(const value of Object.values(h.ui.active.draft.answers))assert.equal(value,'');
});

test('current reviewed phrase joins four-form context without overwriting answers or earlier selected words',()=>{
  const h=setup({getUsage:lesson=>lesson.id==='now'?[{phrase:'look for',meaning:'寻找（审校）'}]:lesson.usage});
  Object.assign(h.ui.active.draft.answers,answers);h.ui.setOldSelection(['word:old:friend']);
  h.change('sheet-phrase','phrase:now:look%20for');
  assert.deepEqual(JSON.parse(JSON.stringify(h.ui.active.draft.answers)),answers);
  assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:friend','phrase:now:look%20for']);
  assert.equal(h.ui.oldPhrase().meaning,'寻找（审校）');assert.equal(h.ui.oldPhrase().phrase,'look for');
  assert.ok(!h.ui.wordBank().some(item=>item.source.id==='now'),'old recommendations stay earlier-only');
  h.ui.wordCategory='selected';assert.ok(h.ui.filteredOldItems().some(item=>item.phrase==='look for'),'selected tab includes the phrase selected on this sheet');
  assert.match(h.ui.copyReviewText(),/look for（寻找（审校））/);
  const exported=h.ui.exportLessonDrafts().find(bundle=>bundle.sourceKey===h.ui.active.key);
  assert.ok(exported.selectedOldItems.some(item=>item.phrase==='look for'));
  assert.equal(h.drafts[h.ui.active.key].oldPhraseKey,'phrase:now:look%20for');
});

test('phrase edits preserve selected words and clear or reject only explicitly changed phrase context',()=>{
  const h=setup();Object.assign(h.ui.active.draft.answers,answers);
  h.ui.setOldSelection(['word:old:friend','phrase:old:look%20after','phrase:old:look%20back']);
  h.render();assert.equal(h.ui.selectedOldItems().filter(item=>item.category==='phrase').length,2,'rendering cannot discard existing phrase selections');
  h.change('sheet-phrase','phrase:later:go%20beyond');assert.equal(h.ui.selectedOldItems().filter(item=>item.category==='phrase').length,2);
  h.change('sheet-phrase','phrase:old:look%20after');assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:friend','phrase:old:look%20after']);
  h.change('sheet-phrase','');assert.deepEqual(Array.from(h.ui.active.draft.selectedOldKeys),['word:old:friend']);
  assert.deepEqual(JSON.parse(JSON.stringify(h.ui.active.draft.answers)),answers);
});

test('optional phrase and four answers restore independently for each target; native phrase tasks retain one answer',()=>{
  const h=setup();Object.assign(h.ui.active.draft.answers,answers);h.change('sheet-phrase','phrase:now:look%20for');
  h.change('target','word:now:seat');assert.equal(h.ui.oldPhrase(),null);assert.equal(h.ui.active.draft.answers.affirmative,'');
  h.change('target','word:now:book');assert.equal(h.ui.oldPhrase().phrase,'look for');assert.equal(h.ui.active.draft.answers.wh,answers.wh);
  assert.equal(h.ui.openTarget({lessonId:'now',targetKey:'phrase:now:look%20for',roundKey:'native-phrase',sentenceMode:'phrase-writing'}),true);
  assert.equal(h.ui.active.draft.mode,'phrase');assert.equal((h.render().match(/<textarea\b/g)||[]).length,1);
});

test('back and advanced output navigation flush pending worksheet input before leaving',()=>{
  const h=setup();h.ui.active.draft.answers.affirmative=answers.affirmative;h.ui.markChanged();h.click('back');
  assert.equal(h.navigation[0],'back');assert.equal(h.drafts[h.ui.active.key].answers.affirmative,answers.affirmative);
  h.ui.active.draft.answers.negative=answers.negative;h.ui.markChanged();h.click('navigate-mode','batch');
  assert.equal(h.navigation[1],'batch');assert.equal(h.drafts[h.ui.active.key].answers.negative,answers.negative);
  h.click('navigate-mode','unrecognized');assert.equal(h.navigation.length,2);
});

test('a full optional word selection cannot silently pretend that another phrase was selected',()=>{
  const h=setup();h.old.vocabulary=Array.from({length:100},(_,index)=>({word:'word'+index,meaning:'旧词',pos:'n.'}));h.ui.ensureState();
  h.ui.setOldSelection(h.ui.wordBank().filter(item=>item.category!=='phrase').map(item=>item.key));
  assert.equal(h.ui.active.draft.selectedOldKeys.length,100);
  h.change('sheet-phrase','phrase:now:look%20for');
  assert.equal(h.ui.oldPhrase(),null);assert.equal(h.ui.active.draft.selectedOldKeys.length,100);
  assert.ok(h.notices.some(value=>/100.*移除/.test(value)));
});

test('worksheet save status stays compact but exposes failure honestly and permits retry',()=>{
  const h=setup();assert.match(h.render(),/>未填写<\/p>/);
  h.ui.active.draft.answers.affirmative=answers.affirmative;h.ui.markChanged();assert.match(h.render(),/>保存中<\/p>/);
  h.ui.flush();assert.match(h.render(),/>已保存<\/p>/);
  h.setFailure(true);h.ui.markChanged();h.ui.flush();const failed=h.render();assert.match(failed,/>未保存<\/p>/);assert.match(failed,/浏览器未能保存/);
  assert.doesNotMatch(failed,/>已保存<\/p>/);h.setFailure(false);h.click('save');assert.match(h.render(),/>已保存<\/p>/);
});

test('normal worksheet offers only this lesson new words and excludes explicit person metadata without guessing from capitals or glosses',()=>{
  const h=setup({isPersonNameTarget:()=>false,vocabulary:[
    {word:'Tom',meaning:'雄猫',isLessonNew:true,isPersonName:true},
    {word:'Alice',meaning:'艾丽丝',isLessonNew:true,entityType:'person'},
    {word:'book',meaning:'书',isLessonNew:true},
    {word:'known',meaning:'已学词',isLessonNew:false},
    {word:'name',meaning:'名字；人名；命名',isLessonNew:true},
    {word:'English',meaning:'英语',isLessonNew:true},
    {word:'Trafalgar',meaning:'[人名] 特拉法加',isLessonNew:true,entityType:'place'},
    {word:'cousins',meaning:'表兄弟姐妹；(姓)',isLessonNew:true}
  ]});
  assert.deepEqual(Array.from(h.ui.lessonTargets(),item=>item.word),['book','name','English','Trafalgar','cousins']);
  assert.equal(h.ui.target().word,'book');
  const options=h.render().match(/data-sentence-select="target"[^>]*>([\s\S]*?)<\/select>/)?.[1]||'';
  assert.doesNotMatch(options,/>Tom|>Alice|>known|>friend/);assert.match(options,/>English/);assert.match(options,/>name/);
});

test('source-bound name policy can exclude a person with an ordinary gloss while retaining their saved writing for export',()=>{
  const key='v3:four:now:word%3Anow%3Acarol';
  const drafts={[key]:{targetKey:'word:now:carol',mode:'four',answers:{affirmative:'Carol reads my book.'}},'selection:v1:now':{targetKey:'word:now:carol',mode:'four'}};
  const calls=[];const h=setup({drafts,vocabulary:[{word:'Carol',meaning:'颂歌',isLessonNew:true},{word:'book',meaning:'书',isLessonNew:true}],isPersonNameTarget:(target,source)=>{calls.push([target.word,source.id]);return source.id==='now'&&target.word==='Carol';}});
  assert.equal(h.ui.target().word,'book');assert.equal(h.drafts[key].answers.affirmative,'Carol reads my book.');
  assert.ok(h.ui.exportLessonDrafts().some(bundle=>bundle.answers.affirmative==='Carol reads my book.'));
  assert.ok(calls.some(([word,source])=>word==='Carol'&&source==='now'));
  assert.equal(h.ui.openTarget({lessonId:'now',expression:'Carol',kind:'word',roundKey:'person-round',sentenceMode:'four-forms'}),false);
  assert.equal(h.ui.target().word,'book');
});

test('explicit old daily task retains readonly target context without putting old words in the normal selector',()=>{
  const h=setup();assert.equal(h.ui.openTarget({lessonId:'now',expression:'friend',kind:'word',roundKey:'old-round',sentenceMode:'four-forms'}),true);
  Object.assign(h.ui.active.draft.answers,answers);h.ui.active.draft.answers.affirmative='My friend reads a book.';h.ui.markChanged();
  const oldKey=h.ui.active.key,html=h.render();assert.match(html,/sentence-sheet-review-target/);
  assert.doesNotMatch(html,/<option[^>]*>friend/);assert.match(html,/data-sentence-action="current-lesson"/);
  assert.match(h.ui.copyReviewText(),/目标表达：friend/);
  h.click('current-lesson');assert.equal(h.ui.target().word,'book');assert.equal(h.ui.active.draft.roundKey,'');
  assert.equal(h.drafts[oldKey].answers.affirmative,'My friend reads a book.');
});

test('a lesson with no eligible new words shows an empty worksheet rather than falling back to people or learned targets',()=>{
  const h=setup({vocabulary:[{word:'Tom',meaning:'汤姆',isLessonNew:true,isPersonName:true},{word:'known',meaning:'旧词',isLessonNew:false}]});
  assert.equal(h.ui.active,null);const html=h.render();assert.match(html,/本课暂无可练习的新词/);
  assert.doesNotMatch(html,/<option[^>]*>Tom|<option[^>]*>friend/);
  h.click('back');assert.deepEqual(h.navigation,['back']);
});

test('worksheet input grows and shrinks only the active field without replacing values, focus or sibling fields',()=>{
  const h=setup(),field={dataset:{sentenceInput:'answer',sentenceKind:'negative'},style:{height:'54px'},scrollHeight:78,offsetHeight:54,clientHeight:52,value:answers.negative,selectionStart:9,selectionEnd:9,closest:selector=>selector==='#sentence-practice-content'?{}:null};
  const sibling={style:{height:'54px'},value:answers.affirmative};h.setWorksheetFields([field,sibling]);h.document.activeElement=field;
  const renders=h.renderCount;h.dispatchInput(field);assert.equal(field.style.height,'80px');assert.equal(field.style.overflowY,'hidden');
  assert.equal(h.renderCount,renders);assert.equal(h.document.activeElement,field);assert.equal(field.selectionStart,9);assert.equal(field.selectionEnd,9);
  assert.equal(sibling.style.height,'54px');assert.equal(sibling.value,answers.affirmative);assert.equal(h.ui.active.draft.answers.negative,answers.negative);
  field.value='Short.';field.scrollHeight=52;h.dispatchInput(field);assert.equal(field.style.height,'54px');
  field.value='x'.repeat(400);field.scrollHeight=642;h.dispatchInput(field);assert.equal(field.style.height,'644px');assert.equal(h.ui.active.draft.answers.negative,'x'.repeat(400));
});

test('restored worksheet fields resize after mounting and stale scheduled work cannot resize a different target',()=>{
  const h=setup(),field=kind=>({dataset:{sentenceInput:'answer',sentenceKind:kind},style:{height:'54px'},scrollHeight:kind==='affirmative'?78:110,offsetHeight:54,clientHeight:52,value:answers[kind]});
  const affirmative=field('affirmative'),negative=field('negative');h.setWorksheetFields([affirmative,negative]);h.flushFrames();
  assert.equal(affirmative.style.height,'80px');assert.equal(negative.style.height,'112px');assert.equal(negative.value,answers.negative);
  h.ui.scheduleWorksheetSizing();const stale=h.frames.pop();h.change('target','word:now:seat');
  affirmative.style.height='54px';negative.style.height='54px';stale();assert.equal(affirmative.style.height,'54px');assert.equal(negative.style.height,'54px');
});
