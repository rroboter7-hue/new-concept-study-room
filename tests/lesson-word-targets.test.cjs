'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'..'),builderFile=path.join(root,'dev/build-lesson-word-targets.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function builder(){assert.ok(fs.existsSync(builderFile),'an offline first-occurrence word-target builder is required');return require(builderFile);}
function load(manifest){const c={};c.window=c;vm.createContext(c);vm.runInContext(builder().browserSource(manifest),c);return c.StudyLessonWordTargets;}
function fixture(){return [
  {id:'second-book',book:2,number:1,title:'Cats, RUN!',paragraphs:[{en:'A cat runs. Sherlock’s e-mail is new; inventedwordzz.'}],vocabulary:[{word:'runs',meaning:'跑（第三人称单数）',pos:'v.'}]},
  {id:'first-book',book:1,number:3,title:'A Cat',paragraphs:[{en:'THE cat runs; cat’s toy is blue.'}],vocabulary:[{word:'cat',meaning:'猫',pos:'n.',phonetic:'/kæt/'},{word:' cat ',meaning:'猫',legacy:'keep duplicate spelling'}, {word:'legacy phrase',meaning:'旧短语',conceptId:'old-key'},{word:'blue',meaning:'',pos:'adj.'}]},
  {id:'first-ever',book:1,number:1,title:'The Beginning',paragraphs:[{en:'The beginning. RUN, run!'}],vocabulary:[]}
];}
const dictionary={blue:{translation:'a. 蓝色的',phonetic:'blu:',definition:'a. of the color blue'},"sherlock's":{translation:'',definition:'A name only'},'e-mail':{translation:'n. 电子邮件',phonetic:'i:meil'}};

test('first occurrence follows book and lesson order and keeps exact forms, contractions, names and function words',()=>{
  const api=load(builder().createManifest(fixture(),dictionary));
  const keys=id=>Array.from(api.newWordsForLesson(fixture().find(l=>l.id===id)),row=>row.word.toLowerCase().replace(/’/g,"'").trim());
  assert.deepEqual(keys('first-ever'),['the','beginning','run']);
  assert.deepEqual(keys('first-book'),['cat','blue','a','runs',"cat's",'toy','is']);
  assert.deepEqual(keys('second-book'),['cats',"sherlock's",'e-mail','new','inventedwordzz']);
  assert.equal(api.newWordsForLesson(fixture()[0]).find(row=>row.word==='Sherlock’s').meaning,'释义待补充');
});

test('new targets prefer valid source vocabulary then local dictionary and retain unknown words with a missing-meaning flag',()=>{
  const lessons=fixture(),api=load(builder().createManifest(lessons,dictionary));
  const rows=Array.from(api.newWordsForLesson(lessons[1])),cat=rows.find(row=>row.word==='cat'),blue=rows.find(row=>row.word==='blue');
  assert.equal(cat.meaning,'猫');assert.equal(cat.phonetic,'/kæt/');
  assert.equal(blue.meaning,'a. 蓝色的');assert.equal(blue.meaningSource,'ECDICT');assert.equal(blue.meaningMissing,false);
  const unknown=api.newWordsForLesson(lessons[0]).find(row=>row.word==='inventedwordzz');
  assert.equal(unknown.meaning,'释义待补充');assert.equal(unknown.meaningMissing,true);assert.equal(unknown.pos,'');
  assert.equal(api.newWordsForLesson(lessons[0]).find(row=>row.word==='e-mail').pos,'n.');
});

test('abbreviation-only dictionary glosses require an actual uppercase source acronym and never replace valid course glosses',()=>{
  const acronymDictionary={tins:{translation:'abbr. 炮塔综合夜间瞄准镜（Turret Integrated Night Sight）',headword:'tins'},pots:{translation:'n. 罐；壶\nabbr. 一种系统'}};
  const ordinary={id:'ordinary',book:1,number:1,title:'',paragraphs:[{en:'Rusty tins and pots.'}],vocabulary:[]};
  const api=load(builder().createManifest([ordinary],acronymDictionary)),target=api.newWordsForLesson(ordinary).find(row=>row.word==='tins');
  assert.equal(target.meaning,'释义待补充');assert.equal(target.meaningMissing,true);assert.equal(target.meaningSource,'unavailable');
  assert.equal(api.newWordsForLesson(ordinary).find(row=>row.word==='pots').meaning,'n. 罐；壶\nabbr. 一种系统','mixed ordinary senses remain available');
  const acronym={...ordinary,id:'acronym',paragraphs:[{en:'TINS'}]},acronymApi=load(builder().createManifest([acronym],acronymDictionary));
  assert.equal(acronymApi.newWordsForLesson(acronym)[0].meaning,acronymDictionary.tins.translation);
  assert.equal(acronymApi.newWordsForLesson(acronym)[0].meaningMissing,false);
  const reviewed=[{word:'tins',meaning:'金属罐（已核对）',pos:'n.',reviewId:'course-review'}];
  const reviewedTarget=api.vocabularyForLesson(ordinary,reviewed)[0];assert.equal(reviewedTarget.meaning,'金属罐（已核对）');assert.equal(reviewedTarget.meaningMissing,false);
  const sourceReviewed={...ordinary,vocabulary:reviewed},sourceApi=load(builder().createManifest([sourceReviewed],acronymDictionary));
  assert.equal(sourceApi.newWordsForLesson(sourceReviewed).find(row=>row.word==='tins').meaning,'金属罐（已核对）');
});

test('an explicit standard-contraction set retains source-backed abbreviation glosses without accepting arbitrary apostrophe words',()=>{
  const lesson={id:'contractions',book:1,number:1,title:'',paragraphs:[{en:"I’m sure I can't use rusty tins or gizmo's."}],vocabulary:[]};
  const dictionary={"i'm":{translation:'abbr. 我是（I am）'},"can't":{translation:'abbr. 不能（cannot）'},tins:{translation:'abbr. 炮塔综合夜间瞄准镜'},"gizmo's":{translation:'abbr. 未经核对的缩写'}};
  const api=load(builder().createManifest([lesson],dictionary)),rows=Array.from(api.newWordsForLesson(lesson));
  for(const [word,meaning] of [['I’m','abbr. 我是（I am）'],["can't",'abbr. 不能（cannot）']]){
    const row=rows.find(row=>row.word===word);assert.equal(row.meaning,meaning);assert.equal(row.meaningMissing,false);
  }
  for(const word of ['tins',"gizmo's"]){const row=rows.find(row=>row.word===word);assert.equal(row.meaning,'释义待补充');assert.equal(row.meaningMissing,true);}
});

test('the exact Book 1 Lesson 9 Tony introduction uses its reviewed name sense while course glosses and other contexts stay authoritative',()=>{
  const lesson={id:'nce-b1-4be758-l009',book:1,number:9,title:'第9课 · How are you today?',paragraphs:[{en:'How is Tony?',zh:'托尼好吗？'}],vocabulary:[]};
  const dictionary={tony:{translation:'a. 高贵的, 时髦的',phonetic:"'tәuni",headword:'tony'}};
  const api=load(builder().createManifest([lesson],dictionary)),row=api.newWordsForLesson(lesson).find(row=>row.word==='Tony');
  assert.equal(row.meaning,'人名（Tony）');assert.equal(row.pos,'n.');assert.equal(row.meaningSource,'source-context-review');
  const reviewed=[{word:'Tony',meaning:'托尼（课内已复核）',pos:'n.',reviewId:'authoritative'}];
  assert.equal(api.vocabularyForLesson(lesson,reviewed)[0].meaning,'托尼（课内已复核）');
  const course={...lesson,vocabulary:reviewed},courseApi=load(builder().createManifest([course],dictionary));
  assert.equal(courseApi.newWordsForLesson(course).find(row=>row.word==='Tony').meaning,'托尼（课内已复核）');
  for(const changed of [{...lesson,id:'another-lesson'},{...lesson,paragraphs:[{en:'A tony restaurant.'}]}]){
    const alternate=load(builder().createManifest([changed],dictionary)).newWordsForLesson(changed).find(row=>row.word.toLowerCase()==='tony');
    assert.equal(alternate.meaning,'a. 高贵的, 时髦的');assert.equal(alternate.pos,'a.');
  }
});

test('merged vocabulary preserves legacy rows and keys while marking every matching original spelling and providing source context',()=>{
  const lessons=fixture(),before=plain(lessons),api=load(builder().createManifest(lessons,dictionary));
  const result=plain(api.vocabularyForLesson(lessons[1]));
  assert.deepEqual(result.slice(0,4).map(row=>row.word),['cat',' cat ','legacy phrase','blue']);
  assert.equal(result[1].legacy,'keep duplicate spelling');assert.equal(result[2].conceptId,'old-key');assert.equal(result[2].isLessonNew,false);
  assert.equal(result[0].isLessonNew,true);assert.equal(result[1].isLessonNew,true);
  assert.equal(result[0].sourceSentence,'A Cat');assert.equal(result[0].sourceLocation,'title');
  assert.equal(result.find(row=>row.word==='toy').sourceSentence,'THE cat runs; cat’s toy is blue.');
  assert.equal(result.find(row=>row.word==='toy').sourceLocation,'body');
  assert.equal(result.find(row=>row.word==='runs').meaning,'释义待补充','later lesson vocabulary must not silently define an earlier occurrence');
  assert.deepEqual(lessons,before);
});

test('source binding refuses stale additions and returned results cannot mutate later results, source lessons, or global state',()=>{
  const lessons=fixture(),api=load(builder().createManifest(lessons,dictionary)),before=plain(lessons);
  const rows=api.vocabularyForLesson(lessons[1]);rows[0].word='CHANGED';rows.push({word:'injected'});
  assert.equal(api.vocabularyForLesson(lessons[1])[0].word,'cat');assert.deepEqual(lessons,before);
  for(const lesson of [{...lessons[1],title:'An edited title'},{...lessons[1],paragraphs:[{en:'An edited passage.'}]},{...lessons[1],book:4}]){
    assert.equal(api.newWordsForLesson(lesson).length,0);assert.equal(api.vocabularyForLesson(lesson).length,4);
    assert.equal(api.statusForLesson(lesson).bound,false);
  }
  assert.equal(api.newWordsForLesson({id:'unknown',vocabulary:[]}).length,0);
  assert.equal(api.newWordsForLesson(null).length,0);
  assert.equal(api.statusForLesson(lessons[1]).bound,true);
});

test('source binding rejects missing paragraph slots and inherited paragraph or English properties',()=>{
  const lessons=fixture(),lesson=lessons[1],api=load(builder().createManifest(lessons,dictionary));
  const sparse=new Array(lesson.paragraphs.length),inheritedIndex=new Array(lesson.paragraphs.length);
  const prototype=Object.create(Array.prototype);prototype[0]=lesson.paragraphs[0];Object.setPrototypeOf(inheritedIndex,prototype);
  const inheritedEnglish=[Object.create({en:lesson.paragraphs[0].en})];
  for(const paragraphs of [sparse,inheritedIndex,inheritedEnglish]){
    const changed={...lesson,paragraphs};
    assert.equal(api.statusForLesson(changed).bound,false);
    assert.equal(api.newWordsForLesson(changed).length,0);
    assert.equal(api.vocabularyForLesson(changed).length,lesson.vocabulary.length);
    assert.ok(api.vocabularyForLesson(changed).every(row=>row.isLessonNew===false));
  }
  assert.equal(api.statusForLesson(lesson).bound,true);
});

test('reviewed vocabulary rows override raw glosses and keep their keys without dropping additional new passage words',()=>{
  const lessons=fixture(),api=load(builder().createManifest(lessons,dictionary));
  const reviewed=[{word:'cat',meaning:'猫科动物（已复核）',pos:'noun',conceptId:'reviewed-cat',audit:{status:'reviewed'}},{word:'legacy phrase',meaning:'旧短语（已复核）',conceptId:'reviewed-phrase'}],before=plain(reviewed);
  const rows=plain(api.vocabularyForLesson(lessons[1],reviewed));
  assert.equal(rows[0].meaning,'猫科动物（已复核）');assert.equal(rows[0].pos,'noun');assert.equal(rows[0].conceptId,'reviewed-cat');assert.equal(rows[0].isLessonNew,true);
  assert.equal(rows[1].conceptId,'reviewed-phrase');assert.equal(rows[1].isLessonNew,false);
  assert.ok(rows.some(row=>row.word==='toy'&&row.isLessonNew));assert.ok(rows.some(row=>row.word==='blue'&&row.isLessonNew));
  rows[0].audit.status='changed';assert.deepEqual(reviewed,before);assert.equal(api.vocabularyForLesson(lessons[1],reviewed)[0].audit.status,'reviewed');
});

test('a retained original review flag stays visible when its missing gloss is filled for a new-word target',()=>{
  const lessons=fixture(),api=load(builder().createManifest(lessons,dictionary));
  const reviewed=[{word:'blue',meaning:'待核释义',needsContextReview:true,reviewId:'pending-review'}],row=api.vocabularyForLesson(lessons[1],reviewed)[0];
  assert.equal(row.isLessonNew,true);assert.equal(row.meaning,'a. 蓝色的');assert.equal(row.needsContextReview,true);assert.equal(row.reviewId,'pending-review');
});

test('offline corpus extraction honors actual bootstrap patches and skips its own generated module',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lesson-word-targets-'));
  try{
    fs.writeFileSync(path.join(temp,'index.html'),'<script defer src="data.js?v=1"></script><script defer src="patch.js"></script><script defer src="lesson-word-targets.js"></script><script defer src="app.js"></script>');
    fs.writeFileSync(path.join(temp,'data.js'),`window.LESSONS=[{id:'fixture',book:1,number:1,title:'Start',paragraphs:[{en:'First.'}],vocabulary:[],metadata:'ignoremetoken'}];`);
    fs.writeFileSync(path.join(temp,'patch.js'),`window.LESSONS[0].paragraphs[0].en='The final e-mail.';`);
    fs.writeFileSync(path.join(temp,'lesson-word-targets.js'),'throw Error("must not execute generated output");');
    fs.writeFileSync(path.join(temp,'app.js'),'throw Error("must not execute app");');
    const corpus=builder().collectCorpus(temp),api=load(builder().createManifest(corpus.lessons,{}));
    assert.deepEqual(Array.from(api.newWordsForLesson(corpus.lessons[0]),row=>row.word),['Start','The','final','e-mail']);
    assert.deepEqual(corpus.inputs.map(row=>row.file),['data.js','patch.js']);
    assert.throws(()=>builder().createManifest([...fixture(),fixture()[0]],{}),/duplicate/i);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('offline builds are reproducible and reject modified dictionary source before overwriting a good artifact',()=>{
  const crypto=require('node:crypto'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lesson-word-targets-build-'));
  try{
    fs.mkdirSync(path.join(temp,'dictionary-data'));
    fs.copyFileSync(path.join(root,'lexical-word-tokens.js'),path.join(temp,'lexical-word-tokens.js'));
    fs.writeFileSync(path.join(temp,'index.html'),'<script defer src="lexical-word-tokens.js"></script><script defer src="data.js"></script><script defer src="lesson-word-targets.js"></script><script defer src="app.js"></script>');
    fs.writeFileSync(path.join(temp,'data.js'),`window.LESSONS=[{id:'fixture',book:1,number:1,title:'A',paragraphs:[{en:'A cat.'}],vocabulary:[]}];`);
    const shard=JSON.stringify({version:1,entries:{cat:{translation:'n. 猫',phonetic:'kæt',headword:'cat'}}}),license='MIT fixture license';
    fs.writeFileSync(path.join(temp,'dictionary-data','c.json'),shard);fs.writeFileSync(path.join(temp,'dictionary-data','LICENSE'),license);
    fs.writeFileSync(path.join(temp,'dictionary-data','source.json'),JSON.stringify({name:'ECDICT',commit:'fixture',license:{name:'MIT',sha256:sha(license)},shards:[{file:'c.json',sha256:sha(shard)}]}));
    const first=builder().buildLessonWordTargets({projectRoot:temp}),artifact=fs.readFileSync(path.join(temp,'lesson-word-targets.js'),'utf8');
    assert.equal(first.status.newWords,2);assert.equal(first.status.missingMeaning,1);
    const second=builder().buildLessonWordTargets({projectRoot:temp});
    assert.equal(fs.readFileSync(path.join(temp,'lesson-word-targets.js'),'utf8'),artifact);assert.deepEqual(second,first);
    fs.appendFileSync(path.join(temp,'dictionary-data','c.json'),' ');
    assert.throws(()=>builder().buildLessonWordTargets({projectRoot:temp}),/dictionary source mismatch/i);
    assert.equal(fs.readFileSync(path.join(temp,'lesson-word-targets.js'),'utf8'),artifact);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

function shipped(){
  const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);
  for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)){
    const file=m[1].split(/[?#]/)[0];if(file==='app.js')break;if(file==='lesson-word-targets.js')continue;
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
  }
  return c;
}
test('shipped data covers every first spelling in all 276 final title and body texts, including Book 3 Lesson 1 passage words',()=>{
  builder();const c=shipped(),before=JSON.stringify(c.LESSONS);
  assert.ok(fs.existsSync(path.join(root,'lesson-word-targets.js')),'the generated browser module must ship');
  vm.runInContext(fs.readFileSync(path.join(root,'lesson-word-targets.js'),'utf8'),c,{filename:'lesson-word-targets.js'});
  const lexer=require(path.join(root,'lexical-word-tokens.js')),api=c.StudyLessonWordTargets,lessons=Array.from(c.LESSONS).sort((a,b)=>a.book-b.book||a.number-b.number),seen=new Set(),activeSeen=new Set();
  assert.deepEqual([1,2,3,4].map(book=>lessons.filter(l=>l.book===book).length),[72,96,60,48]);
  for(const lesson of lessons){
    const expected=[];for(const text of [lesson.title,...lesson.paragraphs.map(p=>p.en)])for(const token of lexer.scan(text)){
      if(token.kind==='ordinal')continue;
      const key=token.surface.toLowerCase().replace(/’/g,"'");if(seen.has(key))continue;seen.add(key);
      if(lexer.isDottedSt(text,token))continue; // First literal St. consumes novelty in nonactive quarantine.
      expected.push(key);activeSeen.add(key);
    }
    const rows=Array.from(api.newWordsForLesson(lesson)),actual=[...new Set(rows.map(row=>row.word.trim().toLowerCase().replace(/’/g,"'")))];
    assert.deepEqual([...actual].sort(),[...expected].sort(),lesson.id);
    assert.equal(rows.length,actual.length,lesson.id+' new-word rows stay unique');
    for(const row of rows){assert.ok(row.meaning&&typeof row.pos==='string',lesson.id+' '+row.word);assert.equal(row.isLessonNew,true);
      assert.ok(row.sourceSentence&&(row.sourceLocation==='title'?lesson.title.includes(row.sourceSentence):lesson.paragraphs.some(p=>p.en.includes(row.sourceSentence))),lesson.id+' source '+row.word);
    }
  }
  const puma=lessons.find(l=>l.book===3&&l.number===1),targets=Array.from(api.newWordsForLesson(puma)),keys=targets.map(row=>row.word.toLowerCase());
  assert.ok(keys.includes('puma'));assert.ok(keys.includes('spotted'));assert.ok(keys.includes('pumas'));assert.ok(keys.includes('blackberries'));
  const tins=api.newWordsForLesson(lessons.find(l=>l.book===1&&l.number===143)).find(row=>row.word==='tins');
  assert.equal(tins.meaning,'释义待补充');assert.equal(tins.meaningMissing,true);assert.match(tins.sourceSentence,/rusty tins/);
  const tony=api.newWordsForLesson(lessons.find(l=>l.book===1&&l.number===9)).find(row=>row.word==='Tony');
  assert.equal(tony.meaning,'人名（Tony）');assert.equal(tony.pos,'n.');assert.equal(tony.sourceSentence,'How is Tony?');
  assert.equal(JSON.stringify(c.LESSONS),before,'the browser module must not patch LESSONS');
  assert.equal(api.status.lessons,276);assert.equal(api.status.newWords,activeSeen.size);
  assert.equal(api.status.quarantinedFirstOccurrences,seen.size-activeSeen.size);
  const common=require(path.join(root,'lesson-word-targets.js'));assert.equal(common.status.newWords,activeSeen.size);
});
