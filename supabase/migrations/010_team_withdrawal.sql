-- Team withdrawal support: soft-delete + forfeit tracking

-- Add withdrawn_at to teams table for soft-delete
alter table teams add column withdrawn_at timestamptz;

-- Add is_forfeit flag to match_sets for visual distinction
alter table match_sets add column is_forfeit boolean not null default false;
