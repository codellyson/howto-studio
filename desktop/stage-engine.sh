#!/bin/sh
# Builds the Nuxt app and copies its self-contained server into desktop/engine for the app bundle.
set -e
cd "$(dirname "$0")/.."
npm run build
rm -rf desktop/engine && mkdir -p desktop/engine
cp -R .output desktop/engine/
