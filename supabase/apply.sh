#!/bin/sh
# Apply database migrations to the school Supabase on the VPS.
#
#   sh supabase/apply.sh            # from the repo root, on a machine with `ssh agent-vps`
#
# What it does (stops at the first failure):
#   1. Copies supabase/migrations/*.sql to the server.
#   2. Backs up the database to /opt/supabase-school/backups (gzip, mode 600).
#   3. Applies each migration not yet recorded in app.schema_migrations, each in its own transaction,
#      and records it. Already-applied migrations are skipped.
# Run supabase/tests/rls_test.sql (see the header of that file) after any schema change.
set -eu
HOST=${HOST:-agent-vps}
DIR=/tmp/school-mig
ssh "$HOST" "rm -rf $DIR && mkdir -p $DIR"
scp -q supabase/migrations/*.sql "$HOST:$DIR/"
ssh "$HOST" sh -s <<'REMOTE'
set -eu
DIR=/tmp/school-mig
psqlc() { sudo docker exec -i school-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }
mkdir -p /opt/supabase-school/backups && chmod 700 /opt/supabase-school/backups
f=/opt/supabase-school/backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz
sudo docker exec school-db pg_dump -U postgres -d postgres --no-owner | gzip > "$f"; chmod 600 "$f"; echo "backup: $f"
for path in $(ls $DIR/*.sql | sort); do
  m=$(basename "$path" .sql)
  if [ "$(psqlc -tAc "select 1 from app.schema_migrations where version = '$m'" 2>/dev/null || true)" = "1" ]; then echo "skip  $m"; continue; fi
  { echo "begin;"; cat "$path"; echo "insert into app.schema_migrations (version) values ('$m');"; echo "commit;"; } | psqlc > "$DIR/$m.log" 2>&1 \
    && echo "OK    $m" || { echo "FAIL  $m"; tail -5 "$DIR/$m.log"; exit 1; }
done
REMOTE
