-- Hærdning efter Supabase' sikkerhedslinter: ingen funktion kan kaldes uden login, kun de tilsigtede af
-- indloggede, fast search_path overalt, og udvidelser ud af public.
revoke execute on all functions in schema public from public, anon;
-- Det, klienter må kalde (RPC'er og hjælpere, som policies bruger)
grant execute on function create_estate(text, text, estate_mode, wish_method, date, text, boolean, text, text), open_estate(uuid),
  set_wishes(uuid, jsonb), lock_wishes(uuid), unlock_my_wishes(uuid), record_consent(uuid, text, uuid, text, text),
  proxy_set_wishes(uuid, uuid, jsonb, boolean), start_distribution(uuid), sign_run(uuid, text, text, text),
  request_reopen(uuid, text), consent_reopen(uuid), close_estate(uuid), delete_estate_now(uuid),
  is_member(uuid), is_tovholder(uuid), my_heir_id(uuid), estate_status_of(uuid), run_released(uuid), can_edit_wishes(uuid),
  is_partner_member(uuid), try_uuid(text), is_server()
  to authenticated;
-- Kun serveren: abort_distribution, check_reopen, enqueue_notification, rate_limit, purge_expired_estates, call_housekeeping, draw_lod,
-- og triggerfunktionerne (audit_row, items_guard, items_assign_no, queue_estate_files, set_updated_at, protect_*).
grant execute on all functions in schema public to service_role;

create or replace function try_uuid(t text) returns uuid language plpgsql immutable set search_path = public as $$
begin return t::uuid; exception when others then return null; end $$;
create or replace function is_server() returns boolean language sql stable set search_path = public as $$
  select current_user not in ('anon', 'authenticated')
$$;
alter function set_updated_at() set search_path = public;
alter function protect_estate_columns() set search_path = public;
alter function protect_heir_columns() set search_path = public;

alter extension citext set schema extensions;
do $$
begin
  drop extension if exists pg_net;
  create extension pg_net with schema extensions;
exception when others then raise notice 'pg_net: %', sqlerrm;
end $$;

-- Triggerfunktioner skal ikke kunne kaldes som RPC af indloggede (de kører alligevel, når triggeren affyres).
revoke execute on function audit_row(), items_guard(), items_assign_no(), queue_estate_files(), set_updated_at(), protect_estate_columns(), protect_heir_columns() from authenticated;
