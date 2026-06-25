'use strict';

/**
 * Tiny logger that respects `--quiet` and uses ANSI colors when stdout is a TTY.
 * Avoids external dependencies (chalk etc.) for fast `npm i` on Termux.
 */

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgBlack: '\x1b[40m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

class Logger {
  constructor({ quiet = false } = {}) {
    this.quiet = quiet;
    this.useColor = process.stdout.isTTY === true;
  }

  _c(code, text) {
    if (!this.useColor) return text;
    return `${code}${text}${ANSI.reset}`;
  }

  banner(version, platform) {
    if (this.quiet) return;
    const lines = [
      '',
      this._c(ANSI.bold + ANSI.cyan, '  ╔══════════════════════════════════════════════════════╗'),
      this._c(ANSI.bold + ANSI.cyan, '  ║') + this._c(ANSI.bold, '   OnlineAgent-Connector') + this._c(ANSI.gray, ` v${version}`) + this._c(ANSI.bold + ANSI.cyan, '              ║'),
      this._c(ANSI.bold + ANSI.cyan, '  ║') + this._c(ANSI.gray, '   Local hosting for AI agents · pairing-code auth') + this._c(ANSI.bold + ANSI.cyan, '   ║'),
      this._c(ANSI.bold + ANSI.cyan, '  ║') + this._c(ANSI.gray, `   Running on: ${platform.label()}`.padEnd(54)) + this._c(ANSI.bold + ANSI.cyan, '║'),
      this._c(ANSI.bold + ANSI.cyan, '  ╚══════════════════════════════════════════════════════╝'),
      '',
    ];
    lines.forEach((l) => process.stdout.write(l + '\n'));
  }

  info(...args) {
    if (this.quiet) return;
    process.stdout.write(this._c(ANSI.cyan, '[i]') + ' ' + args.join(' ') + '\n');
  }

  success(...args) {
    process.stdout.write(this._c(ANSI.green, '[+]') + ' ' + args.join(' ') + '\n');
  }

  warn(...args) {
    process.stdout.write(this._c(ANSI.yellow, '[!]') + ' ' + args.join(' ') + '\n');
  }

  error(...args) {
    process.stderr.write(this._c(ANSI.red, '[x]') + ' ' + args.join(' ') + '\n');
  }

  hint(...args) {
    if (this.quiet) return;
    process.stdout.write(this._c(ANSI.gray, '[?]') + ' ' + args.join(' ') + '\n');
  }

  agent(message) {
    process.stdout.write(this._c(ANSI.magenta, '[agent]') + ' ' + message + '\n');
  }

  code(code) {
    const pad = '      ' + code.split('').join('  ') + '      ';
    process.stdout.write('\n');
    process.stdout.write(this._c(ANSI.bgBlack + ANSI.bold + ANSI.green, '  ┌──────────────────────┐') + '\n');
    process.stdout.write(this._c(ANSI.bgBlack + ANSI.bold + ANSI.green, '  │') + this._c(ANSI.bgBlack + ANSI.bold, pad) + this._c(ANSI.bgBlack + ANSI.bold + ANSI.green, '│') + '\n');
    process.stdout.write(this._c(ANSI.bgBlack + ANSI.bold + ANSI.green, '  └──────────────────────┘') + '\n');
    process.stdout.write('\n');
  }
}

module.exports = Logger;
