#!/usr/bin/env node
/* Assemble dist/index.html from the parts in src/, in the order given by
   src/ORDER.txt, then apply the two post-processing steps the app needs:
   the PWA head tags and the service-worker registration.

   Usage:  node build.mjs
   Then:   node src/smoke.mjs dist/index.html
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "src");
/* The built app lives in docs/ because GitHub Pages can serve a repo
   subfolder, which lets src/ live in the same repo and be version
   controlled. Before this, only the build output was tracked. */
const dist = path.join(root, "docs");

const order = fs.readFileSync(path.join(src, "ORDER.txt"), "utf8")
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

const missing = order.filter(f => !fs.existsSync(path.join(src, f)));
if (missing.length) { console.error("Missing parts:", missing.join(", ")); process.exit(1); }

/* A part that opens with an HTML comment is a tombstone: a file kept only
   because it cannot be deleted from the sandbox. Everything else missing
   from ORDER.txt is a mistake worth shouting about. */
const onDisk = fs.readdirSync(src).filter(f => /^p\d/.test(f));
const orphans = onDisk.filter(f => order.indexOf(f) < 0 &&
  !fs.readFileSync(path.join(src, f), "utf8").trimStart().startsWith("<!--"));
if (orphans.length) console.warn("! Not in ORDER.txt, will NOT be built:", orphans.join(", "));

let html = order.map(f => fs.readFileSync(path.join(src, f), "utf8")).join("\n");

/* 1. PWA head tags, inserted before the inline favicon link */
const iconTag = '<link rel="icon" href="data:image/svg+xml,';
const iconAt = html.indexOf(iconTag);
if (iconAt < 0) { console.error("Could not find the inline <link rel=\"icon\"> anchor."); process.exit(1); }
if (html.indexOf('rel="manifest"') < 0) {
  html = html.slice(0, iconAt) +
    '<meta name="description" content="Garden planner, seed bank, grow calendar, plant doctor and a voice assistant. Offline first, encrypted on device.">\n' +
    '<link rel="manifest" href="manifest.webmanifest">\n' +
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n' +
    '<meta name="apple-mobile-web-app-title" content="Pocket Fert">\n' +
    html.slice(iconAt);
}

/* 2. service worker registration, immediately before the boot() call */
const bootAnchor = 'if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);';
if (html.indexOf('serviceWorker.register') < 0) {
  if (html.indexOf(bootAnchor) < 0) { console.error("Could not find the boot() anchor."); process.exit(1); }
  html = html.replace(bootAnchor,
    'if("serviceWorker" in navigator && location.protocol.indexOf("http") === 0){\n' +
    '  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });\n' +
    '}\n\n' + bootAnchor);
}

/* ============================================================
   THE GUARD

   The way work has actually been lost on this project is not a bad
   merge — it is a rebuild. OneDrive rolls src/ back to an older
   state, build.mjs runs happily against it, and dist/index.html,
   the only surviving copy of a day's work, is overwritten with an
   older app. Nothing errors. Nothing looks wrong until you open it.

   So the build refuses to write an index.html that has lost a major
   part of the app. If a marker below is missing, src/ is not what
   you think it is — stop and look before forcing it.
   ============================================================ */
const REQUIRED = [
  ["const Geom",       "the bed-geometry core"],
  ["const Canvas",     "the planting canvas"],
  ["const PlantArt",   "plant icons and growth"],
  ["const CanvasDrag", "drag, resize and live companion feedback"],
  ["const Shape",      "bed shapes and the polygon tracer"],
  ["const Micro",      "micro-climate"],
  ["const Solar",      "the solar-geometry maths"],
  ["const Habit",      "sourced mature spread and height"],
  ["const UserCrops",  "crops the gardener adds herself"],
  ["GARDEN_PLANTS",    "the flower, tea and beneficial-insect crops"],
  ["const Gmap",       "the garden map"],
  ["const Coach",      "the coach banner"],
  ["const TIPS",       "the rotating tips"],
  ["const GUIDE",      "the in-app guide"],
  ["const Notify",     "daily reminders"],
  ["const Vision",     "the shared camera/AI path"],
  ["const Native",     "the store-build behaviour"],
  ["const Zoom",       "pinch zoom and pan on the bed"],
  ["const Undo",       "undo on the bed"],
  ["const Sel",        "multi-select"],
  ["const BedRecs",    "what would go well in this bed"],
  ["const WaterGroups","watering grouped by need"],
  ["const Orient",     "which way a bed faces"],
  ["const Templates",  "saved bed layouts"],
  ["const CalSync",    "calendar export"],
  ["const Share",      "moving a garden between devices"],
  ["const Units",      "inches or centimetres"],
  ["Units.chip",       "the units switch in the plot strip"],
  ["const Trays",      "seed trays"],
  ["const TrayUI",     "the tray screen"],
  ["const Groups",     "pots, planters and window boxes"]
];
const lost = REQUIRED.filter(([marker]) => html.indexOf(marker) < 0);
if (lost.length && process.argv.indexOf("--force") < 0) {
  console.error("\nREFUSING TO WRITE docs/index.html — the build is missing:\n");
  lost.forEach(([m, what]) => console.error("   " + m.padEnd(16) + " " + what));
  console.error("\nsrc/ is not in the state you think it is. Most likely a OneDrive");
  console.error("rollback. Check `git status` and `ls src/` before doing anything;");
  console.error("docs/index.html has NOT been touched, so the shipped app is still intact.");
  console.error("Re-run with --force only if you genuinely meant to remove these.\n");
  process.exit(1);
}

fs.writeFileSync(path.join(dist, "index.html"), html);
fs.copyFileSync(path.join(root, "README.md"), path.join(dist, "README.md"));

/* GitHub Pages runs Jekyll over docs/ unless this file exists, and there is
   nothing here for Jekyll to do — the app is one static HTML file. All it can
   do is fail: docs/ also holds the whole Capacitor project, an .aab toolchain,
   two .wasm blobs and a gradle wrapper .jar, none of which is a website. A
   failed Pages build does not roll back, it simply keeps serving the last good
   deploy, so the site silently pins to an old BUILD and the phone is told it
   is up to date forever. Recreated on every build so it cannot go missing. */
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
fs.copyFileSync(path.join(root, "CLAUDE.md"), path.join(dist, "CLAUDE.md"));

const build = (html.match(/const BUILD = "([^"]+)"/) || [])[1];
console.log(`Built docs/index.html — ${order.length} parts, ${(html.length / 1024).toFixed(0)} KB, BUILD ${build}`);
