import type { PermissionMode, ActionType, CommandMessage } from "../../shared/types";
import { SENSITIVE_KEYWORDS, SENSITIVE_INPUT_TYPES, SENSITIVE_AUTOCOMPLETE_TYPES } from "../../shared/constants";

let currentMode: PermissionMode = "balanced";

export function getActiveMode(): PermissionMode {
  return currentMode;
}

export function setActiveMode(mode: PermissionMode): void {
  currentMode = mode;
}

export interface SecurityEvaluation {
  allowed: boolean;
  requiresPrompt: boolean;
  reason?: string;
}

export function evaluateActionSecurity(
  cmd: CommandMessage,
  targetElement?: HTMLElement | null
): SecurityEvaluation {
  const readOnlyActions: ActionType[] = ["screenshot", "get_elements", "get_axtree", "get_status"];
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
      const targetUrl = (cmd.payload as { url: string }).url;
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

      const text = (
        (targetElement.innerText || "") +
        " " +
        (targetElement.getAttribute("aria-label") || "") +
        " " +
        (targetElement.getAttribute("title") || "") +
        " " +
        (targetElement.getAttribute("value") || "")
      ).toLowerCase();

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
      const typePayload = cmd.payload as { text?: string };
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
