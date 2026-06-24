'use strict';

/**
 * Process management tools.
 *   - proc.list  -> list running processes (cross-platform)
 *   - proc.kill  -> kill by PID
 *   - proc.tree  -> process tree rooted at a PID (best-effort, POSIX only)
 *   - proc.me    -> info about the connector's own process
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

class ProcessAPI {
  constructor({ platform }) {
    this.platform = platform;
  }

  async list({ limit = 100, sortBy = 'pid' } = {}) {
    if (this.platform.isWindows) {
      const out = await execFileP('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Get-Process | Sort-Object -Property ${sortBy} | Select-Object -First ${limit} Id,ProcessName,CPU,@{Name='MemMB';Expression={[math]::Round($_.WS/1MB,1)}} | ConvertTo-Json -Compress`,
      ]);
      const trimmed = out.stdout.trim();
      if (!trimmed) return { processes: [], count: 0 };
      const arr = trimmed.startsWith('[') ? JSON.parse(trimmed) : [JSON.parse(trimmed)];
      return { processes: arr.filter(Boolean), count: arr.length };
    }
    // POSIX & Termux
    const out = await execFileP('ps', ['-e', '-o', 'pid,ppid,user,%cpu,%mem,comm', '--no-headers']);
    const lines = out.stdout.split('\n').filter(Boolean);
    const processes = lines.slice(0, limit).map((l) => {
      const parts = l.trim().split(/\s+/);
      return {
        pid: parseInt(parts[0], 10),
        ppid: parseInt(parts[1], 10),
        user: parts[2],
        cpu: parseFloat(parts[3]) || 0,
        mem: parseFloat(parts[4]) || 0,
        command: parts.slice(5).join(' '),
      };
    });
    return { processes, count: processes.length };
  }

  async kill({ pid, signal = 'SIGTERM' }) {
    if (!pid || typeof pid !== 'number') throw new Error('params.pid (number) required');
    try {
      process.kill(pid, signal);
      return { pid, signal, killed: true };
    } catch (e) {
      return { pid, signal, killed: false, error: e.message };
    }
  }

  async tree({ pid, maxDepth = 3 } = {}) {
    if (!pid) throw new Error('params.pid required');
    if (this.platform.isWindows) {
      try {
        const out = await execFileP('wmic', ['process', 'where', `ParentProcessId=${pid}`, 'get', 'ProcessId,Name']);
        const lines = out.stdout.split('\n').slice(1).filter(Boolean);
        return {
          root: pid,
          children: lines.map((l) => {
            const parts = l.trim().split(/\s+/);
            return { pid: parseInt(parts[parts.length - 1], 10), name: parts.slice(0, -1).join(' ') };
          }),
        };
      } catch (e) {
        return { root: pid, children: [], error: e.message };
      }
    }
    const tree = { root: pid, children: [] };
    const walk = async (parentPid, depth) => {
      if (depth >= maxDepth) return;
      try {
        const out = await execFileP('pgrep', ['-P', String(parentPid)]);
        for (const childPid of out.stdout.split('\n').filter(Boolean)) {
          const cpid = parseInt(childPid, 10);
          tree.children.push({ pid: cpid, ppid: parentPid });
          await walk(cpid, depth + 1);
        }
      } catch (_) {}
    };
    await walk(pid, 0);
    return tree;
  }

  me() {
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: this.platform.platform,
      arch: this.platform.arch,
      nodeVersion: process.versions.node,
      cwd: process.cwd(),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

module.exports = ProcessAPI;
