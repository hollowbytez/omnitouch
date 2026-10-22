import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const chromeDir = join(distDir, "chrome");
const firefoxDir = join(distDir, "firefox");

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(join(chromeDir, "popup"), { recursive: true });
mkdirSync(join(chromeDir, "icons"), { recursive: true });
mkdirSync(join(firefoxDir, "popup"), { recursive: true });
mkdirSync(join(firefoxDir, "icons"), { recursive: true });

async function bundleTarget(targetDir, isFirefox = false) {
  const contentBuild = await Bun.build({
    entrypoints: [join(rootDir, "src/extension/content/index.ts")],
    outdir: targetDir,
    naming: "content.js",
    target: "browser",
    minify: false
  });
  if (!contentBuild.success) {
    console.error("Content build failed:", contentBuild.logs);
    process.exit(1);
  }

  const bgBuild = await Bun.build({
    entrypoints: [join(rootDir, "src/extension/background/service_worker.ts")],
    outdir: targetDir,
    naming: "service_worker.js",
    target: "browser",
    minify: false
  });
  if (!bgBuild.success) {
    console.error("Background build failed:", bgBuild.logs);
    process.exit(1);
  }

  const popupBuild = await Bun.build({
    entrypoints: [join(rootDir, "src/extension/popup/popup.ts")],
    outdir: join(targetDir, "popup"),
    naming: "popup.js",
    target: "browser",
    minify: false
  });
  if (!popupBuild.success) {
    console.error("Popup build failed:", popupBuild.logs);
    process.exit(1);
  }

  cpSync(join(rootDir, "src/extension/popup/popup.html"), join(targetDir, "popup/popup.html"));
  cpSync(join(rootDir, "src/extension/popup/popup.css"), join(targetDir, "popup/popup.css"));

  const manifestSrc = isFirefox
    ? join(rootDir, "src/extension/manifest.firefox.json")
    : join(rootDir, "src/extension/manifest.chrome.json");
  cpSync(manifestSrc, join(targetDir, "manifest.json"));

  generateIcon(join(targetDir, "icons/icon16.png"), 16);
  generateIcon(join(targetDir, "icons/icon48.png"), 48);
  generateIcon(join(targetDir, "icons/icon128.png"), 128);
}

function generateIcon(outPath, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#38bdf8" stroke-width="8"/>
    <circle cx="50" cy="50" r="14" fill="#38bdf8"/>
  </svg>`;
  writeFileSync(outPath.replace(".png", ".svg"), svg);
  writeFileSync(outPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
}

async function main() {
  process.stdout.write("Building OmniTouch for Chromium...\n");
  await bundleTarget(chromeDir, false);

  process.stdout.write("Building OmniTouch for Firefox...\n");
  await bundleTarget(firefoxDir, true);

  mkdirSync(join(rootDir, "bin"), { recursive: true });
  writeFileSync(
    join(rootDir, "bin/omnitouch.js"),
    `#!/usr/bin/env bun\nimport "../src/bridge/cli.ts";\n`
  );

  process.stdout.write("Build completed successfully.\n");
  process.stdout.write(`- Chrome package: ${chromeDir}\n`);
  process.stdout.write(`- Firefox package: ${firefoxDir}\n`);
}

main();
