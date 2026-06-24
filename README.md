# OnlineAgent-Connector

> Cross-platform Terminal CLI that hosts a **local server** on your machine so **AI agents** can connect to it by entering a **pairing code**.
> Works on **Windows, Linux, macOS, FreeBSD, OpenBSD, and Android (Termux)**. Installable from **npm** as [`online-agent`](https://www.npmjs.com/package/online-agent).
>
> ⚠️ **GitHub Packages is deprecated as of v2.1.** The old `@thestrongestoftomorrow/onlineagent-connector` package on GitHub Packages is frozen at v2.0.0 and will not receive further updates. **Please switch to `online-agent` on npm** — see [Install](#install) below.

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

### From npm (recommended)

```bash
npm install -g online-agent
```

That's it — no PAT, no `.npmrc` edits, no scoped registry. You now have two commands on your PATH:

- `online-agent` (primary)
- `oac` (short alias)

### Run without installing (npx)

```bash
npx online-agent
```

> **Migrating from GitHub Packages?** The old `@thestrongestoftomorrow/onlineagent-connector` package (frozen at v2.0.0) is deprecated. To migrate:
>
> 1. `npm uninstall -g @thestrongestoftomorrow/onlineagent-connector`
> 2. Remove the `@thestrongestoftomorrow:registry=` and `//npm.pkg.github.com/:_authToken=` lines from `~/.npmrc` (no longer needed).
> 3. `npm install -g online-agent`
> 4. Replace any `onlineagent` command invocations with `online-agent` (the `oac` alias is unchanged).

### From source (for development)

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm link        # makes `online-agent` available globally on your dev machine
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
npm install -g online-agent
online-agent start --port 7777
```

You can then point an AI agent at `ws://127.0.0.1:7777/` from the same phone (e.g. running another Node.js script in Termux), or use `--lan` to expose it to other devices on your Wi-Fi.

---

## Usage

### The TUI (default)

Just type `onlineagent` (no args). The first time, you get onboarding:

```
╔══════════════════════════════════════════════════════╗
║   Welcome to OnlineAgent-Connector v2.0.0              ║
║   Local hosting for AI agents · TUI edition            ║
╚══════════════════════════════════════════════════════╝

This onboarding runs only once. After this, just type `onlineagent` to launch the dashboard.

TCP port to listen on:    [7777]
Bind mode: [L]ocalhost only   [N]LAN (other devices on Wi-Fi can connect)
Capabilities:
   [x] Allow shell.exec (run commands)
   [x] Allow fs.write (modify files)
Pairing code length: [4] 4-digit  [6] 6-digit (default)  [8] 8-digit
Working directory (the agent is sandboxed here): /home/you/projects/foo

Tab to navigate · Enter on a field to edit · S to save & start · Q or Esc to quit
```

After saving, the dashboard launches. On every subsequent run, typing `onlineagent` skips onboarding and goes straight to the dashboard.

The dashboard has 6 tabs (keys `1`-`6`):

| Tab | What it shows |
|---|---|
| `1 Status` | Server state, pairing code, connection URLs, connected agents, agent progress bars, system snapshot |
| `2 Chat` | **Live view of agent messages.** When an agent calls `agent.ask`, the prompt shows here; type your reply + Enter — it goes back to the agent as the JSON-RPC result. |
| `3 Logs` | Raw server log stream |
| `4 Tools` | All 53 methods exposed to agents, grouped by category |
| `5 Settings` | Current config & quick-action keys (r = regenerate code, s = start/stop, l = toggle LAN, etc.) |
| `6 Help` | Full usage reference |

Global keys: `1-6` switch tabs · `r` regenerate pairing code · `s` start/stop server · `q` / `Ctrl-C` quit.

### Start the server (no TUI)

For headless / scripted use, you can skip the TUI:

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
onlineagent tui       # explicitly launch the TUI (same as no args)
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

## The AI talks back to you (the magic part)

The headline feature of v2.0. Once an agent is connected, it doesn't have to silently do things — it can talk to you directly in your terminal:

| Method | What it does | What you see |
|---|---|---|
| `agent.message` | Push a chat message | Text appears in the **Chat** tab |
| `agent.ask` | Ask you a question | Prompt appears in the **Chat** tab; your typed reply goes back as the JSON-RPC result |
| `agent.notify` | Desktop notification | Native toast (`notify-send`/`osascript`/`termux-notification`/PowerShell) + in-TUI banner |
| `agent.progress` | Status update | Progress bar / status line in the **Status** tab |

Example: an AI agent could do this:

```js
// 1. Tell the user what it's about to do
ws.send(JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'agent.message',
  params: { text: 'I'm going to look at your package.json now.', level: 'info' } }));

// 2. Update the progress bar
ws.send(JSON.stringify({ jsonrpc: '2.0', id: '2', method: 'agent.progress',
  params: { status: 'reading package.json', percent: 25 } }));

const r = await readPackageJson();  // (using fs.read)

// 3. Ask the user a question — they answer in the TUI, the answer comes back here
ws.send(JSON.stringify({ jsonrpc: '2.0', id: '3', method: 'agent.ask',
  params: { prompt: 'Should I bump the version to 2.1.0?', defaultResponse: 'yes', timeoutMs: 60000 } }));
// (the JSON-RPC result contains { answered: true, response: 'yes' })
```

No website, no Slack, no switching apps — the entire AI ↔ human loop happens inside the terminal.

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

#### Agent interaction (the AI talks back to you)

| Method | Params | Returns |
|---|---|---|
| `agent.whoami` | — | `{ agentId, serverId }` |
| `agent.list` | — | `{ agents: [...], count }` |
| `agent.message` | `{ text, level? }` | `{ delivered, timestamp }` — pushes a chat message to the TUI |
| `agent.ask` | `{ prompt, defaultResponse?, timeoutMs? }` | `{ answered, response, timedOut? }` — blocks until user replies in the TUI |
| `agent.notify` | `{ title?, body, urgency? }` | `{ shown, backend, error? }` — desktop notification |
| `agent.progress` | `{ status?, percent? }` | `{ updated }` — updates the TUI status line |

#### System

| Method | Params | Returns |
|---|---|---|
| `sys.info` | — | full system snapshot (CPU, memory, network, etc.) |
| `sys.diskUsage` | — | disk usage of the working directory |

#### Shell

| Method | Params | Returns |
|---|---|---|
| `shell.exec` | `{ command, cwd?, env?, timeoutMs?, stdin? }` | `{ ok, exitCode, stdout, stderr, durationMs, timedOut }` |

#### Filesystem (sandboxed to `cwd`)

| Method | Params | Returns |
|---|---|---|
| `fs.read` | `{ path, encoding? }` | `{ path, size, mtime, content }` |
| `fs.write` | `{ path, content, mode? }` | `{ path, size, mtime }` |
| `fs.list` | `{ path? }` | `{ path, entries: [...] }` |
| `fs.stat` | `{ path }` | `{ path, size, mtime, isFile, isDir, ... }` |
| `fs.rm` | `{ path, recursive? }` | `{ path, removed }` |
| `fs.mkdir` | `{ path, recursive? }` | `{ path, created }` |
| `fs.rename` | `{ from, to }` | `{ from, to, renamed }` |
| `fs.copy` | `{ from, to }` | `{ from, to, copied }` |
| `fs.tree` | `{ path?, maxDepth? }` | `{ root, entries: [{ path, type }] }` |

#### Processes

| Method | Params | Returns |
|---|---|---|
| `proc.list` | `{ limit?, sortBy? }` | `{ processes: [...], count }` |
| `proc.kill` | `{ pid, signal? }` | `{ pid, signal, killed }` |
| `proc.tree` | `{ pid, maxDepth? }` | `{ root, children: [...] }` |
| `proc.me` | — | connector's own process info |

#### Network

| Method | Params | Returns |
|---|---|---|
| `net.http` | `{ url, method?, headers?, body?, timeoutMs?, json? }` | `{ ok, status, headers, body, json?, durationMs }` |
| `net.dns` | `{ hostname, recordType? }` | `{ hostname, recordType, records }` |
| `net.ping` | `{ host, count? }` | `{ host, count, output, ok }` |
| `net.ip` | — | `{ interfaces: [...] }` |

#### Git (operates in `cwd`)

| Method | Params | Returns |
|---|---|---|
| `git.status` | — | `{ branch, status }` |
| `git.diff` | `{ staged?, pathspec? }` | `{ diff }` |
| `git.log` | `{ limit?, format? }` | `{ commits: [...], count }` |
| `git.branches` | `{ remote? }` | `{ branches: [...], count }` |
| `git.add` | `{ paths? }` | `{ added, output }` |
| `git.commit` | `{ message }` | `{ committed, output }` |
| `git.show` | `{ ref? }` | `{ ref, output }` |
| `git.revParse` | `{ ref? }` | `{ ref, sha }` |

#### Search

| Method | Params | Returns |
|---|---|---|
| `search.files` | `{ pattern?, path?, maxDepth? }` | `{ pattern, count, files: [...] }` |
| `search.grep` | `{ pattern, path?, maxResults?, ignoreCase? }` | `{ pattern, count, matches: [...] }` |
| `search.find` | alias for `search.files` | — |

#### Environment variables

| Method | Params | Returns |
|---|---|---|
| `env.get` | `{ name }` | `{ name, exists, value }` |
| `env.list` | `{ prefix? }` | `{ count, vars: [...] }` |
| `env.set` | `{ name, value }` | `{ name, value, set }` |
| `env.unset` | `{ name }` | `{ name, unset }` |

#### Clipboard

| Method | Params | Returns |
|---|---|---|
| `clip.read` | — | `{ content, backend }` |
| `clip.write` | `{ content }` | `{ written, length, backend }` |

#### Crypto

| Method | Params | Returns |
|---|---|---|
| `crypto.hash` | `{ algorithm?, input, encoding? }` | `{ algorithm, digest, length }` |
| `crypto.uuid` | — | `{ uuid }` |
| `crypto.random` | `{ bytes?, encoding? }` | `{ bytes, encoding, value }` |
| `crypto.hmac` | `{ algorithm?, key, message, encoding? }` | `{ algorithm, digest }` |
| `crypto.base64Encode` | `{ input }` | `{ encoded }` |
| `crypto.base64Decode` | `{ input }` | `{ decoded }` |

#### Time

| Method | Params | Returns |
|---|---|---|
| `time.now` | `{ timezone? }` | `{ iso, epochMs, local, components }` |
| `time.sleep` | `{ ms }` | `{ sleptMs, requestedMs, capped }` |

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
const { startServer } = require('online-agent');

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

## For maintainers & contributors

If you're contributing to the project or cutting a release, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development setup, test suite, release flow, project layout, and code-style conventions.

---

## Development (quick start)

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm test                  # run all 4 test suites (42 assertions)
npm start                 # launch the TUI in dev mode
```

---

## License

MIT © TheStrongestOfTomorrow
