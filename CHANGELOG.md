# Changelog

## 2.1.0 — 2026-06-24

### Changed — distribution
- **Switched from GitHub Packages to npm.** The package is now published as [`online-agent`](https://www.npmjs.com/package/online-agent) on the public npm registry. No PAT or `.npmrc` configuration required to install — just `npm i -g online-agent`.
- **GitHub Packages is deprecated.** The old `@thestrongestoftomorrow/onlineagent-connector` package on `npm.pkg.github.com` is frozen at v2.0.0 and will not receive further updates. Existing users should migrate (see README).
- Renamed the CLI binary from `onlineagent` to `online-agent`. The `oac` short alias is unchanged.
- Updated `publishConfig` in `package.json` to point at `https://registry.npmjs.org`.

### Added — trusted publishing
- New `.github/workflows/npm-publish.yml` GitHub Actions workflow publishes to npm on every `v*` tag push, using npm's [provenance](https://docs.npmjs.com/generating-provenance-statements) feature (OIDC trusted publishing). No long-lived npm tokens are stored in the repo; the `NPM_TOKEN` repository secret is a granular access token scoped to just the `online-agent` package.
- README has a new "Publishing a new version (maintainers)" section documenting the `npm version` → `git push --follow-tags` release flow.

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
