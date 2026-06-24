# Changelog

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
