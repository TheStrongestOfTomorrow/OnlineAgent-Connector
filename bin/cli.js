#!/usr/bin/env node
'use strict';

/**
 * OnlineAgent-Connector CLI entry point (v2.0).
 *
 * Default action (no subcommand): launches the TUI.
 *   - First run: shows onboarding, then dashboard.
 *   - Subsequent runs: goes straight to the dashboard.
 *
 * Subcommands still work for non-interactive use:
 *   onlineagent start [--port 7777] [--host 127.0.0.1] [--lan] [--tunnel]
 *   onlineagent code                       # re-display current pairing code
 *   onlineagent status                     # show server status
 *   onlineagent stop                       # stop a running server
 *   onlineagent info                       # platform diagnostics
 *   onlineagent tui                        # explicitly launch the TUI
 *   onlineagent version
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');
const { startServer, findRunningServer, stopRunningServer } = require('../src/index');
const Platform = require('../src/Platform');
const Logger = require('../src/Logger');
const TuiApp = require('../src/TuiApp');

const program = new Command();

program
  .name('online-agent')
  .description('OnlineAgent-Connector — host a local server so AI agents can connect via a pairing code.')
  .version(pkg.version, '-v, --version', 'print the CLI version');

// Default action: launch TUI when no subcommand is given
program.action(async () => {
  const tui = new TuiApp();
  await tui.run();
});

program
  .command('tui')
  .description('Launch the interactive TUI (default action).')
  .action(async () => {
    const tui = new TuiApp();
    await tui.run();
  });

program
  .command('start')
  .description('Start the local agent-connecting server (no TUI) and print a pairing code.')
  .option('-p, --port <port>', 'TCP port to listen on', '7777')
  .option('-H, --host <host>', 'Hostname / interface to bind', '127.0.0.1')
  .option('--lan', 'Bind to 0.0.0.0 so agents on the same LAN can connect', false)
  .option('--allow-shell', 'Allow the agent to execute shell commands (default: true)', true)
  .option('--no-shell', 'Disable shell command execution entirely')
  .option('--allow-write', 'Allow the agent to write/modify files (default: true)', true)
  .option('--no-write', 'Disallow all file write operations')
  .option('--cwd <dir>', 'Working directory the agent is restricted to', process.cwd())
  .option('--code <code>', 'Use a specific pairing code (default: random 6-digit)')
  .option('--tunnel', 'Print tunnel setup hints (cloudflared / ngrok) so remote agents can connect')
  .option('--qr', 'Print a QR code of the connection URL')
  .option('--quiet', 'Reduce log output')
  .action(async (opts) => {
    const logger = new Logger({ quiet: opts.quiet });
    const platform = new Platform();

    logger.banner(pkg.version, platform);

    const host = opts.lan ? '0.0.0.0' : (opts.host || '127.0.0.1');
    const port = parseInt(opts.port, 10);
    const cwd = path.resolve(opts.cwd || process.cwd());

    if (!fs.existsSync(cwd)) {
      logger.error(`Working directory does not exist: ${cwd}`);
      process.exit(2);
    }

    const capabilities = {
      shell: opts.shell !== false,
      write: opts.write !== false,
    };

    try {
      const server = await startServer({
        host, port, cwd, capabilities,
        code: opts.code, logger, platform,
      });

      server.printConnectionInfo({
        showTunnelHint: opts.tunnel,
        showQr: opts.qr,
      });

      const shutdown = async (signal) => {
        logger.warn(`\nReceived ${signal}, shutting down…`);
        try { await server.stop(); process.exit(0); }
        catch (e) { logger.error('Error during shutdown:', e.message); process.exit(1); }
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGHUP', () => shutdown('SIGHUP'));

      server.writeStateFile();
    } catch (e) {
      logger.error('Failed to start server:', e.message);
      if (e.code === 'EADDRINUSE') {
        logger.hint(`Port ${port} is in use. Try: onlineagent start --port ${port + 1}`);
      }
      process.exit(1);
    }
  });

program
  .command('code')
  .description('Re-display the pairing code of a running server.')
  .action(() => {
    const info = findRunningServer();
    if (!info) {
      console.log('No running OnlineAgent-Connector server found.');
      console.log('Start one with: onlineagent start');
      process.exit(1);
    }
    console.log('Pairing code:', info.code);
    console.log('Connection URL:', info.url);
    console.log('PID:', info.pid);
  });

program
  .command('status')
  .description('Show the status of any running server.')
  .action(() => {
    const info = findRunningServer();
    if (!info) {
      console.log('Status: not running');
      process.exit(0);
    }
    console.log('Status: running');
    console.log('  PID:        ', info.pid);
    console.log('  Port:       ', info.port);
    console.log('  Host:       ', info.host);
    console.log('  Code:       ', info.code);
    console.log('  URL:        ', info.url);
    console.log('  Working dir:', info.cwd);
    console.log('  Started:    ', new Date(info.startedAt).toISOString());
  });

program
  .command('stop')
  .description('Stop a running server (if any).')
  .action(() => {
    const ok = stopRunningServer();
    if (ok) console.log('Server stopped.');
    else console.log('No running server found.');
  });

program
  .command('info')
  .description('Print environment / platform diagnostics (useful for bug reports).')
  .action(() => {
    const p = new Platform();
    console.log(JSON.stringify(p.diagnostics(), null, 2));
  });

program
  .command('update')
  .description('Check for updates and install the latest version if available.')
  .option('--check-only', 'Only check for updates; do not install.', false)
  .option('--force', 'Install the latest version even if already up to date.', false)
  .action(async (opts) => {
    const AutoUpdater = require('../src/AutoUpdater');
    const updater = new AutoUpdater({ currentVersion: pkg.version });
    console.log(`Current version: ${pkg.version}`);
    console.log('Checking for updates…');
    const info = await updater.check();
    if (info.error) {
      console.log('Could not check for updates:', info.error);
      process.exit(1);
    }
    if (!info.updateAvailable && !opts.force) {
      console.log(`Already on the latest version (${info.currentVersion}).`);
      process.exit(0);
    }
    if (opts.checkOnly) {
      console.log(`Update available: ${info.currentVersion} → ${info.latestVersion}`);
      console.log('Run `online-agent update` (without --check-only) to install.');
      process.exit(0);
    }
    console.log(`Update available: ${info.currentVersion} → ${info.latestVersion}`);
    console.log('Downloading and running update.sh…\n');
    const result = await updater.runUpdate(info.script, {
      onOutput: (line) => console.log(line),
    });
    if (result.ok) {
      console.log('\nUpdate complete. Re-run `online-agent` to use the new version.');
      process.exit(0);
    } else {
      console.error(`\nUpdate failed (exit code ${result.exitCode}).`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
