-- Tovholderen, der selv er arving, får sin mail/telefon fra login på sin arvingrække, så koder og beskeder kan nå hende.
-- Beskeder til tovholderen falder tilbage på login-adressen, hvis arvingrækken ingen har.
create or replace function create_estate(p_name text, p_years text default null, p_mode estate_mode default 'doed',
  p_method wish_method default 'point', p_deadline date default null, p_partner_code text default null,
  p_me_as_heir boolean default true, p_my_name text default null, p_my_relation text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare eid uuid; hid uuid; pid uuid; uid uuid := auth.uid(); em text; ph text;
begin
  if uid is null then raise exception 'Ikke logget ind' using errcode = '42501'; end if;
  select nullif(email, ''), case when coalesce(phone, '') = '' then null when phone like '+%' then phone else '+' || phone end into em, ph from auth.users where id = uid;
  insert into estates (name, years, mode, method, deadline, created_by) values (p_name, p_years, p_mode, p_method, p_deadline, uid) returning id into eid;
  if p_me_as_heir then
    insert into heirs (estate_id, name, relation, user_id, sort, email, phone)
      values (eid, coalesce(nullif(p_my_name, ''), 'Tovholder'), p_my_relation, uid, 0, em, ph) returning id into hid;
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

create or replace function enqueue_notification(p_estate uuid, p_heir uuid, p_kind text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare h heirs; addr text; ch invite_channel; tov uuid; uem text; uph text;
begin
  if p_heir is null then
    select user_id into tov from estate_members where estate_id = p_estate and role = 'tovholder' limit 1;
    select * into h from heirs where estate_id = p_estate and user_id = tov;
  else
    select * into h from heirs where id = p_heir;
    tov := h.user_id;
  end if;
  if h.id is not null then
    if h.email is not null then addr := h.email; ch := 'email'; elsif h.phone is not null then addr := h.phone; ch := 'sms'; end if;
  end if;
  if addr is null and tov is not null then
    select nullif(email, ''), nullif(phone, '') into uem, uph from auth.users where id = tov;
    if uem is not null then addr := uem; ch := 'email'; elsif uph is not null then addr := case when uph like '+%' then uph else '+' || uph end; ch := 'sms'; end if;
  end if;
  if addr is null then return; end if;
  insert into notifications (estate_id, heir_id, channel, kind, to_address, payload) values (p_estate, h.id, ch, p_kind, addr, p_payload);
end $$;
revoke all on function enqueue_notification(uuid, uuid, text, jsonb) from public, authenticated, anon;

-- Eksisterende boer: tovholder-arvinger uden kontakt får login-adressen.
update heirs x set email = u.email from auth.users u
  where x.user_id = u.id and x.email is null and x.phone is null and coalesce(u.email, '') <> '';
