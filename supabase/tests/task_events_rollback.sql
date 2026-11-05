-- All identities and task records below are synthetic and rolled back.
begin;
insert into auth.users(id,email) values
 ('f9170011-1111-4111-8111-111111111111','nativeyard-event-owner1@example.invalid'),
 ('f9170011-1111-4111-8111-222222222222','nativeyard-event-owner2@example.invalid');
insert into public.properties(id,user_id,name,zip) values
 ('f9170022-1111-4111-8111-111111111111','f9170011-1111-4111-8111-111111111111','Event rollback A','07645'),
 ('f9170022-1111-4111-8111-222222222222','f9170011-1111-4111-8111-222222222222','Event rollback B','07645');
select set_config('request.jwt.claim.sub','f9170011-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
declare n integer; first_completion timestamptz; rejected boolean;
begin
 insert into public.ny_roadmap_tasks(id,property_id,title,notes,created_at) values
 ('f9170055-1111-4111-8111-111111111111','f9170022-1111-4111-8111-111111111111','Audited task','Initial note','2020-01-01T00:00:00Z');
 if (select count(*) from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111')<>1 then raise exception 'FAIL creation must append exactly one event'; end if;
 if not exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and event_type='created' and before_state is null and (after_state->'stage')='null'::jsonb and occurred_at>=transaction_timestamp()) then raise exception 'FAIL no fabricated legacy stage/date'; end if;
 update public.ny_roadmap_tasks set updated_at=clock_timestamp() where id='f9170055-1111-4111-8111-111111111111';
 if (select count(*) from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111')<>1 then raise exception 'FAIL timestamp-only touch generated an edit event'; end if;
 update public.ny_roadmap_tasks set done=true where id='f9170055-1111-4111-8111-111111111111';
 select completed_at into first_completion from public.ny_roadmap_tasks where id='f9170055-1111-4111-8111-111111111111';
 if first_completion is null then raise exception 'FAIL completion timestamp'; end if;
 if not exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and event_type='completed' and (before_state->>'done')::boolean=false and (after_state->>'done')::boolean=true and (after_state->>'completed_at')::timestamptz=first_completion) then raise exception 'FAIL completion snapshots'; end if;
 update public.ny_roadmap_tasks set notes='Edited after completion' where id='f9170055-1111-4111-8111-111111111111';
 if not exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and event_type='edited' and changed_fields=array['notes'] and before_state->>'notes'='Initial note' and after_state->>'notes'='Edited after completion') then raise exception 'FAIL note edit snapshots'; end if;
 update public.ny_roadmap_tasks set done=false where id='f9170055-1111-4111-8111-111111111111';
 if not exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and event_type='reopened' and (before_state->>'completed_at')::timestamptz=first_completion and after_state->'completed_at'='null'::jsonb) then raise exception 'FAIL undo lost original completion'; end if;
 update public.ny_roadmap_tasks set stage='Review',plan_year=2027 where id='f9170055-1111-4111-8111-111111111111';
 if not exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and event_type='edited' and changed_fields @> array['stage','plan_year'] and before_state->'stage'='null'::jsonb and after_state->>'stage'='Review') then raise exception 'FAIL stage/year audit'; end if;
 update public.ny_roadmap_tasks set done=true where id='f9170055-1111-4111-8111-111111111111';
 rejected=false;begin update public.ny_roadmap_tasks set stage='Unsupported' where id='f9170055-1111-4111-8111-111111111111';exception when check_violation then rejected=true;end;
 if not rejected then raise exception 'FAIL invalid stage accepted'; end if;
 select count(*) into n from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111';
 if n<>6 then raise exception 'FAIL expected six append-only events'; end if;
 if exists(select 1 from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111' and (actor_user_id is distinct from auth.uid() or owner_user_id<>auth.uid() or actor_type<>'owner')) then raise exception 'FAIL actor ownership'; end if;
 rejected=false;begin
  insert into public.ny_task_events(task_id,property_id,owner_user_id,actor_type,event_type,changed_fields,after_state) values('f9170055-1111-4111-8111-111111111111','f9170022-1111-4111-8111-111111111111',auth.uid(),'owner','created',array['notes'],'{}');
 exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL direct event insertion permitted'; end if;
 rejected=false;begin update public.ny_task_events set event_type='created' where task_id='f9170055-1111-4111-8111-111111111111';exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL client event rewrite permitted'; end if;
 rejected=false;begin delete from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111';exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL client history deletion permitted'; end if;
end $$;
select set_config('request.jwt.claim.sub','f9170011-1111-4111-8111-222222222222',true);
do $$
declare n integer;
begin
 if exists(select 1 from public.ny_task_events where property_id='f9170022-1111-4111-8111-111111111111') then raise exception 'FAIL other owner history exposed'; end if;
 insert into public.ny_roadmap_tasks(id,property_id,title) values('f9170055-1111-4111-8111-222222222222','f9170022-1111-4111-8111-222222222222','Owner B task');
 if (select count(*) from public.ny_task_events where property_id='f9170022-1111-4111-8111-222222222222')<>1 then raise exception 'FAIL own second-owner history unreadable'; end if;
 update public.ny_roadmap_tasks set notes='Forbidden' where id='f9170055-1111-4111-8111-111111111111';get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL cross-owner task modification'; end if;
end $$;
select set_config('request.jwt.claim.sub','f9170011-1111-4111-8111-111111111111',true);
do $$begin
 if (select count(*) from public.ny_task_events where task_id='f9170055-1111-4111-8111-111111111111')<>6 then raise exception 'FAIL owner A history changed'; end if;
 if exists(select 1 from public.ny_task_events where property_id='f9170022-1111-4111-8111-222222222222') then raise exception 'FAIL owner B history exposed'; end if;
end $$;
rollback;
select 'PASS: append-only create/complete/edit/reopen/stage snapshots, original timestamps, owner RLS and denied client mutation' as result,
 (select count(*) from auth.users where id in ('f9170011-1111-4111-8111-111111111111','f9170011-1111-4111-8111-222222222222')) as persisted_test_users;
