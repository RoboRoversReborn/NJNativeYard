import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichSpecies, enrichRegions } from '../lib/species-enrichment';
import { referencePlant, catalog, resolvedPlant, summary, SCORE_VERSION, type SurveyPlant } from '../lib/survey';
import { profileStatus, nativePlantingOption } from '../lib/nj-evidence';
import inventory from '../data/nj-classification-inventory.v1.json';

test('full reference inventory classifies out-of-catalog taxa while recommendations stay closed', () => {
  for (const example of inventory.report.examples) {
    assert.ok(!catalog.some(p => p.scientificName === example.sourceName));
    const p=referencePlant(example.sourceName)!;
    assert.equal(profileStatus(p),example.classification);
    assert.equal(nativePlantingOption(p),false);
  }
  assert.equal(profileStatus(referencePlant('Imaginaris botanica')!), 'unverified');
  assert.equal(referencePlant('Acer spp.'),undefined);
  assert.equal(SCORE_VERSION,'species-mix-v4-mild-nonnative');
});

test('exact API mapping, cache, bounded failure, source attribution and no genus substitution', async () => {
  const original=globalThis.fetch; let calls=0;
  globalThis.fetch=async input => {
    calls++;
    const url=String(input);
    const payload=url.includes('?')?{results:[{id:999991,name:'Imaginaris botanica',rank:'species',is_active:true,iconic_taxon_name:'Plantae'}]}:{results:[{id:999991,name:'Imaginaris botanica',wikipedia_summary:'<p>A test shrub with spring flowers.</p>',preferred_common_name:'Test shrub',default_photo:{license_code:'cc-by',attribution:'Test Author (CC BY)',medium_url:'https://static.inaturalist.org/photos/1/medium.jpg'}}]};
    return Response.json(payload);
  };
  try {
    const [a,b]=await Promise.all([enrichSpecies('Imaginaris botanica'),enrichSpecies('Imaginaris botanica')]);
    assert.equal(calls,3); assert.equal(a?.scientificName,b?.scientificName);
    assert.equal(a?.description,'A test shrub with spring flowers.');
    assert.equal(a?.referencePhoto?.license,'cc-by');
    assert.equal(profileStatus(a!), 'unverified'); assert.equal(nativePlantingOption(a!),false);
    await enrichSpecies('Imaginaris botanica'); assert.equal(calls,3);
    const region:SurveyPlant={id:'a',scientificName:'Imaginaris botanica',suggestion:'Provider name',reviewed:false,box:{x:0,y:0,w:20,h:20},candidates:[]};
    const [enriched]=await enrichRegions([region]);
    assert.equal(enriched.suggestion,'Provider name'); assert.equal(enriched.reviewed,false);
    assert.equal(resolvedPlant(enriched)?.description,a?.description);
    const stats=summary({source:'upload',plants:[{...enriched,yardScope:'yard'}]});
    assert.equal(stats.counts.unverified,1); assert.equal(stats.rawScore,null);
    globalThis.fetch=async()=>{throw Error('Unavailable')};
    assert.equal(await enrichSpecies('Imaginaris absentia'),undefined);
    globalThis.fetch=async()=>Response.json({results:[{id:1,name:'Wrongia species',rank:'species',iconic_taxon_name:'Plantae'}]});
    assert.equal(await enrichSpecies('Imaginaris mismatch'),undefined);
    assert.equal(await enrichSpecies('Acer spp.'),undefined);
  } finally {globalThis.fetch=original;}
});

test('positive exact-source foreign origin can classify an API profile; missing origin cannot', async () => {
  const { enrichNjPlant }=await import('../lib/nj-evidence');
  const base=referencePlant('Imaginaris originata')!;
  const profile=enrichNjPlant({...base,referenceDetails:{facts:{Origin:['Central America'],Light:['Full sun']},source:{label:'Exact species reference',url:'https://plants.ces.ncsu.edu/plants/imaginaris-originata/',checkedOn:'2026-11-05'}}});
  assert.equal(profileStatus(profile),'non-native');
  assert.equal(nativePlantingOption(profile),false);
  assert.equal(profileStatus(base),'unverified');
});

test('durable hits avoid provider calls and memory lifetime cannot outlive row expiry',async()=>{
  const {lookupSpeciesReference}=await import('../lib/species-enrichment');
  const {SPECIES_REFERENCE_VERSION}=await import('../lib/species-reference-version');
  const {writeSpeciesReference,_clearSpeciesReferenceCache,_getFallbackStore}=await import('../lib/species-reference-cache');
  _clearSpeciesReferenceCache();
  const savedFetch=globalThis.fetch, savedNow=Date.now;
  let now=savedNow(), providerCalls=0;
  Date.now=()=>now;
  const profile={...referencePlant('Testia durabilis')!,description:'A sourced botanical fixture.',referenceVersion:SPECIES_REFERENCE_VERSION,referenceSource:{label:'Fixture',url:'https://example.org/botanical',checkedOn:'2026-11-05'}};
  await writeSpeciesReference('Testia durabilis', SPECIES_REFERENCE_VERSION, profile);
  const fallbackStore = _getFallbackStore();
  const docKey = [...fallbackStore.keys()][0];
  if (docKey && fallbackStore.get(docKey)) {
    fallbackStore.get(docKey)!.expires_at = new Date(now + 1000).toISOString();
  }
  globalThis.fetch=async url=>{
    providerCalls++;
    return String(url).includes('plants.ces.ncsu.edu')?new Response('',{status:404}):Response.json({results:[]});
  };
  try{
    const first=await lookupSpeciesReference('Testia durabilis');
    assert.equal(first.cache.source,'firestore');
    assert.equal(first.cache.persisted,true);
    assert.equal(providerCalls,0);
    assert.equal((await lookupSpeciesReference('Testia durabilis')).cache.source,'memory');
    now+=2000;
    _clearSpeciesReferenceCache();
    const expired=await lookupSpeciesReference('Testia durabilis');
    assert.equal(expired.profile,undefined);
    assert.equal(expired.cache.persisted,false);
    assert.ok(providerCalls>0);
  }finally{
    globalThis.fetch=savedFetch;
    Date.now=savedNow;
    _clearSpeciesReferenceCache();
  }
});
