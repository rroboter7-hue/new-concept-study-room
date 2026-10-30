'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness}=require('./support/app-harness.cjs');
test('learning-only release keeps account sync disabled and opens existing guest drafts without cloud requests',async()=>{
 const config={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../account-config.js'),'utf8'),{window:config});
 // This guard is intentionally specific to the public learning-only release.
 assert.equal(config.STUDY_ACCOUNT_CONFIG.enabled,false);
 let contacts=0;const id='nce-b2-eef57c-l002',source='A guest retelling kept on this device.';
 const h=await harness({realPipeline:true,pilot:false,loaded:{words:[],learningPipeline:{version:2,lessons:{[id]:{retellText:source,stage:4}}}},accounts:{config:config.STUDY_ACCOUNT_CONFIG,fetcher:async()=>{contacts++;throw Error('No cloud expected');}}});
 assert.equal(contacts,0);assert.equal(h.api.data.learningPipeline.lessons[id].retellText,source);assert.equal(h.api.storageKey,'zhixin-study-v1');
});
