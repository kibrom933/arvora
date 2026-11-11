-- Arvora: grundmodel. Bo → arvinger → ting → ønsker → fordeling → underskrifter.
-- Hovedregel: en arving kan kun læse sine egne ønsker, indtil boet er fordelt. Det gælder også tovholderen.
-- Fordelingen skrives kun af serveren (service role), som er den eneste, der må se alle ønsker før låsning.

create type bo_status as enum ('oprettet', 'oensker', 'fordelt', 'afsluttet');
create type bo_metode as enum ('point', 'kroner');

create table bo (
  id            uuid primary key default gen_random_uuid(),
  navn          text not null check (length(navn) between 1 and 120),
  tovholder     uuid not null references auth.users(id),
  metode        bo_metode not null default 'point',
  status        bo_status not null default 'oprettet',
  lod           bigint not null default (floor(random() * 2147483647))::bigint,  -- trækkes én gang og ændres aldrig
  frist         date,
  oprettet      timestamptz not null default now(),
  afsluttet     timestamptz,
  slettes       timestamptz                              -- sættes til 90 dage efter afslutning
);

create table arving (
  id            uuid primary key default gen_random_uuid(),
  bo_id         uuid not null references bo(id) on delete cascade,
  bruger        uuid references auth.users(id),          -- sættes, når arvingen åbner sit personlige link
  navn          text not null check (length(navn) between 1 and 80),
  kontakt       text,                                     -- mobil eller mail til invitationen
  arvelod       numeric(7,4) not null default 1 check (arvelod > 0),
  oensker_intet boolean not null default false,
  svaret        timestamptz,
  unique (bo_id, bruger)
);
create index on arving (bruger);

create table ting (
  id            uuid primary key default gen_random_uuid(),
  bo_id         uuid not null references bo(id) on delete cascade,
  nummer        int not null,                             -- mærkesedlens nummer; genbruges ikke
  navn          text not null check (length(navn) between 1 and 120),
  billede       text,                                     -- sti i Storage
  vurdering     int check (vurdering >= 0),               -- kroner, kun kronemetoden
  kasse         text,
  unique (bo_id, nummer)
);

create table oenske (
  arving_id     uuid not null references arving(id) on delete cascade,
  ting_id       uuid not null references ting(id) on delete cascade,
  vaerdi        int not null check (vaerdi > 0),          -- point (sum ≤ 100) eller bud i kroner
  primary key (arving_id, ting_id)
);

create table fordeling (
  ting_id       uuid primary key references ting(id) on delete cascade,
  bo_id         uuid not null references bo(id) on delete cascade,
  arving_id     uuid references arving(id) on delete set null,   -- null: ingen ønskede tingen
  ved_lod       boolean not null default false
);

create table underskrift (
  bo_id         uuid not null references bo(id) on delete cascade,
  arving_id     uuid not null references arving(id) on delete cascade,
  navn          text not null,
  tidspunkt     timestamptz not null default now(),
  primary key (bo_id, arving_id)
);

-- Hjælpere. security definer, så de kan bruges i regler uden at reglerne kalder sig selv.
create function min_arving(b uuid) returns uuid language sql stable security definer set search_path = public as
$$ select id from arving where bo_id = b and bruger = auth.uid() $$;

create function er_tovholder(b uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from bo where id = b and tovholder = auth.uid()) $$;

create function er_med(b uuid) returns boolean language sql stable security definer set search_path = public as
$$ select er_tovholder(b) or min_arving(b) is not null $$;

create function bo_status_for(b uuid) returns bo_status language sql stable security definer set search_path = public as
$$ select status from bo where id = b $$;

-- Point må højst summe til 100 pr. arving. Ønsker kan kun ændres, mens boet tager imod ønsker.
create function tjek_oenske() returns trigger language plpgsql as $$
declare b uuid; m bo_metode; s bo_status; total int;
begin
  select t.bo_id into b from ting t where t.id = new.ting_id;
  if b is distinct from (select bo_id from arving where id = new.arving_id) then raise exception 'Tingen hører ikke til arvingens bo'; end if;
  select metode, status into m, s from bo where id = b;
  if s <> 'oensker' then raise exception 'Boet tager ikke imod ønsker lige nu'; end if;
  if m = 'point' then
    select coalesce(sum(vaerdi), 0) into total from oenske where arving_id = new.arving_id and ting_id <> new.ting_id;
    if total + new.vaerdi > 100 then raise exception 'Der kan højst fordeles 100 point'; end if;
  end if;
  return new;
end $$;
create trigger oenske_tjek before insert or update on oenske for each row execute function tjek_oenske();

-- Loddet og tovholderen kan ikke ændres, og status kan kun gå fremad.
create function tjek_bo() returns trigger language plpgsql as $$
begin
  if new.lod <> old.lod then raise exception 'Loddet kan ikke trækkes om'; end if;
  if new.tovholder <> old.tovholder then raise exception 'Tovholderen kan ikke skiftes her'; end if;
  if new.status < old.status then raise exception 'Et bo kan ikke gå tilbage til en tidligere fase'; end if;
  if new.status = 'afsluttet' and old.status <> 'afsluttet' then new.afsluttet := now(); new.slettes := new.afsluttet + interval '90 days'; end if;
  return new;
end $$;
create trigger bo_tjek before update on bo for each row execute function tjek_bo();

alter table bo enable row level security;
alter table arving enable row level security;
alter table ting enable row level security;
alter table oenske enable row level security;
alter table fordeling enable row level security;
alter table underskrift enable row level security;

create policy bo_laes   on bo for select using (tovholder = auth.uid() or min_arving(id) is not null);
create policy bo_opret  on bo for insert with check (tovholder = auth.uid());
-- Tovholderen må åbne for ønsker, men kun serveren må sætte 'fordelt' og 'afsluttet'.
create policy bo_ret    on bo for update using (tovholder = auth.uid()) with check (tovholder = auth.uid() and status in ('oprettet', 'oensker'));

create policy arving_laes  on arving for select using (er_med(bo_id));
create policy arving_styr  on arving for all using (er_tovholder(bo_id) and bo_status_for(bo_id) in ('oprettet', 'oensker'))
                                         with check (er_tovholder(bo_id) and bo_status_for(bo_id) in ('oprettet', 'oensker'));
create policy arving_selv  on arving for update using (bruger = auth.uid()) with check (bruger = auth.uid());

create policy ting_laes  on ting for select using (er_med(bo_id));
create policy ting_styr  on ting for all using (er_tovholder(bo_id) and bo_status_for(bo_id) in ('oprettet', 'oensker'))
                                     with check (er_tovholder(bo_id) and bo_status_for(bo_id) in ('oprettet', 'oensker'));

-- Ønsker: kun ens egne, indtil boet er fordelt. Derefter kan alle i boet se alle ønsker.
create policy oenske_laes on oenske for select using (
  exists (select 1 from arving a where a.id = arving_id
          and (a.bruger = auth.uid() or (er_med(a.bo_id) and bo_status_for(a.bo_id) in ('fordelt', 'afsluttet')))));
create policy oenske_skriv on oenske for all
  using (exists (select 1 from arving a where a.id = arving_id and a.bruger = auth.uid()))
  with check (exists (select 1 from arving a where a.id = arving_id and a.bruger = auth.uid()));

create policy fordeling_laes on fordeling for select using (er_med(bo_id));          -- skrives kun med service role

create policy underskrift_laes on underskrift for select using (er_med(bo_id));
create policy underskrift_egen on underskrift for insert with check (
  arving_id = min_arving(bo_id) and bo_status_for(bo_id) = 'fordelt');

-- Kolonner, en arving ikke selv må røre (arvelod, bo, bruger), låses med rettigheder frem for regler.
revoke update on arving from authenticated;
grant update (navn, kontakt, arvelod, oensker_intet, svaret) on arving to authenticated;
create function tjek_arving() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not er_tovholder(old.bo_id) and (new.arvelod <> old.arvelod or new.navn <> old.navn) then
    raise exception 'Kun tovholderen kan ændre navn og arvelod'; end if;
  return new;
end $$;
create trigger arving_tjek before update on arving for each row when (current_setting('role', true) = 'authenticated') execute function tjek_arving();
