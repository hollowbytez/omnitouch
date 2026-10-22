import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { DEFAULT_BRIDGE_PORT, DEFAULT_BRIDGE_HOST } from "../shared/constants";
import type { CommandMessage, CommandResult, PermissionMode } from "../shared/types";

let extensionSocket: WebSocket | null = null;
let currentMode: PermissionMode = "balanced";
const pendingRequests = new Map<
  string,
  { resolve: (res: CommandResult) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/status" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connected: extensionSocket !== null && extensionSocket.readyState === WebSocket.OPEN,
        activeMode: currentMode,
        timestamp: Date.now()
      })
    );
    return;
  }

  if (url.pathname === "/rpc" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const action = payload.action;
        const cmdPayload = payload.payload || {};
        const result = await dispatchToExtension(action, cmdPayload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

const wss = new WebSocketServer({ server: httpServer, path: "/bridge" });

wss.on("connection", (ws: WebSocket) => {
  extensionSocket = ws;

  ws.on("message", (data: string | Buffer) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === "mode_update") {
        currentMode = parsed.mode;
        return;
      }
      if (parsed.id && pendingRequests.has(parsed.id)) {
        const req = pendingRequests.get(parsed.id)!;
        clearTimeout(req.timer);
        pendingRequests.delete(parsed.id);
        req.resolve(parsed as CommandResult);
      }
    } catch {}
  });

  ws.on("close", () => {
    if (extensionSocket === ws) {
      extensionSocket = null;
    }
  });

  ws.on("error", () => {
    if (extensionSocket === ws) {
      extensionSocket = null;
    }
  });
});

export function dispatchToExtension(action: string, payload: unknown, timeoutMs = 60000): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
      reject(new Error("OmniTouch browser extension is not connected. Open Chrome or Firefox with the extension loaded."));
      return;
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg: CommandMessage = {
      id: commandId,
      action: action as any,
      payload: payload as any,
      timestamp: Date.now()
    };

    const timer = setTimeout(() => {
      if (pendingRequests.has(commandId)) {
        pendingRequests.delete(commandId);
        reject(new Error(`Command ${action} timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    pendingRequests.set(commandId, { resolve, reject, timer });
    extensionSocket.send(JSON.stringify(msg));
  });
}

export function startBridge(port = DEFAULT_BRIDGE_PORT, host = DEFAULT_BRIDGE_HOST): Promise<void> {
  return new Promise((resolve) => {
    httpServer.listen(port, host, () => {
      process.stdout.write(`OmniTouch Bridge active on http://${host}:${port} and ws://${host}:${port}/bridge\n`);
      resolve();
    });
  });
}

if (import.meta.main || process.argv[1]?.endsWith("server.ts")) {
  startBridge();
}
