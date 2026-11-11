-- Arvora: billeder i privat bucket, og daglige jobs.
create or replace function try_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ting', 'ting', false, 8000000, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = 8000000, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Sti: <estate_id>/<item_id>/<filnavn>. Medlemmer af boet kan se, tovholderen kan lægge op og slette, mens boet er åbent.
create policy ting_read on storage.objects for select to authenticated
  using (bucket_id = 'ting' and is_member(try_uuid((storage.foldername(name))[1])));
create policy ting_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ting' and is_tovholder(try_uuid((storage.foldername(name))[1]))
    and estate_status_of(try_uuid((storage.foldername(name))[1])) in ('kladde', 'aaben'));
create policy ting_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ting' and is_tovholder(try_uuid((storage.foldername(name))[1]))
    and estate_status_of(try_uuid((storage.foldername(name))[1])) in ('kladde', 'aaben'));

-- Daglig sletning af boer, hvis frist er udløbet. pg_cron findes på Supabase; slås til her, hvis det er muligt.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'arvora-purge';
  perform cron.schedule('arvora-purge', '15 3 * * *', 'select public.purge_expired_estates()');
exception when others then
  raise notice 'pg_cron ikke sat op: %', sqlerrm;
end $$;
