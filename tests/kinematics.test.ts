import { describe, expect, it } from "bun:test";
import { generateBezierPath } from "../src/extension/content/kinematics";

describe("Kinematics Engine", () => {
  it("generates correct start and target endpoints", () => {
    const startX = 100;
    const startY = 150;
    const targetX = 500;
    const targetY = 700;

    const points = generateBezierPath(startX, startY, targetX, targetY);
    expect(points.length).toBeGreaterThan(5);

    const first = points[0];
    const last = points[points.length - 1];

    expect(first.x).toBeCloseTo(startX, 0);
    expect(first.y).toBeCloseTo(startY, 0);
    expect(last.x).toBe(targetX);
    expect(last.y).toBe(targetY);
  });

  it("handles identical start and target coordinates without crashing", () => {
    const points = generateBezierPath(200, 200, 200, 200);
    expect(points.length).toBe(1);
    expect(points[0].x).toBe(200);
    expect(points[0].y).toBe(200);
  });

  it("produces monotonically increasing timestamp progression", () => {
    const points = generateBezierPath(50, 50, 400, 300);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].timeMs).toBeGreaterThanOrEqual(points[i - 1].timeMs);
    }
  });

  it("respects speed factor scaling", () => {
    const slow = generateBezierPath(0, 0, 800, 800, { speedFactor: 0.5 });
    const fast = generateBezierPath(0, 0, 800, 800, { speedFactor: 2.0 });

    const slowDuration = slow[slow.length - 1].timeMs;
    const fastDuration = fast[fast.length - 1].timeMs;

    expect(slowDuration).toBeGreaterThan(fastDuration);
  });
});
