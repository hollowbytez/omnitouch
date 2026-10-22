import { BRIDGE_WS_URL } from "../../shared/constants";
import type { CommandMessage, CommandResult } from "../../shared/types";

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

function connectBridge(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  try {
    ws = new WebSocket(BRIDGE_WS_URL);

    ws.onopen = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.send(
        JSON.stringify({
          type: "client_hello",
          client: "extension",
          timestamp: Date.now()
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const cmd: CommandMessage = JSON.parse(event.data);
        const result = await routeCommand(cmd);
        ws?.send(JSON.stringify(result));
      } catch (err) {
        ws?.send(
          JSON.stringify({
            id: "error",
            success: false,
            error: String(err),
            timestamp: Date.now()
          })
        );
      }
    };

    ws.onclose = () => {
      scheduleReconnect();
    };

    ws.onerror = () => {
      scheduleReconnect();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridge();
  }, 2000) as unknown as number;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function routeCommand(cmd: CommandMessage): Promise<CommandResult> {
  const tab = await getActiveTab();

  if (cmd.action === "navigate") {
    const p = cmd.payload as { url: string };
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { url: p.url });
    } else {
      await chrome.tabs.create({ url: p.url });
    }
    return {
      id: cmd.id,
      success: true,
      data: { url: p.url, tabId: tab?.id },
      timestamp: Date.now()
    };
  }

  if (cmd.action === "get_status") {
    if (!tab?.id) {
      return {
        id: cmd.id,
        success: true,
        data: { mode: "balanced", url: "about:blank", title: "No Tab" },
        timestamp: Date.now()
      };
    }

    try {
      const res = await Promise.race([
        chrome.tabs.sendMessage(tab.id, cmd),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Tab response timeout")), 1200))
      ]);
      return res as CommandResult;
    } catch {
      return {
        id: cmd.id,
        success: true,
        data: {
          mode: "balanced",
          url: tab.url || "about:blank",
          title: tab.title || "Active Tab",
          tabId: tab.id
        },
        timestamp: Date.now()
      };
    }
  }

  if (!tab?.id) {
    return {
      id: cmd.id,
      success: false,
      error: "No active browser tab found.",
      timestamp: Date.now()
    };
  }

  try {
    const res = await Promise.race([
      chrome.tabs.sendMessage(tab.id, cmd),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Content script timeout")), 30000))
    ]);
    return res as CommandResult;
  } catch (err) {
    return {
      id: cmd.id,
      success: false,
      error: `Tab communication failed: ${String(err)}`,
      timestamp: Date.now()
    };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "capture_tab_screenshot") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  if (msg.type === "mode_changed") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "mode_update", mode: msg.mode }));
    }
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  connectBridge();
});

chrome.runtime.onStartup.addListener(() => {
  connectBridge();
});

connectBridge();
