-- Allow swapping two teams within the same pool (swaps seed_in_pool)
-- Previously this raised an exception; now it handles both same-pool and cross-pool swaps.
create or replace function swap_pool_teams(a_team_id uuid, b_team_id uuid)
returns void as $$
declare
  a_pool_id uuid;
  a_seed integer;
  b_pool_id uuid;
  b_seed integer;
begin
  -- Read current assignments
  select pool_id, seed_in_pool into a_pool_id, a_seed
    from pool_teams where team_id = a_team_id;
  select pool_id, seed_in_pool into b_pool_id, b_seed
    from pool_teams where team_id = b_team_id;

  if a_pool_id is null or b_pool_id is null then
    raise exception 'One or both teams not found in any pool';
  end if;

  if a_pool_id = b_pool_id then
    -- Same pool: just swap seed_in_pool values
    -- Use a temp value to avoid unique constraint violation
    update pool_teams set seed_in_pool = -1 where team_id = a_team_id;
    update pool_teams set seed_in_pool = a_seed where team_id = b_team_id;
    update pool_teams set seed_in_pool = b_seed where team_id = a_team_id;
  else
    -- Cross-pool: delete and reinsert with swapped positions
    delete from pool_teams where team_id = a_team_id;
    delete from pool_teams where team_id = b_team_id;

    insert into pool_teams (pool_id, team_id, seed_in_pool)
      values (b_pool_id, a_team_id, b_seed);
    insert into pool_teams (pool_id, team_id, seed_in_pool)
      values (a_pool_id, b_team_id, a_seed);
  end if;
end;
$$ language plpgsql;
