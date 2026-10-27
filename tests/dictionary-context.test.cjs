'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function course() {
  const scope = {}; scope.window = scope; vm.createContext(scope);
  for (const file of ['curriculum.js','textbook-lessons.js','book1-first10-lessons.js','book1-complete-lessons.js','book2-lessons.js','book2-translations.js','phrase-library.js','book2-learning-support.js','book2-vocabulary.js','book2-source-spelling-fixes.js','book2-additional-context-fixes.js','book2-quality-support.js','book2-reviewed-context-vocabulary.js','book2-reviewed-questions.js','study-knowledge.js','knowledge-bootstrap.js','book3-lessons.js','book4-lessons.js','glossary.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope, {filename:file});
  }
  return scope;
}
const corpus = course();
const lesson = (book, number) => corpus.LESSONS.find(item => item.book === book && item.number === number);
// Before the resolver exists, exercise the actual shipped dictionary() so the
// first red run proves the semantic regression, rather than a missing import.
const modulePath = path.join(root, 'dictionary-context.js');
const resolver = fs.existsSync(modulePath) ? require(modulePath) : {
  resolve(word, options) {
    const scope = {window:corpus,current:options.lesson,view:'study',lessons:corpus.LESSONS};
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    vm.createContext(scope);
    vm.runInContext(app.slice(app.indexOf(' function dictionary(word)'), app.indexOf(' function wordHTML(')), scope);
    return scope.dictionary(word) || {};
  }
};
function resolve(word, current, extra = {}) {
  return resolver.resolve(word, {lesson:current,bank:corpus.StudyKnowledge.bank,glossary:corpus.STUDY_GLOSSARY,...extra});
}

test('may in the fossil passage expresses possibility rather than another lesson grammar heading', () => {
  const value = resolve('may', lesson(4,1));
  assert.equal(value.meaning, '可能；也许');
  assert.match(value.example, /They may also have used wood and skins/);
  assert.equal(value.sourceLessonId, lesson(4,1).id);
  assert.equal(value.exampleSourceType, 'lesson-passage');
});
test('live in the spider passage means survival and carries that passage evidence', () => {
  const value = resolve('live', lesson(4,2));
  assert.equal(value.meaning, '生存；活着');
  assert.match(value.example, /impossible for us to live in the world/);
  assert.doesNotMatch(value.meaning, /国家城市/);
});
test('moving an elbow uses the action sense rather than the lantern-scene adjective', () => {
  const value = resolve('moving', lesson(4,4));
  assert.equal(value.meaning, '移动（move 的现在分词）');
  assert.equal(value.lemma, 'move');
  assert.match(value.example, /by moving her elbow/);
  assert.doesNotMatch(value.meaning, /感人/);
});
test('youth future and turn have their own paragraph sources rather than a different lesson title', () => {
  const future = resolve('future', lesson(4,5)), turn = resolve('turn', lesson(4,5));
  assert.equal(future.meaning, '前途；未来');
  assert.match(future.example, /glorious future/);
  assert.equal(turn.meaning, '求助；转而依靠（turn to）');
  assert.match(turn.example, /turn for protection to/);
  for (const value of [future,turn]) {
    assert.equal(value.sourceLessonId, lesson(4,5).id);
    assert.equal(value.exampleSourceType, 'lesson-passage');
    assert.doesNotMatch(value.sourceLabel || '', /标题/);
  }
});
test('a missing current entry stays unresolved instead of borrowing any other lesson vocabulary', () => {
  const value = resolve('bright', lesson(4,1));
  assert.equal(value.meaning || '', '');
  assert.equal(value.meaningKind, 'unresolved');
});
test('grammar headings and incomplete note fragments are not accepted as Chinese word glosses', () => {
  for (const meaning of ['现在完成时','国家城市','本课词义暂待复核','比较级和最高级','动词不定式','含有宾语的句子','对……','n.','见上文']) {
    const current = {id:'notes',vocabulary:[{word:'may',meaning}]};
    assert.equal(resolve('may', current).meaning || '', '', meaning);
  }
  assert.equal(resolve('walk', {id:'notes',vocabulary:[{word:'walk',meaning:'行走；散步',pos:'v.'}]}).meaning, '行走；散步');
});
test('reviewed Book 2 bright, title meanings, and source forms remain authoritative', () => {
  assert.equal(resolve('bright', lesson(2,17)).meaning, '鲜艳的');
  const turn = resolve('turn', lesson(2,11));
  assert.equal(turn.meaning, '善行；帮助');
  assert.equal(turn.example, 'One good turn deserves another');
  assert.equal(resolve('future', lesson(2,60)).exampleSourceType, 'lesson-title');
  const current = {id:'bound',title:'A place',paragraphs:[{en:'The pumas were spotted nearby.'}],vocabulary:[{
    word:'spot',meaning:'发现',phonetic:'/spɒt/',sourceLessonId:'bound',sourceForms:['spotted'],
    contextEvidence:{sourceType:'lesson-passage',sourceParagraphIndex:0,sourceText:'The pumas were spotted nearby.',matchedForms:['spotted']}
  }]};
  const value = resolve('spotted',current);
  assert.equal(value.meaning,'发现'); assert.equal(value.lemma,'spot');
  assert.equal(value.sourceFormMatched,true); assert.equal(value.phonetic,'');
});
test('reviewed lexical headwords remain available when their source uses an inflected form', () => {
  for (const [number,word,meaning] of [[2,'ring','（铃、电话等）响'],[4,'find','觉得；认为'],[26,'critic','评论家'],[29,'desert','废弃；遗弃'],[47,'suggest','提出（某种解释）'],[76,'fool','愚人；傻瓜'],[83,'ex-','前任的；以前的（前缀）']]) {
    assert.equal(resolve(word,lesson(2,number)).meaning,meaning,word);
  }
  const critics = resolve('critics',lesson(2,26));
  assert.equal(critics.meaning,'评论家'); assert.equal(critics.lemma,'critic');
  const fools = resolve('Fools’',lesson(2,76));
  assert.equal(fools.meaning,'愚人；傻瓜'); assert.equal(fools.lemma,'fool');
});
test('contextual overrides fail closed when the actual passage or source metadata has drifted', () => {
  const original = lesson(4,1);
  for (const current of [
    {...original,paragraphs:original.paragraphs.map(p=>({...p,en:p.en.replace('They may also have used wood and skins','They used a different material')}))},
    {...original,textbook:{...original.textbook,sourceSha256:'wrong-source'}},
    {...original,textbook:{...original.textbook,title:'Another title'}}
  ]) assert.equal(resolve('may',current).meaning || '', '');
});
test('a foreign source cannot pass as this lesson even when stored inside its vocabulary or glossary', () => {
  const foreign = {word:'turn',meaning:'善行；帮助',sourceLessonId:'other',sourceLabel:'本课标题词汇',example:'One good turn deserves another',exampleSourceType:'lesson-title'};
  assert.equal(resolve('turn',{id:'current',title:'Youth',vocabulary:[foreign]},{glossary:{turn:foreign}}).meaning || '', '');
  const changed = {id:'current',title:'New title',vocabulary:[{...foreign,sourceLessonId:'current',contextEvidence:{sourceType:'lesson-title',sourceTitle:'Old title'}}]};
  assert.equal(resolve('turn',changed).meaning || '', '');
});
test('legacy saved Chinese remains available as unverified history and never prevents a dictionary correction', () => {
  const saved = {word:'live',meaning:'国家城市',lessonId:'other',sourceLabel:'本课标题词汇',example:'A different lesson',note:'Keep my note',mastered:true};
  const value = resolve('live',{id:'current',vocabulary:[]},{saved});
  assert.equal(value.meaning || '', '');
  assert.equal(value.legacyMeaning,'国家城市');
  assert.equal(value.meaningKind,'unresolved');
  assert.equal(value.sourceLabel || '', '');
  const legacy = resolve('walk',{id:'current',vocabulary:[]},{saved:{word:'walk',meaning:'行走',lessonId:'other',example:'Other example',sourceLabel:'本课正文'}});
  assert.equal(legacy.meaning,'行走');
  assert.equal(legacy.meaningKind,'saved-unverified');
  assert.equal(legacy.example || '', '');
  assert.equal(resolver.needsDictionaryFallback(legacy),true);
  assert.equal(saved.meaning,'国家城市'); assert.equal(saved.note,'Keep my note'); assert.equal(saved.mastered,true);
});
test('dictionary results replace unverified saved meanings but cannot replace a validated lesson meaning', () => {
  const entry = {word:'live',headword:'live',translation:'v. 活着；生存',pos:'v.',definition:'To be alive.',sourceName:'ECDICT'};
  const incoming = resolver.fromDictionary(entry);
  assert.equal(incoming.meaning,'v. 活着；生存');
  assert.equal(incoming.translationSource,'ECDICT');
  assert.equal(incoming.meaningKind,'dictionary');
  const old = resolve('live',{id:'current',vocabulary:[]},{saved:{word:'live',meaning:'居住',lessonId:'other'}});
  assert.equal(resolver.canReplaceMeaning(old,incoming),true);
  assert.equal(resolver.canReplaceMeaning(resolve('live',lesson(4,2)),incoming),false);
  assert.equal(resolver.needsDictionaryFallback(resolve('bright',lesson(2,17))),false);
});
