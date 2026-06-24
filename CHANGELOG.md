# Changelog

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
