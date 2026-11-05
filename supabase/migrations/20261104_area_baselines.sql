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
