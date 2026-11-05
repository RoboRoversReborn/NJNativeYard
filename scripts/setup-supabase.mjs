// One-time management utility. Reads local credentials; never prints them.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const config={...process.env};
const envFile=path.join(root,'.env.local');
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split('\n')){const match=line.match(/^([A-Z_]+)=(.*)$/);if(match)config[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}
const token=config.SUPABASE_ACCESS_TOKEN;
if(!token){console.error('Setup requires SUPABASE_ACCESS_TOKEN in the ignored .env.local file. The app anon key cannot create tables.');process.exit(2);}
const project=new URL(config.NEXT_PUBLIC_SUPABASE_URL||'').hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1];
if(!project){console.error('A standard Supabase project URL is required. localhost is the app URL, not the database project URL.');process.exit(2);}
async function query(sql,readOnly=true){const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Supabase management request failed (HTTP ${response.status}). Check token validity and project permissions.`);return response.json();}
try{
 if(process.argv.includes('--apply')){const sql=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');await query(`begin;\n${sql}\nnotify pgrst, 'reload schema';\ncommit;`,false);console.log('Applied app tables, owner policies, and private survey-photo storage.');}
 const results=await query("select c.relname as table_name,c.relrowsecurity as rls_enabled,(select count(*)::int from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policy_count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('properties','yard_areas','ny_surveys','ny_roadmap_tasks') order by c.relname");
 console.log(JSON.stringify({tables:results},null,2));
 console.log(JSON.stringify({storage:await query("select id,public,file_size_limit from storage.buckets where id='nativeyard-surveys'")},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
