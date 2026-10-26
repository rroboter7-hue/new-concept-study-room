const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('full Book2 mobile mode survives update and continues lesson96',()=>{
 const scope={URLSearchParams,location:{search:'?pilot=all'},document:{querySelector:()=>null}};scope.window=scope;vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8'),scope);
 const nodes=new Map(),node=()=>({textContent:'',setAttribute(){},classList:{toggle(){}}});
 const ui=Object.create(scope.MobileLearningShell.prototype);Object.assign(ui,{enabled:true,destroyed:false,pilotMode:'all',options:{getStatus:()=>''},state:{view:'study',lesson:{book:2,number:96,title:'The dead return'}},home:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);}},body:{setAttribute(){},classList:{toggle(){}}},nav:{querySelectorAll:()=>[]},syncPlayer(){},syncPresentation(){},defer(){},syncViewport(){},destroy(){this.destroyed=true;}});
 ui.update({view:'study',tab:'reading',lesson:ui.state.lesson});assert.equal(ui.destroyed,false);assert.match(nodes.get('.mls-continue-label').textContent,/96/);
});
