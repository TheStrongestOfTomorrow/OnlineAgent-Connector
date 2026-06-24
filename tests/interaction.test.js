'use strict';
/**
 * Integration test for the agent-interaction pipeline.
 *
 * Verifies that when an agent calls `agent.ask`, the question is emitted
 * to the AgentInteraction emitter, and that calling `respondToAsk`
 * resolves the agent's original request. This is the core of "the AI
 * talks back to the user inside the terminal."
 */

const assert = require('assert');
const { startServer } = require('../src');
const WebSocket = require('ws');

async function main() {
  const server = await startServer({
    host: '127.0.0.1',
    port: 7797,
    cwd: __dirname,
    capabilities: { shell: true, write: true },
    code: '555555',
    quiet: true,
  });

  const ws = new WebSocket('ws://127.0.0.1:7797/');
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
  await call('auth', { code: '555555', agentId: 'chat-test' });

  console.log('Running agent-interaction integration tests…\n');

  // 1. agent.message — verify it's delivered to the emitter AND recorded as delivered
  {
    const got = new Promise((resolve) => server.agentInteraction.once('message', resolve));
    const r = await call('agent.message', { text: 'Hi! I am your AI.', level: 'info' });
    const m = await got;
    assert.strictEqual(r.result.delivered, true);
    assert.strictEqual(m.text, 'Hi! I am your AI.');
    assert.strictEqual(m.agentId, 'chat-test');
    console.log('  ✓ agent.message delivered to TUI emitter');
  }

  // 2. agent.ask — verify the question is emitted, then respond and the agent gets the answer
  {
    const got = new Promise((resolve) => server.agentInteraction.once('ask', resolve));
    // Don't await yet — start the ask, then respond
    const askPromise = call('agent.ask', { prompt: 'Pick a number 1-10', defaultResponse: '5', timeoutMs: 5000 });
    const question = await got;
    assert.strictEqual(question.prompt, 'Pick a number 1-10');
    assert.ok(question.id);
    console.log('  ✓ agent.ask emitted question to TUI');

    // Simulate the user typing a response in the TUI
    server.agentInteraction.respondToAsk(question.id, '7');
    const r = await askPromise;
    assert.strictEqual(r.result.answered, true);
    assert.strictEqual(r.result.response, '7');
    console.log('  ✓ TUI response delivered back to agent (' + r.result.response + ')');
  }

  // 3. agent.ask timeout — verify defaultResponse is returned when user doesn't respond
  {
    const r = await call('agent.ask', { prompt: 'Are you there?', defaultResponse: 'no', timeoutMs: 100 });
    assert.strictEqual(r.result.answered, false);
    assert.strictEqual(r.result.response, 'no');
    assert.strictEqual(r.result.timedOut, true);
    console.log('  ✓ agent.ask returns defaultResponse on timeout');
  }

  // 4. agent.notify — best-effort, may or may not show depending on platform
  {
    const got = new Promise((resolve) => server.agentInteraction.once('notify', resolve));
    const r = await call('agent.notify', { title: 'Test', body: 'Hello from agent' });
    const n = await got;
    assert.strictEqual(n.title, 'Test');
    assert.strictEqual(n.body, 'Hello from agent');
    console.log('  ✓ agent.notify emitted to TUI');
  }

  // 5. agent.progress — status update
  {
    const got = new Promise((resolve) => server.agentInteraction.once('progress', resolve));
    await call('agent.progress', { status: 'building', percent: 33 });
    const p = await got;
    assert.strictEqual(p.status, 'building');
    assert.strictEqual(p.percent, 33);
    assert.strictEqual(p.agentId, 'chat-test');
    console.log('  ✓ agent.progress recorded for TUI status line');
  }

  ws.close();
  await server.stop();
  console.log('\nAll agent-interaction tests passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nTest failure:', e);
  process.exit(1);
});
