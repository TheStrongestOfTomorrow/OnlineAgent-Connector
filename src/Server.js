'use strict';

/**
 * HTTP + WebSocket server that hosts the AI-agent bridge locally.
 *
 * - HTTP server exposes:
 *     GET  /                -> human-readable landing page
 *     GET  /health          -> { ok: true, version, serverId, agents }
 *     GET  /info            -> server capabilities & how to connect
 *     WS   /                -> JSON-RPC over WebSocket (the agent endpoint)
 *
 * - On each new WS connection:
 *     1. Start a 5s auth timer.
 *     2. Wait for an `auth` request.
 *     3. If valid -> register agent, clear timer, accept further requests.
 *     4. If invalid or timeout -> close with code 4001.
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const AuthManager = require('./AuthManager');
const CommandExecutor = require('./CommandExecutor');
const FileSystemAPI = require('./FileSystemAPI');
const SystemInfo = require('./SystemInfo');
const { AgentProtocol } = require('./AgentProtocol');

class Server {
  constructor({ host, port, cwd, capabilities, code, logger, platform }) {
    this.host = host;
    this.port = port;
    this.cwd = cwd;
    this.capabilities = capabilities;
    this.logger = logger;
    this.platform = platform;
    this.serverId = crypto.randomUUID();
    this.startedAt = Date.now();

    this.auth = new AuthManager({ code });
    this.executor = new CommandExecutor({ platform, cwd, capabilities });
    this.fsApi = new FileSystemAPI({ cwd, capabilities });
    this.sysInfo = new SystemInfo({ platform, cwd });
    this.protocol = new AgentProtocol({
      auth: this.auth,
      executor: this.executor,
      fsApi: this.fsApi,
      sysInfo: this.sysInfo,
      logger: this.logger,
      serverId: this.serverId,
    });

    this.httpServer = null;
    this.wss = null;
  }

  async start() {
    this.httpServer = http.createServer((req, res) => this._handleHttp(req, res));

    this.wss = new WebSocketServer({ server: this.httpServer, path: '/' });

    this.wss.on('connection', (ws, req) => this._handleConnection(ws, req));

    await new Promise((resolve, reject) => {
      this.httpServer.on('error', reject);
      this.httpServer.listen(this.port, this.host, () => {
        this.httpServer.removeListener('error', reject);
        resolve();
      });
    });
  }

  async stop() {
    // Close all agent WebSockets
    if (this.wss) {
      for (const client of this.wss.clients) {
        try { client.close(1001, 'server shutting down'); } catch (_) {}
      }
    }
    if (this.httpServer) {
      await new Promise((r) => this.httpServer.close(() => r()));
    }
    this._clearStateFile();
  }

  _handleHttp(req, res) {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        version: require('../package.json').version,
        serverId: this.serverId,
        agents: this.auth.agentCount(),
        uptimeS: Math.round((Date.now() - this.startedAt) / 1000),
      }));
      return;
    }
    if (req.method === 'GET' && url === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        serverId: this.serverId,
        version: require('../package.json').version,
        capabilities: this.capabilities,
        workingDir: this.cwd,
        platform: this.platform.label(),
        agentCount: this.auth.agentCount(),
        protocol: 'JSON-RPC 2.0 over WebSocket',
        methods: [
          'ping', 'auth', 'agent.whoami', 'agent.list',
          'sys.info', 'sys.diskUsage',
          'shell.exec',
          'fs.read', 'fs.write', 'fs.list', 'fs.stat', 'fs.rm', 'fs.mkdir', 'fs.rename', 'fs.copy', 'fs.tree',
        ],
      }));
      return;
    }
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this._landingPage());
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found. Try /health or /info');
  }

  _landingPage() {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>OnlineAgent-Connector</title>
<style>
  body{font:14px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;max-width:680px;margin:60px auto;padding:0 24px;color:#222}
  h1{font-size:22px}
  code,pre{background:#f4f4f4;padding:2px 6px;border-radius:4px}
  pre{padding:14px;overflow:auto}
  .ok{color:#0a0}.warn{color:#c80}
</style>
</head><body>
<h1>OnlineAgent-Connector</h1>
<p>This is a local agent-hosting server. AI agents connect over WebSocket (JSON-RPC 2.0) using the pairing code shown in the terminal.</p>
<h3>Health</h3>
<pre>GET /health</pre>
<h3>Capabilities</h3>
<pre>GET /info</pre>
<h3>Connect (Node.js example)</h3>
<pre>const WebSocket = require('ws');
const ws = new WebSocket('ws://${this.host}:${this.port}/');
ws.on('open', () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: '1', method: 'auth',
    params: { code: 'YOUR_CODE', agentId: 'my-agent' }
  }));
});
ws.on('message', (buf) => console.log(JSON.parse(buf.toString())));</pre>
<p class="warn">Treat the pairing code as a password — anyone with it can run commands in the working directory of this server.</p>
</body></html>`;
  }

  _handleConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    this.logger.info(`WS connection from ${ip}`);

    const state = { authenticated: false, agentId: null };
    const ctx = {
      ws,
      state,
      setState: (patch) => Object.assign(state, patch),
    };

    // Force-auth timer
    const authTimer = setTimeout(() => {
      if (!state.authenticated) {
        try {
          ws.close(4001, 'auth timeout');
        } catch (_) {}
      }
    }, 5000);

    ws.on('message', async (buf) => {
      let req;
      try {
        req = JSON.parse(buf.toString());
      } catch (e) {
        ws.send(JSON.stringify(this.protocol.errorResponse(null, -32700, 'Parse error')));
        return;
      }

      // Support a single request object or a batch (array)
      const requests = Array.isArray(req) ? req : [req];
      const responses = [];
      for (const r of requests) {
        const resp = await this.protocol.handleRequest(r, ctx);
        if (resp) responses.push(resp);
      }
      if (responses.length === 1) {
        ws.send(JSON.stringify(responses[0]));
      } else if (responses.length > 1) {
        ws.send(JSON.stringify(responses));
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (state.agentId) {
        this.auth.unregisterAgent(state.agentId);
        this.logger.agent(`Disconnected (id=${state.agentId})`);
      }
    });

    ws.on('error', () => {
      clearTimeout(authTimer);
    });
  }

  printConnectionInfo({ showTunnelHint = false, showQr = false } = {}) {
    const isLan = this.host === '0.0.0.0';
    const lanIp = isLan ? this.sysInfo.lanIp() : null;

    this.logger.success(`Server listening on ${isLan ? '0.0.0.0' : this.host}:${this.port}`);
    this.logger.info(`Working directory: ${this.cwd}`);
    this.logger.info(`Capabilities: shell=${this.capabilities.shell ? 'yes' : 'no'}, write=${this.capabilities.write ? 'yes' : 'no'}`);
    this.logger.info(`Server ID: ${this.serverId}`);
    this.logger.info(`Agents connected: ${this.auth.agentCount()}`);
    this.logger.info(`Pairing code (expires in 30 min, or restart):`);
    this.logger.code(this.auth.code);

    const displayHost = isLan ? (lanIp || 'YOUR_LAN_IP') : (this.host === '0.0.0.0' ? '127.0.0.1' : this.host);
    const wsUrl = `ws://${displayHost}:${this.port}/`;

    this.logger.info(`Local WebSocket URL:  ws://127.0.0.1:${this.port}/`);
    if (isLan && lanIp) {
      this.logger.info(`LAN WebSocket URL:    ${wsUrl}`);
    }
    this.logger.info(`HTTP info endpoint:   http://${displayHost}:${this.port}/info`);
    this.logger.info(`Health check:         http://${displayHost}:${this.port}/health`);

    if (showQr) {
      this._printQr(`oac://${displayHost}:${this.port}/?code=${this.auth.code}`);
    }

    this.logger.info('');
    this.logger.info('How an AI agent connects:');
    this.logger.info('  1. Open a WebSocket to the URL above.');
    this.logger.info('  2. Send: { jsonrpc:"2.0", id:"1", method:"auth", params:{ code:"' + this.auth.code + '" } }');
    this.logger.info('  3. After the "ok" response, call any method: shell.exec, fs.read, sys.info, ...');
    this.logger.info('');
    this.logger.info('See the examples/ folder for ready-to-use agent clients (Node.js + Python).');
    this.logger.info('Press Ctrl+C to stop the server.');

    if (showTunnelHint) {
      this.logger.warn('');
      this.logger.warn('Tunnel hint — for agents on a different network, expose this port publicly:');
      this.logger.hint('  cloudflared:  cloudflared tunnel --url http://localhost:' + this.port);
      this.logger.hint('  ngrok:        ngrok http ' + this.port);
      this.logger.hint('  bore:         bore local ' + this.port + ' --to bore.pub');
    }
  }

  /** Render a tiny QR-like display for the connection URL. Best-effort. */
  _printQr(text) {
    // Inline minimal QR fallback: just print the URL with instructions.
    // (We avoid a heavy QR dependency; users who want a real QR can install `qrcode-terminal`.)
    this.logger.info('QR (text payload):');
    this.logger.info('  ' + text);
    this.logger.hint('For a real QR, install: npm i -g qrcode-terminal && qrcode-terminal "' + text + '"');
  }

  writeStateFile() {
    const stateFile = this.platform.stateFile();
    const isLan = this.host === '0.0.0.0';
    const lanIp = isLan ? this.sysInfo.lanIp() : null;
    const displayHost = isLan ? (lanIp || '0.0.0.0') : this.host;
    const data = {
      pid: process.pid,
      port: this.port,
      host: this.host,
      displayHost,
      code: this.auth.code,
      url: `ws://${displayHost}:${this.port}/`,
      cwd: this.cwd,
      startedAt: this.startedAt,
      serverId: this.serverId,
      version: require('../package.json').version,
    };
    try {
      fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
    } catch (e) {
      this.logger.warn(`Could not write state file: ${e.message}`);
    }
  }

  _clearStateFile() {
    const f = this.platform.stateFile();
    try { fs.unlinkSync(f); } catch (_) {}
  }
}

module.exports = Server;
