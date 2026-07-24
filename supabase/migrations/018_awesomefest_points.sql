-- Allow AwesomeFest tournaments' playoff bracket to be set to games-to-21.
alter table brackets
  drop constraint brackets_points_per_set_check,
  add constraint brackets_points_per_set_check check (points_per_set in (11, 15, 21));
