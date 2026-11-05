import 'server-only';
import type { Plant } from './types';
import { canonicalReferenceTaxon, referenceTaxonKey } from './taxon-names';
import { isFirebaseConfigured } from './firebase/client';
import { getAdminDb } from './firebase/server';

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

function firestoreDocId(name: string, version: string) {
  return `${version}__${Buffer.from(name, 'utf8').toString('hex')}`;
}

const fallbackStore = new Map<string, { expires_at: string; profile: unknown }>();

export function _clearSpeciesReferenceCache() {
  fallbackStore.clear();
}

function isFirestoreEnabled(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test') return false;
  return isFirebaseConfigured();
}

export function _getFallbackStore() {
  return fallbackStore;
}

export async function readSpeciesReference(canonicalTaxon: string, version: string): Promise<Plant | undefined> {
  try {
    const name = canonical(canonicalTaxon);
    if (!validKey(name, version)) return undefined;

    // Firebase Firestore cache
    if (isFirestoreEnabled()) {
      try {
        const db = getAdminDb();
        const docRef = db.collection('species_reference_cache').doc(firestoreDocId(name, version));
        const snap = await docRef.get();
        if (snap.exists) {
          const row = snap.data();
          if (row && Number.isFinite(Date.parse(row.expires_at)) && Date.parse(row.expires_at) > Date.now()) {
            const profile = cleanProfile(row.profile, name);
            if (profile) return { ...profile, referenceExpiresAt: new Date(Date.parse(row.expires_at)).toISOString() };
          }
        }
      } catch {
        /* Fallback if Firestore read fails */
      }
    }

    const doc = fallbackStore.get(firestoreDocId(name, version));
    if (doc && Number.isFinite(Date.parse(doc.expires_at)) && Date.parse(doc.expires_at) > Date.now()) {
      const profile = cleanProfile(doc.profile, name);
      if (profile) return { ...profile, referenceExpiresAt: new Date(Date.parse(doc.expires_at)).toISOString() };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function writeSpeciesReference(canonicalTaxon: string, version: string, profile: Plant): Promise<boolean> {
  try {
    const name = canonical(canonicalTaxon);
    if (!validKey(name, version)) return false;
    const safe = cleanProfile(profile, name);
    if (!safe) return false;

    delete safe.referenceExpiresAt;
    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + TTL_MS).toISOString();

    // Firebase Firestore cache
    if (isFirestoreEnabled()) {
      try {
        const db = getAdminDb();
        await db.collection('species_reference_cache').doc(firestoreDocId(name, version)).set({
          canonical_taxon: name,
          provider: PROVIDER,
          version,
          profile: safe,
          updated_at: now,
          expires_at: expiry,
        }, { merge: true });
        fallbackStore.set(firestoreDocId(name, version), { expires_at: expiry, profile: safe });
        return true;
      } catch {
        fallbackStore.set(firestoreDocId(name, version), { expires_at: expiry, profile: safe });
        return true;
      }
    }

    fallbackStore.set(firestoreDocId(name, version), { expires_at: expiry, profile: safe });
    return true;
  } catch {
    return false;
  }
}
