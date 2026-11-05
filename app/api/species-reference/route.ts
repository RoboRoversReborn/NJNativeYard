import { lookupSpeciesReference } from '@/lib/species-enrichment';
import { canonicalReferenceTaxon } from '@/lib/taxon-names';
export const maxDuration = 20;
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name') || '';
  if (name.length > 120 || !canonicalReferenceTaxon(name)) return Response.json({ error: 'An exact species or hybrid name is required.' }, { status: 400 });
  const result = await lookupSpeciesReference(name);
  return Response.json({ ...result, profile: result.profile || null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
