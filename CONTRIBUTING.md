# Contributing to OnlineAgent-Connector

This document is for **maintainers and contributors**. End users do not need to read this — see [README.md](README.md) for installation and usage.

---

## Development setup

```bash
git clone https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector.git
cd OnlineAgent-Connector
npm install
npm link            # makes `online-agent` available globally on your dev machine
npm test            # runs all 4 test suites (42 assertions)
```

Project layout lives in the README. Source code is in `src/`, tests in `tests/`, the CLI entry point is `bin/cli.js`.

---

## Running tests

```bash
npm test                          # smoke + e2e
node tests/basic.test.js          # core API smoke tests
node tests/e2e.test.js            # full protocol end-to-end
node tests/tools.test.js          # v2.0 tools (proc/net/git/search/env/clip/crypto/time)
node tests/interaction.test.js    # agent.message / agent.ask / agent.notify / agent.progress
```

CI runs the full suite on Node 18/20/22 across Linux, Windows, and macOS on every push and PR (see `.github/workflows/ci.yml`).

---

## Cutting a release

Releases are published to npm via GitHub Actions using npm's [provenance](https://docs.npmjs.com/generating-provenance-statements) feature (OIDC trusted publishing). The workflow lives at `.github/workflows/npm-publish.yml` and triggers when a `v*` tag is pushed.

```bash
# 1. Make sure main is clean and tests pass
npm test
git status

# 2. Bump the version (creates the commit + tag locally)
npm version patch      # or: minor / major

# 3. Push the commit AND the tag
git push --follow-tags

# 4. Watch the run
#    https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector/actions
#    On success, the new version appears at:
#    https://www.npmjs.com/package/online-agent
```

The workflow will:
1. Run the test suite on ubuntu-latest with Node 20
2. Verify the tag version matches `package.json`
3. Publish to npm with `--provenance --access public`
4. Create a GitHub Release with auto-generated release notes

### One-time trusted-publishing setup

This only needs to be done once per repository. It is **already done** for this repo, but documenting here for posterity:

1. **npm side**: Create a Granular Access Token at https://www.npmjs.com/settings/~/tokens with:
   - Expiration ≤ 1 year
   - Packages: `online-agent` (read and write)
   - "Allow access to bypass 2FA" enabled (required for CI to publish non-interactively)
2. **GitHub side**: At https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector/settings/secrets/actions add a repository secret named `NPM_TOKEN` with the token value.
3. Confirm `.github/workflows/npm-publish.yml` has `permissions: id-token: write` and `npm publish --provenance`.

After this, no human ever types an npm token locally — every publish goes through CI with a signed provenance trail.

---

## Versioning

We follow [semver](https://semver.org/):

- **Patch** (2.1.0 → 2.1.1): bug fixes, doc updates, no behavior changes
- **Minor** (2.1.0 → 2.2.0): new tools/methods, new CLI flags, backward-compatible changes
- **Major** (2.1.0 → 3.0.0): breaking protocol changes, breaking CLI renames, removed methods

The `CHANGELOG.md` file must be updated as part of every version bump.

---

## Code style

- Plain CommonJS (`require` / `module.exports`) — no transpilation, no TypeScript, runs on Node ≥ 16 out of the box.
- 2-space indentation, single quotes, trailing commas in multi-line arrays/objects.
- Each module has a JSDoc header explaining what it does and listing its public methods.
- New tools should live in `src/tools/` and follow the pattern of the existing ones (constructor takes `{ platform, cwd, capabilities }`, methods return plain objects, errors thrown as standard `Error`).
- New protocol methods must be:
  1. Added to the relevant tool module
  2. Dispatched in `src/AgentProtocol.js`
  3. Listed in the `/info` HTTP endpoint in `src/Server.js`
  4. Documented in `README.md`'s protocol reference
  5. Covered by a test in `tests/tools.test.js` (or the appropriate suite)

---

## Filing issues

Bugs and feature requests go to https://github.com/TheStrongestOfTomorrow/OnlineAgent-Connector/issues. Please include:

- The output of `online-agent info` (platform diagnostics)
- The connector version (`online-agent --version`)
- The agent client you're using (Node.js example, Python example, custom)
- The exact JSON-RPC request that failed
- The error response you got back
