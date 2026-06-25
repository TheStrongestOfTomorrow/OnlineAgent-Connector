# OnlineAgent-Connector

> Cross-platform Terminal CLI that hosts a **local server** on your machine so **AI agents** can connect to it by entering a **pairing code**.
> Works on **Windows, Linux, macOS, FreeBSD, OpenBSD, and Android (Termux)**.
>
> **Three install paths — pick whichever you can access:**
>
> | # | Method | Auth needed | Best for |
> |---|---|---|---|
> | **A** | **npm** — `npm i -g online-agent` | None | Most users. Easiest, zero setup. |
> | **B** | **GitHub Packages** — `npm i -g @thestrongestoftomorrow/online-agent` | GitHub PAT (`read:packages`) | Fallback when npm is blocked / unavailable / 2FA-locked. |
> | **C** | **Docker** — `docker run … thestrongestoftomorrow/online-agent` | None | No PAT, no Node.js install — runs in a container. |
>
> ⚠️ **npm publishing has hard limitations (2FA / trusted-publishing requirement).** For *installing* `online-agent`, npm is the easiest path. But for *publishing* new versions, npm's "trusted publisher" (OIDC) feature requires 2FA on the publishing account, which not all maintainers can use. As a result, **every release is published to all three channels** (npm + GitHub Packages + Docker) so the project never gets stuck if npm publishing breaks. See [Publishing notes](#publishing-notes) below.
>
> 🔄 **Built-in auto-updater.** Every time you launch `online-agent`, it silently checks `raw.githubusercontent.com` (public, no PAT needed) for a new version. If one is available, a banner appears in the TUI — press `U` to update, `X` to dismiss. You can also run `online-agent update` manually. This is the recommended way to stay current — no `.npmrc` wrangling required.

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

`online-agent` is published to **two registries** with the same content. Pick whichever you can access — both give you the exact same code.

### Option A — npm (recommended, no setup)

```bash
npm install -g online-agent
```

That's it. No PAT, no `.npmrc` edits. The binary is now on your PATH as:
- `online-agent` (primary)
- `oac` (short alias)

### Option B — GitHub Packages (use this if npm is blocked / 2FA-locked / unavailable)

The package is mirrored to GitHub Packages as `@thestrongestoftomorrow/online-agent` (scoped name — GitHub Packages requires this). It contains **exactly the same code**, just published under a different name because GitHub Packages requires packages to be scoped to an org/user.

> ⚠️ **GitHub Packages requires a PAT for ALL npm installs**, even for public packages. This is a hard GitHub limitation — there is no anonymous install path. You only need a `read:packages` scope token (free, no write access). If that's a dealbreaker, use Option A (npm) which needs no auth at all.

**1. Authenticate to GitHub Packages** (one-time). Create a Personal Access Token with `read:packages` scope at https://github.com/settings/tokens and add to `~/.npmrc` (Linux/macOS/Termux) or `%USERPROFILE%\.npmrc` (Windows):

```ini
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
@thestrongestoftomorrow:registry=https://npm.pkg.github.com
```

**2. Install globally:**

```bash
npm install -g @thestrongestoftomorrow/online-agent
```

The binary names are identical to the npm version (`online-agent` and `oac`).

> Why two registries? npm's "trusted publisher" (OIDC) feature requires 2FA on the publishing account, which not everyone can use. GitHub Packages only needs a PAT, so it's the more accessible fallback. Both registries are kept in sync on every release.

### Option C — Docker (no PAT, no Node.js install)

For users who can't (or don't want to) install Node.js or configure a PAT, `online-agent` ships as a Docker image on the public GitHub Container Registry. **No PAT needed to pull.**

```bash
# Pull the latest image (no auth required)
docker pull ghcr.io/thestrongestoftomorrow/online-agent:latest

# Run interactively (launches the TUI)
docker run -it --rm \
  -p 7777:7777 \
  -v "$PWD:/workspace" \
  ghcr.io/thestrongestoftomorrow/online-agent:latest

# Or run headless in the background, exposing the server on your LAN
docker run -d --rm \
  --name online-agent \
  -p 7777:7777 \
  -v "$PWD:/workspace" \
  ghcr.io/thestrongestoftomorrow/online-agent:latest \
  start --lan
```

**What the `-v` mount does:** your current directory (`$PWD`) is mounted into the container at `/workspace`. The agent is sandboxed there — `fs.read` / `fs.write` / `shell.exec` all operate on files inside `/workspace`, which is actually your host directory. So changes the AI makes show up on your host immediately.

**Multi-arch:** the image is built for `linux/amd64` and `linux/arm64`, so it works on Apple Silicon Macs, Raspberry Pi 4, and most cloud VMs.

**Tags:**
- `:latest` — latest stable release
- `:2.3.0` — pinned to a specific version
- `:2.3` — latest patch of the 2.3.x line
- `:dev` — latest commit on the `main` branch (unstable)

### Run without installing (npx)

```bash
npx online-agent                # from npm
# or
npx @thestrongestoftomorrow/online-agent    # from GitHub Packages (needs PAT in .npmrc)
```

### From source (for development)

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm link        # makes `online-agent` available globally on your dev machine
```

### Staying up to date — the auto-updater

Every time you launch `online-agent` (the TUI), it silently fetches [`update.sh`](https://raw.githubusercontent.com/TheStrongestOfTomorrow/OnlineAgent-Connector/main/update.sh) from the public GitHub raw URL — **no PAT needed**, since `raw.githubusercontent.com` is always public. It parses the target version out of the script header and compares it to your installed version.

If a newer version is available, a yellow banner appears at the bottom of the TUI:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⬆ Update available: 2.2.1 → 2.3.0   [U] update now   [X] dismiss      │
└────────────────────────────────────────────────────────────────────────┘
```

Press **`U`** to download and run the updater (it handles the install for you — npm first, GitHub Packages fallback, Docker last resort). Press **`X`** to dismiss.

You can also trigger an update manually at any time:

```bash
online-agent update              # check + install
online-agent update --check-only # just check, don't install
online-agent update --force      # reinstall even if already current
```

The `update.sh` file in the repo is **replaced on every release**, so there is always exactly one `update.sh` and it always targets the latest version. Old per-version update scripts are deleted — no accumulation, no confusion.

> **Migrating from the old v1 / v2.0 GitHub Packages package?** The original `@thestrongestoftomorrow/onlineagent-connector` (unscoped-with-dash name, frozen at v2.0.0) is deprecated. The new GitHub Packages name is `@thestrongestoftomorrow/online-agent`. To migrate:
>
> 1. `npm uninstall -g @thestrongestoftomorrow/onlineagent-connector`
> 2. `npm install -g @thestrongestoftomorrow/online-agent` (or `npm install -g online-agent` if you don't need GitHub Packages)
> 3. The `onlineagent` CLI binary was renamed to `online-agent` in v2.1 — the `oac` alias is unchanged.

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

## How the AI connects — the full picture

After you install and start `online-agent`, the AI needs three things to reach your machine:

1. **A WebSocket URL** to connect to (`ws://…` or `wss://…`)
2. **The pairing code** (the 6-digit number shown in the TUI / `onlineagent start` output)
3. **A JSON-RPC 2.0 client** — either a few lines of raw WebSocket code, or one of the example clients in `examples/`

The connection flow is always the same:

```
┌─────────────────┐                              ┌─────────────────┐
│                 │   1. open WebSocket          │                 │
│   AI agent      │ ───────────────────────────► │  online-agent   │
│ (any language)  │                              │   (your host)   │
│                 │   2. { method:"auth",       │                 │
│                 │       params:{ code:"…" } }  │                 │
│                 │ ───────────────────────────► │                 │
│                 │                              │                 │
│                 │   3. { result:{ ok:true } } │                 │
│                 │ ◄─────────────────────────── │                 │
│                 │                              │                 │
│                 │   4. call any of 53 methods  │                 │
│                 │      (shell.exec, fs.read,   │                 │
│                 │       agent.message, …)      │                 │
│                 │ ◄──────────────────────────► │                 │
└─────────────────┘                              └─────────────────┘
```

### Step 1 — Start the server (on your machine)

```bash
online-agent          # launches the TUI; server auto-starts and prints a 6-digit code
# OR, headless:
online-agent start
```

The TUI's **Status tab** shows:
- The pairing code (e.g. `481293`)
- The WebSocket URL (e.g. `ws://127.0.0.1:7777/`)
- Connected agents

### Step 2 — Choose how the AI reaches you

There are **three scenarios**. Pick the one that matches where your AI lives:

| Scenario | Where the AI runs | URL the AI uses | Setup needed |
|---|---|---|---|
| **A. Same machine** | Local script, local LLM, another terminal | `ws://127.0.0.1:7777/` | None — default |
| **B. Same Wi-Fi (LAN)** | Another laptop / phone on your network | `ws://192.168.x.x:7777/` | Start with `online-agent start --lan` |
| **C. Remote / cloud** | ChatGPT, Claude API, a cloud LLM, a remote server | `wss://your-tunnel.trycloudflare.com/` | Run a tunnel (see below) |

#### Scenario A — same machine

Default mode. The AI agent runs as another process on the same computer (a Python script, a Node.js app, a local LLM tool). It connects to `ws://127.0.0.1:7777/` directly — no setup needed.

```bash
# In terminal 1
online-agent

# In terminal 2 (the AI agent)
node examples/node-agent.js ws://127.0.0.1:7777/ 481293
```

#### Scenario B — same Wi-Fi (LAN)

For when the AI runs on a different device on your home/office Wi-Fi (e.g. your phone, another laptop, a Raspberry Pi). Start the server with `--lan` so it binds to `0.0.0.0` instead of `127.0.0.1`:

```bash
online-agent start --lan
# The TUI shows the LAN URL, e.g.:
#   LAN WebSocket URL: ws://192.168.1.42:7777/
```

Then point the AI agent on the other device at that URL.

> ⚠️ Anyone on the same Wi-Fi who guesses your 6-digit code can run commands. Use a longer code: `online-agent start --lan --code "my-secret-passphrase"`.

#### Scenario C — remote / cloud AI

For when the AI lives in the cloud (ChatGPT, Claude API, a remote agent framework like LangChain/AutoGen running on a server). You need a tunnel so the cloud AI can reach your laptop behind NAT.

Pick one (all free for hobby use):

```bash
# Option 1: cloudflared (no signup, fastest)
cloudflared tunnel --url http://localhost:7777
# → prints: https://random-words-xxxx.trycloudflare.com

# Option 2: ngrok (needs free account)
ngrok http 7777
# → prints: https://abcd-1-2-3-4.ngrok-free.app

# Option 3: bore.pub (no signup, simple)
bore local 7777 --to bore.pub
# → prints: bore.pub:PORT
```

Give the AI agent the `wss://…` URL from the tunnel + your pairing code.

> ⚠️ With a public tunnel, anyone on the internet who guesses your code can run shell commands. **Either** use a long alphanumeric code (`--code "long-random-passphrase"`), **or** disable shell+write (`--no-shell --no-write`) so the agent can only read/list files.

### Step 3 — The agent authenticates & calls methods

The agent speaks **JSON-RPC 2.0 over WebSocket**. The first message must be `auth` with the pairing code. After that, any of the 53 methods can be called.

**Node.js example** (raw WebSocket, no dependencies beyond `ws`):

```js
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:7777/');

ws.on('open', () => {
  // 1. authenticate
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: '1', method: 'auth',
    params: { code: '481293', agentId: 'my-llm-agent' }
  }));
});

let nextId = 2;
ws.on('message', (buf) => {
  const msg = JSON.parse(buf.toString());
  console.log(msg);

  // 2. once auth succeeds, call any method
  if (msg.id === '1' && msg.result?.ok) {
    // run a shell command
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method: 'shell.exec',
      params: { command: 'ls -la' } }));

    // read a file
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method: 'fs.read',
      params: { path: 'README.md' } }));

    // send a message to the user's TUI
    ws.send(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method: 'agent.message',
      params: { text: 'Hi! I just read your README.', level: 'success' } }));
  }
});
```

**Python example** (needs `pip install websocket-client`):

```python
import json, websocket

ws = websocket.create_connection('ws://127.0.0.1:7777/')

# 1. authenticate
ws.send(json.dumps({
    'jsonrpc': '2.0', 'id': '1', 'method': 'auth',
    'params': {'code': '481293', 'agentId': 'my-py-agent'}
}))
print(json.loads(ws.recv()))

# 2. run a shell command
ws.send(json.dumps({
    'jsonrpc': '2.0', 'id': '2', 'method': 'shell.exec',
    'params': {'command': 'whoami && pwd'}
}))
print(json.loads(ws.recv()))
```

### Step 4 — Try it with the bundled example clients

The package ships with two ready-to-run interactive agents in `examples/`:

```bash
# Node.js interactive REPL
node examples/node-agent.js ws://127.0.0.1:7777/ 481293

# Python interactive REPL (needs: pip install websocket-client)
python examples/python-agent.py ws://127.0.0.1:7777/ 481293
```

Once connected, you get a `agent>` prompt where you can type any method name + JSON params:

```
agent> sys.info
agent> shell.exec {"command":"pwd"}
agent> fs.read {"path":"package.json"}
agent> agent.message {"text":"hello from your AI","level":"info"}
agent> agent.ask {"prompt":"What folder should I look at?"}
```

### Quick reference: connecting from common AI frameworks

| Framework | How to connect |
|---|---|
| **Raw Node.js** | `new WebSocket('ws://…')` + `ws.send(JSON.stringify({jsonrpc:'2.0',…}))` |
| **Raw Python** | `pip install websocket-client` then `websocket.create_connection('ws://…')` |
| **LangChain tool** | Wrap the JSON-RPC calls in a `@tool`-decorated function that opens the WS, sends the request, returns the response |
| **AutoGen agent** | Add a custom function that calls `shell.exec` / `fs.read` over the WebSocket |
| **MCP server bridge** | Implement an MCP server that proxies tool calls to the JSON-RPC endpoint |
| **Browser JS** | `new WebSocket('wss://…')` (use `wss://` for tunneled connections; browsers block mixed content) |

The protocol is intentionally simple (JSON-RPC 2.0, no exotic framing) so it works with any language that has a WebSocket client.

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

## Publishing notes

Every release is published to **three channels** simultaneously:

| Channel | Artifact | Auth to install | Why it's there |
|---|---|---|---|
| **npm** | `online-agent@<version>` | None | Easiest install path for most users. |
| **GitHub Packages** | `@thestrongestoftomorrow/online-agent@<version>` | GitHub PAT (`read:packages`) | Fallback when npm is blocked / unavailable / 2FA-locked. |
| **Docker (GHCR)** | `ghcr.io/thestrongestoftomorrow/online-agent:<version>` | None | No Node.js install, no PAT — runs in a container. |

### Why three channels?

npm's "trusted publisher" (OIDC) feature requires **2FA on the publishing account**. Not all maintainers can use 2FA (locked-down devices, accessibility constraints, browser issues). If npm publishing breaks for any reason, the GitHub Packages and Docker channels keep working — the project never gets stuck.

GitHub Packages requires a PAT to install (a hard platform limitation, not fixable), so by itself it's not enough. Docker (GHCR) is public-pull with no auth, but doesn't give users a host-installed `online-agent` binary — they have to invoke it via `docker run`.

By publishing to all three, every user has at least one working path:

- **No PAT, want native install** → npm (`npm i -g online-agent`)
- **Has PAT, npm blocked** → GitHub Packages (`npm i -g @thestrongestoftomorrow/online-agent`)
- **No PAT, no Node.js** → Docker (`docker run ghcr.io/thestrongestoftomorrow/online-agent`)

### Auto-updater

The auto-updater fetches `update.sh` from the `main` branch of this repo via `raw.githubusercontent.com` (always public, no PAT). The `update.sh` file is **replaced on every release** so it always targets the latest version. This means users who installed via GitHub Packages and later lost their `.npmrc` (or never had one) can still update — the updater downloads `update.sh`, which then tries npm → GitHub Packages → Docker in order until one works.

If you're cutting a release, **update `update.sh`** to bump the `Version:` and `TARGET_VERSION` lines at the top of the file. See `CONTRIBUTING.md` for the full release checklist.

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
