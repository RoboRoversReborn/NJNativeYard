-- Additive metadata only. Ownership RLS and the existing scope/history triggers remain authoritative.
alter table public.ny_roadmap_tasks add column if not exists auto_key text;
alter table public.ny_roadmap_tasks add column if not exists due_start date;
alter table public.ny_roadmap_tasks add column if not exists due_end date;
alter table public.ny_roadmap_tasks add column if not exists source_details text;
-- PostgreSQL allows repeated NULLs, so manual tasks remain unrestricted.
create unique index if not exists ny_tasks_auto_key on public.ny_roadmap_tasks(property_id,auto_key);
alter table public.ny_roadmap_tasks drop constraint if exists ny_tasks_due_window;
alter table public.ny_roadmap_tasks add constraint ny_tasks_due_window check(due_start is null or due_end is null or due_start<=due_end);
