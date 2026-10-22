import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, articleId, basicFilter, topicFilter } from '../src/filter.js';
import { normalizeEntry } from '../src/collect.js';
import { addPreviews } from '../src/previews.js';
const cfg = { lookbackDays:7, interests:['AI agents'], embedding:{threshold:0.5}, llm:{enabled:true,baseUrl:'https://example.org',model:'example'} };
const article = overrides => ({id:'a',title:'Relevant',description:'',publishedAt:new Date().toISOString(),tags:[],...overrides});
test('tracking URLs deduplicate while identity query parameters survive',()=> {
 assert.equal(articleId('https://example.org/post?utm_source=x&id=3#x'),articleId('https://example.org/post?id=3'));
 assert.notEqual(articleId('https://example.org/post?id=4'),articleId('https://example.org/post?id=3'));
 assert.throws(()=>normalizeUrl('javascript:alert(1)'));
});
test('basic filters check duplicates, sent history and dates but not engagement',()=> {
 assert.equal(basicFilter([article({}),article({})],cfg).rejected[0].reason,'duplicate-url');
 assert.equal(basicFilter([article({})],cfg,{a:'today'}).accepted.length,0);
 assert.equal(basicFilter([article({publishedAt:'2000-01-01'})],cfg).accepted.length,0);
 assert.equal(basicFilter([article({engagement:{likes:0}})],cfg).accepted.length,1);
});
test('all articles use semantics irrespective of tags, with title fallback',async()=> {
 const texts=[];
 const embed=async text=>{texts.push(text);return text==='Unrelated'?[0,1]:[1,0]};
 const result=await topicFilter([article({tags:['gardening'],description:'Details'}),article({id:'b',title:'Unrelated',tags:['ai']})],cfg,embed);
 assert.deepEqual(result.accepted.map(a=>a.id),['a']);
 assert.equal(result.rejected[0].reason,'semantic-below-threshold');
 assert.ok(texts.includes('Relevant\nDetails'));assert.ok(texts.includes('Unrelated'));
});
test('rank by highest interest similarity; freshness only breaks ties',async()=> {
 const vectors={'AI agents':[1,0], backend:[0,1],strong:[0,1],weak:[0.6,0.8],opposite:[-1,0]};
 const result=await topicFilter([article({id:'weak',title:'weak'}),article({id:'strong',title:'strong',publishedAt:'2026-01-01'})],{...cfg,interests:['AI agents','backend']},async t=>vectors[t]);
 assert.deepEqual(result.accepted.map(a=>a.id),['strong','weak']);assert.equal(result.accepted[0].matchedInterest,'backend');
});
test('normalizer does not invent tags',()=> {
 const a=normalizeEntry({title:'<b>Hello</b>',link:'https://example.org'}, {name:'Source'});
 assert.deepEqual(a.tags,[]);assert.equal(a.title,'Hello');
});
test('no key or disabled previews makes no API call',async()=> {
 const fetchImpl=async()=>{throw Error('Must not call')};
 assert.equal((await addPreviews([article({})],cfg,{apiKey:'',fetchImpl})).mode,'rss');
 assert.equal((await addPreviews([article({})],{...cfg,llm:{enabled:false}},{apiKey:'key',fetchImpl})).mode,'rss');
});
test('AI previews cannot reorder articles or modify similarity scores',async()=> {
 const articles=[article({id:'a',similarity:0.9}),article({id:'b',similarity:0.8})];
 const fetchImpl=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify([{id:'b',preview:'B'},{id:'a',preview:'A'}])}}]})});
 const result=await addPreviews(articles,cfg,{apiKey:'key',fetchImpl});
 assert.deepEqual(result.articles.map(a=>[a.id,a.similarity,a.preview]),[['a',0.9,'A'],['b',0.8,'B']]);
});
test('malformed or failed AI returns original descriptions',async()=> {
 const result=await addPreviews([article({description:'Original'})],cfg,{apiKey:'key',fetchImpl:async()=>({ok:false})});
 assert.equal(result.mode,'rss-fallback');assert.equal(result.articles[0].preview,'Original');
});
