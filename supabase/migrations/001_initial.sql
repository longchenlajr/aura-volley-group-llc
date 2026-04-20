-- Teams table
create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  team_name text not null,
  contact_email text not null,
  contact_phone text not null,
  seed integer,
  checked_in boolean not null default false,
  created_at timestamptz not null default now()
);

-- Players table
create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  email text,
  is_captain boolean not null default false
);

-- Enable RLS
alter table teams enable row level security;
alter table players enable row level security;

-- Public registration: allow anonymous inserts
create policy "Allow anonymous insert on teams"
  on teams for insert
  to anon
  with check (true);

create policy "Allow anonymous insert on players"
  on players for insert
  to anon
  with check (true);

-- Service role has full access by default (bypasses RLS)
-- No additional policies needed for admin operations
