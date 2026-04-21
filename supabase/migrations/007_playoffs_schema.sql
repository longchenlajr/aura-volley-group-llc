-- Playoff brackets
create table brackets (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  bracket_type text not null check (bracket_type in ('gold', 'silver')),
  points_per_set integer not null check (points_per_set in (11, 15)),
  created_at timestamptz not null default now(),

  constraint brackets_tournament_type_unique unique (tournament_id, bracket_type)
);

-- Bracket slots (positions in the bracket tree)
create table bracket_slots (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number integer not null,
  slot_position integer not null,
  team_id uuid references teams(id) on delete set null,
  is_bye boolean not null default false,
  source_match_id uuid,
  source_slot_ids uuid[],
  created_at timestamptz not null default now(),

  constraint bracket_slots_position_unique unique (bracket_id, round_number, slot_position)
);

-- Playoff matches
create table bracket_matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number integer not null,
  match_position integer not null,

  slot_a_id uuid not null references bracket_slots(id) on delete cascade,
  slot_b_id uuid not null references bracket_slots(id) on delete cascade,
  winner_slot_id uuid references bracket_slots(id),

  team_a_id uuid references teams(id) on delete restrict,
  team_b_id uuid references teams(id) on delete restrict,
  work_team_id uuid references teams(id) on delete set null,

  court_number integer not null,
  match_order integer not null,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'complete')),

  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),

  constraint bracket_matches_position_unique unique (bracket_id, round_number, match_position)
);

-- Bracket match scores (single set only)
create table bracket_match_sets (
  id uuid primary key default gen_random_uuid(),
  bracket_match_id uuid not null references bracket_matches(id) on delete cascade,
  set_number integer not null check (set_number = 1),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  submitted_by text not null check (submitted_by in ('work_team', 'admin')),
  submitted_by_team_id uuid references teams(id) on delete set null,
  submitted_at timestamptz not null default now(),

  constraint bracket_match_sets_match_set_unique unique (bracket_match_id, set_number)
);

-- Bracket match tokens
create table bracket_match_tokens (
  id uuid primary key default gen_random_uuid(),
  bracket_match_id uuid not null references bracket_matches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,

  constraint bracket_match_tokens_match_unique unique (bracket_match_id)
);

-- Indexes
create index brackets_tournament_idx on brackets(tournament_id);
create index bracket_slots_bracket_idx on bracket_slots(bracket_id);
create index bracket_matches_bracket_idx on bracket_matches(bracket_id);
create index bracket_matches_status_idx on bracket_matches(bracket_id, status);
create index bracket_match_sets_match_idx on bracket_match_sets(bracket_match_id);
create index bracket_match_tokens_token_idx on bracket_match_tokens(token);

-- RLS
alter table brackets enable row level security;
alter table bracket_slots enable row level security;
alter table bracket_matches enable row level security;
alter table bracket_match_sets enable row level security;
alter table bracket_match_tokens enable row level security;

-- Anonymous read (public Live page)
create policy "brackets_anon_select" on brackets for select to anon using (true);
create policy "bracket_slots_anon_select" on bracket_slots for select to anon using (true);
create policy "bracket_matches_anon_select" on bracket_matches for select to anon using (true);
create policy "bracket_match_sets_anon_select" on bracket_match_sets for select to anon using (true);
-- No anon access to tokens (service role only)
