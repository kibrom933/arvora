-- Arvora: handlinger, der kræver mere end en række (RPC'er). Alle kører som security definer og tjekker selv
-- rettigheder med auth.uid(). Fejl kastes med errcode 42501 (ingen adgang) eller 22023 (ugyldigt input), så
-- klienten kan vise en rolig besked.

-- Ting får deres nummer én gang for alle (beslutninger.md 2026-11-09). Klienter må ikke sætte det selv.
create or replace function items_assign_no() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from estates where id = new.estate_id for update;
  if new.no is null then
    select coalesce(max(no), 0) + 1 into new.no from items where estate_id = new.estate_id;
  end if;
  return new;
end $$;
create trigger items_no before insert on items for each row execute function items_assign_no();

-- Opret bo. Den, der opretter, bliver tovholder og (som regel) selv arving.
create or replace function create_estate(p_name text, p_years text default null, p_mode estate_mode default 'doed',
  p_method wish_method default 'point', p_deadline date default null, p_partner_code text default null,
  p_me_as_heir boolean default true, p_my_name text default null, p_my_relation text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid; hid uuid; pid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Ikke logget ind' using errcode = '42501'; end if;
  insert into estates (name, years, mode, method, deadline, created_by) values (p_name, p_years, p_mode, p_method, p_deadline, uid) returning id into eid;
  if p_me_as_heir then
    insert into heirs (estate_id, name, relation, user_id, sort) values (eid, coalesce(nullif(p_my_name, ''), 'Tovholder'), p_my_relation, uid, 0) returning id into hid;
  end if;
  insert into estate_members (estate_id, user_id, role, heir_id) values (eid, uid, 'tovholder', hid);
  if p_partner_code is not null then
    select id into pid from partners where code = upper(p_partner_code) and active;
    if pid is null then raise exception 'Partnerkoden findes ikke' using errcode = '22023'; end if;
    insert into partner_referrals (partner_id, estate_id, code) values (pid, eid, upper(p_partner_code));
    insert into payments (estate_id, amount_ore, status) values (eid, 0, 'partner');
    update estates set paid_at = now(), status = 'aaben' where id = eid;
  end if;
  return eid;
end $$;

-- Boet åbnes for ønsker, når det er betalt (Stripe-webhook sætter paid_at via service role) eller partnerbetalt.
create or replace function open_estate(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare e estates;
begin
  select * into e from estates where id = p_estate;
  if e.id is null or not is_tovholder(p_estate) then raise exception 'Ingen adgang' using errcode = '42501'; end if;
  if e.status <> 'kladde' then raise exception 'Boet er allerede åbnet' using errcode = '22023'; end if;
  if e.paid_at is null then raise exception 'Boet er ikke betalt endnu' using errcode = '22023'; end if;
  if (select count(*) from heirs where estate_id = p_estate) < 2 then raise exception 'Der skal være mindst to arvinger' using errcode = '22023'; end if;
  update estates set status = 'aaben' where id = p_estate;
end $$;

-- Arvingens egne ønsker gemmes samlet: [{item_id, points}] eller [{item_id, bid}]. Ting, der ikke er med, nulstilles.
create or replace function set_wishes(p_estate uuid, p_wishes jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare hid uuid; w jsonb; used int; st estate_status; m wish_method;
begin
  hid := my_heir_id(p_estate);
  if hid is null or not can_edit_wishes(hid) then raise exception 'Ønskerne kan ikke ændres nu' using errcode = '42501'; end if;
  select status, method into st, m from estates where id = p_estate;
  if jsonb_typeof(p_wishes) <> 'array' then raise exception 'Forkert format' using errcode = '22023'; end if;
  delete from wishes where heir_id = hid;
  for w in select * from jsonb_array_elements(p_wishes) loop
    if not exists (select 1 from items where id = (w ->> 'item_id')::uuid and estate_id = p_estate and deleted_at is null and will_heir_id is null) then
      raise exception 'Tingen findes ikke eller er testamenteret' using errcode = '22023';
    end if;
    insert into wishes (estate_id, heir_id, item_id, points, bid)
      values (p_estate, hid, (w ->> 'item_id')::uuid, coalesce((w ->> 'points')::int, 0), coalesce((w ->> 'bid')::bigint, 0));
  end loop;
  select coalesce(sum(points), 0) into used from wishes where heir_id = hid;
  return jsonb_build_object('points_used', used, 'count', (select count(*) from wishes where heir_id = hid));
end $$;

-- Lås ønskerne ("Afgiv"). Point skal være præcis 100 eller 0 ("Jeg ønsker ikke noget").
create or replace function lock_wishes(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare hid uuid; used int; m wish_method; nbids int; all_in boolean;
begin
  hid := my_heir_id(p_estate);
  if hid is null or not can_edit_wishes(hid) then raise exception 'Kan ikke låse nu' using errcode = '42501'; end if;
  select method into m from estates where id = p_estate;
  select coalesce(sum(points), 0), count(*) filter (where bid > 0) into used, nbids from wishes where heir_id = hid;
  if m = 'point' and used not in (0, 100) then raise exception 'Du skal bruge alle 100 point, eller ingen' using errcode = '22023'; end if;
  update heirs set submitted_at = now(), no_wish = (case when m = 'point' then used = 0 else nbids = 0 end) where id = hid;
  select bool_and(submitted_at is not null) into all_in from heirs where estate_id = p_estate;
  if all_in then perform enqueue_notification(p_estate, null, 'alle_har_svaret', '{}'::jsonb); end if;
end $$;

-- Lås op igen, så længe boet stadig er åbent (ingen fordeling startet).
create or replace function unlock_my_wishes(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  hid := my_heir_id(p_estate);
  if hid is null or estate_status_of(p_estate) <> 'aaben' then raise exception 'Kan ikke låse op nu' using errcode = '42501'; end if;
  update heirs set submitted_at = null where id = hid and user_id = auth.uid();
end $$;

-- Samtykker: vilkår og privatliv (egne), og tovholderens registrering af, at en arving uden smartphone har givet lov.
create or replace function record_consent(p_estate uuid, p_kind text, p_heir uuid default null, p_channel text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not is_member(p_estate) then raise exception 'Ingen adgang' using errcode = '42501'; end if;
  if p_kind in ('vilkaar', 'privatliv') then
    insert into consent_records (estate_id, heir_id, user_id, kind, channel) values (p_estate, my_heir_id(p_estate), auth.uid(), p_kind, p_channel) returning id into cid;
  elsif p_kind = 'proxy_oensker' then
    if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
    if not exists (select 1 from heirs where id = p_heir and estate_id = p_estate and user_id is null) then raise exception 'Arvingen har sit eget link' using errcode = '22023'; end if;
    if p_channel is null or p_note is null then raise exception 'Skriv hvordan og hvornår arvingen gav lov' using errcode = '22023'; end if;
    insert into consent_records (estate_id, heir_id, user_id, kind, channel, note) values (p_estate, p_heir, auth.uid(), p_kind, p_channel, p_note) returning id into cid;
    update heirs set proxy_by = auth.uid(), proxy_consent_id = cid where id = p_heir;
  else
    raise exception 'Ukendt samtykke' using errcode = '22023';
  end if;
  return cid;
end $$;

-- Tovholderen afgiver ønsker for en arving uden smartphone. Kræver registreret samtykke. Alt logges med tovholderen som aktør.
create or replace function proxy_set_wishes(p_estate uuid, p_heir uuid, p_wishes jsonb, p_lock boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare h heirs; w jsonb; used int; m wish_method; nbids int; all_in boolean;
begin
  select * into h from heirs where id = p_heir and estate_id = p_estate;
  if h.id is null or not is_tovholder(p_estate) then raise exception 'Ingen adgang' using errcode = '42501'; end if;
  if h.user_id is not null or h.proxy_consent_id is null then raise exception 'Arvingen afgiver selv sine ønsker, eller samtykke mangler' using errcode = '42501'; end if;
  if h.submitted_at is not null or estate_status_of(p_estate) <> 'aaben' then raise exception 'Ønskerne er låst' using errcode = '42501'; end if;
  select method into m from estates where id = p_estate;
  delete from wishes where heir_id = p_heir;
  for w in select * from jsonb_array_elements(p_wishes) loop
    if not exists (select 1 from items where id = (w ->> 'item_id')::uuid and estate_id = p_estate and deleted_at is null and will_heir_id is null) then
      raise exception 'Tingen findes ikke eller er testamenteret' using errcode = '22023';
    end if;
    insert into wishes (estate_id, heir_id, item_id, points, bid) values (p_estate, p_heir, (w ->> 'item_id')::uuid, coalesce((w ->> 'points')::int, 0), coalesce((w ->> 'bid')::bigint, 0));
  end loop;
  select coalesce(sum(points), 0), count(*) filter (where bid > 0) into used, nbids from wishes where heir_id = p_heir;
  if p_lock then
    if m = 'point' and used not in (0, 100) then raise exception 'Der skal bruges alle 100 point, eller ingen' using errcode = '22023'; end if;
    update heirs set submitted_at = now(), no_wish = (case when m = 'point' then used = 0 else nbids = 0 end), proxy_by = auth.uid() where id = p_heir;
    select bool_and(submitted_at is not null) into all_in from heirs where estate_id = p_estate;
    if all_in then perform enqueue_notification(p_estate, null, 'alle_har_svaret', '{}'::jsonb); end if;
  end if;
  return jsonb_build_object('points_used', used);
end $$;

-- Start fordelingen: alle har svaret, boet låses, og serverfunktionen run-distribution regner.
create or replace function start_distribution(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare missing int;
begin
  if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
  if estate_status_of(p_estate) <> 'aaben' then raise exception 'Boet er ikke åbent for fordeling' using errcode = '22023'; end if;
  select count(*) into missing from heirs where estate_id = p_estate and submitted_at is null;
  if missing > 0 then raise exception '% har ikke afgivet ønsker endnu', missing using errcode = '22023'; end if;
  if (select count(*) from items where estate_id = p_estate and deleted_at is null) = 0 then raise exception 'Der er ingen ting' using errcode = '22023'; end if;
  update estates set status = 'laast' where id = p_estate;
end $$;

-- Serveren kalder denne, hvis beregningen fejler, så boet ikke hænger i "laast".
create or replace function abort_distribution(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update estates set status = 'aaben' where id = p_estate and status = 'laast';
end $$;

-- Underskrift. Kræver et frisk engangskode-samtykke (underskrift_otp, under 10 minutter gammelt), som serverfunktionen
-- sign opretter, når koden fra SMS/mail er bekræftet. Navn og dokument-hash gemmes; underskriften bindes til run-versionen.
create or replace function sign_run(p_run uuid, p_signed_name text, p_document_hash text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r distribution_runs; hid uuid; otp consent_records; all_signed boolean; meth text;
begin
  select * into r from distribution_runs where id = p_run;
  if r.id is null or r.released_at is null or r.superseded_at is not null then raise exception 'Fordelingen kan ikke underskrives' using errcode = '22023'; end if;
  hid := my_heir_id(r.estate_id);
  if hid is null then raise exception 'Du er ikke arving i boet' using errcode = '42501'; end if;
  select * into otp from consent_records where estate_id = r.estate_id and heir_id = hid and kind = 'underskrift_otp' and run_id = p_run
    and given_at > now() - interval '10 minutes' order by given_at desc limit 1;
  if otp.id is null then raise exception 'Bekræft først med koden fra SMS eller mail' using errcode = '42501'; end if;
  meth := case when otp.channel = 'email' then 'otp_email' else 'otp_sms' end;
  insert into signatures (run_id, estate_id, heir_id, signed_name, method, document_hash, user_agent)
    values (p_run, r.estate_id, hid, coalesce(nullif(trim(p_signed_name), ''), (select name from heirs where id = hid)), meth, p_document_hash, left(p_user_agent, 300));
  delete from consent_records where id = otp.id;
  select bool_and(exists (select 1 from signatures s where s.run_id = p_run and s.heir_id = h.id)) into all_signed from heirs h where h.estate_id = r.estate_id;
  if all_signed then
    update estates set status = 'underskrevet' where id = r.estate_id;
    perform enqueue_notification(r.estate_id, null, 'alle_har_underskrevet', jsonb_build_object('run_id', p_run));
  end if;
end $$;

-- Ny runde (model B, se beslutninger.md 2026-11-11): tovholderen beder om det, alle arvinger siger ja, så åbnes boet igen.
create or replace function request_reopen(p_estate uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare r distribution_runs;
begin
  if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
  if estate_status_of(p_estate) not in ('fordelt', 'underskrevet') then raise exception 'Der er ingen fordeling at åbne' using errcode = '22023'; end if;
  select * into r from distribution_runs where estate_id = p_estate and superseded_at is null order by version desc limit 1;
  insert into consent_records (estate_id, heir_id, user_id, kind, run_id, note) values (p_estate, my_heir_id(p_estate), auth.uid(), 'ny_runde', r.id, left(p_reason, 1000));
  perform enqueue_notification(p_estate, h.id, 'ny_runde_spoergsmaal', jsonb_build_object('reason', left(p_reason, 300)))
    from heirs h where h.estate_id = p_estate and h.id is distinct from my_heir_id(p_estate);
  perform check_reopen(p_estate);
end $$;

create or replace function consent_reopen(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare r distribution_runs; hid uuid;
begin
  hid := my_heir_id(p_estate);
  if hid is null then raise exception 'Ingen adgang' using errcode = '42501'; end if;
  select * into r from distribution_runs where estate_id = p_estate and superseded_at is null order by version desc limit 1;
  if r.id is null or not exists (select 1 from consent_records where estate_id = p_estate and kind = 'ny_runde' and run_id = r.id) then
    raise exception 'Ingen har bedt om en ny runde' using errcode = '22023';
  end if;
  insert into consent_records (estate_id, heir_id, user_id, kind, run_id) values (p_estate, hid, auth.uid(), 'ny_runde', r.id);
  perform check_reopen(p_estate);
end $$;

create or replace function check_reopen(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
declare r distribution_runs; everyone boolean;
begin
  select * into r from distribution_runs where estate_id = p_estate and superseded_at is null order by version desc limit 1;
  if r.id is null then return; end if;
  select bool_and(exists (select 1 from consent_records c where c.estate_id = p_estate and c.kind = 'ny_runde' and c.run_id = r.id and c.heir_id = h.id))
    into everyone from heirs h where h.estate_id = p_estate;
  if everyone then
    update distribution_runs set superseded_at = now() where id = r.id;
    update heirs set submitted_at = null where estate_id = p_estate;
    update estates set status = 'aaben' where id = p_estate;
    perform enqueue_notification(p_estate, h.id, 'ny_runde_aabnet', '{}'::jsonb) from heirs h where h.estate_id = p_estate;
  end if;
end $$;

-- Afslut boet: alle har skrevet under. Herefter tæller sletningsfristen.
create or replace function close_estate(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
  if estate_status_of(p_estate) <> 'underskrevet' then raise exception 'Alle skal have skrevet under først' using errcode = '22023'; end if;
  update estates set status = 'afsluttet', closed_at = now(), retention_until = now() + make_interval(days => retention_days) where id = p_estate;
end $$;

-- Slet nu. Billederne kommer i kø til sletning i storage (serverfunktionen cleanup tømmer køen).
create table purge_queue (
  id bigint generated always as identity primary key,
  estate_id uuid not null,
  paths text[] not null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table purge_queue enable row level security;
revoke all on purge_queue from authenticated, anon;

create or replace function queue_estate_files() returns trigger language plpgsql security definer set search_path = public as $$
declare ps text[];
begin
  select coalesce(array_agg(path), '{}') into ps from item_images where estate_id = old.id;
  if array_length(ps, 1) > 0 then insert into purge_queue (estate_id, paths) values (old.id, ps); end if;
  return old;
end $$;
create trigger estates_purge_files before delete on estates for each row execute function queue_estate_files();

create or replace function delete_estate_now(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
  insert into audit_events (estate_id, actor, action, table_name, meta) values (p_estate, auth.uid(), 'slet_nu', 'estates', '{}');
  delete from estates where id = p_estate;
end $$;

-- Automatisk sletning: kaldes dagligt af pg_cron (se 20261111000400_storage_cron.sql).
create or replace function purge_expired_estates() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (delete from estates where retention_until is not null and retention_until < now() returning id)
  select count(*) into n from gone;
  return n;
end $$;
revoke all on function purge_expired_estates() from public, authenticated, anon;

-- Beskeder i kø. Serverfunktionen notify sender dem (SMS/mail) og sætter status.
create or replace function enqueue_notification(p_estate uuid, p_heir uuid, p_kind text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare h heirs; addr text; ch invite_channel; tov uuid;
begin
  if p_heir is null then
    -- til tovholderen
    select user_id into tov from estate_members where estate_id = p_estate and role = 'tovholder' limit 1;
    select * into h from heirs where estate_id = p_estate and user_id = tov;
    if h.id is null then
      select email into addr from auth.users where id = tov; ch := 'email';
    end if;
  else
    select * into h from heirs where id = p_heir;
  end if;
  if h.id is not null then
    if h.phone is not null then addr := h.phone; ch := 'sms'; elsif h.email is not null then addr := h.email; ch := 'email'; end if;
  end if;
  if addr is null then return; end if;
  insert into notifications (estate_id, heir_id, channel, kind, to_address, payload) values (p_estate, h.id, ch, p_kind, addr, p_payload);
end $$;
revoke all on function enqueue_notification(uuid, uuid, text, jsonb) from public, authenticated, anon;

-- Rate limiting for serverfunktioner: true, hvis kaldet må ske.
create or replace function rate_limit(p_key text, p_max int, p_window interval) returns boolean language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits (key) values (p_key) on conflict (key) do nothing;
  select * into r from rate_limits where key = p_key for update;
  if r.window_start < now() - p_window then update rate_limits set window_start = now(), count = 1 where key = p_key; return true; end if;
  if r.count >= p_max then return false; end if;
  update rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;
revoke all on function rate_limit(text, int, interval) from public, authenticated, anon;
revoke all on function abort_distribution(uuid) from public, authenticated, anon;
revoke all on function check_reopen(uuid) from public, authenticated, anon;

-- Ikke-indloggede kan ikke kalde noget som helst.
revoke execute on all functions in schema public from anon;

-- Overblik til tovholderen uden hemmeligheder: hvem har svaret.
create or replace view estate_overview with (security_invoker = true) as
  select e.id, e.name, e.status, e.method, e.mode, e.deadline, e.paid_at, e.closed_at, e.retention_until,
    (select count(*) from heirs h where h.estate_id = e.id) as heirs,
    (select count(*) from heirs h where h.estate_id = e.id and h.submitted_at is not null) as submitted,
    (select count(*) from items i where i.estate_id = e.id and i.deleted_at is null) as items,
    (select count(*) from signatures s join distribution_runs r on r.id = s.run_id where r.estate_id = e.id and r.superseded_at is null) as signed
  from estates e;
grant select on estate_overview to authenticated;
