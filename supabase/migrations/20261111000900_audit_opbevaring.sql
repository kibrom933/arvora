-- Auditloggen efter sletning af et bo: navne og aktør fjernes med det samme, og rækkerne slettes efter 12 måneder.
-- Det, der bliver tilbage i mellemtiden, kan kun svare på "blev boet slettet, og hvornår".

create or replace function anonymise_audit(e uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update audit_events set actor = null, meta = '{}' where estate_id = e;
  insert into audit_events (estate_id, action, table_name) values (e, 'slettet', 'estates');
end $$;
revoke all on function anonymise_audit(uuid) from public, authenticated, anon;

create or replace function delete_estate_now(p_estate uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_tovholder(p_estate) then raise exception 'Kun tovholderen' using errcode = '42501'; end if;
  insert into audit_events (estate_id, actor, action, table_name, meta) values (p_estate, auth.uid(), 'slet_nu', 'estates', '{}');
  delete from estates where id = p_estate;
  perform anonymise_audit(p_estate);
end $$;

create or replace function purge_expired_estates() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; e uuid;
begin
  for e in select id from estates where retention_until is not null and retention_until < now() loop
    delete from estates where id = e;
    perform anonymise_audit(e);
    n := n + 1;
  end loop;
  -- Gamle auditrækker uden bo
  delete from audit_events a where a.created_at < now() - interval '12 months'
    and (a.estate_id is null or not exists (select 1 from estates x where x.id = a.estate_id));
  -- Gamle rate limit-tællere
  delete from rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;
revoke all on function purge_expired_estates() from public, authenticated, anon;
