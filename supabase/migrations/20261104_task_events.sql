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
