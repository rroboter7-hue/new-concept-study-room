#!/usr/bin/env node
'use strict';
// Offline compiler: trusted repository scripts are evaluated in their public
// bootstrap order. Dictionary shards are read as JSON data, never executable code.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const DEFAULT_ROOT=path.resolve(__dirname,'..');
const lexical=require('../lexical-word-tokens.js');
const POLICY='First exact lexical spelling/form in learner-facing lesson.title then paragraphs[].en, in numeric book/lesson order. Shared lexical-word-tokens v1: complete numeric ordinal spans are preserved as text and excluded before lexical seen tracking; 21st-century contributes century, never st-century. Dotted St. is retained in source-bound quarantine until its Saint context is reviewed, never supplied a technical ST gloss. No stemming or global short-word blacklist. Other dictionary/course precedence and original vocabulary rows are preserved. This is corpus novelty, not learner mastery.';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
// Git may check scripts out with CRLF on Windows. Hash their UTF-8 text with
// LF endings; dictionary shards and LICENSE retain their original byte hashes.
const scriptText=value=>(Buffer.isBuffer(value)?value.toString('utf8'):String(value)).replace(/\r\n?/g,'\n');
const scriptHash=value=>hash(scriptText(value));
const HASH_ENCODING=Object.freeze({scriptInputs:'utf8-lf',tokenizer:'utf8-lf',generatedScript:'utf8-lf',dictionaryShards:'raw-bytes',dictionaryLicense:'raw-bytes',sourceBindings:'utf8-exact-logical-data'});
const normalize=value=>typeof value==='string'?value.replace(/[‘’]/g,"'").trim().toLowerCase():'';
// A finite set, not apostrophe/suffix inference. The dictionary still supplies
// the literal gloss; this exception only distinguishes contractions from acronyms.
const STANDARD_CONTRACTIONS=new Set(["i'm","you're","he's","she's","it's","we're","they're","i've","we've","they've","you've","i'll","we'll","they'll","you'll","isn't","aren't","wasn't","weren't","don't","doesn't","didn't","can't","couldn't","won't","wouldn't","shouldn't","mustn't","haven't","hasn't","hadn't","who's","let's","i'd"]);
const validMeaning=row=>row&&row.needsContextReview!==true&&typeof row.meaning==='string'&&/[\u3400-\u9fff]/.test(row.meaning)&&!/(?:释义待补充|待核释义|待核对|待补充|待审核)/.test(row.meaning);
const binding=lesson=>JSON.stringify([lesson.title,lesson.paragraphs.map(row=>row.en)]);

function collectCorpus(projectRoot=DEFAULT_ROOT){
  const root=path.resolve(projectRoot),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(match=>match[1].split(/[?#]/)[0]);
  const inputs=[];
  const document={addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{},body:{classList:{add(){},remove(){},contains(){return false;}}}};
  const scope={console,document,URL,URLSearchParams,navigator:{},location:{href:'https://lesson-word-build.invalid/',search:''},setTimeout(){return 0;},clearTimeout(){},addEventListener(){},removeEventListener(){}};
  scope.window=scope;vm.createContext(scope);
  for(const file of scripts){
    if(file==='app.js')break;
    if(file==='lesson-word-targets.js')continue;
    if(!file||/^[a-z]+:|^\/\//i.test(file))throw Error('Only repository-local bootstrap scripts are accepted: '+file);
    const absolute=path.resolve(root,file);
    if(!absolute.startsWith(root+path.sep))throw Error('Bootstrap script leaves project root: '+file);
    const data=fs.readFileSync(absolute);
    vm.runInContext(data.toString('utf8'),scope,{filename:file,timeout:15_000});
    inputs.push({file,sha256:scriptHash(data)});
  }
  if(!Array.isArray(scope.LESSONS))throw Error('Public bootstrap did not expose LESSONS.');
  return {lessons:JSON.parse(JSON.stringify(scope.LESSONS)),inputs};
}

function sentenceAt(text,offset,dottedSt=false){
  // These are literal passage slices, with no paraphrasing or generated examples.
  // Retain closing quotes; punctuation boundaries do not affect token novelty.
  const scanning=dottedSt?text.replace(/\bSt\./g,'St·'):text;
  for(const match of scanning.matchAll(/[^.!?\n]+(?:[.!?]+[’”"']*|$)/g)){
    if(offset>=match.index&&offset<match.index+match[0].length)return text.slice(match.index,match.index+match[0].length).trim();
  }
  return text.trim();
}
function dictionaryMeaning(entry,sourceWord){
  const translation=entry&&typeof entry.translation==='string'?entry.translation.trim():'';
  const lines=translation.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const abbreviationOnly=lines.length>0&&lines.every(line=>/^(?:abbr|abbrev|abbreviation)(?:\.|[:：]|\s|$)/i.test(line));
  if(abbreviationOnly&&!/^[A-Z]{2,}(?:[-'][A-Z]+)*$/.test(sourceWord)&&!STANDARD_CONTRACTIONS.has(normalize(sourceWord)))return '';
  return /[\u3400-\u9fff]/.test(translation)?translation:'';
}
function posOf(entry){
  const text=entry&&typeof entry.translation==='string'?entry.translation:'';
  return text.match(/^(?:n|v|vt|vi|a|adj|ad|adv|pron|prep|conj|interj|int|num|art|aux)\./i)?.[0]||'';
}
function createManifest(lessons,dictionary={},metadata={}){
  if(!Array.isArray(lessons))throw Error('Lessons must be an array.');
  const sorted=[...lessons].sort((a,b)=>a.book-b.book||a.number-b.number||String(a.id).localeCompare(String(b.id),'en'));
  const ids=new Set(),routes=new Set(),seen=new Set(),rows=[];
  let missingMeaning=0,activeWords=0,quarantinedFirstOccurrences=0,excludedOrdinalOccurrences=0;
  const byBook={1:0,2:0,3:0,4:0},lessonsByBook={1:0,2:0,3:0,4:0};
  for(const lesson of sorted){
    if(!lesson||typeof lesson.id!=='string'||!lesson.id||![1,2,3,4].includes(lesson.book)||!Number.isInteger(lesson.number)||lesson.number<1||typeof lesson.title!=='string'||!Array.isArray(lesson.paragraphs)||lesson.paragraphs.some(row=>!row||typeof row.en!=='string'))throw Error('Invalid reading lesson source: '+lesson?.id);
    const route=lesson.book+':'+lesson.number;
    if(ids.has(lesson.id)||routes.has(route))throw Error('Duplicate reading lesson id or book/number: '+lesson.id);
    ids.add(lesson.id);routes.add(route);lessonsByBook[lesson.book]++;
    const vocabulary=Array.isArray(lesson.vocabulary)?lesson.vocabulary:[],targets=[],quarantinedTargets=[],quarantinedOccurrences=[],excludedOrdinals=[];
    const sources=[{text:lesson.title,location:'title',paragraphIndex:null},...lesson.paragraphs.map((row,index)=>({text:row.en,location:'body',paragraphIndex:index}))];
    for(const source of sources)for(const token of lexical.scan(source.text)){
      const surface=token.surface,index=token.start,key=normalize(surface);
      if(token.kind==='ordinal'){excludedOrdinals.push({surface,sourceLocation:source.location,paragraphIndex:source.paragraphIndex,start:token.start,end:token.end,sourceSentence:source.location==='title'?source.text:sentenceAt(source.text,index),reason:'numeric-ordinal-not-an-independent-lexical-word'});excludedOrdinalOccurrences++;continue;}
      if(lexical.isDottedSt(source.text,token)){
        const first=!seen.has(key),occurrence={word:surface,sourceForm:surface+'.',sourceLessonId:lesson.id,sourceBook:lesson.book,sourceNumber:lesson.number,sourceTitle:lesson.title,sourceBodySha256:hash(lesson.paragraphs.map(p=>p.en).join('\n\n')),sourcePdfPage:lesson.textbook?.sourcePdfPage||null,sourceLocation:source.location,paragraphIndex:source.paragraphIndex,start:token.start,end:token.end+1,sourceSentence:source.location==='title'?source.text:sentenceAt(source.text,index,true),firstLexicalOccurrence:first,candidateExpansion:'Saint',active:false,practiceEligible:false,needsContextReview:true,reason:'Dotted St. requires context review; technical ST dictionary senses are not used.'};
        quarantinedOccurrences.push(occurrence);
        if(first){seen.add(key);quarantinedFirstOccurrences++;quarantinedTargets.push({...occurrence,meaning:'释义待语境核对',meaningMissing:true,meaningSource:'quarantined-abbreviation',needsContextReview:true,practiceEligible:false,isLessonNew:false});}
        continue;
      }
      if(seen.has(key))continue;seen.add(key);
      const original=vocabulary.find(row=>normalize(row?.word)===key&&validMeaning(row)),entry=dictionary[key];
      // Reviewed against the shipped B1L9 dialogue and Chinese line “托尼好吗？”.
      // This literal name occurrence must not inherit the adjective “tony”.
      const tonyName=!original&&lesson.id==='nce-b1-4be758-l009'&&lesson.book===1&&lesson.number===9&&lesson.title==='第9课 · How are you today?'&&surface==='Tony'&&source.location==='body'&&source.text==='How is Tony?';
      const meaning=original?.meaning.trim()||(tonyName?'人名（Tony）':dictionaryMeaning(entry,surface));
      const target={word:surface,meaning:meaning||'释义待补充',pos:original&&typeof original.pos==='string'?original.pos:tonyName?'n.':posOf(entry),sourceSentence:source.location==='title'?source.text:sentenceAt(source.text,index),sourceLocation:source.location,isLessonNew:true,meaningMissing:!meaning,meaningSource:original?'lesson-vocabulary':tonyName?'source-context-review':meaning?'ECDICT':'unavailable'};
      const phonetic=original&&typeof original.phonetic==='string'&&original.phonetic.trim()?original.phonetic:entry&&typeof entry.phonetic==='string'?entry.phonetic:'';
      if(phonetic)target.phonetic=phonetic;
      if(!original&&!tonyName&&meaning&&entry.headword)target.dictionaryHeadword=entry.headword;
      if(!meaning)missingMeaning++;
      targets.push(target);activeWords++;byBook[lesson.book]++;
    }
    // A sentence may introduce many words. Store its literal text once and keep
    // private indices in the artifact; the public API expands sourceSentence.
    const sourceSentences=[],sentenceIndices=new Map();
    for(const target of targets){
      if(!sentenceIndices.has(target.sourceSentence)){sentenceIndices.set(target.sourceSentence,sourceSentences.length);sourceSentences.push(target.sourceSentence);}
      target.sourceSentenceIndex=sentenceIndices.get(target.sourceSentence);delete target.sourceSentence;
    }
    const sourceBinding=binding(lesson);
    rows.push({id:lesson.id,book:lesson.book,number:lesson.number,sourceBinding,sourceSha256:hash(sourceBinding),sourceSentences,targets,quarantinedTargets,quarantinedOccurrences,excludedOrdinals});
  }
  return {version:2,policy:POLICY,hashEncoding:HASH_ENCODING,status:{lessons:rows.length,newWords:activeWords,missingMeaning,quarantinedFirstOccurrences,quarantinedOccurrences:rows.reduce((n,r)=>n+r.quarantinedOccurrences.length,0),excludedOrdinalOccurrences,byBook,lessonsByBook},inputs:metadata.inputs||[],dictionary:metadata.dictionary||null,tokenizer:{file:'lexical-word-tokens.js',version:lexical.version},lessons:rows};
}

// Stringified into the browser artifact, so this function has no Node dependency.
function installLessonWordTargets(payload){
  'use strict';
  var normalize=function(value){return typeof value==='string'?value.replace(/[‘’]/g,"'").trim().toLowerCase():'';};
  var clone=function(value){if(Array.isArray(value))return value.map(clone);if(value&&typeof value==='object'){var copy={};Object.keys(value).forEach(function(key){copy[key]=clone(value[key]);});return copy;}return value;};
  var validMeaning=function(row){return row&&row.needsContextReview!==true&&typeof row.meaning==='string'&&/[\u3400-\u9fff]/.test(row.meaning)&&!/(?:释义待补充|待核释义|待核对|待补充|待审核)/.test(row.meaning);};
  var index=Object.create(null);
  payload.lessons.forEach(function(row){row.source=JSON.parse(row.sourceBinding);index[row.id]=row;});
  function statusForLesson(lesson){
    var row=lesson&&index[lesson.id];
    if(!row)return {bound:false,reason:'unknown-lesson',newWords:0};
    var same=lesson.book===row.book&&lesson.number===row.number&&lesson.title===row.source[0]&&Array.isArray(lesson.paragraphs)&&lesson.paragraphs.length===row.source[1].length;
    // Array.every skips holes and accepts inherited indices. Binding requires
    // an own data paragraph at each position and its own literal English text.
    for(var paragraphIndex=0;same&&paragraphIndex<row.source[1].length;paragraphIndex++){
      var slot=Object.getOwnPropertyDescriptor(lesson.paragraphs,String(paragraphIndex));
      var paragraph=slot&&Object.prototype.hasOwnProperty.call(slot,'value')?slot.value:null;
      var english=paragraph&&typeof paragraph==='object'?Object.getOwnPropertyDescriptor(paragraph,'en'):null;
      same=!!english&&Object.prototype.hasOwnProperty.call(english,'value')&&typeof english.value==='string'&&english.value===row.source[1][paragraphIndex];
    }
    return {bound:same,reason:same?'source-matched':'source-mismatch',newWords:same?row.targets.length:0};
  }
  function vocabularyForLesson(lesson,originalRows){
    var originals=Array.isArray(originalRows)?originalRows:lesson&&Array.isArray(lesson.vocabulary)?lesson.vocabulary:[];
    var row=lesson&&index[lesson.id],targets=statusForLesson(lesson).bound?row.targets:[],byWord=Object.create(null),used=Object.create(null);
    targets.forEach(function(target){byWord[normalize(target.word)]=target;});
    var result=originals.map(function(original){
      var copy=clone(original),key=normalize(original&&original.word),target=byWord[key];
      if(!copy||typeof copy!=='object'||Array.isArray(copy))return copy;
      copy.isLessonNew=!!target;
      if(target){
        used[key]=true;copy.sourceSentence=row.sourceSentences[target.sourceSentenceIndex];copy.sourceLocation=target.sourceLocation;
        if(!validMeaning(original)){copy.meaning=target.meaning;copy.meaningSource=target.meaningSource;copy.meaningMissing=target.meaningMissing;}
        else{copy.meaningSource='lesson-vocabulary';copy.meaningMissing=false;}
        if(!copy.pos)copy.pos=target.pos;
        if(!copy.phonetic&&target.phonetic)copy.phonetic=target.phonetic;
      }
      return copy;
    });
    targets.forEach(function(target){if(!used[normalize(target.word)]){var copy=clone(target);copy.sourceSentence=row.sourceSentences[target.sourceSentenceIndex];delete copy.sourceSentenceIndex;result.push(copy);}});
    return result;
  }
  function newWordsForLesson(lesson,originalRows){
    var seen=Object.create(null);
    return vocabularyForLesson(lesson,originalRows).filter(function(row){var key=normalize(row&&row.word);if(!row||row.isLessonNew!==true||seen[key])return false;seen[key]=true;return true;});
  }
  function quarantinedForLesson(lesson){var row=lesson&&index[lesson.id];return row&&statusForLesson(lesson).bound?clone(row.quarantinedOccurrences||[]).map(function(item){item.sourceBindingSha256=row.sourceSha256;return item;}):[];}
  var status=clone(payload.status);Object.keys(status).forEach(function(key){if(status[key]&&typeof status[key]==='object')Object.freeze(status[key]);});Object.freeze(status);
  return Object.freeze({vocabularyForLesson:vocabularyForLesson,newWordsForLesson:newWordsForLesson,quarantinedForLesson:quarantinedForLesson,statusForLesson:statusForLesson,status:status,policy:payload.policy});
}
function browserSource(manifest){
  return scriptText('/* Generated offline by dev/build-lesson-word-targets.cjs. Do not hand edit. */\n(function(root,factory){\n  "use strict";var api=factory('+JSON.stringify(manifest).replace(/</g,'\\u003c')+');\n  if(typeof module==="object"&&module.exports)module.exports=api;else root.StudyLessonWordTargets=api;\n})(typeof globalThis!=="undefined"?globalThis:this,'+scriptText(installLessonWordTargets.toString())+');\n');
}
function readDictionary(root){
  const directory=path.join(root,'dictionary-data'),entries=Object.create(null),inputs=[];
  const source=JSON.parse(fs.readFileSync(path.join(directory,'source.json'),'utf8'));
  for(const shard of source.shards){
    if(!/^[a-z]\.json$/.test(shard.file))throw Error('Unsupported local dictionary shard: '+shard.file);
    const data=fs.readFileSync(path.join(directory,shard.file));
    if(hash(data)!==shard.sha256)throw Error('Local dictionary source mismatch: '+shard.file);
    Object.assign(entries,JSON.parse(data).entries);inputs.push({file:'dictionary-data/'+shard.file,sha256:hash(data)});
  }
  const license=fs.readFileSync(path.join(directory,'LICENSE'));
  if(source.license?.name!=='MIT'||hash(license)!==source.license.sha256)throw Error('Local dictionary MIT license source mismatch.');
  return {entries,metadata:{name:source.name,commit:source.commit,license:source.license,inputs}};
}
function buildLessonWordTargets(options={}){
  const root=path.resolve(options.projectRoot||DEFAULT_ROOT),lexicalBytes=fs.readFileSync(path.join(root,'lexical-word-tokens.js'));
  if(scriptHash(lexicalBytes)!==scriptHash(fs.readFileSync(path.join(DEFAULT_ROOT,'lexical-word-tokens.js'))))throw Error('Shared lexical tokenizer source mismatch.');
  const corpus=collectCorpus(root),dictionary=readDictionary(root);
  const manifest=createManifest(corpus.lessons,dictionary.entries,{inputs:corpus.inputs,dictionary:dictionary.metadata});
  const outputFile=path.resolve(options.outputFile||path.join(root,'lesson-word-targets.js')),sourceFile=path.resolve(options.sourceFile||path.join(root,'lesson-word-targets-source.json'));
  const source=browserSource(manifest);fs.writeFileSync(outputFile,source);
  const provenance={version:manifest.version,policy:manifest.policy,hashEncoding:manifest.hashEncoding,status:manifest.status,inputs:manifest.inputs,dictionary:manifest.dictionary,tokenizer:{...manifest.tokenizer,hashEncoding:'utf8-lf',sha256:scriptHash(lexicalBytes)},lessons:manifest.lessons.map(row=>({id:row.id,book:row.book,number:row.number,sourceSha256:row.sourceSha256,newWords:row.targets.length,missingMeaning:row.targets.filter(target=>target.meaningMissing).map(target=>target.word),quarantinedTargets:row.quarantinedTargets,quarantinedOccurrences:row.quarantinedOccurrences,excludedOrdinals:row.excludedOrdinals})),artifact:{file:path.basename(outputFile),sha256:hash(source),bytes:Buffer.byteLength(source),hashEncoding:'utf8-lf'},rebuild:'node dev/build-lesson-word-targets.cjs (offline; existing dictionary-data shards only)'};
  fs.writeFileSync(sourceFile,JSON.stringify(provenance,null,2)+'\n');
  return provenance;
}
module.exports={collectCorpus,createManifest,browserSource,buildLessonWordTargets};
if(require.main===module){try{if(process.argv.includes('--help'))console.log('Offline first-occurrence target compiler. Usage: node dev/build-lesson-word-targets.cjs [--project <repo>]');else{const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--project'))throw Error('Usage: node dev/build-lesson-word-targets.cjs [--project <repo>]');const result=buildLessonWordTargets({projectRoot:args[1]});console.log(JSON.stringify({...result.status,bytes:result.artifact.bytes},null,2));}}catch(error){console.error(error.message);process.exitCode=1;}}
