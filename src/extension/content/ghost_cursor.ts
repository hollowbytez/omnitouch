let cursorHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let cursorDot: HTMLDivElement | null = null;
let trailCanvas: HTMLCanvasElement | null = null;
let trailCtx: CanvasRenderingContext2D | null = null;
const trailHistory: { x: number; y: number; alpha: number }[] = [];
let animFrameId: number | null = null;
let isEnabled = true;

export function initGhostCursor(): void {
  if (cursorHost) return;

  cursorHost = document.createElement("div");
  cursorHost.id = "omnitouch-cursor-host";
  cursorHost.style.position = "fixed";
  cursorHost.style.top = "0";
  cursorHost.style.left = "0";
  cursorHost.style.width = "0";
  cursorHost.style.height = "0";
  cursorHost.style.pointerEvents = "none";
  cursorHost.style.zIndex = "2147483645";

  shadowRoot = cursorHost.attachShadow({ mode: "closed" });

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
  shadowRoot.appendChild(style);

  trailCanvas = document.createElement("canvas");
  trailCanvas.className = "ghost-canvas";
  trailCanvas.width = window.innerWidth;
  trailCanvas.height = window.innerHeight;
  shadowRoot.appendChild(trailCanvas);
  trailCtx = trailCanvas.getContext("2d");

  cursorDot = document.createElement("div");
  cursorDot.className = "ghost-dot";
  shadowRoot.appendChild(cursorDot);

  document.documentElement.appendChild(cursorHost);

  window.addEventListener("resize", () => {
    if (trailCanvas) {
      trailCanvas.width = window.innerWidth;
      trailCanvas.height = window.innerHeight;
    }
  });

  startTrailLoop();
}

export function setGhostCursorEnabled(enabled: boolean): void {
  isEnabled = enabled;
  if (!isEnabled && cursorDot) {
    cursorDot.style.display = "none";
  }
}

export function updateGhostCursor(x: number, y: number): void {
  if (!isEnabled) return;
  initGhostCursor();

  if (cursorDot) {
    cursorDot.style.display = "block";
    cursorDot.style.left = `${x}px`;
    cursorDot.style.top = `${y}px`;
  }

  trailHistory.push({ x, y, alpha: 1.0 });
  if (trailHistory.length > 25) {
    trailHistory.shift();
  }
}

export function triggerClickPulse(x: number, y: number): void {
  if (!isEnabled || !shadowRoot) return;

  const pulse = document.createElement("div");
  pulse.className = "pulse-ring";
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  pulse.style.width = "30px";
  pulse.style.height = "30px";

  shadowRoot.appendChild(pulse);
  setTimeout(() => {
    if (pulse.parentNode) pulse.parentNode.removeChild(pulse);
  }, 450);
}

function startTrailLoop(): void {
  function render() {
    if (trailCtx && trailCanvas) {
      trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

      if (trailHistory.length > 1) {
        for (let i = 0; i < trailHistory.length - 1; i++) {
          const pt = trailHistory[i];
          const next = trailHistory[i + 1];
          pt.alpha *= 0.92;

          trailCtx.beginPath();
          trailCtx.moveTo(pt.x, pt.y);
          trailCtx.lineTo(next.x, next.y);
          trailCtx.strokeStyle = `rgba(56, 189, 248, ${pt.alpha * 0.7})`;
          trailCtx.lineWidth = Math.max(1, (i / trailHistory.length) * 4);
          trailCtx.lineCap = "round";
          trailCtx.stroke();
        }
      }

      for (let i = trailHistory.length - 1; i >= 0; i--) {
        if (trailHistory[i].alpha < 0.05) {
          trailHistory.splice(i, 1);
        }
      }
    }
    animFrameId = requestAnimationFrame(render);
  }
  animFrameId = requestAnimationFrame(render);
}

export function destroyGhostCursor(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (cursorHost && cursorHost.parentNode) {
    cursorHost.parentNode.removeChild(cursorHost);
  }
  cursorHost = null;
  shadowRoot = null;
  cursorDot = null;
  trailCanvas = null;
  trailCtx = null;
}
