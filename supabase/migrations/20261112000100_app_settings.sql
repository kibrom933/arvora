-- Indstillinger og nøgler, serveren skal bruge, når de ikke er sat som Edge Function secrets: app-adresse, mail-afsender,
-- nøgle til housekeeping, udbydernøgler. Kun serveren (service role) kan læse og skrive. Edge secrets har forrang.
create table if not exists app_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value text not null check (length(value) <= 4000),
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
revoke all on app_settings from public, anon, authenticated;
grant all on app_settings to service_role;

-- Housekeeping-kaldet læser nu adresse og nøgle fra app_settings først, derefter Vault.
create or replace function call_housekeeping() returns void language plpgsql security definer set search_path = public, extensions, vault, net as $$
declare u text; k text;
begin
  select value into u from app_settings where key = 'housekeeping_url';
  select value into k from app_settings where key = 'housekeeping_key';
  if u is null then select decrypted_secret into u from vault.decrypted_secrets where name = 'housekeeping_url'; end if;
  if k is null then select decrypted_secret into k from vault.decrypted_secrets where name = 'housekeeping_key'; end if;
  if u is null or k is null then return; end if;
  perform net.http_post(url := u, headers := jsonb_build_object('Content-Type', 'application/json', 'x-housekeeping-key', k), body := '{}'::jsonb, timeout_milliseconds := 20000);
end $$;
revoke all on function call_housekeeping() from public, authenticated, anon;
