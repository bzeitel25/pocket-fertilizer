#!/usr/bin/env node
/* Copy the built web app into mobile/www so Capacitor can bundle it.
 *
 * The store builds ship the app *inside* the binary — nothing is fetched from
 * bzeitel25.github.io at runtime. That is deliberate:
 *   - the app works with no signal, which is the whole point of it;
 *   - Apple rejects apps that are just a web view pointed at a website
 *     (guideline 4.2), and accepts ones that ship their content.
 *
 * Two edits are applied to the copy, and only to the copy:
 *   1. the service worker registration is stripped — the native web view has
 *      its own asset store and a second cache layer only causes stale builds;
 *   2. a <meta name="pf-native"> marker is added so the app knows at boot that
 *      it is running inside the store build.
 *
 * Usage: node scripts/sync-www.mjs        (or: npm run sync-www)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const repo = path.resolve(mobile, "..");
const www = path.join(mobile, "www");

const COPY = [
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
  "sql/sql-wasm.js",
  "sql/sql-wasm.wasm"
];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "sql"), { recursive: true });

let copied = 0;
for (const rel of COPY) {
  const from = path.join(repo, rel);
  if (!fs.existsSync(from)) {
    console.error(`Missing: ${rel} — run "node build.mjs" in the project root first.`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(www, rel));
  copied++;
}

/* --- edit the copy --- */
const indexPath = path.join(www, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const swBlock = /if\("serviceWorker" in navigator[\s\S]*?\n\}\n/;
if (swBlock.test(html)) {
  html = html.replace(swBlock, "/* service worker removed for the native build */\n");
} else {
  console.warn("! Service worker registration not found — check sync-www.mjs against build.mjs.");
}

if (html.indexOf('name="pf-native"') < 0) {
  html = html.replace("<head>", '<head>\n<meta name="pf-native" content="1">');
}

fs.writeFileSync(indexPath, html);

const build = (html.match(/const BUILD = "([^"]+)"/) || [])[1] || "unknown";
console.log(`Synced ${copied} files into mobile/www — BUILD ${build}, ${(html.length / 1024).toFixed(0)} KB`);
