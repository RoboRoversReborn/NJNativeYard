import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Plant } from '../lib/types';
const {registerHooks}=(nodeModule as any);
if (typeof registerHooks === 'function') {
  registerHooks({resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => unknown){return specifier==='server-only'?{url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true}:next(specifier,context);}});
}
const profile={id:'api-fixture',scientificName:'Prunus × yedoensis',commonName:'Yoshino cherry',status:'non-native',type:'Tree',sun:'',moisture:'',bloom:'',height:'',description:'A botanical test fixture.',referenceSource:{label:'Botanical fixture',url:'https://example.org/botany',checkedOn:'2026-11-05'},referenceIdentity:{provider:'iNaturalist',taxonId:'1',scientificName:'Prunus × yedoensis'},referenceVersion:'test-v1'} as Plant;
test('durable adapter allowlists nested botanical data, validates identity, handles expiry/failures, and preserves hybrid equivalence',async()=>{
 const {readSpeciesReference,writeSpeciesReference,_clearSpeciesReferenceCache,_getFallbackStore}=await import('../lib/species-reference-cache');
 _clearSpeciesReferenceCache();
 const tainted={...profile,referenceExpiresAt:'2026-12-05T00:00:00Z',userId:'private',survey:{photo:'private'},referenceDetails:{facts:{Light:['Full sun'],userEmail:['private']},source:{label:'Botanical',url:'https://example.org',checkedOn:'2026-11-05',privatePhoto:'private'}},referencePhoto:{url:'https://example.org/private-photo',license:'cc-by',attribution:'Private',sourceUrl:'https://www.inaturalist.org/taxa/1'}} as Plant;

 assert.equal(await writeSpeciesReference('Prunus x yedoensis','v1',tainted),true);
 const fallbackStore = _getFallbackStore();
 const encoded=JSON.stringify([...fallbackStore.values()]);
 assert.ok(!encoded.includes('private'));
 assert.ok(!encoded.includes('userEmail'));

 const hit=await readSpeciesReference('Prunus × yedoensis','v1');
 assert.equal(hit?.scientificName,profile.scientificName);
 assert.equal(hit?.referencePhoto,undefined);
 assert.equal((hit as Plant & {referenceVersion?:string})?.referenceVersion,'test-v1');

 assert.equal(await writeSpeciesReference('Prunus x yedoensis','species-reference-v3-hybrid-durable/'+ 'a'.repeat(190),profile),true);
 assert.equal(await writeSpeciesReference('Prunus species','v1',{...profile,scientificName:'Prunus species'}),false);
 assert.equal(await writeSpeciesReference('Acer rubrum','v1',profile),false);
 assert.equal(await writeSpeciesReference('Prunus x yedoensis',"v1'); drop table x",profile),false);

 const docKey = [...fallbackStore.keys()][0];
 const doc = fallbackStore.get(docKey)!;
 doc.expires_at='2000-01-01';
 assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);

 doc.expires_at=new Date(Date.now()+10000).toISOString();
 doc.profile={...profile,scientificName:'Acer rubrum'};
 assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);
});
