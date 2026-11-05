-- Combined app: apply once in your Supabase SQL editor. Existing donor tables are preserved.
create table if not exists public.properties (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null, zip text, address text, created_at timestamptz not null default now()
);
alter table public.properties enable row level security;
drop policy if exists "ny_properties_owner" on public.properties;
create policy "ny_properties_owner" on public.properties for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create table if not exists public.yard_areas (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties on delete cascade,
 name text not null, created_at timestamptz not null default now()
);
alter table public.yard_areas enable row level security;
drop policy if exists "ny_areas_owner" on public.yard_areas;
create policy "ny_areas_owner" on public.yard_areas for all to authenticated
 using (exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
 with check (exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()));
create unique index if not exists ny_area_property_pair on public.yard_areas(id,property_id);
create table if not exists public.ny_surveys (
 id uuid primary key, yard_area_id uuid not null references public.yard_areas on delete cascade,
 photo_path text not null, payload jsonb not null, created_at timestamptz not null, updated_at timestamptz not null default now()
);
alter table public.ny_surveys enable row level security;
drop policy if exists "ny_surveys_owner" on public.ny_surveys;
create policy "ny_surveys_owner" on public.ny_surveys for all to authenticated
 using (exists(select 1 from public.yard_areas a join public.properties p on p.id=a.property_id where a.id=yard_area_id and p.user_id=auth.uid()))
 with check (exists(select 1 from public.yard_areas a join public.properties p on p.id=a.property_id where a.id=yard_area_id and p.user_id=auth.uid()) and photo_path like auth.uid()::text || '/%');
create table if not exists public.ny_roadmap_tasks (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties on delete cascade,
 yard_area_id uuid, title text not null check(length(trim(title))>0), notes text not null default '', replacement_id text,
 done boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(yard_area_id,property_id) references public.yard_areas(id,property_id) on delete cascade
);
alter table public.ny_roadmap_tasks enable row level security;
drop policy if exists "ny_tasks_owner" on public.ny_roadmap_tasks;
create policy "ny_tasks_owner" on public.ny_roadmap_tasks for all to authenticated
 using (exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()))
 with check (exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('nativeyard-surveys','nativeyard-surveys',false,12582912,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists "ny_photo_owner" on storage.objects;
create policy "ny_photo_owner" on storage.objects for all to authenticated
 using(bucket_id='nativeyard-surveys' and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='nativeyard-surveys' and (storage.foldername(name))[1]=auth.uid()::text);
grant select,insert,update,delete on public.properties,public.yard_areas,public.ny_surveys,public.ny_roadmap_tasks to authenticated;

-- Annual task metadata, scope validation and completion timestamps.
-- Nullable metadata preserves existing undated roadmap tasks and clean note text.
alter table public.ny_roadmap_tasks add column if not exists plan_year integer;
alter table public.ny_roadmap_tasks add column if not exists season text;
alter table public.ny_roadmap_tasks add column if not exists completed_at timestamptz;
alter table public.ny_roadmap_tasks add column if not exists survey_id uuid references public.ny_surveys(id) on delete set null;
alter table public.ny_roadmap_tasks drop constraint if exists ny_tasks_plan_year;
alter table public.ny_roadmap_tasks add constraint ny_tasks_plan_year check(plan_year is null or plan_year between 2000 and 2200);
alter table public.ny_roadmap_tasks drop constraint if exists ny_tasks_season;
alter table public.ny_roadmap_tasks add constraint ny_tasks_season check(season is null or season in ('Spring','Summer','Autumn','Winter','Any season'));
-- Association must belong to the same property, and the selected area when one is set.
-- Invoker security + existing ownership RLS prevents cross-account references.
create or replace function public.ny_check_task_survey_scope() returns trigger language plpgsql set search_path=public as $$
begin
 if new.survey_id is not null and not exists(
  select 1 from public.ny_surveys s join public.yard_areas a on a.id=s.yard_area_id
  join public.properties p on p.id=a.property_id
  where s.id=new.survey_id and a.property_id=new.property_id and p.user_id=auth.uid()
  and (new.yard_area_id is null or s.yard_area_id=new.yard_area_id)
 ) then raise exception 'Linked survey must belong to this property and selected yard area'; end if;
 if not new.done then new.completed_at=null; end if;
 if new.done and new.completed_at is null and (TG_OP='INSERT' or not old.done) then new.completed_at=now(); end if;
 return new;
end $$;
drop trigger if exists ny_task_survey_scope on public.ny_roadmap_tasks;
create trigger ny_task_survey_scope before insert or update on public.ny_roadmap_tasks for each row execute function public.ny_check_task_survey_scope();

-- A saved observation keeps its original area so linked actions retain their provenance.
create or replace function public.ny_lock_saved_survey_area() returns trigger language plpgsql set search_path=public as $$
begin
 if new.yard_area_id is distinct from old.yard_area_id then raise exception 'Saved surveys cannot be reassigned to another yard area'; end if;
 return new;
end $$;
drop trigger if exists ny_survey_area_immutable on public.ny_surveys;
create trigger ny_survey_area_immutable before update of yard_area_id on public.ny_surveys for each row execute function public.ny_lock_saved_survey_area();

-- Included migration: 20261104_task_events.sql
-- Additive task audit. Existing rows are not rewritten or given fabricated history.
begin;
alter table public.ny_roadmap_tasks add column if not exists stage text;
alter table public.ny_roadmap_tasks drop constraint if exists ny_tasks_stage;
alter table public.ny_roadmap_tasks add constraint ny_tasks_stage check(stage is null or stage in ('Review','Plan','Do','Revisit'));

create table if not exists public.ny_task_events (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null,
 property_id uuid not null references public.properties(id) on delete cascade,
 yard_area_id uuid,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 actor_type text not null check(actor_type in ('owner','system')),
 event_type text not null check(event_type in ('created','completed','reopened','edited')),
 occurred_at timestamptz not null default clock_timestamp(),
 changed_fields text[] not null,
 before_state jsonb,
 after_state jsonb not null
);
comment on table public.ny_task_events is 'Owner-readable immutable task events appended only by a trusted database trigger. No legacy backfill. Parent-property/account deletion cascades private history; deleting one task retains its audit rows.';
create index if not exists ny_task_events_property_time on public.ny_task_events(property_id,occurred_at desc);
create index if not exists ny_task_events_task_time on public.ny_task_events(task_id,occurred_at desc);
alter table public.ny_task_events enable row level security;
drop policy if exists ny_task_events_owner_read on public.ny_task_events;
create policy ny_task_events_owner_read on public.ny_task_events for select to authenticated
 using(owner_user_id=auth.uid() and exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()));
revoke all privileges on public.ny_task_events from public,anon,authenticated;
grant select on public.ny_task_events to authenticated;

create or replace function public.ny_record_task_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid;
 actor_id uuid;
 event_kind text;
 old_state jsonb;
 new_state jsonb;
 fields text[];
begin
 select p.user_id into owner_id from public.properties p where p.id=new.property_id;
 if owner_id is null then raise exception 'Task history requires an owned property'; end if;
 actor_id=auth.uid();
 if actor_id is not null and actor_id<>owner_id then raise exception 'Task history actor must own this property'; end if;
 new_state=to_jsonb(new);
 if tg_op='INSERT' then
  old_state=null;
  event_kind='created';
  select array_agg(k order by k) into fields from jsonb_object_keys(new_state) as keys(k) where k<>'updated_at';
 else
  old_state=to_jsonb(old);
  if (old_state-'updated_at') is not distinct from (new_state-'updated_at') then return new; end if;
  if not old.done and new.done then event_kind='completed';
  elsif old.done and not new.done then event_kind='reopened';
  else event_kind='edited'; end if;
  select array_agg(k order by k) into fields from jsonb_object_keys(new_state) as keys(k)
   where k<>'updated_at' and (old_state->k) is distinct from (new_state->k);
 end if;
 insert into public.ny_task_events(task_id,property_id,yard_area_id,owner_user_id,actor_user_id,actor_type,event_type,occurred_at,changed_fields,before_state,after_state)
 values(new.id,new.property_id,new.yard_area_id,owner_id,actor_id,case when actor_id is null then 'system' else 'owner' end,event_kind,clock_timestamp(),coalesce(fields,array[]::text[]),old_state,new_state);
 return new;
end $$;
revoke all on function public.ny_record_task_event() from public,anon,authenticated;
drop trigger if exists ny_task_event_history on public.ny_roadmap_tasks;
create trigger ny_task_event_history after insert or update on public.ny_roadmap_tasks
 for each row execute function public.ny_record_task_event();
notify pgrst, 'reload schema';
commit;


-- Included migration: 20261104_area_baselines.sql
-- Explicit, owner-selected baselines. Existing areas keep null; no historical choice is invented.
begin;
alter table public.yard_areas add column if not exists baseline_survey_id uuid references public.ny_surveys(id) on delete set null;
create table if not exists public.ny_area_baseline_events (
 id uuid primary key default gen_random_uuid(),
 area_id uuid not null references public.yard_areas(id) on delete cascade,
 property_id uuid not null references public.properties(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 actor_type text not null check(actor_type in ('owner','system')),
 event_type text not null check(event_type in ('selected','replaced','cleared')),
 occurred_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 before_survey_id uuid,
 after_survey_id uuid,
 before_state jsonb not null,
 after_state jsonb not null
);
create index if not exists ny_baseline_events_area_time on public.ny_area_baseline_events(area_id,occurred_at desc);
alter table public.ny_area_baseline_events enable row level security;
drop policy if exists ny_baseline_events_owner_read on public.ny_area_baseline_events;
create policy ny_baseline_events_owner_read on public.ny_area_baseline_events for select to authenticated
 using(owner_user_id=auth.uid() and exists(select 1 from public.properties p where p.id=property_id and p.user_id=auth.uid()));
revoke all privileges on public.ny_area_baseline_events from public,anon,authenticated;
grant select on public.ny_area_baseline_events to authenticated;

create or replace function public.ny_validate_area_baseline() returns trigger language plpgsql set search_path='' as $$
declare owner_id uuid; change_reason text;
begin
 if tg_op='INSERT' then
  if new.baseline_survey_id is not null then raise exception 'Create the area before choosing its baseline'; end if;
  return new;
 end if;
 if new.baseline_survey_id is not distinct from old.baseline_survey_id then return new; end if;
 -- FK deletion clears a missing source; the audit trigger records that automatic reason.
 if new.baseline_survey_id is null and pg_trigger_depth()>1 then return new; end if;
 select p.user_id into owner_id from public.properties p where p.id=new.property_id;
 if owner_id is null or auth.uid() is distinct from owner_id then raise exception 'Baseline area is unavailable' using errcode='42501'; end if;
 change_reason=nullif(trim(current_setting('nativeyard.baseline_reason',true)),'');
 if change_reason is null then raise exception 'Choose a baseline through the audited baseline action'; end if;
 if new.baseline_survey_id is not null and not exists(select 1 from public.ny_surveys s where s.id=new.baseline_survey_id and s.yard_area_id=new.id and s.payload->>'source'='upload') then raise exception 'Baseline must be a real uploaded photo from this area'; end if;
 return new;
end $$;
revoke all on function public.ny_validate_area_baseline() from public,anon,authenticated;
drop trigger if exists ny_area_baseline_valid on public.yard_areas;
create trigger ny_area_baseline_valid before insert or update of baseline_survey_id on public.yard_areas for each row execute function public.ny_validate_area_baseline();

create or replace function public.ny_record_area_baseline() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; actor_id uuid; change_reason text;
begin
 if new.baseline_survey_id is not distinct from old.baseline_survey_id then return new; end if;
 select p.user_id into owner_id from public.properties p where p.id=new.property_id;
 -- Property/account erasure cascades private history; do not create records during its deletion.
 if owner_id is null or not exists(select 1 from auth.users u where u.id=owner_id) then return new; end if;
 actor_id=auth.uid();
 if actor_id is not null and actor_id<>owner_id then raise exception 'Baseline history actor must own this area'; end if;
 change_reason=nullif(trim(current_setting('nativeyard.baseline_reason',true)),'');
 if change_reason is null and new.baseline_survey_id is null then change_reason='Source photo deleted; baseline selection cleared.'; end if;
 if change_reason is null then raise exception 'Baseline reason is required'; end if;
 insert into public.ny_area_baseline_events(area_id,property_id,owner_user_id,actor_user_id,actor_type,event_type,occurred_at,reason,before_survey_id,after_survey_id,before_state,after_state)
 values(new.id,new.property_id,owner_id,actor_id,case when actor_id is null then 'system' else 'owner' end,case when new.baseline_survey_id is null then 'cleared' when old.baseline_survey_id is null then 'selected' else 'replaced' end,clock_timestamp(),change_reason,old.baseline_survey_id,new.baseline_survey_id,to_jsonb(old),to_jsonb(new));
 return new;
end $$;
revoke all on function public.ny_record_area_baseline() from public,anon,authenticated;
drop trigger if exists ny_area_baseline_history on public.yard_areas;
create trigger ny_area_baseline_history after update of baseline_survey_id on public.yard_areas for each row execute function public.ny_record_area_baseline();

create or replace function public.ny_set_area_baseline(p_area_id uuid,p_survey_id uuid,p_reason text) returns uuid language plpgsql set search_path='' as $$
declare owned_area uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to choose a baseline' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'Give a reason of 1 to 1000 characters' using errcode='22023'; end if;
 select a.id into owned_area from public.yard_areas a join public.properties p on p.id=a.property_id where a.id=p_area_id and p.user_id=auth.uid() for update of a;
 if owned_area is null then raise exception 'Baseline area is unavailable' using errcode='42501'; end if;
 perform set_config('nativeyard.baseline_reason',trim(p_reason),true);
 update public.yard_areas set baseline_survey_id=p_survey_id where id=owned_area;
 perform set_config('nativeyard.baseline_reason','',true);
 return p_survey_id;
end $$;
revoke all on function public.ny_set_area_baseline(uuid,uuid,text) from public,anon;
grant execute on function public.ny_set_area_baseline(uuid,uuid,text) to authenticated;

create or replace function public.ny_preserve_baseline_upload_source() returns trigger language plpgsql set search_path='' as $$
begin
 if new.payload->>'source' is distinct from 'upload' and exists(select 1 from public.yard_areas a where a.baseline_survey_id=new.id) then raise exception 'A selected baseline must remain a real uploaded-photo record'; end if;
 return new;
end $$;
revoke all on function public.ny_preserve_baseline_upload_source() from public,anon,authenticated;
drop trigger if exists ny_baseline_source_upload on public.ny_surveys;
create trigger ny_baseline_source_upload before update of payload on public.ny_surveys for each row execute function public.ny_preserve_baseline_upload_source();
notify pgrst,'reload schema';
commit;

