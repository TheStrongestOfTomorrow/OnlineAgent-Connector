'use strict';

/**
 * AI agent protocol — JSON-RPC 2.0 over WebSocket.
 *
 * Requests look like:
 *   { "jsonrpc": "2.0", "id": "1", "method": "shell.exec", "params": { "command": "ls -la" } }
 *
 * Responses look like:
 *   { "jsonrpc": "2.0", "id": "1", "result": { ... } }
 *   { "jsonrpc": "2.0", "id": "1", "error": { "code": -32000, "message": "..." } }
 *
 * Server may also push notifications (no id):
 *   { "jsonrpc": "2.0", "method": "agent.connected", "params": { ... } }
 *
 * Methods:
 *   - ping                         -> { pong: true, serverTime }
 *   - auth                         -> { ok }  (authenticates the WS with the pairing code)
 *   - sys.info                     -> system snapshot
 *   - sys.diskUsage                -> disk usage of cwd
 *   - shell.exec                   -> { command, cwd?, env?, timeoutMs?, stdin? }
 *   - fs.read                      -> { path, encoding? }
 *   - fs.write                     -> { path, content, mode? }
 *   - fs.list                      -> { path? }
 *   - fs.stat                      -> { path }
 *   - fs.rm                        -> { path, recursive? }
 *   - fs.mkdir                     -> { path, recursive? }
 *   - fs.rename                    -> { from, to }
 *   - fs.copy                      -> { from, to }
 *   - fs.tree                      -> { path?, maxDepth? }
 *   - agent.list                   -> list of connected agents
 *   - agent.whoami                 -> { agentId }
 *
 * First message from the agent MUST be `auth` with the correct code,
 * otherwise the server closes the connection after 5 seconds.
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
  constructor({ auth, executor, fsApi, sysInfo, logger, serverId }) {
    this.auth = auth;
    this.executor = executor;
    this.fsApi = fsApi;
    this.sysInfo = sysInfo;
    this.logger = logger;
    this.serverId = serverId || crypto.randomUUID();
  }

  /** Build a JSON-RPC error response. */
  errorResponse(id, code, message, data) {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: { code, message, data },
    };
  }

  /** Build a JSON-RPC success response. */
  successResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  /** Build a notification (no id). */
  notification(method, params) {
    return { jsonrpc: '2.0', method, params };
  }

  /**
   * Handle a parsed JSON-RPC request.
   * `ctx` = { ws, agentId, authenticated, setState }
   */
  async handleRequest(req, ctx) {
    if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || !req.method) {
      return this.errorResponse(req && req.id, ERROR_CODES.INVALID_REQUEST, 'Invalid Request');
    }
    const id = req.id ?? null;
    const method = req.method;
    const params = req.params || {};

    // Methods that don't require prior auth:
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
      return this.successResponse(id, { ok: true, agentId, serverId: this.serverId });
    }

    // All other methods require prior auth
    if (!ctx.state.authenticated) {
      return this.errorResponse(id, ERROR_CODES.UNAUTHORIZED, 'Not authenticated. Send an "auth" request first.');
    }

    try {
      switch (method) {
        case 'agent.whoami':
          return this.successResponse(id, { agentId: ctx.state.agentId, serverId: this.serverId });

        case 'agent.list':
          return this.successResponse(id, {
            agents: Array.from(this.auth.connectedAgents.entries()).map(([id, a]) => ({
              agentId: id, connectedAt: a.connectedAt,
            })),
            count: this.auth.agentCount(),
          });

        case 'sys.info':
          return this.successResponse(id, this.sysInfo.snapshot());

        case 'sys.diskUsage':
          return this.successResponse(id, this.sysInfo.diskUsage() || {});

        case 'shell.exec': {
          if (!this.executor.isAllowed()) {
            return this.errorResponse(id, ERROR_CODES.CAPABILITY_DISABLED, 'Shell is disabled.');
          }
          if (typeof params.command !== 'string') {
            return this.errorResponse(id, ERROR_CODES.INVALID_PARAMS, 'params.command required');
          }
          const result = await this.executor.exec(params.command, {
            timeoutMs: params.timeoutMs,
            cwd: params.cwd,
            env: params.env,
            stdin: params.stdin,
          });
          return this.successResponse(id, result);
        }

        case 'fs.read':
          return this.successResponse(id, await this.fsApi.read(params.path, { encoding: params.encoding || 'utf8' }));
        case 'fs.write':
          return this.successResponse(id, await this.fsApi.write(params.path, params.content, { mode: params.mode }));
        case 'fs.list':
          return this.successResponse(id, await this.fsApi.list(params.path || '.'));
        case 'fs.stat':
          return this.successResponse(id, await this.fsApi.stat(params.path));
        case 'fs.rm':
          return this.successResponse(id, await this.fsApi.rm(params.path, { recursive: !!params.recursive }));
        case 'fs.mkdir':
          return this.successResponse(id, await this.fsApi.mkdir(params.path, { recursive: params.recursive !== false }));
        case 'fs.rename':
          return this.successResponse(id, await this.fsApi.rename(params.from, params.to));
        case 'fs.copy':
          return this.successResponse(id, await this.fsApi.copy(params.from, params.to));
        case 'fs.tree':
          return this.successResponse(id, await this.fsApi.tree(params.path || '.', { maxDepth: params.maxDepth || 3 }));

        default:
          return this.errorResponse(id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
    } catch (e) {
      return this.errorResponse(id, ERROR_CODES.INTERNAL_ERROR, e.message);
    }
  }
}

module.exports = { AgentProtocol, ERROR_CODES };
