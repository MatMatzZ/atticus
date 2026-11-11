#!/usr/bin/env bash
# Assembles supabase/tests/database/qa_*.test.sql = shared fixture prologue + each test body.
set -eu
cd "$(dirname "$0")/../.."
for b in scripts/qa/pgtap-src/*.body.sql; do
  n=$(basename "$b" .body.sql)
  cat scripts/qa/pgtap-src/prologue.sql "$b" > "supabase/tests/database/qa_${n}.test.sql"
done
ls supabase/tests/database/qa_*.test.sql
