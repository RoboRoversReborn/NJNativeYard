/** Explicit research-only provider refresh. Never imported by app/build/page code. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { detectPlantsWithMetadata } from '../lib/recognition/gemini.js';
import { exactPlant, normalizeBox, summary, SCORE_VERSION, catalog } from '../lib/survey';
import { NJ_EVIDENCE_VERSION, profileStatus } from '../lib/nj-evidence';
import type { SurveyPlant } from '../lib/survey';
type RawDetection={kind:string;box:number[];guessScientific?:string;guessCommon?:string};
const root='research/sample-refresh';mkdirSync(root,{recursive:true});
if (!process.argv.includes('--run-provider')) throw new Error('Manual provider authorization required: --run-provider. No build/page invokes this script.');
try { process.loadEnvFile('.env.local'); } catch {}
// Exactly one configured model attempt per chosen image; no fallback model calls.
process.env.GEMINI_FALLBACK_MODEL=process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const fixtures=JSON.parse(readFileSync('data/reference-samples.v1.json','utf8'));
const originalFetch=globalThis.fetch;let activeId='';let calls=0;
globalThis.fetch=async (...args:Parameters<typeof fetch>)=>{
 if (++calls>1) throw new Error('One-call-per-image research limit reached');
 const response=await originalFetch(...args);
 const raw=await response.clone().text();
 writeFileSync(`${root}/${activeId}.provider-response.v1.json`,JSON.stringify({httpStatus:response.status,receivedAt:new Date().toISOString(),body:JSON.parse(raw)},null,2));
 return response;
};
const out=[];const report=[];
for (const sample of fixtures) {
 activeId=sample.id;calls=0;
 const photo=readFileSync('public'+sample.photo);const imageSha256=createHash('sha256').update(photo).digest('hex');
 const cache=`${root}/${sample.id}.detection.v1.json`;
 let evidence;
 if (existsSync(cache)) {
  evidence=JSON.parse(readFileSync(cache,'utf8'));if(evidence.imageSha256!==imageSha256) throw new Error('Cached photo differs; create a new version, never silently rerun');
 } else {
  const input=await sharp(photo).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
  const responseCache=`${root}/${sample.id}.provider-response.v1.json`;
  if (existsSync(responseCache)) {
   const previous=JSON.parse(readFileSync(responseCache,'utf8'));
   if(previous.httpStatus!==200) {
    out.push({...sample,fixtureVersion:2,evidence:{imageSha256,provider:'Google Gemini',providerCalls:1,calledAt:previous.receivedAt,providerFailureStatus:previous.httpStatus,computedScore:summary({source:'sample',plants:sample.plants}).score,reviewed:false}});
    report.push({sampleId:sample.id,actualCallsThisRun:0,cachedProviderCalls:1,providerFailureStatus:previous.httpStatus,status:'Original illustrative fixture retained; provider request failed, not silently retried'});continue;
   }
  }
  let detected;
  try { detected=await detectPlantsWithMetadata(input,'image/jpeg'); } catch {
   const failed=existsSync(responseCache)?JSON.parse(readFileSync(responseCache,'utf8')):{};
   out.push({...sample,fixtureVersion:2,evidence:{imageSha256,provider:'Google Gemini',providerCalls:calls,providerFailureStatus:failed.httpStatus || 'network-error',computedScore:summary({source:'sample',plants:sample.plants}).score,reviewed:false}});
   report.push({sampleId:sample.id,actualCallsThisRun:calls,cachedProviderCalls:calls,providerFailureStatus:failed.httpStatus || 'network-error',status:'Original illustrative fixture retained; request failed and was not retried'});continue;
  }
  evidence={sampleId:sample.id,imageSha256,providerImageSha256:createHash('sha256').update(input).digest('hex'),calledAt:new Date().toISOString(),providerCalls:calls,...detected};
  writeFileSync(cache,JSON.stringify(evidence,null,2));
 }
 const mapped:SurveyPlant[]=evidence.plants.filter((r:RawDetection)=>r.kind!=='lawn').flatMap((r:RawDetection,i:number)=>{
  const box=normalizeBox(r.box);if(!box)return [];
  const match=exactPlant(r.guessScientific || '');
  return [{id:`${sample.id}-v2-${i+1}`,...(match?{plantId:match.id}:{}),suggestion:r.guessCommon || 'Unidentified plant',scientificName:r.guessScientific || '',box,reviewed:false,note:'Cached Google image suggestion; identity and region boundary need review. NJ role comes from the local source-backed catalog, not Google.',candidates:[{...(match?{plantId:match.id}:{}),scientificName:r.guessScientific || '',commonName:r.guessCommon || 'Unidentified plant',clue:'Google visual suggestion; not independently verified'}]}];
 });
 const before=summary({source:'sample',plants:sample.plants});const after=summary({source:'sample',plants:mapped});
 const reconciled=mapped.map(r=>{const p=exactPlant(r.scientificName||'');return {regionId:r.id,scientificName:r.scientificName,plantId:p?.id,localCategory:p?.status,assessmentStatus:p?profileStatus(p):'unresolved',providerCoverage:p?.providerCoverage || null,box:r.box,reviewStatus:'unreviewed'};});
 out.push({...sample,plants:mapped,fixtureVersion:2,evidence:{imageSha256,provider:evidence.provider,modelVersion:evidence.modelVersion || 'unknown',promptVersion:evidence.promptVersion,calledAt:evidence.calledAt,providerCalls:evidence.providerCalls,catalogVersion:NJ_EVIDENCE_VERSION,scoreVersion:SCORE_VERSION,computedScore:after.score,rawScore:after.rawScore,reviewed:false,sourceLicenseStatus:'Original reference-app provenance; permission not independently established by this refresh'}});
 report.push({sampleId:sample.id,actualCallsThisRun:calls,cachedProviderCalls:evidence.providerCalls,before:{score:before.score,counts:before.counts},after:{score:after.score,counts:after.counts},reconciled});
 console.log(JSON.stringify({sampleId:sample.id,actualCallsThisRun:calls,before:before.score,after:after.score,regions:mapped.length}));
}
writeFileSync('data/reference-samples.v2.json',JSON.stringify(out,null,2)+'\n');
writeFileSync(`${root}/refresh-audit.v1.json`,JSON.stringify({fixtureVersion:2,catalogCount:catalog.length,scorePolicy:'Unchanged production v3; no score selection or weight inflation',integrationStatus:'Research staging only; region/identity review and replacement photo still pending',runtimeProviderCalls:0,records:report},null,2)+'\n');
