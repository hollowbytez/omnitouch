import { BRIDGE_WS_URL } from "../../shared/constants";
import type { CommandMessage, CommandResult } from "../../shared/types";

declare const browser: any;

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  if (typeof browser !== "undefined" && browser.tabs?.query) {
    return browser.tabs.query(queryInfo);
  }
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
  });
}

function sendTabMessage(tabId: number, msg: any): Promise<any> {
  if (typeof browser !== "undefined" && browser.tabs?.sendMessage) {
    return browser.tabs.sendMessage(tabId, msg);
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(res);
    });
  });
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab | undefined> {
  if (typeof browser !== "undefined" && browser.tabs?.update) {
    return browser.tabs.update(tabId, props);
  }
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, props, (tab) => resolve(tab));
  });
}

function createTab(props: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  if (typeof browser !== "undefined" && browser.tabs?.create) {
    return browser.tabs.create(props);
  }
  return new Promise((resolve) => {
    chrome.tabs.create(props, (tab) => resolve(tab));
  });
}

function captureTab(): Promise<string> {
  if (typeof browser !== "undefined" && browser.tabs?.captureVisibleTab) {
    return browser.tabs.captureVisibleTab(null, { format: "png" });
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(dataUrl);
    });
  });
}

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
  const tabs = await queryTabs({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function routeCommand(cmd: CommandMessage): Promise<CommandResult> {
  const tab = await getActiveTab();

  if (cmd.action === "navigate") {
    const p = cmd.payload as { url: string };
    if (tab?.id) {
      await updateTab(tab.id, { url: p.url });
    } else {
      await createTab({ url: p.url });
    }
    return {
      id: cmd.id,
      success: true,
      data: { url: p.url, tabId: tab?.id },
      timestamp: Date.now()
    };
  }

  if (!tab?.id) {
    return {
      id: cmd.id,
      success: false,
      error: "No active browser tab found.",
      timestamp: Date.now()
    };
  }

  if (cmd.action === "get_status") {
    try {
      const res = await Promise.race([
        sendTabMessage(tab.id, cmd),
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

  try {
    const res = await Promise.race([
      sendTabMessage(tab.id, cmd),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Content script timeout")), 25000))
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

const runtimeApi = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

runtimeApi.onMessage.addListener((msg: any, sender: any, sendResponse: (res: any) => void) => {
  if (msg.type === "capture_tab_screenshot") {
    captureTab()
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  if (msg.type === "mode_changed") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "mode_update", mode: msg.mode }));
    }
  }
  return true;
});

if (runtimeApi.onInstalled) {
  runtimeApi.onInstalled.addListener(() => connectBridge());
}
if (runtimeApi.onStartup) {
  runtimeApi.onStartup.addListener(() => connectBridge());
}

connectBridge();
