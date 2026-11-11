-- Kalder serverfunktionen housekeeping hvert kvarter. URL og nøgle ligger i Vault (ejeren lægger dem ind, se owner-action-list.md):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/housekeeping', 'housekeeping_url');
--   select vault.create_secret('<HOUSEKEEPING_SECRET>', 'housekeeping_key');
create extension if not exists pg_net;
create or replace function call_housekeeping() returns void language plpgsql security definer set search_path = public, extensions, vault, net as $$
declare u text; k text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'housekeeping_url';
  select decrypted_secret into k from vault.decrypted_secrets where name = 'housekeeping_key';
  if u is null or k is null then return; end if;
  perform net.http_post(url := u, headers := jsonb_build_object('Content-Type', 'application/json', 'x-housekeeping-key', k), body := '{}'::jsonb, timeout_milliseconds := 20000);
end $$;
revoke all on function call_housekeeping() from public, authenticated, anon;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'arvora-housekeeping';
  perform cron.schedule('arvora-housekeeping', '*/15 * * * *', 'select public.call_housekeeping()');
exception when others then raise notice 'cron ikke sat op: %', sqlerrm;
end $$;
