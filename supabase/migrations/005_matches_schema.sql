-- Matches table
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  pool_id uuid references pools(id) on delete cascade,
  bracket_round text,

  team_a_id uuid not null references teams(id) on delete restrict,
  team_b_id uuid not null references teams(id) on delete restrict,
  work_team_id uuid references teams(id) on delete set null,

  court_number integer not null,
  match_order integer not null,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'complete')),

  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),

  constraint matches_distinct_teams
    check (team_a_id != team_b_id),
  constraint matches_work_not_playing
    check (work_team_id is null or (work_team_id != team_a_id and work_team_id != team_b_id))
);

-- Indexes
create index matches_tournament_idx on matches(tournament_id);
create index matches_pool_idx on matches(pool_id);
create index matches_status_idx on matches(tournament_id, status);
create index matches_order_idx on matches(pool_id, match_order);

-- RLS
alter table matches enable row level security;

-- Anonymous read (public Live page)
create policy "matches_anon_select" on matches for select to anon using (true);
