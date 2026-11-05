-- Synthetic fixtures exist only inside this transaction. Run using the management SQL API.
begin;
insert into auth.users(id,email) values
 ('f8160011-1111-4111-8111-111111111111','nativeyard-rollback-owner1@example.invalid'),
 ('f8160011-1111-4111-8111-222222222222','nativeyard-rollback-owner2@example.invalid');
insert into public.properties(id,user_id,name,zip) values
 ('f8160022-1111-4111-8111-111111111111','f8160011-1111-4111-8111-111111111111','Rollback home1','07645'),
 ('f8160022-1111-4111-8111-222222222222','f8160011-1111-4111-8111-111111111111','Rollback home2','07645'),
 ('f8160022-1111-4111-8111-333333333333','f8160011-1111-4111-8111-222222222222','Rollback otherowner','07645');
insert into public.yard_areas(id,property_id,name) values
 ('f8160033-1111-4111-8111-111111111111','f8160022-1111-4111-8111-111111111111','A'),
 ('f8160033-1111-4111-8111-222222222222','f8160022-1111-4111-8111-111111111111','B'),
 ('f8160033-1111-4111-8111-333333333333','f8160022-1111-4111-8111-222222222222','C'),
 ('f8160033-1111-4111-8111-444444444444','f8160022-1111-4111-8111-333333333333','D');
insert into public.ny_surveys(id,yard_area_id,photo_path,payload,created_at) values
 ('f8160044-1111-4111-8111-111111111111','f8160033-1111-4111-8111-111111111111','f8160011-1111-4111-8111-111111111111/test.jpg','{}',now()),
 ('f8160044-1111-4111-8111-222222222222','f8160033-1111-4111-8111-222222222222','f8160011-1111-4111-8111-111111111111/test2.jpg','{}',now()),
 ('f8160044-1111-4111-8111-333333333333','f8160033-1111-4111-8111-333333333333','f8160011-1111-4111-8111-111111111111/test3.jpg','{}',now()),
 ('f8160044-1111-4111-8111-444444444444','f8160033-1111-4111-8111-444444444444','f8160011-1111-4111-8111-222222222222/test4.jpg','{}',now());
select set_config('request.jwt.claim.sub','f8160011-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
declare stamp timestamptz; rejected boolean; affected integer;
begin
 insert into public.ny_roadmap_tasks(id,property_id,yard_area_id,title,plan_year,season,survey_id) values
 ('f8160055-1111-4111-8111-111111111111','f8160022-1111-4111-8111-111111111111','f8160033-1111-4111-8111-111111111111','Rollback task',2026,'Autumn','f8160044-1111-4111-8111-111111111111');
 update public.ny_roadmap_tasks set done=true where id='f8160055-1111-4111-8111-111111111111';
 select completed_at into stamp from public.ny_roadmap_tasks where id='f8160055-1111-4111-8111-111111111111';
 if stamp is null then raise exception 'FAIL completion timestamp missing'; end if;
 update public.ny_roadmap_tasks set notes='Edited completion' where id='f8160055-1111-4111-8111-111111111111';
 if (select completed_at from public.ny_roadmap_tasks where id='f8160055-1111-4111-8111-111111111111') is distinct from stamp then raise exception 'FAIL completed edit changed timestamp'; end if;
 update public.ny_roadmap_tasks set done=false where id='f8160055-1111-4111-8111-111111111111';
 if (select completed_at from public.ny_roadmap_tasks where id='f8160055-1111-4111-8111-111111111111') is not null then raise exception 'FAIL undo retained completion date'; end if;
 -- Simulate existing completed legacy row with genuinely unknown timestamp.
 update public.ny_roadmap_tasks set done=true where id='f8160055-1111-4111-8111-111111111111';
 update public.ny_roadmap_tasks set completed_at=null,plan_year=null,season=null where id='f8160055-1111-4111-8111-111111111111';
 update public.ny_roadmap_tasks set notes='Legacy edit' where id='f8160055-1111-4111-8111-111111111111';
 if exists(select 1 from public.ny_roadmap_tasks where id='f8160055-1111-4111-8111-111111111111' and (completed_at is not null or plan_year is not null)) then raise exception 'FAIL fabricated legacy metadata'; end if;
 -- Same property, different selected area must be rejected.
 rejected=false; begin
  update public.ny_roadmap_tasks set survey_id='f8160044-1111-4111-8111-222222222222' where id='f8160055-1111-4111-8111-111111111111';
 exception when raise_exception then if sqlerrm like 'Linked survey must%' then rejected=true; else raise; end if; end;
 if not rejected then raise exception 'FAIL other-area association accepted'; end if;
 -- Same owner, another property must be rejected.
 rejected=false; begin
  update public.ny_roadmap_tasks set survey_id='f8160044-1111-4111-8111-333333333333' where id='f8160055-1111-4111-8111-111111111111';
 exception when raise_exception then if sqlerrm like 'Linked survey must%' then rejected=true; else raise; end if; end;
 if not rejected then raise exception 'FAIL other-property association accepted'; end if;
 -- Other owner's observation must be rejected even though its ID is known.
 rejected=false; begin
  update public.ny_roadmap_tasks set survey_id='f8160044-1111-4111-8111-444444444444' where id='f8160055-1111-4111-8111-111111111111';
 exception when raise_exception then if sqlerrm like 'Linked survey must%' then rejected=true; else raise; end if; end;
 if not rejected then raise exception 'FAIL cross-owner association accepted'; end if;
 -- Whole-property task can reference either owned area in that property.
 update public.ny_roadmap_tasks set yard_area_id=null,survey_id='f8160044-1111-4111-8111-222222222222' where id='f8160055-1111-4111-8111-111111111111';
 rejected=false; begin
  update public.ny_surveys set yard_area_id='f8160033-1111-4111-8111-222222222222' where id='f8160044-1111-4111-8111-111111111111';
 exception when raise_exception then if sqlerrm like 'Saved surveys cannot%' then rejected=true; else raise; end if; end;
 if not rejected then raise exception 'FAIL saved area reassignment accepted'; end if;
 -- Ownership remains enforced for renaming.
 update public.properties set name='Attempted cross-owner rename' where id='f8160022-1111-4111-8111-333333333333';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL cross-owner rename allowed'; end if;
 update public.properties set name='Owned rename' where id='f8160022-1111-4111-8111-111111111111';
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'FAIL owned rename denied'; end if;
end $$;
rollback;
select 'PASS: completion,undo,legacy timestamps,scope guards,immutable scan area,ownership' as result,
 (select count(*) from auth.users where id in ('f8160011-1111-4111-8111-111111111111','f8160011-1111-4111-8111-222222222222')) as persisted_test_users;
