-- Pools table
create table pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  pool_label text not null,
  court_number integer not null,
  created_at timestamptz not null default now(),

  constraint pools_tournament_label_unique unique (tournament_id, pool_label)
);

-- Pool team assignments (junction)
create table pool_teams (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  seed_in_pool integer not null,
  created_at timestamptz not null default now(),

  constraint pool_teams_pool_team_unique unique (pool_id, team_id),
  constraint pool_teams_pool_seed_unique unique (pool_id, seed_in_pool)
);

-- Indexes
create index pools_tournament_idx on pools(tournament_id);
create index pool_teams_pool_idx on pool_teams(pool_id);
create index pool_teams_team_idx on pool_teams(team_id);

-- RLS
alter table pools enable row level security;
alter table pool_teams enable row level security;

-- Anonymous read (public Live page)
create policy "pools_anon_select" on pools for select to anon using (true);
create policy "pool_teams_anon_select" on pool_teams for select to anon using (true);

-- Atomic swap function (delete-then-reinsert inside transaction)
create or replace function swap_pool_teams(a_team_id uuid, b_team_id uuid)
returns void as $$
declare
  a_pool_id uuid;
  a_seed integer;
  b_pool_id uuid;
  b_seed integer;
begin
  -- Read current assignments
  select pool_id, seed_in_pool into a_pool_id, a_seed
    from pool_teams where team_id = a_team_id;
  select pool_id, seed_in_pool into b_pool_id, b_seed
    from pool_teams where team_id = b_team_id;

  if a_pool_id is null or b_pool_id is null then
    raise exception 'One or both teams not found in any pool';
  end if;

  if a_pool_id = b_pool_id then
    raise exception 'Teams are already in the same pool';
  end if;

  -- Delete both records
  delete from pool_teams where team_id = a_team_id;
  delete from pool_teams where team_id = b_team_id;

  -- Reinsert with swapped positions
  insert into pool_teams (pool_id, team_id, seed_in_pool)
    values (b_pool_id, a_team_id, b_seed);
  insert into pool_teams (pool_id, team_id, seed_in_pool)
    values (a_pool_id, b_team_id, a_seed);
end;
$$ language plpgsql;
