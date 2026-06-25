'use strict';

/**
 * Network tools.
 *   - net.http   -> make an HTTP(S) request from the connector host
 *   - net.dns    -> DNS lookup (A / AAAA / MX / TXT / CNAME)
 *   - net.ping   -> best-effort ping (uses system `ping` if available)
 *   - net.ip     -> connector host's local IPs
 */

const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const os = require('os');
const { URL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MiB
const DEFAULT_TIMEOUT_MS = 30_000;

class NetworkAPI {
  constructor({ platform }) {
    this.platform = platform;
  }

  async http({ url, method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, json = false }) {
    if (!url) throw new Error('params.url required');
    let parsed;
    try { parsed = new URL(url); } catch (e) { throw new Error('Invalid URL: ' + e.message); }
    const lib = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const req = lib.request({
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: json && typeof body === 'object' && body !== null
          ? { 'Content-Type': 'application/json', ...headers }
          : headers,
        timeout: timeoutMs,
      }, (res) => {
        const chunks = [];
        let total = 0;
        let truncated = false;
        res.on('data', (d) => {
          if (total + d.length > MAX_RESPONSE_BYTES) {
            chunks.push(d.subarray(0, MAX_RESPONSE_BYTES - total));
            total = MAX_RESPONSE_BYTES;
            truncated = true;
            req.destroy();
          } else {
            chunks.push(d);
            total += d.length;
          }
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let text = buf.toString('utf8');
          let parsedBody;
          if (json) {
            try { parsedBody = JSON.parse(text); } catch (_) {}
          }
          resolve({
            ok: true,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            body: text,
            json: parsedBody,
            truncated,
            durationMs: Date.now() - started,
          });
        });
      });

      const started = Date.now();
      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });
      req.on('error', (e) => {
        resolve({ ok: false, error: e.message, durationMs: Date.now() - started });
      });

      if (body !== undefined && body !== null) {
        const payload = typeof body === 'string' ? body
          : json ? JSON.stringify(body)
          : String(body);
        req.end(payload);
      } else {
        req.end();
      }
    });
  }

  async dns({ hostname, recordType = 'A' }) {
    if (!hostname) throw new Error('params.hostname required');
    const rtype = String(recordType).toUpperCase();
    try {
      const records = await dns.resolve(hostname, rtype);
      return { hostname, recordType: rtype, records };
    } catch (e) {
      // fall back to lookup for A/AAAA
      if (rtype === 'A' || rtype === 'AAAA' || rtype === 'ANY') {
        try {
          const result = await dns.lookup(hostname, { all: true });
          return { hostname, recordType: 'lookup', records: result };
        } catch (e2) {
          return { hostname, recordType: rtype, error: e2.message };
        }
      }
      return { hostname, recordType: rtype, error: e.message };
    }
  }

  async ping({ host, count = 4 }) {
    if (!host) throw new Error('params.host required');
    const isWin = this.platform.isWindows;
    const args = isWin
      ? ['-n', String(count), host]
      : ['-c', String(count), host];
    try {
      const out = await execFileP('ping', args, { timeout: count * 2000 + 5000 });
      return { host, count, output: out.stdout || out.stderr, ok: true };
    } catch (e) {
      // ping may exit non-zero on packet loss but still produce output
      if (e.stdout) return { host, count, output: e.stdout, ok: false, error: e.message };
      return { host, count, ok: false, error: e.message };
    }
  }

  ip() {
    const ifaces = os.networkInterfaces();
    const out = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      for (const a of addrs || []) {
        out.push({ name, family: a.family, address: a.address, internal: a.internal });
      }
    }
    return { interfaces: out };
  }
}

module.exports = NetworkAPI;
