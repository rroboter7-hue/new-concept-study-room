'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const generator=path.join(root,'dev','build-bilingual-dictionary.cjs');
const builder=fs.existsSync(generator)?require(generator):{};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const header=['word','phonetic','definition','translation','pos','collins','oxford','tag','bnc','frq','exchange','detail','audio'];
const csvRow=row=>header.map(key=>'"'+String(row[key]??'').replace(/"/g,'""')+'"').join(',');

function fixture(t,rows){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zhixin-bilingual-build-'));
  t.after(()=>{assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(temp,{recursive:true,force:true});});
  const csv='\uFEFF'+header.join(',')+'\r\n'+rows.map(csvRow).join('\r\n')+'\r\n';
  const csvPath=path.join(temp,'sample.csv'),licensePath=path.join(temp,'LICENSE'),outputDir=path.join(temp,'dictionary-data');
  fs.writeFileSync(csvPath,csv);fs.writeFileSync(licensePath,'Fixture license text.\n');
  const source={name:'ECDICT test fixture',commit:'1'.repeat(40),repository:'https://example.test/ecdict-fixture',csvUrl:'https://example.test/fixture.csv',csvSha256:sha(csv),licenseUrl:'https://example.test/LICENSE',licenseSha256:sha('Fixture license text.\n'),licenseName:'Fixture',copyright:'Fixture copyright'};
  return {temp,csvPath,licensePath,outputDir,source};
}
async function build(options){assert.equal(typeof builder.buildDictionary,'function','offline ECDICT dictionary builder is required');return builder.buildDictionary(options);}
const entries=directory=>Object.assign({},...Array.from({length:26},(_,index)=>JSON.parse(fs.readFileSync(path.join(directory,String.fromCharCode(97+index)+'.json'),'utf8')).entries));

test('fixture CSV preserves exact senses, literal newlines and quoted multiline fields while using only documented lemma relationships',async t=>{
  const f=fixture(t,[
    {word:'book',phonetic:'bʊk',definition:'A written work, printed or digital.\\nA register.',translation:'n. 书\\n登记簿',exchange:'s:books'},
    {word:'books',translation:'n. 书籍（精确词义）',exchange:'0:book/1:s'},
    {word:'see',definition:'Perceive with the eyes.',translation:'看见'},
    {word:'saw',phonetic:'sɔː',definition:'A tool, with a toothed blade.',translation:'锯',exchange:'0:see/1:p'},
    {word:'walk',definition:'Move on foot.',translation:'行走',exchange:'p:walked/i:walking'},
    {word:'quotes',definition:'Say "hello", then leave.\nA second line.',translation:'引号'},
    {word:'alpha',definition:'First base.',translation:'第一原形',exchange:'p:shared'},
    {word:'beta',definition:'Second base.',translation:'第二原形',exchange:'p:shared'},
    {word:'missing-lemma',translation:'保留精确中文',exchange:'0:unknown-lemma'},
    {word:'long',definition:'a'.repeat(1250),translation:'长'.repeat(1250)},
    {word:'us',definition:'The objective case of we.',translation:'我们'},
    {word:'US',definition:'United States.',translation:'美国'},
    {word:'play',definition:'Engage in activity.',translation:'玩',oxford:'1'},
    {word:'not-requested',definition:'Do not package every row.',translation:'不应收入'}
  ]);
  await build({...f,words:['books','saw','walked','quotes','shared','bookses','missing-lemma','long','us']});
  const actual=entries(f.outputDir);
  assert.deepEqual(actual.books,{translation:'n. 书籍（精确词义）',definition:'A written work, printed or digital.\nA register.',phonetic:'bʊk',headword:'book'});
  assert.deepEqual(actual.saw,{translation:'锯',definition:'A tool, with a toothed blade.',phonetic:'sɔː',headword:'saw'},'a 0:lemma must never replace a complete exact sense');
  assert.deepEqual(actual.walked,{translation:'行走',definition:'Move on foot.',phonetic:'',headword:'walk'});
  assert.equal(actual.quotes.definition,'Say "hello", then leave.\nA second line.');
  assert.equal(actual.long.definition.length,1200);assert.equal(actual.long.translation.length,1200);
  assert.equal(actual.us.translation,'我们','normalized lowercase exact row wins over an acronym');
  assert.equal(actual['missing-lemma'].definition,'');assert.equal(actual['missing-lemma'].headword,'missing-lemma');
  assert.ok(actual.play,'official common-word flags add a core word');
  assert.equal(actual.shared,undefined,'ambiguous explicit reverse lemmas are skipped');
  assert.equal(actual.bookses,undefined,'suffix guessing must never invent a lemma');
  assert.equal(actual['not-requested'],undefined);
});

test('all 26 shards have the client contract and provenance measures missing and bilingual coverage honestly',async t=>{
  const f=fixture(t,[{word:'hello',definition:'A greeting.',translation:'你好'},{word:'partial',translation:'部分'},{word:'english-only',definition:'An English definition.'}]);
  await build({...f,words:['hello','partial','english-only','absent'],includeCore:false});
  for(let index=0;index<26;index++){
    const letter=String.fromCharCode(97+index),shard=JSON.parse(fs.readFileSync(path.join(f.outputDir,letter+'.json'),'utf8'));
    assert.equal(shard.version,1);
    for(const [word,value]of Object.entries(shard.entries)){assert.equal(word[0],letter);assert.deepEqual(Object.keys(value),['translation','definition','phonetic','headword']);}
  }
  const source=JSON.parse(fs.readFileSync(path.join(f.outputDir,'source.json'),'utf8'));
  assert.equal(source.commit,'1'.repeat(40));assert.equal(source.sha256,f.source.csvSha256);
  assert.equal(source.counts.entries,3);assert.equal(source.coverage.requested,4);assert.equal(source.coverage.recorded,3);
  assert.equal(source.coverage.bilingual,1);assert.deepEqual(source.coverage.unrecorded,['absent']);
  assert.deepEqual(source.coverage.missingEnglish,['partial']);assert.deepEqual(source.coverage.missingChinese,['english-only']);
  assert.equal(source.license.sha256,f.source.licenseSha256);assert.equal(fs.readFileSync(path.join(f.outputDir,'LICENSE'),'utf8'),'Fixture license text.\n');
  assert.equal(source.shards.length,26);
  for(const item of source.shards){const data=fs.readFileSync(path.join(f.outputDir,item.file));assert.equal(item.bytes,data.length);assert.equal(item.sha256,sha(data));}
  const before=fs.readFileSync(path.join(f.outputDir,'source.json'),'utf8');await build({...f,words:['hello','partial','english-only','absent'],includeCore:false});
  assert.equal(fs.readFileSync(path.join(f.outputDir,'source.json'),'utf8'),before,'same inputs rebuild byte-for-byte');
});

test('explicit lemma chains are bounded and cycles cannot synthesize definitions',async t=>{
  const f=fixture(t,[{word:'outer',exchange:'0:middle'},{word:'middle',exchange:'0:inner'},{word:'inner',definition:'The documented base.',translation:'明确原形'},{word:'cycle-a',exchange:'0:cycle-b'},{word:'cycle-b',exchange:'0:cycle-a'}]);
  await build({...f,words:['outer','cycle-a'],includeCore:false});
  const actual=entries(f.outputDir);assert.equal(actual.outer.headword,'inner');assert.equal(actual.outer.translation,'明确原形');assert.equal(actual['cycle-a'],undefined);
});

test('noisy multi-letter-to-single-letter exchange links cannot turn abbreviations into alphabet definitions',async t=>{
  const f=fixture(t,[{word:'h',definition:'The eighth letter of the alphabet.',translation:'字母H'},{word:'hed',translation:'高能检波器',exchange:'0:h'},
    {word:'p',definition:'The sixteenth letter of the alphabet.',translation:'字母P',exchange:'s:pp'},{word:'PP',translation:'过去分词；包裹邮政',exchange:'0:p'},
    {word:'other',definition:'Not the same one.',translation:'其他的'},{word:'others',translation:'其余的人或事物',exchange:'0:other/1:s'}]);
  await build({...f,words:['hed','pp','others'],includeCore:false});
  const actual=entries(f.outputDir);
  assert.deepEqual(actual.hed,{translation:'高能检波器',definition:'',phonetic:'',headword:'hed'});
  assert.deepEqual(actual.pp,{translation:'过去分词；包裹邮政',definition:'',phonetic:'',headword:'PP'});
  assert.equal(actual.others.definition,'Not the same one.');assert.equal(actual.others.headword,'other');
});

test('documented past-form provenance is visible when exact source rows already repeat lemma meanings or need a missing field',async t=>{
  const f=fixture(t,[{word:'go',definition:'Move or travel somewhere.',translation:'去；走',phonetic:'gou',exchange:'p:went/d:gone'},
    {word:'went',definition:'v change location; move, travel, or proceed',translation:'go的过去式',phonetic:'went',exchange:'0:go/1:p'},
    {word:'gone',translation:'go的过去分词',exchange:'0:go/1:d'},
    {word:'see',definition:'Perceive with the eyes.',translation:'看见'},
    {word:'saw',definition:'A tool with a toothed blade.',translation:'锯；see的过去式',exchange:'0:see/1:p/i:sawing/p:sawed'}]);
  await build({...f,words:['went','gone','saw'],includeCore:false});
  const actual=entries(f.outputDir);
  assert.deepEqual(actual.went,{translation:'go的过去式',definition:'v change location; move, travel, or proceed',phonetic:'went',headword:'go'},'exact text stays intact while the documented original form remains visible');
  assert.deepEqual(actual.gone,{translation:'go的过去分词',definition:'Move or travel somewhere.',phonetic:'gou',headword:'go'},'a field supplied by another headword identifies its real source');
  assert.equal(actual.saw.headword,'saw','an independent exact sense keeps its own headword');
});

test('mismatched source or license hashes fail before any output is written',async t=>{
  const f=fixture(t,[{word:'hello',definition:'A greeting.',translation:'你好'}]);
  await assert.rejects(()=>build({...f,words:['hello'],source:{...f.source,csvSha256:'0'.repeat(64)}}),/SHA256|hash/i);
  assert.equal(fs.existsSync(f.outputDir),false);
  await assert.rejects(()=>build({...f,words:['hello'],source:{...f.source,licenseSha256:'0'.repeat(64)}}),/license.*SHA256|license.*hash/i);
  assert.equal(fs.existsSync(f.outputDir),false);
});

test('project corpus follows index data patches and clicked-token boundaries without treating metadata URLs as learning text',t=>{
  assert.equal(typeof builder.collectProjectWords,'function','actual project corpus collector is required');
  const f=fixture(t,[]),project=path.join(f.temp,'project');fs.mkdirSync(project);
  fs.writeFileSync(path.join(project,'index.html'),'<script src="data.js?build=fixture"></script><script src="patch.js"></script><script src="app.js"></script>');
  fs.writeFileSync(path.join(project,'data.js'),`window.LESSONS=[{id:'wrong-metadata',sourceUrl:'https://ignore-noise.invalid/hash',paragraphs:[{en:'She’s sending e-mails.'}],vocabulary:[{word:'book'}],lines:['RUN quietly.']}];window.TEXT_LIBRARY=[{sections:[{lines:['Look at a postcard.']}]}];window.STUDY_GLOSSARY={study:{word:'study',example:'We learn daily.'}};`);
  fs.writeFileSync(path.join(project,'patch.js'),`window.LESSONS[0].paragraphs.push({en:'They talked yesterday.'});`);
  fs.writeFileSync(path.join(project,'app.js'),`throw new Error('app bootstrap must not execute during data collection');`);
  const result=builder.collectProjectWords(project),words=[...result.words];
  for(const word of ["she's",'sending','e-mails','book','run','quietly','look','postcard','study','learn','talked','yesterday'])assert.ok(words.includes(word),word+' is extracted from final learning content');
  for(const word of ['wrong-metadata','https','ignore-noise','invalid','hash'])assert.equal(words.includes(word),false);
  assert.deepEqual(result.inputs.map(input=>input.file),['index.html','data.js','patch.js']);
});

test('packaged shards retain their pinned license, bounded client fields, bilingual examples and honest manifest checksums',()=>{
  const directory=path.join(root,'dictionary-data'),source=JSON.parse(fs.readFileSync(path.join(directory,'source.json'),'utf8'));
  assert.equal(source.commit,'ab22ad36302cafc6349a050e2b60894855208055');
  assert.equal(source.sha256,'d1ecbdf9ee2b920afb6f430ca6b6bb9f559588cf0dff86e04bd255f9390843cc');
  assert.equal(sha(fs.readFileSync(path.join(directory,'LICENSE'))),'f8552dd246f61a4e064569eae6194a01c6b3d63b03bf27c6ca863593c549ed0f');
  assert.match(fs.readFileSync(path.join(directory,'LICENSE'),'utf8'),/MIT License[\s\S]*Copyright \(c\) 2025 Linwei/);
  assert.equal(fs.readdirSync(directory).length,28,'only 26 shards, provenance and license are packaged, never the full source CSV');
  const actual=entries(directory);
  for(const [word,value]of Object.entries(actual)){
    assert.match(word,/^[a-z]+(?:[-'][a-z]+)*$/);assert.ok(word.length<=64);
    assert.deepEqual(Object.keys(value),['translation','definition','phonetic','headword']);
    for(const field of ['translation','definition','phonetic','headword'])assert.equal(typeof value[field],'string');
    assert.ok(value.translation.length<=1200&&value.definition.length<=1200&&value.phonetic.length<=120);
    assert.ok(value.translation||value.definition);assert.ok(value.headword);
  }
  for(const word of ['theatre','went','private','puma','fossil']){
    assert.match(actual[word].translation,/[\u3400-\u9fff]/);assert.match(actual[word].definition,/[A-Za-z]/);
  }
  assert.equal(actual.went.headword,'go');assert.equal(actual.went.translation,'go的过去式');
  for(const word of ['hed','pp'])assert.equal(actual[word].definition,'','no alphabet meaning is presented as the abbreviation definition');
  assert.equal(source.counts.entries,Object.keys(actual).length);
  for(const item of source.shards){const data=fs.readFileSync(path.join(directory,item.file));assert.equal(item.sha256,sha(data));assert.equal(item.bytes,data.length);}
  for(const word of source.coverage.unrecorded)assert.equal(actual[word],undefined);
  for(const word of source.coverage.missingEnglish)assert.equal(actual[word].definition,'');
  for(const word of source.coverage.missingChinese)assert.equal(actual[word].translation,'');
});
