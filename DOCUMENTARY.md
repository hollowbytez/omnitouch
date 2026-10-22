# OmniTouch: The Architecture Documentary & Technical Manual
*Engineering a Human-Grade Neural Web Harness and Autonomous Dual-Browser Extension*

---

## Prologue: The Automation Dilemma

Modern artificial intelligence models possess staggering reasoning capabilities, yet their ability to interface with the World Wide Web remains crippled by archaic automation paradigms.

For over a decade, browser automation was dominated by deterministic testing frameworks: Selenium, Puppeteer, and Playwright. When developers began wiring large language models to these frameworks, a systemic design failure became immediately apparent:

1. **The Sterile Sandbox Problem**: Headless drivers spawn isolated, sterile browser sessions. They strip away user authentication, saved cookies, enterprise single-sign-on (SSO), extensions, and password managers. To automate a routine workflow on a user's GitHub, AWS console, or banking portal, an agent running on Playwright must be handed raw credentials or forced through complex session cookie extraction pipelines.
2. **The Bot Detection Iron Curtain**: Anti-bot engines (Cloudflare Turnstile, DataDome, Akamai Bot Manager, Kasada) actively monitor browser execution contexts. They interrogate `navigator.webdriver`, inspect CDP execution artifacts, measure micro-delays between pointer events, and verify whether mouse coordinates jump instantaneously in Euclidean straight lines. A standard script dispatching `element.click()` or jumping between `(0,0)` and `(520,380)` in zero milliseconds triggers an instant CAPTCHA or silent IP blacklisting.
3. **The Reactive State Desynchronization Trap**: Modern web applications built on React 18+, Vue 3, Svelte, and Angular do not listen to traditional DOM attribute mutations. React maintains an internal `_valueTracker` property on form inputs. Setting `input.value = "my_text"` directly in JavaScript updates the DOM node visually but bypasses React's synthetic event loop; the moment a user or script submits the form, React pulls from its internal Fiber state and sends an empty string.
4. **The Binary Permission Gap**: Existing agent harnesses operate in one of two extremes: either completely deaf-blind (requiring manual approval for every single read operation, crippling autonomy) or recklessly unrestricted (allowing the AI to accidentally click "Delete Organization", submit payment forms, or transfer funds without safety gates).

**OmniTouch was engineered from the ground up to eliminate all four vulnerabilities.** It runs directly inside your actual browser profile in Chrome and Firefox, communicates with any local AI harness via Model Context Protocol (MCP) and WebSocket, navigates with physiological human biomechanics, grounds its vision through high-contrast Set-of-Marks (SoM) overlays, and enforces a three-tier security governance architecture.

---

## System Architecture Overview

```
 +-----------------------------------------------------------------------------------+
 |                             AI Agent & Harness Tier                               |
 |   (Antigravity CLI / Claude Code / Cursor / Windsurf / Python Scripts / Shell)    |
 +-----------------------------------------+-----------------------------------------+
                                           |  MCP stdio / JSON-RPC / CLI
                                           v
 +-----------------------------------------------------------------------------------+
 |                   OmniTouch Local Bridge Daemon (Port 8765)                       |
 |  - WebSocket Gateway (ws://127.0.0.1:8765/bridge)                                 |
 |  - Model Context Protocol (MCP) Server Interface                                  |
 |  - HTTP REST RPC Dispatcher (http://127.0.0.1:8765/rpc)                           |
 |  - Correlation Request Router & Timeout Manager                                   |
 +-----------------------------------------+-----------------------------------------+
                                           |  Localhost WebSocket (Bidirectional)
                                           v
 +-----------------------------------------------------------------------------------+
 |                   OmniTouch Dual-Engine Browser Extension                         |
 |                       (Chromium MV3 & Firefox WebExtension)                       |
 |                                                                                   |
 |  [Background Service Worker]                                                      |
 |  - Persistent WebSocket heartbeat                                                 |
 |  - Active tab tracking & screenshot capture pipeline                              |
 |  - Chromium CDP debugger bridge & Firefox message relay                           |
 |                                                                                   |
 |  [Content Script Runtime (Injected in Active Webpage)]                            |
 |  +-----------------------------------------------------------------------------+ |
 |  | 1. Kinematics Engine                                                        | |
 |  |    - Cubic Bezier trajectory calculation with randomized curvature          | |
 |  |    - Fitts's law acceleration & deceleration profiling                      | |
 |  |    - 8-12Hz neuromuscular micro-tremor injection                            | |
 |  |    - Overshoot-and-settle ballistic correction                              | |
 |  |    - Gaussian keystroke cadence & React 18+ _valueTracker synchronization   | |
 |  |    - Inertial smooth scrolling                                              | |
 |  +-----------------------------------------------------------------------------+ |
 |  | 2. Visual Grounding Engine                                                  | |
 |  |    - Viewport interactive node scanning (a, button, input, ARIA roles)       | |
 |  |    - Dynamic Set-of-Marks (SoM) high-contrast numbered badge overlay        | |
 |  |    - Accessibility Tree (AXTree) serializer for token-efficient reasoning   | |
 |  +-----------------------------------------------------------------------------+ |
 |  | 3. Security & Governance Engine (3 Modes)                                   | |
 |  |    - Mode 1: Strict Guardian (Zero-Trust Human Approval)                    | |
 |  |    - Mode 2: Smart Sentinel (Autonomous + High-Impact Blast Gates)           | |
 |  |    - Mode 3: Ghost Runner (Uncapped God Mode Velocity)                      | |
 |  +-----------------------------------------------------------------------------+ |
 |  | 4. User Interface Layer (Shadow DOM Isolated)                              | |
 |  |    - Floating Cyber HUD Pill & Live Action Status Badge                     | |
 |  |    - Interactive Human Approval Modal Drawer                                | |
 |  |    - Visual Ghost Hand laser cursor & motion trail                          | |
 |  |    - Emergency Panic Killswitch (Ctrl+Shift+X)                              | |
 |  +-----------------------------------------------------------------------------+ |
 +-----------------------------------------------------------------------------------+
```

---

## Chapter 1: The Biomechanics of Human Touch

Robotic automation is defined by discontinuities. An automated driver sets `mouse.x = 800; mouse.y = 400`, instantly firing an event where velocity is mathematically infinite. Modern heuristic anti-bot scripts compute the second derivative of mouse position over time ($\frac{d^2 x}{dt^2}$); infinite acceleration flags an artificial bot in under three milliseconds.

OmniTouch rejects instant teleportation in favor of biological kinesics.

### 1.1 The Cubic Bezier Trajectory Equation

When a human moves their hand across a desk to click a button, the hand does not move in a straight line. Physiological joint geometry in the shoulder, elbow, and wrist forces the arm through an elliptical curve.

OmniTouch models this using parametric cubic Bezier curves:

$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3, \quad t \in [0, 1]$$

Where:
- $P_0 = (x_{\text{start}}, y_{\text{start}})$ is the cursor's current position.
- $P_3 = (x_{\text{target}}, y_{\text{target}})$ is the center of the target element.
- $P_1$ and $P_2$ are dynamically generated control points calculated by taking perpendicular unit vectors relative to the travel axis:

$$P_1 = P_0 + 0.30 \cdot \vec{D} + \vec{D}_{\perp} \cdot (\kappa_1 \cdot \|\vec{D}\|)$$
$$P_2 = P_0 + 0.75 \cdot \vec{D} + \vec{D}_{\perp} \cdot (\kappa_2 \cdot \|\vec{D}\|)$$

Where $\vec{D} = P_3 - P_0$, $\vec{D}_{\perp}$ is the normal unit vector, and $\kappa_1, \kappa_2$ are randomized curvature coefficients.

### 1.2 Velocity Profiling & Minimum-Jerk Motion

Humans obey Fitts's Law and the minimum-jerk trajectory model. Movement begins with an initial acceleration phase from rest, peaks at a maximum cruise velocity approximately 40% through the duration, and smoothly decelerates as the hand homes in on the target.

OmniTouch applies a cubic ease-in-out time warp function to the normalized parameter $t$:

$$t_{\text{warped}} = \begin{cases} 4 t^3 & \text{if } t < 0.5 \\ 1 - \frac{(-2t + 2)^3}{2} & \text{if } t \ge 0.5 \end{cases}$$

### 1.3 Neuromuscular Tremor (Micro-Jitters)

No human hand is completely steady. Physiological tremors occur between 8Hz and 12Hz due to alternating muscle contractions. OmniTouch injects low-amplitude Gaussian noise perpendicular to the trajectory:

$$\text{Jitter}(t) = \sin(t \cdot \pi) \cdot \mathcal{N}(0, \sigma^2)$$

Because the sine envelope peaks in the middle and reaches zero at $t=0$ and $t=1$, the cursor lands on the target with mathematical precision while trembling naturally mid-flight.

### 1.4 Ballistic Overshoot and Settlement

When targeting small interface elements at high velocity, human motor control frequently overshoots the target boundary by 2% to 4% of the travel distance before enacting a minor corrective adjustment. OmniTouch incorporates ballistic overshoot points when travel distance exceeds 150 pixels, drifting past the target centroid before settling backward over 40 milliseconds.

### 1.5 React 18+ Value Tracker Reconciliation

In modern reactive frameworks, form inputs override the native DOM setter:

```typescript
const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
descriptor.set.call(element, nextValue);
const tracker = element._valueTracker;
if (tracker) {
  tracker.setValue(previousValue);
}
element.dispatchEvent(new InputEvent("input", { bubbles: true, data: char }));
```

By explicitly resetting the internal `_valueTracker` before dispatching `input` and `change` events, OmniTouch ensures that React, Vue, and Svelte state stores always synchronize without dropping characters.

---

## Chapter 2: Visual Grounding via Set-of-Marks (SoM)

Traditional AI web navigation suffers from coordinate hallucination. When an LLM is given a raw screenshot, it must guess pixel coordinates $(x, y)$ based on visual visual estimation. On Retina/HiDPI screens or responsive layouts, coordinates are frequently off by 20 to 50 pixels, resulting in missed clicks.

Conversely, passing millions of characters of raw HTML blows out LLM context windows, confuses the model with CSS scripts and tracking pixels, and drains token budgets.

OmniTouch implements dual-grounding:

### 2.1 The Set-of-Marks (SoM) Engine
When an AI requests a screenshot, OmniTouch:
1. Traverses the live DOM using an aggressive interactive selector:
   `a[href], button, input, select, textarea, [role='button'], [onclick], [contenteditable='true']`
2. Evaluates visibility via `getBoundingClientRect()`, computed styles (`display`, `visibility`, `opacity`), and clipping bounds against the viewport.
3. Injects a high-contrast Set-of-Marks overlay:
   - Each element is bounded with a subtle cyan wireframe.
   - A bold, high-contrast numeric badge (e.g. `[1]`, `[2]`, `[3]`) is pinned to the top-left vertex.
4. Triggers `captureVisibleTab`.
5. Removes the overlay from the DOM immediately so the page remains untouched.
6. Returns both the annotated image and a structured index table to the AI harness.

The agent no longer needs to guess pixel coordinates. It simply calls:
`omnitouch_click({ mark_id: 14 })`

### 2.2 Semantic Accessibility Tree (AXTree)
For text-first or high-speed token-conscious reasoning, OmniTouch provides `omnitouch_get_axtree()`. This extracts only semantic nodes (roles, accessible names, values, and bounding coordinates), stripping 95% of HTML markup while providing 100% actionable precision.

---

## Chapter 3: The 3-Tier Security Governance Matrix

Operating an AI in a live browser with existing user sessions demands airtight security boundaries. OmniTouch replaces blunt binary switches with three distinct operational modes:

| Security Mode | Core Philosophy | Read Operations | Benign Mutations | High-Impact Mutations | Target Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Strict Guardian** | *Zero-Trust Human Verification* | Autonomous | Prompts Human | Prompts Human | Mission-critical tasks, initial agent onboarding, sensitive administrative workflows. |
| **2. Smart Sentinel** | *Blast-Radius Governed Autonomy* | Autonomous | Autonomous | Prompts Human | Everyday workflows, browsing, research, authenticated portal interaction. |
| **3. Ghost Runner** | *Unrestricted Autonomous Velocity* | Autonomous | Autonomous | Autonomous | High-speed batch processing, continuous integration, fully automated testing. |

### 3.1 Mode 1: Strict Guardian (Permissions)
In Strict Guardian mode, the agent cannot execute any mutating action (clicking a button, entering text, navigating to a new URL, submitting a form) without human confirmation. When a mutating command arrives, OmniTouch pauses execution and slides open the approval drawer on the in-page HUD displaying:
- The command type and destination selector.
- The reason authorization is required.
- Keyboard shortcuts: `Enter` to approve, `Esc` to reject.

### 3.2 Mode 2: Smart Sentinel (Balanced - The Golden Mean)
Smart Sentinel is the default mode. It allows the agent to navigate between internal pages, click navigation links, switch tabs, scroll, and type into search bars or filters with zero friction.

However, the moment the agent targets a high-impact surface, Smart Sentinel halts execution and triggers a security approval prompt:
- **Authentication Inputs**: Password inputs (`type="password"`), pin fields, 2FA/MFA token fields.
- **Financial Triggers**: Buttons or text containing `checkout`, `pay now`, `buy now`, `place order`, `credit card`, `cvv`.
- **Destructive Verbs**: Elements containing `delete account`, `purge`, `remove organization`, `terminate`, `revoke key`.
- **Cross-Domain Traversal**: Navigation attempting to redirect from the active domain to an external third-party host.

### 3.3 Mode 3: Ghost Runner (Full-Permissions / God Mode)
Ghost Runner removes all approval barriers. The kinematics engine and visual grounding operate at maximum velocity, executing end-to-end multi-step instructions without pausing.

### 3.4 The Universal Panic Killswitch
In any mode, the human operator maintains absolute supremacy:
- Pressing `Ctrl+Shift+X` instantaneously revokes harness control, terminates active mouse movements, clears pending commands, and signals the bridge that execution was halted.
- The floating HUD features an immediate red `PANIC` button.

---

## Chapter 4: Universal Agent Harness & Protocols

OmniTouch connects to any development harness through three unified protocols:

### 4.1 Model Context Protocol (MCP)
OmniTouch provides a first-class MCP server running over `stdio` or HTTP. To integrate with Antigravity, Claude Code, or Cursor, add the server to your settings:

```json
{
  "mcpServers": {
    "omnitouch": {
      "command": "bun",
      "args": ["run", "C:/Users/Mohd Hasan/projects/omnitouch/src/bridge/mcp.ts"]
    }
  }
}
```

Exposed MCP Tools:
- `omnitouch_navigate({ url })`: Navigates tab to target destination.
- `omnitouch_screenshot({ annotate_som })`: Captures screenshot with numbered Set-of-Marks.
- `omnitouch_get_elements({ interactive_only })`: Lists interactive nodes with IDs and labels.
- `omnitouch_get_axtree()`: Returns token-efficient semantic tree.
- `omnitouch_click({ mark_id, x, y, button, double_click })`: Touches target using Bezier kinematics.
- `omnitouch_type({ mark_id, text, clear_first, press_enter })`: Types with human cadence.
- `omnitouch_scroll({ direction, distance })`: Smooth inertial scrolling.
- `omnitouch_set_mode({ mode })`: Switches governance mode (`permissions`, `balanced`, `full`).
- `omnitouch_status()`: Queries connection state and active tab metadata.

### 4.2 WebSocket Bridge Gateway
- Default Port: `ws://127.0.0.1:8765/bridge`
- Bidirectional JSON-RPC exchange between bridge daemon and browser service worker.
- Supports correlation IDs and request timeout guarantees.

### 4.3 OmniTouch Terminal CLI
For shell scripts, Python subprocesses, or rapid terminal control:

```bash
# Check system status
bun run cli status

# Navigate to a web application
bun run cli nav https://news.ycombinator.com

# Capture screenshot with visual Set-of-Marks badges
bun run cli snap

# Inspect interactive elements
bun run cli elements

# Click badge #4 using human kinematics
bun run cli click 4

# Type text into input #2 with realistic human typing speed
bun run cli type 2 "antigravity" --enter

# Switch security mode
bun run cli mode full
```

---

## Chapter 5: Cross-Browser Dual-Target Engine

OmniTouch supports both Chromium (Google Chrome, Microsoft Edge, Brave, Arc) and Mozilla Firefox through a unified build pipeline.

### Chromium Engine (Manifest V3)
- Background Execution: Modular Service Worker (`service_worker.js`).
- Visual Capture: `chrome.tabs.captureVisibleTab`.
- Native Input Dispatch: Optional CDP `chrome.debugger` attachment for low-level OS-grade event injection.
- Security Isolation: Closed Shadow DOM content injection for the HUD and Ghost Cursor.

### Firefox Engine (WebExtension MV2/MV3)
- Background Execution: Native Background Scripts (`browser.*` polyfill).
- Visual Capture: `browser.tabs.captureVisibleTab`.
- Event Synthesis: High-fidelity DOM event dispatch with synthetic PointerEvent and MouseEvent chains.
- Strict Gecko Add-on Manifest with unique application ID.

---

## Chapter 6: Verification & Empirical Benchmarks

OmniTouch includes a dedicated test suite verifying the mathematical fidelity of its kinematic models and the boundary enforcement of its security governance layers:

```powershell
Set-Location "C:\Users\Mohd Hasan\projects\omnitouch"
bun test
```

### Verified Test Matrix:
- **Kinematic Endpoints**: Validates that Bezier trajectories consistently start at origin and terminate at exact element centroids.
- **Timestamp Monotonicity**: Verifies that time progression across trajectory points is strictly monotonic.
- **Velocity Scaling**: Confirms that speed factor modifiers correctly contract or expand total movement duration.
- **Zero-Trust Enforcement**: Verifies that Strict Guardian mode intercepts 100% of mutating actions.
- **Autonomous Velocity**: Verifies that Ghost Runner mode allows unprompted execution across all actions.
- **Keyword Boundary Detection**: Verifies that high-impact terms (`pay now`, `password`, `checkout`) trigger immediate authorization gates in Smart Sentinel mode.
- **Benign Pass-Through**: Verifies that everyday search queries and navigational actions execute without annoying approval prompts in Smart Sentinel mode.

---

## Epilogue: The Future of Neural Web Control

OmniTouch redefines the frontier of browser automation. By uniting human biological kinesics, multimodal Set-of-Marks visual grounding, zero-profile context preservation, and a three-tier security governance architecture, it transforms AI agents from clumsy, easily-blocked automation bots into seamless digital collaborators capable of touching and seeing the modern web exactly as a human does.
