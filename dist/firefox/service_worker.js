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
        const result = await routeCommandToActiveTab(cmd);
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
  }, 3000);
}
async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id ?? null;
}
async function routeCommandToActiveTab(cmd) {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return {
      id: cmd.id,
      success: false,
      error: "No active browser tab found.",
      timestamp: Date.now()
    };
  }
  try {
    const res = await chrome.tabs.sendMessage(tabId, cmd);
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
