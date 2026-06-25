#!/usr/bin/env python3
"""
Example Python AI agent client for OnlineAgent-Connector.

Usage:
    pip install websocket-client
    python examples/python-agent.py ws://127.0.0.1:7777 123456

Then type JSON-RPC method calls interactively:
    sys.info
    shell.exec {"command":"whoami"}
    fs.read {"path":"README.md"}
"""

import sys
import json
import uuid
import threading

try:
    import websocket  # pip install websocket-client
except ImportError:
    print("Please install websocket-client:  pip install websocket-client")
    sys.exit(1)


class AgentClient:
    def __init__(self, url, code):
        self.url = url
        self.code = code
        self.next_id = 1
        self.pending = {}
        self.lock = threading.Lock()
        self.ws = websocket.WebSocketApp(
            url,
            on_message=self._on_message,
            on_error=lambda ws, e: print(f"[agent] socket error: {e}"),
            on_close=lambda ws, code, reason: print(f"[agent] disconnected (code={code} reason={reason})"),
        )

    def _on_message(self, ws, message):
        msg = json.loads(message)
        mid = msg.get("id")
        if mid and mid in self.pending:
            cb = self.pending.pop(mid)
            cb(msg)
        elif msg.get("method"):
            print("[notification]", msg)

    def call(self, method, params=None, timeout=30):
        if params is None:
            params = {}
        with self.lock:
            mid = str(self.next_id)
            self.next_id += 1
        import queue
        q = queue.Queue()
        self.pending[mid] = lambda m: q.put(m)
        self.ws.send(json.dumps({"jsonrpc": "2.0", "id": mid, "method": method, "params": params}))
        return q.get(timeout=timeout)

    def run(self):
        def _open(ws):
            print(f"[agent] connected to {self.url}")
            print(f"[agent] authenticating with code {self.code}…")
            r = self.call("auth", {"code": self.code, "agentId": f"py-{uuid.uuid4().hex[:8]}"})
            if r.get("error"):
                print("[agent] auth failed:", r["error"])
                ws.close()
                return
            print(f"[agent] authenticated ✓ — serverId={r['result']['serverId']} agentId={r['result']['agentId']}")
            print("[agent] type a method name, optionally followed by JSON params. e.g.:")
            print("        sys.info")
            print("        shell.exec {\"command\":\"pwd\"}")
            print("        (Ctrl+D to quit)\n")
            threading.Thread(target=self._repl, daemon=True).start()

        self.ws.on_open = _open
        self.ws.run_forever()

    def _repl(self):
        try:
            while True:
                line = input("agent> ").strip()
                if not line:
                    continue
                sp = line.find(" ")
                if sp > -1:
                    method = line[:sp].strip()
                    rest = line[sp + 1:].strip()
                    try:
                        params = json.loads(rest) if rest else {}
                    except Exception as e:
                        print(f"[error] params must be valid JSON: {e}")
                        continue
                else:
                    method = line
                    params = {}
                try:
                    r = self.call(method, params)
                    print(json.dumps(r.get("result", r), indent=2))
                except Exception as e:
                    print(f"[error] {e}")
        except (EOFError, KeyboardInterrupt):
            self.ws.close()


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "ws://127.0.0.1:7777/"
    code = sys.argv[2] if len(sys.argv) > 2 else "000000"
    AgentClient(url, code).run()
