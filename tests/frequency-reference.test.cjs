'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Frequency=require('../frequency-reference.js');
test('three-star word ratings use actual versioned word-form scores',()=>{
 assert.equal(Frequency.lookup('outside','word').stars,3);
 assert.equal(Frequency.lookup('garden','word').stars,2.8);
 assert.equal(Frequency.lookup('OUTSIDE','word').stars,3);
 assert.equal(Frequency.lookup('xyzzynonsense','word').stars,null);
 assert.equal((Frequency.badge('outside','word').match(/class="frequency-star"/g)||[]).length,3);
 assert.equal((Frequency.badge('outside','word').match(/width:100%/g)||[]).length,3);
 assert.match(Frequency.badge('garden','word'),/width:80%/);
 assert.equal(Frequency.ratingForZipf(3.666),1.7);
 assert.equal(Frequency.ratingForZipf(0),null);
});
test('phrases require exact sample evidence and never combine component word frequencies',()=>{
 assert.equal(Frequency.lookup('get up','phrase').stars,3);
 assert.equal(Frequency.lookup('have breakfast','phrase').stars,null);
 assert.match(Frequency.badge('have breakfast','phrase'),/待统计/);
 assert.equal(Frequency.lookup('outside garden','phrase').stars,null);
 const result=Frequency.lookup('get up','phrase');assert.equal(result.sourceKind,'subtitle-sample');assert(result.count>0);
 assert.match(Frequency.badge('get up','phrase'),/字幕样本/);
});
test('frequency data documents scope, source and thresholds without adding practice counts',()=>{
 assert.equal(Frequency.metadata.version,1);assert.equal(Frequency.metadata.phraseRows,10000);
 assert.match(Frequency.metadata.wordLicense,/CC BY-SA/);
 assert.deepEqual(Frequency.metadata.thresholds.wordZipf,[4,5]);
 assert.equal(Frequency.lookup('get up','phrase').requiredCount,undefined);
 assert.equal(Frequency.lookup('<img src=x>','word').stars,null);
});
