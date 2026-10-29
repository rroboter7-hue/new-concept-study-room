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
