'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./support/app-harness.cjs');
const options={realPipeline:true,pilot:false,realOutput:true};
function trackPlayer(h){
 const audio=h.audio,setLesson=audio.setLesson.bind(audio),calls=[];
 audio.setLesson=lesson=>{setLesson(lesson);audio.state={lessonId:lesson.id,playing:false};};
 audio.play=()=>{calls.push(audio.state.lessonId||null);return audio.state.lessonId?Promise.resolve():Promise.reject(new Error('本课暂无可朗读的英文内容。'));};
 return calls;
}
test('opening current-lesson knowledge from review initializes its audio before switching to reading',async()=>{
 const h=await harness(options),calls=trackPlayer(h),id=h.api.current.id;
 assert.deepEqual(h.audio.lessonChanges,[],'the initial shelf stays lazy');
 await h.api.navigate('daily-review');h.api.openKnowledge(id,'missing-target');await h.flush();
 await h.api.learningPipeline.goStage(0);
 assert.equal(h.audio.state.lessonId,id,'the rendered study entry must bind its current lesson');
 h.api.learningPipeline.options.playLesson(h.api.current);await h.flush();
 assert.deepEqual(calls,[id]);assert.equal(h.audio.state.lessonId,id);
});
test('the play gesture initializes an unbound player synchronously and rejects stale lesson callbacks',async()=>{
 const h=await harness(options),calls=trackPlayer(h);await h.api.selectLesson(h.api.current.id);
 const id=h.api.current.id;h.audio.state={};
 h.api.learningPipeline.options.playLesson(h.api.current);
 assert.deepEqual(calls,[id],'bind and play run within the same user gesture');
 const previous=h.audio.lessonChanges.length;
 h.api.learningPipeline.options.playLesson(h.c.LESSONS.find(l=>l.id!==id));
 assert.equal(h.audio.lessonChanges.length,previous);assert.deepEqual(calls,[id]);
});
test('repeated reading refreshes retain an already-bound playback position',async()=>{
 const h=await harness(options);trackPlayer(h);await h.api.selectLesson(h.api.current.id);
 const count=h.audio.lessonChanges.length;h.audio.state={lessonId:h.api.current.id,playing:false,currentTime:32};
 await h.api.learningPipeline.goStage(4);await h.api.learningPipeline.goStage(0);
 assert.equal(h.audio.lessonChanges.length,count);assert.equal(h.audio.state.currentTime,32);
});
