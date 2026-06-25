'use strict';

/**
 * AutoUpdater — fetches update.sh from the public GitHub raw URL and
 * offers to run it if a newer version is available.
 *
 * Why this exists:
 *   Some users delete their ~/.npmrc and then can't reinstall via GitHub
 *   Packages (which always needs a PAT). raw.githubusercontent.com is
 *   public — no PAT needed — so fetching update.sh from there always works.
 *   The script then handles the actual reinstall (npm first, GPR fallback,
 *   Docker last resort).
 *
 * How it works:
 *   1. On TUI launch (or `online-agent update`), fetch update.sh from:
 *        https://raw.githubusercontent.com/TheStrongestOfTomorrow/OnlineAgent-Connector/main/update.sh
 *   2. Parse the `Version: X.Y.Z` line out of the script header.
 *   3. Compare with the currently installed version (from package.json).
 *   4. If remote is newer, prompt the user (in the TUI or via readline).
 *   5. If the user accepts, write the script to a temp file and execute it.
 *
 * The update.sh file in the repo is REPLACED on every release, so there's
 * always only ONE update.sh and it always targets the latest version.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const crypto = require('crypto');

const UPDATE_SH_URL = 'https://raw.githubusercontent.com/TheStrongestOfTomorrow/OnlineAgent-Connector/main/update.sh';
const VERSION_REGEX = /^#\s*Version:\s*(\d+\.\d+\.\d+)\s*$/m;
const FETCH_TIMEOUT_MS = 5000;   // don't block startup longer than this

class AutoUpdater {
  constructor({ currentVersion, logger } = {}) {
    this.currentVersion = currentVersion || require('../package.json').version;
    this.logger = logger || console;
  }

  /**
   * Compare two semver strings (x.y.z).
   * Returns: 1 if a > b, -1 if a < b, 0 if equal.
   */
  static compareVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
  }

  /**
   * Fetch update.sh from the public raw URL.
   * Returns { script, version } or null on failure.
   */
  async fetchLatest() {
    return new Promise((resolve) => {
      const req = https.get(UPDATE_SH_URL, { timeout: FETCH_TIMEOUT_MS }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const script = Buffer.concat(chunks).toString('utf8');
          const m = script.match(VERSION_REGEX);
          if (!m) {
            resolve(null);
            return;
          }
          resolve({ script, version: m[1] });
        });
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
    });
  }

  /**
   * Check for updates. Returns:
   *   { updateAvailable: false }                       — no update needed
   *   { updateAvailable: true, latestVersion, script } — update available
   *   { error: 'message' }                              — check failed
   */
  async check() {
    const fetched = await this.fetchLatest();
    if (!fetched) {
      return { error: 'Could not fetch update.sh (network issue or repo unavailable).' };
    }
    const cmp = AutoUpdater.compareVersions(fetched.version, this.currentVersion);
    return {
      updateAvailable: cmp > 0,
      currentVersion: this.currentVersion,
      latestVersion: fetched.version,
      script: fetched.script,
    };
  }

  /**
   * Run the update script.
   * Writes the script to a temp file, makes it executable, and runs it.
   * The script handles the actual install (npm / GPR / Docker fallbacks).
   *
   * @param {string} script  — the update.sh content
   * @param {object} opts    — { sudo: bool, onOutput: (line) => void }
   * @returns {Promise<{ ok: bool, exitCode: number }>}
   */
  async runUpdate(script, opts = {}) {
    const { onOutput = (line) => this.logger.log?.(line) || console.log(line) } = opts;

    // Write to a temp file
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `online-agent-update-${Date.now()}.sh`);
    fs.writeFileSync(tmpFile, script, { mode: 0o755 });

    return new Promise((resolve) => {
      const child = spawn('bash', [tmpFile], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      child.stdout.on('data', (d) => {
        d.toString('utf8').split('\n').filter(Boolean).forEach(onOutput);
      });
      child.stderr.on('data', (d) => {
        d.toString('utf8').split('\n').filter(Boolean).forEach(onOutput);
      });

      child.on('close', (code) => {
        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        resolve({ ok: code === 0, exitCode: code });
      });

      child.on('error', (e) => {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        resolve({ ok: false, exitCode: -1, error: e.message });
      });
    });
  }

  /**
   * Interactive check + prompt + update. Used by the TUI.
   * Calls onPrompt(updateInfo) -> Promise<bool> where the TUI decides.
   *
   * @param {function} onPrompt  — async callback that returns true if user accepts
   * @param {function} onOutput  — line-by-line output during update
   */
  async checkAndPrompt(onPrompt, onOutput) {
    const info = await this.check();
    if (info.error) {
      this.logger.info?.(`Update check skipped: ${info.error}`) || console.log(`[i] Update check skipped: ${info.error}`);
      return { checked: false, error: info.error };
    }
    if (!info.updateAvailable) {
      this.logger.info?.(`Already on latest version (${info.currentVersion}).`) || console.log(`[i] Already on latest version (${info.currentVersion}).`);
      return { checked: true, updateAvailable: false, currentVersion: info.currentVersion };
    }

    this.logger.info?.(`Update available: ${info.currentVersion} → ${info.latestVersion}`) || console.log(`[i] Update available: ${info.currentVersion} → ${info.latestVersion}`);

    const accept = await onPrompt(info);
    if (!accept) {
      return { checked: true, updateAvailable: true, declined: true };
    }

    const result = await this.runUpdate(info.script, { onOutput });
    return { checked: true, updateAvailable: true, accepted: true, ...result };
  }
}

module.exports = AutoUpdater;
