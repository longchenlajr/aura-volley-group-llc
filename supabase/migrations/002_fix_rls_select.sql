-- Allow anon to read back inserted rows (needed for .insert().select())
create policy "Allow anonymous select on teams"
  on teams for select
  to anon
  using (true);

create policy "Allow anonymous select on players"
  on players for select
  to anon
  using (true);
