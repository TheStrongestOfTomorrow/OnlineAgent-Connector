'use strict';

/**
 * Agent <-> User interaction tools.
 *
 * These methods let an AI agent communicate with the human operator
 * directly through the connector's TUI — so the user never has to
 * leave the terminal to see agent output or answer agent questions.
 *
 *   - agent.message   -> agent pushes a chat message to the TUI (fire-and-forget)
 *   - agent.ask       -> agent asks the user a question and waits for the response
 *   - agent.notify    -> desktop notification (best-effort, cross-platform)
 *   - agent.progress  -> update the TUI's "current task" status line
 *
 * The TUI subscribes to these events via the EventEmitter returned by
 * `getEmitter()`. When not running in TUI mode (e.g. `onlineagent start`
 * in plain CLI mode), messages are echoed to stdout and `agent.ask`
 * falls back to a readline prompt — so the protocol works everywhere.
 */

const { EventEmitter } = require('events');
const { execFileSync } = require('child_process');
const os = require('os');

class AgentInteraction extends EventEmitter {
  constructor({ platform, logger, agentConfig = {} }) {
    super();
    this.platform = platform;
    this.logger = logger;
    this.agentConfig = agentConfig;
  }

  /**
   * Push a chat-style message from an agent to the TUI.
   * Fire-and-forget — returns immediately.
   */
  message({ agentId, text, level = 'info' } = {}) {
    if (!text) throw new Error('params.text required');
    const msg = {
      agentId: agentId || 'unknown',
      text: String(text),
      level, // 'info' | 'success' | 'warn' | 'error'
      timestamp: Date.now(),
    };
    this.emit('message', msg);
    return { delivered: true, timestamp: msg.timestamp };
  }

  /**
   * Ask the user a question and wait for a response.
   *
   * In TUI mode: shows a prompt in the chat panel; resolves when the user answers.
   * In CLI mode with a TTY: falls back to a readline prompt on stdin.
   * In non-TTY mode: times out and returns defaultResponse.
   * Times out after `timeoutMs` (default 5 minutes).
   */
  async ask({ agentId, prompt, defaultResponse, timeoutMs = 5 * 60 * 1000 } = {}) {
    if (!prompt) throw new Error('params.prompt required');
    const question = {
      id: Math.random().toString(36).slice(2),
      agentId: agentId || 'unknown',
      prompt: String(prompt),
      defaultResponse,
      timestamp: Date.now(),
    };

    // If a TUI is listening for 'ask' events, let it handle the prompt.
    // Otherwise, fall back to a readline prompt on stdin (only if stdin is a TTY).
    const hasTuiListener = this.listenerCount('ask') > 0;
    const canReadStdin = process.stdin.isTTY === true;

    return new Promise((resolve) => {
      let resolved = false;
      const done = (response, answered = true, timedOut = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        this.removeListener('ask:response', onResponse);
        resolve({ answered, response: response || defaultResponse || '', timedOut });
      };

      const onResponse = (qid, response) => {
        if (qid === question.id) done(response, true, false);
      };
      this.on('ask:response', onResponse);

      const timer = setTimeout(() => {
        done(defaultResponse || '', false, true);
      }, Math.min(timeoutMs, 30 * 60 * 1000));

      // Emit the question so the TUI can display it
      this.emit('ask', question);

      // No TUI listener AND we have a real TTY -> use readline
      if (!hasTuiListener && canReadStdin) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`[agent asks] ${prompt} `, (answer) => {
          rl.close();
          done(answer, true);
        });
      }
      // Otherwise, just wait for either the TUI to call respondToAsk()
      // or the timeout to fire.
    });
  }

  /** TUI calls this to deliver a user's response to an outstanding `ask`. */
  respondToAsk(questionId, response) {
    this.emit('ask:response', questionId, response);
  }

  /**
   * Show a desktop notification (best-effort).
   */
  notify({ title = 'OnlineAgent', body, urgency = 'normal' } = {}) {
    if (!body) throw new Error('params.body required');
    let shown = false;
    let backend = null;
    let error = null;
    try {
      if (this.platform.isMac) {
        execFileSync('osascript', ['-e', `display notification "${String(body).replace(/"/g, '\\"')}" with title "${String(title).replace(/"/g, '\\"')}"`]);
        shown = true; backend = 'osascript';
      } else if (this.platform.isLinux || this.platform.isFreeBSD || this.platform.isOpenBSD) {
        execFileSync('notify-send', ['-u', urgency, title, body], { timeout: 3000 });
        shown = true; backend = 'notify-send';
      } else if (this.platform.isWindows) {
        execFileSync('powershell.exe', ['-NoProfile', '-Command',
          `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.Visible = $true; $notify.ShowBalloonTip(5000, '${title}', '${body}', [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -Seconds 6`], { timeout: 10000 });
        shown = true; backend = 'windows-forms';
      } else if (this.platform.isAndroidTermux) {
        execFileSync('termux-notification', ['--title', title, '--content', body], { timeout: 3000 });
        shown = true; backend = 'termux-notification';
      }
    } catch (e) {
      // Fail silently — notifications are best-effort
      error = e.message;
    }
    // ALWAYS emit so the TUI can show an in-app banner (regardless of native notif success)
    this.emit('notify', { title, body, urgency, timestamp: Date.now() });
    return { shown, backend, error };
  }

  /**
   * Update the TUI's "agent is currently doing X" status line.
   */
  progress({ agentId, status, percent } = {}) {
    const update = {
      agentId: agentId || 'unknown',
      status: status ? String(status) : null,
      percent: typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : null,
      timestamp: Date.now(),
    };
    this.emit('progress', update);
    return { updated: true };
  }
}

module.exports = AgentInteraction;
