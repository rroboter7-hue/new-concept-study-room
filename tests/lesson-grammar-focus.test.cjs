const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'lesson-grammar-focus.js');
const focus=fs.existsSync(target)?require(target):{};

function fixture(){
 const lesson={id:'fixture-lesson',paragraphs:[{en:'She’s sitting under the tree. She is reading a book.'}]};
 const point={title:'现在进行时',summary:'is加动词-ing说明她此刻正在树下坐着。',example:'She’s sitting under the tree.',pitfall:'sit要双写t再加-ing，不能漏掉表示进行的is。'};
 return {lesson,point,catalog:{[lesson.id]:{points:[point]}}};
}
function registry(catalog){assert.equal(typeof focus.create,'function');return focus.create([catalog]);}
function rejected(catalog,lesson){
 const result=registry(catalog).forLesson(lesson);
 assert.equal(result?.status,'needs-review');
 assert.deepEqual(result.points,[],'invalid authored content must not leak partial or generic points');
 assert.ok(Array.isArray(result.errors)&&result.errors.length,'review state explains the validation failure');
 return result;
}

test('exports the registry factory and a default registry backed by all four books',()=>{
 assert.equal(typeof focus.create,'function');
 assert.equal(typeof focus.forLesson,'function');
 assert.equal(typeof focus.hasLesson,'function');
 assert.equal(typeof focus.lessonIds,'function');
 assert.equal(focus.lessonIds().length,276);
 assert.equal(focus.hasLesson('nce-b1-4be758-l001'),true);
 assert.equal(focus.hasLesson('nce-nativeears-b4-l048'),true);
});

test('returns validated authored points with their exact spelling and punctuation',()=>{
 const {lesson,point,catalog}=fixture();
 assert.deepEqual(registry(catalog).forLesson(lesson),{status:'ready',points:[point]});
});

test('distinguishes an unknown lesson from an invalid registered entry',()=>{
 const {lesson,catalog}=fixture(),r=registry(catalog);
 assert.equal(r.forLesson({id:'unknown',paragraphs:lesson.paragraphs}),null);
 assert.equal(r.forLesson(null),null);
 assert.equal(r.forLesson({}),null);
 assert.equal(r.hasLesson('__proto__'),false);
 assert.equal(r.hasLesson(lesson.id),true);
 rejected({[lesson.id]:undefined},lesson);
});

test('rejects missing, empty or excessive point lists instead of falling back',()=>{
 const {lesson,point}=fixture();
 for(const entry of [null,{}, {points:null}, {points:[]}, {points:[point,point,point,point]}]){
  rejected({[lesson.id]:entry},lesson);
 }
});

test('requires every point field and fails the complete lesson when one point is invalid',()=>{
 const {lesson,point}=fixture();
 for(const field of ['title','summary','example','pitfall']){
  const bad={...point,[field]:'   '};
  rejected({[lesson.id]:{points:[{...point,title:'另一个有效重点'},bad]}},lesson);
 }
 rejected({[lesson.id]:{points:[null]}},lesson);
});

test('rejects sparse point arrays instead of returning empty or incomplete ready content',()=>{
 const {lesson,point}=fixture();
 for(const points of [new Array(1),[point,,]]){
  rejected({[lesson.id]:{points}},lesson);
 }
});

test('enforces title and explanation limits while allowing the runtime 110-character boundary',()=>{
 const {lesson,point}=fixture();
 const boundary={...point,title:'法'.repeat(64),summary:'中'.repeat(110),pitfall:'文'.repeat(110)};
 assert.equal(registry({[lesson.id]:{points:[boundary]}}).forLesson(lesson).status,'ready');
 for(const [field,value] of [['title','法'.repeat(65)],['summary','中'.repeat(111)],['pitfall','文'.repeat(111)]]){
  const result=rejected({[lesson.id]:{points:[{...point,[field]:value}]}},lesson);
  assert.ok(result.errors.some(e=>e.includes(field)),field+' is named in the diagnostic');
 }
});

test('requires readable Chinese explanations rather than English-only or corrupted strings',()=>{
 const {lesson,point}=fixture();
 for(const field of ['summary','pitfall']){
  for(const value of ['Use the present continuous.', '中文说明�', '中文\u0000说明']){
   rejected({[lesson.id]:{points:[{...point,[field]:value}]}},lesson);
  }
 }
});

test('accepts only 6–260-character examples containing an ASCII English letter',()=>{
 const {lesson,point}=fixture();
 for(const length of [6,260]){
  const example='A'.repeat(length),local={...lesson,paragraphs:[{en:example}]};
  assert.equal(registry({[lesson.id]:{points:[{...point,example}]}}).forLesson(local).status,'ready');
 }
 for(const example of ['Hi.', 'A'.repeat(261), '只有中文的例句。']){
  rejected({[lesson.id]:{points:[{...point,example}]}},{...lesson,paragraphs:[{en:example}]});
 }
});

test('rejects examples from elsewhere without rewriting apostrophes or normalizing the lesson',()=>{
 const {lesson,point}=fixture();
 for(const example of ["She's sitting under the tree.",'She was sitting under the tree.']){
  const result=rejected({[lesson.id]:{points:[{...point,example}]}},lesson);
  assert.ok(result.errors.some(e=>e.includes('example')));
 }
});

test('never joins paragraphs to manufacture continuous source evidence',()=>{
 const {lesson,point}=fixture();
 rejected({[lesson.id]:{points:[{...point,example:'She sits. She reads.'}]}},{...lesson,paragraphs:[{en:'She sits.'},{en:'She reads.'}]});
 rejected({[lesson.id]:{points:[point]}},{id:lesson.id,paragraphs:[{en:42}]});
});

test('rejects duplicate point titles even when their examples are valid',()=>{
 const {lesson,point}=fixture();
 const result=rejected({[lesson.id]:{points:[point,{...point,title:'  现在进行时  ',example:'She is reading a book.'}]}},lesson);
 assert.ok(result.errors.some(e=>/title|重复/.test(e)));
});

test('rejects question-bank templates in headings, summaries or pitfalls',()=>{
 const {lesson,point}=fixture();
 for(const template of ['原句含有情态动词','备选 be、being、been','语法运用','本题保留原句']){
  for(const field of ['title','summary','pitfall']){
   rejected({[lesson.id]:{points:[{...point,[field]:template}]}},lesson);
  }
 }
});

test('clones results and id lists without modifying frozen lessons or source catalogs',()=>{
 const {lesson,point,catalog}=fixture();
 Object.freeze(point);Object.freeze(catalog[lesson.id].points);Object.freeze(catalog[lesson.id]);Object.freeze(catalog);
 Object.freeze(lesson.paragraphs[0]);Object.freeze(lesson.paragraphs);Object.freeze(lesson);
 const r=registry(catalog),first=r.forLesson(lesson);
 first.points[0].title='改过的标题';first.points.push({...point});r.lessonIds().push('invented');
 assert.deepEqual(r.forLesson(lesson),{status:'ready',points:[point]});
 assert.deepEqual(r.lessonIds(),['fixture-lesson']);
 assert.equal(point.title,'现在进行时');
});

test('merges catalog arrays and validates against each requested lesson body on every call',()=>{
 const {lesson,catalog}=fixture();
 assert.equal(typeof focus.create,'function');
 const r=focus.create([catalog,{'other-lesson':catalog[lesson.id]}]);
 assert.equal(r.hasLesson('other-lesson'),true);
 assert.equal(r.forLesson({...lesson,id:'other-lesson'}).status,'ready');
 assert.equal(r.forLesson({...lesson,paragraphs:[{en:'An unrelated text.'}]}).status,'needs-review');
 assert.equal(r.forLesson(lesson).status,'ready');
});

test('browser UMD consumes the four browser catalogs without require or network access',()=>{
 assert.ok(fs.existsSync(target),'grammar focus runtime must exist');
 const window={};window.window=window;
 vm.createContext(window);
 for(const name of ['lesson-grammar-focus-book1.js','lesson-grammar-focus-book2.js','lesson-grammar-focus-book3.js','lesson-grammar-focus-book4.js','lesson-grammar-focus.js']){
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),window,{filename:name});
 }
 const api=window.StudyLessonGrammarFocus;
 assert.equal(typeof api?.create,'function');assert.equal(api.lessonIds().length,276);
 const lesson={id:'nce-b1-4be758-l001',paragraphs:[{en:'Is this your handbag? Yes, it is.'}]};
 assert.equal(api.forLesson(lesson).status,'ready');
 assert.equal(api.forLesson({...lesson,paragraphs:[]}).status,'needs-review');
 assert.equal(api.forLesson({id:'unknown'}),null);
});
