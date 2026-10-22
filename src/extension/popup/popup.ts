import type { PermissionMode } from "../../shared/types";
import { BRIDGE_HTTP_URL } from "../../shared/constants";

let currentMode: PermissionMode = "balanced";

async function initPopup(): Promise<void> {
  await checkBridgeStatus();
  await syncActiveTabMode();
  setupEventListeners();
}

async function checkBridgeStatus(): Promise<void> {
  const indicator = document.getElementById("status-indicator");
  const label = document.getElementById("status-label");

  try {
    const res = await fetch(`${BRIDGE_HTTP_URL}/status`, { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      indicator?.classList.add("online");
      if (label) label.textContent = "Bridge Online";
    } else {
      indicator?.classList.remove("online");
      if (label) label.textContent = "Bridge Offline";
    }
  } catch {
    indicator?.classList.remove("online");
    if (label) label.textContent = "Bridge Offline";
  }
}

async function syncActiveTabMode(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      id: "popup-sync",
      action: "get_status",
      payload: {},
      timestamp: Date.now()
    });
    if (res?.data?.mode) {
      setModeUI(res.data.mode);
    }
  } catch {}
}

function setModeUI(mode: PermissionMode): void {
  currentMode = mode;
  const cards = document.querySelectorAll<HTMLButtonElement>(".mode-card");
  cards.forEach((c) => c.classList.remove("active"));

  const target = document.getElementById(`btn-mode-${mode}`);
  target?.classList.add("active");
}

function setupEventListeners(): void {
  const modes: PermissionMode[] = ["permissions", "balanced", "full"];
  for (const m of modes) {
    const btn = document.getElementById(`btn-mode-${m}`);
    btn?.addEventListener("click", async () => {
      setModeUI(m);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          id: `mode-set-${Date.now()}`,
          action: "set_mode",
          payload: { mode: m },
          timestamp: Date.now()
        });
      }
    });
  }

  const scanBtn = document.getElementById("btn-scan-elements");
  scanBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        id: `scan-${Date.now()}`,
        action: "screenshot",
        payload: { annotateMarks: true },
        timestamp: Date.now()
      });
    }
  });

  const clearBtn = document.getElementById("btn-clear-marks");
  clearBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        id: `clear-${Date.now()}`,
        action: "get_elements",
        payload: {},
        timestamp: Date.now()
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", initPopup);
