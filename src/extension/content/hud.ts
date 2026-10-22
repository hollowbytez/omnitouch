import type { PermissionMode, ApprovalRequest } from "../../shared/types";
import { getActiveMode, setActiveMode } from "./modes";

let hudHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let activeApprovalResolver: ((approved: boolean) => void) | null = null;

export function initHUD(onModeChange?: (mode: PermissionMode) => void): void {
  if (hudHost) return;

  hudHost = document.createElement("div");
  hudHost.id = "omnitouch-hud-host";
  hudHost.style.position = "fixed";
  hudHost.style.top = "16px";
  hudHost.style.right = "16px";
  hudHost.style.zIndex = "2147483647";
  hudHost.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  shadowRoot = hudHost.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .hud-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 9999px;
      padding: 6px 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.2);
      user-select: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .hud-pill:hover {
      border-color: rgba(56, 189, 248, 0.55);
      box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.35);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
      transition: background-color 0.3s;
    }
    .status-dot.active {
      animation: pulse 1.4s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(56, 189, 248, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
    }
    .brand-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .mode-permissions {
      background: rgba(234, 179, 8, 0.18);
      color: #fde047;
      border-color: rgba(234, 179, 8, 0.35);
    }
    .mode-balanced {
      background: rgba(56, 189, 248, 0.18);
      color: #7dd3fc;
      border-color: rgba(56, 189, 248, 0.35);
    }
    .mode-full {
      background: rgba(168, 85, 247, 0.22);
      color: #d8b4fe;
      border-color: rgba(168, 85, 247, 0.45);
    }
    .status-text {
      font-size: 11px;
      color: #cbd5e1;
      font-family: ui-monospace, monospace;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .panic-btn {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .panic-btn:hover {
      background: rgba(239, 68, 68, 0.45);
      color: #fee2e2;
    }
    .approval-modal {
      position: fixed;
      top: 70px;
      right: 16px;
      width: 320px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(234, 179, 8, 0.4);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(234, 179, 8, 0.2);
      color: #f8fafc;
      display: none;
      flex-direction: column;
      gap: 10px;
      animation: slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .approval-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #fde047;
    }
    .approval-summary {
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.4;
    }
    .approval-target {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      word-break: break-all;
      color: #7dd3fc;
    }
    .approval-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .btn-approve {
      flex: 1;
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-approve:hover {
      background: #0369a1;
    }
    .btn-reject {
      flex: 1;
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-reject:hover {
      background: rgba(239, 68, 68, 0.4);
    }
  `;
  shadowRoot.appendChild(style);

  const pill = document.createElement("div");
  pill.className = "hud-pill";

  const dot = document.createElement("div");
  dot.className = "status-dot";
  dot.id = "hud-dot";

  const brand = document.createElement("div");
  brand.className = "brand-title";
  brand.textContent = "OmniTouch";

  const modeBadge = document.createElement("div");
  modeBadge.className = "mode-badge mode-balanced";
  modeBadge.id = "hud-mode-badge";
  modeBadge.textContent = "Balanced";
  modeBadge.title = "Click to cycle security mode";

  modeBadge.addEventListener("click", () => {
    const current = getActiveMode();
    const next: PermissionMode =
      current === "permissions"
        ? "balanced"
        : current === "balanced"
        ? "full"
        : "permissions";
    setActiveMode(next);
    updateModeDisplay(next);
    onModeChange?.(next);
  });

  const statusText = document.createElement("div");
  statusText.className = "status-text";
  statusText.id = "hud-status";
  statusText.textContent = "Connected";

  const panicBtn = document.createElement("button");
  panicBtn.className = "panic-btn";
  panicBtn.textContent = "PANIC";
  panicBtn.title = "Universal Emergency Killswitch (Ctrl+Shift+X)";
  panicBtn.addEventListener("click", () => {
    triggerPanicAbort();
  });

  pill.appendChild(dot);
  pill.appendChild(brand);
  pill.appendChild(modeBadge);
  pill.appendChild(statusText);
  pill.appendChild(panicBtn);

  const modal = document.createElement("div");
  modal.className = "approval-modal";
  modal.id = "hud-approval-modal";

  const modalTitle = document.createElement("div");
  modalTitle.className = "approval-title";
  modalTitle.textContent = "Approval Required";

  const modalSummary = document.createElement("div");
  modalSummary.className = "approval-summary";
  modalSummary.id = "hud-approval-summary";

  const modalTarget = document.createElement("div");
  modalTarget.className = "approval-target";
  modalTarget.id = "hud-approval-target";

  const actions = document.createElement("div");
  actions.className = "approval-actions";

  const approveBtn = document.createElement("button");
  approveBtn.className = "btn-approve";
  approveBtn.textContent = "Approve (Enter)";
  approveBtn.addEventListener("click", () => resolveApproval(true));

  const rejectBtn = document.createElement("button");
  rejectBtn.className = "btn-reject";
  rejectBtn.textContent = "Reject (Esc)";
  rejectBtn.addEventListener("click", () => resolveApproval(false));

  actions.appendChild(approveBtn);
  actions.appendChild(rejectBtn);

  modal.appendChild(modalTitle);
  modal.appendChild(modalSummary);
  modal.appendChild(modalTarget);
  modal.appendChild(actions);

  shadowRoot.appendChild(pill);
  shadowRoot.appendChild(modal);

  document.documentElement.appendChild(hudHost);

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyX") {
      triggerPanicAbort();
    }
    if (activeApprovalResolver) {
      if (e.key === "Enter") {
        e.preventDefault();
        resolveApproval(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        resolveApproval(false);
      }
    }
  });
}

export function updateHUDStatus(status: string, isActive = false): void {
  if (!shadowRoot) return;
  const el = shadowRoot.getElementById("hud-status");
  const dot = shadowRoot.getElementById("hud-dot");
  if (el) el.textContent = status;
  if (dot) {
    if (isActive) dot.classList.add("active");
    else dot.classList.remove("active");
  }
}

export function updateModeDisplay(mode: PermissionMode): void {
  if (!shadowRoot) return;
  const badge = shadowRoot.getElementById("hud-mode-badge");
  if (!badge) return;

  badge.className = `mode-badge mode-${mode}`;
  if (mode === "permissions") {
    badge.textContent = "Strict";
  } else if (mode === "balanced") {
    badge.textContent = "Balanced";
  } else {
    badge.textContent = "God Mode";
  }
}

export function requestUserApproval(req: ApprovalRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (!shadowRoot) {
      resolve(false);
      return;
    }
    activeApprovalResolver = resolve;
    const modal = shadowRoot.getElementById("hud-approval-modal");
    const summary = shadowRoot.getElementById("hud-approval-summary");
    const target = shadowRoot.getElementById("hud-approval-target");

    if (summary) summary.textContent = req.summary;
    if (target) target.textContent = req.target || `Action: ${req.action}`;
    if (modal) modal.style.display = "flex";
  });
}

function resolveApproval(approved: boolean): void {
  if (activeApprovalResolver) {
    activeApprovalResolver(approved);
    activeApprovalResolver = null;
  }
  if (shadowRoot) {
    const modal = shadowRoot.getElementById("hud-approval-modal");
    if (modal) modal.style.display = "none";
  }
}

function triggerPanicAbort(): void {
  if (activeApprovalResolver) {
    resolveApproval(false);
  }
  updateHUDStatus("ABORTED BY USER", false);
  window.dispatchEvent(new CustomEvent("omnitouch-panic"));
}
