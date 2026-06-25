'use strict';

/**
 * System info provider. Cross-platform safe — uses only Node built-ins.
 */

const os = require('os');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class SystemInfo {
  constructor({ platform, cwd }) {
    this.platform = platform;
    this.cwd = cwd;
  }

  snapshot() {
    const cpus = os.cpus();
    return {
      hostname: os.hostname(),
      platform: this.platform.platform,
      arch: this.platform.arch,
      label: this.platform.label(),
      isAndroidTermux: this.platform.isAndroidTermux,
      osRelease: os.release(),
      osType: os.type(),
      kernel: os.release(),
      uptimeSeconds: os.uptime(),
      loadAvg: os.loadavg(),
      cpuCount: cpus.length,
      cpuModel: cpus.length ? cpus[0].model : 'unknown',
      cpuSpeedMHz: cpus.length ? cpus[0].speed : 0,
      totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
      homeDir: this.platform.homeDir(),
      tmpDir: this.platform.tmpDir(),
      workingDir: this.cwd,
      shell: this.platform.defaultShell(),
      nodeVersion: process.versions.node,
      pid: process.pid,
      networkInterfaces: this._networkInterfacesSafe(),
    };
  }

  _networkInterfacesSafe() {
    const out = {};
    const ifaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(ifaces)) {
      out[name] = (addrs || [])
        .filter((a) => a.family === 'IPv4' && !a.internal)
        .map((a) => ({ address: a.address, netmask: a.netmask }));
    }
    return out;
  }

  /**
   * Best-effort guess of LAN IP for displaying in --lan mode.
   */
  lanIp() {
    const ifaces = os.networkInterfaces();
    for (const addrs of Object.values(ifaces)) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal && a.address.startsWith('192.168.')) return a.address;
        if (a.family === 'IPv4' && !a.internal && a.address.startsWith('10.')) return a.address;
        if (a.family === 'IPv4' && !a.internal && a.address.startsWith('172.')) return a.address;
      }
    }
    return null;
  }

  /**
   * Disk usage of the working directory (best effort).
   */
  diskUsage() {
    try {
      if (this.platform.isWindows) {
        const out = execFileSync('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Get-PSDrive -Name (Get-Location).Drive.Name | Select-Object Used,Free | ConvertTo-Json`,
        ], { encoding: 'utf8', cwd: this.cwd });
        const j = JSON.parse(out.trim());
        return {
          usedMB: Math.round(j.Used / 1024 / 1024),
          freeMB: Math.round(j.Free / 1024 / 1024),
        };
      }
      // POSIX / Termux — `df` is widely available
      const out = execFileSync('df', ['-P', this.cwd], { encoding: 'utf8' });
      const lines = out.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 6) {
          return {
            filesystem: parts[0],
            totalKB: parseInt(parts[1], 10),
            usedKB: parseInt(parts[2], 10),
            freeKB: parseInt(parts[3], 10),
            usedMB: Math.round(parseInt(parts[2], 10) / 1024),
            freeMB: Math.round(parseInt(parts[3], 10) / 1024),
            capacity: parts[4],
            mount: parts[5],
          };
        }
      }
    } catch (_) {}
    return null;
  }
}

module.exports = SystemInfo;
