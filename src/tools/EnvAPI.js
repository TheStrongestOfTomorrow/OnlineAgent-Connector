'use strict';

/**
 * Environment variable tools.
 *   - env.get   -> get a single env var
 *   - env.list  -> list all env vars (with optional prefix filter)
 *   - env.set   -> set an env var (only for the connector's process & spawned children — does NOT persist to shell)
 *
 * Note: env.set only affects this process; child processes spawned via
 * shell.exec will inherit the new value.
 */

class EnvAPI {
  constructor({ capabilities }) {
    this.capabilities = capabilities;
  }

  get({ name } = {}) {
    if (!name) throw new Error('params.name required');
    const value = process.env[name];
    return { name, exists: value !== undefined, value: value || null };
  }

  list({ prefix } = {}) {
    const out = [];
    for (const [k, v] of Object.entries(process.env)) {
      if (prefix && !k.startsWith(prefix)) continue;
      out.push({ name: k, value: v });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return { count: out.length, vars: out };
  }

  set({ name, value } = {}) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    if (!name) throw new Error('params.name required');
    process.env[name] = value === null || value === undefined ? '' : String(value);
    return { name, value: process.env[name], set: true };
  }

  unset({ name } = {}) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    if (!name) throw new Error('params.name required');
    delete process.env[name];
    return { name, unset: true };
  }
}

module.exports = EnvAPI;
