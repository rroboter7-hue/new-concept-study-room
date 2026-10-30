'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Support=require('../retell-support.js'),Writing=require('../free-writing-practice.js');

test('retell retains every current target and source-bound proper/noun hints without inventing people',()=>{
 const lesson={id:'imported-names',book:2,number:3,title:'A visit',paragraphs:[{en:'We visited New York and St. Paul’s Cathedral. Sarah met us in London. The guide showed a map.',zh:'我们参观了纽约和圣保罗大教堂。'}],vocabulary:[{word:'guide',pos:'n.',meaning:'导游'},{word:'map',pos:'n.',meaning:'地图'}]};
 const words=Array.from({length:12},(_,i)=>({word:'word'+i,meaning:'词'+i})),phrases=Array.from({length:9},(_,i)=>({phrase:'phrase '+i,meaning:'用法'+i}));
 const result=Support.forLesson(lesson,{writingTargets:{words,phrases}});
 assert.equal(result.words.length,12);assert.equal(result.usages.length,9);
 assert(result.properNames.some(row=>row.name==='New York'));
 assert(result.properNames.some(row=>row.name==='St. Paul’s Cathedral'));
 assert(result.properNames.some(row=>row.name==='London'));
 assert(!result.properNames.some(row=>/^(We|The|A)$/.test(row.name)));
 assert.deepEqual(result.nouns.map(row=>row.word),['guide','map']);
 assert.deepEqual(result.characters,[],'source names must not become guessed people');
 assert(result.properNames.every(row=>lesson.paragraphs.some(p=>p.en.includes(row.name))));
});
test('noun aids keep compact context-relevant meanings rather than dictionary verb senses used inside phrases',()=>{
 const lesson={id:'nouns',paragraphs:[{en:'He will set out in his little boat and take part in a race.'}],vocabulary:[{word:'boat',pos:'n.',meaning:'n. 船 vi. 乘船 vt. 以船运'},{word:'set',pos:'n.',meaning:'n. 日落, 同伙 vt. 放置 vi. 凝固'},{word:'part',pos:'n.',meaning:'n. 部分, 局部 vt. 分开'}]};
 const hints=Support.forLesson(lesson);assert.deepEqual(hints.nouns.map(row=>[row.word,row.meaning]),[['boat','船']]);
});
test('source names retain sentence-initial places, quoted titles and full initials without dialogue starters',()=>{
 const lesson={id:'complete-names',paragraphs:[{en:'London was cold. Paris was warm. Last Sunday I visited “The Globe” with R.E. Byrd. “May I come?” “Can I go?” “Certainly.” “It’s late.” “Dear me,” I said.'}]};
 const names=Support.forLesson(lesson).properNames.map(row=>row.name);
 for(const name of ['London','Paris','Sunday','The Globe','R.E. Byrd'])assert(names.includes(name),name);
 for(const name of ['Last Sunday I','May I','Can I','Certainly','It’s','Dear','R','I'])assert(!names.includes(name),name);
});
test('a lone capitalized word needs name evidence rather than only appearing at a sentence boundary',()=>{
 const lesson={id:'ordinary-openers',paragraphs:[{en:'Sit down here. Give me a book. Don’t drop it. Women always have the last word. Shut the door. Be careful. Hurry up. Ask him. Beef is ready. Let’s go. London was cold. Paris was warm.'}]};
 assert.deepEqual(Support.forLesson(lesson).properNames.map(row=>row.name),['London','Paris']);
});
test('explicit source name and place contexts retain unfamiliar accented names and small towns',()=>{
 const lesson={id:'context-names',paragraphs:[{en:'He was in Pinhurst with his aunt Aimé. Her painting was named Cézanne.'}]};
 assert.deepEqual(Support.forLesson(lesson).properNames.map(row=>row.name),['Pinhurst','Aimé','Cézanne']);
});

test('current target pronunciation uses the speech service without changing the five saved sentences',async()=>{
 const spoken=[],lesson={id:'listen',book:2,number:2,title:'Listening'},ui=new Writing({getLesson:()=>lesson,getTargets:()=>({words:[{word:'outside',meaning:'外面'}]}),speak:async(...args)=>spoken.push(args),saveDraft:()=>true});
 const target=ui.targets()[0];ui.editAnswer(target.key,0,'I waited outside.');
 assert.match(ui.render(),/data-free-action="speak"/);assert.match(ui.render(),/aria-label="听 outside 的发音"/);
 assert.equal(await ui.pronounceCurrentTarget(),true);assert.equal(spoken[0][0],'outside');
 assert.equal(ui.active.draft.targets[target.key].answers[0],'I waited outside.');
 assert.equal(ui.active.draft.targets[target.key].answers.length,5);
 const notices=[];ui.options.speak=async()=>{throw Error('unavailable');};ui.options.toast=m=>notices.push(m);
 assert.equal(await ui.pronounceCurrentTarget(),false);assert(notices.some(m=>/发音.*不可用/.test(m)));
 notices.length=0;ui.options.speak=async()=>{throw Object.assign(Error('paused'),{name:'AbortError'});};
 assert.equal(await ui.pronounceCurrentTarget(),false);assert.equal(notices.length,0,'normal audio cancellation must not look like a failure');
});
