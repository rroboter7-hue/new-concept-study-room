const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const lesson=(id,book,number,extra={})=>({id,book,number,title:id,vocabulary:[],usage:[],grammar:[],quiz:[],paragraphs:[],...extra});
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(files=['recurrence.js','review-engine.js','review-practice.js']){
 const scope={console,Date};scope.window=scope;vm.createContext(scope);
 for(const name of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),scope,{filename:name});
 return scope;
}
function component({future=false,unenrolled=false}={}){
 const scope=setup(),lessons=[lesson('old',1,1,{vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'笔'}]})];
 const cards=scope.StudyReview.cardsForLessons(lessons),container={innerHTML:'',addEventListener(){},contains:()=>true,querySelector:()=>null,querySelectorAll:()=>[]};
 let state=unenrolled?scope.StudyReview.sanitize(null):scope.StudyReview.enroll(null,cards),writes=0;
 if(future)for(const record of Object.values(state.cards))record.dueAt=Date.now()+86400000;
 const ui=new scope.ReviewPractice({container,getLessons:()=>lessons,getState:()=>state,saveState:next=>{state=next;writes++;return true;},escapeHTML:String,wordHTML:String,getCurrentLesson:()=>lessons[0],toast(){},onChange(){}});
 return {scope,ui,cards,container,state:()=>state,writes:()=>writes};
}

test('learned evidence accepts legacy and current saved records without inherited or malformed claims',()=>{
 const {StudyReview:R}=setup();assert.equal(typeof R.hasStudied,'function');
 for(const record of [{completed:true},{attempts:2},{learningProgress:{readAt:0}},{learningProgress:{firstPracticedAt:100}}])assert.equal(R.hasStudied(record),true);
 for(const record of [null,[],{completed:'true',attempts:'2'},{attempts:Infinity},{attempts:0.5},{learningProgress:{readAt:-1,firstPracticedAt:NaN}},Object.create({completed:true}),{learningProgress:Object.create({readAt:20})}])assert.equal(R.hasStudied(record),false);
 const getter={};Object.defineProperty(getter,'completed',{get(){throw Error('must not execute accessors');}});assert.equal(R.hasStudied(getter),false);
});

test('known recurrence is selected before the limit and its source and meaning identify the learned lesson',()=>{
 const {StudyRecurrence:R}=setup();
 const early=lesson('early',1,1,{vocabulary:[{word:'apple',meaning:'苹果'},{word:'play',meaning:'戏剧'}]}),known=lesson('known',2,1,{vocabulary:[{word:'play',meaning:'玩耍'}]}),now=lesson('now',2,2,{paragraphs:[{en:'An apple. We play outside.'}]});
 const before=JSON.stringify([early,known,now]),index=R.build([early,known,now]),hit=index.forLesson('now',{studiedIds:['known'],limit:1})[0];
 assert.equal(hit.label,'play');assert.equal(hit.origin.lessonId,'known');assert.equal(hit.origin.studied,true);assert.equal(hit.meaning,'玩耍');assert.equal(hit.hasStudiedOrigin,true);
 assert.equal(index.forLesson('now',{limit:100}).find(h=>h.label==='play').origin.lessonId,'early');assert.equal(JSON.stringify([early,known,now]),before);
});

test('small previews balance available vocabulary, usage and explicit grammar',()=>{
 const {StudyRecurrence:R}=setup(),old=lesson('old',1,1,{vocabulary:['apple','bread','chair','door','egg'].map(word=>({word,meaning:'词'}))}),later=lesson('later',1,2,{usage:[{phrase:'look at',meaning:'看'}],grammar:[{title:'现在时',knowledgeId:'present'}]}),now=lesson('now',1,3,{paragraphs:[{en:'Apple bread chair door egg. Look at it.'}],grammar:[{title:'现在时',knowledgeId:'present',example:'I look at it.'}]});
 const rows=R.build([old,later,now]).forLesson('now',{limit:3});assert.deepEqual(Array.from(rows,h=>h.kind).sort(),['grammar','usage','vocabulary']);
});

test('bad note glosses are quarantined, canonical fallbacks are attributed and living room is not live',()=>{
 const {StudyRecurrence:R}=setup(),old=lesson('old',1,1,{vocabulary:[{word:'make',meaning:'多模仿少创造',pos:'v.'},{word:'catch',meaning:'特殊疑问词',pos:'v.'},{word:'live',meaning:'国家城市',pos:'v.'}]}),now=lesson('now',2,1,{paragraphs:[{en:'They made a chair for the living room. He caught a ball.'}]});
 const rows=R.build([old,now],{glossary:{make:{word:'make',meaning:'制作；使；作出'}}}).forLesson('now',{limit:100}),make=rows.find(h=>h.label==='make'),caught=rows.find(h=>h.label==='catch');
 assert.equal(make.meaning,'制作；使；作出');assert.equal(make.meaningStatus,'dictionary-fallback');assert.match(make.definitionSource,/通用词典/);assert.equal(make.origin.originalMeaning,'多模仿少创造');
 assert.equal(caught.meaning,'');assert.equal(caught.meaningStatus,'needs-context-review');assert.equal(rows.some(h=>h.label==='live'),false);
 const live=R.build([old,lesson('later',2,2,{paragraphs:[{en:'They lived in France.'}]})]).forLesson('later',{limit:100})[0];assert.equal(live.label,'live');assert.equal(live.meaning,'');assert.equal(live.semanticMatch,false);
});

test('review selection requires the same earlier source and exact lexical target or explicit grammar identity',()=>{
 const {StudyReview:R}=setup();assert.equal(typeof R.matchRecurrences,'function');
 const cards=[{id:'book',kind:'word',target:'ＢＯＯＫ',sourceLesson:{id:'old'}},{id:'prefix',kind:'phrase',target:'look',sourceLesson:{id:'old'}},{id:'phrase',kind:'phrase',target:'look at',sourceLesson:{id:'old'}},{id:'present',kind:'grammar',target:'is',knowledgeId:'knowledge:old:grammar:present',sourceLesson:{id:'old'}},{id:'past',kind:'grammar',target:'was',conceptId:'knowledge:old:grammar:past',sourceLesson:{id:'old'}},{id:'other',kind:'word',target:'book',sourceLesson:{id:'other'}}];
 const hits=[{kind:'vocabulary',label:'book',origins:[{lessonId:'old',studied:true}]},{kind:'usage',label:'look at',origins:[{lessonId:'old',studied:true}]},{kind:'grammar',label:'现在时',evidence:{knowledgeId:'present'},origins:[{lessonId:'old',studied:true}]}],before=JSON.stringify({cards,hits});
 assert.deepEqual(Array.from(R.matchRecurrences(cards,hits),c=>c.id),['book','phrase','present']);assert.deepEqual(Array.from(R.matchRecurrences(cards,[{kind:'grammar',label:'现在时',origins:[{lessonId:'old',studied:true}]}])),[]);
 assert.equal(R.matchRecurrences(cards,hits.map(h=>({...h,origins:[{lessonId:'old',studied:false}]}))).length,0);assert.equal(JSON.stringify({cards,hits}),before);
 assert.equal(R.matchRecurrences([{...cards[3],knowledgeId:'knowledge:other:grammar:present'}],hits).length,0);
});

test('placeholder definitions become exact source clozes only when an example supplies a genuine cue',()=>{
 const {StudyReview:R}=setup(),cards=R.cardsForLessons([lesson('old',1,1,{vocabulary:[{word:'make',meaning:'多模仿少创造'}],usage:[{phrase:'at large',meaning:'原笔记习惯表达（未附独立中文释义）'},{phrase:'go on',meaning:'未提供中文释义',example:'Please go on with your story.'},{phrase:'look at',meaning:'看'}]})]);
 assert.deepEqual(Array.from(cards,c=>c.target),['go on','look at']);assert.match(cards[0].prompt,/Please ____ with your story\./);assert.doesNotMatch(cards[0].prompt,/未提供|go on/);assert.equal(cards[0].promptType,'source-cloze');assert.equal(R.checkAnswer(cards[0],'go on').correct,true);
});

test('source clozes hide repeated answers and never take a target out of a compound word',()=>{
 const {StudyReview:R}=setup(),cards=R.cardsForLessons([lesson('old',1,1,{usage:[{phrase:'go',meaning:'未提供中文释义',example:'Please go-get the groceries.'},{phrase:'go on',meaning:'未提供中文释义',example:'Please go on and go on until I return.'}]})]);
 assert.deepEqual(Array.from(cards,c=>c.target),['go on']);assert.equal((cards[0].prompt.match(/____/g)||[]).length,2);assert.doesNotMatch(cards[0].prompt,/go on/i);
});

test('review-engine alone rejects placeholder and known bad glosses even without the optional recurrence module',()=>{
 const {StudyReview:R}=setup(['review-engine.js']),cards=R.cardsForLessons([lesson('old',1,1,{vocabulary:[{word:'make',meaning:'多模仿少创造'},{word:'catch',meaning:'特殊疑问词'},{word:'live',meaning:'国家城市'},{word:'book',meaning:'书'}],usage:[{phrase:'at large',meaning:'原笔记习惯表达（未附独立中文释义）'}]})]);
 assert.deepEqual(Array.from(cards,c=>c.target),['book']);
});

test('explicit practice shows future-due and unenrolled selected cards without ever writing spaced progress',()=>{
 for(const options of [{future:true},{unenrolled:true},{}]){
  const h=component(options),before=JSON.stringify(h.state());assert.equal(typeof h.ui.startPractice,'function');assert.equal(h.ui.startPractice([h.cards[0].id,'unknown',h.cards[0].id]),1);h.ui.render();assert.equal(h.ui.active.id,h.cards[0].id);
  assert.doesNotMatch(h.container.innerHTML,/data-review-rating=/);assert.doesNotMatch(h.container.innerHTML,/data-review-action="practice-next"/);h.ui.input='book';h.ui.action('check',{});assert.equal((h.container.innerHTML.match(/data-review-action="practice-next"/g)||[]).length,1);h.ui.action('practice-again',{});assert.equal(h.ui.active.id,h.cards[0].id);assert.equal(h.ui.revealed,false);assert.doesNotMatch(h.container.innerHTML,/data-review-action="practice-next"/);
  h.ui.input='book';h.ui.action('check',{});assert.equal((h.container.innerHTML.match(/data-review-action="practice-next"/g)||[]).length,1);h.ui.action('practice-next',{});assert.equal(h.ui.active,null);assert.equal(h.writes(),0);assert.equal(JSON.stringify(h.state()),before);
 }
});

test('stale next actions cannot skip unanswered practice, while checked future-due and unenrolled cards advance without scheduling or evidence',()=>{
 for(const options of [{future:true},{unenrolled:true},{}]){
  const h=component(options),before=JSON.stringify(h.state()),events=[];h.ui.options.onEvidence=e=>events.push(e);h.ui.startPractice(h.cards.map(c=>c.id));h.ui.render();
  for(const card of h.cards){
   assert.equal(h.ui.active.id,card.id);assert.equal(h.ui.revealed,false);assert.doesNotMatch(h.container.innerHTML,/data-review-action="practice-next"/);assert.doesNotMatch(h.container.innerHTML,/data-review-rating=/);h.ui.action('practice-next',{});assert.equal(h.ui.active.id,card.id);h.ui.input=card.target;h.ui.action('check',{});assert.equal((h.container.innerHTML.match(/data-review-action="practice-next"/g)||[]).length,1);h.ui.action('practice-next',{});
  }
  assert.equal(h.ui.active,null);assert.equal(h.ui.practiceDone.size,2);assert.equal(h.writes(),0);assert.equal(events.length,0);assert.equal(JSON.stringify(h.state()),before);
 }
});

test('leaving explicit practice restores the due queue and normal ratings still save a schedule',()=>{
 const h=component();assert.equal(typeof h.ui.startPractice,'function');h.ui.startPractice([h.cards[1].id]);h.ui.render();h.ui.clearFilters();h.ui.render();assert.equal(h.ui.cardIds,null);assert.doesNotMatch(h.container.innerHTML,/data-review-rating=/);assert.doesNotMatch(h.container.innerHTML,/data-review-action="practice-next"/);h.ui.input=h.ui.active.target;h.ui.action('check',{});assert.equal(h.ui.independentlyCorrect(),true);assert.match(h.container.innerHTML,/data-review-rating="good"/);h.ui.action('rate',{dataset:{reviewRating:'good'}});assert.equal(h.writes(),1);assert.equal(Object.values(h.state().cards).some(r=>r.stage===1),true);
});

test('ordinary spaced ratings preserve all intervals, future guards and stale revision rejection',()=>{
 const {StudyReview:R}=setup(),card=R.cardsForLessons([lesson('old',1,1,{vocabulary:[{word:'book',meaning:'书'}]})])[0];let now=1792980000000,state=R.enroll(null,[card],{now});
 for(const interval of [1,3,7,14,30,30]){const revision=state.cards[card.id].revision,result=R.rate(state,card.id,'good',{now,revision});assert.equal(result.nextDueAt-now,interval*86400000);assert.equal(R.rate(result.state,card.id,'good',{now,revision:revision+1}).accepted,false);assert.equal(R.rate(result.state,card.id,'good',{now:result.nextDueAt,revision}).accepted,false);state=result.state;now=result.nextDueAt;}
 const again=R.rate(state,card.id,'again',{now,revision:state.cards[card.id].revision});assert.equal(again.nextDueAt-now,600000);assert.equal(R.queue(again.state,[card],{now:again.nextDueAt-1}).length,0);assert.equal(R.queue(again.state,[card],{now:again.nextDueAt}).length,1);
});
