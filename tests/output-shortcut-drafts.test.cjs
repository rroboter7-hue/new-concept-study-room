const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');

test('the reading-page retell shortcut restores the separate retell draft instead of overwriting it with dictation',async()=>{
 const h=await harness({pilot:false,realCoach:true,realOutput:true});
 h.api.setTab('output');await h.click('[data-output-mode="retell"]');
 const retell='My separate retell answer must remain here.';
 await h.input('[data-output-input="answer"]',retell);
 await h.click('[data-output-mode="write"]');
 await h.input('[data-output-input="answer"]','My separate dictation answer.');
 h.api.setTab('reading');await h.click('[data-lesson-recall="retell"]');
 assert.equal(h.api.output.answer,retell);
 assert.equal(h.api.data.outputDrafts.lessons[h.api.current.id].modes.retell.answer,retell);
 assert.equal(h.api.data.outputDrafts.lessons[h.api.current.id].modes.write.answers[0],'My separate dictation answer.');
});
