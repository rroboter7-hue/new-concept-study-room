'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const archivedUrl='resources/df385269f6502f20.pdf',paperUrl='resources/cebcdf4e922d21aa.pdf';
const archived={id:'archived-notes',title:'已转文字的课堂笔记',url:archivedUrl,book:1,kind:'PDF',pages:12,bytes:10380902};
const paper={id:'blank-paper',title:'空白书写纸',url:paperUrl,book:0,kind:'PDF',pages:10,bytes:286840};
const sourceFiles={isArchived:url=>url===archivedUrl,publicUrl:url=>url===archivedUrl?'':url};
function scope(withHelper=true){const c={document:{addEventListener(){}}};c.window=c;if(withHelper)c.StudySourceFiles=sourceFiles;vm.createContext(c);return c;}
// Execute the actual render function bodies. Other app initialization and DOM
// navigation are outside this test's boundary; no production exports are added.
function appUI(withHelper=true){
 const c=scope(withHelper),containers=new Map(),app=read('app.js');
 Object.assign(c,{E:escape,wordHTML:escape,icon:()=>'',BOOKS:[{name:'第一册',full:'英语初阶'},{name:'第二册',full:'实践与进步'},{name:'第三册',full:'培养技能'},{name:'第四册',full:'流利英语'}],selectedBook:1,query:'',data:{settings:{translation:true}},STUDY_LIBRARY:[archived,paper],$:(selector)=>{if(!containers.has(selector))containers.set(selector,{innerHTML:''});return containers.get(selector);},openDialog(title,body){c.dialog=body;}});
 vm.runInContext(read('reading-layout.js'),c,{filename:'reading-layout.js'});
 for(const name of ['renderReading','renderLibrary','openResources']){
  const start=app.indexOf(' function '+name+'('),end=app.indexOf('\n function ',start+1);
  assert(start>=0&&end>start,'locate real '+name);
  vm.runInContext(app.slice(start,end),c,{filename:'app.js:'+name});
 }
 return {c,libraryHTML:()=>containers.get('#library-view').innerHTML};
}
function textUI({empty=false,url=archivedUrl,withHelper=true}={}){
 const c=scope(withHelper);vm.runInContext(read('text-reader.js'),c,{filename:'text-reader.js'});
 const source=url===paperUrl?paper:archived,container={innerHTML:''};c.STUDY_LIBRARY=[source];
 const reader=new c.TextStudyLibrary({container,escapeHTML:escape,wordHTML:escape,icon:()=>'',onLessonSelected(){},output:{setLesson(){},render(){return '';}}});
 reader.doc={id:source.id,title:source.title,book:source.book,sections:empty?[]:[{id:'one',title:'第一学习单元',pageStart:4,pageEnd:6,lines:['A useful sentence.','一条可学习的句子。'],english:['A useful sentence.']}]};reader.render();
 return container.innerHTML;
}
const noArchiveLink=html=>assert.doesNotMatch(html,/(?:href|download)="[^"]*(?:df385269f6502f20\.pdf|已转文字的课堂笔记\.pdf)/);

test('archived textbook source retains its page, passage, translation and audio index without a PDF link',()=>{
 const {c}=appUI();c.current={id:'reading',book:1,number:1,textbook:{verified:true,sourceUrl:archivedUrl,sourcePdfPage:5},paragraphs:[{en:'Excuse me!',zh:'劳驾！'}],translation:{label:'自编译文'}};
 const html=c.renderReading();noArchiveLink(html);assert.doesNotMatch(html,/\bhref=|\bdownload=/);assert.match(html,/原PDF已归档/);assert.match(html,/原PDF第 5 页/);assert.match(html,/Excuse me!/);assert.match(html,/劳驾！/);assert.match(html,/自编译文/);assert.match(html,/data-sentence="0"/);
});
test('library rows keep text reading for archived documents and the printable paper download',()=>{
 const h=appUI();h.c.renderLibrary();const html=h.libraryHTML();noArchiveLink(html);assert.match(html,/原PDF已归档/);assert.match(html,/data-document="archived-notes"/);assert.match(html,/文字学习/);assert.match(html,/href="resources\/cebcdf4e922d21aa\.pdf" download="空白书写纸\.pdf"/);
 assert.match(html,/学习资料 2 份/);assert.match(html,/网页文字版 · 原资料 12 页/);assert.doesNotMatch(html,/9\.9 MB/);assert.match(html,/0\.3 MB/);
 h.c.STUDY_LIBRARY=[archived];h.c.renderLibrary();assert.doesNotMatch(h.libraryHTML(),/\bhref=|\bdownload=/);
});
test('resource dialog retains archived source titles without links and keeps the paper resource link',()=>{
 const {c}=appUI();c.openResources();const html=c.dialog;noArchiveLink(html);assert.match(html,/已转文字的课堂笔记/);assert.match(html,/原PDF已归档/);assert.match(html,/id="open-library"/);assert.match(html,/href="resources\/cebcdf4e922d21aa\.pdf"/);
 assert(![...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].some(([anchor])=>anchor.includes(archived.title)),'archived resource is plain text, never an empty link');
});
test('text reading preserves source pages and extracted content when the original PDF is archived',()=>{
 const html=textUI();noArchiveLink(html);assert.doesNotMatch(html,/\bhref=|\bdownload=/);assert.match(html,/原PDF已归档/);assert.match(html,/原资料第 4–6 页/);assert.match(html,/A useful sentence\./);assert.match(html,/一条可学习的句子/);assert.match(html,/文字阅读/);
});
test('empty archived documents have an archive notice instead of a missing original-file link',()=>{
 const html=textUI({empty:true});noArchiveLink(html);assert.doesNotMatch(html,/\bhref=|\bdownload=/);assert.match(html,/原PDF已归档/);assert.match(html,/没有可提取的文字层/);
});
test('printable paper retains its original-file link and normal documents retain available PDF downloads',()=>{
 assert.match(textUI({empty:true,url:paperUrl}),/href="resources\/cebcdf4e922d21aa\.pdf"[^>]*>查看原始文件/);
 assert.match(textUI({url:paperUrl}),/href="resources\/cebcdf4e922d21aa\.pdf" download="空白书写纸\.pdf"/);
});
test('archived phrase examples keep sentence evidence, translation, paragraph and page without a PDF link',()=>{
 const c=scope();vm.runInContext(read('phrase-practice.js'),c,{filename:'phrase-practice.js'});
 const html=c.PhrasePractice.studyExampleHTML({phrase:'look after',matchedForm:'looked after',example:'She looked after the cat.',exampleZh:'她照看了那只猫。',sourceType:'textbook-passage',sourceParagraphIndex:1,sourcePage:24,sourceUrl:archivedUrl},{escapeHTML:escape,wordHTML:escape});
 noArchiveLink(html);assert.doesNotMatch(html,/\bhref=|\bdownload=/);assert.match(html,/原PDF已归档/);assert.match(html,/looked after/);assert.match(html,/她照看了那只猫/);assert.match(html,/第 2 段/);assert.match(html,/PDF第 24 页起/);
});
test('standalone renderers preserve legacy links when the source-file helper is absent',()=>{
 const h=appUI(false);h.c.renderLibrary();assert.match(h.libraryHTML(),/href="resources\/df385269f6502f20\.pdf"/);
 h.c.current={textbook:{verified:true,sourceUrl:archivedUrl,sourcePdfPage:5},paragraphs:[{en:'Excuse me!',zh:'劳驾！'}]};assert.match(h.c.renderReading(),/href="resources\/df385269f6502f20\.pdf#page=5"/);
 h.c.openResources();assert.match(h.c.dialog,/href="resources\/df385269f6502f20\.pdf"/);
 assert.match(textUI({withHelper:false}),/href="resources\/df385269f6502f20\.pdf"/);
});
