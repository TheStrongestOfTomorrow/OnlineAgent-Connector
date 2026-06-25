'use strict';

/**
 * Persistent config for the connector.
 *
 * Lives at:
 *   Linux/macOS/FreeBSD:   ~/.onlineagent/config.json
 *   Windows:               %USERPROFILE%\\.onlineagent\\config.json
 *   Termux:                ~/.onlineagent/config.json  (already in $HOME)
 *
 * The first time the CLI is invoked with no config, the TUI launches
 * onboarding, which writes this file. After that, subsequent invocations
 * skip onboarding and go straight to the dashboard.
 */

const fs = require('fs');
const path = require('path');
const Platform = require('./Platform');

const DEFAULTS = {
  version: 2,
  onboarded: false,
  server: {
    host: '127.0.0.1',
    port: 7777,
    lan: false,
  },
  capabilities: {
    shell: true,
    write: true,
  },
  codeLength: 6,
  autoStart: true,           // start the server automatically when the TUI launches
  agent: {
    notifyOnMessage: true,   // desktop notification when an agent sends a message
    notifyOnConnect: true,
    bellOnAsk: true,         // terminal bell when an agent asks a question
  },
  ui: {
    theme: 'dark',           // 'dark' | 'light'
    color: 'cyan',
  },
};

class Config {
  constructor() {
    this.platform = new Platform();
    this.dir = path.join(this.platform.homeDir(), '.onlineagent');
    this.file = path.join(this.dir, 'config.json');
    this.data = this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(this.file)) return JSON.parse(JSON.stringify(DEFAULTS));
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      // shallow-merge with defaults so missing keys get filled in
      return {
        ...DEFAULTS,
        ...raw,
        server: { ...DEFAULTS.server, ...(raw.server || {}) },
        capabilities: { ...DEFAULTS.capabilities, ...(raw.capabilities || {}) },
        agent: { ...DEFAULTS.agent, ...(raw.agent || {}) },
        ui: { ...DEFAULTS.ui, ...(raw.ui || {}) },
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  save() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
      return true;
    } catch (e) {
      return false;
    }
  }

  isOnboarded() {
    return !!this.data.onboarded;
  }

  markOnboarded() {
    this.data.onboarded = true;
    this.save();
  }

  get(key) {
    return key.split('.').reduce((o, k) => (o ? o[k] : undefined), this.data);
  }

  set(key, value) {
    const parts = key.split('.');
    const last = parts.pop();
    const obj = parts.reduce((o, k) => {
      if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
      return o[k];
    }, this.data);
    obj[last] = value;
    this.save();
  }

  all() {
    return this.data;
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.save();
  }
}

module.exports = Config;
