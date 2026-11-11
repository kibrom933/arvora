-- pgcrypto ligger i schema extensions på Supabase; draw_lod skal pege derhen.
create or replace function draw_lod() returns bigint language sql volatile set search_path = public, extensions as $$
  select greatest(1, ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
$$;
