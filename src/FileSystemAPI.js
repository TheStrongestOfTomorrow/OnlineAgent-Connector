'use strict';

/**
 * Sandboxed file system API for AI agents.
 *
 * All paths are resolved relative to `cwd` and must stay inside it.
 * Honors the `write` capability flag.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const os = require('os');

const fsp = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  readdir: promisify(fs.readdir),
  stat: promisify(fs.stat),
  unlink: promisify(fs.unlink),
  mkdir: promisify(fs.mkdir),
  rename: promisify(fs.rename),
  copyFile: promisify(fs.copyFile),
};

const MAX_READ_BYTES = 4 * 1024 * 1024; // 4 MiB
const MAX_WRITE_BYTES = 16 * 1024 * 1024; // 16 MiB

class FileSystemAPI {
  constructor({ cwd, capabilities }) {
    this.cwd = path.resolve(cwd);
    this.capabilities = capabilities;
  }

  /** Resolve and sandbox-check a path. Throws on escape. */
  _safe(p, { mustExist = false } = {}) {
    const resolved = path.isAbsolute(p) ? path.resolve(p) : path.resolve(this.cwd, p);
    const rel = path.relative(this.cwd, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path is outside the working directory: ${p}`);
    }
    if (mustExist && !fs.existsSync(resolved)) {
      throw new Error(`Not found: ${p}`);
    }
    return resolved;
  }

  async read(p, { encoding = 'utf8' } = {}) {
    const full = this._safe(p, { mustExist: true });
    const stat = await fsp.stat(full);
    if (stat.size > MAX_READ_BYTES) {
      throw new Error(`File too large (${stat.size} bytes > ${MAX_READ_BYTES}).`);
    }
    const buf = await fsp.readFile(full);
    return { path: p, size: stat.size, mtime: stat.mtimeMs, content: buf.toString(encoding) };
  }

  async write(p, content, { mode = 0o644 } = {}) {
    if (!this.capabilities.write) {
      throw new Error('Write capability is disabled.');
    }
    if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
      throw new Error('content must be a string or Buffer.');
    }
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    if (buf.length > MAX_WRITE_BYTES) {
      throw new Error(`Write payload too large (${buf.length} > ${MAX_WRITE_BYTES}).`);
    }
    const full = this._safe(p);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, buf, { mode });
    const stat = await fsp.stat(full);
    return { path: p, size: stat.size, mtime: stat.mtimeMs };
  }

  async list(p = '.') {
    const full = this._safe(p, { mustExist: true });
    const entries = await fsp.readdir(full, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      let size = 0, mtime = 0;
      try {
        const st = await fsp.stat(path.join(full, e.name));
        size = st.size; mtime = st.mtimeMs;
      } catch (_) {}
      out.push({
        name: e.name,
        path: path.relative(this.cwd, path.join(full, e.name)),
        type: e.isDirectory() ? 'dir' : (e.isSymbolicLink() ? 'symlink' : 'file'),
        size, mtime,
      });
    }
    return { path: p, entries: out };
  }

  async stat(p) {
    const full = this._safe(p, { mustExist: true });
    const st = await fsp.stat(full);
    return {
      path: p,
      size: st.size,
      mtime: st.mtimeMs,
      ctime: st.ctimeMs,
      mode: st.mode,
      isFile: st.isFile(),
      isDir: st.isDirectory(),
      isSymlink: st.isSymbolicLink(),
    };
  }

  async rm(p, { recursive = false } = {}) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    const full = this._safe(p, { mustExist: true });
    if (recursive) {
      await promisify(fs.rm)(full, { recursive: true, force: true });
    } else {
      await fsp.unlink(full);
    }
    return { path: p, removed: true };
  }

  async mkdir(p, { recursive = true } = {}) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    const full = this._safe(p);
    await fsp.mkdir(full, { recursive });
    return { path: p, created: true };
  }

  async rename(from, to) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    const a = this._safe(from, { mustExist: true });
    const b = this._safe(to);
    await fsp.rename(a, b);
    return { from, to, renamed: true };
  }

  async copy(from, to) {
    if (!this.capabilities.write) throw new Error('Write capability is disabled.');
    const a = this._safe(from, { mustExist: true });
    const b = this._safe(to);
    await fsp.mkdir(path.dirname(b), { recursive: true });
    await fsp.copyFile(a, b);
    return { from, to, copied: true };
  }

  async tree(p = '.', { maxDepth = 3 } = {}) {
    const full = this._safe(p, { mustExist: true });
    const result = [];
    const walk = (dir, depth) => {
      if (depth > maxDepth) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(this.cwd, abs);
        result.push({ path: rel, type: e.isDirectory() ? 'dir' : 'file' });
        if (e.isDirectory() && depth < maxDepth) {
          try { walk(abs, depth + 1); } catch (_) {}
        }
      }
    };
    walk(full, 0);
    return { root: p, entries: result };
  }
}

module.exports = FileSystemAPI;
