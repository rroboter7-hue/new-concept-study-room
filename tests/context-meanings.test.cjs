'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),builder=require('../dev/build-lesson-word-targets.cjs'),resolver=require('../dictionary-context.js');
const lessons=builder.collectCorpus().lessons;
const dictionary=Object.assign({},...fs.readdirSync(path.join(root,'dictionary-data')).filter(f=>/^[a-z]\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(root,'dictionary-data',f),'utf8')).entries));
const at=(book,number)=>lessons.find(l=>l.book===book&&l.number===number);
const cases=[
  [1,7,'Robert','罗伯特（人名）'],[1,39,'Sam','萨姆（人名）'],[1,39,'flowers','花（flower 的复数）'],
  [2,7,'diamonds','钻石（diamond 的复数）'],[3,1,'Pumas','美洲狮（puma 的复数）'],
  [3,1,'forty-five','四十五'],[3,1,'cornered','被逼入困境；走投无路'],[4,48,'aims','目标；目的（aim 的复数）']
];

const pumaVerbCases=[
  ['spotted','被发现；被看见（spot 的过去分词）','a wild puma had been spotted forty-five miles south of London'],
  ['confirmed','证实；确认（confirm 的过去式）','experts confirmed that a puma will not attack a human being unless it is cornered'],
  ['observed','被看见；被观察到（observe 的过去分词）','the puma was often observed at one place in the morning'],
  ['clinging','附着；挂着（cling 的现在分词）','puma fur was found clinging to bushes']
];
for(const [word,meaning,evidence] of pumaVerbCases)test('Book 3 Lesson 1 '+word+' uses its passage verb sense instead of an adjective gloss',()=>{
  const lesson=at(3,1),api=require('../context-meanings.js');
  const target=builder.createManifest(lessons,dictionary).lessons.find(row=>row.id===lesson.id).targets.find(row=>row.word===word);
  assert.equal(target.meaning,meaning);assert.equal(target.pos,'v.');assert.equal(target.meaningSource,'source-context-review');
  const entry=resolver.resolve(word,{lesson});
  assert.equal(entry.meaning,meaning);assert.equal(entry.pos,'v.');assert.equal(entry.meaningProvenance.kind,'self-authored-context');
  assert.ok(entry.example.includes(evidence));
  const changed={...lesson,paragraphs:lesson.paragraphs.map((p,i)=>i?{...p}:{...p,en:p.en+' '})};
  assert.equal(api.forLesson(changed,word),null);assert.equal(api.forLesson(at(3,2),word),null);
});

test('confirmed ordinary/name meanings take priority over misleading generic senses in compiled targets',()=>{
  const manifest=builder.createManifest(lessons,dictionary);
  for(const [book,number,word,want] of cases){
    const target=manifest.lessons.find(l=>l.id===at(book,number).id).targets.find(t=>t.word.toLowerCase()===word.toLowerCase());
    assert.equal(target.meaning,want,word);assert.equal(target.meaningSource,'source-context-review');
    assert.equal(target.meaningProvenance.kind,'self-authored-context');
  }
});

test('all previously missing first spellings receive explicit source-bound definitions without dropping targets or legacy keys',()=>{
  const current=require('../lesson-word-targets.js'),manifest=builder.createManifest(lessons,dictionary);
  assert.equal(manifest.status.newWords,current.status.newWords);
  assert.equal(manifest.status.missingMeaning,0);
  for(const l of lessons){
    const compiled=manifest.lessons.find(row=>row.id===l.id);
    const key=word=>word.trim().replace(/[‘’]/g,"'").toLowerCase();
    assert.deepEqual(compiled.targets.map(t=>key(t.word)).sort(),Array.from(current.newWordsForLesson(l),t=>key(t.word)).sort(),l.id);
    for(const old of current.newWordsForLesson(l).filter(t=>t.meaningMissing)){
      const row=compiled.targets.find(t=>t.word===old.word);
      assert.equal(row.meaningSource,'source-context-review',l.id+' '+old.word);
      assert.match(row.meaningProvenance.sourceBindingSha256,/^[a-f0-9]{64}$/);
    }
  }
});

test('dictionary lookup shares contextual corrections and keeps ordinary generic fallback distinguishable',()=>{
  for(const [book,number,word,want] of cases){
    const value=resolver.resolve(word,{lesson:at(book,number)});
    assert.equal(value.meaning,want,word);assert.equal(value.meaningKind,'lesson');
    assert.equal(value.meaningProvenance.kind,'self-authored-context');
    assert.match(value.sourceLabel,/自编.*语境/);
  }
  const generic=resolver.fromDictionary({word:'unreviewed',translation:'未经本课核对的通用词义',sourceName:'ECDICT'});
  assert.equal(generic.meaningKind,'dictionary');assert.match(generic.sourceLabel,/未按本课语境筛选/);
});

test('complete literal title/body and source identity binding prevents stale or foreign corrections',()=>{
  const file=path.join(root,'context-meanings.js');assert.ok(fs.existsSync(file),'the reusable source-bound context helper must exist');
  const api=require(file),l=at(3,1),before=JSON.stringify(l);
  const good=api.forLesson(l,'CORNERED');assert.equal(good.meaning,'被逼入困境；走投无路');
  for(const changed of [
    {...l,id:'different'}, {...l,book:4}, {...l,number:2}, {...l,title:l.title+' '},
    {...l,paragraphs:l.paragraphs.map((p,i)=>i?{...p}:{...p,en:p.en+' '})},
    {...l,textbook:{...l.textbook,sourceUrl:'other.pdf'}},
    {...l,paragraphs:new Array(l.paragraphs.length)}
  ])assert.equal(api.forLesson(changed,'cornered'),null);
  good.meaning='changed';assert.equal(api.forLesson(l,'cornered').meaning,'被逼入困境；走投无路');
  assert.equal(api.forLesson(at(3,2),'cornered'),null);assert.equal(api.forLesson(l,'unknown'),null);
  assert.equal(JSON.stringify(l),before);
});

test('browser helper supports exact source apostrophe queries and discloses ASCII fragments without changing draft words',()=>{
  const file=path.join(root,'context-meanings.js');assert.ok(fs.existsSync(file));
  const scope={};scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(file,'utf8'),scope);
  assert.match(scope.StudyContextMeanings.forLesson(at(1,7),"name's").meaning,/name is/);
  assert.match(scope.StudyContextMeanings.forLesson(at(3,7),'fianc').meaning,/fiancé.*片段/);
  assert.equal(scope.StudyContextMeanings.forLesson(at(3,7),'fianc').word,'fianc');
});

test('a copied reviewed row cannot bypass whole-source binding by retaining its old matching excerpt',()=>{
  const api=require('../context-meanings.js'),l=at(3,1),correction=api.forLesson(l,'cornered');
  const changed={...l,paragraphs:l.paragraphs.map((p,i)=>i?{...p}:{...p,en:p.en+' '}) ,vocabulary:[correction]};
  const value=resolver.resolve('cornered',{lesson:changed});
  assert.equal(value.meaningKind,'unresolved');assert.equal(value.meaning,'');
});

test('compiled generic dictionary rows stay explicitly unreviewed when a consumer merges them into lesson vocabulary',()=>{
  const l=at(3,1),manifest=builder.createManifest(lessons,dictionary),row=manifest.lessons.find(r=>r.id===l.id).targets.find(r=>r.word==='blackberries');
  assert.equal(row.meaningSource,'ECDICT');
  const value=resolver.resolve('blackberries',{lesson:{...l,vocabulary:[row]}});
  assert.equal(value.meaningKind,'dictionary');assert.match(value.sourceLabel,/未按本课语境筛选/);
  const scope={};scope.window=scope;vm.createContext(scope);vm.runInContext(builder.browserSource(manifest),scope);
  const merged=scope.StudyLessonWordTargets.vocabularyForLesson(l,[row]).find(r=>r.word==='blackberries');
  assert.equal(merged.meaningSource,'ECDICT');
});

test('Apple names a computer and Stilton names the location of the boxing match',()=>{
  const api=require('../context-meanings.js');
  assert.equal(api.forLesson(at(3,51),'Apple').meaning,'苹果牌计算机（本课计算机名称）');
  assert.match(api.forLesson(at(3,51),'Apple').example,/a machine called an Apple/);
  assert.equal(api.forLesson(at(3,21),'Stilton').meaning,'斯蒂尔顿（本课拳击比赛举办地）');
  assert.match(api.forLesson(at(3,21),'Stilton').example,/A match was held at Stilton/);
});

function runtime(manifest){const scope={};scope.window=scope;vm.createContext(scope);vm.runInContext(builder.browserSource(manifest),scope);return scope.StudyLessonWordTargets;}
test('generated reviewed targets reject drift in their reviewed textbook source identity',()=>{
  const l=at(3,1),api=runtime(builder.createManifest([l],dictionary));
  assert.equal(api.newWordsForLesson(l).find(r=>r.word==='cornered').meaning,'被逼入困境；走投无路');
  for(const textbook of [undefined,{...l.textbook,sourceUrl:'other.pdf'},{...l.textbook,sourcePdfPage:l.textbook.sourcePdfPage+1}]){
    const changed={...l,textbook};
    assert.equal(api.statusForLesson(changed).bound,false);
    assert.equal(api.newWordsForLesson(changed).length,0);
  }
});

test('copied stale helper meanings cannot become authoritative original vocabulary during compilation or merging',()=>{
  const l=at(3,1),helper=require('../context-meanings.js'),copied={...helper.forLesson(l,'cornered'),conceptId:'preserve-me',note:'my note'};
  const changed={...l,textbook:{...l.textbook,sourceUrl:'other.pdf'},vocabulary:[copied]};
  const changedManifest=builder.createManifest([changed],dictionary),compiled=changedManifest.lessons[0].targets.find(r=>r.word==='cornered');
  assert.equal(compiled.meaningSource,'ECDICT');assert.notEqual(compiled.meaning,copied.meaning);
  const currentApi=runtime(builder.createManifest([l],dictionary)),stale=currentApi.vocabularyForLesson(changed)[0];
  assert.equal(stale.meaningMissing,true);assert.notEqual(stale.meaning,copied.meaning);
  assert.equal(stale.legacyMeaning,copied.meaning);assert.equal(stale.conceptId,'preserve-me');assert.equal(stale.note,'my note');
  assert.notEqual(stale.meaningProvenance?.kind,'self-authored-context');
  const fresh=currentApi.vocabularyForLesson(l,[copied]).find(r=>r.word==='cornered');
  assert.equal(fresh.meaningSource,'source-context-review');assert.equal(fresh.meaningProvenance.kind,'self-authored-context');
  const recompiled=runtime(changedManifest).vocabularyForLesson(changed)[0];
  assert.equal(recompiled.meaningSource,'ECDICT');assert.equal(recompiled.legacyMeaning,copied.meaning);
  const incomplete={...copied,meaningProvenance:{...copied.meaningProvenance,sourceIdentity:{}}};
  const fromIncomplete=runtime(changedManifest).vocabularyForLesson(changed,[incomplete])[0];
  assert.equal(fromIncomplete.meaningSource,'ECDICT');assert.notEqual(fromIncomplete.meaning,copied.meaning);
  assert.equal(changed.vocabulary[0].meaning,copied.meaning,'source rows remain untouched');
});

test('editing copied reviewed meaning or part of speech keeps the edit unverified and uses the authoritative current definition',()=>{
  const l=at(3,1),helper=require('../context-meanings.js'),canonical=helper.forLesson(l,'cornered'),api=runtime(builder.createManifest([l],dictionary));
  for(const edit of [{meaning:'测试不可信的释义'},{pos:'n.'}]){
    const copied={...canonical,...edit,conceptId:'keep-concept',note:'keep note'},before=JSON.stringify(copied);
    const row=api.vocabularyForLesson(l,[copied]).find(r=>r.word==='cornered');
    assert.equal(row.meaning,canonical.meaning);assert.equal(row.pos,canonical.pos);
    assert.equal(row.meaningSource,'source-context-review');assert.equal(row.meaningProvenance.kind,'self-authored-context');
    assert.equal(row.legacyMeaning,copied.meaning);assert.equal(row.legacyPos,copied.pos);
    assert.equal(row.conceptId,'keep-concept');assert.equal(row.note,'keep note');assert.equal(JSON.stringify(copied),before);
    const compiled=builder.createManifest([{...l,vocabulary:[copied]}],dictionary).lessons[0].targets.find(r=>r.word==='cornered');
    assert.equal(compiled.meaning,canonical.meaning);assert.equal(compiled.pos,canonical.pos);
  }
});

test('reviewed copied words that are not new in the lesson still validate against their explicit current definitions',()=>{
  const l=at(2,74),helper=require('../context-meanings.js'),canonical=helper.forLesson(l,'Merlin'),api=runtime(builder.createManifest(lessons,dictionary));
  const current=api.vocabularyForLesson(l,[canonical]).find(r=>r.word==='merlin');
  assert.equal(current.meaning,canonical.meaning);assert.equal(current.meaningSource,'source-context-review');
  const changed=api.vocabularyForLesson(l,[{...canonical,meaning:'不可信的编辑',note:'keep'}]).find(r=>r.word==='merlin');
  assert.notEqual(changed.meaning,'不可信的编辑');assert.equal(changed.legacyMeaning,'不可信的编辑');assert.equal(changed.note,'keep');
});
