'use strict';
/**
 * Tests for the v2.0 tool additions: proc, net, git, search, env, crypto, time, agent-interaction.
 */
const path = require('path');
const assert = require('assert');
const { startServer } = require('../src');
const WebSocket = require('ws');

async function main() {
  const server = await startServer({
    host: '127.0.0.1',
    port: 7799,
    cwd: __dirname,
    capabilities: { shell: true, write: true },
    code: '888888',
    quiet: true,
  });

  const ws = new WebSocket('ws://127.0.0.1:7799/');
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

  await call('auth', { code: '888888', agentId: 'tools-test' });

  const t = (name, fn) => fn().then(() => console.log('  ✓ ' + name));

  console.log('Running v2.0 tools tests…\n');

  // 1. proc.me
  await t('proc.me returns process info', async () => {
    const r = await call('proc.me');
    assert.strictEqual(r.result.platform, process.platform);
    assert.ok(r.result.pid > 0);
  });

  // 2. proc.list
  await t('proc.list returns running processes', async () => {
    const r = await call('proc.list', { limit: 10 });
    assert.ok(r.result.count > 0);
    assert.ok(r.result.processes[0].pid > 0);
  });

  // 3. net.ip
  await t('net.ip returns network interfaces', async () => {
    const r = await call('net.ip');
    assert.ok(Array.isArray(r.result.interfaces));
  });

  // 4. net.dns
  await t('net.dns resolves example.com', async () => {
    const r = await call('net.dns', { hostname: 'example.com', recordType: 'A' });
    assert.ok(r.result.records && r.result.records.length > 0);
  });

  // 5. net.http
  await t('net.http fetches httpbin.org/json', async () => {
    const r = await call('net.http', { url: 'https://example.com', method: 'GET', timeoutMs: 15000 });
    assert.strictEqual(r.result.status, 200);
    assert.ok(r.result.body.length > 0);
  });

  // 6. git.status (we're in a git repo)
  await t('git.status returns branch info', async () => {
    const r = await call('git.status');
    assert.ok(r.result.branch);
  });

  // 7. git.log
  await t('git.log returns recent commits', async () => {
    const r = await call('git.log', { limit: 3 });
    assert.ok(r.result.commits.length > 0);
  });

  // 8. search.files
  await t('search.files finds *.js files', async () => {
    const r = await call('search.files', { pattern: '*.js' });
    assert.ok(r.result.count > 0);
    assert.ok(r.result.files.some(f => f.path.endsWith('.js')));
  });

  // 9. search.grep
  await t('search.grep finds pattern in files', async () => {
    const r = await call('search.grep', { pattern: 'startServer' });
    assert.ok(r.result.count > 0);
  });

  // 10. env.list
  await t('env.list returns env vars', async () => {
    const r = await call('env.list');
    assert.ok(r.result.count > 0);
  });

  // 11. env.set + env.get
  await t('env.set + env.get roundtrip', async () => {
    await call('env.set', { name: 'OAC_TEST_VAR', value: 'hello123' });
    const r = await call('env.get', { name: 'OAC_TEST_VAR' });
    assert.strictEqual(r.result.value, 'hello123');
  });

  // 12. crypto.uuid
  await t('crypto.uuid returns a v4 UUID', async () => {
    const r = await call('crypto.uuid');
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.result.uuid));
  });

  // 13. crypto.hash
  await t('crypto.hash computes sha256', async () => {
    const r = await call('crypto.hash', { algorithm: 'sha256', input: 'hello' });
    assert.strictEqual(r.result.digest, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  // 14. crypto.base64Encode + Decode
  await t('crypto.base64 roundtrip', async () => {
    const e = await call('crypto.base64Encode', { input: 'Hello, World!' });
    const d = await call('crypto.base64Decode', { input: e.result.encoded });
    assert.strictEqual(d.result.decoded, 'Hello, World!');
  });

  // 15. crypto.random
  await t('crypto.random generates bytes', async () => {
    const r = await call('crypto.random', { bytes: 16, encoding: 'hex' });
    assert.strictEqual(r.result.value.length, 32);
  });

  // 16. time.now
  await t('time.now returns ISO time', async () => {
    const r = await call('time.now');
    assert.ok(r.result.iso);
    assert.ok(r.result.epochMs > 0);
  });

  // 17. time.sleep
  await t('time.sleep waits the requested duration', async () => {
    const r = await call('time.sleep', { ms: 50 });
    assert.ok(r.result.sleptMs >= 50);
  });

  // 18. agent.message
  await t('agent.message delivers to emitter', async () => {
    const got = new Promise((resolve) => server.agentInteraction.once('message', resolve));
    await call('agent.message', { text: 'hello from test agent', level: 'info' });
    const m = await got;
    assert.strictEqual(m.text, 'hello from test agent');
  });

  // 19. agent.progress
  await t('agent.progress updates status', async () => {
    const got = new Promise((resolve) => server.agentInteraction.once('progress', resolve));
    await call('agent.progress', { status: 'working', percent: 42 });
    const p = await got;
    assert.strictEqual(p.status, 'working');
    assert.strictEqual(p.percent, 42);
  });

  // 20. agent.ask with no listener — should fall back to defaultResponse (or timeout quickly)
  await t('agent.ask returns defaultResponse on timeout', async () => {
    const r = await call('agent.ask', { prompt: 'no one will answer', defaultResponse: 'def', timeoutMs: 100 });
    assert.ok(r.result.answered === false || r.result.response === 'def');
  });

  ws.close();
  await server.stop();
  console.log('\nAll v2.0 tools tests passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nTest failure:', e);
  process.exit(1);
});
