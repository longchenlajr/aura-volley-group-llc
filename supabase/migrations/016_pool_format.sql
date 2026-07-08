-- 016: store each pool's match format at generation time.
-- Deriving the format from the *live* roster size means a withdrawal (which leaves
-- pool_teams rows intact but is filtered out by standings consumers) could shift a
-- pool's format and invalidate already-completed matches. Storing it removes that
-- coupling: the format is fixed when the pool is generated.

alter table pools
  add column sets_per_match int,
  add column points_per_set int,
  add column points_cap int;

-- Backfill existing pools from the current getMatchFormat(size) mapping:
--   3,4 -> 2 sets to 15 (cap 17)
--   5   -> 2 sets to 11 (cap 13)
--   6   -> 1 set  to 15 (cap 17)
--   7   -> 1 set  to 11 (cap 13)
--   else-> 1 set  to 15 (cap 17)
update pools p set
  sets_per_match = f.sets,
  points_per_set = f.pps,
  points_cap = f.cap
from (
  select pl.id,
    case sz.n when 5 then 2 when 6 then 1 when 7 then 1 when 3 then 2 when 4 then 2 else 1 end as sets,
    case sz.n when 5 then 11 when 7 then 11 else 15 end as pps,
    case sz.n when 5 then 13 when 7 then 13 else 17 end as cap
  from pools pl
  join lateral (select count(*) n from pool_teams pt where pt.pool_id = pl.id) sz on true
) f
where p.id = f.id;
