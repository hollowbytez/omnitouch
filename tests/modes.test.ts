import { describe, expect, it } from "bun:test";
import { evaluateActionSecurity, setActiveMode, getActiveMode } from "../src/extension/content/modes";
import type { CommandMessage } from "../src/shared/types";

describe("Permission Modes Engine", () => {
  it("allows read-only actions across all modes without prompt", () => {
    setActiveMode("permissions");
    const cmd: CommandMessage = {
      id: "1",
      action: "screenshot",
      payload: { annotateMarks: true },
      timestamp: Date.now()
    };
    const res = evaluateActionSecurity(cmd);
    expect(res.allowed).toBe(true);
    expect(res.requiresPrompt).toBe(false);
  });

  it("blocks mutating actions in Strict Guardian mode", () => {
    setActiveMode("permissions");
    const cmd: CommandMessage = {
      id: "2",
      action: "click",
      payload: { markId: 10 },
      timestamp: Date.now()
    };
    const res = evaluateActionSecurity(cmd);
    expect(res.allowed).toBe(false);
    expect(res.requiresPrompt).toBe(true);
  });

  it("allows unprompted execution for all actions in Ghost Runner mode", () => {
    setActiveMode("full");
    const cmd: CommandMessage = {
      id: "3",
      action: "click",
      payload: { markId: 10 },
      timestamp: Date.now()
    };
    const res = evaluateActionSecurity(cmd);
    expect(res.allowed).toBe(true);
    expect(res.requiresPrompt).toBe(false);
  });

  it("intercepts sensitive keywords in Smart Sentinel mode", () => {
    setActiveMode("balanced");
    const cmd: CommandMessage = {
      id: "4",
      action: "type",
      payload: { text: "please pay now for order" },
      timestamp: Date.now()
    };
    const res = evaluateActionSecurity(cmd);
    expect(res.allowed).toBe(false);
    expect(res.requiresPrompt).toBe(true);
    expect(res.reason).toContain("pay now");
  });

  it("allows benign typing in Smart Sentinel mode", () => {
    setActiveMode("balanced");
    const cmd: CommandMessage = {
      id: "5",
      action: "type",
      payload: { text: "quantum physics overview" },
      timestamp: Date.now()
    };
    const res = evaluateActionSecurity(cmd);
    expect(res.allowed).toBe(true);
    expect(res.requiresPrompt).toBe(false);
  });
});
