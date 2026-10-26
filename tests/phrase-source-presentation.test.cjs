const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const w={document:{addEventListener(){}}};w.window=w;vm.createContext(w);vm.runInContext(fs.readFileSync(path.join(__dirname,'../phrase-practice.js'),'utf8'),w);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p={phrase:'look after',matchedForm:'looked after',example:'She looked after the cat.',exampleZh:'她照看了那只猫。',sourceType:'textbook-passage',sourceParagraphIndex:1,sourcePage:24,sourceUrl:'resources/source.pdf'};
test('phrase study cards show matched form, Chinese example and accurate textbook source',()=>{
 assert.equal(typeof w.PhrasePractice.studyExampleHTML,'function');const html=w.PhrasePractice.studyExampleHTML(p,{escapeHTML:escape,wordHTML:escape});
 assert.match(html,/课文形式：looked after/);assert.match(html,/<mark class="phrase-example-target">looked after<\/mark>/);assert.match(html,/她照看了那只猫/);assert.match(html,/课文原句/);assert.match(html,/第 2 段/);assert.match(html,/PDF第 24 页起/);assert.match(html,/href="resources\/source.pdf#page=24"/);assert.doesNotMatch(html,/来源笔记/);
});
test('existing note examples keep their original source label and unsafe source URLs are never links',()=>{
 assert.equal(typeof w.PhrasePractice.studyExampleHTML,'function');
 const html=w.PhrasePractice.studyExampleHTML({...p,sourceType:undefined,exampleZh:'<img src=x onerror=alert(1)>',sourceUrl:'javascript:alert(1)'},{escapeHTML:escape,wordHTML:escape});
 assert.match(html,/来源笔记第 24 页/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|javascript:|href=/);
 const textbook=w.PhrasePractice.studyExampleHTML({...p,sourceUrl:'javascript:alert(1)'},{escapeHTML:escape,wordHTML:escape});assert.doesNotMatch(textbook,/javascript:|href=/);
});
test('the learn view uses the shared source-aware example renderer',()=>{
 const practice=new w.PhrasePractice({escapeHTML:escape,wordHTML:escape,getLesson:()=>({id:'l',usage:[{...p,meaning:'照顾',note:'课文过去式。'}]})});
 const html=practice.render();assert.match(html,/她照看了那只猫/);assert.match(html,/课文原句/);assert.match(html,/looked after/);
});
