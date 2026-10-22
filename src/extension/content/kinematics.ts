import type { KinematicTrajectoryPoint } from "../../shared/types";

export interface TrajectoryOptions {
  speedFactor?: number;
  jitterAmplitude?: number;
  overshoot?: boolean;
}

export function generateBezierPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  options: TrajectoryOptions = {}
): KinematicTrajectoryPoint[] {
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

  const points: KinematicTrajectoryPoint[] = [];
  const jitterAmp = options.jitterAmplitude ?? 1.2;

  for (let i = 0; i <= steps; i++) {
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
    const overshootX = targetX + (dx / distance) * overshootDist;
    const overshootY = targetY + (dy / distance) * overshootDist;
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

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export async function executeHumanMouseMotion(
  points: KinematicTrajectoryPoint[],
  onStep?: (point: KinematicTrajectoryPoint) => void
): Promise<void> {
  const startTime = performance.now();
  for (let i = 0; i < points.length; i++) {
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

export async function humanClick(
  element: HTMLElement,
  x: number,
  y: number,
  options: { doubleClick?: boolean; button?: "left" | "right" | "middle" } = {}
): Promise<void> {
  const button = options.button ?? "left";
  const buttonCode = button === "left" ? 0 : button === "middle" ? 1 : 2;
  const buttonsCode = button === "left" ? 1 : button === "middle" ? 4 : 2;

  const eventInit: MouseEventInit = {
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

export async function humanType(
  element: HTMLElement,
  text: string,
  options: { clearFirst?: boolean; pressEnter?: boolean } = {}
): Promise<void> {
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

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const key = char;
    const isUpper = char >= "A" && char <= "Z";

    if (isUpper) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", bubbles: true }));
    }

    const keyInit: KeyboardEventInit = {
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
    const enterInit: KeyboardEventInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", enterInit));
    element.dispatchEvent(new KeyboardEvent("keypress", enterInit));
    element.dispatchEvent(new KeyboardEvent("keyup", enterInit));

    if (element instanceof HTMLInputElement && element.form) {
      element.form.requestSubmit?.();
    }
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = element instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  const tracker = (element as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
  if (tracker) {
    tracker.setValue(value);
  }
}

function gaussianRandom(mean: number, stdev: number): number {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + randStdNormal * stdev;
}
