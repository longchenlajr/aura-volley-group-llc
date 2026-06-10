-- 015: transactional team withdrawal.
-- Replaces the multi-statement, partially-broken withdraw API route logic with a
-- single atomic RPC that forfeits pool AND bracket matches correctly, handles
-- in-progress matches and not-yet-populated bracket slots, and is idempotent.

----------------------------------------------------------------------
-- Helper: forfeit one bracket match in favor of the non-withdrawn opponent, then
-- propagate. No-op if the match is already complete or the opponent is unknown
-- (that case is handled later, when the opponent's feeder completes).
----------------------------------------------------------------------
create or replace function forfeit_bracket_match(p_match_id uuid, p_losing_team uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_match public.bracket_matches%rowtype;
  v_pps int;
begin
  select * into v_match from public.bracket_matches where id = p_match_id;
  if v_match.id is null then return; end if;
  if v_match.status = 'complete' then return; end if;
  -- Opponent not known yet: defer. propagate_bracket_winner will auto-forfeit this
  -- match when the other feeder completes and finds a withdrawn team in the slot.
  if v_match.team_a_id is null or v_match.team_b_id is null then return; end if;

  select points_per_set into v_pps from public.brackets where id = v_match.bracket_id;

  delete from public.bracket_match_sets where bracket_match_id = p_match_id;
  insert into public.bracket_match_sets
    (bracket_match_id, set_number, team_a_score, team_b_score, submitted_by, is_forfeit, submitted_at)
  values (
    p_match_id, 1,
    case when v_match.team_a_id = p_losing_team then 0 else v_pps end,
    case when v_match.team_a_id = p_losing_team then v_pps else 0 end,
    'admin', true, now()
  );
  update public.bracket_matches set status = 'complete', end_time = now() where id = p_match_id;

  perform public.propagate_bracket_winner(p_match_id);
  perform public.assign_bracket_work_team(p_match_id);
end;
$$;

----------------------------------------------------------------------
-- Recreate propagate_bracket_winner: same as 014, but when it populates a
-- downstream match and finds exactly one of the two teams is withdrawn, it
-- auto-forfeits that match to the opponent (cascading up the bracket).
----------------------------------------------------------------------
create or replace function propagate_bracket_winner(completed_match_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  completed public.bracket_matches%rowtype;
  winning_team uuid;
  score_a integer;
  score_b integer;
  next_slot public.bracket_slots%rowtype;
  next_match public.bracket_matches%rowtype;
begin
  select * into completed from public.bracket_matches where id = completed_match_id;
  if completed.id is null then
    raise exception 'Match not found';
  end if;

  select team_a_score, team_b_score into score_a, score_b
    from public.bracket_match_sets
    where bracket_match_id = completed_match_id and set_number = 1;

  if score_a is null then
    raise exception 'No score found for this match';
  end if;

  if score_a = score_b then
    raise exception 'Bracket match cannot end in a tie';
  end if;

  if score_a > score_b then
    winning_team := completed.team_a_id;
    update public.bracket_matches set winner_slot_id = completed.slot_a_id where id = completed_match_id;
  else
    winning_team := completed.team_b_id;
    update public.bracket_matches set winner_slot_id = completed.slot_b_id where id = completed_match_id;
  end if;

  for next_slot in
    select * from public.bracket_slots
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (completed.slot_a_id = any(source_slot_ids) or completed.slot_b_id = any(source_slot_ids))
  loop
    update public.bracket_slots set team_id = winning_team where id = next_slot.id;

    for next_match in
      select * from public.bracket_matches
      where bracket_id = completed.bracket_id
        and round_number = completed.round_number + 1
        and (slot_a_id = next_slot.id or slot_b_id = next_slot.id)
        and status = 'scheduled'
    loop
      declare
        slot_a_team uuid;
        slot_b_team uuid;
        a_withdrawn boolean := false;
        b_withdrawn boolean := false;
      begin
        select team_id into slot_a_team from public.bracket_slots where id = next_match.slot_a_id;
        select team_id into slot_b_team from public.bracket_slots where id = next_match.slot_b_id;

        if slot_a_team is not null and slot_b_team is not null then
          update public.bracket_matches
          set team_a_id = slot_a_team, team_b_id = slot_b_team
          where id = next_match.id;

          -- Cascade: a withdrawn team never plays its next match — forfeit to the
          -- opponent immediately.
          select withdrawn_at is not null into a_withdrawn from public.teams where id = slot_a_team;
          select withdrawn_at is not null into b_withdrawn from public.teams where id = slot_b_team;
          if a_withdrawn and not b_withdrawn then
            perform public.forfeit_bracket_match(next_match.id, slot_a_team);
          elsif b_withdrawn and not a_withdrawn then
            perform public.forfeit_bracket_match(next_match.id, slot_b_team);
          end if;
        end if;
      end;
    end loop;
  end loop;
end;
$$;

----------------------------------------------------------------------
-- Recreate assign_bracket_work_team: same as 014, but never assign a withdrawn
-- team as a work team.
----------------------------------------------------------------------
create or replace function assign_bracket_work_team(completed_match_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  completed public.bracket_matches%rowtype;
  losing_team uuid;
  next_match public.bracket_matches%rowtype;
  downstream_match public.bracket_matches%rowtype;
  target_match public.bracket_matches%rowtype;
  conflict_count integer;
  winner_next_slot public.bracket_slots%rowtype;
  loser_withdrawn boolean;
begin
  select * into completed from public.bracket_matches where id = completed_match_id;
  if completed.id is null then return; end if;
  if completed.winner_slot_id is null then return; end if;

  if completed.winner_slot_id = completed.slot_a_id then
    losing_team := completed.team_b_id;
  else
    losing_team := completed.team_a_id;
  end if;

  if losing_team is null then return; end if;

  -- A withdrawn team is never assigned to work.
  select withdrawn_at is not null into loser_withdrawn from public.teams where id = losing_team;
  if loser_withdrawn then return; end if;

  select * into next_match from public.bracket_matches
  where bracket_id = completed.bracket_id
    and court_number = completed.court_number
    and match_order > completed.match_order
    and status = 'scheduled'
  order by match_order asc
  limit 1;

  for winner_next_slot in
    select * from public.bracket_slots
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (completed.slot_a_id = any(source_slot_ids) or completed.slot_b_id = any(source_slot_ids))
  loop
    select * into downstream_match from public.bracket_matches
    where bracket_id = completed.bracket_id
      and round_number = completed.round_number + 1
      and (slot_a_id = winner_next_slot.id or slot_b_id = winner_next_slot.id)
      and status = 'scheduled'
    limit 1;
    exit;
  end loop;

  if next_match.id is not null then
    target_match := next_match;
  elsif downstream_match.id is not null then
    target_match := downstream_match;
  else
    return;
  end if;

  if target_match.work_team_id is not null then return; end if;

  if losing_team = target_match.team_a_id or losing_team = target_match.team_b_id then
    return;
  end if;

  select count(*) into conflict_count from public.bracket_matches
  where bracket_id = completed.bracket_id
    and (team_a_id = losing_team or team_b_id = losing_team)
    and status = 'scheduled'
    and match_order between target_match.match_order and target_match.match_order + 1;

  if conflict_count > 0 then return; end if;

  update public.bracket_matches set work_team_id = losing_team where id = target_match.id;
end;
$$;

----------------------------------------------------------------------
-- The withdrawal RPC itself.
----------------------------------------------------------------------
create or replace function withdraw_team(
  p_team_id uuid,
  p_points_per_set int,
  p_sets_per_match int
)
returns json
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_now timestamptz := now();
  m public.matches%rowtype;
  bm public.bracket_matches%rowtype;
  s int;
  pool_forfeits int := 0;
  bracket_forfeits int := 0;
begin
  -- Lock the team row: idempotency marker + serialize concurrent withdrawals.
  select * into v_team from public.teams where id = p_team_id for update;
  if v_team.id is null then
    raise exception 'Team not found';
  end if;
  if v_team.withdrawn_at is not null then
    return json_build_object('already_withdrawn', true, 'pool_forfeits', 0, 'bracket_forfeits', 0);
  end if;

  -- 1. Pool matches: forfeit every scheduled OR in-progress match the team plays
  --    in (overwriting partial in-progress sets).
  for m in
    select * from public.matches
    where tournament_id = v_team.tournament_id
      and status in ('scheduled', 'in_progress')
      and (team_a_id = p_team_id or team_b_id = p_team_id)
  loop
    delete from public.match_sets where match_id = m.id;
    for s in 1..p_sets_per_match loop
      insert into public.match_sets
        (match_id, set_number, team_a_score, team_b_score, submitted_by, is_forfeit, submitted_at)
      values (
        m.id, s,
        case when m.team_a_id = p_team_id then 0 else p_points_per_set end,
        case when m.team_a_id = p_team_id then p_points_per_set else 0 end,
        'admin', true, v_now
      );
    end loop;
    update public.matches set status = 'complete', end_time = v_now where id = m.id;
    pool_forfeits := pool_forfeits + 1;
  end loop;

  -- 2. Bracket matches where the team plays AND the opponent is already known:
  --    forfeit now. Matches where only the withdrawn team is placed (opponent's
  --    feeder unfinished) are deferred — propagate_bracket_winner auto-forfeits
  --    them when the opponent arrives.
  for bm in
    select bmatch.* from public.bracket_matches bmatch
    join public.brackets b on b.id = bmatch.bracket_id
    where b.tournament_id = v_team.tournament_id
      and bmatch.status in ('scheduled', 'in_progress')
      and (bmatch.team_a_id = p_team_id or bmatch.team_b_id = p_team_id)
      and bmatch.team_a_id is not null and bmatch.team_b_id is not null
  loop
    perform public.forfeit_bracket_match(bm.id, p_team_id);
    bracket_forfeits := bracket_forfeits + 1;
  end loop;

  -- 3. Clear any bracket work assignment that named the withdrawn team.
  update public.bracket_matches bmatch
  set work_team_id = null
  from public.brackets b
  where bmatch.bracket_id = b.id
    and b.tournament_id = v_team.tournament_id
    and bmatch.status = 'scheduled'
    and bmatch.work_team_id = p_team_id;

  -- 4. Mark withdrawn LAST. Everything above is in this transaction, so a failure
  --    rolls it all back and the team stays un-withdrawn (retryable).
  update public.teams set withdrawn_at = v_now where id = p_team_id;

  return json_build_object(
    'already_withdrawn', false,
    'pool_forfeits', pool_forfeits,
    'bracket_forfeits', bracket_forfeits
  );
end;
$$;

-- Grant execute to service_role only (consistent with migration 014).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'forfeit_bracket_match(uuid, uuid)',
    'withdraw_team(uuid, integer, integer)'
  ]
  loop
    execute format('revoke execute on function public.%s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function public.%s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', fn);
    end if;
  end loop;
end $$;
