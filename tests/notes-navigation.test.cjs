const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('\n').find(line=>line.includes('function openKnowledge('));
test('a knowledge jump expands every ancestor before focusing the requested rule',()=>{
 const outer={tagName:'DETAILS',open:false,parentElement:null},inner={tagName:'DETAILS',open:false,parentElement:outer};
 let focused=false,scrolled=false;
 const node={parentElement:{tagName:'DIV',parentElement:inner},focus(){assert.equal(inner.open,true);assert.equal(outer.open,true);focused=true;},scrollIntoView(){scrolled=true;}};
 const c={lessons:[{id:'l1'}],current:{id:'l1'},view:'study',setTab:()=>{},requestAnimationFrame:fn=>fn(),document:{getElementById:()=>node},mobileShell:{focusReader(){throw Error('wrong fallback');}}};vm.runInNewContext(code,c);c.openKnowledge('l1','past');assert(focused&&scrolled);
});
test('unknown knowledge anchor uses the readable lesson fallback',()=>{
 let called=0;const c={lessons:[{id:'l1'}],current:{id:'l1'},view:'study',setTab:()=>{},requestAnimationFrame:fn=>fn(),document:{getElementById:()=>null},mobileShell:{focusReader(){called++;}}};vm.runInNewContext(code,c);c.openKnowledge('l1','absent');assert.equal(called,1);
});