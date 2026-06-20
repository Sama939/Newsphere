#!/usr/bin/env bash
# Regenerate news.json and publish it to the nginx web root (atomic swap, so a
# reader never sees a half-written file). Run by the systemd timer every 15 min.
set -euo pipefail

REPO="${NEWSPHERE_REPO:-/opt/newsphere}"
WEBROOT="${NEWSPHERE_WEBROOT:-/var/www/newsphere-data}"

cd "$REPO"

# Put the venv's python3 first on PATH so fetch-news.mjs (which shells out to
# `python3`) uses our installed transformers/torch/sentencepiece.
export PATH="$REPO/.venv/bin:$PATH"

# Keep code up to date (no-op if already current). Won't fail the run if offline.
git pull --quiet --ff-only || true

# Run the pipeline — writes public/data/news.json.
node scripts/fetch-news.mjs

# Publish atomically.
install -d "$WEBROOT"
cp "$REPO/public/data/news.json" "$WEBROOT/news.json.tmp"
mv -f "$WEBROOT/news.json.tmp" "$WEBROOT/news.json"

echo "[update-news] published $(date -u +%FT%TZ)"
