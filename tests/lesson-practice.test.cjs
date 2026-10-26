const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),fixture=require('./practice-pack-fixture.cjs');
const dir=path.join(__dirname,'..');
function harness(options={}){let state={},records=[],persist=true,redraws=0,toasts=[],resolveAudio;const listeners={},root={querySelector(){return null;},set innerHTML(v){this.html=v;redraws++;},get innerHTML(){return this.html||'';}};const document={addEventListener:(kind,fn)=>{(listeners[kind]??=[]).push(fn);},removeEventListener(){},getElementById:()=>root};const c={document,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),console};c.window=c;vm.createContext(c);for(const f of ['practice-pack-core.js','lesson-practice.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c,{filename:f});const f=fixture(),registry=c.StudyPracticePacks.create(f.manifest,f.lessons,f.bank);let lesson=f.lessons[0];const ui=new c.LessonPractice({registry,getLesson:()=>lesson,getState:()=>state,saveState:next=>{if(!persist)return false;state=JSON.parse(JSON.stringify(next));return true;},saveResult:result=>{records.push(JSON.parse(JSON.stringify(result)));return true;},toast:x=>toasts.push(x),speak:()=>new Promise((res,rej)=>{resolveAudio={res,rej};}),hasWordAudio:()=>true,getOrigins:options.getOrigins,openOrigin:options.openOrigin});return {c,ui,root,records,toasts,get state(){return state;},set state(v){state=v;},set persist(v){persist=v;},get redraws(){return redraws;},get audio(){return resolveAudio;},lesson:f.lessons[0],pack:registry.get('l1')};}
test('listening hides its target and examples until submitted, and requires successful playback',async()=>{const h=harness();h.ui.start();let s=h.ui.session();for(let i=0;i<6;i++){const q=h.pack.tasks[i];s=h.c.StudyPracticePacks.advance(h.c.StudyPracticePacks.submit(s,h.pack,q.id,q.type==='choice'?q.answer:q.expected[0]).session,h.pack);}h.state={sessions:{l1:s}};const html=h.ui.render();assert.ok(!html.includes('desk'));assert.ok(html.includes('播放单词'));h.ui.answer('desk');assert.equal(h.ui.submitCurrent(),false);assert.match(h.toasts.at(-1),/先听/);const playing=h.ui.playAudio();h.audio.res();await playing;h.ui.answer('desk');assert.equal(h.ui.submitCurrent(),true);assert.ok(h.ui.render().includes('desk'));});
test('typing persists the draft without redrawing its input, and reconstruction resumes it',()=>{const h=harness();h.ui.start();const before=h.redraws;h.ui.answer('appl');assert.equal(h.redraws,before);assert.equal(h.state.sessions.l1.answers.vocabulary1.value,'appl');const ui=new h.c.LessonPractice({...h.ui.options});assert.equal(ui.session().answers.vocabulary1.value,'appl');assert.ok(ui.render().includes('appl'));});
test('a failed save neither advances the question nor stores a grade',()=>{const h=harness();h.ui.start();h.ui.answer('apple');h.persist=false;assert.equal(h.ui.submitCurrent(),false);assert.equal(h.ui.session().answers.vocabulary1.submittedAt,null);assert.equal(h.records.length,0);assert.ok(h.toasts.some(x=>/保存/.test(x)));});
test('a full result is committed only once, while a wrong-only correction never writes a full mark',()=>{const h=harness();h.ui.start();let s=h.ui.session();for(let i=0;i<12;i++){const q=h.pack.tasks[i],value=i===3?1:q.type==='choice'?q.answer:q.expected[0];if(q.category==='listening')s.audioPlayed[q.id]=Date.now();s=h.c.StudyPracticePacks.advance(h.c.StudyPracticePacks.submit(s,h.pack,q.id,value).session,h.pack);}h.state={sessions:{l1:s}};h.ui.commitResult();h.ui.commitResult();assert.equal(h.records.length,1);assert.equal(h.records[0].correct,11);assert.equal(h.records[0].total,12);h.ui.retryWrong();h.ui.choose(0);h.ui.next();h.ui.commitResult();assert.equal(h.records.length,1);assert.equal(h.ui.session().mode,'correction');});
test('stale content revisions are visible and starting a new pack archives the prior draft',()=>{const h=harness();h.state={sessions:{l1:{lessonId:'l1',revision:'old',attemptId:'old',answers:{vocabulary1:{value:'apple'}}}}};assert.ok(h.ui.render().includes('题库已更新'));h.ui.start();assert.equal(h.state.archives.length,1);assert.equal(h.state.archives[0].revision,'old');assert.equal(h.ui.session().revision,'fixture-v1');});
test('HTML in typed answers is escaped and a nonmatching transformation is not labelled a general grammar error',()=>{const h=harness();h.ui.start();h.ui.answer('<img src=x onerror=alert(1)>');assert.ok(!h.ui.render().includes('<img'));const q=h.pack.tasks[10],r=h.c.StudyPracticePacks.grade(q,'She likes books.');assert.equal(r.correct,false);assert.ok(r.reason.includes('不表示所有其他表达都有语法错误'));});

function openFirstListening(h,attemptId='listening-attempt'){
 assert.equal(h.ui.start({attemptId}),true);let session=h.ui.session();
 for(const q of h.pack.tasks.slice(0,6)){const result=h.c.StudyPracticePacks.submit(session,h.pack,q.id,q.type==='choice'?q.answer:q.expected[0]);assert.equal(result.accepted,true);session=h.c.StudyPracticePacks.advance(result.session,h.pack);}
 h.state={...h.state,sessions:{...h.state.sessions,l1:session}};h.ui.refresh();
 const question=h.pack.tasks[6];assert.equal(question.category,'listening');assert.equal(h.ui.session().queue[h.ui.session().cursor],question.id);return question;
}

for(const draftSaveFails of [false,true])test('listening completion preserves text entered while audio is pending'+(draftSaveFails?' even when the initial draft save fails':''),async()=>{
 const h=harness(),q=openFirstListening(h),redraws=h.redraws,playing=h.ui.playAudio(),pending=h.audio;
 assert.equal(h.ui.session().audioPlayed[q.id],undefined);h.persist=!draftSaveFails;
 assert.equal(h.ui.answer('de'),!draftSaveFails);assert.equal(h.ui.answer(q.expected[0]),!draftSaveFails);
 assert.equal(h.ui.session().answers[q.id].value,q.expected[0],'current session includes the latest typed draft before audio resolves');
 assert.equal(h.ui.session().answers[q.id].submittedAt,null);assert.equal(h.ui.submitCurrent(),false,'unresolved playback cannot authorize a listening grade');assert.match(h.toasts.at(-1),/先听/);
 assert.equal(h.redraws,redraws,'starting audio and typing do not replace the live input');
 h.persist=true;pending.res();await playing;
 assert.equal(h.ui.session().answers[q.id].value,q.expected[0],'playback saves the current draft rather than the session captured before typing');
 assert.equal(h.state.sessions.l1.answers[q.id].value,q.expected[0],'the retained draft is also durable after playback succeeds');
 assert.equal(typeof h.ui.session().audioPlayed[q.id],'number');assert.equal(h.ui.session().answers[q.id].submittedAt,null,'playback itself does not submit or grade');
 assert.equal(h.redraws,redraws,'playback completion only updates its status, without rebuilding the input');assert.match(h.ui.render(),/value="desk"/);assert.match(h.ui.audioStatus[q.id],/播放完成/);
 assert.equal(h.ui.submitCurrent(),true,'a successful playback permits the preserved typed answer to submit');
 assert.equal(h.c.StudyPracticePacks.grade(q,h.ui.session().answers[q.id].value).correct,true);assert.equal(typeof h.ui.session().answers[q.id].submittedAt,'number');assert.equal(h.records.length,0,'one listening answer does not commit an incomplete full result');
});

test('an older overlapping playback cannot mark audioPlayed or overwrite the newer typed draft',async()=>{
 const h=harness(),q=openFirstListening(h),first=h.ui.playAudio(),older=h.audio;
 h.ui.answer('de');const second=h.ui.playAudio(),newer=h.audio;h.ui.answer(q.expected[0]);const redraws=h.redraws;
 older.res();await first;assert.equal(h.ui.session().audioPlayed[q.id],undefined,'only the latest playback token may authorize submission');assert.equal(h.ui.submitCurrent(),false);assert.equal(h.ui.session().answers[q.id].value,q.expected[0]);
 newer.res();await second;assert.equal(typeof h.ui.session().audioPlayed[q.id],'number');assert.equal(h.ui.session().answers[q.id].value,q.expected[0]);assert.equal(h.redraws,redraws);assert.equal(h.ui.submitCurrent(),true);
});

test('a late playback result cannot authorize or replace the draft of a new attempt',async()=>{
 const h=harness(),q=openFirstListening(h,'older-attempt'),playing=h.ui.playAudio(),pending=h.audio;
 h.ui.answer(q.expected[0]);const token=h.ui.audioToken;
 // Replace the stored attempt without incrementing the token, so this exercises
 // the attempt-ownership guard independently of the overlapping-play guard.
 const replacement=h.c.StudyPracticePacks.start(h.pack,{attemptId:'replacement-attempt'});
 h.state={...h.state,sessions:{...h.state.sessions,l1:replacement}};h.ui.answer('apple');const before=JSON.stringify(h.state),redraws=h.redraws;assert.equal(h.ui.audioToken,token);
 pending.res();await playing;
 assert.equal(JSON.stringify(h.state),before,'the old completion cannot write into the replacement attempt');assert.equal(h.ui.session().attemptId,'replacement-attempt');assert.equal(h.ui.session().answers.vocabulary1.value,'apple');assert.deepEqual(Object.keys(h.ui.session().audioPlayed),[]);assert.equal(h.redraws,redraws);assert.equal(h.records.length,0);
});


test('origin links preserve the word and notes provenance without claiming textbook occurrence',()=>{
 const opened=[],h=harness({getOrigins:()=>[{lessonId:'book1-note-1',book:1,number:1,label:'house',sourceType:'notes',sourceLabel:'学习笔记 · 词表'}],openOrigin:(...args)=>opened.push(args)}),html=h.ui.origins({word:'house'});
 assert.match(html,/第1册第1课 · house · 学习笔记 · 词表/);assert.match(html,/来源为学习笔记词表；仅作词形回顾，不表示教材正文出现或当前语境同义。/);assert.match(html,/data-pack-origin-kind="notes"/);assert(!html.includes('课文复现'));h.ui.action({dataset:{packAction:'origin',packOrigin:'book1-note-1',packOriginKind:'notes'}});assert.deepEqual(opened,[['book1-note-1','notes']]);
});

test('a textbook origin keeps its distinct source label and does not receive the notes disclaimer',()=>{
 const h=harness({getOrigins:()=>[{lessonId:'textbook-source',book:2,number:1,label:'conversation',sourceType:'textbook',sourceLabel:'教材正文 · 已校对'}]}),html=h.ui.origins({word:'conversation'});assert.match(html,/conversation · 教材正文 · 已校对/);assert(!html.includes('来源为学习笔记词表'));assert.match(html,/data-pack-origin-kind="textbook"/);
});
