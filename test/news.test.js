import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, articleId, basicFilter, topicFilter } from '../src/filter.js';
import { normalizeEntry } from '../src/collect.js';
const cfg = { lookbackDays: 7, engagement: { views:1000,comments:10,likes:500 }, interests:['AI agents'], interestTags:['ai'], embedding:{threshold:0.5} };
const article = overrides => ({ id:'a',title:'A',publishedAt:new Date().toISOString(),tags:['ai'],engagement:{views:null,comments:null,likes:null},...overrides });
test('tracking URLs deduplicate while article query parameters survive',()=> {
 assert.equal(articleId('https://example.org/post?utm_source=x&id=3#x'),articleId('https://example.org/post?id=3'));
 assert.notEqual(articleId('https://example.org/post?id=4'),articleId('https://example.org/post?id=3'));
 assert.throws(()=>normalizeUrl('javascript:alert(1)'));
});
test('unknown metrics pass but known low metrics fail; equality passes',()=> {
 assert.equal(basicFilter([article({})],cfg).accepted.length,1);
 assert.equal(basicFilter([article({engagement:{views:null,comments:null,likes:499}})],cfg).accepted.length,0);
 assert.equal(basicFilter([article({engagement:{views:1000,comments:10,likes:500}})],cfg).accepted.length,1);
});
test('deduplication, sent history and stale dates',()=> {
 assert.equal(basicFilter([article({}),article({})],cfg).rejected[0].reason,'duplicate-url');
 assert.equal(basicFilter([article({})],cfg,{a:'today'}).accepted.length,0);
 assert.equal(basicFilter([article({publishedAt:'2000-01-01'})],cfg).accepted.length,0);
});
test('semantic fallback used only without tags',async()=> {
 let calls=0;const embed=async()=>{calls++;return [1,0]};
 const result=await topicFilter([article({}),article({id:'b',tags:[]}),article({id:'c',tags:['gardening']})],cfg,embed);
 assert.equal(result.accepted.length,2);assert.equal(calls,2);assert.equal(result.rejected[0].reason,'tags-not-matched');
});
test('normalizer does not invent engagement or tags',()=> {
 const a=normalizeEntry({title:'<b>Hello</b>',link:'https://example.org',pubDate:'2026-10-21'}, {name:'Source'});
 assert.deepEqual(a.engagement,{views:null,comments:null,likes:null});assert.deepEqual(a.tags,[]);assert.equal(a.title,'Hello');
});
test('soft engagement mode keeps fresh low-engagement articles',()=> {
 assert.equal(basicFilter([article({engagement:{views:1,comments:0,likes:1}})],{...cfg,engagementMode:'soft'}).accepted.length,1);
});
