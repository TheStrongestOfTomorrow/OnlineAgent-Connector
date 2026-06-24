'use strict';

/**
 * Public entry point for the OnlineAgent-Connector.
 *
 * Exports:
 *   - startServer(opts)  -> Promise<Server>
 *   - findRunningServer() -> info object or null (reads the state file)
 *   - stopRunningServer() -> boolean (true if a server was stopped)
 *   - Server, AuthManager, CommandExecutor, FileSystemAPI, SystemInfo, Platform, Logger
 *     (re-exported for programmatic use)
 */

const fs = require('fs');
const Server = require('./Server');
const AuthManager = require('./AuthManager');
const CommandExecutor = require('./CommandExecutor');
const FileSystemAPI = require('./FileSystemAPI');
const SystemInfo = require('./SystemInfo');
const Platform = require('./Platform');
const Logger = require('./Logger');

async function startServer(opts = {}) {
  const platform = opts.platform || new Platform();
  const logger = opts.logger || new Logger({ quiet: !!opts.quiet });
  const server = new Server({
    host: opts.host || '127.0.0.1',
    port: opts.port || 7777,
    cwd: opts.cwd || process.cwd(),
    capabilities: opts.capabilities || { shell: true, write: true },
    code: opts.code,
    logger,
    platform,
  });
  await server.start();
  return server;
}

function findRunningServer() {
  const p = new Platform();
  const f = p.stateFile();
  try {
    if (!fs.existsSync(f)) return null;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    // Check if PID is still alive
    try {
      process.kill(data.pid, 0);
    } catch (_) {
      // PID not alive — clean up stale state
      try { fs.unlinkSync(f); } catch (_) {}
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function stopRunningServer() {
  const info = findRunningServer();
  if (!info) return false;
  try {
    process.kill(info.pid, 'SIGTERM');
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  startServer,
  findRunningServer,
  stopRunningServer,
  Server,
  AuthManager,
  CommandExecutor,
  FileSystemAPI,
  SystemInfo,
  Platform,
  Logger,
};
