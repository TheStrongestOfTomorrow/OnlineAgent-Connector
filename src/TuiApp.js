'use strict';

/**
 * TuiApp — interactive Terminal UI for OnlineAgent-Connector.
 *
 * First run: shows ONBOARDING (welcome, configure port/capabilities, pick a
 * working directory). The onboarding result is persisted to ~/.onlineagent/config.json
 * so subsequent runs go straight to the dashboard.
 *
 * Dashboard tabs (keys 1-6 to switch):
 *   1 Status  - server info, pairing code, URL, connected agents
 *   2 Chat    - chat-style view of agent messages + an input box.
 *               When an agent calls agent.ask, the prompt shows here and the
 *               user's typed reply is delivered back to the agent.
 *   3 Logs    - server log stream
 *   4 Tools   - list of available protocol methods (so the user / agent
 *               knows what's exposed)
 *   5 Settings- change pairing code, toggle capabilities, change port, etc.
 *   6 Help    - usage reference
 *
 * The TUI manages the Server in the background. Pressing `q` or Ctrl-C
 * stops the server and exits.
 *
 * Blessed is used for cross-platform rendering (works on Termux too).
 */

const blessed = require('blessed');
const crypto = require('crypto');
const path = require('path');
const Config = require('./Config');
const Platform = require('./Platform');
const Logger = require('./Logger');
const AutoUpdater = require('./AutoUpdater');
const { startServer } = require('./index');
const pkg = require('../package.json');

const COLORS = {
  bg: '#0a0e14',
  panel: '#0f1620',
  border: '#2a3548',
  text: '#c5d1de',
  dim: '#5a6877',
  accent: '#7aa2f7',
  green: '#9ece6a',
  yellow: '#e0af68',
  red: '#f7768e',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
};

class TuiApp {
  constructor() {
    this.config = new Config();
    this.platform = new Platform();
    this.screen = null;
    this.server = null;
    this.currentTab = 'status';
    this.agentMessages = [];   // { agentId, text, level, timestamp }
    this.logLines = [];
    this.agentProgress = {};   // agentId -> { status, percent }
  }

  async run() {
    if (!this.config.isOnboarded()) {
      await this._runOnboarding();
    }
    await this._runDashboard();
  }

  // ============================================================
  // ONBOARDING
  // ============================================================
  async _runOnboarding() {
    const screen = blessed.screen({
      smartCSR: true,
      title: 'OnlineAgent-Connector — Onboarding',
      fullUnicode: true,
    });
    this.screen = screen;

    const layout = blessed.layout({
      parent: screen,
      width: '100%',
      height: '100%',
      border: { type: 'line', fg: COLORS.accent },
    });

    const header = blessed.box({
      parent: layout,
      width: '100%',
      height: 7,
      tags: true,
      style: { fg: COLORS.text, bg: COLORS.bg },
      content: [
        '{center}{bold}{cyan-fg}╔══════════════════════════════════════════════════════╗{/}',
        '{center}{bold}{cyan-fg}║   Welcome to OnlineAgent-Connector v2.0.0              ║{/}',
        '{center}{bold}{cyan-fg}║   Local hosting for AI agents · TUI edition            ║{/}',
        '{center}{bold}{cyan-fg}╚══════════════════════════════════════════════════════╝{/}',
        '',
        '{center}This onboarding runs only once. After this, just type {bold}onlineagent{/} to launch the dashboard.{/}',
      ].join('\n'),
    });

    // Form
    const form = blessed.form({
      parent: layout,
      keys: true,
      mouse: true,
      left: 1,
      top: 8,
      width: '100%-2',
      height: '100%-9',
      bg: COLORS.bg,
      border: { type: 'line', fg: COLORS.border },
      label: ' Onboarding ',
      style: { label: { fg: COLORS.accent } },
    });

    blessed.text({
      parent: form, left: 2, top: 1, width: '100%-4',
      content: 'TCP port to listen on:',
      style: { fg: COLORS.text },
    });
    const portInput = blessed.textbox({
      parent: form, name: 'port', left: 28, top: 1, width: 8, height: 1,
      inputOnFocus: true, mouse: true, keys: true,
      value: String(this.config.get('server.port')),
      style: { fg: COLORS.text, bg: COLORS.panel, focus: { bg: COLORS.accent, fg: '#000' } },
      border: { type: 'line', fg: COLORS.border },
    });

    blessed.text({
      parent: form, left: 2, top: 3, width: '100%-4',
      content: 'Bind mode: [L]ocalhost only   [N]LAN (other devices on Wi-Fi can connect)',
      style: { fg: COLORS.text },
    });

    blessed.text({
      parent: form, left: 2, top: 5, width: '100%-4',
      content: 'Capabilities:',
      style: { fg: COLORS.text },
    });
    const shellCheckbox = blessed.checkbox({
      parent: form, name: 'shell', left: 4, top: 6, width: 30, height: 1, mouse: true, keys: true,
      text: 'Allow shell.exec (run commands)',
      checked: this.config.get('capabilities.shell'),
      style: { fg: COLORS.text, focus: { fg: COLORS.accent } },
    });
    const writeCheckbox = blessed.checkbox({
      parent: form, name: 'write', left: 4, top: 7, width: 30, height: 1, mouse: true, keys: true,
      text: 'Allow fs.write (modify files)',
      checked: this.config.get('capabilities.write'),
      style: { fg: COLORS.text, focus: { fg: COLORS.accent } },
    });

    blessed.text({
      parent: form, left: 2, top: 9, width: '100%-4',
      content: 'Pairing code length: [4] 4-digit  [6] 6-digit (default)  [8] 8-digit',
      style: { fg: COLORS.text },
    });

    blessed.text({
      parent: form, left: 2, top: 11, width: '100%-4',
      content: 'Working directory (the agent is sandboxed here):',
      style: { fg: COLORS.text },
    });
    const cwdInput = blessed.textbox({
      parent: form, name: 'cwd', left: 4, top: 12, width: '100%-8', height: 1,
      inputOnFocus: true, mouse: true, keys: true,
      value: process.cwd(),
      style: { fg: COLORS.text, bg: COLORS.panel, focus: { bg: COLORS.accent, fg: '#000' } },
      border: { type: 'line', fg: COLORS.border },
    });

    blessed.text({
      parent: form, left: 2, top: 14, width: '100%-4',
      tags: true,
      content: '{yellow-fg}Security tips:{/} Treat the pairing code as a password. Disable shell/write if you only need read-only access.',
      style: { fg: COLORS.dim },
    });

    const hint = blessed.text({
      parent: form, left: 2, bottom: 2, width: '100%-4',
      tags: true,
      content: '{cyan-fg}Tab{/} to navigate · {cyan-fg}Enter{/} on a field to edit · {cyan-fg}S{/} to save & start · {cyan-fg}Q{/} or {cyan-fg}Esc{/} to quit without saving',
      style: { fg: COLORS.dim },
    });

    const status = blessed.text({
      parent: form, left: 2, bottom: 0, width: '100%-4',
      content: '',
      style: { fg: COLORS.yellow },
    });

    // Navigation
    portInput.focus();

    screen.key(['q', 'Q', 'escape', 'C-c'], () => {
      screen.destroy();
      process.exit(0);
    });

    screen.key(['l', 'L'], () => { this.config.set('server.lan', false); status.setContent('{green-fg}✓{/} Bind mode: localhost only'); screen.render(); });
    screen.key(['n', 'N'], () => { this.config.set('server.lan', true);  status.setContent('{green-fg}✓{/} Bind mode: LAN (0.0.0.0)'); screen.render(); });
    screen.key(['4'], () => { this.config.set('codeLength', 4); status.setContent('{green-fg}✓{/} Code length: 4'); screen.render(); });
    screen.key(['6'], () => { this.config.set('codeLength', 6); status.setContent('{green-fg}✓{/} Code length: 6'); screen.render(); });
    screen.key(['8'], () => { this.config.set('codeLength', 8); status.setContent('{green-fg}✓{/} Code length: 8'); screen.render(); });

    const saveAndStart = async () => {
      const port = parseInt(portInput.getValue(), 10) || 7777;
      this.config.set('server.port', port);
      this.config.set('capabilities.shell', shellCheckbox.checked);
      this.config.set('capabilities.write', writeCheckbox.checked);
      this.config.markOnboarded();
      status.setContent('{green-fg}✓{/} Settings saved. Launching dashboard…');
      screen.render();
      await new Promise((r) => setTimeout(r, 600));
      screen.destroy();
      this.screen = null;
    };

    screen.key(['s', 'S'], () => saveAndStart());

    // Also let Enter on the form's last field trigger save
    cwdInput.key(['enter'], () => saveAndStart());

    screen.render();
    // Keep the process alive until screen is destroyed
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        if (this.screen === null) { clearInterval(iv); resolve(); }
      }, 200);
    });
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  async _runDashboard() {
    const screen = blessed.screen({
      smartCSR: true,
      title: 'OnlineAgent-Connector',
      fullUnicode: true,
      autoPadding: true,
    });
    this.screen = screen;

    // ----- Layout: top bar (tabs) | content | bottom bar -----
    const tabBar = blessed.listbar({
      parent: screen,
      keys: false,
      mouse: true,
      top: 0, left: 0, right: 0, height: 3,
      style: { bg: COLORS.bg, item: { fg: COLORS.dim, bg: COLORS.bg }, selected: { fg: COLORS.accent, bg: COLORS.panel } },
      commands: {
        '1 Status': { callback: () => this._switchTab('status') },
        '2 Chat':   { callback: () => this._switchTab('chat') },
        '3 Logs':   { callback: () => this._switchTab('logs') },
        '4 Tools':  { callback: () => this._switchTab('tools') },
        '5 Settings': { callback: () => this._switchTab('settings') },
        '6 Help':   { callback: () => this._switchTab('help') },
      },
    });

    const headerBar = blessed.text({
      parent: screen,
      top: 3, left: 0, right: 0, height: 1,
      tags: true,
      style: { fg: COLORS.dim, bg: COLORS.bg },
      content: this._headerContent(),
    });

    // Container that switches based on tab
    const content = blessed.box({
      parent: screen,
      top: 4, left: 0, right: 0, bottom: 2,
      style: { bg: COLORS.bg },
    });
    this.content = content;

    // Bottom status bar
    const statusBar = blessed.text({
      parent: screen,
      bottom: 0, left: 0, right: 0, height: 1,
      tags: true,
      style: { fg: COLORS.dim, bg: COLORS.bg },
      content: ' {cyan-fg}1-6{/} switch tabs · {cyan-fg}r{/} regenerate code · {cyan-fg}s{/} start/stop server · {cyan-fg}q{/} quit',
    });

    // Build each tab's content
    this._buildStatusTab(content);
    this._buildChatTab(content);
    this._buildLogsTab(content);
    this._buildToolsTab(content);
    this._buildSettingsTab(content);
    this._buildHelpTab(content);

    // Show status tab first
    this._switchTab('status');

    // Global keys
    screen.key(['q', 'Q', 'C-c'], async () => {
      statusBar.setContent('{yellow-fg}Shutting down…{/}');
      screen.render();
      if (this.server) {
        try { await this.server.stop(); } catch (_) {}
      }
      screen.destroy();
      process.exit(0);
    });

    screen.key(['1'], () => this._switchTab('status'));
    screen.key(['2'], () => this._switchTab('chat'));
    screen.key(['3'], () => this._switchTab('logs'));
    screen.key(['4'], () => this._switchTab('tools'));
    screen.key(['5'], () => this._switchTab('settings'));
    screen.key(['6'], () => this._switchTab('help'));

    screen.key(['r'], () => this._regenerateCode());
    screen.key(['s'], () => this._toggleServer());

    // Start the server automatically if configured
    if (this.config.get('autoStart')) {
      await this._startServer();
    }

    // Set up an interval to refresh the status view
    this._refreshTimer = setInterval(() => {
      if (this.currentTab === 'status') this._renderStatusTab();
      headerBar.setContent(this._headerContent());
      screen.render();
    }, 1000);

    screen.render();

    // Background update check — non-blocking, never delays the dashboard
    this._runBackgroundUpdateCheck();

    // Keep alive
    await new Promise(() => {});
  }

  /**
   * Background update check. Runs async after the dashboard is up so it
   * never blocks the TUI from launching. If an update is available, it
   * shows a small banner at the bottom of the screen offering to install.
   */
  async _runBackgroundUpdateCheck() {
    try {
      const updater = new AutoUpdater({
        currentVersion: pkg.version,
        logger: this._tuiLogger(),
      });
      const info = await updater.check();
      if (info.error || !info.updateAvailable) return;

      // Show a non-intrusive update banner
      const updateBanner = blessed.box({
        parent: this.screen,
        bottom: 1, left: 1, right: 1, height: 3,
        border: { type: 'line', fg: COLORS.yellow },
        style: { bg: COLORS.panel, fg: COLORS.text },
        tags: true,
        content: ` {yellow-fg}⬆ Update available:{/} {bold}${info.currentVersion}{/} → {bold}${info.latestVersion}{/}   ` +
                 `{cyan-fg}[U]{/} update now   {cyan-fg}[X]{/} dismiss`,
        hidden: false,
      });

      this._updateInfo = info;
      this._updateBanner = updateBanner;
      this.screen.render();

      // Key handlers
      const onKeypress = (ch, key) => {
        if (!this._updateBanner) {
          this.screen.removeKeyListener('u', onKeypress);
          this.screen.removeKeyListener('x', onKeypress);
          return;
        }
        if (key.name === 'u' || (key.ch === 'u' || key.ch === 'U')) {
          this._performUpdate(info);
        } else if (key.name === 'x' || (key.ch === 'x' || key.ch === 'X')) {
          updateBanner.destroy();
          this._updateBanner = null;
          this._updateInfo = null;
          this.screen.removeKeyListener('u', onKeypress);
          this.screen.removeKeyListener('x', onKeypress);
          this.screen.render();
        }
      };
      this.screen.key(['u', 'x'], onKeypress);
    } catch (_) {
      // Silent failure — update checks should never break the TUI
    }
  }

  async _performUpdate(info) {
    if (this._updateBanner) {
      this._updateBanner.setContent(' {yellow-fg}⬆ Updating…{/} this may take a minute. Do not close the terminal.');
      this.screen.render();
    }
    const updater = new AutoUpdater({ currentVersion: pkg.version, logger: this._tuiLogger() });
    const onOutput = (line) => {
      if (this._updateBanner) {
        // Strip ANSI for display in the banner
        const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
        this._updateBanner.setContent(` {yellow-fg}⬆${stripped.slice(0, 80)}{/}`);
        this.screen.render();
      }
      if (this.logsBox) {
        this._pushLog('{cyan-fg}[update]{/} ' + line);
      }
    };
    const result = await updater.runUpdate(info.script, { onOutput });
    if (result.ok) {
      if (this._updateBanner) {
        this._updateBanner.destroy();
        this._updateBanner = null;
      }
      // Show success message
      const successBox = blessed.message({
        parent: this.screen,
        border: { type: 'line', fg: COLORS.green },
        style: { bg: COLORS.bg, fg: COLORS.green },
        tags: true,
        height: 'shrink',
        width: '50%',
        top: 'center',
        left: 'center',
        label: ' Update complete ',
      });
      successBox.display('Update complete. Restart online-agent to use the new version.', 3, () => {
        process.exit(0);
      });
      this.screen.render();
    } else {
      if (this._updateBanner) {
        this._updateBanner.setContent(` {red-fg}⬆ Update failed (exit ${result.exitCode}).{/} See Logs tab. {cyan-fg}[X]{/} dismiss`);
        this.screen.render();
      }
    }
  }

  _tuiLogger() {
    return {
      info: (...a) => this._pushLog('{cyan-fg}[update]{/} ' + a.join(' ')),
      warn: (...a) => this._pushLog('{yellow-fg}[update]{/} ' + a.join(' ')),
      error: (...a) => this._pushLog('{red-fg}[update]{/} ' + a.join(' ')),
    };
  }

  _headerContent() {
    const c = this.config.all();
    const running = this.server ? '{green-fg}● running{/}' : '{red-fg}○ stopped{/}';
    const code = this.server ? this.server.auth.code : '------';
    const port = c.server.port;
    return ` ${running}  {cyan-fg}port ${port}{/}  {yellow-fg}code: ${code}{/}  {dim-fg}cwd: ${c.server.cwd || process.cwd()}{/}`;
  }

  // ---- Tab content builders ----
  _buildStatusTab(parent) {
    this.statusBox = blessed.box({
      parent, hidden: false, top: 0, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: COLORS.border },
      label: ' Status ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true, alwaysScroll: true,
      content: 'Loading…',
    });
  }

  _buildChatTab(parent) {
    this.chatLog = blessed.log({
      parent, hidden: true, top: 0, left: 0, right: 0, bottom: 3,
      border: { type: 'line', fg: COLORS.border },
      label: ' Chat (agent messages appear here live) ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true, alwaysScroll: true,
    });

    this.chatInput = blessed.textbox({
      parent, hidden: true, bottom: 0, left: 0, right: 0, height: 3,
      border: { type: 'line', fg: COLORS.border },
      label: ' Type a message / response (Enter to send) ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      inputOnFocus: true,
    });

    this.chatInput.key(['enter'], () => {
      const text = this.chatInput.getValue();
      if (!text) return;
      this.chatInput.clearValue();
      // If there's an outstanding agent.ask, respond to it
      if (this._pendingAsk) {
        const { id, agentId } = this._pendingAsk;
        this._pendingAsk = null;
        this.server.agentInteraction.respondToAsk(id, text);
        this.chatLog.log(`{green-fg}you → ${agentId}{/}: ${text}`);
      } else {
        this.chatLog.log(`{green-fg}you{/}: ${text} {dim-fg}(no agent is asking — start an agent and use agent.ask){/}`);
      }
      this.screen.render();
    });
  }

  _buildLogsTab(parent) {
    this.logsBox = blessed.log({
      parent, hidden: true, top: 0, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: COLORS.border },
      label: ' Logs ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true, alwaysScroll: true,
    });
  }

  _buildToolsTab(parent) {
    this.toolsBox = blessed.box({
      parent, hidden: true, top: 0, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: COLORS.border },
      label: ' Available tools (exposed to AI agents via JSON-RPC) ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true,
      content: this._toolsContent(),
    });
  }

  _buildSettingsTab(parent) {
    this.settingsBox = blessed.box({
      parent, hidden: true, top: 0, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: COLORS.border },
      label: ' Settings ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true,
      content: this._settingsContent(),
    });
  }

  _buildHelpTab(parent) {
    this.helpBox = blessed.box({
      parent, hidden: true, top: 0, left: 0, right: 0, bottom: 0,
      border: { type: 'line', fg: COLORS.border },
      label: ' Help ',
      style: { bg: COLORS.bg, fg: COLORS.text, label: { fg: COLORS.accent } },
      tags: true,
      scrollable: true, keys: true, mouse: true,
      content: this._helpContent(),
    });
  }

  _switchTab(name) {
    this.currentTab = name;
    ['statusBox', 'chatLog', 'chatInput', 'logsBox', 'toolsBox', 'settingsBox', 'helpBox'].forEach((b) => {
      if (this[b]) this[b].hide();
    });
    if (name === 'status') { this.statusBox.show(); this._renderStatusTab(); }
    else if (name === 'chat') { this.chatLog.show(); this.chatInput.show(); this.chatInput.focus(); }
    else if (name === 'logs') this.logsBox.show();
    else if (name === 'tools') this.toolsBox.show();
    else if (name === 'settings') this.settingsBox.show();
    else if (name === 'help') this.helpBox.show();
    this.screen.render();
  }

  _renderStatusTab() {
    if (!this.server) {
      this.statusBox.setContent('{yellow-fg}Server is not running.{/}\n\nPress {cyan-fg}s{/} to start it, or {cyan-fg}q{/} to quit.');
      return;
    }
    const s = this.server;
    const info = s.sysInfo.snapshot();
    const du = s.sysInfo.diskUsage() || {};
    const agentList = Array.from(s.auth.connectedAgents.entries()).map(([id, a]) => {
      const ago = Math.round((Date.now() - a.connectedAt) / 1000);
      return `  • {magenta-fg}${id}{/}  (connected ${ago}s ago)`;
    }).join('\n') || '  {dim-fg}(no agents connected){/}';

    const progressLines = Object.entries(this.agentProgress).map(([aid, p]) => {
      const bar = p.percent !== null
        ? '[' + '#'.repeat(Math.floor(p.percent / 5)).padEnd(20, '-') + '] ' + p.percent + '%'
        : '(no percent)';
      return `  {magenta-fg}${aid}{/}: ${p.status || 'idle'}  {dim-fg}${bar}{/}`;
    }).join('\n');

    this.statusBox.setContent([
      '{bold}{cyan-fg}Server{/}',
      `  State:        {green-fg}running{/}  (uptime ${Math.round((Date.now() - s.startedAt) / 1000)}s)`,
      `  Listening on: ${s.host === '0.0.0.0' ? '0.0.0.0 (LAN)' : s.host}:${s.port}`,
      `  Server ID:    {dim-fg}${s.serverId}{/}`,
      `  Working dir:  ${s.cwd}`,
      `  Capabilities: shell=${s.capabilities.shell ? '{green-fg}yes{/}' : '{red-fg}no{/}'}, write=${s.capabilities.write ? '{green-fg}yes{/}' : '{red-fg}no{/}'}`,
      '',
      '{bold}{cyan-fg}Pairing code{/}  {dim-fg}(expires in 30 min, or press r to regenerate){/}',
      `  {bold}{yellow-fg}${s.auth.code}{/}`,
      '',
      '{bold}{cyan-fg}Connection URLs{/}',
      `  Local:   ws://127.0.0.1:${s.port}/`,
      s.host === '0.0.0.0' && info.networkInterfaces && Object.keys(info.networkInterfaces).length > 0
        ? `  LAN:     ws://${info.networkInterfaces[Object.keys(info.networkInterfaces)[0]][0].address}:${s.port}/`
        : '  LAN:     (use --lan or set "Bind mode: LAN" in settings)',
      `  Health:  http://127.0.0.1:${s.port}/health`,
      `  Info:    http://127.0.0.1:${s.port}/info`,
      '',
      '{bold}{cyan-fg}Connected agents{/}',
      agentList,
      '',
      '{bold}{cyan-fg}Agent activity{/}',
      progressLines || '  {dim-fg}(no agent activity yet){/}',
      '',
      '{bold}{cyan-fg}System{/}',
      `  Platform: ${info.label}  ·  CPU: ${info.cpuModel} (${info.cpuCount} cores)`,
      `  Memory:   ${info.freeMemoryMB} MB free / ${info.totalMemoryMB} MB total`,
      `  Disk:     ${du.usedMB !== undefined ? du.usedMB + ' MB used / ' + du.freeMB + ' MB free' : 'n/a'}`,
    ].join('\n'));
  }

  _toolsContent() {
    return [
      '{bold}{cyan-fg}Auth & agent interaction{/}',
      '  ping, auth, agent.whoami, agent.list',
      '  {yellow-fg}agent.message{/}  — push a chat message to the TUI (fire-and-forget)',
      '  {yellow-fg}agent.ask{/}      — ask the user a question and wait for a response',
      '  {yellow-fg}agent.notify{/}   — show a desktop notification',
      '  {yellow-fg}agent.progress{/} — update the TUI status line with current task',
      '',
      '{bold}{cyan-fg}System{/}',
      '  sys.info, sys.diskUsage',
      '',
      '{bold}{cyan-fg}Shell{/}',
      '  shell.exec  {dim-fg}(gated by --allow-shell){/}',
      '',
      '{bold}{cyan-fg}Filesystem{/}  {dim-fg}(sandboxed to cwd){/}',
      '  fs.read, fs.write, fs.list, fs.stat, fs.rm, fs.mkdir, fs.rename, fs.copy, fs.tree',
      '',
      '{bold}{cyan-fg}Processes{/}',
      '  proc.list, proc.kill, proc.tree, proc.me',
      '',
      '{bold}{cyan-fg}Network{/}',
      '  net.http  {dim-fg}(make HTTP/HTTPS requests from the connector host){/}',
      '  net.dns, net.ping, net.ip',
      '',
      '{bold}{cyan-fg}Git{/}  {dim-fg}(operates in cwd){/}',
      '  git.status, git.diff, git.log, git.branches, git.add, git.commit, git.show, git.revParse',
      '',
      '{bold}{cyan-fg}Search{/}',
      '  search.files  {dim-fg}(glob pattern){/}',
      '  search.grep   {dim-fg}(regex pattern, scans file contents){/}',
      '',
      '{bold}{cyan-fg}Environment variables{/}',
      '  env.get, env.list, env.set, env.unset',
      '',
      '{bold}{cyan-fg}Clipboard{/}  {dim-fg}(cross-platform backend auto-detected){/}',
      '  clip.read, clip.write',
      '',
      '{bold}{cyan-fg}Crypto{/}',
      '  crypto.hash, crypto.uuid, crypto.random, crypto.hmac,',
      '  crypto.base64Encode, crypto.base64Decode',
      '',
      '{bold}{cyan-fg}Time{/}',
      '  time.now, time.sleep',
      '',
      '{dim-fg}Every method is invoked via JSON-RPC 2.0 over WebSocket.{/}',
      '{dim-fg}See README.md for full param/return shapes.{/}',
    ].join('\n');
  }

  _settingsContent() {
    const c = this.config.all();
    return [
      '{bold}{cyan-fg}Current settings{/}  {dim-fg}(edit ~/.onlineagent/config.json to change permanently){/}',
      '',
      `  Port:                ${c.server.port}`,
      `  Bind mode:           ${c.server.lan ? 'LAN (0.0.0.0)' : 'localhost (127.0.0.1)'}`,
      `  Working directory:   ${c.server.cwd || process.cwd()}`,
      `  Allow shell.exec:    ${c.capabilities.shell ? 'yes' : 'no'}`,
      `  Allow fs.write:      ${c.capabilities.write ? 'yes' : 'no'}`,
      `  Pairing code length: ${c.codeLength}`,
      `  Auto-start server:   ${c.autoStart ? 'yes' : 'no'}`,
      '',
      '{bold}{cyan-fg}Quick actions (press the key){/}',
      '  {cyan-fg}r{/} — regenerate pairing code',
      '  {cyan-fg}s{/} — start / stop server',
      '  {cyan-fg}l{/} — toggle LAN mode (requires server restart)',
      '  {cyan-fg}w{/} — toggle write capability (requires server restart)',
      '  {cyan-fg}e{/} — toggle shell capability (requires server restart)',
      '',
      '{dim-fg}Note: settings that affect the server (port, host, capabilities) require a restart.{/}',
    ].join('\n');
  }

  _helpContent() {
    return [
      '{bold}{cyan-fg}OnlineAgent-Connector v2.0.0{/}',
      '',
      '{bold}What this is{/}',
      '  A local server that exposes your terminal, files, and system to AI agents',
      '  over a pairing-code-authenticated WebSocket. Agents speak JSON-RPC 2.0.',
      '',
      '{bold}First run vs. subsequent runs{/}',
      '  The first time you launch OnlineAgent (no args), you see onboarding.',
      '  After that, just typing `online-agent` opens this dashboard directly.',
      '',
      '{bold}Dashboard keys{/}',
      '  1 - Status    : server info, pairing code, connection URL, agent list',
      '  2 - Chat      : live view of agent messages; type replies here when an agent asks',
      '  3 - Logs      : raw server logs',
      '  4 - Tools     : list of methods exposed to agents',
      '  5 - Settings  : current config & quick actions',
      '  6 - Help      : this screen',
      '',
      '  r - regenerate pairing code (agents will need to re-auth)',
      '  s - start / stop the server',
      '  q / Ctrl-C - quit',
      '',
      '{bold}How an AI agent connects{/}',
      '  1. The agent opens a WebSocket to ws://127.0.0.1:7777/',
      '  2. Sends: { method:"auth", params:{ code:"123456" } }',
      '  3. After auth succeeds, calls any method (shell.exec, fs.read, agent.message, ...)',
      '',
      '{bold}How the AI talks back to you (the magic part){/}',
      '  When an agent calls {yellow-fg}agent.message{/}, the text appears in the Chat tab.',
      '  When an agent calls {yellow-fg}agent.ask{/}, the prompt shows in the Chat tab;',
      '  type your reply + Enter — it goes back to the agent as the JSON-RPC result.',
      '  No website, no switching apps — everything happens here.',
      '',
      '{bold}Quick agent test{/}',
      '  In another terminal:',
      '    node examples/node-agent.js ws://127.0.0.1:7777/ 123456',
      '  Then in the agent REPL:',
      '    agent.message {"text":"hello from your AI"}',
      '    agent.ask {"prompt":"What folder should I look at?"}',
      '',
      '{bold}CLI subcommands (still work){/}',
      '  online-agent start [--port 7777] [--lan] [--no-shell] [--no-write]',
      '  online-agent status   # show running server info',
      '  online-agent stop     # stop a running server',
      '  online-agent info     # platform diagnostics',
      '  online-agent --version',
      '',
      '{bold}Cross-platform{/}',
      '  Works on Windows (PowerShell), Linux, macOS, FreeBSD, OpenBSD,',
      '  and Android via Termux. See README for Termux setup.',
      '',
      '{dim-fg}Repo: https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector{/}',
    ].join('\n');
  }

  // ---- Server management ----
  async _startServer() {
    if (this.server) return;
    const c = this.config.all();
    const logger = new Logger({ quiet: true });
    // Hook logger writes into the Logs tab
    const origInfo = logger.info.bind(logger);
    const origWarn = logger.warn.bind(logger);
    const origErr = logger.error.bind(logger);
    const origSuccess = logger.success.bind(logger);
    const origAgent = logger.agent.bind(logger);
    logger.info = (...a) => { this._pushLog('{cyan-fg}[i]{/} ' + a.join(' ')); origInfo(...a); };
    logger.warn = (...a) => { this._pushLog('{yellow-fg}[!]{/} ' + a.join(' ')); origWarn(...a); };
    logger.error = (...a) => { this._pushLog('{red-fg}[x]{/} ' + a.join(' ')); origErr(...a); };
    logger.success = (...a) => { this._pushLog('{green-fg}[+]{/} ' + a.join(' ')); origSuccess(...a); };
    logger.agent = (...a) => { this._pushLog('{magenta-fg}[agent]{/} ' + a.join(' ')); origAgent(...a); };

    try {
      this.server = await startServer({
        host: c.server.lan ? '0.0.0.0' : (c.server.host || '127.0.0.1'),
        port: c.server.port,
        cwd: c.server.cwd || process.cwd(),
        capabilities: c.capabilities,
        logger,
        platform: this.platform,
        agentConfig: c.agent,
      });
      this._wireAgentEvents();
      this._pushLog(`{green-fg}Server started on ${this.server.host}:${this.server.port}, code ${this.server.auth.code}{/}`);
    } catch (e) {
      this._pushLog(`{red-fg}Failed to start server: ${e.message}{/}`);
      this.server = null;
    }
    if (this.screen) this.screen.render();
  }

  async _stopServer() {
    if (!this.server) return;
    try { await this.server.stop(); } catch (_) {}
    this.server = null;
    this._pushLog('{yellow-fg}Server stopped{/}');
    if (this.screen) this.screen.render();
  }

  async _toggleServer() {
    if (this.server) await this._stopServer();
    else await this._startServer();
  }

  _regenerateCode() {
    if (!this.server) {
      this._pushLog('{yellow-fg}Server not running — start it first (press s){/}');
      if (this.screen) this.screen.render();
      return;
    }
    this.server.auth = new (require('./AuthManager'))({
      code: require('./AuthManager').generateCode(this.config.get('codeLength') || 6),
    });
    // Re-register the new auth manager on the protocol
    this.server.protocol.auth = this.server.auth;
    this._pushLog(`{green-fg}New pairing code: ${this.server.auth.code}{/}`);
    if (this.screen) this.screen.render();
  }

  _wireAgentEvents() {
    const ai = this.server.agentInteraction;
    ai.on('message', (msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const levelColor = { info: 'cyan', success: 'green', warn: 'yellow', error: 'red' }[msg.level] || 'cyan';
      this.chatLog.log(`{${levelColor}-fg}[${time}] ${msg.agentId}:{/} ${msg.text}`);
      this.screen.render();
    });
    ai.on('ask', (question) => {
      this._pendingAsk = question;
      const time = new Date(question.timestamp).toLocaleTimeString();
      this.chatLog.log(`{yellow-fg}[${time}] ${question.agentId} asks:{/} ${question.prompt}`);
      this.chatInput.focus();
      this.screen.render();
    });
    ai.on('notify', (n) => {
      this.chatLog.log(`{magenta-fg}[notify] ${n.title}: ${n.body}{/}`);
      this.screen.render();
    });
    ai.on('progress', (p) => {
      this.agentProgress[p.agentId] = p;
      if (this.currentTab === 'status') this._renderStatusTab();
      this.screen.render();
    });
    ai.on('agent:connect', (info) => {
      this.chatLog.log(`{green-fg}✓ Agent connected: ${info.agentId}{/}`);
      this.screen.render();
    });
  }

  _pushLog(line) {
    if (this.logsBox) {
      const time = new Date().toLocaleTimeString();
      this.logsBox.log(`{dim-fg}[${time}]{/} ${line}`);
    }
  }
}

module.exports = TuiApp;
