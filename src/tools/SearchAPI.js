'use strict';

/**
 * Search tools.
 *   - search.files -> find files by name pattern under cwd
 *   - search.grep  -> search file contents by regex under cwd
 *   - search.find  -> alias for search.files with more options
 *
 * Pure Node.js — no external `find` / `grep` / `rg` required, so it
 * works identically on Windows, Termux, etc.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const MAX_RESULTS = 1000;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // skip files larger than 2 MiB for grep

class SearchAPI {
  constructor({ cwd, capabilities }) {
    this.cwd = path.resolve(cwd);
    this.capabilities = capabilities;
  }

  /** Convert a glob-ish pattern to a RegExp. Supports * and ?. */
  _globToRe(pattern) {
    if (!pattern) return null;
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp('^' + escaped + '$', 'i');
  }

  async files({ pattern = '*', path: root = '.', maxDepth = 10, includeDirs = true } = {}) {
    const rootAbs = path.resolve(this.cwd, root);
    const rel = path.relative(this.cwd, rootAbs);
    if (rel.startsWith('..')) throw new Error('Path outside sandbox: ' + root);

    const re = this._globToRe(pattern);
    const results = [];

    const walk = async (dir, depth) => {
      if (depth > maxDepth || results.length >= MAX_RESULTS) return;
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); }
      catch (_) { return; }
      for (const e of entries) {
        if (results.length >= MAX_RESULTS) break;
        const abs = path.join(dir, e.name);
        const rel = path.relative(this.cwd, abs);
        if (e.isDirectory()) {
          if (includeDirs && (!re || re.test(e.name))) {
            results.push({ path: rel, type: 'dir' });
          }
          // skip node_modules, .git, etc.
          if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== '.svn') {
            await walk(abs, depth + 1);
          }
        } else if (e.isFile()) {
          if (!re || re.test(e.name)) {
            results.push({ path: rel, type: 'file' });
          }
        }
      }
    };

    await walk(rootAbs, 0);
    return { pattern, root, count: results.length, files: results };
  }

  async grep({ pattern, path: root = '.', maxResults = 200, ignoreCase = false, multiline = false } = {}) {
    if (!pattern) throw new Error('params.pattern (regex) required');
    const re = new RegExp(pattern, (ignoreCase ? 'i' : '') + (multiline ? 'm' : '') + 'g');
    const rootAbs = path.resolve(this.cwd, root);
    const rel = path.relative(this.cwd, rootAbs);
    if (rel.startsWith('..')) throw new Error('Path outside sandbox: ' + root);

    const matches = [];

    const walk = async (dir) => {
      if (matches.length >= maxResults) return;
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); }
      catch (_) { return; }
      for (const e of entries) {
        if (matches.length >= maxResults) break;
        const abs = path.join(dir, e.name);
        const rel = path.relative(this.cwd, abs);
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.git') continue;
          await walk(abs);
        } else if (e.isFile()) {
          try {
            const st = await stat(abs);
            if (st.size > MAX_FILE_SIZE_BYTES) continue;
            const content = fs.readFileSync(abs, 'utf8');
            let m;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              re.lastIndex = 0;
              if (re.test(lines[i])) {
                matches.push({
                  path: rel,
                  line: i + 1,
                  text: lines[i].slice(0, 500),
                });
              }
            }
          } catch (_) {}
        }
      }
    };

    await walk(rootAbs);
    return { pattern, count: matches.length, matches };
  }

  async find({ pattern, path: root = '.', maxDepth = 10 } = {}) {
    return this.files({ pattern, root, maxDepth });
  }
}

module.exports = SearchAPI;
