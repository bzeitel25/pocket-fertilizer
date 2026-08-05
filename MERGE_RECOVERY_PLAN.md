# Pocket Fertilizer — divergence report & recovery plan

**Written:** 2026-08-04
**Author:** Claude Code session (desktop, Windows, working dir `C:\Users\bzeit\OneDrive\Desktop\Pocket Fertilizer`)
**Audience:** the Cowork Opus agent that will actually perform the merge
**Status of this session:** diagnosis only. **Nothing was pushed. The merge was aborted. The working tree is clean.**

---

## 0. TL;DR

`origin/main` and the local `dist/` repo have **genuinely diverged** into two incompatible
lines of development that both edited the same regions of `index.html`:

| | commits | planting model | BUILD stamp | pushed? |
|---|---|---|---|---|
| **origin/main** (live) | 7 | **old grid** | `2026-08-02.14` | yes — this is what the app serves |
| **local `dist/` HEAD** | 6 | **new canvas** | `2026-08-04.4` | no — stranded locally |

The in-app Update button is "stuck on 8-02.14" because **8-02.14 genuinely is the live
build**. The newer work never reached GitHub.

Merge base is `5951411`. A test merge produced **10 conflict blocks in `index.html`**
(several 500–1600 lines) plus 2 in `CLAUDE.md`.

**Decision already made by Bruno: canvas wins the planting model; everything non-grid from
the origin line must be preserved.**

Two further problems, independent of the merge, are documented in §5 — **the `src/` tree
appears to be out of sync with `dist/index.html`**, and **the ZIP-enrichment fix is absent
from both lines**. Read §5 before doing anything; the `src/` issue can silently destroy the
canvas work.

---

## 1. Exact git state as of this report

```
merge base .................. 5951411  (Add CLAUDE.md — last commit common to both)
origin/main ................. 7f7db85  (7 commits ahead of base)  <-- LIVE on Pages
local dist/ HEAD ............ fbe6bce  (6 commits ahead of base)  <-- NOT pushed
working tree ................ clean, merge aborted, no stale lock files
```

`dist/` is the git repo (repo root == `dist/`, flat layout, Pages deploys from root).
The parent folder `Pocket Fertilizer/` is **not** a git repo — see §5.2.

### 1.1 The 6 local commits (canvas line, `5951411..fbe6bce`)

```
46e2211  Seed packets now read themselves from a photo; camera always uses the rear lens
a6c9fad  Dragging a planting no longer needs a motionless hold
53816b1  The assistant no longer leaves the bed frozen after planting
ddb6dd7  Publishable builds for Google Play and the App Store
63ad2d0  Replace the grid with an organic planting canvas        <-- the architectural break
fbe6bce  Flowers, tea and beneficial-insect plants, and crops the gardener adds herself
```

Files touched: `index.html`, `CLAUDE.md`, `README.md`, plus a large body of **files that
exist only on this side and therefore cannot conflict**:
`mobile/**` (full Capacitor Android + iOS project), `store/**`, `.github/workflows/*.yml`,
`sql/sql-wasm.js`, `sql/sql-wasm.wasm`, `privacy.html`, `support.html`.

### 1.2 The 7 origin commits (grid line, `5951411..7f7db85`)

```
60ac6bb  Future-dated sowing windows, duplicate-safe assistant, plain-language settings
704273e  Place names, 100 rotating tips, daily reminders, coach banner, in-app user guide
4165a7c  Garden map with drag-arrange and landmarks, draggable plants with swapping, companion hearts
5834c47  Press-and-hold to drag plants with nearest-spot drop; duplicate and copy-to-place
e777ef6  Fix drag: tile follows the finger, ghost positions correctly, scroll no longer cancels the lift
0bd006c  Seed packets read themselves from a photo; camera always uses the rear lens (build 2026-08-02.13)
7f7db85  Build 2026-08-02.14 — bump past the colliding .13 stamp so the in-app updater fires
```

Files touched: **only `index.html` and `CLAUDE.md`.**

---

## 2. Where the clash came from (so it doesn't happen again)

Two Cowork sandbox sessions were both checked out at `5951411` and ran in parallel for an
extended period, each unaware of the other. Neither fetched or rebased before pushing.
Both independently rebuilt **the same three things** — the seed-packet camera reader, the
rear-lens fix, and press-and-hold plant dragging — but:

- one session **replaced the planting model** (grid → continuous canvas with root/canopy radii);
- the other **kept building on the grid** (landmarks, swapping, companion hearts, nearest-spot drop)
  and added unrelated features (sowing windows, tips, reminders, coach banner, guide, settings).

Git cannot know those two rewrites of the same functions were meant to be alternatives, so
it correctly refuses to auto-merge them. Contributing factors:

1. **No branch isolation** — both sessions had push access to `main`.
2. **One session pushed via the GitHub web UI** (sandbox has no push credentials), so its
   commits landed with SHAs the other session's local repo had never seen.
3. **`src/` is unversioned** (§5.2), so "rebuild from source" silently overwrote work.
4. Earlier in the day the same pattern produced two *byte-identical* pushes that looked
   harmless — which masked the fact that a real fork was forming.

**Guardrails to adopt (see §8).**

---

## 3. Conflict map — all 10 blocks in `index.html`

Line numbers are from the aborted test merge (they will differ slightly on a fresh merge;
identify blocks by content, not by number). "ours" = local canvas HEAD, "theirs" = origin/main.

| # | ours / theirs (lines) | What is in it | Resolution |
|---|---|---|---|
| 1 | 21 / 3 | `Geom.` geometry constants | **ours** (canvas) |
| 2 | 265 / **0** | assistant additions, ours-only | **ours** (pure addition) |
| 3 | **988 / 288** | ours: canvas + `PlantArt` + `Geom` + sowing; theirs: grid `planMove`/`nearestDrop`/`liftStart`/`pasteAt`/`freeSpot`/`duplicate`/`tapCell` | **ours**, but see §3.1 |
| 4 | **1544 / 62** | ours: canvas UI, `Habit`, guide; theirs: `bindGrid`, `gridHTML` cell-tagging, `wrapBedView`, sheet buttons | **ours**, see §3.1 |
| 5 | 1318 / 9 | ours: `Habit`, `Guide`, `Vision`, `Cam.rear`; theirs: `duplicate` stub | **ours** |
| 6 | 279 / **0** | `usercrops`, sowing | **ours** (pure addition) |
| 7 | 211 / **0** | `Garden.` | **ours** (pure addition) |
| 8 | 281 / **0** | assistant, guide, `Garden.` | **ours** (pure addition) |
| 9 | **1 / 1** | **almost certainly the `const BUILD` line** | **neither — set a fresh stamp**, see §6 |
| 10 | 304 / **0** | ours-only | **ours** (pure addition) |

**Five of ten blocks (2, 6, 7, 8, 10) have zero content on the origin side** — they are pure
local additions and carry no risk.

Only blocks **3, 4, 5** contain meaningful origin code, and I read blocks 3 and 4 in full:
both are **grid-coordinate drag/swap/paste plumbing** (`Garden.hits`, `inBounds`, `planMove`,
`nearestDrop`, `applyMove`, `liftStart` with `cs`/`gap`/`step` cell maths, `copyPlanting`,
`pasteAt`, `freeSpot`, `duplicate`, `tapCell`, `bindGrid`, `gridHTML` regex cell-tagging).
All of it is written in cell coordinates and is architecturally superseded by
`p8n_canvasdrag.js`. Taking "ours" there is correct **provided §3.1 is honoured**.

### 3.1 Behaviours in the grid drag code that must survive in the canvas world

Do not just delete these — confirm each has a canvas equivalent, and port it if not.
These are real, hard-won UX behaviours with comments in the origin code explaining why:

- **Swap on drop** — dropping a planting onto another makes them trade places when both fit
  (`planMove` → `swap`), with specific refusal messages ("too big to fit where X was",
  "No room to swap — Y is in the way", "only one can swap at a time").
- **Nearest-spot fallback** — `nearestDrop` searches outward in rings up to radius 3,
  preferring open ground over a swap, and snaps back with "Nothing nearby had room".
- **Drop-far-outside = put it back** — dragging >70px beyond the bed rect cancels the move.
- **Three phone-specific drag fixes** (documented in origin's own comments, and the subject
  of commit `e777ef6`): the lifted tile must **not** be `pointer-events:none`; scrolling must
  be stopped with `preventDefault` on `touchmove` (not by changing `touch-action` mid-gesture);
  the drop ghost is absolutely positioned so its container needs `position:relative`.
  `pointercancel` is deliberately **not** treated as an abort.
- **Movement before the hold completes = scroll, not drag** (>10px cancels the lift; 200ms timer).
  NB: local commit `a6c9fad` ("Dragging no longer needs a motionless hold") may already
  supersede this — reconcile the two deliberately rather than assuming.
- **Copy / paste-to-place** (`Garden.clip`, "tap any empty square" banner, Done button) and
  **one-tap duplicate** from the planting sheet, with the "Duplicated to row R, column C" toast.
- **Landmarks / garden map drag-arrange / companion hearts** (commit `4165a7c`) — I did **not**
  audit these; they may live partly outside the conflict blocks. Verify explicitly.

---

## 4. Features from the origin line that must not be lost

From commits `60ac6bb` and `704273e`:

- Future-dated sowing windows
- Duplicate-safe assistant
- Plain-language settings
- **Place names** (city/state on the location card) — overlaps the ZIP work, see §5.1
- 100 rotating tips
- Daily reminders
- Coach banner
- In-app user guide

**Verification caveat — read this.** During the aborted merge I grepped the *conflicted*
working file and saw: `coach` 23, `daily reminder` 3, `sowing window` 5, `plain-language` 1,
`future-dated` 1, `user guide` 1, `rotating tip` 0, `duplicate-safe` 0. That grep ran against
a file containing **both** sides simultaneously, so **it does not prove these survive
resolution.** The keyword scan of the conflict blocks did suggest these features sit *outside*
the conflicted regions (they showed up as neither ours-only nor theirs-only), which is
consistent with them auto-merging cleanly — but **this must be re-verified on the final
merged file**, not assumed. `rotating tip` / `duplicate-safe` scoring 0 most likely just means
those phrases are commit-message wording rather than literal strings in code; find the real
identifiers before concluding anything.

---

## 5. Two problems that are **not** the merge — check these first

### 5.1 The ZIP → city/state enrichment is missing from **both** lines

I verified directly: `byZip()` is **byte-identical in local HEAD and in `origin/main`**, and
neither contains `placeForZip` or `zippopotam`. Both still return the bare label `"ZIP " + z`.
So Bruno's enrichment fix is **absent everywhere** and must be re-applied fresh.

**But first check whether origin's "Place names" commit (`704273e`) already solves this
another way** — if it does so functionally (city/state on the location card), keep origin's
version and do **not** bolt this on top. Bruno's instruction: honour whichever is already
there; only add this if the need is unmet.

If it must be re-applied, the intended change (Bruno's own text) is:

**`src/p6_live.js`** — replace the existing `async function byZip(zip){…}` (right after the
`/* ---- location ---- */` comment) with:

```js
async function placeForZip(z){
  // Free CORS-enabled ZIP→place lookup. Returns null on any failure so
  // callers can fall back to a plain "ZIP nnnnn" label.
  try{
    const p = await jget("https://api.zippopotam.us/us/" + z);
    const place = p && p.places && p.places[0];
    if(!place) return null;
    const name = place["place name"];
    const stAbbr = place["state abbreviation"];
    if(!name) return null;
    return stAbbr ? (name + ", " + stAbbr) : name;
  }catch(e){ return null; }
}
async function byZip(zip){
  const z = String(zip).trim();
  if(/^\d{5}$/.test(z)){
    try{
      const d = await jget("https://phzmapi.org/" + z + ".json");
      const place = await placeForZip(z);
      const label = place ? (place + " · ZIP " + z) : ("ZIP " + z);
      return { zip: z, zone: d.zone, lat: parseFloat(d.coordinates.lat), lon: parseFloat(d.coordinates.lon),
               label: label, place: place || null, tempRange: d.temperature_range, src: "phzmapi" };
    }catch(e){ /* fall through to place search */ }
  }
  const g = await jget("https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=en&name=" + encodeURIComponent(z));
  if(!g.results || !g.results.length) throw new Error("Couldn't find that place");
  const r = g.results[0];
  return { zip: null, zone: null, lat: r.latitude, lon: r.longitude,
           label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "), src: "open-meteo" };
}
```

`placeForZip` must be **exported on `Live`** (the migration below calls `Live.placeForZip`).

**`src/p13_init.js`** — immediately after `Updater.init(); go("home");` in `boot2()`:

```js
/* One-time migration for existing users: the old label was just "ZIP nnnnn".
   Enrich it with the real city/state now so the hero card shows "Morrisville, NC"
   instead of a raw ZIP. */
(async () => {
  const cur = DB.get("locLabel");
  const z = DB.get("zip");
  if(cur && z && /^ZIP\s*\d{5}$/i.test(String(cur))){
    try{
      const place = await Live.placeForZip(String(z).trim());
      if(place){
        DB.set("locLabel", place + " · ZIP " + z);
        if(APP.tab === "home" && typeof Home !== "undefined" && Home.render) Home.render();
      }
    }catch(e){ /* silent */ }
  }
})();
```

Expected result: `Morrisville, NC · ZIP 27560`.

### 5.2 `src/` looks out of sync with `dist/index.html` — **potential silent destroyer**

At the start of this session, `ls src/` showed **only**:

```
p1_head.html p2_body.html p3_core.js p4_db.js p5_plants.js p5b_sources.js
p6_live.js p7_shell.js p8_garden.js p9_seeds.js p10_doctor.js p10b_condsrc.js
p11_journal.js p12_library.js p13_init.js p14_weather.js p15_assistant.js
p16_sources_ui.js smoke.mjs
```

There was **no** `p8j_geom.js`, `p8k_plantart.js`, `p8l_canvas.js`, `p8m_canvasui.js`,
`p8n_canvasdrag.js`, `p8o_shapes.js`, `p8p_habit.js`, `p8g_micro.js`, `p5c_garden_plants.js`,
`p5d_usercrops.js`, `p15b_providers.js`, `p19_native.js`, and no `ORDER.txt` — **yet
`dist/index.html` contains the canvas code and `CLAUDE.md` documents all of those parts as
the build inputs.**

**Implication: running `node build.mjs` in that state would regenerate `index.html` from an
old grid-era source set and wipe the canvas rewrite.** This is very likely how Bruno's ZIP
fix "vanished" — a rebuild from a stale/rolled-back `src/` overwrote `dist/index.html`.

Aggravating factors, both already documented in `CLAUDE.md`:
- OneDrive has silently rolled edited `src/` files back mid-session before (hence
  `apply_camera_fix.mjs`, which is idempotent and exists precisely for this).
- **The parent folder is not a git repo**, so `src/` has *no version control at all*. Only
  `dist/` is tracked. Every source edit is one OneDrive hiccup away from being unrecoverable.

**Cowork must confirm the true current state of `src/` before running any build**, and must
decide deliberately whether `dist/index.html` or `src/` is authoritative. My reading: for the
canvas work, **`dist/index.html` is currently the only surviving copy** — treat it as the
source of truth and back-fill `src/` from it, not the reverse.

Caveat: that `ls` was taken early in the session; `src/` may have changed since. Verify, don't assume.

---

## 6. The BUILD stamp

- live / origin: `2026-08-02.14`
- local canvas HEAD: `2026-08-04.4`
- Conflict block #9 (1 line vs 1 line) is almost certainly this constant.

The final merged file must carry a stamp that is **new to the app's updater**, which does a
plain string comparison against the live value. `2026-08-04.5` satisfies that (today-dated,
distinct from both sides). Per `CLAUDE.md` the canonical edit is
**`const BUILD` in `src/p16_sources_ui.js`**, mirrored into `dist/index.html` by the build —
but given §5.2, make sure the value that actually ships in `dist/index.html` is the new one.

Historical note worth heeding: commit `7f7db85` exists *solely* because a `.13` stamp collided
and the updater never fired. Don't reuse a stamp.

---

## 7. Action plan for the Cowork agent

Do these in order. Stop and report if any check fails.

1. **Snapshot before touching anything.**
   `git -C dist branch backup/canvas-fbe6bce fbe6bce` and
   `git -C dist branch backup/origin-7f7db85 origin/main`. Also copy `dist/index.html` aside.
   The canvas work exists in exactly one place; treat it as irreplaceable.

2. **Resolve §5.2 first.** Establish whether `src/` can actually rebuild the canvas `index.html`.
   If it cannot, do **not** run `build.mjs`. Back-fill `src/` from `dist/index.html` (splitting
   into the `p*` parts named in `CLAUDE.md`, plus `ORDER.txt`), or accept `dist/index.html` as
   authoritative for this merge and fix `src/` as a separate follow-up. **Never let a rebuild
   run against a stale `src/`.**

3. **Merge**, resolving per the table in §3:
   `git -C dist merge origin/main` → take **ours** for blocks 1–8, 10; set a fresh BUILD for
   block 9. Resolve `CLAUDE.md` to the canvas version (it is the newer, fuller document; keep
   its `541 checks` figure only if the suite really has 541 — origin says 326).

4. **Port the §3.1 behaviours** into the canvas drag code where the canvas lacks them
   (swap-on-drop, nearest-spot fallback, drop-far-outside-puts-back, the three phone drag
   fixes, copy/paste-to-place, one-tap duplicate, landmarks/companion hearts).
   Reconcile against local commit `a6c9fad` rather than double-implementing the hold logic.

5. **Verify every §4 feature** actually survives in the merged file — by locating its real
   identifiers/handlers, not by grepping commit-message phrases.

6. **Apply §5.1** (ZIP enrichment) only if origin's place-names work doesn't already cover it.

7. **Set BUILD** to `2026-08-04.5` (§6), in `src/p16_sources_ui.js` *and* confirm it in
   `dist/index.html`.

8. **Test.** `node src/smoke.mjs dist/index.html` and `node verify_camera.mjs dist/index.html`.
   Expect breakage: the smoke suite spans both architectures and origin's grid-era checks may
   assert grid behaviour that no longer exists. Fix or retire those checks deliberately and
   say which ones — do not delete failing tests silently. Add checks covering the ported §3.1
   behaviours.

9. **Commit and push.** One merge commit, message naming both lines. `git push origin main`.
   (Sandbox has no push credentials — expect to hand back a ready-to-push repo for Bruno, or
   use the GitHub web UI fallback per `CLAUDE.md`.)

10. **Verify live**, ~1 min after the push:
    ```bash
    curl -sSL "https://bzeitel25.github.io/pocket-fertilizer/index.html?ts=$(date +%s)" | grep -oE 'const BUILD = "[^"]+"'
    ```
    Must print `2026-08-04.5`. Then confirm the in-app Update button actually fires.

11. **Update `CLAUDE.md`** with the §8 guardrails and a short note recording this divergence.

---

## 8. Guardrails so this cannot recur

1. **Never run two sessions against `main` at once.** If two must run, give each an explicit,
   disjoint scope and say so in both prompts.
2. **Feature branches, not direct-to-`main`.** Each session pushes its own branch; merges are
   a deliberate, separate act.
3. **Fetch-and-check before large work.** Any session about to do a rewrite runs
   `git fetch origin && git log HEAD..origin/main` first and **stops** if origin has moved.
4. **Put `src/` under version control** (or move the repo root up to the parent folder). It is
   currently unversioned inside OneDrive, which is how edits keep disappearing. This is the
   single highest-value fix on this list.
5. **Never run `build.mjs` without first confirming `src/` matches the shipped `dist/index.html`.**
6. **Bump BUILD once, at the end of a deploy**, never mid-session — colliding stamps have
   already cost one throwaway commit (`7f7db85`).

---

## 9. What this session did and did not do

**Did:** deleted a stray empty parent-level `.git`; initialised git in `dist/` with `origin`
set and `main` tracking; set `user.name`/`user.email` locally (`Bruno Zeitel <bzeitel@gmail.com>`
— global config was empty); cleared stale `HEAD.lock`/`index.lock`; committed and pushed
`CLAUDE.md` (`5951411`); ran a **test merge, inspected it, and aborted it**.

**Did not:** push any code from the canvas line; resolve any conflict; alter `src/`;
run any build or test.

**One correction to something I said earlier in the session:** I stated that origin's
features "already auto-merged cleanly" based on a keyword scan. That scan was suggestive but
ran against a file holding both sides at once, so it is not proof. §4 states the correct,
weaker claim — re-verify on the final merged file.

**Left behind:** `dist/` clean at `fbe6bce`, 6 ahead / 7 behind `origin/main`, no locks, no
uncommitted changes.
