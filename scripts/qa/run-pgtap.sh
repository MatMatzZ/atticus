#!/usr/bin/env bash
# Runs every supabase/tests/database/qa_*.test.sql against the local Supabase DB container
# (fallback for when `npx supabase test db` cannot pull the pg_prove image).
# Each file is wrapped in BEGIN..ROLLBACK, so no data is left behind.
set -u
cd "$(dirname "$0")/../.."
status=0
for f in supabase/tests/database/qa_*.test.sql; do
  echo "# ===== $f"
  docker exec -i supabase_db_atticus psql -U postgres -X -tA -q < "$f" 2>&1 | tee ".qa-last-$(basename "$f").tap" | grep -E '^(not ok|ok|# (Failed|Looks|have|want)|ERROR|psql:)' | grep -vE '^ok' || true
  grep -q '^not ok' ".qa-last-$(basename "$f").tap" && status=1
  echo "# passed: $(grep -c '^ok' ".qa-last-$(basename "$f").tap")  failed: $(grep -c '^not ok' ".qa-last-$(basename "$f").tap")"
done
exit $status
