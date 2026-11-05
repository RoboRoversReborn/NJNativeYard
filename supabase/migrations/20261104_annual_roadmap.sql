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
