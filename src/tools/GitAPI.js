'use strict';

/**
 * Git operations, scoped to the connector's working directory.
 *   - git.status    -> porcelain status
 *   - git.diff      -> unstaged diff
 *   - git.log       -> recent commit log
 *   - git.branches  -> list local branches
 *   - git.add       -> stage files
 *   - git.commit    -> commit staged files
 *   - git.show      -> show a commit
 *
 * All operations run via the system `git` binary.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

class GitAPI {
  constructor({ cwd }) {
    this.cwd = cwd;
  }

  async _git(args, { timeoutMs = 30_000 } = {}) {
    return execFileP('git', args, { cwd: this.cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
  }

  async status() {
    const out = await this._git(['status', '--porcelain=v1', '-b']);
    return { branch: out.stdout.split('\n')[0], status: out.stdout };
  }

  async diff({ staged = false, pathspec } = {}) {
    const args = ['diff'];
    if (staged) args.push('--staged');
    if (pathspec) args.push('--', pathspec);
    const out = await this._git(args);
    return { diff: out.stdout };
  }

  async log({ limit = 20, format = '%h|%an|%ad|%s' } = {}) {
    const out = await this._git(['log', `-${limit}`, `--pretty=format:${format}`, '--date=short']);
    const commits = out.stdout.split('\n').filter(Boolean).map((l) => {
      const [hash, author, date, ...subjectParts] = l.split('|');
      return { hash, author, date, subject: subjectParts.join('|') };
    });
    return { commits, count: commits.length };
  }

  async branches({ remote = false } = {}) {
    const args = ['branch', '--list'];
    if (remote) args.push('--remote');
    const out = await this._git(args);
    const branches = out.stdout.split('\n')
      .map((l) => l.trim().replace(/^\*\s+/, ''))
      .filter(Boolean)
      .map((b) => ({ name: b, current: l => l.startsWith('*') }));
    // Re-parse current properly
    const all = out.stdout.split('\n').filter(Boolean).map((l) => ({
      name: l.trim().replace(/^\*\s+/, ''),
      current: l.trim().startsWith('*'),
    }));
    return { branches: all, count: all.length };
  }

  async add({ paths = ['.'] } = {}) {
    if (!Array.isArray(paths)) paths = [paths];
    const out = await this._git(['add', '--', ...paths]);
    return { added: paths, output: out.stdout || out.stderr };
  }

  async commit({ message }) {
    if (!message) throw new Error('params.message required');
    const out = await this._git(['commit', '-m', message]);
    return { committed: true, output: out.stdout || out.stderr };
  }

  async show({ ref = 'HEAD' } = {}) {
    const out = await this._git(['show', '--stat', ref]);
    return { ref, output: out.stdout };
  }

  async revParse({ ref = 'HEAD' } = {}) {
    const out = await this._git(['rev-parse', ref]);
    return { ref, sha: out.stdout.trim() };
  }
}

module.exports = GitAPI;
