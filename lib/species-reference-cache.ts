import 'server-only';
import type { Plant } from './types';
import { canonicalReferenceTaxon, referenceTaxonKey } from './taxon-names';

const PROVIDER = 'nativeyard-species-reference';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 3500;
type Shape = 'string' | 'number' | 'boolean' | 'nullableBoolean' | { [key: string]: Shape } | readonly [Shape];
const source: Shape = { label: 'string', url: 'string', checkedOn: 'string' };
const fullSource: Shape = { ...source as object, sha256: 'string', scope: 'string' } as Shape;
const facts: Shape = Object.fromEntries(['Light','SoilDrainage','SoilTexture','SoilPH','GrowthRate','Maintenance','LifeCycle','PlantType','GrowthHabit','FlowerBloomTime','FlowerColor','LeafType','LeafArrangement','LeafShape','Origin','Height','Width'].map(k => [k, ['string']])) as Shape;
/** This allowlist is deliberately independent of the incoming object: no survey, photo upload, location or user fields. */
const shape: Shape = {
  referenceVersion:'string', referenceExpiresAt:'string', referenceIdentity:{provider:'string',taxonId:'string',scientificName:'string'},
  id:'string', scientificName:'string', commonName:'string', status:'string', type:'string', sun:'string', moisture:'string', bloom:'string', height:'string', description:'string', apiOnly:'boolean',
  lepidoptera:'number', njStatus:'string', njStatusLabel:'string', growthHabit:'string', deerResistance:'string', specialistBeeSupport:'boolean', bloomMonths:['number'], matureHeightFt:['number'], ornamentalFeatures:['string'],
  referenceSource:source, referenceDetails:{ facts, source }, referencePhoto:{url:'string', attribution:'string', license:'string', sourceUrl:'string'},
  horticulture:{source:fullSource, sourceTaxon:'string', requestedTaxon:'string', taxonScope:'string', attributes:facts},
  landscapeContext:{note:'string', source:fullSource, recommendation:'string', gardenSettings:['string']},
  sourceCautions:{facts,source:fullSource,reviewStatus:'string'},
  njEvidence:{checkedOn:'string',native:'nullableBoolean',invasiveStatus:'string',legalListed:'boolean',doNotPlant:'boolean',ecoregions:['string'],sources:[{label:'string',url:'string'}],note:'string',assessmentStatus:'string',originStatus:'string',floraOriginCode:'string',watchStatus:'string',keystoneScope:'string',taxonConflict:'boolean'},
};
function pick(value: unknown, schema: Shape): unknown {
  if (typeof schema === 'string') {
    if (schema === 'nullableBoolean') return value === null || typeof value === 'boolean' ? value : undefined;
    if (typeof value !== schema) return undefined;
    if (typeof value === 'string') return value.length <= 8000 ? value : undefined;
    return typeof value === 'number' && !Number.isFinite(value) ? undefined : value;
  }
  if (Array.isArray(schema)) return Array.isArray(value) ? value.slice(0,100).map(item => pick(item,schema[0])).filter(item => item !== undefined) : undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(schema).flatMap(([k,s]) => { const v = pick((value as Record<string,unknown>)[k],s); return v === undefined ? [] : [[k,v]]; }));
}
function canonical(name: string) { return referenceTaxonKey(name)?.replace(/ x /g,' × ') || ''; }
function validKey(name: string, version: string) {
  return name.length > 0 && name.length <= 200 && /^[a-zA-Z0-9_./:-]{1,512}$/.test(version);
}
function cleanProfile(value: unknown, name: string): Plant | undefined {
  const p = pick(value,shape) as Plant | undefined;
  if (!p || typeof p.scientificName !== 'string' || canonical(p.scientificName) !== name) return undefined;
  if (!['id','commonName','sun','moisture','bloom','height','description'].every(k => typeof (p as unknown as Record<string,unknown>)[k] === 'string')) return undefined;
  if (!['keystone','native','non-native','invasive'].includes(p.status) || !['Tree','Shrub','Perennial','Groundcover','Vine','Grass','Fern','Annual','Herb','Unknown'].includes(p.type)) return undefined;
  p.scientificName = canonicalReferenceTaxon(p.scientificName)!;
  if (p.referenceIdentity && (!p.referenceIdentity.provider || canonical(p.referenceIdentity.scientificName || '') !== name)) return undefined;
  const enums: Record<string,readonly string[]> = {njStatus:['NATIVE_KEYSTONE','NATIVE','NON_NATIVE_BENIGN','INVASIVE_REGULATED','INVASIVE_WATCHLIST'],growthHabit:['CANOPY_TREE','UNDERSTORY_TREE','SHRUB','PERENNIAL_FORB','GRAMINOID','VINE','GROUNDCOVER','FERN'],deerResistance:['HIGH','MODERATE','LOW']};
  for (const [field,values] of Object.entries(enums)) { const v=(p as unknown as Record<string,unknown>)[field]; if(v !== undefined && !values.includes(String(v))) return undefined; }
  if (p.njEvidence?.assessmentStatus && !['native','non-native','keystone','invasive','unverified'].includes(p.njEvidence.assessmentStatus)) return undefined;
  if (p.njEvidence?.originStatus && !['NJ native','introduced','mixed origin','unresolved'].includes(p.njEvidence.originStatus)) return undefined;
  // Only public, licensed botanical provider images. Never storage/signed URLs or user photo URLs.
  if (p.referencePhoto && (!/^https:\/\/(?:static\.inaturalist\.org|inaturalist-open-data\.s3\.amazonaws\.com)\/[^?#]+$/.test(p.referencePhoto.url || '') || !['cc0','cc-by','cc-by-sa'].includes(p.referencePhoto.license) || !p.referencePhoto.attribution || !/^https:\/\/www\.inaturalist\.org\/taxa\/\d+$/.test(p.referencePhoto.sourceUrl || ''))) delete p.referencePhoto;
  return JSON.stringify(p).length <= 100000 ? p : undefined;
}
function config() {
  if (typeof window !== 'undefined') return undefined;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!url) return undefined;
  const project = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(url)?.[1];
  if (!project || (!service && !token)) return undefined;
  return { url: `https://${project}.supabase.co`, project, service, token };
}
// Hex literals remove all SQL quoting ambiguity for management API calls.
function literal(value: string) { return `convert_from(decode('${Buffer.from(value,'utf8').toString('hex')}','hex'),'UTF8')`; }
async function management(c: NonNullable<ReturnType<typeof config>>, query: string, readOnly: boolean) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${c.project}/database/query`, {method:'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:readOnly}),signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store'});
  if (!response.ok) throw new Error('Species cache unavailable');
  return response.json();
}
export async function readSpeciesReference(canonicalTaxon: string, version: string): Promise<Plant | undefined> {
  try {
    const name=canonical(canonicalTaxon); const c=config();
    if (!c || !validKey(name,version)) return undefined;
    let rows;
    if (c.service) {
      const params=new URLSearchParams({select:'profile,expires_at',canonical_taxon:`eq.${name}`,provider:`eq.${PROVIDER}`,version:`eq.${version}`,expires_at:`gt.${new Date().toISOString()}`,limit:'1'});
      const response=await fetch(`${c.url}/rest/v1/species_reference_cache?${params}`,{headers:{apikey:c.service,Authorization:`Bearer ${c.service}`},signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store'});
      if (!response.ok) return undefined;
      rows=await response.json();
    } else rows=await management(c,`select profile, expires_at from public.species_reference_cache where canonical_taxon=${literal(name)} and provider=${literal(PROVIDER)} and version=${literal(version)} and expires_at>now() limit 1`,true);
    const row=Array.isArray(rows) ? rows[0] : undefined;
    if (!row || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at)<=Date.now()) return undefined;
    const profile=cleanProfile(row.profile,name);
    return profile ? { ...profile, referenceExpiresAt: new Date(Date.parse(row.expires_at)).toISOString() } : undefined;
  } catch { return undefined; }
}
export async function writeSpeciesReference(canonicalTaxon: string, version: string, profile: Plant): Promise<boolean> {
  try {
    const name=canonical(canonicalTaxon); const c=config();
    if (!c || !validKey(name,version)) return false;
    const safe=cleanProfile(profile,name); if (!safe) return false;
    // Row expiry is derived on reads; it is not part of botanical JSON.
    delete safe.referenceExpiresAt;
    const now=new Date().toISOString(); const expiry=new Date(Date.now()+TTL_MS).toISOString();
    if (c.service) {
      const response=await fetch(`${c.url}/rest/v1/species_reference_cache?on_conflict=canonical_taxon,provider,version`,{method:'POST',headers:{apikey:c.service,Authorization:`Bearer ${c.service}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({canonical_taxon:name,provider:PROVIDER,version,profile:safe,updated_at:now,expires_at:expiry}),signal:AbortSignal.timeout(TIMEOUT_MS),cache:'no-store'});
      return response.ok;
    }
    const rows=await management(c,`insert into public.species_reference_cache(canonical_taxon,provider,version,profile,updated_at,expires_at) values(${literal(name)},${literal(PROVIDER)},${literal(version)},${literal(JSON.stringify(safe))}::jsonb,${literal(now)}::timestamptz,${literal(expiry)}::timestamptz) on conflict(canonical_taxon,provider,version) do update set profile=excluded.profile,updated_at=excluded.updated_at,expires_at=excluded.expires_at returning canonical_taxon`,false);
    return Array.isArray(rows) && rows.length===1 && rows[0].canonical_taxon===name;
  } catch { return false; }
}
