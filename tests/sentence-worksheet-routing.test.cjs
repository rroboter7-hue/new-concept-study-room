'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup({mobile=true,quick=true}={}){
 const lesson={id:'now',title:'Books',vocabulary:[{word:'book'}],paragraphs:[{en:'We read books.'}]},changes=[],root={innerHTML:'',querySelector(){return null;}};
 const scope={document:{addEventListener(){},querySelector:()=>root}};scope.window=scope;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../output-practice.js'),'utf8'),scope);
 const ui=new scope.OutputPractice({getLesson:()=>lesson,defaultMode:()=> 'sentences',isMobileWorkspace:()=>mobile,
   sentencePractice:{isQuickMode:()=>quick,flush(){},render:()=>'<section id="worksheet">Four editable answers</section>'},
   batchPractice:{flush(){},cancel(){},render:()=>'<section id="batch">Saved sentences</section>'},
   onModeChange:(mode,info)=>changes.push({mode,worksheet:info?.worksheet}),saveState:()=>true});
 return {ui,changes};
}
test('mobile worksheet has one practice surface with no competing mode navigation',()=>{
 const h=setup(),html=h.ui.render();assert.match(html,/id="worksheet"/);assert.doesNotMatch(html,/class="output-tabs|class="mls-output-more/);
 assert.deepEqual(h.changes.at(-1),{mode:'sentences',worksheet:true});
 h.ui.switchMode('batch');const batch=h.ui.render();assert.match(batch,/id="batch"/);assert.match(batch,/output-tabs/);
 assert.deepEqual(h.changes.at(-1),{mode:'batch',worksheet:false});
});
test('desktop and legacy writing retain their navigation while worksheet focus is scoped to mobile',()=>{
 for(const options of [{mobile:false,quick:true},{mobile:true,quick:false}]){
  const h=setup(options),html=h.ui.render();assert.match(html,/output-tabs/);assert.equal(h.changes.at(-1).worksheet,false);
 }
});
test('a worksheet with no eligible new words still keeps one clear back and menu surface',()=>{
 const h=setup({quick:false});h.ui.options.sentencePractice.usesWorksheetLayout=()=>true;
 const html=h.ui.render();assert.doesNotMatch(html,/class="output-tabs|class="mls-output-more/);
 assert.deepEqual(h.changes.at(-1),{mode:'sentences',worksheet:true});
});
test('mobile shell removes worksheet focus on other lesson tabs, batch mode and library views',()=>{
 const scope={URLSearchParams,location:{search:''}};scope.window=scope;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8'),scope);
 const classes=new Set(),ui=Object.create(scope.MobileLearningShell.prototype);
 Object.assign(ui,{enabled:true,mobile:true,destroyed:false,body:{classList:{contains:name=>classes.has(name),remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute(){}},state:{view:'study',tab:'output',sentenceWorksheet:true},outputMode:'sentences'});
 ui.syncPresentation();assert.equal(classes.has('mls-sentence-sheet'),true);
 for(const state of [{view:'study',tab:'reading',mode:'sentences'},{view:'study',tab:'output',mode:'batch'},{view:'library',tab:'output',mode:'sentences'}]){
  ui.state={...state,sentenceWorksheet:true};ui.outputMode=state.mode;ui.syncPresentation();assert.equal(classes.has('mls-sentence-sheet'),false);
 }
});
