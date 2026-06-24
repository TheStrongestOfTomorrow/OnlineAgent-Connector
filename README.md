# OnlineAgent-Connector

> Cross-platform Terminal CLI that hosts a **local server** on your machine so **AI agents** can connect to it by entering a **pairing code**.
> Works on **Windows, Linux, macOS, FreeBSD, OpenBSD, and Android (Termux)**. Installable as an **npm package from GitHub Packages**.

```
  ╔══════════════════════════════════════════════════════╗
  ║   OnlineAgent-Connector                              ║
  ║   Local hosting for AI agents · pairing-code auth    ║
  ║   Running on: Linux (x64)                            ║
  ╚══════════════════════════════════════════════════════╝

  [+] Server listening on 127.0.0.1:7777
  [i] Pairing code (expires in 30 min):

      ┌──────────────────────┐
      │  4  8  1  2  9  3    │
      └──────────────────────┘

  [i] Local WebSocket URL:  ws://127.0.0.1:7777/
  [i] Press Ctrl+C to stop the server.
```

---

## Why

Modern AI agents (Claude, GPT, open-source LLMs, agent frameworks like LangChain / AutoGen / MCP clients) are great at *reasoning* but bad at *acting on your machine* — they live in the cloud and have no way to reach your local files, shell, or terminal.

**OnlineAgent-Connector** fixes this. It runs a tiny local server on whatever machine you're on (laptop, Raspberry Pi, Android phone via Termux) and gives your AI agent a safe, authenticated bridge to:

- Run shell commands on your machine (`shell.exec`)
- Read and write files inside a working directory (`fs.read`, `fs.write`, …)
- Inspect the system (`sys.info`, `sys.diskUsage`)
- List and manage running agents (`agent.list`)

The agent connects over WebSocket using JSON-RPC 2.0 and authenticates with the short **pairing code** displayed in your terminal. No port forwarding, no cloud account, no agent-side install — just type the code.

---

## Install

### From GitHub Packages (recommended)

**1. Authenticate to GitHub Packages** (one-time, per machine). Create a Personal Access Token with `read:packages` scope at https://github.com/settings/tokens and add this to `~/.npmrc` (Linux/macOS/Termux) or `%USERPROFILE%\.npmrc` (Windows):

```ini
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
@thestrongestoftomorrow:registry=https://npm.pkg.github.com
```

**2. Install globally:**

```bash
npm install -g @thestrongestoftomorrow/onlineagent-connector
```

You now have two commands on your PATH: `onlineagent` and `oac` (short alias).

### Run without installing (npx)

```bash
npx @thestrongestoftomorrow/onlineagent-connector start
```

### From source (for development)

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm link        # makes `onlineagent` available globally on your dev machine
```

---

## Platform notes

| Platform | Shell used | Notes |
|---|---|---|
| **Windows** | PowerShell (falls back to `cmd.exe`) | Use Git Bash / WSL for POSIX-flavored commands. |
| **macOS** | `/bin/bash` (or `$SHELL`) | Works out of the box. |
| **Linux** | `/bin/bash` (or `$SHELL`) | Works on any modern distro. |
| **FreeBSD / OpenBSD** | `/bin/sh` | Tested on FreeBSD 13+ via `os` field in package.json. |
| **Android (Termux)** | `/data/data/com.termux/files/usr/bin/bash` | Install Termux from F-Droid, then `pkg install nodejs`. State lives under `~/.onlineagent/`. |

Node.js ≥ 16 is required on every platform.

### Termux quick-start

```bash
# 1. Install Termux from F-Droid (NOT Google Play — that version is outdated)
# 2. Inside Termux:
pkg update && pkg install nodejs git
npm install -g @thestrongestoftomorrow/onlineagent-connector
onlineagent start --port 7777
```

You can then point an AI agent at `ws://127.0.0.1:7777/` from the same phone (e.g. running another Node.js script in Termux), or use `--lan` to expose it to other devices on your Wi-Fi.

---

## Usage

### Start the server

```bash
onlineagent start
# or, with options:
onlineagent start --port 8080 --lan --qr
```

Options:

| Flag | Default | Description |
|---|---|---|
| `-p, --port <port>` | `7777` | TCP port to listen on. |
| `-H, --host <host>` | `127.0.0.1` | Hostname / interface to bind. |
| `--lan` | off | Bind to `0.0.0.0` so agents on the same Wi-Fi can connect. |
| `--cwd <dir>` | current directory | Working directory the agent is sandboxed to. |
| `--code <code>` | random 6-digit | Use a specific pairing code. |
| `--allow-shell` / `--no-shell` | `--allow-shell` | Enable/disable shell execution. |
| `--allow-write` / `--no-write` | `--allow-write` | Enable/disable file writes. |
| `--tunnel` | off | Print cloudflared / ngrok / bore hints for remote agents. |
| `--qr` | off | Print the connection URL as a QR-friendly payload. |
| `--quiet` | off | Reduce log output. |

### Other subcommands

```bash
onlineagent code      # re-display the current pairing code
onlineagent status    # show running server info
onlineagent stop      # stop a running server
onlineagent info      # print environment diagnostics (for bug reports)
onlineagent --version
```

---

## How an AI agent connects

The agent speaks **JSON-RPC 2.0 over WebSocket**. The first message must be an `auth` request containing the pairing code.

```js
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:7777/');

ws.on('open', () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: '1', method: 'auth',
    params: { code: '481293', agentId: 'my-agent' }
  }));
});

ws.on('message', (buf) => {
  const msg = JSON.parse(buf.toString());
  console.log(msg);
  // After auth succeeds, send any method:
  // ws.send(JSON.stringify({ jsonrpc:'2.0', id:'2', method:'shell.exec', params:{ command:'ls -la' } }));
});
```

Run the included example:

```bash
node examples/node-agent.js ws://127.0.0.1:7777/ 481293
```

…or the Python one:

```bash
pip install websocket-client
python examples/python-agent.py ws://127.0.0.1:7777/ 481293
```

---

## Protocol reference

All requests follow JSON-RPC 2.0:

```json
{ "jsonrpc": "2.0", "id": "1", "method": "<name>", "params": { ... } }
```

### Methods that don't require prior auth

| Method | Params | Returns |
|---|---|---|
| `ping` | — | `{ pong: true, serverTime, serverId }` |
| `auth` | `{ code, agentId? }` | `{ ok, agentId, serverId }` |

### Methods that require prior auth

| Method | Params | Returns |
|---|---|---|
| `agent.whoami` | — | `{ agentId, serverId }` |
| `agent.list` | — | `{ agents: [...], count }` |
| `sys.info` | — | full system snapshot (CPU, memory, network, etc.) |
| `sys.diskUsage` | — | disk usage of the working directory |
| `shell.exec` | `{ command, cwd?, env?, timeoutMs?, stdin? }` | `{ ok, exitCode, stdout, stderr, durationMs, timedOut }` |
| `fs.read` | `{ path, encoding? }` | `{ path, size, mtime, content }` |
| `fs.write` | `{ path, content, mode? }` | `{ path, size, mtime }` |
| `fs.list` | `{ path? }` | `{ path, entries: [{ name, path, type, size, mtime }] }` |
| `fs.stat` | `{ path }` | `{ path, size, mtime, isFile, isDir, ... }` |
| `fs.rm` | `{ path, recursive? }` | `{ path, removed }` |
| `fs.mkdir` | `{ path, recursive? }` | `{ path, created }` |
| `fs.rename` | `{ from, to }` | `{ from, to, renamed }` |
| `fs.copy` | `{ from, to }` | `{ from, to, copied }` |
| `fs.tree` | `{ path?, maxDepth? }` | `{ root, entries: [{ path, type }] }` |

Errors follow JSON-RPC:

```json
{ "jsonrpc": "2.0", "id": "1", "error": { "code": -32601, "message": "Method not found: foo" } }
```

| Code | Meaning |
|---|---|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |
| `-32000` | Unauthorized (bad/missing pairing code) |
| `-32001` | Capability disabled (e.g. `--no-shell`) |

---

## Security model

- The pairing code is the **only** secret. Anyone with the code can run commands in the working directory of the server. Treat it like a password.
- Codes are **30-minute-lived** and **cryptographically random** (6 digits by default).
- All file operations are **sandboxed** to the working directory (`--cwd`); path escapes via `..` or absolute paths are rejected.
- Shell execution has a **hard 5-minute max timeout** and a **4 MiB output cap** per command.
- The server binds to `127.0.0.1` by default — only your local machine can connect. Use `--lan` to expose it on your Wi-Fi, and `--tunnel` for public access (then you *must* keep the code secret).
- Disable risky capabilities when you don't need them: `--no-shell` or `--no-write`.
- The first message on every WebSocket must be `auth`. Unauthenticated connections are closed after 5 seconds.

---

## Programmatic API

You can also use the connector as a library:

```js
const { startServer } = require('@thestrongestoftomorrow/onlineagent-connector');

const server = await startServer({
  host: '127.0.0.1',
  port: 7777,
  cwd: process.cwd(),
  capabilities: { shell: true, write: true },
  // code: '123456',           // optional — random by default
});

// server.auth.code    -> the pairing code
// server.serverId     -> unique server id
await server.stop();           // graceful shutdown
```

---

## Connecting AI agents on a different network

By default the server listens on `127.0.0.1`, which means only agents on the same machine can connect. For agents on a different network, pick one:

| Option | Command | When to use |
|---|---|---|
| **Same Wi-Fi** | `onlineagent start --lan` | Phone → laptop, two laptops on home Wi-Fi. |
| **cloudflared** (free, no signup) | `cloudflared tunnel --url http://localhost:7777` | Remote agent, public URL, fast. |
| **ngrok** | `ngrok http 7777` | Remote agent, you have an ngrok account. |
| **bore.pub** | `bore local 7777 --to bore.pub` | Remote agent, simple, no signup. |

When using a tunnel, give the AI agent the `wss://` (secure WebSocket) URL the tunnel prints, and the same pairing code.

> **Warning:** with a tunnel, anyone who guesses your 6-digit code can run shell commands on your machine. Either:
> - Use `--code` to set a long alphanumeric code, **or**
> - Run with `--no-shell --no-write` so the agent can only *read* & *list* files.

---

## Publishing a new version (maintainers)

This package is configured for **GitHub Packages**. To publish:

```bash
# 1. Authenticate (one-time)
echo "//npm.pkg.github.com/:_authToken=YOUR_PAT_WITH_WRITE:packages_SCOPE" >> ~/.npmrc

# 2. Bump version
npm version patch      # or minor / major

# 3. Publish
npm publish
```

The `publishConfig` in `package.json` already points to `https://npm.pkg.github.com`, and the package is scoped to `@thestrongestoftomorrow` so it lands in the right place automatically.

---

## Development

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm test                  # run smoke tests
npm start                 # start the server in dev mode
```

Project layout:

```
onlineagent-connector/
├── bin/
│   └── cli.js              # CLI entry point (commander.js)
├── src/
│   ├── index.js            # public API
│   ├── Server.js           # HTTP + WebSocket server
│   ├── AuthManager.js      # pairing code generation & validation
│   ├── AgentProtocol.js    # JSON-RPC 2.0 method dispatch
│   ├── CommandExecutor.js  # cross-platform shell execution
│   ├── FileSystemAPI.js    # sandboxed file operations
│   ├── SystemInfo.js       # system & disk info
│   ├── Platform.js         # platform detection (Windows/Linux/macOS/Termux)
│   └── Logger.js           # ANSI-colored logger
├── examples/
│   ├── node-agent.js       # interactive Node.js agent client
│   └── python-agent.py     # interactive Python agent client
├── tests/
│   └── basic.test.js       # smoke tests
├── package.json
├── LICENSE
└── README.md
```

---

## License

MIT © TheStrongestOfTomorrow
