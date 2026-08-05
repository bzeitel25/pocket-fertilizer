#!/usr/bin/env node
/* ============================================================
   ONE COMMAND BEFORE YOU PUSH

       node deploy.mjs

   Everything that has gone wrong on this project has gone wrong in
   the gap between "it works on my machine" and "it is live":

     · a rebuild from a rolled-back src/ overwrote a day's work
     · a BUILD stamp collided, so the in-app updater never fired
     · two sessions pushed past each other and forked
     · commits sat local for two days while the phone said "up to date"

   Each of those is checked here, in order, and the run stops at the
   first one that fails. Nothing is pushed automatically — the last
   thing it does is tell you exactly what to run.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "docs");
const sh = (cmd, opts) => execSync(cmd, { cwd: root, encoding: "utf8", stdio: "pipe", ...opts }).trim();
const norm = s => s.replace(/\r\n/g, "\n");

let step = 0;
const say = m => console.log("  " + m);
const head = m => console.log("\n" + (++step) + ". " + m);
const die = (m, detail) => {
  console.error("\n   STOPPED — " + m);
  if (detail) console.error("\n" + String(detail).split("\n").map(l => "   " + l).join("\n"));
  console.error("");
  process.exit(1);
};

console.log("\nPocket Fertilizer — pre-flight");

/* ---- 1. has origin moved under us? ---------------------------------- */
head("Checking whether GitHub has moved");
try {
  sh("git fetch origin --quiet");
  const behind = Number(sh("git rev-list --count HEAD..origin/main"));
  const ahead  = Number(sh("git rev-list --count origin/main..HEAD"));
  if (behind > 0) die(
    behind + " commit(s) on origin/main that you do not have.\n" +
    "Someone (or another session) pushed while you were working.\n" +
    "Do NOT force. Look at what landed first:\n\n" +
    "   git log --oneline HEAD..origin/main");
  say(ahead ? ahead + " commit(s) ready to push, nothing to pull." : "Nothing to push — already in step with origin.");
} catch (e) {
  say("Could not reach GitHub (offline?). Continuing, but you are flying blind on divergence.");
}

/* ---- 2. rebuild, with the guard armed -------------------------------- */
head("Rebuilding from src/");
const before = fs.existsSync(path.join(dist, "index.html"))
  ? norm(fs.readFileSync(path.join(dist, "index.html"), "utf8")) : null;
try {
  const out = execSync("node build.mjs", { cwd: root, encoding: "utf8" });
  say(out.trim().split("\n").pop());
} catch (e) {
  die("the build refused to run. Read its message above — it means src/\n" +
      "is not in the state you think it is, and docs/ has been left alone.",
      (e.stdout || "") + (e.stderr || ""));
}

/* ---- 3. does src/ actually reproduce what ships? --------------------- */
head("Confirming src/ reproduces the shipped file");
const after = norm(fs.readFileSync(path.join(dist, "index.html"), "utf8"));
if (before !== null && before !== after) {
  say("index.html changed in this build — expected if you edited src/.");
  say("If you did NOT edit src/, stop: something rolled it back.");
} else {
  say("Byte-identical. src/ is authoritative.");
}

/* ---- 4. is the BUILD stamp new? -------------------------------------- */
head("Checking the BUILD stamp");
const stamp = (after.match(/const BUILD = "([^"]+)"/) || [])[1];
if (!stamp) die("no BUILD constant found in the built file.");
let live = null;
try {
  live = (sh("git show origin/main:index.html").match(/const BUILD = "([^"]+)"/) || [])[1];
} catch (e) { /* origin unreachable or first push */ }
if (live && live === stamp) die(
  'BUILD is still "' + stamp + '", which is what is already live.\n' +
  "The in-app updater compares this string. If it does not change, the app\n" +
  'tells the gardener she is up to date and never refreshes.\n\n' +
  "Bump `const BUILD` in src/p16_sources_ui.js and run this again.");
say('BUILD "' + stamp + '"' + (live ? ' — live is "' + live + '", so the updater will fire.' : " (no live build to compare)."));

/* ---- 5. the suites --------------------------------------------------- */
head("Running the test suites");
for (const [cmd, label] of [["node src/smoke.mjs docs/index.html", "smoke"],
                            ["node verify_camera.mjs docs/index.html", "camera"]]) {
  let out;
  try { out = execSync(cmd, { cwd: root, encoding: "utf8" }); }
  catch (e) { out = (e.stdout || "") + (e.stderr || ""); }
  const line = (out.match(/---\s*(\d+) passed, (\d+) failed\s*---/) || []);
  if (!line.length) die(label + " suite did not finish.", out.split("\n").slice(-15).join("\n"));
  if (Number(line[2]) > 0) die(line[2] + " " + label + " check(s) failing.",
    out.split("\n").filter(l => /^(FAIL|ERROR)/.test(l)).slice(0, 12).join("\n"));
  say(label + ": " + line[1] + " passed");
}

/* ---- 6. is anything uncommitted? ------------------------------------- */
head("Checking the working tree");
const dirty = sh("git status --porcelain").split("\n").filter(Boolean);
if (dirty.length) {
  say(dirty.length + " uncommitted file(s):");
  dirty.slice(0, 8).forEach(l => say("   " + l));
  console.log("\n   Commit them, then push:\n");
  console.log('     cd "' + root + '"');
  console.log("     git add -A");
  console.log('     git commit -m "..."');
  console.log("     git push origin main\n");
  process.exit(0);
}

/* ---- done ------------------------------------------------------------ */
const ahead = Number(sh("git rev-list --count origin/main..HEAD"));
console.log("\n   All clear. " + ahead + " commit(s) to push:\n");
try {
  sh("git log --oneline origin/main..HEAD").split("\n").forEach(l => console.log("     " + l));
} catch (e) {}
console.log("\n   Run:\n");
console.log('     cd "' + root + '"');
console.log("     git push origin main\n");
console.log("   Then, about a minute later, confirm it is really live:\n");
console.log('     curl -s "https://bzeitel25.github.io/pocket-fertilizer/index.html?t=$(date +%s)" | grep -o \'const BUILD = "[^"]*"\'\n');
console.log('   It must print ' + stamp + '. Only then will the phone\'s Update button find it.\n');
