-- Only synthetic fixtures; all records and any dry-run schema changes are rolled back.
begin;
insert into auth.users(id,email) values
 ('f9280011-1111-4111-8111-111111111111','nativeyard-baseline-owner1@example.invalid'),
 ('f9280011-1111-4111-8111-222222222222','nativeyard-baseline-owner2@example.invalid');
insert into public.properties(id,user_id,name,zip) values
 ('f9280022-1111-4111-8111-111111111111','f9280011-1111-4111-8111-111111111111','Baseline rollback A','07645'),
 ('f9280022-1111-4111-8111-222222222222','f9280011-1111-4111-8111-222222222222','Baseline rollback B','07645');
insert into public.yard_areas(id,property_id,name) values
 ('f9280033-1111-4111-8111-111111111111','f9280022-1111-4111-8111-111111111111','First area'),
 ('f9280033-1111-4111-8111-222222222222','f9280022-1111-4111-8111-111111111111','Other area'),
 ('f9280033-1111-4111-8111-333333333333','f9280022-1111-4111-8111-222222222222','Other owner');
insert into public.ny_surveys(id,yard_area_id,photo_path,payload,created_at) values
 ('f9280044-1111-4111-8111-111111111111','f9280033-1111-4111-8111-111111111111','f9280011-1111-4111-8111-111111111111/test1.jpg','{"source":"upload"}',now()),
 ('f9280044-1111-4111-8111-222222222222','f9280033-1111-4111-8111-111111111111','f9280011-1111-4111-8111-111111111111/test2.jpg','{"source":"upload"}',now()),
 ('f9280044-1111-4111-8111-333333333333','f9280033-1111-4111-8111-222222222222','f9280011-1111-4111-8111-111111111111/test3.jpg','{"source":"upload"}',now()),
 ('f9280044-1111-4111-8111-444444444444','f9280033-1111-4111-8111-333333333333','f9280011-1111-4111-8111-222222222222/test4.jpg','{"source":"upload"}',now()),
 ('f9280044-1111-4111-8111-555555555555','f9280033-1111-4111-8111-111111111111','f9280011-1111-4111-8111-111111111111/sample.jpg','{"source":"sample"}',now());
select set_config('request.jwt.claim.sub','f9280011-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
declare rejected boolean; target uuid;
begin
 if exists(select 1 from public.yard_areas where property_id='f9280022-1111-4111-8111-111111111111' and baseline_survey_id is not null) or exists(select 1 from public.ny_area_baseline_events where property_id='f9280022-1111-4111-8111-111111111111') then raise exception 'FAIL invented baseline or legacy audit'; end if;
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-111111111111','First repeatable view');
 if not exists(select 1 from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111' and event_type='selected' and before_survey_id is null and after_survey_id='f9280044-1111-4111-8111-111111111111' and actor_user_id=auth.uid() and occurred_at>=transaction_timestamp()) then raise exception 'FAIL selected baseline audit'; end if;
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-111111111111','Idempotent retry');
 if (select count(*) from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111')<>1 then raise exception 'FAIL duplicate selection event'; end if;
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-222222222222','Better documented view');
 if not exists(select 1 from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111' and event_type='replaced' and before_survey_id='f9280044-1111-4111-8111-111111111111' and after_survey_id='f9280044-1111-4111-8111-222222222222' and before_state->>'baseline_survey_id'='f9280044-1111-4111-8111-111111111111') then raise exception 'FAIL replacement snapshots'; end if;
 rejected=false;begin update public.yard_areas set baseline_survey_id='f9280044-1111-4111-8111-111111111111' where id='f9280033-1111-4111-8111-111111111111';exception when raise_exception then if sqlerrm like 'Choose a baseline through%' then rejected=true;else raise;end if;end;
 if not rejected then raise exception 'FAIL unreasoned direct update accepted'; end if;
 foreach target in array array['f9280044-1111-4111-8111-333333333333'::uuid,'f9280044-1111-4111-8111-444444444444'::uuid,'f9280044-1111-4111-8111-555555555555'::uuid] loop
  rejected=false;begin perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111',target,'Invalid scope test');exception when raise_exception then if sqlerrm like 'Baseline must be a real%' then rejected=true;else raise;end if;end;
  if not rejected then raise exception 'FAIL cross-area/owner/sample baseline accepted'; end if;
 end loop;
 rejected=false;begin perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111',null,'');exception when invalid_parameter_value then rejected=true;end;
 if not rejected then raise exception 'FAIL empty reason accepted'; end if;
 rejected=false;begin update public.ny_surveys set payload='{"source":"sample"}' where id='f9280044-1111-4111-8111-222222222222';exception when raise_exception then if sqlerrm like 'A selected baseline must%' then rejected=true;else raise;end if;end;
 if not rejected then raise exception 'FAIL selected baseline changed to sample'; end if;
 rejected=false;begin insert into public.ny_area_baseline_events(area_id,property_id,owner_user_id,actor_type,event_type,reason,before_state,after_state) values('f9280033-1111-4111-8111-111111111111','f9280022-1111-4111-8111-111111111111',auth.uid(),'owner','cleared','Forgery','{}','{}');exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL client event append accepted'; end if;
 rejected=false;begin update public.ny_area_baseline_events set reason='Rewritten' where area_id='f9280033-1111-4111-8111-111111111111';exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL history rewrite accepted'; end if;
 rejected=false;begin delete from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111';exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL history deletion accepted'; end if;
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111',null,'Clear this choice');
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-111111111111','Restore first view');
 delete from public.ny_surveys where id='f9280044-1111-4111-8111-111111111111';
 if exists(select 1 from public.yard_areas where id='f9280033-1111-4111-8111-111111111111' and baseline_survey_id is not null) then raise exception 'FAIL deleted baseline not cleared'; end if;
 if not exists(select 1 from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111' and event_type='cleared' and reason='Source photo deleted; baseline selection cleared.' and before_survey_id='f9280044-1111-4111-8111-111111111111') then raise exception 'FAIL source-deletion clear missing audit'; end if;
 if (select count(*) from public.ny_area_baseline_events where area_id='f9280033-1111-4111-8111-111111111111')<>5 then raise exception 'FAIL expected five immutable baseline events'; end if;
end $$;
select set_config('request.jwt.claim.sub','f9280011-1111-4111-8111-222222222222',true);
do $$declare rejected boolean;begin
 if exists(select 1 from public.ny_area_baseline_events where property_id='f9280022-1111-4111-8111-111111111111') then raise exception 'FAIL cross-owner history exposed'; end if;
 rejected=false;begin perform public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-222222222222','Other owner attempt');exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL other owner changed baseline'; end if;
 perform public.ny_set_area_baseline('f9280033-1111-4111-8111-333333333333','f9280044-1111-4111-8111-444444444444','Owner B baseline');
 delete from public.properties where id='f9280022-1111-4111-8111-222222222222';
 if exists(select 1 from public.ny_area_baseline_events where property_id='f9280022-1111-4111-8111-222222222222') then raise exception 'FAIL property erasure retains private audit'; end if;
end $$;
select set_config('request.jwt.claim.sub','f9280011-1111-4111-8111-111111111111',true);
select public.ny_set_area_baseline('f9280033-1111-4111-8111-111111111111','f9280044-1111-4111-8111-222222222222','Account-erasure fixture');
reset role;
delete from auth.users where id='f9280011-1111-4111-8111-111111111111';
do $$begin if exists(select 1 from public.ny_area_baseline_events where owner_user_id='f9280011-1111-4111-8111-111111111111') then raise exception 'FAIL account erasure retains private audit';end if;end $$;
rollback;
select 'PASS: explicit/same-area real-upload baselines, immutable owner audit, source deletion and private erasure' as result,
 (select count(*) from auth.users where id in ('f9280011-1111-4111-8111-111111111111','f9280011-1111-4111-8111-222222222222')) as persisted_test_users;
