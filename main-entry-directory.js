/* Pure presentation model. Does not write learner state or award mastery. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyEntryDirectory=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';const list=value=>Array.isArray(value)?value:[],norm=value=>String(value||'').trim().toLowerCase();
 function savedCategory(row){if(row.kind==='phrase')return 'phrase';const pos=norm(row.pos);return /^adv\b/.test(pos)?'adverb':/^adj\b/.test(pos)?'adjective':/^(?:v|vt|vi)\b/.test(pos)?'verb':/^n\b/.test(pos)?'noun':'word';}
 function combine(entries,saved){
  const favorites=new Map(list(saved).filter(row=>row&&typeof row.word==='string'&&row.word.trim()).map(row=>[norm(row.word),row]));
  const rows=list(entries).filter(row=>row&&typeof row.label==='string').map(row=>({...row,favorite:favorites.has(norm(row.label)),saved:favorites.get(norm(row.label))}));
  const known=new Set(rows.map(row=>norm(row.label)));
  for(const [key,row] of favorites)if(!known.has(key))rows.push({key:'saved:'+key,label:row.word,meaning:row.meaning||'',pos:row.pos||'',category:savedCategory(row),favorite:true,saved:row,sources:[],example:row.example||''});
  return rows;
 }
 function filter(entries,{scope='all',book='',category='all',query=''}={}){
  const needle=norm(query);
  return list(entries).filter(row=>(scope!=='favorites'||row.favorite)&&(!book||list(row.sources).some(source=>String(source.book)===String(book)))&&(!category||category==='all'||row.category===category)&&(!needle||norm(row.label+' '+row.meaning+' '+row.pos).includes(needle)));
 }
 return Object.freeze({combine,filter});
});
