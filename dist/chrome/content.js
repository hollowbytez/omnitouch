// src/shared/constants.ts
var DEFAULT_BRIDGE_PORT = 8765;
var DEFAULT_BRIDGE_HOST = "127.0.0.1";
var BRIDGE_WS_URL = `ws://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}/bridge`;
var BRIDGE_HTTP_URL = `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;
var SENSITIVE_KEYWORDS = [
  "password",
  "passcode",
  "pin",
  "credit card",
  "debit card",
  "cvv",
  "cvc",
  "ssn",
  "social security",
  "checkout",
  "place order",
  "pay now",
  "buy now",
  "purchase",
  "delete account",
  "delete organization",
  "transfer funds",
  "wire transfer",
  "terminate",
  "drop database",
  "revoke key"
];
var SENSITIVE_INPUT_TYPES = [
  "password"
];
var SENSITIVE_AUTOCOMPLETE_TYPES = [
  "current-password",
  "new-password",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-type"
];

// src/extension/content/modes.ts
var currentMode = "balanced";
function getActiveMode() {
  return currentMode;
}
function setActiveMode(mode) {
  currentMode = mode;
}
function evaluateActionSecurity(cmd, targetElement) {
  const readOnlyActions = ["screenshot", "get_elements", "get_axtree", "get_status"];
  if (readOnlyActions.includes(cmd.action)) {
    return { allowed: true, requiresPrompt: false };
  }
  if (currentMode === "full") {
    return { allowed: true, requiresPrompt: false };
  }
  if (currentMode === "permissions") {
    return {
      allowed: false,
      requiresPrompt: true,
      reason: `Strict Guardian mode requires confirmation for all mutating actions (${cmd.action}).`
    };
  }
  if (currentMode === "balanced") {
    if (cmd.action === "navigate") {
      const targetUrl = cmd.payload.url;
      try {
        const dest = new URL(targetUrl);
        const curr = new URL(window.location.href);
        if (dest.hostname !== curr.hostname && curr.hostname !== "") {
          return {
            allowed: false,
            requiresPrompt: true,
            reason: `Cross-domain navigation to ${dest.hostname} detected.`
          };
        }
      } catch {
        return {
          allowed: false,
          requiresPrompt: true,
          reason: `Invalid or external URL destination: ${targetUrl}`
        };
      }
    }
    if (targetElement) {
      if (targetElement instanceof HTMLInputElement) {
        if (SENSITIVE_INPUT_TYPES.includes(targetElement.type.toLowerCase())) {
          return {
            allowed: false,
            requiresPrompt: true,
            reason: `Password field input detected.`
          };
        }
        const auto = targetElement.autocomplete?.toLowerCase() || "";
        if (SENSITIVE_AUTOCOMPLETE_TYPES.some((s) => auto.includes(s))) {
          return {
            allowed: false,
            requiresPrompt: true,
            reason: `Sensitive financial or authentication input field detected.`
          };
        }
      }
      const text = ((targetElement.innerText || "") + " " + (targetElement.getAttribute("aria-label") || "") + " " + (targetElement.getAttribute("title") || "") + " " + (targetElement.getAttribute("value") || "")).toLowerCase();
      for (const kw of SENSITIVE_KEYWORDS) {
        if (text.includes(kw)) {
          return {
            allowed: false,
            requiresPrompt: true,
            reason: `Action targets high-impact keyword: "${kw}".`
          };
        }
      }
    }
    if (cmd.action === "type") {
      const typePayload = cmd.payload;
      const content = (typePayload.text || "").toLowerCase();
      for (const kw of SENSITIVE_KEYWORDS) {
        if (content.includes(kw)) {
          return {
            allowed: false,
            requiresPrompt: true,
            reason: `Typing payload contains sensitive keyword: "${kw}".`
          };
        }
      }
    }
    return { allowed: true, requiresPrompt: false };
  }
  return { allowed: false, requiresPrompt: true, reason: "Default deny policy triggered." };
}

// src/extension/content/hud.ts
var hudHost = null;
var shadowRoot = null;
var activeApprovalResolver = null;
function initHUD(onModeChange) {
  if (hudHost)
    return;
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
    const next = current === "permissions" ? "balanced" : current === "balanced" ? "full" : "permissions";
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
function updateHUDStatus(status, isActive = false) {
  if (!shadowRoot)
    return;
  const el = shadowRoot.getElementById("hud-status");
  const dot = shadowRoot.getElementById("hud-dot");
  if (el)
    el.textContent = status;
  if (dot) {
    if (isActive)
      dot.classList.add("active");
    else
      dot.classList.remove("active");
  }
}
function updateModeDisplay(mode) {
  if (!shadowRoot)
    return;
  const badge = shadowRoot.getElementById("hud-mode-badge");
  if (!badge)
    return;
  badge.className = `mode-badge mode-${mode}`;
  if (mode === "permissions") {
    badge.textContent = "Strict";
  } else if (mode === "balanced") {
    badge.textContent = "Balanced";
  } else {
    badge.textContent = "God Mode";
  }
}
function requestUserApproval(req) {
  return new Promise((resolve) => {
    if (!shadowRoot) {
      resolve(false);
      return;
    }
    activeApprovalResolver = resolve;
    const modal = shadowRoot.getElementById("hud-approval-modal");
    const summary = shadowRoot.getElementById("hud-approval-summary");
    const target = shadowRoot.getElementById("hud-approval-target");
    if (summary)
      summary.textContent = req.summary;
    if (target)
      target.textContent = req.target || `Action: ${req.action}`;
    if (modal)
      modal.style.display = "flex";
  });
}
function resolveApproval(approved) {
  if (activeApprovalResolver) {
    activeApprovalResolver(approved);
    activeApprovalResolver = null;
  }
  if (shadowRoot) {
    const modal = shadowRoot.getElementById("hud-approval-modal");
    if (modal)
      modal.style.display = "none";
  }
}
function triggerPanicAbort() {
  if (activeApprovalResolver) {
    resolveApproval(false);
  }
  updateHUDStatus("ABORTED BY USER", false);
  window.dispatchEvent(new CustomEvent("omnitouch-panic"));
}

// src/extension/content/ghost_cursor.ts
var cursorHost = null;
var shadowRoot2 = null;
var cursorDot = null;
var trailCanvas = null;
var trailCtx = null;
var trailHistory = [];
var animFrameId = null;
var isEnabled = true;
function initGhostCursor() {
  if (cursorHost)
    return;
  cursorHost = document.createElement("div");
  cursorHost.id = "omnitouch-cursor-host";
  cursorHost.style.position = "fixed";
  cursorHost.style.top = "0";
  cursorHost.style.left = "0";
  cursorHost.style.width = "0";
  cursorHost.style.height = "0";
  cursorHost.style.pointerEvents = "none";
  cursorHost.style.zIndex = "2147483645";
  shadowRoot2 = cursorHost.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    .ghost-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
    }
    .ghost-dot {
      position: fixed;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: radial-gradient(circle, #38bdf8 0%, #0284c7 80%, rgba(2, 132, 199, 0) 100%);
      box-shadow: 0 0 10px #38bdf8, 0 0 20px rgba(56, 189, 248, 0.6);
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: transform 0.05s ease-out;
      display: none;
    }
    .pulse-ring {
      position: fixed;
      border-radius: 50%;
      border: 2px solid #38bdf8;
      pointer-events: none;
      transform: translate(-50%, -50%) scale(0.2);
      opacity: 1;
      animation: pulse-out 0.4s cubic-bezier(0, 0, 0.2, 1) forwards;
    }
    @keyframes pulse-out {
      0% {
        transform: translate(-50%, -50%) scale(0.2);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.4);
        opacity: 0;
      }
    }
  `;
  shadowRoot2.appendChild(style);
  trailCanvas = document.createElement("canvas");
  trailCanvas.className = "ghost-canvas";
  trailCanvas.width = window.innerWidth;
  trailCanvas.height = window.innerHeight;
  shadowRoot2.appendChild(trailCanvas);
  trailCtx = trailCanvas.getContext("2d");
  cursorDot = document.createElement("div");
  cursorDot.className = "ghost-dot";
  shadowRoot2.appendChild(cursorDot);
  document.documentElement.appendChild(cursorHost);
  window.addEventListener("resize", () => {
    if (trailCanvas) {
      trailCanvas.width = window.innerWidth;
      trailCanvas.height = window.innerHeight;
    }
  });
  startTrailLoop();
}
function updateGhostCursor(x, y) {
  if (!isEnabled)
    return;
  initGhostCursor();
  if (cursorDot) {
    cursorDot.style.display = "block";
    cursorDot.style.left = `${x}px`;
    cursorDot.style.top = `${y}px`;
  }
  trailHistory.push({ x, y, alpha: 1 });
  if (trailHistory.length > 25) {
    trailHistory.shift();
  }
}
function triggerClickPulse(x, y) {
  if (!isEnabled || !shadowRoot2)
    return;
  const pulse = document.createElement("div");
  pulse.className = "pulse-ring";
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  pulse.style.width = "30px";
  pulse.style.height = "30px";
  shadowRoot2.appendChild(pulse);
  setTimeout(() => {
    if (pulse.parentNode)
      pulse.parentNode.removeChild(pulse);
  }, 450);
}
function startTrailLoop() {
  function render() {
    if (trailCtx && trailCanvas) {
      trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      if (trailHistory.length > 1) {
        for (let i = 0;i < trailHistory.length - 1; i++) {
          const pt = trailHistory[i];
          const next = trailHistory[i + 1];
          pt.alpha *= 0.92;
          trailCtx.beginPath();
          trailCtx.moveTo(pt.x, pt.y);
          trailCtx.lineTo(next.x, next.y);
          trailCtx.strokeStyle = `rgba(56, 189, 248, ${pt.alpha * 0.7})`;
          trailCtx.lineWidth = Math.max(1, i / trailHistory.length * 4);
          trailCtx.lineCap = "round";
          trailCtx.stroke();
        }
      }
      for (let i = trailHistory.length - 1;i >= 0; i--) {
        if (trailHistory[i].alpha < 0.05) {
          trailHistory.splice(i, 1);
        }
      }
    }
    animFrameId = requestAnimationFrame(render);
  }
  animFrameId = requestAnimationFrame(render);
}

// src/extension/content/vision.ts
var currentMarks = new Map;
var overlayContainer = null;
function scanInteractiveElements() {
  currentMarks.clear();
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([type='hidden']):not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    "[role='button']",
    "[role='link']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='tab']",
    "[role='menuitem']",
    "[role='combobox']",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])",
    "[onclick]"
  ].join(",");
  const rawElements = Array.from(document.querySelectorAll(selector));
  const marks = [];
  let nextId = 1;
  for (const el of rawElements) {
    if (el.closest("#omnitouch-hud-host") || el.closest("#omnitouch-som-container")) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) {
      continue;
    }
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      continue;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.1 || style.pointerEvents === "none") {
      continue;
    }
    const text = extractElementText(el);
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const sel = generateSelector(el);
    const mark = {
      id: nextId,
      tag: el.tagName.toLowerCase(),
      role,
      text: text.slice(0, 80),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      isVisible: true,
      selector: sel
    };
    currentMarks.set(nextId, { element: el, mark });
    marks.push(mark);
    nextId++;
  }
  return marks;
}
function getElementByMarkId(id) {
  return currentMarks.get(id)?.element ?? null;
}
function renderSoMOverlay(marks) {
  clearSoMOverlay();
  overlayContainer = document.createElement("div");
  overlayContainer.id = "omnitouch-som-container";
  overlayContainer.style.position = "fixed";
  overlayContainer.style.top = "0";
  overlayContainer.style.left = "0";
  overlayContainer.style.width = "100vw";
  overlayContainer.style.height = "100vh";
  overlayContainer.style.pointerEvents = "none";
  overlayContainer.style.zIndex = "2147483640";
  for (const m of marks) {
    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.left = `${m.x - m.width / 2}px`;
    box.style.top = `${m.y - m.height / 2}px`;
    box.style.width = `${m.width}px`;
    box.style.height = `${m.height}px`;
    box.style.border = "1.5px solid rgba(56, 189, 248, 0.85)";
    box.style.backgroundColor = "rgba(56, 189, 248, 0.08)";
    box.style.boxSizing = "border-box";
    box.style.borderRadius = "3px";
    const badge = document.createElement("div");
    badge.textContent = `${m.id}`;
    badge.style.position = "absolute";
    badge.style.top = "-11px";
    badge.style.left = "-2px";
    badge.style.backgroundColor = "#0284c7";
    badge.style.color = "#ffffff";
    badge.style.fontFamily = "ui-monospace, monospace";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "700";
    badge.style.lineHeight = "1";
    badge.style.padding = "2px 4px";
    badge.style.borderRadius = "3px";
    badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5)";
    box.appendChild(badge);
    overlayContainer.appendChild(box);
  }
  document.body.appendChild(overlayContainer);
}
function clearSoMOverlay() {
  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
  }
  overlayContainer = null;
}
function buildAXTree() {
  const root = document.body;
  const nodes = [];
  let nextId = 1;
  function walk(el) {
    if (!(el instanceof HTMLElement))
      return null;
    if (el.closest("#omnitouch-hud-host") || el.closest("#omnitouch-som-container"))
      return null;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden")
      return null;
    const rect = el.getBoundingClientRect();
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const name = extractElementText(el);
    const isInteractive = [
      "a",
      "button",
      "input",
      "select",
      "textarea"
    ].includes(el.tagName.toLowerCase()) || el.hasAttribute("role");
    const children = [];
    for (let i = 0;i < el.children.length; i++) {
      const child = walk(el.children[i]);
      if (child)
        children.push(child);
    }
    if (isInteractive || children.length > 0 || name.length > 0) {
      const node = {
        id: nextId++,
        role,
        name: name.slice(0, 60),
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        }
      };
      if (children.length > 0) {
        node.children = children;
      }
      return node;
    }
    return null;
  }
  for (let i = 0;i < root.children.length; i++) {
    const n = walk(root.children[i]);
    if (n)
      nodes.push(n);
  }
  return nodes;
}
function extractElementText(el) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.placeholder || el.value || el.name || "";
  }
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel)
    return ariaLabel.trim();
  const title = el.getAttribute("title");
  if (title)
    return title.trim();
  return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
}
function generateSelector(el) {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const dataTest = el.getAttribute("data-testid") || el.getAttribute("data-test");
  if (dataTest) {
    return `[data-testid="${CSS.escape(dataTest)}"]`;
  }
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter((c) => !c.startsWith("omnitouch")).slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
  return `${tag}${classes}`;
}

// src/extension/content/kinematics.ts
function generateBezierPath(startX, startY, targetX, targetY, options = {}) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) {
    return [{ x: targetX, y: targetY, timeMs: 0 }];
  }
  const speedFactor = Math.max(0.2, Math.min(3, options.speedFactor ?? 1));
  const baseDuration = Math.min(1200, Math.max(180, distance * 0.9)) / speedFactor;
  const steps = Math.max(12, Math.floor(baseDuration / 16));
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const curvatureSign = Math.random() < 0.5 ? -1 : 1;
  const curvature1 = (Math.random() * 0.4 + 0.1) * distance * curvatureSign;
  const curvature2 = (Math.random() * 0.3 - 0.15) * distance * curvatureSign;
  const p0 = { x: startX, y: startY };
  const p1 = {
    x: startX + dx * 0.3 + perpX * curvature1,
    y: startY + dy * 0.3 + perpY * curvature1
  };
  const p2 = {
    x: startX + dx * 0.75 + perpX * curvature2,
    y: startY + dy * 0.75 + perpY * curvature2
  };
  const p3 = { x: targetX, y: targetY };
  const points = [];
  const jitterAmp = options.jitterAmplitude ?? 1.2;
  for (let i = 0;i <= steps; i++) {
    const rawT = i / steps;
    const t = easeInOutCubic(rawT);
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    let bx = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    let by = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
    if (rawT > 0.05 && rawT < 0.95 && jitterAmp > 0) {
      const jitterFactor = Math.sin(rawT * Math.PI) * jitterAmp;
      bx += (Math.random() - 0.5) * jitterFactor;
      by += (Math.random() - 0.5) * jitterFactor;
    }
    points.push({
      x: Math.round(bx * 10) / 10,
      y: Math.round(by * 10) / 10,
      timeMs: Math.round(rawT * baseDuration)
    });
  }
  if (options.overshoot !== false && distance > 150) {
    const overshootDist = Math.min(8, distance * 0.03);
    const overshootX = targetX + dx / distance * overshootDist;
    const overshootY = targetY + dy / distance * overshootDist;
    points.push({
      x: Math.round(overshootX * 10) / 10,
      y: Math.round(overshootY * 10) / 10,
      timeMs: Math.round(baseDuration + 40)
    });
    points.push({
      x: targetX,
      y: targetY,
      timeMs: Math.round(baseDuration + 90)
    });
  } else {
    points.push({
      x: targetX,
      y: targetY,
      timeMs: Math.round(baseDuration)
    });
  }
  return points;
}
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
async function executeHumanMouseMotion(points, onStep) {
  const startTime = performance.now();
  for (let i = 0;i < points.length; i++) {
    const pt = points[i];
    const targetElapsed = pt.timeMs;
    const actualElapsed = performance.now() - startTime;
    const waitTime = targetElapsed - actualElapsed;
    if (waitTime > 2) {
      await new Promise((r) => setTimeout(r, waitTime));
    }
    onStep?.(pt);
  }
}
async function humanClick(element, x, y, options = {}) {
  const button = options.button ?? "left";
  const buttonCode = button === "left" ? 0 : button === "middle" ? 1 : 2;
  const buttonsCode = button === "left" ? 1 : button === "middle" ? 4 : 2;
  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: window.screenX + x,
    screenY: window.screenY + y,
    button: buttonCode,
    buttons: buttonsCode
  };
  element.dispatchEvent(new MouseEvent("mousemove", eventInit));
  element.dispatchEvent(new MouseEvent("mouseenter", eventInit));
  element.dispatchEvent(new MouseEvent("mouseover", eventInit));
  await new Promise((r) => setTimeout(r, Math.random() * 30 + 20));
  element.dispatchEvent(new MouseEvent("mousedown", eventInit));
  const holdDuration = Math.random() * 60 + 50;
  await new Promise((r) => setTimeout(r, holdDuration));
  element.dispatchEvent(new MouseEvent("mouseup", eventInit));
  element.dispatchEvent(new MouseEvent("click", eventInit));
  if (options.doubleClick) {
    await new Promise((r) => setTimeout(r, Math.random() * 50 + 40));
    element.dispatchEvent(new MouseEvent("mousedown", eventInit));
    await new Promise((r) => setTimeout(r, Math.random() * 40 + 30));
    element.dispatchEvent(new MouseEvent("mouseup", eventInit));
    element.dispatchEvent(new MouseEvent("click", eventInit));
    element.dispatchEvent(new MouseEvent("dblclick", eventInit));
  }
}
async function humanType(element, text, options = {}) {
  element.focus();
  if (options.clearFirst) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setNativeValue(element, "");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (element.isContentEditable) {
      element.innerText = "";
    }
  }
  for (let i = 0;i < text.length; i++) {
    const char = text[i];
    const key = char;
    const isUpper = char >= "A" && char <= "Z";
    if (isUpper) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", bubbles: true }));
    }
    const keyInit = {
      key,
      code: `Key${char.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
      view: window
    };
    element.dispatchEvent(new KeyboardEvent("keydown", keyInit));
    element.dispatchEvent(new KeyboardEvent("keypress", keyInit));
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const prev = element.value;
      const next = prev + char;
      setNativeValue(element, next);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }));
    } else if (element.isContentEditable) {
      document.execCommand("insertText", false, char);
    }
    element.dispatchEvent(new KeyboardEvent("keyup", keyInit));
    if (isUpper) {
      element.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", code: "ShiftLeft", bubbles: true }));
    }
    const interKeyDelay = Math.max(30, Math.round(gaussianRandom(75, 22)));
    await new Promise((r) => setTimeout(r, interKeyDelay));
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (options.pressEnter) {
    await new Promise((r) => setTimeout(r, 80));
    const enterInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", enterInit));
    element.dispatchEvent(new KeyboardEvent("keypress", enterInit));
    element.dispatchEvent(new KeyboardEvent("keyup", enterInit));
    if (element instanceof HTMLInputElement && element.form) {
      element.form.requestSubmit?.();
    }
  }
}
function setNativeValue(element, value) {
  const proto = element instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(value);
  }
}
function gaussianRandom(mean, stdev) {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const randStdNormal = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
  return mean + randStdNormal * stdev;
}

// src/extension/content/index.ts
var lastCursorX = window.innerWidth / 2;
var lastCursorY = window.innerHeight / 2;
var isExecuting = false;
var isAborted = false;
function init() {
  initHUD((newMode) => {
    chrome.runtime.sendMessage({ type: "mode_changed", mode: newMode });
  });
  initGhostCursor();
  window.addEventListener("omnitouch-panic", () => {
    isAborted = true;
    isExecuting = false;
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleCommand(message).then((res) => sendResponse(res)).catch((err) => {
      sendResponse({
        id: message.id,
        success: false,
        error: String(err),
        timestamp: Date.now()
      });
    });
    return true;
  });
}
async function handleCommand(cmd) {
  isAborted = false;
  isExecuting = true;
  if (cmd.action === "set_mode") {
    const nextMode = cmd.payload.mode;
    setActiveMode(nextMode);
    updateModeDisplay(nextMode);
    isExecuting = false;
    return { id: cmd.id, success: true, data: { mode: nextMode }, timestamp: Date.now() };
  }
  if (cmd.action === "get_status") {
    isExecuting = false;
    return {
      id: cmd.id,
      success: true,
      data: {
        mode: getActiveMode(),
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      },
      timestamp: Date.now()
    };
  }
  if (cmd.action === "get_elements") {
    const marks = scanInteractiveElements();
    isExecuting = false;
    return { id: cmd.id, success: true, data: { marks, count: marks.length }, timestamp: Date.now() };
  }
  if (cmd.action === "get_axtree") {
    const tree = buildAXTree();
    isExecuting = false;
    return { id: cmd.id, success: true, data: { tree }, timestamp: Date.now() };
  }
  if (cmd.action === "screenshot") {
    const annotate = cmd.payload.annotateMarks ?? true;
    let marks = [];
    if (annotate) {
      const scanned = scanInteractiveElements();
      marks = scanned;
      renderSoMOverlay(scanned);
    }
    await new Promise((r) => setTimeout(r, 60));
    const captureRes = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "capture_tab_screenshot" }, (res) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(res);
        }
      });
    });
    if (annotate) {
      clearSoMOverlay();
    }
    isExecuting = false;
    return {
      id: cmd.id,
      success: true,
      data: { screenshot: captureRes.dataUrl, marks },
      timestamp: Date.now()
    };
  }
  let targetElement = null;
  let targetX = lastCursorX;
  let targetY = lastCursorY;
  let targetDesc = "";
  if (cmd.action === "click") {
    const p = cmd.payload;
    if (p.markId) {
      targetElement = getElementByMarkId(p.markId);
      if (!targetElement) {
        scanInteractiveElements();
        targetElement = getElementByMarkId(p.markId);
      }
      if (!targetElement) {
        isExecuting = false;
        return { id: cmd.id, success: false, error: `Mark #${p.markId} not found in viewport.`, timestamp: Date.now() };
      }
      const rect = targetElement.getBoundingClientRect();
      targetX = rect.left + rect.width / 2;
      targetY = rect.top + rect.height / 2;
      targetDesc = `Mark #${p.markId} (${targetElement.tagName.toLowerCase()} "${targetElement.innerText.slice(0, 30)}")`;
    } else if (p.x !== undefined && p.y !== undefined) {
      targetX = p.x;
      targetY = p.y;
      targetDesc = `Coordinates (${p.x}, ${p.y})`;
      targetElement = document.elementFromPoint(p.x, p.y);
    }
  } else if (cmd.action === "type") {
    const p = cmd.payload;
    if (p.markId) {
      targetElement = getElementByMarkId(p.markId);
      if (!targetElement) {
        scanInteractiveElements();
        targetElement = getElementByMarkId(p.markId);
      }
      if (!targetElement) {
        isExecuting = false;
        return { id: cmd.id, success: false, error: `Mark #${p.markId} not found for typing.`, timestamp: Date.now() };
      }
      const rect = targetElement.getBoundingClientRect();
      targetX = rect.left + rect.width / 2;
      targetY = rect.top + rect.height / 2;
      targetDesc = `Typing into Mark #${p.markId} (${p.text.slice(0, 20)}...)`;
    }
  } else if (cmd.action === "navigate") {
    const p = cmd.payload;
    targetDesc = `Navigate to ${p.url}`;
  }
  const sec = evaluateActionSecurity(cmd, targetElement);
  if (!sec.allowed && sec.requiresPrompt) {
    updateHUDStatus("Awaiting approval...", true);
    const approved = await requestUserApproval({
      commandId: cmd.id,
      action: cmd.action,
      summary: sec.reason || `Authorize ${cmd.action}`,
      target: targetDesc,
      mode: getActiveMode(),
      created: Date.now()
    });
    if (!approved) {
      updateHUDStatus("Action rejected", false);
      isExecuting = false;
      return {
        id: cmd.id,
        success: false,
        blockedByPermission: true,
        error: "Action rejected by human operator.",
        timestamp: Date.now()
      };
    }
  }
  if (isAborted) {
    isExecuting = false;
    return { id: cmd.id, success: false, error: "Aborted by panic killswitch.", timestamp: Date.now() };
  }
  if (cmd.action === "click") {
    const p = cmd.payload;
    updateHUDStatus("Touching element...", true);
    const path = generateBezierPath(lastCursorX, lastCursorY, targetX, targetY, {
      speedFactor: 1.1,
      jitterAmplitude: 1.2,
      overshoot: true
    });
    await executeHumanMouseMotion(path, (pt) => {
      updateGhostCursor(pt.x, pt.y);
      lastCursorX = pt.x;
      lastCursorY = pt.y;
    });
    triggerClickPulse(targetX, targetY);
    if (targetElement) {
      await humanClick(targetElement, targetX, targetY, {
        doubleClick: p.doubleClick,
        button: p.button
      });
    } else {
      const elAtPt = document.elementFromPoint(targetX, targetY);
      if (elAtPt) {
        await humanClick(elAtPt, targetX, targetY, {
          doubleClick: p.doubleClick,
          button: p.button
        });
      }
    }
    updateHUDStatus("Clicked", false);
    isExecuting = false;
    return { id: cmd.id, success: true, data: { x: targetX, y: targetY }, timestamp: Date.now() };
  }
  if (cmd.action === "type") {
    const p = cmd.payload;
    updateHUDStatus("Moving to input...", true);
    if (targetElement) {
      const path = generateBezierPath(lastCursorX, lastCursorY, targetX, targetY);
      await executeHumanMouseMotion(path, (pt) => {
        updateGhostCursor(pt.x, pt.y);
        lastCursorX = pt.x;
        lastCursorY = pt.y;
      });
      triggerClickPulse(targetX, targetY);
      await humanClick(targetElement, targetX, targetY);
      updateHUDStatus("Typing...", true);
      await humanType(targetElement, p.text, {
        clearFirst: p.clearFirst,
        pressEnter: p.pressEnter
      });
    }
    updateHUDStatus("Typed", false);
    isExecuting = false;
    return { id: cmd.id, success: true, data: { textLength: p.text.length }, timestamp: Date.now() };
  }
  if (cmd.action === "scroll") {
    const p = cmd.payload;
    const dist = p.distance ?? 400;
    let targetScrollY = window.scrollY;
    if (p.direction === "down")
      targetScrollY += dist;
    else if (p.direction === "up")
      targetScrollY -= dist;
    else if (p.direction === "top")
      targetScrollY = 0;
    else if (p.direction === "bottom")
      targetScrollY = document.body.scrollHeight;
    window.scrollTo({ top: targetScrollY, behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 450));
    isExecuting = false;
    return { id: cmd.id, success: true, data: { scrollY: window.scrollY }, timestamp: Date.now() };
  }
  if (cmd.action === "navigate") {
    const p = cmd.payload;
    window.location.href = p.url;
    isExecuting = false;
    return { id: cmd.id, success: true, data: { url: p.url }, timestamp: Date.now() };
  }
  isExecuting = false;
  return { id: cmd.id, success: false, error: `Unhandled action: ${cmd.action}`, timestamp: Date.now() };
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
