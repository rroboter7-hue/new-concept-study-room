'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');
const options={pilot:false,realCoach:true,realOutput:true};
async function book4(h,number=1){const lesson=h.c.LESSONS.find(l=>l.book===4&&l.number===number);assert(lesson);await h.api.selectLesson(lesson.id);h.api.setTab('output');return lesson;}

test('real Book 4 retell input survives course changes and a fresh app bootstrap without creating mastery',async()=>{
 const h=await harness(options),first=await book4(h),answer='We read rocks and ancient tools to learn about the past.';
 await h.click('[data-output-mode="retell"]');await h.input('[data-output-input="answer"]',answer);await book4(h,2);await book4(h);
 assert.equal(h.api.output.mode,'retell');assert.equal(h.document.querySelector('[data-output-input="answer"]').value,answer);assert.equal(h.api.data.records[first.id]?.attempts,undefined);assert.equal(h.api.data.records[first.id]?.output,undefined);
 const reloaded=await harness({...options,loaded:h.stored});reloaded.api.setTab('output');assert.equal(reloaded.api.output.mode,'retell');assert.equal(reloaded.document.querySelector('[data-output-input="answer"]').value,answer);assert.match(reloaded.html(),/草稿已保存/);
});

test('real app emergency backup retains failed draft writes and restoring it refreshes the output editor',async()=>{
 const h=await harness(options),first=await book4(h),answer='This unfinished answer must survive an emergency backup.';
 await h.click('[data-output-mode="retell"]');const before=JSON.stringify(h.api.data.outputDrafts);h.setStorageWritable(false);await h.input('[data-output-input="answer"]',answer);assert.equal(JSON.stringify(h.api.data.outputDrafts),before);assert.match(h.api.output.draftStatusText(),/草稿未保存/);
 await book4(h,2);await book4(h);assert.equal(h.api.output.answer,answer);const backup=h.api.backupData();assert(backup.outputDrafts,'backup contains output drafts');assert.equal(backup.outputDrafts.lessons[first.id].modes.retell.answer,answer);
 h.setStorageWritable(true);await h.click('[data-output-action="draft-save"]');assert.match(h.api.output.draftStatusText(),/草稿已保存/);await h.input('[data-output-input="answer"]','A newer answer that should be replaced by my backup.');h.api.restoreBackup({format:'zhixin-backup-v1',data:backup});assert.equal(h.api.output.answer,answer);assert.equal(h.document.querySelector('[data-output-input="answer"]').value,answer);
});

test('daily retell references remain assisted after a fresh app bootstrap and task re-entry',async()=>{
 const h=await harness(options),task=h.api.coach.plan.tasks.find(t=>t.type==='retell');await h.api.coach.begin(task.id);await h.click('[data-output-action="original"]');await h.click('[data-output-action="original"]');const answer='A man went to the theatre and heard two people talking.';await h.input('[data-output-input="answer"]',answer);
 const reloaded=await harness({...options,loaded:h.stored}),again=reloaded.api.coach.plan.tasks.find(t=>t.id===task.id);assert(again);await reloaded.api.coach.begin(again.id);assert.equal(reloaded.api.output.answer,answer);assert.equal(reloaded.api.output.assisted,true);await reloaded.click('[data-output-action="submit"]');const status=reloaded.c.StudyCoach.taskStatus(reloaded.api.data.coach,again);assert.equal(status.done,true);assert.equal(status.assisted,true);assert.equal(reloaded.api.data.records[task.lessonId]?.attempts,undefined);
});
