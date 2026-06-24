'use strict';

/**
 * AI agent protocol — JSON-RPC 2.0 over WebSocket.
 *
 * Requests:
 *   { "jsonrpc": "2.0", "id": "1", "method": "shell.exec", "params": { "command": "ls -la" } }
 *
 * Responses:
 *   { "jsonrpc": "2.0", "id": "1", "result": { ... } }
 *   { "jsonrpc": "2.0", "id": "1", "error": { "code": -32000, "message": "..." } }
 *
 * First message from an agent MUST be `auth` with the pairing code.
 *
 * See README "Protocol reference" for the full method list.
 */

const crypto = require('crypto');

const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32000,
  CAPABILITY_DISABLED: -32001,
  FORBIDDEN: -32003,
};

class AgentProtocol {
  constructor({
    auth, executor, fsApi, sysInfo,
    procApi, netApi, gitApi, searchApi, envApi, clipApi, cryptoApi, timeApi,
    agentInteraction, logger, serverId,
  }) {
    this.auth = auth;
    this.executor = executor;
    this.fsApi = fsApi;
    this.sysInfo = sysInfo;
    this.procApi = procApi;
    this.netApi = netApi;
    this.gitApi = gitApi;
    this.searchApi = searchApi;
    this.envApi = envApi;
    this.clipApi = clipApi;
    this.cryptoApi = cryptoApi;
    this.timeApi = timeApi;
    this.agentInteraction = agentInteraction;
    this.logger = logger;
    this.serverId = serverId || crypto.randomUUID();
  }

  errorResponse(id, code, message, data) {
    return { jsonrpc: '2.0', id: id || null, error: { code, message, data } };
  }

  successResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  notification(method, params) {
    return { jsonrpc: '2.0', method, params };
  }

  async handleRequest(req, ctx) {
    if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || !req.method) {
      return this.errorResponse(req && req.id, ERROR_CODES.INVALID_REQUEST, 'Invalid Request');
    }
    const id = req.id ?? null;
    const method = req.method;
    const params = req.params || {};

    // ---- Unauthenticated methods ----
    if (method === 'ping') {
      return this.successResponse(id, { pong: true, serverTime: Date.now(), serverId: this.serverId });
    }
    if (method === 'auth') {
      const ok = this.auth.validate(params.code);
      if (!ok) {
        return this.errorResponse(id, ERROR_CODES.UNAUTHORIZED, 'Invalid or expired pairing code.');
      }
      const agentId = params.agentId || crypto.randomUUID();
      this.auth.registerAgent(agentId, ctx.ws);
      ctx.setState({ authenticated: true, agentId });
      this.logger.agent(`Authenticated (id=${agentId})`);
      this.agentInteraction.emit('agent:connect', { agentId, timestamp: Date.now() });
      return this.successResponse(id, { ok: true, agentId, serverId: this.serverId });
    }

    // ---- All further methods require prior auth ----
    if (!ctx.state.authenticated) {
      return this.errorResponse(id, ERROR_CODES.UNAUTHORIZED, 'Not authenticated. Send an "auth" request first.');
    }

    const agentId = ctx.state.agentId;

    try {
      switch (method) {
        // ---- Agent interaction (the magic that makes the AI talk back in the TUI) ----
        case 'agent.whoami':
          return this.successResponse(id, { agentId, serverId: this.serverId });
        case 'agent.list':
          return this.successResponse(id, {
            agents: Array.from(this.auth.connectedAgents.entries()).map(([aid, a]) => ({
              agentId: aid, connectedAt: a.connectedAt,
            })),
            count: this.auth.agentCount(),
          });
        case 'agent.message':
          return this.successResponse(id, this.agentInteraction.message({ agentId, ...params }));
        case 'agent.ask':
          return this.successResponse(id, await this.agentInteraction.ask({ agentId, ...params }));
        case 'agent.notify':
          return this.successResponse(id, this.agentInteraction.notify(params));
        case 'agent.progress':
          return this.successResponse(id, this.agentInteraction.progress({ agentId, ...params }));

        // ---- System ----
        case 'sys.info':
          return this.successResponse(id, this.sysInfo.snapshot());
        case 'sys.diskUsage':
          return this.successResponse(id, this.sysInfo.diskUsage() || {});

        // ---- Shell ----
        case 'shell.exec': {
          if (!this.executor.isAllowed()) {
            return this.errorResponse(id, ERROR_CODES.CAPABILITY_DISABLED, 'Shell is disabled.');
          }
          if (typeof params.command !== 'string') {
            return this.errorResponse(id, ERROR_CODES.INVALID_PARAMS, 'params.command required');
          }
          return this.successResponse(id, await this.executor.exec(params.command, {
            timeoutMs: params.timeoutMs,
            cwd: params.cwd,
            env: params.env,
            stdin: params.stdin,
          }));
        }

        // ---- Filesystem ----
        case 'fs.read':   return this.successResponse(id, await this.fsApi.read(params.path, { encoding: params.encoding || 'utf8' }));
        case 'fs.write':  return this.successResponse(id, await this.fsApi.write(params.path, params.content, { mode: params.mode }));
        case 'fs.list':   return this.successResponse(id, await this.fsApi.list(params.path || '.'));
        case 'fs.stat':   return this.successResponse(id, await this.fsApi.stat(params.path));
        case 'fs.rm':     return this.successResponse(id, await this.fsApi.rm(params.path, { recursive: !!params.recursive }));
        case 'fs.mkdir':  return this.successResponse(id, await this.fsApi.mkdir(params.path, { recursive: params.recursive !== false }));
        case 'fs.rename': return this.successResponse(id, await this.fsApi.rename(params.from, params.to));
        case 'fs.copy':   return this.successResponse(id, await this.fsApi.copy(params.from, params.to));
        case 'fs.tree':   return this.successResponse(id, await this.fsApi.tree(params.path || '.', { maxDepth: params.maxDepth || 3 }));

        // ---- Processes ----
        case 'proc.list': return this.successResponse(id, await this.procApi.list(params));
        case 'proc.kill': return this.successResponse(id, await this.procApi.kill(params));
        case 'proc.tree': return this.successResponse(id, await this.procApi.tree(params));
        case 'proc.me':   return this.successResponse(id, this.procApi.me());

        // ---- Network ----
        case 'net.http':  return this.successResponse(id, await this.netApi.http(params));
        case 'net.dns':   return this.successResponse(id, await this.netApi.dns(params));
        case 'net.ping':  return this.successResponse(id, await this.netApi.ping(params));
        case 'net.ip':    return this.successResponse(id, this.netApi.ip());

        // ---- Git ----
        case 'git.status':    return this.successResponse(id, await this.gitApi.status());
        case 'git.diff':      return this.successResponse(id, await this.gitApi.diff(params));
        case 'git.log':       return this.successResponse(id, await this.gitApi.log(params));
        case 'git.branches':  return this.successResponse(id, await this.gitApi.branches(params));
        case 'git.add':       return this.successResponse(id, await this.gitApi.add(params));
        case 'git.commit':    return this.successResponse(id, await this.gitApi.commit(params));
        case 'git.show':      return this.successResponse(id, await this.gitApi.show(params));
        case 'git.revParse':  return this.successResponse(id, await this.gitApi.revParse(params));

        // ---- Search ----
        case 'search.files':  return this.successResponse(id, await this.searchApi.files(params));
        case 'search.grep':   return this.successResponse(id, await this.searchApi.grep(params));
        case 'search.find':   return this.successResponse(id, await this.searchApi.find(params));

        // ---- Env ----
        case 'env.get':   return this.successResponse(id, this.envApi.get(params));
        case 'env.list':  return this.successResponse(id, this.envApi.list(params));
        case 'env.set':   return this.successResponse(id, this.envApi.set(params));
        case 'env.unset': return this.successResponse(id, this.envApi.unset(params));

        // ---- Clipboard ----
        case 'clip.read':  return this.successResponse(id, this.clipApi.read());
        case 'clip.write': return this.successResponse(id, this.clipApi.write(params));

        // ---- Crypto ----
        case 'crypto.hash':         return this.successResponse(id, this.cryptoApi.hash(params));
        case 'crypto.uuid':         return this.successResponse(id, this.cryptoApi.uuid());
        case 'crypto.random':       return this.successResponse(id, this.cryptoApi.random(params));
        case 'crypto.hmac':         return this.successResponse(id, this.cryptoApi.hmac(params));
        case 'crypto.base64Encode': return this.successResponse(id, this.cryptoApi.base64Encode(params));
        case 'crypto.base64Decode': return this.successResponse(id, this.cryptoApi.base64Decode(params));

        // ---- Time ----
        case 'time.now':   return this.successResponse(id, this.timeApi.now(params));
        case 'time.sleep': return this.successResponse(id, await this.timeApi.sleep(params));

        default:
          return this.errorResponse(id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
    } catch (e) {
      return this.errorResponse(id, ERROR_CODES.INTERNAL_ERROR, e.message);
    }
  }
}

module.exports = { AgentProtocol, ERROR_CODES };
