#!/bin/sh
# Builds the Mac app signed for the updater and publishes it as a GitHub release with latest.json,
# which installed copies read on launch to offer the update.
#   sh desktop/release.sh            build only, into desktop/target/release/bundle
#   sh desktop/release.sh --publish  build, then create the release for the version in tauri.conf.json
set -e
cd "$(dirname "$0")"
VERSION=$(node -p "require('./tauri.conf.json').version")
KEY="$HOME/.tauri/howto-studio.key"
[ -f "$KEY" ] || { echo "No updater key at $KEY"; exit 1; }

TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  RUSTFLAGS="--remap-path-prefix=$HOME=/build" cargo tauri build --bundles app,dmg

BUNDLE=target/release/bundle
APP_TAR="$BUNDLE/macos/How-to Studio.app.tar.gz"
DMG=$(ls "$BUNDLE"/dmg/*.dmg | head -1)
OUT=target/release/upload
rm -rf "$OUT" && mkdir -p "$OUT"
cp "$APP_TAR" "$OUT/How-to-Studio.app.tar.gz"
cp "$DMG" "$OUT/How-to-Studio.dmg"
# The username must not ship inside the binary.
! strings "$BUNDLE/macos/How-to Studio.app/Contents/MacOS/howto-studio" | grep -q "$(whoami)" || { echo "Username found in binary"; exit 1; }

node -e "
const fs = require('fs');
fs.writeFileSync('$OUT/latest.json', JSON.stringify({
  version: '$VERSION',
  notes: 'How-to Studio $VERSION',
  pub_date: new Date().toISOString(),
  platforms: { 'darwin-aarch64': {
    signature: fs.readFileSync('$APP_TAR.sig', 'utf8').trim(),
    url: 'https://github.com/codellyson/howto-studio/releases/download/v$VERSION/How-to-Studio.app.tar.gz',
  } },
}, null, 2));
"
echo "Built $VERSION in $OUT"
[ "$1" = "--publish" ] || exit 0
gh release create "v$VERSION" -R codellyson/howto-studio --title "How-to Studio $VERSION" --notes "Mac app for Apple silicon. Installed copies from this version on update themselves." \
  "$OUT/How-to-Studio.dmg" "$OUT/How-to-Studio.app.tar.gz" "$OUT/latest.json"
