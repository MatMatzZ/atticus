#!/usr/bin/env bash
# Fail if a secret key could reach a client bundle. Scans tracked files only.
set -u
fail=0

# 1. No secret key anywhere under apps/mobile.
if git grep -nIE 'sb_secret_|SUPABASE_SECRET_KEY' -- apps/mobile; then
  echo "::error::Secret key reference found under apps/mobile"; fail=1
fi

# 2. No NEXT_PUBLIC_* / EXPO_PUBLIC_* variable that is, or holds, a secret.
if git grep -nIE '(NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE)' -- . ':!.github/scripts'; then
  echo "::error::Public env var named like a secret"; fail=1
fi
if git grep -nIE '(NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]+[[:space:]]*[=:][[:space:]]*["'"'"']?(sb_secret_|eyJ)' -- . ':!.github/scripts'; then
  echo "::error::Public env var holds a secret-looking value (sb_secret_ / JWT)"; fail=1
fi
exit $fail
