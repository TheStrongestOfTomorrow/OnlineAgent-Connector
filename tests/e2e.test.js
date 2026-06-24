'use strict';
/**
 * End-to-end protocol test: starts the server, connects an agent,
 * authenticates, and exercises shell.exec, fs.read, sys.info.
 */
const { startServer } = require('../src');
const WebSocket = require('ws');

async function main() {
  const server = await startServer({
    host: '127.0.0.1',
    port: 7788,
    cwd: __dirname,
    capabilities: { shell: true, write: true },
    code: '999999',
    quiet: true,
  });

  console.log('Server started, code=' + server.auth.code);

  const ws = new WebSocket('ws://127.0.0.1:7788/');
  let nextId = 1;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = String(nextId++);
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });

  ws.on('message', (buf) => {
    const msg = JSON.parse(buf.toString());
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg);
    }
  });

  await new Promise((r) => ws.on('open', r));

  // 1. ping (no auth needed)
  const ping = await call('ping');
  console.log('[ok] ping ->', ping.result);

  // 2. call sys.info without auth — should fail with -32000
  try {
    await call('sys.info');
    console.log('[FAIL] sys.info without auth did not error');
    process.exit(1);
  } catch (e) {
    console.log('[ok] sys.info without auth correctly rejected:', e.message);
  }

  // 3. auth with wrong code
  try {
    await call('auth', { code: '000000' });
    console.log('[FAIL] auth with wrong code did not error');
    process.exit(1);
  } catch (e) {
    console.log('[ok] auth with wrong code correctly rejected:', e.message);
  }

  // 4. auth with correct code
  const auth = await call('auth', { code: '999999', agentId: 'e2e-test' });
  console.log('[ok] auth ->', auth.result);

  // 5. shell.exec
  const shell = await call('shell.exec', { command: 'echo hello-from-agent' });
  console.log('[ok] shell.exec ->', JSON.stringify(shell.result));

  // 6. fs.write + fs.read
  await call('fs.write', { path: 'e2e-test.txt', content: 'agent was here' });
  const read = await call('fs.read', { path: 'e2e-test.txt' });
  console.log('[ok] fs.read ->', read.result.content);
  if (read.result.content !== 'agent was here') {
    console.log('[FAIL] fs.read content mismatch');
    process.exit(1);
  }
  await call('fs.rm', { path: 'e2e-test.txt' });

  // 7. sys.info
  const info = await call('sys.info');
  console.log('[ok] sys.info -> platform=' + info.result.platform + ' cpus=' + info.result.cpuCount);

  // 8. agent.list
  const list = await call('agent.list');
  console.log('[ok] agent.list -> count=' + list.result.count);

  // 9. Path escape should be blocked
  try {
    await call('fs.read', { path: '../../../etc/passwd' });
    console.log('[FAIL] path escape was not blocked');
    process.exit(1);
  } catch (e) {
    console.log('[ok] path escape blocked:', e.message);
  }

  ws.close();
  await server.stop();
  console.log('\nAll E2E protocol tests passed.');
  process.exit(0);
}

main().catch((e) => { console.error('E2E failure:', e); process.exit(1); });
