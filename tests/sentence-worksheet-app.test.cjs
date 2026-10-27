'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness}=require('./leo-coach-harness.cjs');

const lessonId='nce-b2-eef57c-l002';
const kinds=['affirmative','negative','yesno','wh'];
const originals={affirmative:'Anna is outside after lunch.',negative:'Anna is not outside after lunch.',yesno:'Is Anna outside after lunch?',wh:'When is Anna outside?'};
const plain=value=>JSON.parse(JSON.stringify(value));
async function change(h,selector,value){
 const target=h.document.querySelector(selector);assert(target,'change target exists: '+selector);
 target.value=value;for(const handler of h.document.listeners.change||[])await handler({target});await h.flush();
}
async function openWorksheet(loaded={}){
 const h=await harness({pilot:false,realOutput:true,loaded:{lastLesson:lessonId,...loaded}});
 h.document.body.classList.add('mls-book-workspace','mls-mobile');
 h.api.mobileShell.options.openOutputMode('sentences');await h.flush();return h;
}
async function fill(h,answers=originals){
 for(const kind of kinds)await h.input(`[data-sentence-input="answer"][data-sentence-kind="${kind}"]`,answers[kind]);
}
function sheet(h){return h.document.querySelector('#sentence-practice-content');}

test('actual mobile app has one unified four-form worksheet with phrase context and a folded route menu',async()=>{
 const h=await openWorksheet(),root=sheet(h);
 assert.equal(h.api.sentencePractice.active.draft.mode,'four');
 assert(root.querySelector('.sentence-worksheet'),'selected design has the unified worksheet root');
 assert.equal(root.querySelectorAll('textarea[data-sentence-input="answer"]').length,4);
 assert.equal(root.querySelectorAll('[data-sentence-select="target"]').length,1,'the visible context is the sole target selector');
 assert(root.querySelector('[data-sentence-select="sheet-phrase"]'),'phrase is selected within the same exercise');
 assert.equal(root.querySelectorAll('.sentence-writing-modes').length,0,'main exercise is not split into competing modes');
 const menu=root.querySelector('.sentence-sheet-menu');assert(menu);assert.equal(menu.getAttribute('open'),null);
 for(const action of ['check','copy-review','back'])assert(root.querySelector(`[data-sentence-action="${action}"]`));
 const output=h.document.querySelector('#output-content');
 assert.equal(output.querySelectorAll('.output-tabs').length,0,'mobile sheet does not repeat the outer mode toolbar');
 assert(root.querySelector('[data-sentence-action="navigate-mode"][data-sentence-mode="batch"]')?.closest('.sentence-sheet-menu'),'batch checking remains discoverable in More');
});

test('same worksheet can use a current phrase and an already learned earlier phrase without replacing its four answers or optional old words',async()=>{
 const earlierLessonId='nce-b2-eef57c-l001';
 const h=await openWorksheet({records:{[earlierLessonId]:{completed:true}}}),ui=h.api.sentencePractice;await fill(h);
 const current=ui.context.targets.find(item=>item.kind==='phrase'&&item.source.id===lessonId);assert(current);
 const oldWord=ui.wordBank().find(item=>item.category!=='phrase');assert(oldWord);
 ui.setOldSelection([oldWord.key]);
 await change(h,'[data-sentence-select="sheet-phrase"]',current.key);
 assert.deepEqual(plain(ui.active.draft.answers),{...originals,combined:''});
 assert(ui.selectedOldItems().some(item=>(item.label||item.phrase||item.word)===(current.word||current.phrase)),'current reviewed usage is retained as selected context');
 assert(ui.active.draft.selectedOldKeys.includes(oldWord.key));
 const restored=await openWorksheet(h.stored);
 assert.deepEqual(plain(restored.api.sentencePractice.active.draft.answers),{...originals,combined:''});
 assert(restored.api.sentencePractice.selectedOldItems().some(item=>(item.label||item.phrase||item.word)===(current.word||current.phrase)),'current phrase context survives a full app restoration');
 assert(restored.api.sentencePractice.active.draft.selectedOldKeys.includes(oldWord.key));
 const options=sheet(h).querySelector('[data-sentence-select="sheet-phrase"]').querySelectorAll('option');
 const currentText=(current.word||current.phrase).toLowerCase();
 const earlier=ui.wordBank().find(item=>item.category==='phrase'&&(item.label||item.phrase||item.word).toLowerCase()!==currentText&&options.some(option=>option.value===item.key));assert(earlier,'a different earlier learned phrase remains selectable');
 const earlierSources=[earlier.source,...(earlier.sources||[])].map(source=>source?.id);
 for(const alias of [earlier.key,...(earlier.aliases||[])]){const parts=alias.split(':');if(parts.length===3)earlierSources.push(decodeURIComponent(parts[1]));}
 assert(earlierSources.includes(earlierLessonId),'automatic old phrase comes from the exact lesson the fixture has studied');
 await change(h,'[data-sentence-select="sheet-phrase"]',earlier.key);
 assert(ui.selectedOldItems().some(item=>item.key===earlier.key));
 assert(ui.active.draft.selectedOldKeys.includes(oldWord.key));
 assert.deepEqual(plain(ui.active.draft.answers),{...originals,combined:''});
 await change(h,'[data-sentence-select="sheet-phrase"]','');
 assert.equal(ui.selectedOldItems().filter(item=>item.category==='phrase').length,0);
 assert(ui.active.draft.selectedOldKeys.includes(oldWord.key));
 assert.deepEqual(plain(ui.active.draft.answers),{...originals,combined:''});
});

test('unified phrase context reaches one copy and batch import while back navigation saves pending writing without grading',async()=>{
 const h=await openWorksheet(),ui=h.api.sentencePractice;const copies=[];
 h.c.navigator.clipboard={writeText:async text=>copies.push(text)};await fill(h);
 const phrase=ui.context.targets.find(item=>item.kind==='phrase'&&item.source.id===lessonId);assert(phrase);
 await change(h,'[data-sentence-select="sheet-phrase"]',phrase.key);
 const records=JSON.stringify(h.api.data.records),game=JSON.stringify(h.api.data.game),targetKey=ui.active.draft.targetKey,draftKey=ui.active.key;
 await h.click('[data-sentence-action="copy-review"]');
 assert.equal(copies.length,1);for(const kind of kinds)assert(copies[0].includes(originals[kind]));
 assert(copies[0].includes(phrase.word||phrase.phrase));
 await h.input('[data-sentence-input="answer"][data-sentence-kind="wh"]','Where is Anna outside?');
 await h.click('[data-sentence-action="back"]');
 assert.equal(h.api.activeTab,'reading');assert.equal(h.stored.sentencePractice[draftKey].answers.wh,'Where is Anna outside?');
 h.api.mobileShell.options.openOutputMode('sentences');await h.flush();
 assert.equal(ui.active.draft.targetKey,targetKey);assert.equal(ui.active.draft.answers.wh,'Where is Anna outside?');
 await h.click('[data-sentence-action="navigate-mode"][data-sentence-mode="batch"]');
 assert.equal(h.api.output.mode,'batch');await h.click('[data-batch-action="lesson"]');
 const parsed=h.api.batchPractice.parseCurrent();assert.equal(parsed.rows.length,4);
 for(const row of parsed.rows)assert((row.context.oldPhrases||[]).includes(phrase.word||phrase.phrase));
 assert.equal(JSON.stringify(h.api.data.records),records,'copy, navigation and export cannot grade the reader');
 assert.equal(JSON.stringify(h.api.data.game),game,'copy, navigation and export cannot award game credit');
});

test('native phrase daily round keeps its one-sentence semantics and never overwrites the four-form worksheet',async()=>{
 const h=await openWorksheet(),ui=h.api.sentencePractice;await fill(h);ui.flush();
 const fourKey=ui.active.key,phrase=ui.context.targets.find(item=>item.kind==='phrase'&&item.source.id===lessonId);assert(phrase);
 await h.api.openCoachTask({type:'sentences',lessonId,targetKey:phrase.key,target:phrase.word||phrase.phrase,kind:'phrase',sentenceMode:'phrase-writing',roundKey:'worksheet-phrase-day'});await h.flush();
 assert.equal(ui.active.draft.mode,'phrase');assert.equal(ui.active.draft.roundKey,'worksheet-phrase-day');
 assert.equal(sheet(h).querySelectorAll('textarea[data-sentence-input="answer"]').length,1);
 const phraseKey=ui.active.key;assert.notEqual(phraseKey,fourKey);
 await h.input('[data-sentence-input="answer"]','I '+(phrase.word||phrase.phrase)+' after lunch.');
 await h.click('[data-sentence-action="back"]');
 assert.equal(h.api.activeTab,'reading');assert.match(h.stored.sentencePractice[phraseKey].answers.affirmative,/after lunch/);
 assert.deepEqual(plain(h.stored.sentencePractice[fourKey].answers),{...originals,combined:''});
});


test('actual vocabulary bootstrap limits the worksheet to current new words and omits reviewed human names and titles',async()=>{
 const h=await harness({pilot:false,realOutput:true});
 // The shared lightweight harness omits optional vocabulary services. Load the
 // actual production source-title overlay and services, then use the real app
 // lesson selection path; no target data or production handlers are replaced.
 for(const file of ['book1-first10-catalogue.js','lesson-word-targets.js','person-name-targets.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),h.c,{filename:file});
 h.document.body.classList.add('mls-book-workspace','mls-mobile');
 await h.api.selectLesson('nce-b1-4be758-l005');await h.flush();h.api.mobileShell.options.openOutputMode('sentences');await h.flush();
 const ui=h.api.sentencePractice,choices=sheet(h).querySelector('[data-sentence-select="target"]').querySelectorAll('option');
 const eligible=ui.lessonTargets();assert(eligible.length>0);
 assert.equal(h.c.StudyLessonWordTargets.statusForLesson(h.api.current).bound,true,'actual lesson source matches the corpus novelty catalogue');
 assert(eligible.every(item=>item.source.id===h.api.current.id&&item.isLessonNew===true));
 for(const name of ['Sophie','Hans','Naoko','Luming','Xiaohui','Chang-woo','Blake','Dupont','Mr','Miss']){
  assert.equal(eligible.some(item=>item.word.toLowerCase()===name.toLowerCase()),false,name+' cannot be a new-word practice choice');
  assert.equal(choices.some(option=>option.value.endsWith(':'+encodeURIComponent(name.toLowerCase()))),false,name+' is absent from the selector');
 }
 assert(eligible.some(item=>item.word.toLowerCase()==='student'),'ordinary lesson vocabulary stays eligible');
 assert(eligible.some(item=>item.word.toLowerCase()==='french'),'capitalized useful nonperson vocabulary stays eligible');
 assert.equal(eligible.some(item=>item.word.toLowerCase()==='handbag'),false,'a prior lesson word is not repeated as this lesson target');
});


test('a reader imported lesson keeps its declared vocabulary and phrase worksheet despite lacking canonical novelty bindings',async()=>{
 const h=await harness({pilot:false,realOutput:true});
 for(const file of ['lesson-word-targets.js','person-name-targets.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),h.c,{filename:file});
 // Crypto is a browser boundary omitted by this lightweight harness. Restore a
 // real backup fixture through production parsing rather than replacing lessons.
 h.c.crypto={randomUUID:()=> 'worksheet-import-fixture'};
 const imported={id:'reader-worksheet-example',book:1,number:145,title:'Own sentence practice',paragraphs:[{en:'She looks for her book. There is a pen beside it.',zh:'她在找她的书。旁边有一支钢笔。'}],vocabulary:[{word:'book',meaning:'书'},{word:'pen',meaning:'钢笔'},{word:'Mr',meaning:'先生'}],usage:[{phrase:'look for',meaning:'寻找'}]};
 h.api.restoreBackup({data:{words:[],imported:[imported]}});
 h.document.body.classList.add('mls-book-workspace','mls-mobile');
 await h.api.selectLesson(imported.id);await h.flush();h.api.mobileShell.options.openOutputMode('sentences');await h.flush();
 assert.equal(h.api.current.id,imported.id);assert.equal(h.api.current.source,'imported');
 assert.equal(h.c.StudyLessonWordTargets.statusForLesson(h.api.current).bound,false,'authored lessons intentionally lack the canonical source binding');
 const genericRows=h.c.StudyLessonWordTargets.vocabularyForLesson(h.api.current,h.api.current.vocabulary);
 assert(genericRows.every(row=>row.isLessonNew===false),'the canonical service alone cannot declare novelty for an imported source');
 const ui=h.api.sentencePractice,targets=ui.lessonTargets();
 assert.deepEqual(Array.from(targets,item=>item.word),['book','pen'],'the reader declared vocabulary list remains usable');
 assert.equal(ui.target().word,'book');assert.equal(targets.some(item=>item.word==='Mr'),false,'exact address titles remain excluded');
 assert.equal(sheet(h).querySelectorAll('textarea[data-sentence-input="answer"]').length,4);
 const phrase=ui.context.targets.find(item=>item.kind==='phrase'&&item.word==='look for');assert(phrase);
 await change(h,'[data-sentence-select="sheet-phrase"]',phrase.key);
 const answers={affirmative:'She looks for her book.',negative:'She does not look for her book.',yesno:'Does she look for her book?',wh:'Where does she look for her book?'};await fill(h,answers);
 let copied='';h.c.navigator.clipboard={writeText:async text=>{copied=text;}};await h.click('[data-sentence-action="copy-review"]');
 for(const kind of kinds)assert(copied.includes(answers[kind]));assert(copied.includes('look for'));
 assert.equal(h.stored.sentencePractice[ui.active.key].answers.affirmative,answers.affirmative);
 assert.equal(h.api.data.records[imported.id]?.quizAttempts||0,0);
});


test('an imported backup row sharing a canonical id cannot disable canonical source-bound new-word filtering',async()=>{
 const h=await harness({pilot:false,realOutput:true});
 for(const file of ['book1-first10-catalogue.js','lesson-word-targets.js','person-name-targets.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),h.c,{filename:file});
 h.c.crypto={randomUUID:()=> 'worksheet-collision-fixture'};
 const shared='nce-b1-4be758-l005';
 h.api.restoreBackup({data:{words:[],imported:[{id:shared,book:1,number:145,title:'Imported duplicate id',paragraphs:[{en:'I read a book.'}],vocabulary:[{word:'book',meaning:'书'}]}]}});
 h.document.body.classList.add('mls-book-workspace','mls-mobile');
 await h.api.selectLesson(shared);await h.flush();h.api.mobileShell.options.openOutputMode('sentences');await h.flush();
 assert.notEqual(h.api.current.source,'imported','canonical object still owns the original route');
 assert.equal(h.c.StudyLessonWordTargets.statusForLesson(h.api.current).bound,true);
 const targets=h.api.sentencePractice.lessonTargets();assert(targets.length>0);
 assert(targets.every(item=>item.source.id===shared&&item.isLessonNew===true),'imported id membership alone cannot bypass canonical novelty');
 assert.equal(targets.some(item=>['sophie','mr','miss'].includes(item.word.toLowerCase())),false);
});
