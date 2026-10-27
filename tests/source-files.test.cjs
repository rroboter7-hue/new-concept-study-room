const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),file=path.join(root,'source-files.js');
const sources=fs.existsSync(file)?require(file):{};
const book2='resources/30f1219bd738cfbf.pdf',paper='resources/cebcdf4e922d21aa.pdf';

test('the public archive manifest lists exactly the fourteen converted or superseded sources',()=>{
  assert.equal(sources.archivedSources?.length,14);assert.equal(sources.totalArchivedBytes,123736322);
  assert.equal(new Set(sources.archivedSources.map(x=>x.url)).size,14);
  for(const item of sources.archivedSources){assert.match(item.url,/^resources\/[a-f0-9]{16}\.pdf$/);assert.match(item.sha256,/^[a-f0-9]{64}$/);assert.ok(item.sizeBytes>0);assert.ok(item.title);assert.ok(Object.isFrozen(item));}
});

test('archived PDF page and query variants cannot generate a public download URL',()=>{
  assert.equal(typeof sources.isArchived,'function');
  for(const value of [book2,book2+'#page=15',book2+'?download=1#page=15','./'+book2,'/'+book2,'/new-concept-study-room/'+book2,'https://rroboter7-hue.github.io/new-concept-study-room/'+book2]){
    assert.equal(sources.isArchived(value),true,value);assert.equal(sources.publicUrl(value),'');assert.equal(sources.archiveInfo(value).url,book2);
  }
});

test('printable paper and unrelated external or imported sources remain available',()=>{
  assert.equal(typeof sources.publicUrl,'function');
  for(const value of [paper,paper+'#page=1','https://example.org/'+book2,'blob:local-import','resources/not-an-archived-file.pdf']){
    assert.equal(sources.isArchived(value),false,value);assert.equal(sources.publicUrl(value),value);assert.equal(sources.archiveInfo(value),null);
  }
  for(const bad of [null,undefined,17,{},[]]){assert.equal(sources.isArchived(bad),false);assert.equal(sources.publicUrl(bad),'');}
});

test('published files exclude archived PDF binaries while retaining printable paper',()=>{
  assert.equal(sources.archivedSources?.length,14);
  for(const item of sources.archivedSources)assert.equal(fs.existsSync(path.join(root,item.url)),false,item.url);
  assert.equal(fs.statSync(path.join(root,paper)).size,286840);
  assert.deepEqual(fs.readdirSync(path.join(root,'resources')).filter(name=>name.endsWith('.pdf')),['cebcdf4e922d21aa.pdf']);
});

function shipped(){const c={document:{addEventListener(){}},URLSearchParams,location:{search:''}};c.window=c;vm.createContext(c);const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/<script defer src="([^"]+)"/g)){const name=m[1].split('?')[0];if(name==='app.js')break;vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c,{filename:name});}return {c,html};}

test('all four reading books and converted text remain usable after source PDF removal',()=>{
  const {c,html}=shipped();assert.ok(c.StudySourceFiles,'the actual public bootstrap must load the archive registry');
  assert.deepEqual([1,2,3,4].map(book=>c.LESSONS.filter(l=>l.book===book).length),[72,96,60,48]);
  for(const lesson of c.LESSONS){assert.ok(lesson.textbook?.verified);assert.ok(lesson.paragraphs.every(p=>p.en.trim()&&p.zh.trim()));assert.ok(lesson.textbook.sourceUrl);assert.ok(c.StudySourceFiles.isArchived(lesson.textbook.sourceUrl));assert.ok(c.STUDY_LESSON_AUDIO[lesson.id]);}
  assert.ok(html.indexOf('source-files.js')<html.indexOf('app.js'));
  const library=Array.isArray(c.TEXT_LIBRARY)?c.TEXT_LIBRARY:Object.values(c.TEXT_LIBRARY||{});
  assert.ok(library.length>=9);
  for(const item of c.STUDY_LIBRARY){if(c.StudySourceFiles.isArchived(item.url)){const text=library.find(row=>row.id===item.id);assert.ok(text,item.title);const sections=text.dataUrl?JSON.parse(fs.readFileSync(path.join(root,text.dataUrl),'utf8')).sections:text.sections;assert.ok(sections?.length,item.title);}}
});
