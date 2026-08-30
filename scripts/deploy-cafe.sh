#!/usr/bin/env bash
# Publish the café to nearcoffee.space/room
#
# The live site lives in a separate repo (fahimalamwork/near-coffee-space-site)
# which GitHub Pages serves from main at /. This build goes into room/ there and
# touches nothing else — index.html and CNAME are that site's, not ours.
set -euo pipefail

SITE_REPO="${SITE_REPO:-fahimalamwork/near-coffee-space-site}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> building"
npm run build

echo "==> cloning $SITE_REPO"
gh repo clone "$SITE_REPO" "$WORK/site" -- --depth 1 --quiet

echo "==> replacing room/"
rm -rf "$WORK/site/room"
mkdir -p "$WORK/site/room"
cp -R dist/* "$WORK/site/room/"
touch "$WORK/site/.nojekyll"

cd "$WORK/site"
# Refuse to go further if anything outside room/ has moved. The homepage is
# 3.3MB of someone's actual site; a stray write there is not recoverable by
# "just redeploy".
if git status --porcelain | grep -vE '^\?\? room/|^ ?M room/|^\?\? \.nojekyll|room/' | grep -q .; then
  echo "!! refusing: changes detected outside room/" >&2
  git status --short >&2
  exit 1
fi

if git diff --quiet HEAD -- . && [ -z "$(git status --porcelain)" ]; then
  echo "==> no change, nothing to publish"
  exit 0
fi

git add -A
git commit -q -m "Update the Near Coffee café

Source: github.com/upliftdigitalpartners/near-coffee-visual@$(git -C "$OLDPWD" rev-parse --short HEAD 2>/dev/null || echo local)"
git push -q origin main

echo "==> published: https://www.nearcoffee.space/room/"
