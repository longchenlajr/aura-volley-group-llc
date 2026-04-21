-- Propagate bracket winner: moves winning team to next-round slot and populates next match
create or replace function propagate_bracket_winner(completed_match_id uuid)
returns void as $$
declare
  completed bracket_matches%rowtype;
  winning_team uuid;
  score_a integer;
  score_b integer;
  next_slot bracket_slots%rowtype;
  next_match bracket_matches%rowtype;
begin
  select * into completed from bracket_matches where id = completed_match_id;
  if completed.id is null then
    raise exception 'Match not found';
  end if;

  -- Get the single-set score
  select team_a_score, team_b_score into score_a, score_b
    from bracket_match_sets
    where bracket_match_id = completed_match_id and set_number = 1;

  if score_a is null then
    raise exception 'No score found for this match';
  end if;

  -- Determine winner
  if score_a > score_b then
    winning_team := completed.team_a_id;
    update bracket_matches set winner_slot_id = completed.slot_a_id where id = completed_match_id;
  else
    winning_team := completed.team_b_id;
    update bracket_matches set winner_slot_id = completed.slot_b_id where id = completed_match_id;
  end if;

  -- Find the next-round slot that lists this match's slots as source
  -- The next round slot has source_slot_ids containing either slot_a_id or slot_b_id
  for next_slot in
    select * from bracket_slots
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (completed.slot_a_id = any(source_slot_ids) or completed.slot_b_id = any(source_slot_ids))
  loop
    -- Update the next-round slot with the winning team
    update bracket_slots set team_id = winning_team where id = next_slot.id;

    -- Check if both feeder slots for the next match are now populated
    -- Find the match that uses this next_slot
    for next_match in
      select * from bracket_matches
      where bracket_id = completed.bracket_id
        and round_number = completed.round_number + 1
        and (slot_a_id = next_slot.id or slot_b_id = next_slot.id)
        and status = 'scheduled'
    loop
      -- Get both slot teams
      declare
        slot_a_team uuid;
        slot_b_team uuid;
      begin
        select team_id into slot_a_team from bracket_slots where id = next_match.slot_a_id;
        select team_id into slot_b_team from bracket_slots where id = next_match.slot_b_id;

        if slot_a_team is not null and slot_b_team is not null then
          update bracket_matches
          set team_a_id = slot_a_team, team_b_id = slot_b_team
          where id = next_match.id;
        end if;
      end;
    end loop;
  end loop;
end;
$$ language plpgsql;

-- Assign loser of completed bracket match to work the next match on the same court
create or replace function assign_bracket_work_team(completed_match_id uuid)
returns void as $$
declare
  completed bracket_matches%rowtype;
  losing_team uuid;
  next_match bracket_matches%rowtype;
  conflict_count integer;
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

  -- Find next scheduled match on same court, same bracket
  select * into next_match from bracket_matches
  where bracket_id = completed.bracket_id
    and court_number = completed.court_number
    and match_order > completed.match_order
    and status = 'scheduled'
  order by match_order asc
  limit 1;

  if next_match.id is null then return; end if;

  -- Check the losing team isn't playing in the next match
  if losing_team = next_match.team_a_id or losing_team = next_match.team_b_id then
    return; -- Can't work a match you're playing in
  end if;

  -- Check the losing team doesn't have another bracket match coming up soon
  select count(*) into conflict_count from bracket_matches
  where bracket_id = completed.bracket_id
    and (team_a_id = losing_team or team_b_id = losing_team)
    and status = 'scheduled'
    and match_order between next_match.match_order and next_match.match_order + 1;

  if conflict_count > 0 then return; end if;

  -- Assign work team
  update bracket_matches set work_team_id = losing_team where id = next_match.id;
end;
$$ language plpgsql;
