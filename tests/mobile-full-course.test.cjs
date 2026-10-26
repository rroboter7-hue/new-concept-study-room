'use strict';
// Pure Node contract tests: no browser, localhost, CDP, or rendering claims.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../mobile-learning-shell.js'),'utf8');
function load(search=''){
 const scope={URLSearchParams,location:{search},document:{querySelector:()=>null}};scope.window=scope;vm.createContext(scope);vm.runInContext(source,scope,{filename:'mobile-learning-shell.js'});return scope;
}
function fixture({search='',lesson={id:'book2-96',book:2,number:96,title:'第96课 · The dead return'},selectedBook=lesson?.book||2}={}){
 const scope=load(search),nodes=new Map(),calls={books:[],closed:0,openAtCallback:[]},counts={1:144,2:96,3:60,4:48};
 const node=()=>({textContent:'',value:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;},classList:{toggle(){}}});const query=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 const classes=new Set(['mls-coach-open']);
 const ui=Object.create(scope.MobileLearningShell.prototype);
 Object.assign(ui,{enabled:true,destroyed:false,mobile:true,drawerOpen:false,options:{getLesson:()=>lesson,getSelectedBook:()=>selectedBook,getLessonCount:book=>counts[book],getStatus:()=>'',selectBook:book=>{calls.books.push(book);calls.openAtCallback.push(ui.drawerOpen);selectedBook=book;}},state:{view:'study',tab:'reading',lesson},header:{querySelector:query},dialog:{querySelector:query},home:{querySelector:query},menu:{open:true,querySelector:query},bookSelect:node(),body:{setAttribute(){},classList:{toggle(){},remove:name=>classes.delete(name)}},nav:{querySelectorAll:()=>[]},syncInsets(){},syncPresentation(){},defer(){},closeCourses(){calls.closed++;this.drawerOpen=false;},destroy(){this.destroyed=true;}});
 return {scope,ui,nodes,calls,counts,classes,setLesson:v=>{lesson=v;},setSelectedBook:v=>{selectedBook=v;}};
}

test('enabled false is an explicit opt-out on the public URL',()=>{
 const scope=load('');scope.document={get body(){throw Error('disabled shell must not access DOM');},querySelector(){throw Error('disabled shell must not access DOM');}};
 const ui=new scope.MobileLearningShell({enabled:false});assert.equal(ui.enabled,false);ui.update({view:'study'});ui.focusReader();assert.equal(ui.destroyed,false);
});

test('default public URL update keeps Book2 lesson96 and does not require pilot query',()=>{
 const e=fixture();e.ui.update({view:'study',tab:'reading'});assert.equal(e.ui.destroyed,false);assert.equal(e.nodes.get('.mls-continue-label').textContent,'继续学习第二册第96课');assert.equal(e.nodes.get('.mls-current-title').textContent,'The dead return');assert.equal(e.nodes.get('.mls-book-summary').textContent,'第二册 · 96课');
 for(const search of ['?pilot=1','?pilot=all','','?unrelated=1']){e.scope.location.search=search;e.ui.update();assert.equal(e.ui.destroyed,false);assert.equal(e.nodes.get('.mls-continue-label').textContent,'继续学习第二册第96课');}
});

test('all four current lesson books and later numbers drive the continue action',()=>{
 const e=fixture();for(const [book,number,title]of [[1,75,'第75课 · First book'],[2,96,'第96课 · The dead return'],[3,48,'第48课 · The silent village'],[4,40,'第40课 · Waves']]){e.setLesson({id:book+'-'+number,book,number,title});e.setSelectedBook(book);e.ui.update();assert.equal(e.nodes.get('.mls-continue-label').textContent,'继续学习'+['','第一册','第二册','第三册','第四册'][book]+'第'+number+'课');assert.equal(e.nodes.get('.mls-current-title').textContent,title.replace(/^第\d+课\s*[·・]\s*/,''));assert.equal(e.ui.bookSelect.value,String(book));assert.equal(e.nodes.get('.mls-book-summary').textContent,['','第一册','第二册','第三册','第四册'][book]+' · '+e.counts[book]+'课');assert.equal(e.nodes.get('.mls-drawer-book-summary').textContent,e.nodes.get('.mls-book-summary').textContent);assert.equal(e.nodes.get('.mls-header-lesson').textContent,'第'+number+'课');assert.equal(e.nodes.get('summary').attributes['aria-label'],['','第一册','第二册','第三册','第四册'][book]+'第'+number+'课，打开学习菜单');}
});

test('selected book controls catalogue summary independently of current lesson and supports an empty book',()=>{
 const e=fixture();e.setSelectedBook(3);e.ui.update();assert.equal(e.nodes.get('.mls-continue-label').textContent,'继续学习第二册第96课');assert.equal(e.nodes.get('.mls-book-summary').textContent,'第三册 · 60课');e.setLesson(null);e.ui.update({lesson:null});assert.equal(e.nodes.get('.mls-continue-label').textContent,'开始学习第三册');assert.equal(e.nodes.get('.mls-current-title').textContent,'选择一课，开始阅读');
});

test('book change accepts only the native selector and a valid numeric book while mobile',()=>{
 const e=fixture();e.ui.drawerOpen=true;e.ui.bookSelect.value='3';e.ui.changeBook({target:e.ui.bookSelect});assert.deepEqual(e.calls.books,[3]);assert.deepEqual(e.calls.openAtCallback,[false]);assert.equal(e.calls.closed,1);assert.equal(e.nodes.get('.mls-book-summary').textContent,'第三册 · 60课');
 assert.equal(e.ui.menu.open,false);assert.equal(e.classes.has('mls-coach-open'),false);
 for(const value of ['0','5','2.5','invalid']){e.ui.bookSelect.value=value;e.ui.changeBook({target:e.ui.bookSelect});}e.ui.changeBook({target:{value:'2'}});e.ui.mobile=false;e.ui.bookSelect.value='4';e.ui.changeBook({target:e.ui.bookSelect});assert.deepEqual(e.calls.books,[3]);assert.equal(e.calls.closed,1);
});
