import { BRIDGE_HTTP_URL } from "../shared/constants";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case "status": {
        const res = await fetch(`${BRIDGE_HTTP_URL}/status`);
        const json = await res.json();
        process.stdout.write(JSON.stringify(json, null, 2) + "\n");
        break;
      }
      case "nav":
      case "navigate": {
        const url = args[1];
        if (!url) {
          process.stderr.write("Error: Missing target URL.\n");
          process.exit(1);
        }
        const res = await callRPC("navigate", { url });
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      case "snap":
      case "screenshot": {
        const annotate = !args.includes("--no-som");
        const res = await callRPC("screenshot", { annotateMarks: annotate });
        if (res.success && res.data?.marks) {
          process.stdout.write(`Captured screenshot with ${res.data.marks.length} marks tagged.\n`);
        } else {
          process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        }
        break;
      }
      case "elements": {
        const res = await callRPC("get_elements", { interactiveOnly: true });
        if (res.success && Array.isArray(res.data?.marks)) {
          const list = res.data.marks;
          process.stdout.write(`Found ${list.length} interactive elements:\n`);
          for (const m of list.slice(0, 40)) {
            process.stdout.write(`[${m.id.toString().padStart(3)}] <${m.tag}> "${m.text}" (${m.x}, ${m.y})\n`);
          }
        } else {
          process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        }
        break;
      }
      case "axtree": {
        const res = await callRPC("get_axtree", {});
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      case "click": {
        const markId = parseInt(args[1], 10);
        if (isNaN(markId)) {
          process.stderr.write("Error: Expected mark ID number (e.g. omnitouch click 4)\n");
          process.exit(1);
        }
        const res = await callRPC("click", { markId });
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      case "type": {
        const markId = parseInt(args[1], 10);
        const text = args[2];
        if (isNaN(markId) || text === undefined) {
          process.stderr.write("Error: Expected mark ID and text (e.g. omnitouch type 2 'hello')\n");
          process.exit(1);
        }
        const pressEnter = args.includes("--enter");
        const res = await callRPC("type", { markId, text, pressEnter });
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      case "scroll": {
        const direction = args[1] || "down";
        const dist = args[2] ? parseInt(args[2], 10) : 400;
        const res = await callRPC("scroll", { direction, distance: dist });
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      case "mode": {
        const mode = args[1];
        if (!["permissions", "balanced", "full"].includes(mode)) {
          process.stderr.write("Error: Mode must be permissions, balanced, or full.\n");
          process.exit(1);
        }
        const res = await callRPC("set_mode", { mode });
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        break;
      }
      default: {
        process.stderr.write(`Unknown command: ${command}\n`);
        printHelp();
        process.exit(1);
      }
    }
  } catch (err) {
    process.stderr.write(`Execution failed: ${String(err)}\n`);
    process.exit(1);
  }
}

async function callRPC(action: string, payload: unknown): Promise<any> {
  const res = await fetch(`${BRIDGE_HTTP_URL}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

function printHelp(): void {
  process.stdout.write(`
OmniTouch CLI - Human-Grade AI Web Harness
Usage:
  omnitouch status                    Check bridge & extension connection
  omnitouch nav <url>                 Navigate active tab to URL
  omnitouch snap [--no-som]           Capture screenshot with Set-of-Marks
  omnitouch elements                  List interactive elements with IDs
  omnitouch axtree                    Inspect clean Accessibility Tree
  omnitouch click <markId>            Touch element with Bezier kinematics
  omnitouch type <markId> <text>      Type text with human cadence
  omnitouch scroll <up|down> [dist]   Smooth scroll active viewport
  omnitouch mode <permissions|balanced|full> Switch governance mode
\n`);
}

main();
