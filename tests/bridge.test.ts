import { describe, expect, it } from "bun:test";
import { DEFAULT_BRIDGE_PORT, DEFAULT_BRIDGE_HOST } from "../src/shared/constants";

describe("Bridge Constants & Contract", () => {
  it("defines standard loopback endpoints", () => {
    expect(DEFAULT_BRIDGE_PORT).toBe(8765);
    expect(DEFAULT_BRIDGE_HOST).toBe("127.0.0.1");
  });
});
