from playwright.sync_api import sync_playwright
import os
import pathlib

root_dir = pathlib.Path(__file__).parent.resolve()
assets_dir = root_dir / "assets"
assets_dir.mkdir(parents=True, exist_ok=True)

html_architecture = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: #060913; color: #f8fafc; padding: 40px; width: 1200px; height: 680px; display: flex; flex-direction: column; justify-content: space-between; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; }
  .title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { font-size: 13px; color: #94a3b8; font-weight: 500; }
  .badge { background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; flex: 1; }
  .card { background: #0c1222; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
  .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .card-num { width: 28px; height: 28px; border-radius: 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
  .card-title { font-size: 16px; font-weight: 700; color: #e2e8f0; }
  .feature-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .feature-item { font-size: 13px; color: #94a3b8; display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
  .bullet { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; margin-top: 6px; flex-shrink: 0; }
  .footer-bar { display: flex; justify-content: space-between; align-items: center; background: #0c1222; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 20px; margin-top: 20px; font-size: 12px; color: #64748b; }
  .tech-pills { display: flex; gap: 8px; }
  .pill { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">OmniTouch System Architecture</h1>
      <p class="subtitle">Human-Grade AI Web Harness & Dual-Browser Neural Extension</p>
    </div>
    <div class="badge">Production Grade</div>
  </div>

  <div class="grid">
    <div class="card">
      <div>
        <div class="card-header">
          <div class="card-num">1</div>
          <div class="card-title">AI Harness & Bridge</div>
        </div>
        <ul class="feature-list">
          <li class="feature-item"><span class="bullet"></span><span>Model Context Protocol (MCP) server over stdio for Antigravity & Claude Code</span></li>
          <li class="feature-item"><span class="bullet"></span><span>High-throughput loopback WebSocket server on port 8765</span></li>
          <li class="feature-item"><span class="bullet"></span><span>HTTP REST JSON-RPC endpoint for script automation</span></li>
          <li class="feature-item"><span class="bullet"></span><span>Autonomous correlation ID matching & timeout guards</span></li>
        </ul>
      </div>
      <div class="tech-pills"><span class="pill">MCP stdio</span><span class="pill">ws://127.0.0.1:8765</span></div>
    </div>

    <div class="card">
      <div>
        <div class="card-header">
          <div class="card-num">2</div>
          <div class="card-title">Dual Browser Core</div>
        </div>
        <ul class="feature-list">
          <li class="feature-item"><span class="bullet"></span><span>Chromium Manifest V3 background service worker</span></li>
          <li class="feature-item"><span class="bullet"></span><span>Firefox WebExtension background architecture</span></li>
          <li class="feature-item"><span class="bullet"></span><span>Full active-profile session preservation (cookies, 2FA, logins)</span></li>
          <li class="feature-item"><span class="bullet"></span><span>High-res native tab screenshot rendering engine</span></li>
        </ul>
      </div>
      <div class="tech-pills"><span class="pill">Chrome MV3</span><span class="pill">Firefox Gecko</span></div>
    </div>

    <div class="card">
      <div>
        <div class="card-header">
          <div class="card-num">3</div>
          <div class="card-title">Kinematics & Governance</div>
        </div>
        <ul class="feature-list">
          <li class="feature-item"><span class="bullet"></span><span>Cubic Bezier curves with 8-12Hz micro-tremor injection</span></li>
          <li class="feature-item"><span class="bullet"></span><span>Gaussian keystroke cadence & React 18+ value sync</span></li>
          <li class="feature-item"><span class="bullet"></span><span>Set-of-Marks (SoM) indexed visual badge grounding</span></li>
          <li class="feature-item"><span class="bullet"></span><span>3-tier modes: Strict Guardian, Smart Sentinel, Ghost Runner</span></li>
        </ul>
      </div>
      <div class="tech-pills"><span class="pill">Bezier Math</span><span class="pill">3-Tier Matrix</span></div>
    </div>
  </div>

  <div class="footer-bar">
    <span>Zero comments in source code | Zero emojis | Fully verified with automated test suites</span>
    <span>OmniTouch Core v1.0.0</span>
  </div>
</body>
</html>
"""

html_som = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: #090e17; color: #f1f5f9; padding: 30px; width: 1200px; height: 680px; position: relative; overflow: hidden; }
  .browser-nav { display: flex; align-items: center; gap: 12px; background: #0f172a; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 24px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .url-bar { flex: 1; background: #090e17; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 14px; font-family: monospace; font-size: 12px; color: #38bdf8; }
  .portal { display: grid; grid-template-columns: 240px 1fr; gap: 20px; height: calc(100% - 70px); }
  .sidebar { background: #0f172a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .main-content { background: #0f172a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); padding: 24px; display: flex; flex-direction: column; gap: 18px; }
  .som-box { position: relative; border: 1.5px solid rgba(56, 189, 248, 0.85); background: rgba(56, 189, 248, 0.08); border-radius: 6px; }
  .som-badge { position: absolute; top: -11px; left: -2px; background: #0284c7; color: #fff; font-family: monospace; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
  .nav-btn { padding: 10px 14px; font-size: 13px; font-weight: 600; color: #cbd5e1; }
  .search-input { width: 100%; padding: 10px 14px; background: #060913; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #f8fafc; font-size: 14px; }
  .action-btn { padding: 10px 20px; background: #0284c7; color: #fff; font-size: 13px; font-weight: 600; border-radius: 6px; border: none; }
  .data-card { background: #060913; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 16px; }
  .hud-pill { position: absolute; top: 50px; right: 50px; display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 9999px; padding: 8px 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); z-index: 100; }
  .ghost-cursor { position: absolute; top: 220px; left: 520px; width: 16px; height: 16px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 14px #38bdf8, 0 0 28px rgba(56, 189, 248, 0.8); }
</style>
</head>
<body>
  <div class="browser-nav">
    <div style="display:flex;gap:6px">
      <div class="dot" style="background:#ef4444"></div>
      <div class="dot" style="background:#eab308"></div>
      <div class="dot" style="background:#22c55e"></div>
    </div>
    <div class="url-bar">https://console.cloud-neural.internal/clusters/production</div>
  </div>

  <div class="hud-pill">
    <div style="width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8"></div>
    <span style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.05em">OMNITOUCH</span>
    <span style="background:rgba(56, 189, 248, 0.2);color:#7dd3fc;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">Balanced Mode</span>
    <span style="font-size:11px;color:#cbd5e1;font-family:monospace">Touching Mark #4...</span>
  </div>

  <div class="portal">
    <div class="sidebar">
      <div class="som-box" style="margin-bottom:8px">
        <span class="som-badge">1</span>
        <div class="nav-btn">Clusters Overview</div>
      </div>
      <div class="som-box" style="margin-bottom:8px">
        <span class="som-badge">2</span>
        <div class="nav-btn">Telemetry Metrics</div>
      </div>
      <div class="som-box" style="margin-bottom:8px">
        <span class="som-badge">3</span>
        <div class="nav-btn">Access Policies</div>
      </div>
    </div>

    <div class="main-content">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="som-box" style="flex:1">
          <span class="som-badge">4</span>
          <input class="search-input" value="filter: us-east-1 prod-worker" readonly />
        </div>
        <div class="som-box">
          <span class="som-badge">5</span>
          <button class="action-btn">Apply Filter</button>
        </div>
      </div>

      <div class="data-card">
        <h3 style="font-size:16px;margin-bottom:8px">Cluster Health: Nominal (48/48 Nodes Active)</h3>
        <p style="font-size:13px;color:#94a3b8;line-height:1.5">OmniTouch dynamically maps every interactive vertex on the DOM into a high-contrast Set-of-Marks overlay. Coordinates are calculated relative to viewport clipping, eliminating LLM hallucinations.</p>
      </div>

      <div style="display:flex;gap:12px">
        <div class="som-box" style="flex:1">
          <span class="som-badge">6</span>
          <button class="action-btn" style="background:#1e293b;width:100%">Download Logs</button>
        </div>
        <div class="som-box" style="flex:1">
          <span class="som-badge">7</span>
          <button class="action-btn" style="background:#1e293b;width:100%">Restart Pod</button>
        </div>
      </div>
    </div>
  </div>

  <div class="ghost-cursor"></div>
</body>
</html>
"""

html_kinematics = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: #060913; color: #f8fafc; padding: 40px; width: 1200px; height: 680px; display: flex; flex-direction: column; justify-content: space-between; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; }
  .title { font-size: 26px; font-weight: 800; color: #f8fafc; }
  .subtitle { font-size: 13px; color: #94a3b8; }
  .canvas-container { position: relative; width: 100%; height: 440px; background: #0b1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin-top: 20px; overflow: hidden; }
  svg { width: 100%; height: 100%; }
  .legend { display: flex; gap: 24px; margin-top: 14px; font-size: 13px; }
  .legend-item { display: flex; align-items: center; gap: 8px; }
  .legend-line { width: 24px; height: 3px; border-radius: 2px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Kinematic Motion Trajectory Analysis</h1>
      <p class="subtitle">Standard Robotic Teleportation vs OmniTouch Minimum-Jerk Cubic Bezier with 8-12Hz Tremors</p>
    </div>
  </div>

  <div class="canvas-container">
    <svg viewBox="0 0 1120 440">
      <defs>
        <linearGradient id="omniGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#c084fc" />
        </linearGradient>
      </defs>

      <line x1="80" y1="40" x2="80" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <line x1="280" y1="40" x2="280" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <line x1="480" y1="40" x2="480" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <line x1="680" y1="40" x2="680" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <line x1="880" y1="40" x2="880" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
      <line x1="1040" y1="40" x2="1040" y2="400" stroke="rgba(255,255,255,0.05)" stroke-width="1" />

      <line x1="100" y1="340" x2="1020" y2="100" stroke="#f87171" stroke-width="2.5" stroke-dasharray="6,6" opacity="0.7" />

      <path d="M 100 340 C 280 410, 480 320, 680 180 C 820 80, 980 60, 1030 92 C 1040 98, 1035 102, 1020 100" fill="none" stroke="url(#omniGrad)" stroke-width="4.5" stroke-linecap="round" />

      <circle cx="100" cy="340" r="8" fill="#38bdf8" />
      <text x="70" y="375" fill="#94a3b8" font-size="12" font-family="monospace">P0 (Start: 100, 340)</text>

      <circle cx="1020" cy="100" r="8" fill="#c084fc" />
      <text x="960" y="70" fill="#94a3b8" font-size="12" font-family="monospace">P3 (Target Centroid: 1020, 100)</text>

      <circle cx="1035" cy="95" r="4" fill="none" stroke="#fde047" stroke-width="1.5" />
      <text x="990" y="140" fill="#fde047" font-size="11" font-family="monospace">Ballistic Overshoot & Settle</text>
    </svg>
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-line" style="background:#f87171"></div>
      <span style="color:#94a3b8">Standard Bot Teleportation (Instantly Blocked by Anti-Bot Filters)</span>
    </div>
    <div class="legend-item">
      <div class="legend-line" style="background:#38bdf8"></div>
      <span style="color:#e2e8f0;font-weight:600">OmniTouch Human Minimum-Jerk Bezier with Biological Tremors (Undetected)</span>
    </div>
  </div>
</body>
</html>
"""

with sync_playwright() as p:
  browser = p.chromium.launch()
  
  page = browser.new_page(viewport={"width": 1200, "height": 680})
  page.set_content(html_architecture)
  page.screenshot(path=str(assets_dir / "architecture-diagram.png"))

  page.set_content(html_som)
  page.screenshot(path=str(assets_dir / "som-vision.png"))

  page.set_content(html_kinematics)
  page.screenshot(path=str(assets_dir / "kinematics-curves.png"))

  popup_path = (root_dir / "src/extension/popup/popup.html").resolve()
  page.goto(popup_path.as_uri())
  page.wait_for_selector(".container")
  page.locator(".container").screenshot(path=str(assets_dir / "popup-ui.png"))

  browser.close()

print("Generated visual assets successfully in assets/")
