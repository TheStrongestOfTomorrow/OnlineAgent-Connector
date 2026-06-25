#!/usr/bin/env bash
# Publish online-agent to BOTH npm and GitHub Packages.
#
# Why both?
#   - npm is the recommended install path for end users (no PAT needed)
#   - GitHub Packages is a fallback for users who can't use npm (e.g. 2FA
#     requirements on trusted publishing) — it just needs a PAT
#
# Same code, same version, two package names:
#   - npm:                    online-agent                            (unscoped)
#   - GitHub Packages:        @thestrongestoftomorrow/online-agent   (scoped, required by GPR)
#
# This script:
#   1. Publishes to npm as-is (package.json has name=online-agent)
#   2. Temporarily rewrites package.json name + publishConfig
#   3. Publishes to GitHub Packages
#   4. Restores the original package.json
#
# Auth setup (one-time, in ~/.npmrc):
#   //registry.npmjs.org/:_authToken=NPM_TOKEN
#   //npm.pkg.github.com/:_authToken=GH_PAT
#
# Usage:
#   ./scripts/publish-both.sh                  # publishes current version
#   ./scripts/publish-both.sh --dry-run        # show what would be published, no actual publish

set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PKG_NAME=$(node -p "require('./package.json').name")
PKG_VERSION=$(node -p "require('./package.json').version")

if [[ "$PKG_NAME" != "online-agent" ]]; then
  echo "Refusing to publish: package.json name is '$PKG_NAME', expected 'online-agent'." >&2
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  Publishing online-agent@$PKG_VERSION"
echo "  npm:               online-agent@$PKG_VERSION"
echo "  GitHub Packages:   @thestrongestoftomorrow/online-agent@$PKG_VERSION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ---------- 1. Publish to npm ----------
echo "▶ [1/2] Publishing to npm (registry.npmjs.org)..."
if [[ $DRY_RUN == 1 ]]; then
  echo "  (dry-run) npm publish --access public"
else
  npm publish --access public
fi
echo "✓ npm publish complete"
echo ""

# ---------- 2. Publish to GitHub Packages ----------
echo "▶ [2/2] Publishing to GitHub Packages (npm.pkg.github.com)..."

# Back up the original package.json
cp package.json package.json.bak

# Rewrite name + publishConfig for GitHub Packages
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.name = '@thestrongestoftomorrow/online-agent';
p.publishConfig = { access: 'public', registry: 'https://npm.pkg.github.com' };
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
console.log('  Rewrote package.json → name=@thestrongestoftomorrow/online-agent');
"

# Always restore the original package.json afterwards, even on failure
trap 'cp package.json.bak package.json && rm package.json.bak && echo "  Restored original package.json"' EXIT

if [[ $DRY_RUN == 1 ]]; then
  echo "  (dry-run) npm publish --access public --registry=https://npm.pkg.github.com"
else
  npm publish --access public --registry=https://npm.pkg.github.com
fi
echo "✓ GitHub Packages publish complete"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Done. Both registries now serve v$PKG_VERSION."
echo "    npm:             https://www.npmjs.com/package/online-agent"
echo "    GitHub Packages: https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector/packages"
echo "═══════════════════════════════════════════════════════════════"
