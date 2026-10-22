// src/shared/constants.ts
var DEFAULT_BRIDGE_PORT = 8765;
var DEFAULT_BRIDGE_HOST = "127.0.0.1";
var BRIDGE_WS_URL = `ws://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}/bridge`;
var BRIDGE_HTTP_URL = `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;

// src/extension/background/service_worker.ts
var ws = null;
var reconnectTimer = null;
function connectBridge() {
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
      ws?.send(JSON.stringify({
        type: "client_hello",
        client: "extension",
        timestamp: Date.now()
      }));
    };
    ws.onmessage = async (event) => {
      try {
        const cmd = JSON.parse(event.data);
        const result = await routeCommand(cmd);
        ws?.send(JSON.stringify(result));
      } catch (err) {
        ws?.send(JSON.stringify({
          id: "error",
          success: false,
          error: String(err),
          timestamp: Date.now()
        }));
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
function scheduleReconnect() {
  if (reconnectTimer)
    return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBridge();
  }, 2000);
}
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}
async function routeCommand(cmd) {
  const tab = await getActiveTab();
  if (cmd.action === "navigate") {
    const p = cmd.payload;
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
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tab response timeout")), 1200))
      ]);
      return res;
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("Content script timeout")), 30000))
    ]);
    return res;
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
