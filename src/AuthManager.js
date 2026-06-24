'use strict';

/**
 * Pairing-code generation & validation.
 *
 * Default: 6-digit numeric code (easy to type on a phone in Termux).
 * Optional: alphanumeric or custom code.
 *
 * Codes are short-lived & single-use-per-connection by default.
 */

const crypto = require('crypto');

class AuthManager {
  constructor({ code, ttlMs = 30 * 60 * 1000, maxAgents = 5 } = {}) {
    this.code = code || AuthManager.generateCode();
    this.ttlMs = ttlMs;
    this.maxAgents = maxAgents;
    this.createdAt = Date.now();
    this.connectedAgents = new Map(); // agentId -> { ws, connectedAt }
  }

  static generateCode(length = 6) {
    // cryptographically strong 6-digit code
    const max = Math.pow(10, length);
    const n = parseInt(crypto.randomBytes(4).toString('hex'), 16) % max;
    return String(n).padStart(length, '0');
  }

  /** Validate a presented code; returns true/false. */
  validate(presented) {
    if (!presented || typeof presented !== 'string') return false;
    if (Date.now() - this.createdAt > this.ttlMs) return false;
    // constant-time compare
    const a = Buffer.from(String(presented));
    const b = Buffer.from(String(this.code));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  registerAgent(agentId, ws) {
    if (this.connectedAgents.size >= this.maxAgents) {
      const oldest = this.connectedAgents.keys().next().value;
      this.connectedAgents.delete(oldest);
    }
    this.connectedAgents.set(agentId, { ws, connectedAt: Date.now() });
  }

  unregisterAgent(agentId) {
    this.connectedAgents.delete(agentId);
  }

  agentCount() {
    return this.connectedAgents.size;
  }
}

module.exports = AuthManager;
