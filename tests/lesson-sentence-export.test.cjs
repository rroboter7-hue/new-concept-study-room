const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=fs.existsSync(require('node:path').join(__dirname,'../lesson-sentence-export.js'))?require('../lesson-sentence-export.js'):{};
test('collect keeps exact lesson drafts, repeated intentional rows and source identities without mutation',()=>{
 assert.equal(typeof api.collect,'function');
 const input={lessonId:'now',freeWriting:{a:{lessonId:'now',targets:{word:{answers:['Same.','Same.']}}},b:{lessonId:'other',targets:{word:{answers:['Wrong lesson.']}}}},sentencePractice:{'v3:four:now:word%3Anow%3Abook':{answers:{affirmative:'A book.',negative:'No book.'}},'v1:other:word':{answers:{affirmative:'Wrong.'}}},sentenceBatches:{now:{mode:'free',rawText:'Batch one.\nBatch two.'},'imported-text':{rawText:'Unbound.'}},outputDrafts:{lessons:{now:{modes:{write:{answers:{0:'Dictation.'}},retell:{answer:'Retell.'},spell:{spellAnswers:{0:'book'}}}},other:{modes:{retell:{answer:'Wrong.'}}}}}};
 const before=JSON.stringify(input),rows=api.collect(input);
 assert.deepEqual(rows.map(row=>row.answer),['Same.','Same.','A book.','No book.','Batch one.','Batch two.','Dictation.','Retell.']);
 assert.equal(new Set(rows.map(row=>row.sourceId)).size,rows.length);assert.equal(JSON.stringify(input),before);
 const prompt=api.prompt({id:'now',book:2,number:3,title:'Today'},rows);
 assert.match(prompt,/豆包|人工/);assert.match(prompt,/语法/);assert.match(prompt,/自然度/);assert.match(prompt,/Retell\./);assert.match(prompt,/未.*成绩|不.*成绩/);assert.match(prompt,/旧版听写稿/);assert.match(prompt,/旧版复述稿/);
});
test('legacy bundle arrays remain lesson bound and preserve multiline learner text',()=>{
 assert.equal(typeof api.collect,'function');
 const rows=api.collect({lessonId:'now',sentencePractice:[{lessonId:'now',sourceKey:'bundle',targetKey:'word',answers:{affirmative:'First.\nSecond.'}},{lessonId:'other',sourceKey:'other',answers:{affirmative:'Other.'}}]});
 assert.equal(rows.length,1);assert.equal(rows[0].answer,'First.\nSecond.');
});
