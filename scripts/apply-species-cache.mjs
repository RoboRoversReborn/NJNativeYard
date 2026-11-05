// One-time server-only migration. Never prints environment values.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const config={...process.env};
const envFile=path.join(root,'.env.local');
if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile,'utf8').split('\n')) {const m=line.match(/^([A-Z_]+)=(.*)$/);if(m && !config[m[1]])config[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const project=/^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(config.NEXT_PUBLIC_SUPABASE_URL||'')?.[1];
if(!project || !config.SUPABASE_ACCESS_TOKEN){console.error('Requires configured Supabase project and server-only SUPABASE_ACCESS_TOKEN.');process.exit(2);}
async function query(sql,readOnly=true){const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${config.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Supabase management request failed (HTTP ${response.status}).`);return response.json();}
try {
 if(process.argv.includes('--apply')){await query(`begin;\n${fs.readFileSync(path.join(root,'supabase/migrations/20261105_species_reference_cache.sql'),'utf8')}\nnotify pgrst, 'reload schema';\ncommit;`,false);console.log('Applied shared botanical cache migration.');}
 console.log(JSON.stringify(await query("select c.relname,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,has_table_privilege('anon','public.species_reference_cache','INSERT') as anon_insert,has_table_privilege('authenticated','public.species_reference_cache','INSERT') as authenticated_insert,(select count(*) from pg_policies where schemaname='public' and tablename='species_reference_cache') as browser_policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='species_reference_cache'"),null,2));
 console.log(JSON.stringify({entries:await query("select canonical_taxon,provider,version,created_at,updated_at,expires_at,(expires_at>now()) as fresh from public.species_reference_cache order by updated_at desc limit 10")},null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
