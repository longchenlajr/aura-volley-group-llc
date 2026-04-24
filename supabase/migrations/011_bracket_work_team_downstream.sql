-- Improved work team assignment: checks same-court first, then falls back to
-- the downstream match (the match this completed match's winner feeds into).
-- Handles the edge case where feeders and their next-round match are on different courts.
create or replace function assign_bracket_work_team(completed_match_id uuid)
returns void as $$
declare
  completed bracket_matches%rowtype;
  losing_team uuid;
  next_match bracket_matches%rowtype;
  downstream_match bracket_matches%rowtype;
  target_match bracket_matches%rowtype;
  conflict_count integer;
  winner_next_slot bracket_slots%rowtype;
begin
  select * into completed from bracket_matches where id = completed_match_id;
  if completed.id is null then return; end if;

  -- Determine loser
  if completed.winner_slot_id = completed.slot_a_id then
    losing_team := completed.team_b_id;
  else
    losing_team := completed.team_a_id;
  end if;

  if losing_team is null then return; end if;

  -- Strategy 1: find next scheduled match on same court (original behavior)
  select * into next_match from bracket_matches
  where bracket_id = completed.bracket_id
    and court_number = completed.court_number
    and match_order > completed.match_order
    and status = 'scheduled'
  order by match_order asc
  limit 1;

  -- Strategy 2: find the downstream match this winner feeds into (any court)
  -- The winner's slot propagates to a next-round slot, which is used in a next-round match
  for winner_next_slot in
    select * from bracket_slots
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (completed.slot_a_id = any(source_slot_ids) or completed.slot_b_id = any(source_slot_ids))
  loop
    select * into downstream_match from bracket_matches
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (slot_a_id = winner_next_slot.id or slot_b_id = winner_next_slot.id)
      and status = 'scheduled'
    limit 1;
    exit; -- only need the first match
  end loop;

  -- Pick the target: prefer same-court match, fall back to downstream match
  if next_match.id is not null then
    target_match := next_match;
  elsif downstream_match.id is not null then
    target_match := downstream_match;
  else
    return; -- no match to assign
  end if;

  -- Don't overwrite an existing work team assignment
  if target_match.work_team_id is not null then return; end if;

  -- Check the losing team isn't playing in the target match
  if losing_team = target_match.team_a_id or losing_team = target_match.team_b_id then
    return;
  end if;

  -- Check the losing team doesn't have another bracket match coming up soon
  select count(*) into conflict_count from bracket_matches
  where bracket_id = completed.bracket_id
    and (team_a_id = losing_team or team_b_id = losing_team)
    and status = 'scheduled'
    and match_order between target_match.match_order and target_match.match_order + 1;

  if conflict_count > 0 then return; end if;

  -- Assign work team
  update bracket_matches set work_team_id = losing_team where id = target_match.id;
end;
$$ language plpgsql;
