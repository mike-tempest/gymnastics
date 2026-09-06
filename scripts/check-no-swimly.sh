#!/usr/bin/env bash
set -euo pipefail

# Guard: this repo (the gymnastics fork) must never point at a Swimly
# resource. CLAUDE.md, "Relationship to Swimly".
#
# This checks for LIVE ENDPOINTS: deployed domains, hosting accounts, the
# Swimly Railway project, Fly.io apps. It does not police the word "swimly"
# itself; brand strings in copy, seeds, specs and local container names are
# removed by TEM-12 / TEM-13 / TEM-17 and have their own gates.
#
# Run from the repo root: ./scripts/check-no-swimly.sh
# CI runs it on every PR and push to main.

cd "$(dirname "$0")/.."

# Live Swimly endpoints and accounts. If one of these legitimately needs to
# appear somewhere new, that is a deliberate decision: widen the exclusions
# in a reviewed commit, never by deleting the pattern.
PATTERNS=(
  'swimly\.(uk|club|info|app)'         # deployed Swimly domains
  'swimly-(web|membership)\.fly\.dev'  # Swimly Fly.io hostnames
  'app *= *"swimly-'                   # Swimly Fly.io app names in fly.toml
  '26c6f28c-d0ab'                      # Swimly Railway project id
  'ftp\.michaeltempest\.com'           # Swimly marketing FTP host
  'monsieur-clawde'                    # Swimly marketing FTP user
  'mainline\.proxy\.rlwy\.net'         # Swimly production Postgres proxy host
  '5009ceaf'                           # Swimly production DB credential fragment
  'membership-api-production-3628'     # Swimly production API on Railway
  'web-app-production-7a4c'            # Swimly production web app on Railway
)

# Excluded paths:
#   marketing-site/  still carries Swimly site content until TEM-25 reskins it
#                    (its deploy script now refuses to run without explicit
#                    FTP_HOST/USER/PASS, so the content cannot reach Swimly).
#   docs/, *.md      planning docs legitimately discuss Swimly.
#   *.spec.ts, tests/, apps/web/e2e/  mock URLs and fixtures; replaced by
#                    TEM-13 / TEM-17. They never dial out to these hosts.
#   seed files       local demo data, replaced by TEM-17.
EXCLUDES=(
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next
  --exclude-dir=.git --exclude-dir=.turbo --exclude-dir=coverage
  --exclude-dir=marketing-site --exclude-dir=docs --exclude-dir=tests
  --exclude-dir=e2e --exclude-dir=seeds --exclude-dir=seed
  --exclude='*.md' --exclude='*.spec.ts' --exclude='seed*.ts'
  --exclude='check-no-swimly.sh'
)

pattern=$(IFS='|'; echo "${PATTERNS[*]}")

if hits=$(grep -rInE "${EXCLUDES[@]}" -- "$pattern" . 2>/dev/null); then
  echo "ERROR: live Swimly endpoint references found:" >&2
  echo "$hits" >&2
  echo >&2
  echo "This repo must never point at a Swimly resource (CLAUDE.md)." >&2
  exit 1
fi

echo "OK: no live Swimly endpoints referenced."
