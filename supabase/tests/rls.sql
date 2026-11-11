-- RLS-test for Arvora. Køres som postgres (fx gennem Supabase SQL editor eller MCP). Hver linje i resultatet er PASS/FAIL.
-- Testen skifter rolle til authenticated med forskellige brugere og prøver at gå uden om reglerne.
-- Testbrugerne har faste id'er og ryddes op til sidst.
create temp table if not exists t (n timestamptz default clock_timestamp(), name text, ok boolean);
truncate t;
grant select, insert on t to authenticated;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $f$ begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $f$;
create or replace function pg_temp.as_server() returns void language plpgsql as $f$ begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $f$;

do $$
declare
  ua uuid := '00000000-0000-4000-8000-00000000000a'; -- tovholder og arving (Mette)
  ub uuid := '00000000-0000-4000-8000-00000000000b'; -- arving (Lars)
  uc uuid := '00000000-0000-4000-8000-00000000000c'; -- arving (Anna)
  ux uuid := '00000000-0000-4000-8000-00000000000e'; -- fremmed bruger uden for boet
  eid uuid; ha uuid; hb uuid; hc uuid; i1 uuid; i2 uuid; i3 uuid; run uuid; n int; j jsonb; lod0 bigint;
begin
  -- oprydning fra sidst
  perform pg_temp.as_server();
  delete from estates where created_by in (ua, ub, uc, ux);
  delete from auth.users where id in (ua, ub, uc, ux);
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@arvora.test', now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
           (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@arvora.test', now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
           (uc, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@arvora.test', now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
           (ux, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-x@arvora.test', now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  -- 1. Tovholderen opretter boet og arvingerne
  perform pg_temp.as_user(ua);
  eid := create_estate('Boet efter Inger Marie Jensen', '1938 – 2026', 'doed', 'point', null, null, true, 'Mette', 'Datter');
  select heir_id into ha from estate_members where estate_id = eid and user_id = ua;
  insert into heirs (estate_id, name, relation) values (eid, 'Lars', 'Søn') returning id into hb;
  insert into heirs (estate_id, name, relation, share) values (eid, 'Anna', 'Datter', 0.5) returning id into hc;
  insert into t (name, ok) values ('tovholder kan oprette bo og arvinger', ha is not null and hb is not null and hc is not null);
  select lod into lod0 from estates where id = eid;
  insert into t (name, ok) values ('loddet er trukket ved oprettelsen', lod0 between 1 and 4294967295);

  -- Tovholderen kan ikke sætte status eller betaling selv
  begin
    update estates set status = 'aaben' where id = eid;
    insert into t (name, ok) values ('tovholder kan IKKE sætte status direkte', false);
  exception when others then insert into t (name, ok) values ('tovholder kan IKKE sætte status direkte', true); end;
  begin
    update estates set paid_at = now() where id = eid;
    insert into t (name, ok) values ('tovholder kan IKKE markere boet som betalt', false);
  exception when others then insert into t (name, ok) values ('tovholder kan IKKE markere boet som betalt', true); end;
  begin
    update estates set lod = 12345 where id = eid;
    insert into t (name, ok) values ('loddet kan IKKE ændres', false);
  exception when others then insert into t (name, ok) values ('loddet kan IKKE ændres', true); end;
  begin
    perform open_estate(eid);
    insert into t (name, ok) values ('boet kan IKKE åbnes før betaling', false);
  exception when others then insert into t (name, ok) values ('boet kan IKKE åbnes før betaling', true); end;

  -- 2. Serveren registrerer betaling (Stripe-webhook) og kobler arvingerne til deres brugere (accept-invite)
  perform pg_temp.as_server();
  update estates set paid_at = now() where id = eid;
  update heirs set user_id = ub where id = hb;
  update heirs set user_id = uc where id = hc;
  insert into estate_members (estate_id, user_id, role, heir_id) values (eid, ub, 'arving', hb), (eid, uc, 'arving', hc);
  perform pg_temp.as_user(ua);
  perform open_estate(eid);
  insert into t (name, ok) values ('boet åbnes, når det er betalt', estate_status_of(eid) = 'aaben');
  insert into items (estate_id, name, room) values (eid, 'Bornholmerur', 'Stue') returning id into i1;
  insert into items (estate_id, name, room) values (eid, 'Musselmalet stel', 'Køkken') returning id into i2;
  insert into items (estate_id, name, room, will_heir_id) values (eid, 'Guldring', 'Smykker', hc) returning id into i3;
  select no into n from items where id = i2;
  insert into t (name, ok) values ('ting får faste numre fra serveren', n = 2);
  begin
    insert into items (estate_id, name, room, no) values (eid, 'Snyd', 'Stue', 99);
    insert into t (name, ok) values ('klienten kan IKKE selv sætte nummer', false);
  exception when others then insert into t (name, ok) values ('klienten kan IKKE selv sætte nummer', true); end;

  -- 3. Fremmed bruger ser intet
  perform pg_temp.as_user(ux);
  select count(*) into n from estates; insert into t (name, ok) values ('fremmed ser ingen boer', n = 0);
  select count(*) into n from items; insert into t (name, ok) values ('fremmed ser ingen ting', n = 0);
  select count(*) into n from heirs; insert into t (name, ok) values ('fremmed ser ingen arvinger', n = 0);
  begin
    insert into items (estate_id, name) values (eid, 'Indbrud');
    insert into t (name, ok) values ('fremmed kan IKKE tilføje ting', false);
  exception when others then insert into t (name, ok) values ('fremmed kan IKKE tilføje ting', true); end;

  -- 4. Arvingerne afgiver ønsker i hemmelighed
  perform pg_temp.as_user(ub);
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 70), jsonb_build_object('item_id', i2, 'points', 30)));
  insert into t (name, ok) values ('Lars kan gemme sine ønsker', (j ->> 'points_used')::int = 100);
  select count(*) into n from wishes; insert into t (name, ok) values ('Lars ser kun egne ønsker (2 rækker)', n = 2);
  begin
    j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i3, 'points', 10)));
    insert into t (name, ok) values ('point på testamenteret ting afvises', false);
  exception when others then insert into t (name, ok) values ('point på testamenteret ting afvises', true); end;
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 70), jsonb_build_object('item_id', i2, 'points', 30)));
  perform pg_temp.as_user(uc);
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 100)));
  select count(*) into n from wishes; insert into t (name, ok) values ('Anna ser kun egne ønsker (1 række), ikke Lars''', n = 1);
  select count(*) into n from wishes where heir_id = hb; insert into t (name, ok) values ('Anna kan IKKE læse Lars'' ønsker, selv med hans id', n = 0);
  update wishes set points = 1 where heir_id = hb; get diagnostics n = row_count;
  insert into t (name, ok) values ('Anna kan IKKE ændre Lars'' ønsker (0 rækker ramt)', n = 0);
  begin
    insert into wishes (estate_id, heir_id, item_id, points) values (eid, hb, i2, 5);
    insert into t (name, ok) values ('Anna kan IKKE indsætte ønsker for Lars', false);
  exception when others then insert into t (name, ok) values ('Anna kan IKKE indsætte ønsker for Lars', true); end;
  delete from wishes where heir_id = hb; get diagnostics n = row_count;
  insert into t (name, ok) values ('Anna kan IKKE slette Lars'' ønsker', n = 0);

  -- 5. Tovholderen kan ikke se nogens ønsker, kun hvem der har svaret
  perform pg_temp.as_user(ua);
  select count(*) into n from wishes; insert into t (name, ok) values ('tovholderen ser INGEN ønsker (egne er tomme)', n = 0);
  select count(*) into n from wishes where heir_id in (hb, hc); insert into t (name, ok) values ('tovholderen kan IKKE læse arvingernes ønsker', n = 0);
  select count(*) into n from heirs where estate_id = eid and submitted_at is not null; insert into t (name, ok) values ('tovholderen ser, at ingen har låst endnu', n = 0);
  begin
    update heirs set submitted_at = now() where id = hb;
    insert into t (name, ok) values ('tovholderen kan IKKE låse en arvings ønsker direkte', false);
  exception when others then insert into t (name, ok) values ('tovholderen kan IKKE låse en arvings ønsker direkte', true); end;
  begin
    j := proxy_set_wishes(eid, hb, '[]'::jsonb, false);
    insert into t (name, ok) values ('tovholderen kan IKKE afgive for en arving med eget link', false);
  exception when others then insert into t (name, ok) values ('tovholderen kan IKKE afgive for en arving med eget link', true); end;
  begin
    perform start_distribution(eid);
    insert into t (name, ok) values ('fordelingen kan IKKE startes, før alle har svaret', false);
  exception when others then insert into t (name, ok) values ('fordelingen kan IKKE startes, før alle har svaret', true); end;

  -- 6. Låsning
  perform pg_temp.as_user(ub);
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 60)));
  begin
    perform lock_wishes(eid);
    insert into t (name, ok) values ('60 point kan IKKE låses', false);
  exception when others then insert into t (name, ok) values ('60 point kan IKKE låses', true); end;
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 70), jsonb_build_object('item_id', i2, 'points', 30)));
  perform lock_wishes(eid);
  begin
    j := set_wishes(eid, '[]'::jsonb);
    insert into t (name, ok) values ('låste ønsker kan IKKE ændres', false);
  exception when others then insert into t (name, ok) values ('låste ønsker kan IKKE ændres', true); end;
  update wishes set points = 99 where heir_id = hb; get diagnostics n = row_count;
  insert into t (name, ok) values ('låste ønsker kan IKKE ændres direkte heller', n = 0);
  perform unlock_my_wishes(eid);
  insert into t (name, ok) values ('arvingen kan selv låse op, mens boet er åbent', (select submitted_at is null from heirs where id = hb));
  perform lock_wishes(eid);
  perform pg_temp.as_user(uc);
  perform lock_wishes(eid);
  perform pg_temp.as_user(ua);
  j := set_wishes(eid, '[]'::jsonb);
  perform lock_wishes(eid);
  insert into t (name, ok) values ('tovholderen kan sige "jeg ønsker ikke noget"', (select no_wish from heirs where id = ha));
  select count(*) into n from notifications where estate_id = eid and kind = 'alle_har_svaret';
  insert into t (name, ok) values ('besked til tovholderen, når alle har svaret', n >= 1);

  -- 7. Ting kan ikke ændres med point på, uden at arvingen må svare igen
  update items set deleted_at = now() where id = i2;
  insert into t (name, ok) values ('fjernes en ting med point, må Lars svare igen', (select submitted_at is null from heirs where id = hb));
  perform pg_temp.as_user(ub);
  j := set_wishes(eid, jsonb_build_array(jsonb_build_object('item_id', i1, 'points', 100)));
  perform lock_wishes(eid);

  -- 8. Fordeling: start låser boet, serveren gemmer resultatet, og kun serveren kan læse input
  perform pg_temp.as_user(ua);
  perform start_distribution(eid);
  insert into t (name, ok) values ('tovholderen kan starte fordelingen, når alle har svaret', estate_status_of(eid) = 'laast');
  begin
    insert into items (estate_id, name) values (eid, 'For sent');
    insert into t (name, ok) values ('tingene er låst under fordelingen', false);
  exception when others then insert into t (name, ok) values ('tingene er låst under fordelingen', true); end;
  begin
    insert into distribution_runs (estate_id, version, method, lod, input_hash, result, ef1_ok) values (eid, 1, 'point', 1, 'x', '{}', true);
    insert into t (name, ok) values ('klienten kan IKKE skrive et resultat selv', false);
  exception when others then insert into t (name, ok) values ('klienten kan IKKE skrive et resultat selv', true); end;
  perform pg_temp.as_server();
  insert into distribution_runs (estate_id, version, method, lod, input_hash, result, ef1_ok, released_at)
    values (eid, 1, 'point', lod0, 'hash', jsonb_build_object('out', jsonb_build_object(hb::text, jsonb_build_array(i1))), true, now()) returning id into run;
  insert into distribution_inputs (run_id, input) values (run, jsonb_build_object('hemmeligt', true));
  insert into distribution_explanations (run_id, heir_id, data) values (run, hb, '{"til":"Lars"}'), (run, hc, '{"til":"Anna"}'), (run, ha, '{"til":"Mette"}');
  update estates set status = 'fordelt' where id = eid;
  perform pg_temp.as_user(uc);
  select count(*) into n from distribution_runs where estate_id = eid; insert into t (name, ok) values ('arvingerne kan læse den frigivne fordeling', n = 1);
  select count(*) into n from distribution_inputs; insert into t (name, ok) values ('INGEN kan læse hele inputtet (alle ønsker)', n = 0);
  select count(*) into n from distribution_explanations where run_id = run; insert into t (name, ok) values ('Anna ser kun sin egen forklaring', n = 1 and (select data ->> 'til' from distribution_explanations where run_id = run) = 'Anna');
  perform pg_temp.as_user(ua);
  select count(*) into n from distribution_explanations where heir_id = hb; insert into t (name, ok) values ('tovholderen kan IKKE læse Lars'' forklaring', n = 0);
  select count(*) into n from audit_events where estate_id = eid; insert into t (name, ok) values ('tovholderen kan læse auditloggen', n > 10);
  select count(*) into n from audit_events where estate_id = eid and meta::text like '%points%'; insert into t (name, ok) values ('auditloggen indeholder aldrig point', n = 0);
  perform pg_temp.as_user(ub);
  select count(*) into n from audit_events; insert into t (name, ok) values ('arvingen kan IKKE læse auditloggen', n = 0);

  -- 9. Underskrift kræver frisk engangskode
  perform pg_temp.as_user(ub);
  begin
    perform sign_run(run, 'Lars', 'abc');
    insert into t (name, ok) values ('underskrift uden engangskode afvises', false);
  exception when others then insert into t (name, ok) values ('underskrift uden engangskode afvises', true); end;
  perform pg_temp.as_server();
  insert into consent_records (estate_id, heir_id, user_id, kind, run_id, channel) values (eid, hb, ub, 'underskrift_otp', run, 'sms');
  perform pg_temp.as_user(ub);
  perform sign_run(run, 'Lars Jensen', 'abc');
  select count(*) into n from signatures where run_id = run and heir_id = hb; insert into t (name, ok) values ('underskrift med engangskode gemmes', n = 1);
  begin
    perform sign_run(run, 'Lars', 'abc');
    insert into t (name, ok) values ('engangskoden kan IKKE bruges to gange', false);
  exception when others then insert into t (name, ok) values ('engangskoden kan IKKE bruges to gange', true); end;
  begin
    insert into signatures (run_id, estate_id, heir_id, signed_name, method, document_hash) values (run, eid, hc, 'Anna', 'otp_sms', 'x');
    insert into t (name, ok) values ('man kan IKKE skrive under for andre direkte', false);
  exception when others then insert into t (name, ok) values ('man kan IKKE skrive under for andre direkte', true); end;

  -- 10. Ny runde kræver alles ja
  perform pg_temp.as_user(ua);
  perform request_reopen(eid, 'Vi har fundet et maleri mere');
  insert into t (name, ok) values ('ny runde åbner IKKE boet, før alle har sagt ja', estate_status_of(eid) = 'fordelt');
  perform pg_temp.as_user(ub);
  select count(*) into n from consent_records where estate_id = eid and kind = 'ny_runde'; insert into t (name, ok) values ('en arving kan se, at tovholderen har bedt om ny runde', n = 1);
  select count(*) into n from consent_records where estate_id = eid and kind <> 'ny_runde' and heir_id <> hb and user_id <> ub; insert into t (name, ok) values ('en arving kan IKKE se andres øvrige samtykker', n = 0);
  perform consent_reopen(eid);
  perform pg_temp.as_user(uc); perform consent_reopen(eid);
  insert into t (name, ok) values ('boet åbnes igen, når alle har sagt ja', estate_status_of(eid) = 'aaben' and (select superseded_at is not null from distribution_runs where id = run));

  -- 11. Sletning: slet nu og automatisk
  perform pg_temp.as_user(ub);
  begin
    perform delete_estate_now(eid);
    insert into t (name, ok) values ('en arving kan IKKE slette boet', false);
  exception when others then insert into t (name, ok) values ('en arving kan IKKE slette boet', true); end;
  perform pg_temp.as_user(ua);
  perform delete_estate_now(eid);
  perform pg_temp.as_server();
  select count(*) into n from estates where id = eid; insert into t (name, ok) values ('tovholderen kan slette boet nu', n = 0);
  select count(*) into n from wishes where estate_id = eid; insert into t (name, ok) values ('ønskerne er væk med boet', n = 0);

  -- oprydning
  delete from auth.users where id in (ua, ub, uc, ux);
end $$;

select case when ok then 'PASS ' else 'FAIL ' end || name as linje from t order by n;
