const fs = require("fs");
const path = require("path");

const BROWSERS = ["chrome", "firefox", "safari"];
const DIST = path.join(__dirname, "dist");

const SHARED_FILES = [
  "content_script.js",
  "background.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "options/options.html",
  "options/options.css",
  "options/options.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png"
];

const POLYFILL_SRC = path.join(__dirname, "node_modules", "webextension-polyfill", "dist", "browser-polyfill.min.js");

function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function mergeManifests(browser) {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.base.json"), "utf-8"));
  const overridePath = path.join(__dirname, `manifest.${browser}.json`);
  const override = JSON.parse(fs.readFileSync(overridePath, "utf-8"));
  return { ...base, ...override };
}

function buildBrowser(browserName) {
  const outDir = path.join(DIST, browserName);
  mkdirp(outDir);

  // Merge and write manifest
  const manifest = mergeManifests(browserName);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // Copy shared files
  for (const file of SHARED_FILES) {
    copyFile(path.join(__dirname, file), path.join(outDir, file));
  }

  // Copy polyfill
  copyFile(POLYFILL_SRC, path.join(outDir, "vendor", "browser-polyfill.min.js"));

  console.log(`  Built: dist/${browserName}/`);
}

// --- Main ---

const target = process.argv[2]; // optional: "chrome", "firefox", "safari"

console.log("YouFilter build\n");
clean();

if (target) {
  if (!BROWSERS.includes(target)) {
    console.error(`Unknown browser: ${target}. Choose from: ${BROWSERS.join(", ")}`);
    process.exit(1);
  }
  buildBrowser(target);
} else {
  for (const b of BROWSERS) {
    buildBrowser(b);
  }
}

console.log("\nDone!");
