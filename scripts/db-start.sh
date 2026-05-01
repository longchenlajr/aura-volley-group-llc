#!/usr/bin/env bash
# Start local PostgreSQL + PostgREST for development
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="$HOME/scoop/apps/postgresql/current/bin:$HOME/scoop/apps/postgrest/current:$PATH"
export PGDATA="$HOME/scoop/apps/postgresql/current/data"

# Start PostgreSQL if not running
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  pg_ctl start -l "$HOME/scoop/apps/postgresql/current/pg.log" -w
else
  echo "PostgreSQL already running."
fi

# Create database if it doesn't exist
psql -h 127.0.0.1 -U postgres -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname = 'aura_volley_dev'" \
  | grep -q 1 || {
  echo "Creating database and roles..."
  psql -h 127.0.0.1 -U postgres -d postgres <<'SQL'
CREATE DATABASE aura_volley_dev;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'dev-password';
  END IF;
END $$;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;
SQL

  # Run migrations
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
SQL

  # Seed
  echo "Seeding data..."
  psql -h 127.0.0.1 -U postgres -d aura_volley_dev -f "$PROJECT_DIR/supabase/seed.sql" > /dev/null
}

# Start PostgREST in background
if curl -s http://127.0.0.1:54321/ > /dev/null 2>&1; then
  echo "PostgREST already running."
else
  echo "Starting PostgREST on :54321..."
  postgrest "$PROJECT_DIR/supabase/postgrest.conf" &
  POSTGREST_PID=$!
  echo "$POSTGREST_PID" > "$PROJECT_DIR/.postgrest.pid"
  sleep 1

  if curl -s http://127.0.0.1:54321/ > /dev/null 2>&1; then
    echo ""
    echo "Ready! Local dev stack running:"
    echo "  PostgreSQL  → 127.0.0.1:5432"
    echo "  PostgREST   → http://127.0.0.1:54321"
    echo ""
    echo "Run 'npm run dev' to start Next.js"
  else
    echo "PostgREST failed to start. Check logs."
    exit 1
  fi
fi
