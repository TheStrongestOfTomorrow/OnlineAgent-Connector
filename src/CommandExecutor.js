'use strict';

/**
 * Cross-platform shell command executor.
 *
 * Uses the user's real shell (PowerShell on Windows, bash on Linux/macOS/Termux).
 * Enforces:
 *   - working directory restriction (no escaping cwd)
 *   - per-command timeout
 *   - max output size (to avoid OOM on big command outputs)
 *   - capability flag (caller can disable shell entirely)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024; // 4 MiB per command

class CommandExecutor {
  constructor({ platform, cwd, capabilities }) {
    this.platform = platform;
    this.cwd = cwd;
    this.capabilities = capabilities;
  }

  isAllowed() {
    return this.capabilities && this.capabilities.shell === true;
  }

  /**
   * Run a shell command.
   * @param {string} command
   * @param {object} opts { timeoutMs, cwd, env, stdin }
   * @returns {Promise<{ok, exitCode, stdout, stderr, durationMs, timedOut}>}
   */
  async exec(command, opts = {}) {
    if (!this.isAllowed()) {
      return {
        ok: false,
        error: 'Shell execution is disabled on this connector (start with --allow-shell to enable).',
      };
    }
    if (typeof command !== 'string' || command.length === 0) {
      return { ok: false, error: 'Empty command.' };
    }
    if (command.length > 8192) {
      return { ok: false, error: 'Command too long (max 8192 chars).' };
    }

    const timeoutMs = Math.min(opts.timeoutMs || DEFAULT_TIMEOUT_MS, 5 * 60_000);
    const cwd = this._safeCwd(opts.cwd);
    const env = { ...process.env, ...(opts.env || {}) };

    const shellBin = this.platform.defaultShell();
    const args = this.platform.shellExecArgs(command);

    return new Promise((resolve) => {
      const started = Date.now();
      let child;
      try {
        child = spawn(shellBin, args, {
          cwd,
          env,
          windowsHide: true,
          maxBuffer: MAX_OUTPUT_BYTES,
        });
      } catch (e) {
        return resolve({ ok: false, error: `Failed to spawn shell: ${e.message}` });
      }

      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let timedOut = false;
      let killed = false;

      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        try { child.kill('SIGKILL'); } catch (_) {}
      }, timeoutMs);

      child.stdout.on('data', (d) => {
        if (stdout.length + d.length > MAX_OUTPUT_BYTES) {
          stdout = Buffer.concat([stdout, d.subarray(0, MAX_OUTPUT_BYTES - stdout.length)]);
          if (!killed) { killed = true; try { child.kill('SIGKILL'); } catch (_) {} }
        } else {
          stdout = Buffer.concat([stdout, d]);
        }
      });
      child.stderr.on('data', (d) => {
        if (stderr.length + d.length > MAX_OUTPUT_BYTES) {
          stderr = Buffer.concat([stderr, d.subarray(0, MAX_OUTPUT_BYTES - stderr.length)]);
        } else {
          stderr = Buffer.concat([stderr, d]);
        }
      });

      if (opts.stdin && typeof opts.stdin === 'string') {
        try { child.stdin.end(opts.stdin); } catch (_) {}
      } else {
        try { child.stdin.end(); } catch (_) {}
      }

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          error: `Spawn error: ${err.message}`,
          durationMs: Date.now() - started,
        });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({
          ok: true,
          exitCode: code,
          signal,
          timedOut,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          durationMs: Date.now() - started,
          truncated: stdout.length >= MAX_OUTPUT_BYTES,
        });
      });
    });
  }

  /**
   * Resolve a target directory, restricting it to inside `cwd` (sandbox).
   * If `target` is undefined, returns `cwd`.
   * If `target` is absolute, it must be inside cwd.
   * If `target` is relative, it's joined with cwd.
   */
  _safeCwd(target) {
    const base = this.cwd;
    if (!target) return base;
    const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(base, target);
    // Ensure the resolved path is inside the sandbox base
    const rel = path.relative(base, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      // outside sandbox — fall back to base
      return base;
    }
    return resolved;
  }
}

module.exports = CommandExecutor;
