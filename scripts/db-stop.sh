#!/usr/bin/env bash
# Stop local PostgreSQL + PostgREST
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="$HOME/scoop/apps/postgresql/current/bin:$PATH"
export PGDATA="$HOME/scoop/apps/postgresql/current/data"

# Stop proxy
if [ -f "$PROJECT_DIR/.proxy.pid" ]; then
  PID=$(cat "$PROJECT_DIR/.proxy.pid")
  kill "$PID" 2>/dev/null && echo "Proxy stopped." || echo "Proxy was not running."
  rm -f "$PROJECT_DIR/.proxy.pid"
else
  echo "No proxy PID file found."
fi

# Stop PostgREST
if [ -f "$PROJECT_DIR/.postgrest.pid" ]; then
  PID=$(cat "$PROJECT_DIR/.postgrest.pid")
  kill "$PID" 2>/dev/null && echo "PostgREST stopped." || echo "PostgREST was not running."
  rm -f "$PROJECT_DIR/.postgrest.pid"
else
  echo "No PostgREST PID file found."
fi

# Stop PostgreSQL
if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  pg_ctl stop -w
  echo "PostgreSQL stopped."
else
  echo "PostgreSQL was not running."
fi
