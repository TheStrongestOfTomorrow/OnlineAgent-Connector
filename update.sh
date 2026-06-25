#!/usr/bin/env bash
# =============================================================================
#  online-agent self-updater
# -----------------------------------------------------------------------------
#  THIS FILE IS THE SINGLE SOURCE OF TRUTH for how to update online-agent.
#
#  When users launch `online-agent`, the built-in AutoUpdater fetches this
#  script from:
#    https://raw.githubusercontent.com/TheStrongestOfTomorrow/OnlineAgent-Connector/main/update.sh
#  (raw.githubusercontent.com is public — no PAT needed)
#
#  It compares the version below with the installed version, and if newer,
#  prompts the user to run this script.
#
#  On every release, this file is REPLACED in the repo with the new version's
#  update logic. Old per-version update scripts are deleted — there is only
#  ever ONE update.sh, always for the latest version.
#
#  Version: 2.3.0
# =============================================================================
set -uo pipefail

# --- The version this script updates TO ---
TARGET_VERSION="2.3.0"

# --- Colors ---
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; NC=''
fi

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  online-agent self-updater → v${TARGET_VERSION}                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# --- Step 1: detect platform ---
OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "${BLUE}[i]${NC} Platform: ${OS} ${ARCH}"

# --- Step 2: check Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}[x]${NC} Node.js is not installed or not on PATH."
  echo -e "    Install Node.js >= 16 from https://nodejs.org/ then re-run this script."
  if [ "$OS" = "Linux" ] && command -v pkg >/dev/null 2>&1; then
    echo -e "    ${YELLOW}(Termux detected: pkg install nodejs)${NC}"
  fi
  exit 1
fi
NODE_VERSION="$(node -p "process.versions.node")"
echo -e "${BLUE}[i]${NC} Node.js: ${NODE_VERSION}"

# --- Step 3: try npm first (no PAT needed) ---
echo ""
echo -e "${BLUE}[i]${NC} Attempting update from npm (no authentication required)..."
if npm install -g "online-agent@${TARGET_VERSION}" 2>&1 | tail -5; then
  # Verify install
  if command -v online-agent >/dev/null 2>&1; then
    INSTALLED="$(online-agent --version 2>/dev/null || echo 'unknown')"
    if [ "$INSTALLED" = "$TARGET_VERSION" ]; then
      echo ""
      echo -e "${GREEN}[+]${NC} Successfully updated to online-agent@${TARGET_VERSION}"
      echo -e "${GREEN}[+]${NC} Run 'online-agent' to launch the TUI."
      exit 0
    fi
  fi
fi
echo -e "${YELLOW}[!]${NC} npm install failed or version mismatch. Falling back to GitHub Packages."

# --- Step 4: fall back to GitHub Packages (needs PAT) ---
if [ -z "${GITHUB_PAT:-}" ]; then
  # Try to read from existing .npmrc
  if [ -f "$HOME/.npmrc" ]; then
    GITHUB_PAT="$(grep -E '^//npm.pkg.github.com/:_authToken=' "$HOME/.npmrc" | head -1 | cut -d= -f2 || true)"
  fi
fi

if [ -n "${GITHUB_PAT:-}" ]; then
  echo ""
  echo -e "${BLUE}[i]${NC} Attempting update from GitHub Packages (using PAT)..."
  # Configure .npmrc
  mkdir -p "$HOME"
  cat > "$HOME/.npmrc.update-tmp" <<EOF
//npm.pkg.github.com/:_authToken=${GITHUB_PAT}
@thestrongestoftomorrow:registry=https://npm.pkg.github.com
EOF
  NPM_CONFIG_USERCONFIG="$HOME/.npmrc.update-tmp" \
    npm install -g "@thestrongestoftomorrow/online-agent@${TARGET_VERSION}" 2>&1 | tail -5
  rm -f "$HOME/.npmrc.update-tmp"

  if command -v online-agent >/dev/null 2>&1; then
    INSTALLED="$(online-agent --version 2>/dev/null || echo 'unknown')"
    if [ "$INSTALLED" = "$TARGET_VERSION" ]; then
      echo ""
      echo -e "${GREEN}[+]${NC} Successfully updated to @thestrongestoftomorrow/online-agent@${TARGET_VERSION}"
      exit 0
    fi
  fi
  echo -e "${YELLOW}[!]${NC} GitHub Packages install also failed."
else
  echo -e "${YELLOW}[!]${NC} No GITHUB_PAT env var or .npmrc auth found. Skipping GitHub Packages."
fi

# --- Step 5: last resort — Docker ---
echo ""
echo -e "${BLUE}[i]${NC} Attempting Docker fallback..."
if command -v docker >/dev/null 2>&1; then
  echo -e "${BLUE}[i]${NC} Docker detected. Pulling the latest image..."
  if docker pull "ghcr.io/thestrongestoftomorrow/online-agent:${TARGET_VERSION}" 2>&1 | tail -3 \
     || docker pull "thestrongestoftomorrow/online-agent:latest" 2>&1 | tail -3; then
    echo ""
    echo -e "${GREEN}[+]${NC} Docker image pulled. Run with:"
    echo -e "    ${BOLD}docker run -it --rm -p 7777:7777 -v \$(pwd):/workspace thestrongestoftomorrow/online-agent:latest${NC}"
    echo ""
    echo -e "${YELLOW}[!]${NC} Note: Docker install does NOT give you the 'online-agent' command on your host."
    echo -e "    You must invoke it via 'docker run' as shown above."
    exit 0
  fi
  echo -e "${YELLOW}[!]${NC} Docker pull failed."
else
  echo -e "${YELLOW}[!]${NC} Docker is not installed."
fi

# --- Step 6: nothing worked ---
echo ""
echo -e "${RED}[x]${NC} All update methods failed. Manual install options:"
echo ""
echo -e "  ${BOLD}Option 1 — npm (easiest, no auth):${NC}"
echo -e "    npm install -g online-agent@latest"
echo ""
echo -e "  ${BOLD}Option 2 — GitHub Packages (needs PAT):${NC}"
echo -e "    Create a PAT with 'read:packages' scope at https://github.com/settings/tokens"
echo -e "    Then add to ~/.npmrc:"
echo -e "      //npm.pkg.github.com/:_authToken=YOUR_PAT"
echo -e "      @thestrongestoftomorrow:registry=https://npm.pkg.github.com"
echo -e "    Then: npm install -g @thestrongestoftomorrow/online-agent@latest"
echo ""
echo -e "  ${BOLD}Option 3 — Docker (no PAT, runs in container):${NC}"
echo -e "    docker run -it --rm -p 7777:7777 -v \$(pwd):/workspace thestrongestoftomorrow/online-agent:latest"
echo ""
echo -e "  ${BOLD}Option 4 — From source:${NC}"
echo -e "    git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git"
echo -e "    cd OnlineAgent-Connector && npm install && npm link"
echo ""
exit 1
