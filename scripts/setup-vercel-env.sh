#!/usr/bin/env bash
# Copies the cloud Supabase settings into the Vercel project (production). The public URL and anon key
# are committed in .env.production; this adds the URL again (harmless) and the secret service key.
# Run from the project root after `npx supabase link` and `npx vercel link`:
#   bash scripts/setup-vercel-env.sh
# Keys go straight from the Supabase CLI to the Vercel CLI and are never printed.
set -euo pipefail

ref=$(cat supabase/.temp/project-ref)
keys=$(npx supabase projects api-keys --project-ref "$ref" -o json 2>/dev/null)
key() { node -e 'const k=JSON.parse(process.argv[1]).find(k=>k.name===process.argv[2]&&k.type==="legacy");process.stdout.write(k.api_key)' "$keys" "$1"; }

add() { # name, value, extra flags
  npx vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  # --yes: the CLI otherwise stops to ask about NEXT_PUBLIC_ names, and the piped value can't answer.
  if out=$(printf %s "$2" | npx vercel env add "$1" production --yes ${3:-} 2>&1); then
    echo "✓ $1"
  else
    echo "✗ $1 — Vercel said:"; echo "$out" | tail -5; exit 1
  fi
}

add NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co"
add SUPABASE_SERVICE_ROLE_KEY "$(key service_role)" --sensitive
echo "Done. Vercel now has the Supabase settings for production."
