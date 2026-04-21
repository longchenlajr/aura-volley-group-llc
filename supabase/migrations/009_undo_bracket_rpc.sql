-- Undo a bracket match result: clears score, resets status, removes winner from
-- next-round slot, and cascades forward through all dependent matches.
create or replace function undo_bracket_match(target_match_id uuid)
returns integer as $$
declare
  target bracket_matches%rowtype;
  next_slot bracket_slots%rowtype;
  dependent_match bracket_matches%rowtype;
  cleared integer := 0;
begin
  select * into target from bracket_matches where id = target_match_id;
  if target.id is null then return 0; end if;

  -- Clear this match's score
  delete from bracket_match_sets where bracket_match_id = target_match_id;

  -- Reset match status
  update bracket_matches
  set status = 'scheduled', winner_slot_id = null, end_time = null, work_team_id = null
  where id = target_match_id;
  cleared := cleared + 1;

  -- Find next-round slots that reference this match's slots
  for next_slot in
    select * from bracket_slots
    where bracket_id = target.bracket_id
      and round_number = target.round_number + 1
      and (target.slot_a_id = any(source_slot_ids) or target.slot_b_id = any(source_slot_ids))
  loop
    -- Clear the team from the next-round slot
    update bracket_slots set team_id = null where id = next_slot.id;

    -- Find and cascade any matches that used this slot
    for dependent_match in
      select * from bracket_matches
      where bracket_id = target.bracket_id
        and (slot_a_id = next_slot.id or slot_b_id = next_slot.id)
    loop
      -- Recursively undo the dependent match
      cleared := cleared + undo_bracket_match(dependent_match.id);

      -- Clear team assignments on the dependent match
      update bracket_matches
      set team_a_id = case when slot_a_id = next_slot.id then null else team_a_id end,
          team_b_id = case when slot_b_id = next_slot.id then null else team_b_id end
      where id = dependent_match.id;
    end loop;
  end loop;

  return cleared;
end;
$$ language plpgsql;
