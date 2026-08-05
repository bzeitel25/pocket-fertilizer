#!/usr/bin/env node
/* Store screenshots, rendered from the real app.
 *
 *   cd mobile
 *   npm install
 *   npx playwright install chromium
 *   node scripts/screenshots.mjs
 *
 * Writes exactly-sized PNGs into store/screenshots/<device>/. Both stores
 * reject off-by-one dimensions, so each device is rendered at a CSS viewport
 * multiplied by a device pixel ratio that lands on the required size rather
 * than resampled afterwards.
 *
 * The garden shown is the app's own demo data — the same one behind
 * Library → "Load the demo garden". That matters: store screenshots have to
 * show the actual app, and reviewers on both stores do compare. Nothing here
 * is a mockup.
 *
 * No network is used. Weather panels will show their offline state, which is
 * why the weather screen is not in the shot list.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const repo = path.resolve(mobile, "..");
const out = path.join(repo, "store", "screenshots");

/* ---------------------------------------------------------------- devices */
/* width x height are CSS pixels; dsf multiplies them into the final PNG. */
const DEVICES = [
  { dir: "ios-iphone-6.9",  w: 440,  h: 956,  dsf: 3, note: "1320x2868 — the only iPhone size App Store Connect asks for" },
  { dir: "ios-ipad-13",     w: 1032, h: 1376, dsf: 2, note: "2064x2752 — required only if the app is submitted for iPad" },
  { dir: "play-phone",      w: 360,  h: 640,  dsf: 3, note: "1080x1920" },
  { dir: "play-tablet-7",   w: 600,  h: 960,  dsf: 2, note: "1200x1920" },
  { dir: "play-tablet-10",  w: 800,  h: 1280, dsf: 2, note: "1600x2560" }
];

/* ------------------------------------------------------------------ shots */
/* Ordered the way the listing reads: what it is, then what it does. */
const SHOTS = [
  { file: "1-home",     tab: "home" },
  { file: "2-garden",   tab: "garden", after: async page => {
      /* open the first bed so the grid is on screen, not the bed list */
      await page.evaluate(() => {
        const b = DB.all("beds")[0];
        if (b) Garden.open(b.id);
      });
    } },
  { file: "3-calendar", tab: "calendar" },
  { file: "4-seeds",    tab: "seeds" },
  { file: "5-doctor",   tab: "doctor" },
  { file: "6-recap",    tab: "recap" }
];

/* ----------------------------------------------------------------- server */
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json"
};

function serve(root) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/") rel = "/index.html";
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ------------------------------------------------------------------- seed */
async function seedGarden(page) {
  /* Skip the first-run walkthrough, then run the app's own demo seeder.
     Library.demo() puts up a confirmation sheet; the button in it is the
     one that actually writes the rows. */
  await page.evaluate(() => {
    DB.set("onboarded", true);
    DB.set("zip", "48103");
    DB.set("zone", "6b");
    DB.set("lastFrost", "04-25");
    DB.set("firstFrost", "10-17");
    DB.set("locLabel", "Ann Arbor, MI");
    DB.set("frostSrc", "ten-year median, Open-Meteo archive");
  });
  await page.evaluate(() => Library.demo());
  await page.locator("#sheet .btn").first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => { closeSheet(); Cal.rebuild(); });
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------- main */
const { server, port } = await serve(repo);
const base = `http://127.0.0.1:${port}/index.html`;
const browser = await chromium.launch();
let written = 0;

for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dsf,
    isMobile: d.w < 700,
    hasTouch: true,
    colorScheme: "light"
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => typeof DB === "object" && DB.loaded, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await seedGarden(page);

  const dir = path.join(out, d.dir);
  fs.mkdirSync(dir, { recursive: true });

  for (const s of SHOTS) {
    await page.evaluate(t => go(t), s.tab);
    await page.waitForTimeout(500);
    if (s.after) await s.after(page);
    await page.waitForTimeout(500);
    /* JPEG on purpose. Both stores reject an alpha channel, and a Chromium
       PNG screenshot carries one even when the page underneath is opaque —
       which is the single most common "invalid screenshot" rejection. */
    const file = path.join(dir, s.file + ".jpg");
    await page.screenshot({ path: file, type: "jpeg", quality: 95 });  // viewport only
    written++;
  }

  fs.writeFileSync(path.join(dir, "SIZE.txt"),
    `${d.w * d.dsf} x ${d.h * d.dsf}\n${d.note}\n`);
  await ctx.close();
  console.log(`${d.dir}  ${d.w * d.dsf}x${d.h * d.dsf}  ${SHOTS.length} shots`);
}

await browser.close();
server.close();
console.log(`\n${written} screenshots written to store/screenshots/`);
console.log("Upload the ios-* folders to App Store Connect and the play-* folders to Play Console.");
