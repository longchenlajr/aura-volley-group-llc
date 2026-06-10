#!/usr/bin/env bash
# Drop and recreate the dev database, re-run migrations + seed
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="$HOME/scoop/apps/postgresql/current/bin:$HOME/scoop/apps/postgrest/current:$PATH"
export PGDATA="$HOME/scoop/apps/postgresql/current/data"

# Ensure PostgreSQL is running
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  echo "PostgreSQL not running. Starting..."
  pg_ctl start -l "$HOME/scoop/apps/postgresql/current/pg.log" -w
fi

# Kill PostgREST connections so we can drop the DB
if [ -f "$PROJECT_DIR/.postgrest.pid" ]; then
  kill "$(cat "$PROJECT_DIR/.postgrest.pid")" 2>/dev/null || true
  rm -f "$PROJECT_DIR/.postgrest.pid"
fi

echo "Dropping database..."
psql -h 127.0.0.1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS aura_volley_dev;" 2>/dev/null

echo "Creating database..."
psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE aura_volley_dev;"

echo "Running migrations..."
for f in "$PROJECT_DIR/supabase/migrations"/*.sql; do
  echo "  $(basename "$f")"
  psql -h 127.0.0.1 -U postgres -d aura_volley_dev -f "$f" > /dev/null
done

# Grant permissions
psql -h 127.0.0.1 -U postgres -d aura_volley_dev <<'SQL'
GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
-- NOTE: anon is intentionally NOT granted EXECUTE on functions. RPCs are
-- service-role only (migration 014); RLS governs the table grants above.
SQL

echo "Seeding data..."
psql -h 127.0.0.1 -U postgres -d aura_volley_dev -f "$PROJECT_DIR/supabase/seed.sql" > /dev/null

# Restart PostgREST
echo "Starting PostgREST..."
postgrest "$PROJECT_DIR/supabase/postgrest.conf" &
echo "$!" > "$PROJECT_DIR/.postgrest.pid"
sleep 1

echo ""
echo "Database reset complete. Fresh schema + seed data ready."
