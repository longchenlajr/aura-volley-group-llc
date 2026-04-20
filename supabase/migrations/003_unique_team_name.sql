-- Prevent duplicate team names within the same tournament
alter table teams add constraint teams_tournament_team_unique
  unique (tournament_id, team_name);
