-- Arvora: datamodel. Se docs/database-schema.md.
-- Alt i schema public. Alle tabeller har RLS (slås til i 20261111000200_rls.sql).
create extension if not exists pgcrypto;
create extension if not exists citext;

create type estate_status as enum ('kladde', 'aaben', 'laast', 'fordelt', 'underskrevet', 'afsluttet', 'slettet');
create type estate_mode as enum ('doed', 'live');
create type wish_method as enum ('point', 'kroner');
create type member_role as enum ('tovholder', 'arving');
create type invite_channel as enum ('sms', 'email', 'papir');
create type notify_status as enum ('koe', 'sendt', 'fejl', 'fravalgt');

-- Loddet: 32 bit fra pgcrypto, aldrig 0. Trækkes én gang pr. bo og kan ikke ændres (trigger nedenfor).
create or replace function draw_lod() returns bigint language sql volatile set search_path = public, extensions as $$
  select greatest(1, ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
$$;

create table estates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  years text check (years is null or length(years) <= 40),
  mode estate_mode not null default 'doed',
  method wish_method not null default 'point',
  status estate_status not null default 'kladde',
  deadline date,
  lod bigint not null default draw_lod() check (lod between 1 and 4294967295),
  created_by uuid not null references auth.users (id) on delete restrict,
  paid_at timestamptz,
  retention_days int not null default 90 check (retention_days between 30 and 730),
  retention_until timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table estate_members (
  estate_id uuid not null references estates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null,
  heir_id uuid,
  created_at timestamptz not null default now(),
  primary key (estate_id, user_id)
);

create table heirs (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  relation text check (relation is null or length(relation) <= 60),
  phone citext check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email citext check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  share numeric(5, 2) not null default 1 check (share > 0 and share <= 10),
  sort int not null default 0,
  user_id uuid references auth.users (id) on delete set null,
  submitted_at timestamptz,
  no_wish boolean not null default false,
  proxy_by uuid references auth.users (id),
  proxy_consent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estate_id, user_id)
);
alter table estate_members add constraint estate_members_heir_fk foreign key (heir_id) references heirs (id) on delete set null;
create index heirs_estate on heirs (estate_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  heir_id uuid not null references heirs (id) on delete cascade,
  token_hash text not null unique,
  channel invite_channel not null,
  sent_to text,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  attempts int not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index invitations_heir on invitations (heir_id);

create table items (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  no int not null check (no > 0),
  name text not null check (length(name) between 1 and 120),
  room text not null default 'Andet' check (length(room) <= 40),
  kind text not null default 'thing' check (length(kind) <= 20),
  description text check (description is null or length(description) <= 1000),
  group_name text check (group_name is null or length(group_name) <= 80),
  valuable boolean not null default false,
  will_heir_id uuid references heirs (id) on delete set null,
  will_note text check (will_note is null or length(will_note) <= 500),
  will_unclear boolean not null default false,
  ai_suggested boolean not null default false,
  rest_decision text check (rest_decision is null or rest_decision in ('ny_runde', 'faelles', 'udenfor', 'salg', 'genbrug', 'rydning')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (estate_id, no)
);
create index items_estate on items (estate_id) where deleted_at is null;

create table item_images (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  path text not null unique,
  bytes int check (bytes is null or bytes between 0 and 20000000),
  created_at timestamptz not null default now()
);
create index item_images_item on item_images (item_id);

-- Ønsker: én række pr. (arving, ting). points bruges i pointmetoden, bid i kronemetoden.
create table wishes (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  heir_id uuid not null references heirs (id) on delete cascade,
  item_id uuid not null references items (id) on delete cascade,
  points int not null default 0 check (points between 0 and 100),
  bid bigint not null default 0 check (bid between 0 and 1000000000),
  updated_at timestamptz not null default now(),
  unique (heir_id, item_id)
);
create index wishes_heir on wishes (heir_id);

create table distribution_runs (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  version int not null,
  method wish_method not null,
  lod bigint not null,
  input_hash text not null,
  result jsonb not null,
  ef1_ok boolean not null,
  engine_version text not null default '1',
  released_at timestamptz,
  superseded_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (estate_id, version)
);

-- Hele input (alle ønsker) gemmes for efterprøvning, men kan kun læses af serveren.
create table distribution_inputs (
  run_id uuid primary key references distribution_runs (id) on delete cascade,
  input jsonb not null
);

-- Forklaringen pr. arving ("hvad gav du point, hvem fik det, hvor mange point gav de") kan kun læses af arvingen selv.
create table distribution_explanations (
  run_id uuid not null references distribution_runs (id) on delete cascade,
  heir_id uuid not null references heirs (id) on delete cascade,
  data jsonb not null,
  primary key (run_id, heir_id)
);

create table tie_break_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references distribution_runs (id) on delete cascade,
  estate_id uuid not null references estates (id) on delete cascade,
  kind text not null check (kind in ('item', 'swap', 'box')),
  item_ids uuid[] not null default '{}',
  heir_ids uuid[] not null,
  winner_heir_id uuid not null references heirs (id) on delete cascade,
  note text not null
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references distribution_runs (id) on delete cascade,
  estate_id uuid not null references estates (id) on delete cascade,
  heir_id uuid not null references heirs (id) on delete cascade,
  signed_name text not null check (length(signed_name) between 1 and 80),
  method text not null check (method in ('otp_sms', 'otp_email', 'papir')),
  document_hash text not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (run_id, heir_id)
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  heir_id uuid references heirs (id) on delete cascade,
  user_id uuid references auth.users (id),
  kind text not null check (kind in ('vilkaar', 'privatliv', 'proxy_oensker', 'proxy_bekraeftet', 'ny_runde', 'underskrift_otp')),
  run_id uuid references distribution_runs (id) on delete set null,
  channel text,
  note text check (note is null or length(note) <= 1000),
  given_at timestamptz not null default now()
);
create index consent_estate on consent_records (estate_id, kind);

create table audit_events (
  id bigint generated always as identity primary key,
  estate_id uuid,
  actor uuid,
  action text not null,
  table_name text,
  row_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_estate on audit_events (estate_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid references estates (id) on delete cascade,
  heir_id uuid references heirs (id) on delete cascade,
  channel invite_channel not null,
  kind text not null,
  to_address text not null,
  payload jsonb not null default '{}',
  status notify_status not null default 'koe',
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index notifications_queue on notifications (status, scheduled_for) where status = 'koe';

create table payments (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates (id) on delete cascade,
  provider text not null default 'stripe',
  checkout_session_id text unique,
  payment_intent_id text,
  amount_ore int not null check (amount_ore >= 0),
  currency text not null default 'dkk',
  status text not null default 'oprettet' check (status in ('oprettet', 'betalt', 'fejlet', 'refunderet', 'partner')),
  paid_at timestamptz,
  receipt_url text,
  refunded_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  kind text not null check (kind in ('bedemand', 'advokat', 'bobestyrer', 'andet')),
  contact_email citext,
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  price_ore int not null default 49500,
  free_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table partner_members (
  partner_id uuid not null references partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'medarbejder' check (role in ('ejer', 'medarbejder')),
  primary key (partner_id, user_id)
);

create table partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  estate_id uuid not null unique references estates (id) on delete cascade,
  code text not null,
  billable boolean not null default false,
  invoiced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Simpel tæller til rate limiting (bruges af serverfunktioner).
create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- ---------- Triggere ----------
-- Kører koden som serveren (RPC med security definer, service role) eller som en klient (anon/authenticated)?
create or replace function is_server() returns boolean language sql stable as $$
  select current_user not in ('anon', 'authenticated')
$$;
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger estates_updated before update on estates for each row execute function set_updated_at();
create trigger heirs_updated before update on heirs for each row execute function set_updated_at();
create trigger items_updated before update on items for each row execute function set_updated_at();
create trigger wishes_updated before update on wishes for each row execute function set_updated_at();

-- Loddet kan aldrig ændres, created_by heller ikke.
create or replace function protect_estate_columns() returns trigger language plpgsql as $$
begin
  if new.lod <> old.lod then raise exception 'Loddet kan ikke ændres' using errcode = '42501'; end if;
  if new.created_by <> old.created_by then raise exception 'Ejer kan ikke ændres' using errcode = '42501'; end if;
  return new;
end $$;
create trigger estates_protect before update on estates for each row execute function protect_estate_columns();

-- Beskyttede kolonner på heirs må kun ændres af serveren (RPC'er med security definer).
create or replace function protect_heir_columns() returns trigger language plpgsql as $$
begin
  if not is_server() then
    if new.submitted_at is distinct from old.submitted_at or new.user_id is distinct from old.user_id
       or new.proxy_by is distinct from old.proxy_by or new.proxy_consent_id is distinct from old.proxy_consent_id
       or new.no_wish is distinct from old.no_wish then
      raise exception 'Feltet kan kun ændres gennem Arvora' using errcode = '42501';
    end if;
    if new.share is distinct from old.share and old.submitted_at is not null then
      raise exception 'Arvelod kan ikke ændres, efter arvingen har afgivet ønsker' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger heirs_protect before update on heirs for each row execute function protect_heir_columns();

-- Ting kan kun ændres, mens boet er kladde eller åbent. Fjernes eller ændres en ting, som nogen har givet point,
-- må de fordele igen (submitted_at nulstilles). Se beslutninger.md 2026-11-09.
create or replace function items_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare st estate_status; eid uuid; affected boolean := false;
begin
  if tg_op = 'DELETE' then eid := old.estate_id; else eid := new.estate_id; end if;
  select status into st from estates where id = eid;
  if st not in ('kladde', 'aaben') and not is_server() then
    raise exception 'Tingene kan ikke ændres, når fordelingen er i gang' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then affected := true;
  elsif tg_op = 'UPDATE' and ((new.deleted_at is not null and old.deleted_at is null) or new.will_heir_id is distinct from old.will_heir_id) then affected := true;
  end if;
  if affected then
    update heirs set submitted_at = null where estate_id = eid and submitted_at is not null
      and id in (select heir_id from wishes where item_id = old.id and (points > 0 or bid > 0));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger items_guard_ins before insert on items for each row execute function items_guard();
create trigger items_guard_upd before update on items for each row execute function items_guard();
create trigger items_guard_del before delete on items for each row execute function items_guard();

-- Auditlog. Indhold af ønsker logges aldrig; for ønsker logges kun, at arvingen ændrede noget.
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb; o jsonb; eid uuid; rid uuid; m jsonb := '{}';
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;
  eid := coalesce(r ->> 'estate_id', r ->> 'id')::uuid;
  rid := (r ->> 'id')::uuid;
  if tg_table_name = 'wishes' then
    m := jsonb_build_object('heir_id', r ->> 'heir_id');
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key), '[]') into m from jsonb_each(r) n
      where n.value is distinct from (o -> n.key) and n.key not in ('updated_at');
    m := jsonb_build_object('changed', m);
    if tg_table_name in ('heirs', 'items') then m := m || jsonb_build_object('name', r ->> 'name'); end if;
  elsif tg_table_name in ('heirs', 'items') then
    m := jsonb_build_object('name', r ->> 'name');
  end if;
  insert into audit_events (estate_id, actor, action, table_name, row_id, meta)
    values (eid, auth.uid(), lower(tg_op), tg_table_name, rid, m);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger audit_estates after insert or update or delete on estates for each row execute function audit_row();
create trigger audit_heirs after insert or update or delete on heirs for each row execute function audit_row();
create trigger audit_items after insert or update or delete on items for each row execute function audit_row();
create trigger audit_invitations after insert or update on invitations for each row execute function audit_row();
create trigger audit_wishes after insert or update or delete on wishes for each row execute function audit_row();
create trigger audit_runs after insert or update on distribution_runs for each row execute function audit_row();
create trigger audit_signatures after insert on signatures for each row execute function audit_row();
create trigger audit_consents after insert on consent_records for each row execute function audit_row();
create trigger audit_payments after insert or update on payments for each row execute function audit_row();
create trigger audit_members after insert or delete on estate_members for each row execute function audit_row();
