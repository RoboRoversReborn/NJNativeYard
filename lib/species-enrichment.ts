import horticulture from "../data/plant-horticulture.v1.json";
import type { Plant } from './types';
import type { SurveyPlant } from './survey';
import { exactPlant } from './survey';
import { enrichNjPlant, taxonKey } from './nj-evidence';
import { canonicalReferenceTaxon, referenceTaxonKey } from './taxon-names';
import { readSpeciesReference, writeSpeciesReference } from './species-reference-cache';
import { SPECIES_REFERENCE_VERSION } from './species-reference-version';

export type SpeciesReferenceResult = { profile?: Plant; cache: { source: "memory" | "firestore" | "provider" | "none"; persisted: boolean; version: string } };
const cache = new Map<string, { until: number; result: SpeciesReferenceResult }>();
const pending = new Map<string, Promise<SpeciesReferenceResult>>();
const key = (name: string) => referenceTaxonKey(name) || name.trim().toLowerCase().replace(/\s+/g, ' ');
const empty = (): SpeciesReferenceResult => ({ cache: { source: "none", persisted: false, version: SPECIES_REFERENCE_VERSION } });
const text = (value: unknown, max = 1800) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').slice(0, max) : '';
async function json(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': 'NativeYard/1.0 (species reference lookup)' } });
  if (!response.ok) throw new Error('Reference unavailable');
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error('Reference too large');
  return JSON.parse(body);
}
type CareDetails = NonNullable<Plant["referenceDetails"]>;
const CARE_FIELDS: Record<string, string> = { Light: "Light", "Soil Drainage": "SoilDrainage", "Soil Texture": "SoilTexture", "Soil pH": "SoilPH", "Growth Rate": "GrowthRate", Maintenance: "Maintenance", "Life Cycle": "LifeCycle", "Plant Type": "PlantType", "Habit/Form": "GrowthHabit", "Flower Bloom Time": "FlowerBloomTime", "Flower Color": "FlowerColor", "Leaf Type": "LeafType", "Leaf Arrangement": "LeafArrangement", "Leaf Shape": "LeafShape", "Country Or Region Of Origin": "Origin" };
const cleanHtml = (html: string) => text(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ""), 350).replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
/** Only the exact page heading and short labelled spans are accepted. Free prose is not interpreted as care. */
export function parseSpeciesCare(html: string, scientificName: string, url: string): CareDetails | undefined {
  const heading = html.match(/<h1\b[^>]*>[\s\S]*?<em\b[^>]*>([\s\S]*?)<\/em>/i)?.[1];
  if (!heading || key(cleanHtml(heading)) !== key(scientificName)) return undefined;
  const facts: Record<string, string[]> = {};
  for (const match of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>([\s\S]*?)(?=<dt\b|<\/dl>)/gi)) {
    const label = cleanHtml(match[1]).replace(/:$/, "");
    const values = [...match[2].matchAll(/<span\b[^>]*class=["'][^"']*\bdetail_display_attribute\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
      .map(value => cleanHtml(value[1])).filter(value => value.length > 0 && value.length <= 300 && value.split(/\s+/).length <= 35);
    if (!values.length) continue;
    const field = CARE_FIELDS[label];
    if (field) facts[field] = [...new Set(values)].slice(0, 10);
    if (label === "Dimensions") for (const value of values) {
      const dimension = value.match(/^(Height|Width):\s*(.+)$/);
      if (dimension) facts[dimension[1]] = [dimension[2]];
    }
  }
  if (!Object.keys(facts).length) return undefined;
  return { facts, source: { label: "NC State Extension Gardener Plant Toolbox", url, checkedOn: new Date().toISOString() } };
}
export async function lookupSpeciesCare(scientificName: string, signal = AbortSignal.timeout(3500)): Promise<CareDetails | undefined> {
  if (!canonicalReferenceTaxon(scientificName)) return undefined;
  const cached = Object.values(horticulture.records).find(record => key(record.sourceTaxon) === key(scientificName) && record.taxonScope === "species-or-hybrid");
  if (cached) return { facts: structuredClone(cached.attributes), source: { label: cached.source.label, url: cached.source.url, checkedOn: cached.source.checkedOn } };
  const url = `https://plants.ces.ncsu.edu/plants/${key(scientificName).replace(/ /g, "-")}/`;
  try {
    const response = await fetch(url, { signal, headers: { Accept: "text/html", "User-Agent": "NativeYard/1.0 (factual species reference lookup)" } });
    if (!response.ok || (response.url && response.url !== url)) return undefined;
    const html = await response.text();
    if (html.length > 1_000_000) return undefined;
    return parseSpeciesCare(html, scientificName, url);
  } catch { return undefined; }
}
/** Exact taxa only. Shared durable cache precedes public reference APIs. */
export async function lookupSpeciesReference(scientificName: string): Promise<SpeciesReferenceResult> {
  const canonical = canonicalReferenceTaxon(scientificName);
  if (!canonical || exactPlant(canonical)) return empty();
  const name = key(canonical), cacheKey = `${SPECIES_REFERENCE_VERSION}:${name}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.until > Date.now()) return { ...structuredClone(hit.result), cache: { ...hit.result.cache, source: "memory" } };
  if (pending.has(cacheKey)) return pending.get(cacheKey)!;
  const task = (async (): Promise<SpeciesReferenceResult> => {
    try {
      const stored = await readSpeciesReference(canonical, SPECIES_REFERENCE_VERSION);
      if (stored && taxonKey(stored.scientificName) === taxonKey(canonical)) {
        const profile = { ...enrichNjPlant({ ...stored, scientificName: canonical, referenceVersion: SPECIES_REFERENCE_VERSION }), description: stored.description };
        const result: SpeciesReferenceResult = { profile, cache: { source: "firestore", persisted: true, version: SPECIES_REFERENCE_VERSION } };
        remember(cacheKey, result); return result;
      }
      const carePromise = lookupSpeciesCare(canonical);
      let value: Plant | undefined;
      try {
        const signal = AbortSignal.timeout(5000);
        const found = await json(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(canonical)}&per_page=5`, signal);
        const match = found.results?.find((t: { name?: string; rank?: string; is_active?: boolean; iconic_taxon_name?: string }) => taxonKey(t.name || '') === taxonKey(canonical) && ['species','hybrid','subspecies','variety'].includes(t.rank || '') && t.is_active !== false && t.iconic_taxon_name === 'Plantae');
        if (match && Number.isSafeInteger(match.id)) {
          const detail = await json(`https://api.inaturalist.org/v1/taxa/${match.id}`, signal);
          const taxon = detail.results?.find((t: { name?: string }) => taxonKey(t.name || '') === taxonKey(canonical));
          if (taxon) {
            let description = text(taxon.wikipedia_summary);
            let sourceUrl = `https://www.inaturalist.org/taxa/${match.id}`;
            if (typeof taxon.wikipedia_url === 'string') {
              const wiki = new URL(taxon.wikipedia_url);
              if (wiki.hostname === 'en.wikipedia.org' && wiki.pathname.startsWith('/wiki/')) {
                try {
                  const article = await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(wiki.pathname.slice(6)))}`, signal);
                  if (article.type === 'standard' && article.extract) { description = text(article.extract); sourceUrl = wiki.href; }
                } catch { /* Keep the attributed exact-taxon summary. */ }
              }
            }
            value = { id: `api-inat-${match.id}`, scientificName: canonical, commonName: text(taxon.preferred_common_name,120) || canonical, status:'non-native', type:'Unknown', sun:'',moisture:'',bloom:'',height:'',description,apiOnly:true,referenceVersion:SPECIES_REFERENCE_VERSION,referenceIdentity:{provider:'iNaturalist',taxonId:String(match.id),scientificName:taxon.name},referenceSource:{label:'iNaturalist / Wikipedia species reference',url:sourceUrl,checkedOn:new Date().toISOString()} };
            const photo=taxon.default_photo;
            if (photo && ['cc0','cc-by','cc-by-sa'].includes(photo.license_code) && typeof photo.attribution==='string' && typeof photo.medium_url==='string' && /^https:\/\/(static\.inaturalist\.org|inaturalist-open-data\.s3\.amazonaws\.com)\//.test(photo.medium_url)) value.referencePhoto={url:photo.medium_url,attribution:photo.attribution,license:photo.license_code,sourceUrl:`https://www.inaturalist.org/taxa/${match.id}`};
          }
        }
      } catch { /* Care source and local classification are independent. */ }
      const care = await carePromise;
      if (value) value.referenceDetails = care;
      else if (care) value={id:`api-care-${name.replace(/ /g,'-')}`,scientificName:canonical,commonName:canonical,status:'non-native',type:'Unknown',sun:'',moisture:'',bloom:'',height:'',description:'',apiOnly:true,referenceDetails:care,referenceSource:care.source,referenceIdentity:{provider:'NC State',scientificName:canonical},referenceVersion:SPECIES_REFERENCE_VERSION};
      if (value) value={ ...enrichNjPlant(value), description:value.description, referenceExpiresAt:new Date(Date.now()+30*86400000).toISOString() };
      // Persist useful botanical results only. A miss is short-lived in memory, never a durable empty success.
      const persisted=!!value && await writeSpeciesReference(canonical,SPECIES_REFERENCE_VERSION,value);
      const result:SpeciesReferenceResult={profile:value,cache:{source:value?'provider':'none',persisted,version:SPECIES_REFERENCE_VERSION}};
      remember(cacheKey,result);return result;
    } finally {pending.delete(cacheKey);}
  })();
  pending.set(cacheKey,task);return task;
}
function remember(key: string, result: SpeciesReferenceResult) {
  if (cache.size>=128) cache.delete(cache.keys().next().value!);
  const expiry=Date.parse(result.profile?.referenceExpiresAt || "");
  const until=Math.min(Date.now()+(result.profile?86400000:600000),Number.isFinite(expiry)?expiry:Infinity);
  cache.set(key,{until,result:structuredClone(result)});
}
export async function enrichSpecies(scientificName: string): Promise<Plant | undefined> {
  return (await lookupSpeciesReference(scientificName)).profile;
}
/** Sequential bounded enrichment: at most eight new species per scan, never alters provider identity. */
export async function enrichRegions(regions: SurveyPlant[]) {
  const names = [...new Set(regions.filter(p => !exactPlant(p.scientificName)).map(p => p.scientificName))].slice(0, 8);
  const profiles = new Map<string, Plant>();
  for (let i = 0; i < names.length; i += 4) await Promise.all(names.slice(i, i + 4).map(async name => { const profile = await enrichSpecies(name); if (profile) profiles.set(name, profile); }));
  return regions.map(region => ({ ...region, externalProfile: profiles.get(region.scientificName) || region.externalProfile }));
}
