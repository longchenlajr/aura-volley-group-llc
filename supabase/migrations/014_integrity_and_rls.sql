-- 014: integrity constraints, RLS lockdown, and RPC hardening
-- Remediation of audit findings: schema corruption paths, anon PII/RPC exposure,
-- bracket tie/winner-propagation bugs.

----------------------------------------------------------------------
-- 1. Forfeit parity: bracket_match_sets needs is_forfeit (match_sets already has
--    it). Required by the transactional withdrawal flow (migration 015).
----------------------------------------------------------------------
alter table bracket_match_sets add column is_forfeit boolean not null default false;

----------------------------------------------------------------------
-- 2. A single-set, single-elimination bracket match cannot end in a tie.
--    (Previously a tie silently advanced team B.)
----------------------------------------------------------------------
alter table bracket_match_sets
  add constraint bracket_match_sets_no_tie check (team_a_score <> team_b_score);

----------------------------------------------------------------------
-- 3. bracket_matches integrity (parity with the `matches` table, which already
--    has distinct-teams and work-not-playing checks).
----------------------------------------------------------------------
alter table bracket_matches
  add constraint bracket_matches_distinct_teams
    check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id);
alter table bracket_matches
  add constraint bracket_matches_distinct_slots
    check (slot_a_id <> slot_b_id);
alter table bracket_matches
  add constraint bracket_matches_work_not_playing
    check (work_team_id is null or (work_team_id <> team_a_id and work_team_id <> team_b_id));

----------------------------------------------------------------------
-- 4. A team belongs to at most one pool. (team ids are globally unique, so a
--    bare unique index on team_id also enforces this per-tournament.)
----------------------------------------------------------------------
create unique index pool_teams_one_pool_per_team on pool_teams (team_id);

----------------------------------------------------------------------
-- 5. Prevent duplicate match-schedule generation (the check-then-insert TOCTOU):
--    court+order is unique within a pool. 6/7-team pools span two courts and
--    reuse match_order across them, so court_number must be part of the key.
----------------------------------------------------------------------
alter table matches
  add constraint matches_pool_court_order_unique unique (pool_id, court_number, match_order);

----------------------------------------------------------------------
-- 6. RLS lockdown: drop every anon policy. RLS stays enabled; the service role
--    (used by all API routes) bypasses it. The anon key is no longer used by the
--    app, so anon should be able to read/write nothing.
----------------------------------------------------------------------
drop policy if exists "Allow anonymous insert on teams" on teams;
drop policy if exists "Allow anonymous insert on players" on players;
drop policy if exists "Allow anonymous select on teams" on teams;
drop policy if exists "Allow anonymous select on players" on players;
drop policy if exists "pools_anon_select" on pools;
drop policy if exists "pool_teams_anon_select" on pool_teams;
drop policy if exists "matches_anon_select" on matches;
drop policy if exists "match_sets_anon_select" on match_sets;
drop policy if exists "brackets_anon_select" on brackets;
drop policy if exists "bracket_slots_anon_select" on bracket_slots;
drop policy if exists "bracket_matches_anon_select" on bracket_matches;
drop policy if exists "bracket_match_sets_anon_select" on bracket_match_sets;

----------------------------------------------------------------------
-- 7. Hardened RPCs: recreate with a pinned (empty) search_path and fully
--    schema-qualified references, fix the winner/tie/undo bugs from the audit.
----------------------------------------------------------------------

-- Move the winning team forward; reject ties and unscored matches.
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

  -- Defense-in-depth behind the bracket_match_sets_no_tie CHECK.
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
      begin
        select team_id into slot_a_team from public.bracket_slots where id = next_match.slot_a_id;
        select team_id into slot_b_team from public.bracket_slots where id = next_match.slot_b_id;

        if slot_a_team is not null and slot_b_team is not null then
          update public.bracket_matches
          set team_a_id = slot_a_team, team_b_id = slot_b_team
          where id = next_match.id;
        end if;
      end;
    end loop;
  end loop;
end;
$$;

-- Assign the loser to work the next match. Guards against an undecided winner.
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
begin
  select * into completed from public.bracket_matches where id = completed_match_id;
  if completed.id is null then return; end if;

  -- Without a decided winner we cannot know the loser. (Previously a null
  -- winner_slot_id fell through to declaring team A the loser.)
  if completed.winner_slot_id is null then return; end if;

  if completed.winner_slot_id = completed.slot_a_id then
    losing_team := completed.team_b_id;
  else
    losing_team := completed.team_a_id;
  end if;

  if losing_team is null then return; end if;

  -- Strategy 1: next scheduled match on the same court.
  select * into next_match from public.bracket_matches
  where bracket_id = completed.bracket_id
    and court_number = completed.court_number
    and match_order > completed.match_order
    and status = 'scheduled'
  order by match_order asc
  limit 1;

  -- Strategy 2: the downstream match this winner feeds into (any court).
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

-- Undo a result. Now also reverses the work assignment this match produced, and
-- no longer wipes this match's own work_team_id (which came from another match).
create or replace function undo_bracket_match(target_match_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  target public.bracket_matches%rowtype;
  next_slot public.bracket_slots%rowtype;
  dependent_match public.bracket_matches%rowtype;
  cleared integer := 0;
begin
  select * into target from public.bracket_matches where id = target_match_id;
  if target.id is null then return 0; end if;

  delete from public.bracket_match_sets where bracket_match_id = target_match_id;

  -- Reset this match. We intentionally keep work_team_id: that assignment was
  -- produced by some *other* (earlier, still-valid) completed match.
  update public.bracket_matches
  set status = 'scheduled', winner_slot_id = null, end_time = null
  where id = target_match_id;
  cleared := cleared + 1;

  -- Reverse the work assignment THIS match's result produced: its loser/winner may
  -- have been assigned to work a still-scheduled later match.
  update public.bracket_matches
  set work_team_id = null
  where bracket_id = target.bracket_id
    and status = 'scheduled'
    and match_order > target.match_order
    and work_team_id is not null
    and work_team_id in (target.team_a_id, target.team_b_id);

  for next_slot in
    select * from public.bracket_slots
    where bracket_id = target.bracket_id
      and round_number = target.round_number + 1
      and (target.slot_a_id = any(source_slot_ids) or target.slot_b_id = any(source_slot_ids))
  loop
    update public.bracket_slots set team_id = null where id = next_slot.id;

    for dependent_match in
      select * from public.bracket_matches
      where bracket_id = target.bracket_id
        and (slot_a_id = next_slot.id or slot_b_id = next_slot.id)
    loop
      cleared := cleared + public.undo_bracket_match(dependent_match.id);

      update public.bracket_matches
      set team_a_id = case when slot_a_id = next_slot.id then null else team_a_id end,
          team_b_id = case when slot_b_id = next_slot.id then null else team_b_id end
      where id = dependent_match.id;
    end loop;
  end loop;

  return cleared;
end;
$$;

-- Pool swap: unchanged logic, but pinned search_path + qualified references.
create or replace function swap_pool_teams(a_team_id uuid, b_team_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  a_pool_id uuid;
  a_seed integer;
  b_pool_id uuid;
  b_seed integer;
begin
  select pool_id, seed_in_pool into a_pool_id, a_seed
    from public.pool_teams where team_id = a_team_id;
  select pool_id, seed_in_pool into b_pool_id, b_seed
    from public.pool_teams where team_id = b_team_id;

  if a_pool_id is null or b_pool_id is null then
    raise exception 'One or both teams not found in any pool';
  end if;

  if a_pool_id = b_pool_id then
    update public.pool_teams set seed_in_pool = -1 where team_id = a_team_id;
    update public.pool_teams set seed_in_pool = a_seed where team_id = b_team_id;
    update public.pool_teams set seed_in_pool = b_seed where team_id = a_team_id;
  else
    delete from public.pool_teams where team_id = a_team_id;
    delete from public.pool_teams where team_id = b_team_id;

    insert into public.pool_teams (pool_id, team_id, seed_in_pool)
      values (b_pool_id, a_team_id, b_seed);
    insert into public.pool_teams (pool_id, team_id, seed_in_pool)
      values (a_pool_id, b_team_id, a_seed);
  end if;
end;
$$;

----------------------------------------------------------------------
-- 8. Lock down RPC execution. SECURITY INVOKER functions, but revoking the
--    default PUBLIC/anon grant means a future write policy can't turn them into
--    an anon tamper vector. Role-tolerant: dev lacks the `authenticated` role.
----------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'propagate_bracket_winner(uuid)',
    'assign_bracket_work_team(uuid)',
    'undo_bracket_match(uuid)',
    'swap_pool_teams(uuid, uuid)'
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
