'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../bookshelf-home.js'),'utf8');
function load(){const scope={window:null,document:{},Promise,Set};scope.window=scope;vm.runInNewContext(source,scope);return {Home:scope.BookshelfHome,scope};}
const lessons=[{id:'b2-12',book:2,number:12,title:'第12课 · Goodbye and good luck',subtitle:'一路顺风'},{id:'b1-1',book:1,number:1,title:'第1课 · Excuse me!'},{id:'b2-1',book:2,number:1,title:'第1课 · A private conversation'},{id:'b3-1',book:3,number:1,title:'A puma at large'}];
function control(data={}){return {dataset:data,attributes:{},isConnected:true,innerHTML:'',value:'',disabled:false,inert:false,hidden:false,focus(){this.focused=true;},getClientRects(){return [1];},setAttribute(k,v){this.attributes[k]=v;},hasAttribute(k){return k in this.attributes;},getBoundingClientRect(){return {left:0,top:0,width:170,height:164};},classList:{toggle(){}},remove(){this.removed=true;}};}
function fixture(){const {Home,scope}=load(),nodes=new Map(),query=s=>{if(!nodes.has(s))nodes.set(s,control());return nodes.get(s);},classes=new Set(),book=control({shelfBook:'2'}),root={hidden:true,inert:false,querySelector:query,querySelectorAll:()=>[book]},overlay={hidden:true,querySelector:query},calls=[],favorites=[];scope.document={body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},activeElement:null};scope.matchMedia=()=>({matches:true});const ui=Object.create(Home.prototype);Object.assign(ui,{options:{getLessons:()=>lessons,getCurrent:()=>lessons[2],getFavorites:()=>favorites,getProgress:()=>'',onLesson:id=>calls.push(['lesson',id]),onContinue:()=>calls.push(['continue']),onNavigate:view=>calls.push(['navigate',view]),onLeave:()=>calls.push(['leave']),onFavorite:(id,on)=>{if(on)favorites.push(id);else favorites.splice(favorites.indexOf(id),1);}},root,overlay,dialog:{querySelector:query,querySelectorAll:()=>[],contains:()=>true},closeButton:control(),book:2,query:'',favoritesOnly:false,destroyed:false,visible:true,drawerOpen:false,animationToken:0,animations:[]});return {ui,scope,nodes,classes,book,calls,favorites};}

test('catalogue filters a single real book, sorts lesson numbers and preserves source ordering',()=>{const {Home}=load(),before=JSON.stringify(lessons);assert.deepEqual(Array.from(Home.catalogFor(lessons,2),l=>l.id),['b2-1','b2-12']);assert.equal(JSON.stringify(lessons),before);assert.deepEqual(Array.from(Home.catalogFor(lessons,2,'GOOD LUCK'),l=>l.id),['b2-12']);assert.deepEqual(Array.from(Home.catalogFor(lessons,2,'一路'),l=>l.id),['b2-12']);assert.equal(Home.catalogFor(lessons,4).length,0);});
test('favorites are confined to selected book and never duplicate lessons',()=>{const {Home}=load();assert.deepEqual(Array.from(Home.catalogFor(lessons,2,'',true,['b2-12','b2-12','b3-1']),l=>l.id),['b2-12']);assert.equal(Home.catalogFor(lessons,2,'',true,[]).length,0);});
test('per-book resume validates stored lesson and falls back to current or first available',()=>{const {Home}=load();assert.equal(Home.resumeFor(lessons,2,lessons[2],'b2-12').id,'b2-12');assert.equal(Home.resumeFor(lessons,2,lessons[2],{id:'b2-12'}).id,'b2-12');assert.equal(Home.resumeFor(lessons,2,lessons[2],'b1-1').id,'b2-1');assert.equal(Home.resumeFor(lessons,3,lessons[2],null).id,'b3-1');assert.equal(Home.resumeFor(lessons,4,lessons[2],null),null);assert.equal(Home.lessonTitle(lessons[2]),'A private conversation');});
test('opening and searching a book does not select a lesson or falsify progress',()=>{const e=fixture();e.ui.openBook(2,e.book);assert.equal(e.ui.drawerOpen,true);assert.equal(e.ui.root.inert,true);assert.equal(e.book.attributes['aria-expanded'],'true');assert.equal(e.ui.overlay.hidden,false);assert.deepEqual(e.calls,[]);assert.match(e.nodes.get('.shelf-lesson-list').innerHTML,/A private conversation/);e.ui.query='luck';e.ui.renderLessons();assert.match(e.nodes.get('.shelf-lesson-list').innerHTML,/Goodbye and good luck/);assert.doesNotMatch(e.nodes.get('.shelf-lesson-list').innerHTML,/A private conversation/);assert.deepEqual(e.calls,[]);});
test('closing drawer restores focus, clears inert and never changes current lesson',async()=>{const e=fixture();e.ui.openBook(2,e.book);await e.ui.closeDrawer();assert.equal(e.ui.drawerOpen,false);assert.equal(e.ui.overlay.hidden,true);assert.equal(e.ui.root.inert,false);assert.equal(e.book.focused,true);assert.equal(e.book.attributes['aria-expanded'],'false');assert.equal(e.classes.has('shelf-drawer-open'),false);assert.deepEqual(e.calls,[]);});
test('lesson navigation closes shelf after the app callback accepts it',()=>{const e=fixture();e.ui.openBook(2,e.book);const n=control({shelfLesson:'b2-12'});e.ui.click({target:{closest:()=>n}});assert.equal(e.ui.visible,false);assert.equal(e.ui.root.hidden,true);assert.equal(e.ui.overlay.hidden,true);assert.deepEqual(e.calls,[['lesson','b2-12'],['leave']]);});
test('favorite toggling uses app-owned state and empty favorites explain how to add lessons',()=>{const e=fixture();e.ui.openBook(2,e.book);const n=control({shelfFavorite:'b2-12'});e.ui.click({target:{closest:()=>n}});assert.deepEqual(e.favorites,['b2-12']);e.ui.favoritesOnly=true;e.ui.renderLessons();assert.match(e.nodes.get('.shelf-lesson-list').innerHTML,/Goodbye and good luck/);assert.doesNotMatch(e.nodes.get('.shelf-lesson-list').innerHTML,/A private conversation/);e.ui.click({target:{closest:()=>n}});assert.equal(e.favorites.length,0);assert.match(e.nodes.get('.shelf-lesson-list').innerHTML,/还没有收藏的课程/);});
test('reduced motion bypasses cover animation and Escape returns to originating book',()=>{const e=fixture();e.ui.openBook(3,e.book);let stopped=false;e.ui.keydown({key:'Escape',preventDefault(){},stopPropagation(){stopped=true;}});assert.equal(stopped,true);assert.equal(e.ui.overlay.hidden,true);assert.equal(e.ui.root.inert,false);assert.equal(e.book.focused,true);assert.equal(e.ui.zoomCover,null);});
test('hiding during closing animation clears overlay and stale animation cannot hide a reopened drawer',async()=>{const e=fixture();e.scope.matchMedia=()=>({matches:false});const resolves=[];e.ui.animateCover=()=>new Promise(resolve=>resolves.push(resolve));e.ui.openBook(2,e.book);const closing=e.ui.closeDrawer();e.ui.hide();assert.equal(e.ui.overlay.hidden,true);assert.equal(e.ui.root.inert,false);e.ui.show();e.ui.openBook(3,e.book);resolves[1]();await closing;assert.equal(e.ui.drawerOpen,true);assert.equal(e.ui.overlay.hidden,false);});
test('Tab navigation wraps within the drawer in both directions',()=>{const e=fixture(),first=control(),last=control();e.ui.openBook(2,e.book);e.ui.dialog.querySelectorAll=()=>[first,last];e.ui.dialog.contains=n=>n===first||n===last;let prevented=0;e.scope.document.activeElement=last;e.ui.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(first.focused,true);e.scope.document.activeElement=first;e.ui.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(last.focused,true);assert.equal(prevented,2);});


function pendingCloseFixture(){
 const e=fixture(),pending=[];e.scope.matchMedia=()=>({matches:false});
 e.ui.animateCover=open=>open?Promise.resolve():new Promise(resolve=>pending.push(resolve));
 e.ui.openBook(2,e.book);e.pending=pending;return e;
}
for(const [name,dataset,attribute] of [
 ['lesson',{shelfLesson:'b2-12'}],
 ['book resume',{},'data-shelf-resume-book'],
 ['favorite',{shelfFavorite:'b2-12'}],
 ['filter',{shelfFilter:'favorites'}]
])test('closing animation ignores a late '+name+' action before its overlay disappears',async()=>{
 const e=pendingCloseFixture(),closing=e.ui.closeDrawer(),target=control(dataset);if(attribute)target.setAttribute(attribute,'');
 e.ui.overlay.contains=node=>node===target;
 assert.equal(e.ui.drawerOpen,false);assert.equal(e.ui.overlay.hidden,false,'the closing animation is still visible');
 e.ui.click({target:{closest:()=>target}});
 assert.deepEqual(e.calls,[],'a fading drawer cannot navigate or persist a favorite');assert.deepEqual(e.favorites,[]);
 assert.equal(e.ui.favoritesOnly,false);assert.equal(e.ui.visible,true);assert.equal(e.ui.overlay.inert,true,'all native pointer and keyboard input is disabled immediately');
 assert.equal(e.book.focused,undefined,'focus returns only after the animation finishes');
 e.pending[0]();await closing;
 assert.equal(e.ui.overlay.hidden,true);assert.equal(e.ui.root.inert,false);assert.equal(e.book.focused,true);
});

test('reopening while close is pending re-enables the current drawer and ignores the stale close completion',async()=>{
 const e=pendingCloseFixture(),closing=e.ui.closeDrawer();
 e.ui.openBook(3,e.book);assert.equal(e.ui.overlay.inert,false);assert.equal(e.ui.drawerOpen,true);assert.equal(e.ui.book,3);
 e.pending[0]();await closing;
 assert.equal(e.ui.overlay.hidden,false);assert.equal(e.ui.overlay.inert,false);assert.equal(e.ui.root.inert,true);assert.equal(e.ui.drawerOpen,true);
 const target=control({shelfLesson:'b3-1'});e.ui.overlay.contains=node=>node===target;e.ui.click({target:{closest:()=>target}});
 assert.deepEqual(e.calls,[['lesson','b3-1'],['leave']]);assert.equal(e.ui.overlay.hidden,true);
});

test('reduced-motion close disables stale drawer actions and a normal reopen accepts them again',async()=>{
 const e=fixture();e.ui.openBook(2,e.book);await e.ui.closeDrawer();assert.equal(e.ui.overlay.inert,true);
 const target=control({shelfFilter:'favorites'});e.ui.overlay.contains=node=>node===target;e.ui.click({target:{closest:()=>target}});assert.equal(e.ui.favoritesOnly,false);
 e.ui.openBook(2,e.book);assert.equal(e.ui.overlay.inert,false);e.ui.click({target:{closest:()=>target}});assert.equal(e.ui.favoritesOnly,true);
});

function motionFixture(){
 const e=fixture(),tracks=[],clones=[];e.scope.matchMedia=()=>({matches:false});
 const animate=(target,frames,options)=>{let done;const animation={finished:new Promise(resolve=>done=resolve),cancel(){this.cancelled=true;done();},finish:()=>done()};tracks.push({target,frames,options,animation});return animation;};
 e.scope.document.createElement=()=>{const clone=control();clone.style={};clone.animate=(frames,options)=>animate('cover',frames,options);clones.push(clone);return clone;};
 e.scope.document.body.appendChild=()=>{};
 e.ui.dialog.getBoundingClientRect=()=>({left:500,top:24,width:560,height:700});
 e.ui.dialog.animate=(frames,options)=>animate('drawer',frames,options);
 const backdrop=control();backdrop.animate=(frames,options)=>animate('backdrop',frames,options);e.nodes.set('.shelf-backdrop',backdrop);
 const slot=control();slot.getBoundingClientRect=()=>({left:528,top:52,width:92,height:88});e.nodes.set('.shelf-drawer-cover-slot',slot);
 return Object.assign(e,{tracks,clones});
}

test('cover and drawer motion start together and animate only transform and opacity',async()=>{
 const e=motionFixture();e.ui.openBook(2,e.book);
 assert(e.tracks.some(t=>t.target==='backdrop'),'backdrop fades with the drawer instead of appearing abruptly');
 assert(e.tracks.some(t=>t.target==='cover'),'keep the selected cover transition');
 for(const track of e.tracks){
  assert.equal(track.options.delay||0,0,'the drawer must respond immediately');
  assert(track.options.duration<=300,'one short transition, without staged waiting');
  for(const frame of track.frames)for(const key of Object.keys(frame))assert(['transform','opacity','offset','easing'].includes(key),'layout property animated: '+key);
 }
 for(const track of e.tracks)track.animation.finish();await Promise.resolve();await Promise.resolve();
});

test('cover lands at the drawer thumbnail instead of stretching across the course panel',()=>{
 const e=motionFixture();e.ui.openBook(2,e.book);const cover=e.tracks.find(t=>t.target==='cover');
 assert.equal(e.clones[0].style.width,'170px');assert.equal(e.clones[0].style.height,'164px');
 assert.match(cover.frames.at(-1).transform,/translate/);assert.match(cover.frames.at(-1).transform,/scale/);
 assert.equal(e.clones[0].style.transformOrigin,'top left');
});

test('interrupting an open with close removes old layers and completes focus restoration',async()=>{
 const e=motionFixture();e.ui.openBook(2,e.book);const old=e.tracks.slice(),closing=e.ui.closeDrawer();
 assert(old.every(t=>t.animation.cancelled));assert.equal(e.clones[0].removed,true);assert.equal(e.ui.overlay.inert,true);
 e.tracks.slice(old.length).forEach(t=>t.animation.finish());await closing;
 assert.equal(e.ui.overlay.hidden,true);assert.equal(e.ui.root.inert,false);assert.equal(e.book.focused,true);assert.equal(e.ui.zoomCover,null);
 assert(e.tracks.every(t=>t.animation.cancelled),'completed animation effects must release their compositor layers');
});

test('closing during opening starts from the visible drawer pose instead of jumping fully open',()=>{
 const e=motionFixture();e.scope.getComputedStyle=node=>node===e.ui.dialog?{transform:'matrix(1, 0, 0, 1, 0, 12)',opacity:'.45'}:{opacity:'.6'};
 e.ui.openBook(2,e.book);const count=e.tracks.length;e.ui.closeDrawer();
 const drawer=e.tracks.slice(count).find(t=>t.target==='drawer'),backdrop=e.tracks.slice(count).find(t=>t.target==='backdrop');
 assert.equal(drawer.frames[0].opacity,'.45');assert.equal(drawer.frames[0].transform,'matrix(1, 0, 0, 1, 0, 12)');assert.equal(backdrop.frames[0].opacity,'.6');
});
