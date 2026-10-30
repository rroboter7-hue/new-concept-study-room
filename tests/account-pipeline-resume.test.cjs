'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Pipeline=require('../learning-pipeline-core.js'),Data=require('../account-data.js');
test('a current retelling step remains retelling after a fresh account receives per-lesson cloud entities',()=>{
 const current=Pipeline.sanitize({version:2,lessons:{fixture:{stage:4,retellText:'This is my synthetic retelling.',scrollPositions:{4:123}}}}),source={learningPipeline:current},projected=Data.project(source),changes=Object.fromEntries(Object.entries(projected).map(([k,value])=>[k,{value}])),received=Data.apply({words:[]},changes);assert.equal(received.learningPipeline.version,undefined,'the existing cloud protocol stores lesson entities rather than the global pipeline header');const reopened=Pipeline.sanitize(received.learningPipeline);assert.equal(reopened.lessons.fixture.stage,4);assert.equal(reopened.lessons.fixture.retellText,'This is my synthetic retelling.');assert.equal(reopened.lessons.fixture.scrollPositions[4],123);assert.equal(reopened.lessons.fixture.scrollPositions[5],undefined);
});
test('a genuinely legacy five-step record still migrates its former emphasis step once',()=>{
 const old=Pipeline.sanitize({version:1,lessons:{fixture:{stage:4,scrollPositions:{4:123}}}});assert.equal(old.lessons.fixture.stage,5);assert.equal(old.lessons.fixture.scrollPositions[5],123);assert.equal(Pipeline.sanitize(old).lessons.fixture.stage,5);
});
