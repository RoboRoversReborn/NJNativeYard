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
 const {readSpeciesReference,writeSpeciesReference}=await import('../lib/species-reference-cache');
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,service:process.env.SUPABASE_SERVICE_ROLE_KEY,token:process.env.SUPABASE_ACCESS_TOKEN,fetch:globalThis.fetch};
 try {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('must not fetch')};
  assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);
  assert.equal(await writeSpeciesReference('Prunus x yedoensis','v1',profile),false);assert.equal(calls,0);
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://abcdefghijklmnopqrst.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-only';
  let row:Record<string,unknown>={};
  globalThis.fetch=async(input,init)=>{calls++;assert.ok(init?.signal);if(init?.method==='POST'){row=JSON.parse(String(init.body));return new Response(null,{status:201});}assert.match(String(input),/canonical_taxon=/);return Response.json([row]);};
  const tainted={...profile,referenceExpiresAt:'2026-12-05T00:00:00Z',userId:'private',survey:{photo:'private'},referenceDetails:{facts:{Light:['Full sun'],userEmail:['private']},source:{label:'Botanical',url:'https://example.org',checkedOn:'2026-11-05',privatePhoto:'private'}},referencePhoto:{url:'https://example.org/private-photo',license:'cc-by',attribution:'Private',sourceUrl:'https://www.inaturalist.org/taxa/1'}} as Plant;
  assert.equal(await writeSpeciesReference('Prunus x yedoensis','v1',tainted),true);
  const encoded=JSON.stringify(row);assert.ok(!encoded.includes('private'));assert.ok(!encoded.includes('userEmail'));assert.equal((row.profile as Record<string,unknown>).referenceExpiresAt,undefined);
  const hit=await readSpeciesReference('Prunus × yedoensis','v1');assert.equal(hit?.scientificName,profile.scientificName);assert.equal(hit?.referencePhoto,undefined);assert.equal((hit as Plant & {referenceVersion?:string})?.referenceVersion,'test-v1');
  assert.equal(await writeSpeciesReference('Prunus x yedoensis','species-reference-v3-hybrid-durable/'+ 'a'.repeat(190),profile),true);
  assert.equal(await writeSpeciesReference('Prunus species','v1',{...profile,scientificName:'Prunus species'}),false);
  assert.equal(await writeSpeciesReference('Acer rubrum','v1',profile),false);
  assert.equal(await writeSpeciesReference('Prunus x yedoensis',"v1'); drop table x",profile),false);
  row.expires_at='2000-01-01';assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);
  row.expires_at=new Date(Date.now()+10000).toISOString();row.profile={...profile,scientificName:'Acer rubrum'};assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);
  globalThis.fetch=async()=>new Response(null,{status:503});assert.equal(await writeSpeciesReference('Prunus x yedoensis','v1',profile),false);assert.equal(await readSpeciesReference('Prunus x yedoensis','v1'),undefined);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_ACCESS_TOKEN='server-management-test';
  globalThis.fetch=async(input,init)=>{assert.match(String(input),/^https:\/\/api.supabase.com/);const body=JSON.parse(String(init?.body));assert.equal(body.read_only,false);assert.match(body.query,/convert_from\(decode\('[0-9a-f]+'/);return Response.json([{canonical_taxon:'prunus × yedoensis'}]);};
  assert.equal(await writeSpeciesReference('Prunus x yedoensis','v1',profile),true);
 } finally {
  globalThis.fetch=saved.fetch;for(const [key,value] of Object.entries({NEXT_PUBLIC_SUPABASE_URL:saved.url,SUPABASE_SERVICE_ROLE_KEY:saved.service,SUPABASE_ACCESS_TOKEN:saved.token}))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
