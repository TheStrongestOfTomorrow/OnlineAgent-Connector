'use strict';
/**
 * Example Node.js AI agent client.
 *
 * Usage:
 *   node examples/node-agent.js ws://127.0.0.1:7777 123456
 *
 * Then in the interactive prompt you can type JSON-RPC methods like:
 *   sys.info
 *   shell.exec {"command":"ls -la"}
 *   fs.read {"path":"README.md"}
 *   fs.list {}
 */

const WebSocket = require('ws');
const readline = require('readline');

const url = process.argv[2] || 'ws://127.0.0.1:7777/';
const code = process.argv[3] || '000000';

const ws = new WebSocket(url);
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = String(nextId++);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

ws.on('open', async () => {
  console.log(`[agent] connected to ${url}`);
  console.log(`[agent] authenticating with code ${code}…`);
  try {
    const r = await send('auth', { code, agentId: 'node-example-' + process.pid });
    if (r.error) { console.error('[agent] auth failed:', r.error); process.exit(1); }
    console.log('[agent] authenticated ✓ — serverId=' + r.result.serverId + ' agentId=' + r.result.agentId);
    console.log('[agent] type a method name, optionally followed by JSON params. e.g.:');
    console.log('        sys.info');
    console.log('        shell.exec {"command":"pwd"}');
    console.log('        fs.read {"path":"package.json"}');
    console.log('        (Ctrl+D to quit)\n');
    repl();
  } catch (e) {
    console.error('[agent] error:', e.message);
    process.exit(1);
  }
});

ws.on('message', (buf) => {
  const msg = JSON.parse(buf.toString());
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg);
  } else if (msg.method) {
    console.log('[notification]', msg);
  }
});

ws.on('close', (code, reason) => {
  console.log(`[agent] disconnected (code=${code} reason=${reason})`);
  process.exit(0);
});

ws.on('error', (e) => {
  console.error('[agent] socket error:', e.message);
  process.exit(1);
});

function repl() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'agent> ' });
  rl.prompt();
  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) { rl.prompt(); return; }
    let method = line, params = {};
    const sp = line.indexOf(' ');
    if (sp > -1) {
      method = line.slice(0, sp).trim();
      const rest = line.slice(sp + 1).trim();
      if (rest) {
        try { params = JSON.parse(rest); }
        catch (e) { console.log('[error] params must be valid JSON'); rl.prompt(); return; }
      }
    }
    try {
      const r = await send(method, params);
      console.log(JSON.stringify(r.result, null, 2));
    } catch (e) {
      console.log('[error]', e.message);
    }
    rl.prompt();
  });
  rl.on('close', () => {
    ws.close();
    process.exit(0);
  });
}
