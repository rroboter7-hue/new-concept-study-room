const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=path.resolve(__dirname,'../sentence-feedback.js');
const context={};context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../sentence-core.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../grammar-check.js'),'utf8'),context);
if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),context);
function check(sentence,options={}){assert.equal(typeof context.StudySentenceFeedback?.check,'function','finite sentence feedback API exists');return context.StudySentenceFeedback.check(sentence,options);}

test('correct affirmative, negative and question sentences freely mix without quotas or tense unification',()=>{
 for(const sentence of ['I bought a book yesterday.','I do not need this book.','Did you buy that book?','We will look at the book tomorrow.']){
  const result=check(sentence,{target:{word:'book'},fusionTargets:sentence.includes('look at')?[{phrase:'look at'}]:[]});
  assert.deepEqual(Array.from(result.issues),[],sentence);
  assert(result.reviewNeeded.length>0);
  assert.doesNotMatch(result.notice,/完全正确|已掌握|得分/);
 }
});

test('missing target words and explicitly selected fusion phrases are disclosed without rejecting supported inflections',()=>{
 const missing=check('I like music.',{target:{word:'book'}});
 assert(missing.issues.some(issue=>issue.type==='target'&&issue.message.includes('book')));
 assert(missing.reviewNeeded.some(note=>note.includes('book')));
 for(const [sentence,target] of [['I bought two books.',{word:'book'}],['They took part in the meeting.',{kind:'phrase',phrase:'take part in'}],['He looked after the cat.',{kind:'phrase',phrase:'take care of',matchedForm:'looked after',variants:['look after']}]]){
  assert.equal(check(sentence,{target}).issues.filter(issue=>issue.type==='target').length,0,sentence);
 }
 const fusion=check('I bought a book.',{target:{word:'book'},fusionTargets:[{kind:'phrase',phrase:'look at'}]});
 assert(fusion.issues.some(issue=>issue.type==='target'&&issue.message.includes('融合')&&issue.message.includes('look at')));
});

test('obvious closed-past time with have or go in one simple clause prompts tense review without silently changing tense',()=>{
 for(const [sentence,verb,past] of [['i have a private conversation yesterday','have','had'],['She has a conversation last night.','has','had'],['We go to school yesterday.','go','went'],['He goes home two days ago.','goes','went']]){
  const result=check(sentence);
  assert(result.issues.some(issue=>issue.type==='tense'&&issue.original===verb&&issue.replacement===past&&issue.confidence==='medium'),sentence);
  assert(result.reviewNeeded.some(note=>/过去|yesterday|last|ago/.test(note)),sentence);
  if(result.reference){assert(result.reference.includes(verb),sentence+' reference must not silently rewrite a context-dependent tense');assert(!/[\u3400-\u9fff]/.test(result.reference));}
  assert.match(result.notice,/局部|不是.*完整/);
 }
});

test('past-time review avoids subordinate clauses, reporting and present possession of a past-dated object',()=>{
 for(const sentence of ['I have a photo from yesterday.','I have a note she wrote yesterday.','I have a meeting that was arranged yesterday.','I have a reason because he called yesterday.','I know he said yesterday that I have a car.','I have a private conversation every day.','I had a private conversation yesterday.','I have had this book since yesterday.',"I have yesterday's newspaper."]){
  assert.equal(check(sentence).issues.filter(issue=>issue.rule==='closed-past-present-form').length,0,sentence);
 }
});

test('real local grammar issues are classified without calling grammar feedback complete proof',()=>{
 const result=check('She are interested on music.');
 assert(result.issues.some(issue=>issue.type==='tense'&&issue.replacement==='She is'));
 assert(result.issues.some(issue=>issue.type==='collocation'&&issue.replacement==='interested in'));
 assert(result.reviewNeeded.some(note=>/interested|搭配|语境/.test(note)));
 assert.match(result.reference,/She is/);
 assert.doesNotMatch(result.reference,/interested in/,'conditional medium-confidence changes must not silently enter reference');
});

test('sentence-initial lowercase, pronoun i and missing punctuation have positioned local references',()=>{
 const source='today i have a book',result=check(source);
 assert(result.issues.some(issue=>issue.type==='capitalization'&&issue.original==='t'));
 assert(result.issues.some(issue=>issue.type==='capitalization'&&issue.original==='i'));
 assert(result.issues.some(issue=>issue.type==='punctuation'));
 assert.equal(result.reference,'Today I have a book.');
 assert.equal(source,'today i have a book');
 for(const issue of result.issues.filter(issue=>Number.isInteger(issue.start)))assert.equal(source.slice(issue.start,issue.end),issue.original);
});

test('clear inverted questions get a conditional question-mark suggestion while echo questions remain allowed',()=>{
 const result=check('Did you buy a book.');
 assert(result.issues.some(issue=>issue.type==='punctuation'&&issue.replacement==='?'));
 assert(result.reviewNeeded.some(note=>/问|语境/.test(note)));
 for(const text of ['Do your best.','What a lovely book!','What I need is a book.','When I came home, she was reading.','You bought a book?'])assert.equal(check(text).issues.filter(issue=>issue.type==='punctuation').length,0,text);
});

test('common explicit typos are suggested but unknown words and proper names are left for review',()=>{
 const result=check('I recieve teh book from my freind.');
 assert.deepEqual(Array.from(result.issues.filter(issue=>issue.type==='spelling'),issue=>issue.replacement),['receive','the','friend']);
 for(const text of ['I met Teh and Freind yesterday.','Xochitl studies zeugma.','I use the iPhone app.','eBay is useful.','The variable i is an index.','She wrote "i" on the page.'])assert.equal(check(text).issues.length,0,text);
});

test('suspected spelling is restricted to target or fusion tokens and stays explicitly uncertain',()=>{
 const result=check('I walk to the staion and read a boook.',{target:{word:'book'},fusionTargets:[{phrase:'go to the station'}]});
 assert(result.issues.some(issue=>issue.type==='spelling'&&issue.original==='boook'&&issue.replacement==='book'));
 const swapped=check('I go to the staiton.',{target:{word:'station'}});
 assert(swapped.issues.some(issue=>issue.type==='spelling'&&issue.original==='staiton'&&issue.confidence==='medium'));
 assert(swapped.reviewNeeded.some(note=>/拼写|疑似/.test(note)));
 assert.equal(check('I like staiton.').issues.length,0,'an unrelated unknown word is not a dictionary error');
 for(const [word,sentence]of [['book','I cook dinner.'],['coast','I eat toast.'],['dessert','The desert is hot.'],['station','Staiton is my surname.']])assert.equal(check(sentence,{target:{word}}).issues.filter(issue=>issue.type==='spelling').length,0,sentence);
 assert.equal(check('I go to the staiton.',{target:{word:'station'},knownWords:['staiton']}).issues.filter(issue=>issue.type==='spelling').length,0,'explicitly known words are not typo candidates');
});

test('oversize input declares exactly the checked range and never pretends the whole text was checked',()=>{
 const source='I have a book. '.repeat(1000)+'i recieve teh book';
 const result=check(source);
 assert.equal(result.incomplete,true);
 assert(result.checkedLength<source.length);
 assert.equal(result.sourceLength,source.length);
 assert.match(result.notice,/仅检查|未完成/);
 assert(result.reviewNeeded.some(note=>/范围|其余|超出/.test(note)));
 assert.equal(result.reference,undefined,'a truncated excerpt cannot be presented as a full corrected sentence');
 assert.equal(result.issues.some(issue=>issue.original==='recieve'),false,'unchecked tail must remain unchecked');
});

test('unavailable grammar checking remains visible without destroying other useful local suggestions',()=>{
 const result=check('i have a book',{grammarCheck:()=>{throw Error('offline rule failure');}});
 assert(result.reviewNeeded.some(note=>/语法.*未完成|语法.*不可用/.test(note)));
 assert.equal(result.incomplete,true);
 assert(result.issues.some(issue=>issue.type==='capitalization'));
 assert.equal(result.reference,'I have a book.');
});

test('the CommonJS helper runs without a DOM and never evaluates input markup',()=>{
 assert(fs.existsSync(file),'new helper exists');
 const api=require(file),result=api.check('<img src=x onerror=alert(1)>',{grammarCheck:()=>[]});
 assert.equal(typeof api.check,'function');
 assert.equal(typeof result.notice,'string');
 assert.doesNotMatch(result.notice,/<img/);
});
