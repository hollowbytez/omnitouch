import type { CommandMessage, CommandResult, PermissionMode } from "../../shared/types";
import { initHUD, updateHUDStatus, updateModeDisplay, requestUserApproval } from "./hud";
import { initGhostCursor, updateGhostCursor, triggerClickPulse } from "./ghost_cursor";
import { scanInteractiveElements, getElementByMarkId, renderSoMOverlay, clearSoMOverlay, buildAXTree } from "./vision";
import { generateBezierPath, executeHumanMouseMotion, humanClick, humanType } from "./kinematics";
import { getActiveMode, setActiveMode, evaluateActionSecurity } from "./modes";

declare const browser: any;
const runtime = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

let lastCursorX = window.innerWidth / 2;
let lastCursorY = window.innerHeight / 2;
let isExecuting = false;
let isAborted = false;

function init(): void {
  initHUD((newMode) => {
    try {
      runtime.sendMessage({ type: "mode_changed", mode: newMode });
    } catch {}
  });
  initGhostCursor();

  window.addEventListener("omnitouch-panic", () => {
    isAborted = true;
    isExecuting = false;
  });

  runtime.onMessage.addListener((message: CommandMessage, _sender: any, sendResponse: (res: any) => void) => {
    handleCommand(message)
      .then((res) => {
        try { sendResponse(res); } catch {}
      })
      .catch((err) => {
        try {
          sendResponse({
            id: message.id,
            success: false,
            error: String(err),
            timestamp: Date.now()
          });
        } catch {}
      });
    return true;
  });
}

async function handleCommand(cmd: CommandMessage): Promise<CommandResult> {
  isAborted = false;
  isExecuting = true;

  if (cmd.action === "set_mode") {
    const nextMode = (cmd.payload as { mode: PermissionMode }).mode;
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
    const annotate = (cmd.payload as { annotateMarks?: boolean }).annotateMarks ?? true;
    let marks: unknown[] = [];
    if (annotate) {
      const scanned = scanInteractiveElements();
      marks = scanned;
      renderSoMOverlay(scanned);
    }

    await new Promise((r) => setTimeout(r, 60));

    const captureRes = await new Promise<{ dataUrl: string }>((resolve, reject) => {
      runtime.sendMessage({ type: "capture_tab_screenshot" }, (res: any) => {
        if (runtime.lastError) {
          reject(runtime.lastError);
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

  let targetElement: HTMLElement | null = null;
  let targetX = lastCursorX;
  let targetY = lastCursorY;
  let targetDesc = "";

  if (cmd.action === "click") {
    const p = cmd.payload as { markId?: number; x?: number; y?: number };
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
      targetElement = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
    }
  } else if (cmd.action === "type") {
    const p = cmd.payload as { markId?: number; text: string };
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
    const p = cmd.payload as { url: string };
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
    const p = cmd.payload as { doubleClick?: boolean; button?: "left" | "right" | "middle" };
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
      const elAtPt = document.elementFromPoint(targetX, targetY) as HTMLElement | null;
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
    const p = cmd.payload as { text: string; clearFirst?: boolean; pressEnter?: boolean };
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
    const p = cmd.payload as { direction: "up" | "down" | "top" | "bottom"; distance?: number };
    const dist = p.distance ?? 400;
    let targetScrollY = window.scrollY;

    if (p.direction === "down") targetScrollY += dist;
    else if (p.direction === "up") targetScrollY -= dist;
    else if (p.direction === "top") targetScrollY = 0;
    else if (p.direction === "bottom") targetScrollY = document.body.scrollHeight;

    window.scrollTo({ top: targetScrollY, behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 450));

    isExecuting = false;
    return { id: cmd.id, success: true, data: { scrollY: window.scrollY }, timestamp: Date.now() };
  }

  if (cmd.action === "navigate") {
    const p = cmd.payload as { url: string };
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
