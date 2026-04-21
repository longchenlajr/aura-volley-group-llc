-- Match sets (per-set scores, replaces single-score model)
create table match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  set_number integer not null check (set_number >= 1),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  submitted_by text not null check (submitted_by in ('work_team', 'admin')),
  submitted_by_team_id uuid references teams(id) on delete set null,
  submitted_at timestamptz not null default now(),

  constraint match_sets_match_set_unique unique (match_id, set_number)
);

-- Score submission tokens (one per match)
create table match_tokens (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,

  constraint match_tokens_match_unique unique (match_id)
);

-- Indexes
create index match_sets_match_idx on match_sets(match_id);
create index match_tokens_token_idx on match_tokens(token);
create index match_tokens_match_idx on match_tokens(match_id);

-- RLS
alter table match_sets enable row level security;
alter table match_tokens enable row level security;

-- Public read on scores for Live view
create policy "match_sets_anon_select" on match_sets for select to anon using (true);

-- No anon access to tokens — validated server-side only via service role
