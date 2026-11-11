-- Engangskoder til underskrift. Kun hash gemmes; serveren læser og sletter. Klienter har ingen adgang.
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  heir_id uuid not null references heirs (id) on delete cascade,
  run_id uuid not null references distribution_runs (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (heir_id, run_id)
);
alter table otp_codes enable row level security;
revoke all on otp_codes from authenticated, anon;
