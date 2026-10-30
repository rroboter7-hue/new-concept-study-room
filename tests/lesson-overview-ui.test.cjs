'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Pipeline=require('../learning-pipeline.js');
const lesson={id:'current',book:2,number:2,title:'Current',paragraphs:[]};
function ui(points){const value=new Pipeline({getLesson:()=>lesson,getKeyPoints:()=>points,renderReading:()=>'<p>Passage</p>'});value.lesson=lesson;return value;}
test('reading overview summarizes only current lesson grammar with bounded points and an escaped caution',()=>{
 const grammar=Array.from({length:5},(_,i)=>({category:'grammar',sourceLessonId:'current',title:'一般现在时'+i,summary:'习惯或经常发生的事。'}));
 const html=ui({grammar:[{sourceLessonId:'older',title:'旧课内容'},...grammar],pitfalls:[{sourceLessonId:'current',text:'不要漏掉 <s>。'}]}).readingHTML();
 assert.match(html,/本课要掌握/);assert.match(html,/一般现在时0/);assert.doesNotMatch(html,/一般现在时3|旧课内容/);assert.match(html,/&lt;s&gt;/);
 assert.equal((html.match(/习惯或经常发生的事/g)||[]).length,3);
});
test('non-tense lessons keep their real grammar heading and empty lessons do not invent a tense',()=>{
 const html=ui({grammar:[{sourceLessonId:'current',title:'名词所有格',summary:'表示所属关系。'}]}).readingHTML();assert.match(html,/名词所有格/);assert.doesNotMatch(html,/一般过去时/);
 assert.doesNotMatch(ui({grammar:[]}).readingHTML(),/pipeline-lesson-focus/);
});
test('an explanatory grammar heading stays compact rather than repeating its full note',()=>{
 const html=ui({grammar:[{sourceLessonId:'current',title:'一般过去时：讲述过去发生的事',summary:'一般过去时用来讲述过去发生的动作或状态。'}]}).readingHTML();
 assert.match(html,/一般过去时：讲述过去发生的事/);assert.doesNotMatch(html,/一般过去时用来讲述/);
});
test('curated overview shows its English evidence and per-point caution without repeating a generic warning',()=>{
 const html=ui({grammar:[{sourceLessonId:'current',curated:true,title:'一般过去时',summary:'went 在讲上周看戏。',example:'I went to the theatre.',pitfall:'不要把 went 写成 go。'}],pitfalls:[{sourceLessonId:'current',text:'不要把 went 写成 go。'}]}).readingHTML();
 assert.match(html,/I went to the theatre\./);assert.match(html,/易错/);assert.equal((html.match(/不要把 went 写成 go/g)||[]).length,1);
});

test('reading keeps detailed grammar collapsed behind a compact accessible summary and separates the passage layout',()=>{
 const html=ui({grammar:[{sourceLessonId:'current',curated:true,title:'一般现在时',summary:'表示习惯。',example:'I get up early.',pitfall:'不要漏掉动词。'}]}).readingHTML();
 assert.match(html,/<details class="pipeline-focus-details"><summary>/);
 assert.doesNotMatch(html,/<details class="pipeline-focus-details"[^>]*\bopen\b/);
 assert.match(html,/展开语法与易错点/);assert.match(html,/pipeline-reading-layout/);
 assert.match(html,/data-pipeline-reading/);assert.match(html,/I get up early\./);assert.match(html,/不要漏掉动词/);
});
