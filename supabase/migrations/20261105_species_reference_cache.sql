-- Shared public botanical reference data only. No survey/user/upload data.
create table if not exists public.species_reference_cache (
 canonical_taxon text not null check (length(canonical_taxon) between 3 and 200 and canonical_taxon=lower(canonical_taxon)),
 provider text not null check (provider='nativeyard-species-reference'),
 version text not null,
 profile jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 primary key(canonical_taxon,provider,version)

);
alter table public.species_reference_cache drop constraint if exists species_reference_cache_version_check;
alter table public.species_reference_cache add constraint species_reference_cache_version_check check (length(version) between 1 and 512 and version ~ '^[a-zA-Z0-9_./:-]+$');
alter table public.species_reference_cache drop constraint if exists botanical_fields_only;
alter table public.species_reference_cache add constraint botanical_fields_only check ((profile - array['referenceVersion','referenceIdentity','id','scientificName','commonName','status','type','sun','moisture','bloom','height','description','apiOnly','lepidoptera','njStatus','njStatusLabel','growthHabit','deerResistance','specialistBeeSupport','bloomMonths','matureHeightFt','ornamentalFeatures','referenceSource','referenceDetails','referencePhoto','horticulture','landscapeContext','sourceCautions','njEvidence'])='{}'::jsonb);
alter table public.species_reference_cache drop constraint if exists species_reference_cache_profile_check;
alter table public.species_reference_cache add constraint species_reference_cache_profile_check check (jsonb_typeof(profile)='object' and octet_length(profile::text)<=100000 and replace(lower(profile->>'scientificName'),' x ',' × ')=canonical_taxon);
alter table public.species_reference_cache enable row level security;
alter table public.species_reference_cache force row level security;
revoke all on public.species_reference_cache from public, anon, authenticated;
grant select,insert,update,delete on public.species_reference_cache to service_role;
comment on table public.species_reference_cache is 'Server-managed shared botanical references only; no user identities, locations, surveys or uploaded images. RLS has no browser policies.';
create index if not exists species_reference_cache_expiry on public.species_reference_cache(expires_at);
