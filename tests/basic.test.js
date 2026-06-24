'use strict';

/**
 * Smoke test — verifies the core pieces work end-to-end without spawning the CLI.
 * Run: npm test
 */

const path = require('path');
const assert = require('assert');
const { AuthManager, Platform, FileSystemAPI, CommandExecutor } = require('../src');

function ok(name) { console.log('  ✓ ' + name); }

async function main() {
  console.log('Running OnlineAgent-Connector smoke tests…\n');

  // 1. AuthManager
  const a = new AuthManager({ code: '123456' });
  assert.strictEqual(a.validate('123456'), true, 'correct code validates');
  assert.strictEqual(a.validate('000000'), false, 'wrong code rejects');
  assert.strictEqual(a.validate(undefined), false, 'undefined rejects');
  ok('AuthManager code validation');

  // 2. Random code generation
  const c1 = AuthManager.generateCode();
  const c2 = AuthManager.generateCode();
  assert.strictEqual(c1.length, 6, 'default code is 6 digits');
  assert.ok(/^\d{6}$/.test(c1), 'code is 6 digits');
  assert.notStrictEqual(c1, c2, 'codes are random');
  ok('AuthManager.generateCode');

  // 3. Platform detection
  const p = new Platform();
  assert.ok(p.platform && typeof p.platform === 'string');
  assert.ok(typeof p.defaultShell() === 'string' && p.defaultShell().length > 0);
  assert.ok(p.stateFile().length > 0);
  ok('Platform detection (platform=' + p.platform + ', shell=' + p.defaultShell() + ')');

  // 4. CommandExecutor runs a simple shell command
  const exec = new CommandExecutor({
    platform: p,
    cwd: __dirname,
    capabilities: { shell: true, write: true },
  });
  const r = await exec.exec(p.isWindows ? 'echo hello' : 'echo hello');
  assert.strictEqual(r.ok, true, 'exec returns ok');
  assert.ok(r.stdout.includes('hello') || r.stderr.includes('hello'), 'exec output contains "hello"');
  ok('CommandExecutor basic echo');

  // 5. CommandExecutor respects disabled capability
  const exec2 = new CommandExecutor({
    platform: p,
    cwd: __dirname,
    capabilities: { shell: false, write: true },
  });
  const r2 = await exec2.exec('echo should-not-run');
  assert.strictEqual(r2.ok, false);
  assert.ok(/disabled/.test(r2.error));
  ok('CommandExecutor respects shell=false');

  // 6. FileSystemAPI sandboxing
  const fsApi = new FileSystemAPI({
    cwd: __dirname,
    capabilities: { shell: true, write: true },
  });
  assert.throws(() => fsApi._safe('../../etc/passwd'), /outside/, 'path escape throws');
  assert.throws(() => fsApi._safe('/etc/passwd'), /outside/, 'absolute outside path throws');
  ok('FileSystemAPI sandbox blocks path escapes');

  // 7. FileSystemAPI write + read roundtrip
  const tmpName = '.oac-test-' + Date.now() + '.txt';
  await fsApi.write(tmpName, 'hello world');
  const back = await fsApi.read(tmpName);
  assert.strictEqual(back.content, 'hello world');
  await fsApi.rm(tmpName);
  ok('FileSystemAPI write/read/rm roundtrip');

  console.log('\nAll tests passed.');
}

main().catch((e) => {
  console.error('\nTest failure:', e);
  process.exit(1);
});
