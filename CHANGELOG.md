# Changelog

## 2.3.0 — 2026-06-25

### Added — auto-updater
- New `src/AutoUpdater.js` module. On TUI launch, it fetches `update.sh` from `https://raw.githubusercontent.com/TheStrongestOfTomorrow/OnlineAgent-Connector/main/update.sh` (public — no PAT needed) and compares the version inside with the installed version.
- If a newer version is available, a non-intrusive yellow banner appears at the bottom of the TUI: `⬆ Update available: X → Y  [U] update now  [X] dismiss`.
- Press `U` to download and run `update.sh`, which handles the actual install (npm first → GitHub Packages fallback → Docker last resort). Press `X` to dismiss.
- New `online-agent update` subcommand for manual updates, with `--check-only` and `--force` flags.
- The `update.sh` file in the repo is **replaced on every release**, so there is always exactly one `update.sh` and it always targets the latest version. Old per-version update scripts are deleted — no accumulation.
- The auto-updater is non-blocking — if the fetch fails (offline, repo down), the TUI launches normally without any error.
- This is the recommended way to stay current: users who lost their `.npmrc` or never had one can still update via the auto-updater, since `raw.githubusercontent.com` is public.

### Added — Docker install path (Option C)
- New `Dockerfile` builds a `node:20-slim`-based image with `bash`, `git`, `curl`, and `online-agent` installed globally. Runs as a non-root user.
- New `.github/workflows/docker-publish.yml` builds and publishes the image to **GHCR** (`ghcr.io/thestrongestoftomorrow/online-agent`) on every `v*` tag push and on `main` branch pushes. Multi-arch (`linux/amd64` + `linux/arm64`). Uses `GITHUB_TOKEN` — no extra secrets.
- Image tags: `:latest`, `:2.3.0`, `:2.3`, `:dev`.
- **No PAT needed to pull** — GHCR is public-pull. This is the install path for users who can't (or don't want to) install Node.js or configure a PAT.
- README has a new "Option C — Docker" install section with `docker pull` + `docker run` examples for both interactive (TUI) and headless modes.

### Changed — README restructure
- Top banner now shows **three install paths** (npm / GitHub Packages / Docker) in a comparison table with auth requirements and best-for notes.
- Added a prominent notice that **npm publishing has hard limitations** (2FA / trusted-publishing requirement), explaining why every release is published to all three channels.
- New "Staying up to date — the auto-updater" section documents the background check + manual `online-agent update` subcommand.
- New "Publishing notes" section explains the three-channel strategy without exposing maintainer token setup (that stays in `CONTRIBUTING.md`).
- Removed the old "GitHub Packages is deprecated" framing — GitHub Packages is now clearly framed as the recommended fallback, not a deprecated path.

### Files added
- `update.sh` — self-contained update script (npm → GPR → Docker fallback chain). Replaced on every release.
- `src/AutoUpdater.js` — fetches update.sh, compares versions, runs the script.
- `Dockerfile` — container image definition.
- `.dockerignore` — keeps the Docker build context lean.
- `.github/workflows/docker-publish.yml` — GHCR publishing workflow.

### Files changed
- `bin/cli.js` — added `update` subcommand.
- `src/TuiApp.js` — wires in the background auto-update check + banner UI.
- `README.md` — three-channel install docs, auto-updater docs, publishing notes.
- `package.json` — bumped to 2.3.0.

---

## 2.2.1 — 2026-06-25

### Changed — README clarity on GitHub Packages
- README top banner previously said "GitHub Packages is deprecated" (a leftover from v2.1.0 when we briefly switched to npm-only). This was wrong now that dual-publishing is the policy. The banner now explicitly states **both registries are fully supported, neither is deprecated**.
- Install section's Option B (GitHub Packages) now has a clear warning that **GitHub Packages requires a PAT for all npm installs**, even for public packages — this is a hard GitHub limitation, not a bug in our setup. Users who want zero-auth install should use Option A (npm).
- Clarified that only the OLD package name (`@thestrongestoftomorrow/onlineagent-connector` with a dash) is frozen at v2.0.0; the NEW name (`@thestrongestoftomorrow/online-agent`) is actively maintained and published in sync with npm on every release.

### Note — GitHub Packages visibility (manual step required)
- The GitHub Packages package `@thestrongestoftomorrow/online-agent` is currently `visibility: private` on GitHub's side (this is the default for user-owned packages).
- GitHub does NOT expose an API to change package visibility for user-owned packages — it can only be done via the web UI at: https://github.com/users/TheStrongestOfTomorrow/packages/npm/online-agent/settings → "Change visibility" → Public.
- **Important caveat**: even after making it "public" in the visibility sense, GitHub Packages still requires a `read:packages` PAT for `npm install`. There is no anonymous install path on GitHub Packages. This is a platform limitation, not something we can fix in code. Users who need zero-auth install should use the npm registry (Option A).

---

## 2.2.0 — 2026-06-24

### Added — README "How the AI connects" section
- New comprehensive section in README explaining the full agent-connection flow with an ASCII diagram.
- Three scenarios spelled out with concrete commands and URLs:
  - **Scenario A — Same machine**: AI runs as another local process, connects to `ws://127.0.0.1:7777/`
  - **Scenario B — Same Wi-Fi (LAN)**: AI on another device, start with `--lan`, connect to `ws://192.168.x.x:7777/`
  - **Scenario C — Remote / cloud AI**: AI in the cloud, use cloudflared / ngrok / bore tunnel, connect to `wss://…`
- Step-by-step walkthrough: start server → choose scenario → authenticate → call methods.
- Node.js + Python minimal agent examples (raw WebSocket, no framework needed).
- Quick-reference table for connecting from common AI frameworks (LangChain, AutoGen, MCP, browser JS).
- Removed the older redundant "Connecting AI agents on a different network" section.

### Added — dual publishing (npm + GitHub Packages)
- The package is now published to **both** registries on every release:
  - **npm**: `online-agent` (unscoped, primary, no setup needed to install)
  - **GitHub Packages**: `@thestrongestoftomorrow/online-agent` (scoped, requires PAT in `.npmrc` to install)
- Both contain **exactly the same code** — only the package name differs (GitHub Packages requires scoped names).
- New `scripts/publish-both.sh` script handles the temporary rename + dual publish locally.
- GitHub Actions workflow updated to publish to both registries on `v*` tag push.
- README install section rewritten with **Option A (npm)** and **Option B (GitHub Packages)** side by side, so users who can't use npm (e.g. due to 2FA requirements on trusted publishing) have a working fallback.
- Top-of-README banner updated to reflect dual-registry availability.

### Why dual publishing?
npm's "trusted publisher" (OIDC) feature requires 2FA on the publishing account. Users or maintainers in environments where 2FA isn't usable (locked-down devices, specific browsers, accessibility constraints) can fall back to GitHub Packages, which only requires a Personal Access Token — no 2FA.

---

## 2.1.1 — 2026-06-24

### Changed
- README is now user-only. Moved maintainer publishing docs (release flow, npm token setup, trusted-publishing config) out of README and into a new `CONTRIBUTING.md` that is excluded from the npm tarball. End users no longer see internal release-process details.
- `CONTRIBUTING.md` covers: dev setup, running tests, cutting a release, versioning policy, code style, and filing issues.
- `.npmignore` updated to exclude `CONTRIBUTING.md` from the published package.

---

## 2.1.0 — 2026-06-24

### Changed — distribution
- **Switched from GitHub Packages to npm.** The package is now published as [`online-agent`](https://www.npmjs.com/package/online-agent) on the public npm registry. No PAT or `.npmrc` configuration required to install — just `npm i -g online-agent`.
- **GitHub Packages is deprecated.** The old `@thestrongestoftomorrow/onlineagent-connector` package on `npm.pkg.github.com` is frozen at v2.0.0 and will not receive further updates. Existing users should migrate (see README).
- Renamed the CLI binary from `onlineagent` to `online-agent`. The `oac` short alias is unchanged.
- Updated `publishConfig` in `package.json` to point at `https://registry.npmjs.org`.

### Added — release infrastructure
- New `.github/workflows/npm-publish.yml` workflow publishes to npm on `v*` tag push (with provenance signing).
- New `.github/workflows/ci.yml` runs the test suite on Node 18/20/22 across Linux, Windows, and macOS for every push and PR.
- New `CONTRIBUTING.md` documents the development setup, release flow, and code-style conventions. Intentionally excluded from the npm tarball so end users don't see maintainer docs.

### Migration notes for existing users
1. `npm uninstall -g @thestrongestoftomorrow/onlineagent-connector`
2. Remove the `@thestrongestoftomorrow:registry=` and `//npm.pkg.github.com/:_authToken=` lines from `~/.npmrc`.
3. `npm install -g online-agent`
4. Replace any `onlineagent` invocations with `online-agent` (or use the `oac` alias which is unchanged).

---

## 2.0.0 — 2026-06-24

### Added — TUI
- **Interactive Terminal UI** built with `blessed`. Launch with `onlineagent` (no args) or `onlineagent tui`.
- **First-run onboarding** flow inside the TUI: pick port, bind mode, capabilities, code length, working directory. Persists to `~/.onlineagent/config.json`; subsequent launches skip onboarding and go straight to the dashboard.
- **Dashboard with 6 tabs:**
  - `1 Status` — server info, pairing code, URL, connected agents, agent progress bars, system snapshot
  - `2 Chat` — live view of agent messages; type replies when an agent calls `agent.ask`
  - `3 Logs` — raw server log stream
  - `4 Tools` — list of all methods exposed to agents
  - `5 Settings` — current config & quick-action keys
  - `6 Help` — full usage reference

### Added — AI talks back to the user (the magic part)
- **`agent.message`** — agent pushes a chat message to the TUI; appears in the Chat tab in real time.
- **`agent.ask`** — agent asks the user a question; the prompt appears in the Chat tab; the user's typed reply is delivered back to the agent as the JSON-RPC result. **No website needed.**
- **`agent.notify`** — desktop notification (cross-platform: `notify-send` on Linux, `osascript` on macOS, `termux-notification` on Termux, PowerShell toast on Windows).
- **`agent.progress`** — agent updates a status line / progress bar in the TUI.

### Added — 37 new tools (53 methods total, up from 16)
- **Processes:** `proc.list`, `proc.kill`, `proc.tree`, `proc.me`
- **Network:** `net.http` (HTTP/HTTPS client), `net.dns`, `net.ping`, `net.ip`
- **Git:** `git.status`, `git.diff`, `git.log`, `git.branches`, `git.add`, `git.commit`, `git.show`, `git.revParse`
- **Search:** `search.files` (glob), `search.grep` (regex content scan), `search.find`
- **Env vars:** `env.get`, `env.list`, `env.set`, `env.unset`
- **Clipboard:** `clip.read`, `clip.write` (auto-detects `pbcopy`/`xclip`/`wl-copy`/`termux-clipboard-set`/PowerShell)
- **Crypto:** `crypto.hash`, `crypto.uuid`, `crypto.random`, `crypto.hmac`, `crypto.base64Encode`, `crypto.base64Decode`
- **Time:** `time.now`, `time.sleep`

### Added — Config & UX
- New `Config` module persists settings to `~/.onlineagent/config.json` (or `%USERPROFILE%\.onlineagent\config.json` on Windows).
- New `tui` subcommand for explicitly launching the TUI.
- Default action (no subcommand) is now the TUI.
- All tests pass: smoke (7), e2e (9), tools (20), interaction (6) = **42 assertions**.

### Changed
- Bumped version to 2.0.0
- Added `blessed` as a dependency
- `/info` HTTP endpoint now returns methods grouped by category instead of a flat list
- `agent.ask` no longer blocks indefinitely on non-TTY stdin; falls back to `defaultResponse` on timeout

---

## 1.0.0 — 2026-06-24

### Added
- Initial release of **OnlineAgent-Connector**.
- Cross-platform CLI (`onlineagent` / `oac`) with subcommands: `start`, `code`, `status`, `stop`, `info`.
- Local HTTP + WebSocket server with JSON-RPC 2.0 protocol for AI agents.
- Pairing-code authentication (default: 6-digit, 30-minute TTL).
- Cross-platform support: Windows (PowerShell/cmd), Linux, macOS, FreeBSD, OpenBSD, and Android (Termux).
- Sandboxed file system API: `fs.read`, `fs.write`, `fs.list`, `fs.stat`, `fs.rm`, `fs.mkdir`, `fs.rename`, `fs.copy`, `fs.tree`.
- Shell execution API: `shell.exec` with timeout, max-output, and capability gating.
- System info API: `sys.info`, `sys.diskUsage`.
- Capability flags: `--allow-shell` / `--no-shell`, `--allow-write` / `--no-write`.
- LAN mode (`--lan`) for agents on the same Wi-Fi.
- Tunnel hints (`--tunnel`) for cloudflared / ngrok / bore.
- Example agent clients in Node.js (`examples/node-agent.js`) and Python (`examples/python-agent.py`).
- State file for `onlineagent status` / `onlineagent stop`.
- Smoke test suite: `npm test`.
