const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const DIR=path.join(__dirname,'..'),NOW=Date.parse('2026-10-26T08:00:00Z'),json=x=>JSON.parse(JSON.stringify(x));
const lesson=(extra={})=>({id:'evidence-lesson',book:1,number:1,title:'Source lesson',vocabulary:[{word:'seat',meaning:'座位'}],usage:[],quiz:[],paragraphs:[{en:'We were waiting beside the quiet theatre.',zh:'我们在剧院边等候。'}],...extra});
function context(files){class Clock extends Date{static now(){return NOW;}}const c={Date:Clock,Intl,document:{addEventListener(){},querySelector(){return null;}}};c.window=c;vm.createContext(c);for(const file of files)vm.runInContext(fs.readFileSync(path.join(DIR,file),'utf8'),c,{filename:file});return c;}
function review(l=lesson(),{save=true}={}){
 const c=context(['review-engine.js','grammar-check.js','review-practice.js']),R=c.StudyReview,events=[],messages=[];let state=R.enroll({},R.cardsForLessons([l]),{now:NOW}),persisted=json(state),mode=save,container,ui,writes=0;
 function make(){container={listeners:{},innerHTML:'',addEventListener(k,f){(this.listeners[k]??=[]).push(f);},querySelector(){return {innerHTML:''};},querySelectorAll(){return [];},contains(){return true;}};ui=new c.ReviewPractice({container,getLessons:()=>[l],getState:()=>state,saveState:n=>{if(mode==='throw')throw Error('quota');if(mode!==true)return false;state=n;persisted=json(n);writes++;return true;},escapeHTML:s=>String(s??''),wordHTML:s=>String(s??''),toast:m=>messages.push(m),getCurrentLesson:()=>l,openLesson(){},enrollCurrent(){},backup(){},speak(){},onEvidence:e=>events.push(json(e)),taskBarHTML:()=>'<button data-coach-action="tasks">返回今日任务</button>'});ui.render();}
 make();return {c,R,events,messages,get state(){return state;},get ui(){return ui;},get html(){return container.innerHTML;},get writes(){return writes;},act:(action,value)=>ui.action(action,{dataset:{reviewRating:value,reviewOption:value}}),edit(value){for(const f of container.listeners.input||[])f({target:{dataset:{reviewInput:''},value}});},reload(){state=json(persisted);make();},saveMode(value){mode=value;}};
}
function output({save=true,asyncSave=false}={}){
 const c=context(['grammar-check.js','output-practice.js']),events=[],attempts=[];let l=lesson(),mode=save;
 const ui=new c.OutputPractice({getLesson:()=>l,saveRecord:r=>{attempts.push(json(r));if(mode==='throw')throw Error('quota');return asyncSave?Promise.resolve(mode===true):mode===true;},onEvidence:e=>events.push(json(e)),toast(){}});ui.setLesson(l);
 const action=(type,more={})=>{const b={dataset:{outputAction:type,...more},closest:s=>s==='#output-content'?{}:null};ui.click({target:{closest:()=>b}});};
 return {c,ui,events,attempts,action,start(key,mode='write'){assert.equal(typeof ui.startTask,'function');return ui.startTask({lessonId:l.id,mode,roundKey:key});},edit(value){ui.input({target:{dataset:{outputInput:'answer'},value,closest:()=>({})}});},saveMode(value){mode=value;},newLesson(){l=lesson({id:'next-evidence',number:2});ui.setLesson(l);}};
}
test('revealing and then copying a correct answer cannot become an independent good rating, even after reload',()=>{
 const h=review(),id=h.ui.active.id;h.act('reveal');h.reload();h.edit('seat');h.act('check');assert.equal(h.ui.feedback.correct,true);h.act('rate','good');assert.equal(h.state.cards[id].stage,0);assert.equal(h.events.length,0);h.act('rate','hard');assert.equal(h.state.cards[id].stage,0);assert.equal(h.events.length,1);assert.equal(h.events[0].assisted,true);assert.equal(h.events[0].correct,true);assert.equal(h.events[0].complete,true);assert.equal(h.state.cards[id].lastEvidence.assisted,true);
});
test('wrong feedback stays assisted through editing and a later correct answer',()=>{
 const h=review(),id=h.ui.active.id;h.edit('sit');h.act('check');assert.equal(h.ui.feedback.correct,false);h.edit('seat');h.act('check');h.act('rate','good');assert.equal(h.state.cards[id].stage,0);h.act('rate','hard');assert.equal(h.events.length,1);assert.equal(h.events[0].assisted,true);
});
test('independent objective output advances once, retains legacy fields, and emits saved evidence',()=>{
 const h=review(),id=h.ui.active.id;h.edit('seat');h.act('check');h.act('rate','good');assert.equal(h.state.cards[id].stage,1);assert.equal(h.events.length,1);assert.deepEqual(h.events[0],{type:'review',lessonId:'evidence-lesson',cardId:id,kind:'word',correct:true,assisted:false,rating:'good',answer:'seat',complete:true,at:NOW});assert.equal(h.state.cards[id].lastEvidence.assisted,false);assert.equal(h.state.cards[id].repetitions,1);
});
test('free phrase writing and switching back to recall cannot promote supported-form checks to mastery',()=>{
 const h=review(lesson({vocabulary:[],usage:[{phrase:'pay attention',meaning:'注意',example:'Pay attention to the actors.'}]})),id=h.ui.active.id;h.act('writing');h.edit('We always pay attention to actors.');h.act('check');h.act('rate','good');assert.equal(h.state.cards[id].stage,0);h.act('recall');h.edit('pay attention');h.act('check');h.act('rate','good');assert.equal(h.state.cards[id].stage,0);h.act('rate','hard');assert.equal(h.events[0].assisted,true);
});
test('storage failure never emits review completion, and a retry emits exactly once',()=>{
 const h=review(lesson(),{save:false});h.edit('seat');h.act('check');h.act('rate','good');assert.equal(h.events.length,0);h.saveMode(true);h.act('rate','good');assert.equal(h.events.length,1);h.act('rate','good');assert.equal(h.events.length,1);
});
test('review task bar is optional and early drills keep the original schedule untouched',()=>{
 const h=review(),id=h.ui.active.id;assert.match(h.html,/返回今日任务/);h.edit('seat');h.act('check');h.act('rate','good');const before=json(h.state.cards[id]);h.ui.startDrill([id]);h.ui.render();h.edit('seat');h.act('check');h.act('rate','good');assert.deepEqual(json(h.state.cards[id]),before);assert.equal(h.events.length,1);
});
test('engine persists assistance without rating and refuses good with assisted or wrong evidence',()=>{
 const h=review(),id=h.ui.active.id;assert.equal(typeof h.R.assist,'function');const r=h.R.assist(h.state,id,{revision:0,now:NOW,reason:'answer'});assert.equal(r.accepted,true);assert.equal(r.state.cards[id].stage,0);assert.equal(r.state.cards[id].repetitions,0);assert.equal(h.R.rate(r.state,id,'good',{revision:0,now:NOW,evidence:{correct:true,assisted:true,objective:true,answer:'seat',kind:'word'}}).accepted,false);assert.equal(h.R.rate(h.state,id,'good',{revision:0,now:NOW,evidence:{correct:false,assisted:false,objective:true,answer:'sit',kind:'word'}}).accepted,false);assert.equal(h.R.sanitize(r.state).cards[id].assistance.revision,0);
});
test('an independent output task records mode evidence and does not count automatic post-submit grammar as assistance',()=>{
 const h=output();h.start('day-1-write');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events.length,1);assert.equal(h.events[0].type,'dictation');assert.equal(h.events[0].assisted,false);assert.equal(h.events[0].complete,true);assert.equal(h.events[0].roundKey,'day-1-write');assert.equal(h.attempts[0].details.evidenceVersion,1);assert.equal(h.attempts[0].details.assisted,false);assert.equal(h.attempts[0].details.roundKey,'day-1-write');h.ui.submit();assert.equal(h.events.length,1);
});
test('opening the original stays assisted after hiding it, retrying or changing output modes',()=>{
 const h=output();h.start('day-1-retell','retell');h.action('original');h.action('original');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[0].assisted,true);h.action('retry');h.action('mode',{outputMode:'write'});h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[1].assisted,true);assert.equal(h.events[1].roundKey,'day-1-retell');
});
test('manual grammar checks and corrected retries stay assisted; an explicit new task clears answers and references',()=>{
 const h=output();h.start('round-a','retell');h.edit('They was waiting beside the quiet theatre.');h.action('grammar-check');h.action('grammar-all');h.ui.submit();assert.equal(h.events[0].assisted,true);h.action('retry');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[1].assisted,true);h.start('round-b','retell');assert.equal(h.ui.answer,'');assert.equal(h.ui.showOriginal,false);assert.equal(h.ui.result,null);h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[2].assisted,false);
});
test('reentering the same round does not launder assistance or discard a draft',()=>{
 const h=output();h.start('same-round','retell');h.action('original');h.edit('This is an unfinished retelling about actors.');h.start('same-round','retell');assert.equal(h.ui.answer,'This is an unfinished retelling about actors.');h.ui.submit();assert.equal(h.events[0].assisted,true);h.newLesson();assert.equal(h.ui.answer,'');assert.equal(h.ui.showOriginal,false);
});
test('insufficient output can give feedback but cannot claim task completion; partial spelling is incomplete',()=>{
 const h=output();h.start('short-write');h.edit('We');h.ui.submit();assert.equal(h.events[0].complete,false);h.start('spell-round','spell');h.ui.current.vocabulary.push({word:'chair',meaning:'椅子'});h.ui.spellAnswers={0:'seat'};h.ui.submit();assert.equal(h.events.at(-1).type,'spelling');assert.equal(h.events.at(-1).complete,false);
});
test('output callbacks wait for real persistence and capture the submitted round across a later navigation',async()=>{
 const failed=output({save:false,asyncSave:true});failed.start('failed');failed.edit('We were waiting beside the quiet theatre.');failed.ui.submit();await Promise.resolve();assert.equal(failed.events.length,0);
 const h=output({asyncSave:true});h.start('saved');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events.length,0);h.start('later');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.events.length,1);assert.equal(h.events[0].roundKey,'saved');assert.equal(h.events[0].assisted,false);
});
test('post-submit feedback remains assisted when switching mode rather than clicking retry',()=>{
 const h=output();h.start('feedback-round');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[0].assisted,false);h.action('mode',{outputMode:'retell'});h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(h.events[1].assisted,true);
});
test('failed task evidence has an explicit retry that keeps the submitted answer and does not duplicate output storage',()=>{
 const h=output();let accept=false,attempts=0;h.ui.options.onEvidence=()=>{attempts++;return accept;};h.start('save-task');h.edit('We were waiting beside the quiet theatre.');h.ui.submit();assert.equal(attempts,1);assert.equal(h.attempts.length,1);assert.match(h.ui.render(),/重试保存任务状态/);assert.equal(h.ui.answer,'We were waiting beside the quiet theatre.');accept=true;h.action('evidence-retry');assert.equal(attempts,2);assert.equal(h.attempts.length,1);assert.doesNotMatch(h.ui.render(),/重试保存任务状态/);
});
test('formal task review scopes genuine due cards, saves evidence, and excludes future or unenrolled practice cards',()=>{
 const h=review(lesson({vocabulary:[{word:'seat',meaning:'座位'},{word:'chair',meaning:'椅子'}]})),cards=h.ui.cards(),selected=cards.find(c=>c.target==='seat'),future=cards.find(c=>c.target==='chair');h.state.cards[future.id].dueAt=NOW+86400000;
 assert.equal(typeof h.ui.startReview,'function');assert.equal(h.ui.startReview([selected.id,future.id,'untrusted-card']),2);h.ui.render();assert.equal(h.ui.cardIds,null);assert.deepEqual(Array.from(h.ui.due(),c=>c.id),[selected.id]);h.edit('seat');h.act('check');h.act('rate','good');assert.equal(h.events.length,1);assert.equal(h.state.cards[selected.id].stage,1);assert.equal(h.state.cards[future.id].stage,0);assert.equal(h.ui.active,null);
});
test('supplementary practice may show an unenrolled card without enrolling, advancing or emitting daily evidence',()=>{
 const h=review(),id=h.ui.active.id;delete h.state.cards[id];const before=json(h.state);h.ui.startPractice([id]);h.ui.render();assert.equal(h.ui.active.id,id);assert.equal(h.ui.active.progress.revision,null);h.act('reveal');h.act('practice-again');h.edit('seat');h.act('check');h.act('practice-next');assert.equal(h.ui.active,null);assert.equal(h.events.length,0);assert.equal(h.writes,0);assert.deepEqual(json(h.state),before);
});
