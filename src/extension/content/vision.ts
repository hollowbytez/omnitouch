import type { ElementMark, AXNode } from "../../shared/types";

let currentMarks: Map<number, { element: HTMLElement; mark: ElementMark }> = new Map();
let overlayContainer: HTMLDivElement | null = null;

export function scanInteractiveElements(): ElementMark[] {
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

  const rawElements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  const marks: ElementMark[] = [];
  let nextId = 1;

  for (const el of rawElements) {
    if (el.closest("#omnitouch-hud-host") || el.closest("#omnitouch-som-container")) {
      continue;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) {
      continue;
    }

    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      continue;
    }

    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) < 0.1 ||
      style.pointerEvents === "none"
    ) {
      continue;
    }

    const text = extractElementText(el);
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const sel = generateSelector(el);

    const mark: ElementMark = {
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

export function getElementByMarkId(id: number): HTMLElement | null {
  return currentMarks.get(id)?.element ?? null;
}

export function renderSoMOverlay(marks: ElementMark[]): void {
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

export function clearSoMOverlay(): void {
  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
  }
  overlayContainer = null;
}

export function buildAXTree(): AXNode[] {
  const root = document.body;
  const nodes: AXNode[] = [];
  let nextId = 1;

  function walk(el: Element): AXNode | null {
    if (!(el instanceof HTMLElement)) return null;
    if (el.closest("#omnitouch-hud-host") || el.closest("#omnitouch-som-container")) return null;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return null;

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

    const children: AXNode[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const child = walk(el.children[i]);
      if (child) children.push(child);
    }

    if (isInteractive || children.length > 0 || name.length > 0) {
      const node: AXNode = {
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

  for (let i = 0; i < root.children.length; i++) {
    const n = walk(root.children[i]);
    if (n) nodes.push(n);
  }

  return nodes;
}

function extractElementText(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.placeholder || el.value || el.name || "";
  }
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const title = el.getAttribute("title");
  if (title) return title.trim();
  return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
}

function generateSelector(el: HTMLElement): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const dataTest = el.getAttribute("data-testid") || el.getAttribute("data-test");
  if (dataTest) {
    return `[data-testid="${CSS.escape(dataTest)}"]`;
  }
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith("omnitouch"))
    .slice(0, 2)
    .map((c) => `.${CSS.escape(c)}`)
    .join("");
  return `${tag}${classes}`;
}
