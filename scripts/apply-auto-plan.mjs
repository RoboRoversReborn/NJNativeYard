// Schema only. Never creates user rows or prints host-held credentials.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const config={...process.env};
for(const file of [path.join(root,'.env.local'),process.env.NATIVEYARD_MANAGEMENT_ENV].filter(Boolean)) {
  if(!fs.existsSync(file)) continue;
  for(const line of fs.readFileSync(file,'utf8').split('\n')) {
    const m=line.match(/^(?:export )?([A-Z_]+)=(.*)$/);
    if(m && !config[m[1]]) config[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');
  }
}
const project=/^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(config.NEXT_PUBLIC_SUPABASE_URL||'')?.[1];
if(!project || !config.SUPABASE_ACCESS_TOKEN) {console.error('Requires configured project and host-held SUPABASE_ACCESS_TOKEN.');process.exit(2);}
async function query(sql,readOnly=true) {
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${config.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(20000)});
 if(!response.ok) throw new Error(`Schema request failed (HTTP ${response.status}).`);
 return response.json();
}
try {
 if(process.argv.includes('--apply')) {await query(`begin;\n${fs.readFileSync(path.join(root,'supabase/migrations/20261105_auto_yard_plan.sql'),'utf8')}\nnotify pgrst, 'reload schema';\ncommit;`,false); console.log('Applied automatic yard plan schema.');}
 console.log(JSON.stringify(await query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='ny_roadmap_tasks' and column_name in ('auto_key','due_start','due_end','source_details') order by column_name")));
 console.log(JSON.stringify(await query("select c.relrowsecurity as rls,(select count(*) from pg_policies where schemaname='public' and tablename='ny_roadmap_tasks') as policies,(select count(*) from pg_indexes where schemaname='public' and indexname='ny_tasks_auto_key') as unique_index from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='ny_roadmap_tasks'")));
} catch(error) {console.error(error.message);process.exitCode=1;}
