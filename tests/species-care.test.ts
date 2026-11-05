import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpeciesCare, lookupSpeciesCare, enrichSpecies } from '../lib/species-enrichment';
const url='https://plants.ces.ncsu.edu/plants/testia-careana/';
const page=`<html><h1><em>Testia careana</em></h1><dl>
<dt>Light:</dt><dd><span class="detail_display_attribute">Full sun (6 or more hours of direct sunlight a day)</span></dd>
<dt>Flower Bloom Time:</dt><dd><span class="detail_display_attribute">Summer</span></dd>
<dt>Dimensions:</dt><dd><span class="detail_display_attribute">Height: 3 ft. 0 in. - 6 ft. 0 in.</span></dd>
<dt>Maintenance:</dt><dd><span class="detail_display_attribute">Low</span></dd>
<dt>Unknown advice:</dt><dd><span class="detail_display_attribute">Invented pruning instruction</span></dd></dl></html>`;
test('labelled care parser accepts exact taxon and factual fields only',()=>{
 const detail=parseSpeciesCare(page,'Testia careana',url)!;
 assert.equal(detail.facts.FlowerBloomTime[0],'Summer');
 assert.match(detail.facts.Light[0],/^Full sun/);
 assert.equal(detail.facts.Height[0],'3 ft. 0 in. - 6 ft. 0 in.');
 assert.equal(detail.facts.Maintenance[0],'Low');
 assert.equal(detail.facts['Unknown advice'],undefined);
 assert.equal(detail.source.url,url);
 assert.equal(parseSpeciesCare(page,'Testia wrongia',url),undefined);
 assert.equal(parseSpeciesCare('<h1><em>Testia careana</em></h1><p>Water daily</p>','Testia careana',url),undefined);
});
test('care fallback remains available when taxonomy API fails and handles blocked pages',async()=>{
 const original=globalThis.fetch;
 try {
   globalThis.fetch=async input=>String(input).includes('plants.ces.ncsu.edu')?new Response(page):new Response('unavailable',{status:503});
   const value=await enrichSpecies('Testia careana');
   assert.equal(value?.referenceDetails?.facts.Maintenance[0],'Low');
   assert.equal(value?.scientificName,'Testia careana');
   assert.equal(value?.apiOnly,true);
   globalThis.fetch=async()=>new Response('no',{status:404});
   assert.equal(await lookupSpeciesCare('Testia missingia'),undefined);
   assert.equal(await lookupSpeciesCare('Testia spp.'),undefined);
 }finally{globalThis.fetch=original;}
});
