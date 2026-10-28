const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./leo-coach-harness.cjs');

test('retell navigation restores its own draft and preserves legacy dictation data',async()=>{
 const h=await harness({pilot:false,realOutput:true});
 h.api.setTab('output');await h.click('[data-output-mode="retell"]');
 await h.input('[data-output-input="answer"]','I remember my own retelling.');
 await h.click('[data-output-mode="write"]');
 await h.input('[data-output-input="answer"]','A separate dictation draft.');
 h.api.setTab('reading');
 assert.equal(typeof h.api.mobileShell.options.openOutputMode,'function');
 h.api.mobileShell.options.openOutputMode('retell');
 assert.equal(h.api.activeTab,'output');assert.equal(h.api.output.mode,'retell');
 assert.equal(h.api.output.answer,'I remember my own retelling.');
 h.api.mobileShell.options.openOutputMode('write');
 assert.equal(h.api.output.answer,'A separate dictation draft.');
 assert.ok(h.api.mobileShell.focusCalls>=2);
});

test('finishing mobile reading opens sentence writing and records reading without quiz mastery',async()=>{
 const h=await harness({pilot:false,realOutput:true});
 h.api.mobileShell.options.onReadNext();
 assert.equal(h.api.activeTab,'output');assert.equal(h.api.output.mode,'sentences');
 assert.equal(h.api.data.records[h.api.current.id].quizAttempts||0,0);
 assert.ok(h.api.mobileShell.focusCalls>=1);
});
