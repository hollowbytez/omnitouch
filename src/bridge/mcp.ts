import { dispatchToExtension, startBridge } from "./server";
import { BRIDGE_HTTP_URL } from "../shared/constants";
import * as readline from "node:readline";

const TOOLS = [
  {
    name: "omnitouch_navigate",
    description: "Navigate active browser tab to target URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Destination web address (e.g. https://github.com)" }
      },
      required: ["url"]
    }
  },
  {
    name: "omnitouch_screenshot",
    description: "Capture high-resolution viewport screenshot with optional Set-of-Marks (SoM) indexed bounding overlays.",
    inputSchema: {
      type: "object",
      properties: {
        annotate_som: { type: "boolean", description: "Whether to tag all interactive elements with high-contrast numbered badges." }
      }
    }
  },
  {
    name: "omnitouch_get_elements",
    description: "Scan active tab viewport for all interactive elements with IDs, tags, roles, text, and bounding boxes.",
    inputSchema: {
      type: "object",
      properties: {
        interactive_only: { type: "boolean", description: "Filter strictly for clickable and actionable elements." }
      }
    }
  },
  {
    name: "omnitouch_get_axtree",
    description: "Extract clean semantic Accessibility Tree (AXTree) to reason over page layout with minimal tokens.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "omnitouch_click",
    description: "Execute human-grade click using cubic Bezier motion curves and realistic dwell times.",
    inputSchema: {
      type: "object",
      properties: {
        mark_id: { type: "number", description: "Numeric Set-of-Marks badge ID from screenshot or get_elements." },
        x: { type: "number", description: "Optional raw viewport X coordinate." },
        y: { type: "number", description: "Optional raw viewport Y coordinate." },
        button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button." },
        double_click: { type: "boolean", description: "Dispatch double click sequence." }
      }
    }
  },
  {
    name: "omnitouch_type",
    description: "Type text into target element with Gaussian human cadence and React 18+ value synchronization.",
    inputSchema: {
      type: "object",
      properties: {
        mark_id: { type: "number", description: "Numeric Set-of-Marks ID of input or textarea." },
        text: { type: "string", description: "Text content to type." },
        clear_first: { type: "boolean", description: "Clear existing text before typing." },
        press_enter: { type: "boolean", description: "Dispatch Enter keystroke after typing." }
      },
      required: ["text"]
    }
  },
  {
    name: "omnitouch_scroll",
    description: "Smoothly scroll the active viewport with momentum easing.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "top", "bottom"], description: "Scroll direction." },
        distance: { type: "number", description: "Pixel distance to scroll (default 400)." }
      },
      required: ["direction"]
    }
  },
  {
    name: "omnitouch_set_mode",
    description: "Set browser autonomy security mode: permissions (Strict Guardian), balanced (Smart Sentinel), or full (Ghost Runner / God Mode).",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["permissions", "balanced", "full"], description: "Security governance mode." }
      },
      required: ["mode"]
    }
  },
  {
    name: "omnitouch_status",
    description: "Get current OmniTouch bridge connection status, active mode, and active tab metadata.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

async function handleToolCall(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case "omnitouch_navigate": {
      return await dispatchToExtension("navigate", { url: args.url });
    }
    case "omnitouch_screenshot": {
      return await dispatchToExtension("screenshot", { annotateMarks: args.annotate_som ?? true });
    }
    case "omnitouch_get_elements": {
      return await dispatchToExtension("get_elements", { interactiveOnly: args.interactive_only ?? true });
    }
    case "omnitouch_get_axtree": {
      return await dispatchToExtension("get_axtree", {});
    }
    case "omnitouch_click": {
      return await dispatchToExtension("click", {
        markId: args.mark_id,
        x: args.x,
        y: args.y,
        button: args.button,
        doubleClick: args.double_click
      });
    }
    case "omnitouch_type": {
      return await dispatchToExtension("type", {
        markId: args.mark_id,
        text: args.text,
        clearFirst: args.clear_first,
        pressEnter: args.press_enter
      });
    }
    case "omnitouch_scroll": {
      return await dispatchToExtension("scroll", {
        direction: args.direction,
        distance: args.distance
      });
    }
    case "omnitouch_set_mode": {
      return await dispatchToExtension("set_mode", { mode: args.mode });
    }
    case "omnitouch_status": {
      return await dispatchToExtension("get_status", {});
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function startMCP(): Promise<void> {
  try {
    const res = await fetch(`${BRIDGE_HTTP_URL}/status`, { signal: AbortSignal.timeout(600) });
    if (!res.ok) {
      await startBridge();
    }
  } catch {
    await startBridge();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      const id = msg.id;

      if (msg.method === "initialize") {
        sendResponse(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "omnitouch-mcp", version: "1.0.0" }
        });
        return;
      }

      if (msg.method === "notifications/initialized") {
        return;
      }

      if (msg.method === "tools/list") {
        sendResponse(id, { tools: TOOLS });
        return;
      }

      if (msg.method === "tools/call") {
        const { name, arguments: toolArgs } = msg.params;
        try {
          const res = await handleToolCall(name, toolArgs || {});
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(res, null, 2)
              }
            ]
          });
        } catch (err) {
          sendResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: false, error: String(err) })
              }
            ],
            isError: true
          });
        }
        return;
      }

      sendError(id, -32601, `Method not found: ${msg.method}`);
    } catch (e) {
      sendError(null, -32700, "Parse error");
    }
  });
}

function sendResponse(id: any, result: any): void {
  const out = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(`${out}\n`);
}

function sendError(id: any, code: number, message: string): void {
  const out = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(`${out}\n`);
}

startMCP();
