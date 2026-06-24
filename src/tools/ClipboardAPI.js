'use strict';

/**
 * System clipboard tools. Cross-platform, best-effort.
 *   - clip.read   -> read from clipboard
 *   - clip.write  -> write to clipboard
 *
 * Backend selection:
 *   - macOS:        pbpaste / pbcopy
 *   - Linux:        xclip / xsel / wl-paste / wl-copy (Wayland)
 *   - Windows:      powershell Get-Clipboard / Set-Clipboard
 *   - Termux:       termux-clipboard-get / termux-clipboard-set (requires Termux:API app)
 *
 * If no backend is available, returns a clear error.
 */

const { execFileSync } = require('child_process');

class ClipboardAPI {
  constructor({ platform }) {
    this.platform = platform;
    this.backend = this._detectBackend();
  }

  _detectBackend() {
    if (this.platform.isMac) return 'mac';
    if (this.platform.isWindows) return 'windows';
    if (this.platform.isAndroidTermux) return 'termux';
    // Linux / FreeBSD: try Wayland, then X11
    try { execFileSync('which', ['wl-copy'], { stdio: 'ignore' }); return 'wayland'; } catch (_) {}
    try { execFileSync('which', ['xclip'], { stdio: 'ignore' }); return 'xclip'; } catch (_) {}
    try { execFileSync('which', ['xsel'], { stdio: 'ignore' }); return 'xsel'; } catch (_) {}
    return null;
  }

  isAvailable() {
    return this.backend !== null;
  }

  read() {
    switch (this.backend) {
      case 'mac':
        return { content: execFileSync('pbpaste', { encoding: 'utf8' }), backend: this.backend };
      case 'windows':
        return { content: execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' }), backend: this.backend };
      case 'termux':
        return { content: execFileSync('termux-clipboard-get', { encoding: 'utf8' }), backend: this.backend };
      case 'wayland':
        return { content: execFileSync('wl-paste', { encoding: 'utf8' }), backend: this.backend };
      case 'xclip':
        return { content: execFileSync('xclip', ['-selection', 'clipboard', '-o'], { encoding: 'utf8' }), backend: this.backend };
      case 'xsel':
        return { content: execFileSync('xsel', ['--clipboard', '--output'], { encoding: 'utf8' }), backend: this.backend };
      default:
        throw new Error('No clipboard backend available on this platform.');
    }
  }

  write({ content }) {
    if (typeof content !== 'string') throw new Error('params.content (string) required');
    switch (this.backend) {
      case 'mac':
        execFileSync('pbcopy', { input: content, encoding: 'utf8' });
        break;
      case 'windows':
        execFileSync('powershell.exe', ['-NoProfile', '-Command', `Set-Clipboard -Value ${JSON.stringify(content)}`], { encoding: 'utf8' });
        break;
      case 'termux':
        execFileSync('termux-clipboard-set', { input: content, encoding: 'utf8' });
        break;
      case 'wayland':
        execFileSync('wl-copy', { input: content, encoding: 'utf8' });
        break;
      case 'xclip':
        execFileSync('xclip', ['-selection', 'clipboard'], { input: content, encoding: 'utf8' });
        break;
      case 'xsel':
        execFileSync('xsel', ['--clipboard', '--input'], { input: content, encoding: 'utf8' });
        break;
      default:
        throw new Error('No clipboard backend available on this platform.');
    }
    return { written: true, length: content.length, backend: this.backend };
  }
}

module.exports = ClipboardAPI;
