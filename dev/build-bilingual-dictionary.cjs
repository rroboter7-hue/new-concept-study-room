#!/usr/bin/env node
'use strict';
// Offline build only. ECDICT is parsed as CSV data, never loaded as JavaScript.
// Download the pinned CSV/LICENSE separately; this CLI never makes network requests.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const COMMIT='ab22ad36302cafc6349a050e2b60894855208055';
const RAW='https://raw.githubusercontent.com/skywind3000/ECDICT/'+COMMIT;
const PINNED_SOURCE=Object.freeze({name:'ECDICT',commit:COMMIT,repository:'https://github.com/skywind3000/ECDICT',csvUrl:RAW+'/ecdict.csv',csvSha256:'d1ecbdf9ee2b920afb6f430ca6b6bb9f559588cf0dff86e04bd255f9390843cc',licenseUrl:RAW+'/LICENSE',licenseSha256:'f8552dd246f61a4e064569eae6194a01c6b3d63b03bf27c6ca863593c549ed0f',licenseName:'MIT',copyright:'Copyright (c) 2025 Linwei',exchangeDocumentation:RAW+'/README.md'});
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const normalize=value=>typeof value==='string'?value.normalize('NFKC').replace(/[‘’]/g,"'").trim().toLowerCase():'';
const wordOf=value=>{const word=normalize(value);return word.length<=64&&/^[a-z]+(?:[-'][a-z]+)*$/.test(word)?word:'';};
const clean=(value,limit=1200)=>String(value??'').replace(/\\r\\n|\\n|\\r/g,'\n').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,limit);
const chinese=value=>/[\u3400-\u9fff]/.test(value);
const english=value=>/[A-Za-z]/.test(value);
const alphabet=Array.from({length:26},(_,index)=>String.fromCharCode(97+index));
const CORE_POLICY='ECDICT oxford=1, tag containing zk/gk/cet4, or a positive bnc/frq rank <=3000; only valid single-word keys are included.';

class CSVDecoder {
  constructor(){this.row=[];this.field='';this.quoted=false;this.pendingQuote=false;this.closed=false;}
  feed(chunk,final=false){
    const rows=[];
    const field=()=>{this.row.push(this.field);this.field='';this.closed=false;};
    const row=()=>{field();if(this.row.some(value=>value!==''))rows.push(this.row);this.row=[];};
    for(const char of chunk){
      if(this.quoted){
        if(!this.pendingQuote){if(char==='"')this.pendingQuote=true;else this.field+=char;continue;}
        if(char==='"'){this.field+='"';this.pendingQuote=false;continue;}
        this.quoted=false;this.pendingQuote=false;this.closed=true;
      }
      if(this.closed){
        if(char===',')field();else if(char==='\n')row();else if(!/[\r \t]/.test(char))throw new Error('Unexpected text after a quoted CSV field.');
      }else if(char==='"'){
        if(this.field!=='')throw new Error('Unexpected quote in an unquoted CSV field.');
        this.quoted=true;
      }else if(char===',')field();else if(char==='\n')row();else if(char!=='\r')this.field+=char;
      if(this.field.length>2_000_000)throw new Error('CSV field exceeds the supported data bound.');
    }
    if(final){
      if(this.quoted&&!this.pendingQuote)throw new Error('Unclosed quoted CSV field.');
      this.quoted=false;this.pendingQuote=false;
      if(this.field!==''||this.row.length)row();
    }
    return rows;
  }
}

async function* readCSV(file){
  const decoder=new CSVDecoder();let header=null;
  const consume=function*(rows){for(const values of rows){
    if(!header){header=values.map((value,index)=>(index===0?value.replace(/^\uFEFF/,''):value).trim());for(const name of ['word','definition','translation','phonetic','exchange'])if(!header.includes(name))throw new Error('ECDICT CSV missing column: '+name);continue;}
    if(values.length!==header.length)throw new Error('ECDICT CSV row has '+values.length+' columns; expected '+header.length+'.');
    yield Object.fromEntries(header.map((name,index)=>[name,values[index]]));
  }};
  for await(const chunk of fs.createReadStream(file,{encoding:'utf8',highWaterMark:256*1024}))yield* consume(decoder.feed(chunk));
  yield* consume(decoder.feed('',true));
  if(!header)throw new Error('ECDICT CSV has no header.');
}

function collectProjectWords(projectRoot=path.resolve(__dirname,'..')){
  const root=path.resolve(projectRoot),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(match=>match[1].split(/[?#]/)[0]);
  const inputs=[{file:'index.html',sha256:sha(Buffer.from(html))}];
  const document={addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{},body:{classList:{add(){},remove(){},contains(){return false;}}}};
  const scope={console,document,URL,navigator:{},location:{href:'https://dictionary-build.invalid/',search:''},setTimeout(){return 0;},clearTimeout(){},addEventListener(){},removeEventListener(){}};
  scope.window=scope;vm.createContext(scope);
  for(const file of scripts){
    if(file==='app.js')continue; // UI bootstrap is not needed to inspect final course data.
    if(!file||/^[a-z]+:|^\/\//i.test(file))throw new Error('Corpus extraction accepts only repository-local scripts: '+file);
    const absolute=path.resolve(root,file);
    if(!absolute.startsWith(root+path.sep))throw new Error('Script leaves project root: '+file);
    const data=fs.readFileSync(absolute);
    // These are this repository's trusted source files, not ECDICT or downloaded code.
    vm.runInContext(data.toString('utf8'),scope,{filename:file,timeout:15_000});
    inputs.push({file,sha256:sha(data)});
  }
  // JSON bodies are intentionally absent from the browser's initial catalog.
  // Corpus generation is offline: read the same local bodies explicitly and
  // record their hashes so rebuilding the dictionary retains all source words.
  for(const descriptor of scope.TEXT_LIBRARY||[]){
    if(!descriptor.dataUrl||Array.isArray(descriptor.sections))continue;
    const document=require('./extract-text-library.cjs').readDocument(root,descriptor.dataUrl);
    descriptor.sections=document.sections;inputs.push({file:document.file,sha256:sha(document.bytes)});
  }
  const words=new Set(),seen=new WeakSet();
  const textFields=new Set(['word','phrase','en','zh','lines','english','title','subtitle','topic','meaning','example','examples','question','options','answer','explanation','rule','note','sentence','sourceSentence','contrastExamples','keyPoints','prompt','text','content','matchedForm']);
  const metadata=new Set(['origin','source','sourceUrl','url','audio','phonetic','pos','id','conceptId','sourceDocId','sourceSectionIndex','sourcePages','sourcePage','sha256','sourceName']);
  const add=value=>{for(const match of String(value).matchAll(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g)){const word=wordOf(match[0]);if(word)words.add(word);}};
  const walk=(value,isText=false)=>{
    if(typeof value==='string'){if(isText)add(value);return;}
    if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    if(Array.isArray(value)){for(const item of value)walk(item,isText);return;}
    for(const [key,item]of Object.entries(value))if(!metadata.has(key))walk(item,textFields.has(key));
  };
  for(const data of [scope.LESSONS,scope.TEXT_LIBRARY,scope.STUDY_GLOSSARY,scope.BOOK2_PRACTICE_PACKS])walk(data);
  for(const key of Object.keys(scope.STUDY_GLOSSARY||{}))add(key);
  const bank=scope.StudyKnowledge?.bank;
  for(const lesson of scope.LESSONS||[]){
    if(bank?.questionsForLesson)walk(bank.questionsForLesson(lesson.id));
    if(bank?.vocabularyForLesson)walk(bank.vocabularyForLesson(lesson.id));
  }
  return {words,inputs,counts:{lessons:scope.LESSONS?.length||0,textLibraryDocuments:scope.TEXT_LIBRARY?.length||0,glossaryEntries:Object.keys(scope.STUDY_GLOSSARY||{}).length},policy:'ASCII English tokens matching the app wordHTML click boundaries (curly apostrophes normalized), from learner-facing fields in final LESSONS/TEXT_LIBRARY/STUDY_GLOSSARY/practice packs/knowledge-bank questions; metadata URLs and identifiers excluded. Includes mixed source notes and OCR fragments; unavailable tokens are listed, not guessed.'};
}

function exchangeOf(value){
  const result=new Map();
  for(const part of String(value||'').split('/')){
    const colon=part.indexOf(':');if(colon<0)continue;const kind=part.slice(0,colon);
    if(!['p','d','i','3','r','t','s','0'].includes(kind))continue;
    const words=part.slice(colon+1).split(',').map(wordOf).filter(Boolean);
    if(words.length)result.set(kind,[...new Set(words)]);
  }
  return result;
}
function recordOf(row){
  const key=wordOf(row.word);if(!key)return null;
  const translation=clean(row.translation),definition=clean(row.definition);
  return {key,word:clean(row.word,64),translation:chinese(translation)?translation:'',definition:english(definition)?definition:'',phonetic:clean(row.phonetic,120),exchange:exchangeOf(row.exchange),inflection:/(?:^|\/)1:[pdi3rts]+(?:\/|$)/.test(row.exchange||'')};
}
function keepRecord(records,record){
  const old=records.get(record.key);
  const rank=item=>(item.word===item.key?100:0)+(item.translation?2:0)+(item.definition?1:0);
  if(!old||rank(record)>rank(old))records.set(record.key,record);
}
function coreWord(row){
  const tags=String(row.tag||'').split(/\s+/),rank=value=>Number(value)>0&&Number(value)<=3000;
  return row.oxford==='1'||tags.some(tag=>['zk','gk','cet4'].includes(tag))||rank(row.bnc)||rank(row.frq);
}
// ECDICT contains noisy links such as hed -> h and PP -> p. Those alphabet
// definitions cannot reliably explain a longer abbreviation, even with a 0: edge.
const safeLemma=(word,lemma)=>word.length<=1||lemma.length>1;
function inflectionHeadword(record,records){
  const bases=record.exchange.get('0');
  if(!record.inflection||bases?.length!==1||!safeLemma(record.key,bases[0])||[...record.exchange.keys()].some(kind=>kind!=='0'))return '';
  const base=records.get(bases[0]);if(!base)return '';
  // A source row such as went already has English senses but explicitly says
  // "go的过去式". Expose that documented form relation without replacing senses.
  // A row such as saw (锯; see的过去式) is an independent sense and does not match.
  const description=record.translation.replace(/^[a-z]{1,6}\.\s*/i,'').toLowerCase(),prefix=bases[0]+'的';
  return description.startsWith(prefix)&&/^(?:(?:过去式|过去分词|现在分词|第三人称单数|复数|比较级|最高级)(?:形式)?(?:[、，,\/ ]|和|及|或)*)+[。.]?$/.test(description.slice(prefix.length))?base.word:'';
}
async function fileHash(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}

async function buildDictionary(options={}){
  const {csvPath,licensePath,includeCore=true}=options,source=options.source||PINNED_SOURCE;
  if(!csvPath||!licensePath)throw new Error('Explicit local --csv and --license paths are required; this builder never downloads data.');
  const sourceHash=await fileHash(csvPath);
  if(sourceHash!==source.csvSha256)throw new Error('CSV SHA256 mismatch for pinned source.');
  const license=fs.readFileSync(licensePath),licenseHash=sha(license);
  if(licenseHash!==source.licenseSha256)throw new Error('License SHA256 mismatch for pinned source.');
  const corpus=options.words?{words:new Set([...options.words].map(wordOf).filter(Boolean)),inputs:[],counts:{},policy:'Explicit caller-provided word list.'}:collectProjectWords(options.projectRoot);
  const wanted=corpus.words,core=new Set(),records=new Map(),reverse=new Map();
  let sourceRows=0,validRows=0,passes=1;
  for await(const row of readCSV(csvPath)){
    sourceRows++;const record=recordOf(row);if(!record)continue;validRows++;
    if(includeCore&&coreWord(row))core.add(record.key);
    let retain=wanted.has(record.key)||core.has(record.key);
    for(const [kind,forms]of record.exchange){if(kind==='0')continue;for(const form of forms)if(wanted.has(form)){
      if(!reverse.has(form))reverse.set(form,new Set());reverse.get(form).add(record.key);retain=true;
    }}
    if(retain)keepRecord(records,record);
  }
  // Follow only documented 0:lemma edges. Extra passes load needed base rows,
  // rather than retaining the entire 770k-row CSV in memory. Cycles are bounded.
  const attempted=new Set(records.keys());
  for(let depth=0;depth<8;depth++){
    const needed=new Set();for(const record of records.values()){const bases=record.exchange.get('0');if(bases?.length===1&&!attempted.has(bases[0]))needed.add(bases[0]);}
    if(!needed.size)break;passes++;
    for await(const row of readCSV(csvPath)){const key=wordOf(row.word);if(needed.has(key))keepRecord(records,recordOf(row));}
    for(const key of needed)attempted.add(key);
  }
  const resolve=(key,seen=new Set())=>{
    if(seen.has(key)||seen.size>=12)return null;seen=new Set(seen);seen.add(key);
    const record=records.get(key);
    if(!record){const candidates=reverse.get(key);if(candidates?.size!==1)return null;const base=[...candidates][0];if(!safeLemma(key,base))return null;const inherited=resolve(base,seen);return inherited?{entry:{...inherited.entry},method:'explicit-reverse-exchange'}:null;}
    const entry={translation:record.translation,definition:record.definition,phonetic:record.phonetic,headword:record.word};let method='exact';
    if(!entry.translation||!entry.definition){
      const bases=record.exchange.get('0'),inherited=bases?.length===1&&safeLemma(key,bases[0])?resolve(bases[0],seen):null;
      if(inherited){const base=inherited.entry,filled=(!entry.translation&&base.translation)||(!entry.definition&&base.definition);
        entry.translation=entry.translation||base.translation;entry.definition=entry.definition||base.definition;
        if(filled){entry.headword=base.headword;entry.phonetic=entry.phonetic||base.phonetic;method='explicit-lemma';}
      }
    }
    if(method==='exact')entry.headword=inflectionHeadword(record,records)||entry.headword;
    return entry.translation||entry.definition?{entry,method}:null;
  };
  const selected=[...new Set([...wanted,...core])].sort(),shards=Object.fromEntries(alphabet.map(letter=>[letter,{version:1,entries:Object.create(null)}])),methods={exact:0,'explicit-lemma':0,'explicit-reverse-exchange':0};
  for(const word of selected){const result=resolve(word);if(result){shards[word[0]].entries[word]=result.entry;methods[result.method]++;}}
  const all=Object.assign(Object.create(null),...Object.values(shards).map(shard=>shard.entries));
  const requested=[...wanted].sort(),recorded=requested.filter(word=>all[word]);
  const coverage={requested:requested.length,recorded:recorded.length,bilingual:recorded.filter(word=>all[word].translation&&all[word].definition).length,chinese:recorded.filter(word=>all[word].translation).length,english:recorded.filter(word=>all[word].definition).length,unrecorded:requested.filter(word=>!all[word]),missingChinese:recorded.filter(word=>!all[word].translation),missingEnglish:recorded.filter(word=>!all[word].definition)};
  const payloads=alphabet.map(letter=>({file:letter+'.json',data:Buffer.from(JSON.stringify(shards[letter])+'\n'),entries:Object.keys(shards[letter].entries).length}));
  const metadata={version:1,name:source.name,repository:source.repository,commit:source.commit,url:source.csvUrl,sha256:sourceHash,sourceBytes:fs.statSync(csvPath).size,license:{name:source.licenseName,copyright:source.copyright,file:'LICENSE',url:source.licenseUrl,sha256:licenseHash},counts:{sourceRows,validSingleWordRows:validRows,entries:Object.keys(all).length,coreSelected:core.size,bilingual:Object.values(all).filter(entry=>entry.translation&&entry.definition).length,chinese:Object.values(all).filter(entry=>entry.translation).length,english:Object.values(all).filter(entry=>entry.definition).length,methods,csvPasses:passes},selection:{core:includeCore?CORE_POLICY:'Disabled.',corpusPolicy:corpus.policy,corpusCounts:corpus.counts,inputs:corpus.inputs},coverage,derivation:{documentation:source.exchangeDocumentation||'',policy:'Exact fields win. Missing Chinese/English fields may use the exact row\'s single documented 0:lemma. A missing exact row may use a unique literal p/d/i/3/r/t/s reverse mapping; collisions are skipped. No suffix stemming, translation generation or unlisted lemma guesses. Multi-letter to single-letter links are declined because known source noise maps abbreviations to alphabet definitions. The headword identifies the documented base when used. Exact 0+1 inflection rows whose Chinese text solely names the base form (e.g. go的过去式) also expose that base without replacing either sense; standalone senses or rows with their own inflection families retain their own headword. Inflection and contextual sense still need review.',rejectedSingleLetterLemmas:selected.filter(word=>records.get(word)?.exchange.get('0')?.some(base=>!safeLemma(word,base))).map(word=>({word,lemmas:records.get(word).exchange.get('0')})),fieldLimits:{translation:1200,definition:1200,phonetic:120},ambiguousReverseCandidates:requested.filter(word=>!records.has(word)&&reverse.get(word)?.size>1)},shards:payloads.map(item=>({file:item.file,entries:item.entries,bytes:item.data.length,sha256:sha(item.data)})),rebuild:'node dev/build-bilingual-dictionary.cjs --csv <local pinned ecdict.csv> --license <local pinned LICENSE> [--project <repo>] [--out <dictionary-data>] (offline; no automatic download)'};
  const outputDir=path.resolve(options.outputDir||path.join(__dirname,'..','dictionary-data'));
  fs.mkdirSync(outputDir,{recursive:true});
  for(const item of payloads)fs.writeFileSync(path.join(outputDir,item.file),item.data);
  fs.writeFileSync(path.join(outputDir,'LICENSE'),license);
  fs.writeFileSync(path.join(outputDir,'source.json'),JSON.stringify(metadata,null,2)+'\n');
  return metadata;
}

async function main(args){
  if(args.includes('--help')){console.log('Offline ECDICT shard builder.\nUsage: node dev/build-bilingual-dictionary.cjs --csv <local CSV> --license <local LICENSE> [--project <repo>] [--out <output>]\nNo network access is performed. CSV and license SHA256 must match the fixed official commit '+COMMIT+'.');return;}
  const options={};for(let index=0;index<args.length;index++){const key=args[index],value=args[++index];if(!['--csv','--license','--project','--out'].includes(key)||!value||value.startsWith('--'))throw new Error('Unknown or incomplete CLI option: '+key);options[{'--csv':'csvPath','--license':'licensePath','--project':'projectRoot','--out':'outputDir'}[key]]=path.resolve(value);}
  const result=await buildDictionary(options);console.log(JSON.stringify({entries:result.counts.entries,bytes:result.shards.reduce((sum,item)=>sum+item.bytes,0),corpusCoverage:result.coverage.recorded+'/'+result.coverage.requested,bilingualCoverage:result.coverage.bilingual+'/'+result.coverage.requested,unrecorded:result.coverage.unrecorded.length,commit:result.commit},null,2));
}
module.exports={buildDictionary,collectProjectWords,PINNED_SOURCE};
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
