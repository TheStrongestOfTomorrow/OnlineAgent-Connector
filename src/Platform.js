'use strict';

/**
 * Cross-platform detection and helpers.
 *
 * Supports:
 *   - Windows (win32)            — powershell.exe / cmd.exe
 *   - macOS (darwin)             — /bin/bash
 *   - Linux (linux)              — /bin/bash or /bin/sh
 *   - Android via Termux         — /data/data/com.termux/files/usr/bin/bash
 *   - FreeBSD / OpenBSD          — /bin/sh
 *
 * Exposes a single class with everything the rest of the codebase needs.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

class Platform {
  constructor() {
    this.platform = process.platform; // 'win32' | 'darwin' | 'linux' | 'android' | 'freebsd' | 'openbsd'
    this.arch = process.arch;
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
    this.isAndroidTermux =
      this.platform === 'android' ||
      !!process.env.TERMUX_VERSION ||
      !!process.env.PREFIX && process.env.PREFIX.includes('com.termux');
    this.isFreeBSD = this.platform === 'freebsd';
    this.isOpenBSD = this.platform === 'openbsd';
    this.isPosix = !this.isWindows;
  }

  /** Default shell binary for this platform. */
  defaultShell() {
    if (this.isWindows) {
      // Prefer PowerShell if available, fall back to cmd
      try {
        execFileSync('where', ['powershell.exe'], { stdio: 'ignore' });
        return 'powershell.exe';
      } catch (_) {
        return process.env.ComSpec || 'cmd.exe';
      }
    }
    if (this.isAndroidTermux) {
      // Termux ships bash at this path
      const termuxBash = '/data/data/com.termux/files/usr/bin/bash';
      if (fs.existsSync(termuxBash)) return termuxBash;
      return process.env.SHELL || '/bin/sh';
    }
    if (this.isMac || this.isLinux || this.isFreeBSD || this.isOpenBSD) {
      return process.env.SHELL || '/bin/bash';
    }
    return process.env.SHELL || '/bin/sh';
  }

  /** Shell arguments to run a single command string. */
  shellExecArgs(command) {
    if (this.isWindows) {
      // PowerShell
      if (this.defaultShell().toLowerCase().includes('powershell')) {
        return ['-NoProfile', '-NonInteractive', '-Command', command];
      }
      // cmd.exe
      return ['/d', '/s', '/c', command];
    }
    // POSIX & Termux
    return ['-c', command];
  }

  /** Path separator used by the OS shell. */
  pathSeparator() {
    return this.isWindows ? ';' : ':';
  }

  /** Default home directory (works on Termux too). */
  homeDir() {
    if (this.isAndroidTermux && process.env.HOME) return process.env.HOME;
    return os.homedir();
  }

  /** Temp directory. */
  tmpDir() {
    if (this.isAndroidTermux) {
      const t = path.join(this.homeDir(), '.oac-tmp');
      try { fs.mkdirSync(t, { recursive: true }); } catch (_) {}
      return t;
    }
    return os.tmpdir();
  }

  /** Where to store the connector's state file (PID, port, code, etc.). */
  stateFile() {
    const dir = this.isWindows
      ? (process.env.LOCALAPPDATA || path.join(this.homeDir(), 'AppData', 'Local'))
      : this.isAndroidTermux
        ? path.join(this.homeDir(), '.onlineagent')
        : path.join(this.homeDir(), '.local', 'state');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    return path.join(dir, 'onlineagent-connector.json');
  }

  /** A short human-readable platform label for banners. */
  label() {
    if (this.isAndroidTermux) return `Android/Termux (${this.arch})`;
    if (this.isWindows) return `Windows (${this.arch})`;
    if (this.isMac) return `macOS (${this.arch})`;
    if (this.isLinux) return `Linux (${this.arch})`;
    if (this.isFreeBSD) return `FreeBSD (${this.arch})`;
    if (this.isOpenBSD) return `OpenBSD (${this.arch})`;
    return `${this.platform} (${this.arch})`;
  }

  /** Whether the current process has a TTY (matters for QR codes & colors). */
  hasTty() {
    return process.stdout.isTTY === true;
  }

  /** Useful diagnostics for the `onlineagent info` subcommand. */
  diagnostics() {
    return {
      platform: this.platform,
      arch: this.arch,
      label: this.label(),
      isWindows: this.isWindows,
      isMac: this.isMac,
      isLinux: this.isLinux,
      isAndroidTermux: this.isAndroidTermux,
      isPosix: this.isPosix,
      nodeVersion: process.versions.node,
      shell: this.defaultShell(),
      home: this.homeDir(),
      tmp: this.tmpDir(),
      stateFile: this.stateFile(),
      cwd: process.cwd(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      uptimeH: Math.round(os.uptime() / 3600),
    };
  }
}

module.exports = Platform;
