#!/bin/sh
set -eu
PHASE="$1"
mkdir -p "spec/qa/phase-$PHASE"
npx tsc --noEmit > "spec/qa/phase-$PHASE/typecheck.log" 2>&1
npm run build > "spec/qa/phase-$PHASE/build.log" 2>&1
node tools/qa/capture.mjs "spec/qa/phase-$PHASE" > "spec/qa/phase-$PHASE/browser.log" 2>&1
printf 'Phase %s: typecheck, build and screenshot completed\n' "$PHASE"
