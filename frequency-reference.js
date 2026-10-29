/* Descriptive corpus reference only; never a learning score or task quota. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./frequency-reference-data.js'));
 else root.StudyFrequencyReference=factory(root.StudyFrequencyData);
})(typeof window==='object'?window:globalThis,function(data){
 'use strict';
 const metadata=data?.metadata||{},normalize=value=>String(value||'').trim().toLowerCase().replace(/’/g,"'").replace(/\s+/g,' ');
 const ratingForZipf=value=>Number.isFinite(value)&&value>0?Math.round(Math.min(3,Math.max(.1,value-2))*10)/10:null;
 function lookup(label,kind){
  const phrase=kind==='phrase',key=normalize(label),row=(phrase?data?.phrases:data?.words)?.[key];
  if(!Array.isArray(row)||![1,2,3].includes(row[0]))return {stars:null,sourceKind:phrase?'subtitle-sample':'mixed-corpus'};
  const score=phrase?Math.log10(row[1]/metadata.phraseWeightedTokens*1e6)+3:row[1];
  return {stars:ratingForZipf(score),level:row[0],sourceKind:phrase?'subtitle-sample':'mixed-corpus',...(phrase?{count:row[1]}:{zipf:row[1]})};
 }
 function badge(label,kind){
  const result=lookup(label,kind),source=result.sourceKind==='subtitle-sample'?'词组字幕样本频率，非全语料统计':'单词综合语料频率，按词形统计，不区分词义';
  if(!result.stars)return '<small class="frequency-badge frequency-unrated" title="无可靠统计；未收录不代表低频" aria-label="频率待统计">待统计</small>';
  const description=source+'；频率参考 '+result.stars+'/3，非学习成绩';
  const stars=[0,1,2].map(index=>'<span class="frequency-star" aria-hidden="true">☆<span class="frequency-star-fill" style="width:'+Math.round(Math.max(0,Math.min(1,result.stars-index))*100)+'%">★</span></span>').join('');
  return '<span class="frequency-badge" role="img" data-frequency-score="'+result.stars+'" title="'+description+'" aria-label="'+description+'">'+stars+'</span>';
 }
 return Object.freeze({lookup,badge,metadata,ratingForZipf});
});
