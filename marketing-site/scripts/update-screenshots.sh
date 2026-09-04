#!/usr/bin/env bash
#
# Swimly Screenshot & Mockup Pipeline
# 
# Runs the complete pipeline to capture screenshots from the live app
# and generate device mockups for marketing materials.
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Swimly Screenshot & Mockup Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Ensure we're using the correct Node version
if command -v nvm &> /dev/null; then
  echo "Loading nvm and switching to Node 24..."
  source ~/.nvm/nvm.sh
  nvm use 24
  echo
fi

# Step 1: Capture screenshots
echo "━━━ Step 1: Capturing Screenshots ━━━"
echo
npx tsx scripts/capture-screenshots.ts
echo

# Step 2: Generate mockups
echo "━━━ Step 2: Generating Device Mockups ━━━"
echo
node scripts/generate-mockups.js
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Pipeline Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Screenshots: public/screenshots/"
echo "Mockups:     public/mockups/"
echo
echo "Generated files:"
ls -lh public/screenshots/ | tail -n +2 | wc -l | xargs echo "  Screenshots:"
ls -lh public/mockups/ | tail -n +2 | wc -l | xargs echo "  Mockups:    "
echo
