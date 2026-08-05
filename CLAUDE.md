# Pocket Fertilizer — working notes for future sessions

> **Read [START-HERE.md](START-HERE.md) first.** This file explains how the app is built.
> That one explains how not to break it, and lists the seven ways this project has
> actually gone wrong — a rebuild against a rolled-back source tree, two sessions
> forking `main`, a colliding BUILD stamp, commits stranded for two days, a Pages
> folder setting that made the site render the README, a stale service worker, and a
> CRLF diff that made an identical file look destroyed.

## Layout

```
C:\Dev\Pocket Fertilizer/     <- the git repo root. NOT in OneDrive.
  src/        source parts + smoke.mjs — EDIT HERE
  docs/       the built app. GitHub Pages serves from here.
    mobile/     Capacitor Android + iOS shells for the app stores
    store/      listing copy, submission runbook, store art
    .github/    CI that builds the .aab and the .ipa
  build.mjs   src/ -> docs/index.html, with the guard
  deploy.mjs  the pre-flight. Run this before every push.
  CLAUDE.md   these notes
  README.md   project documentation (copied into docs/ on build)
```

**The whole project is one repo now, and `src/` is finally in it.** Until 2026-08-04 only the
build output was tracked and the source lived in OneDrive with no version control at all,
which is how a day's work kept vanishing: OneDrive would roll `src/` back, a rebuild would
run against the stale tree, and the only surviving copy of the app got overwritten in
silence. Two changes fixed that — the repo root moved up so `src/` is committed, and the
project moved out of OneDrive entirely.

GitHub Pages serves from **`main` branch, `/docs` folder** (Settings → Pages). If the live
site ever 404s after a push, that setting is the first thing to check.

## The build

```bash
node build.mjs                       # src/ -> docs/index.html
node src/smoke.mjs docs/index.html   # 541 checks
node verify_camera.mjs docs/index.html # 26 checks on the camera -> AI -> form path
```

`build.mjs` reads the order from `src/ORDER.txt` (not from the list below — that list
is documentation and has drifted before) and applies both post-processing steps.
It warns about any `p*` file on disk that is missing from `ORDER.txt`.

`apply_camera_fix.mjs` reapplies the camera/AI work to `src/` and is idempotent.
It exists because a OneDrive sync silently rolled every edited source file back
mid-session. **If a change you just made to `src/` seems to vanish, that is why** —
re-run it rather than redoing the edits by hand.

`index.html` is assembled by concatenating the parts in `src/` **in this exact order**:

```
p1_head.html  p2_body.html  p3_core.js  p4_db.js  p5_plants.js  p5b_sources.js
p6_live.js    p7_shell.js   p8_garden.js p8b_span.js p8c_varieties.js
p9_seeds.js   p10_doctor.js p10b_condsrc.js p11_journal.js p8d_maturity.js
p12_library.js p14_weather.js p15_assistant.js p15b_providers.js
p16_sources_ui.js p13_init.js
```

Order matters. `p13_init.js` is last because it closes `</body></html>` and calls `boot()`.
The `p*b`/`p*c`/`p*d` parts patch or extend objects defined in the base part, so they must
follow it. `p8d_maturity.js` comes after `p11_journal.js` because it wraps `Journal.saveHarvest`.

After concatenating, two post-processing steps are applied to `index.html`:

1. Insert the PWA head tags (manifest, apple-touch-icon, description, app title) before the
   inline `<link rel="icon">`.
2. Insert the service worker registration immediately before the `boot()` call at the end.

**Bump `const BUILD` in `p16_sources_ui.js`** on every deploy. The in-app updater fetches the
live `index.html`, greps that constant, and compares — if it doesn't change, the app tells the
user they're already current and never refreshes.

## Camera and AI vision

Both camera features — the seed packet reader and the Plant Doctor's second opinion —
go through **`Vision`** in `p15b_providers.js`. It follows whichever provider the
assistant is connected to. Do not call a provider endpoint directly from a feature
file; that is exactly how the packet reader ended up Anthropic-only and invisible to
Gemini users. Gate UI on `Vision.ready()`, never on `DB.get("aiKey")`.

Photographing a packet reads it immediately — no button press. A manual re-read
button is offered in every state as a fallback. Values from the model are coerced
(`Seeds._num/_year/_date/_unit`) before being written, because a `number` or `date`
input silently discards anything it cannot parse, which looks exactly like the
feature being broken. Fields the app filled get `.ai-filled`; fields the gardener
typed are never overwritten.

The reading copy of a packet photo is 1500px but is **never stored** — only the
900px thumbnail goes into the vault, or the encrypted store blows past the
localStorage fallback after a dozen packets.

All camera access goes through **`Cam.rear()`** in `p3_core.js`. `facingMode:{ideal:…}`
is only a hint and some Android builds hand back the selfie camera anyway, so it tries
a device labelled "back" first, then `exact`, then `ideal`, then anything.

## The planting canvas

**The grid is gone.** A bed is an outline measured in inches (`beds.shape`, `w_in`,
`h_in`, `poly`); a planting is a point in it (`plantings.px`, `py`) carrying two radii —
`rr`, the root zone it needs to itself, and `rc`, the spread of its mature foliage.
Overlapping canopies are normal and drawn as such; overlapping *roots* are the warning.

`Geom.bed` and `Geom.plant` migrate a legacy row **on read** and are idempotent, so there
is no migration pass that can half-finish. Anything still speaking in squares —
`Garden.W/H/covers/at/blocked`, the assistant's `plant_crop` — is a *view* of the canvas,
not a second model. `Garden.place(bed,x,y,…)` still takes cell coordinates and delegates
to `Garden.placeAt(bed,inches,inches,…)`.

The parts, in build order:

- `p8j_geom.js` — shapes, containment, area, corner snapping, the radii, and the legacy
  grid API rewritten on top of the canvas.
- `p8k_plantart.js` — `PlantArt`. **The icon is the crop's own emoji**, the same one every
  list in the app uses. An earlier version drew each plant procedurally; it looked like a
  garden and was useless, because a bed of green blobs cannot tell you what is in it. The
  organic part lives in the two measured circles, not in the leaves. What survives is the
  growth maths — `growth`/`stage`/`sizeAt` — which the scrubber and the canvas both read.
- `Canvas.wantLabels` **forces labels on when two crops share an icon.** Six herbs are all
  🌿, as are asparagus and rhubarb; without names that bed is a lie. `Canvas.label` shows
  the variety when one is set, because by August "Mountain Fresh" is the useful word and
  "Tomato" is already the picture.
- `p8l_canvas.js` — the SVG renderer, in inches, plus `Recommend.conflicts/friends/crowding/shading`.
- `p8m_canvasui.js` — the bed screen, the planting sheet, the season scrubber.
- `p8n_canvasdrag.js` — press-and-hold to move, drag the handle to resize, live overlay.
- `p8o_shapes.js` — shape picker, the polygon tracer, bed creation, map snapping.
- `p8p_habit.js` — **sourced** mature spread and height (below).

**One definition of "next to".** `Geom.relation().near` — canopies meeting, or under
`Geom.NEAR_GAP` (12″) of clear soil between root zones. The bed view, the drag overlay and
the planting sheet all read it. If they ever disagree, that is the bug.

**Sizes are sourced or they say they are estimates.** `p8p_habit.js` follows the
`p5b_sources.js` pattern: a corrections layer over a derived default. The default is
honest — in-row spacing *is* a spread figure, because that is how extension services set
it — and it is badly wrong for sprawlers, which is why cucumber, the squashes, melons and
the tall shading crops are corrected against sources read on the publisher's own site.
`estSpread`/`estHeight` mark figures the source does not state; `Habit.provenance()`
surfaces all of it in the planting sheet. **Do not add a figure without a URL you have
actually seen.** No extension source consulted gives a mature height for sweet corn; that
one is flagged as an estimate rather than dressed up.

**The shading check defers to the companion table.** Tomato over basil is shade, and it is
also the oldest recommendation in gardening. `Recommend.shading` marks a pairing `ok` when
the crop underneath tolerates shade *or* the two are recommended together — otherwise the
app argues with itself.

`p8f_dragplants.js` is a tombstone: the sandbox cannot delete inside OneDrive, so the file
holds a comment explaining what replaced it. `build.mjs` skips any part starting `<!--`.

## Flowers, tea and crops she adds herself

`p5c_garden_plants.js` adds twelve non-vegetables — chamomile, lemon balm, lavender,
anise hyssop, bee balm, alyssum, phacelia, yarrow, zinnia, cosmos, cornflower, coneflower.
Same pattern as everywhere else: **`srcs` names two or three pages actually read, `est`
names the fields none of them states.** Germination temperature and seed life are almost
never published for ornamentals, so those are estimates and the app says so. Sources go
into `SOURCES` and each crop gets its own `CROP_REF` entry.

The defensible claim for this whole group is that they feed adult hoverflies, lacewings
and parasitic wasps whose larvae eat aphids, and pull in pollinators. That is what the
notes say. Do not write folklore into `tips`.

**`CROP_ALIAS` fixed a silent six-year bug.** The base table's companion lists said
"squash" and "bean", which are not crop ids — six crops each named them and those
relationships never once fired. Aliases expand them at load. `CROP_ABSENT` documents the
lore about plants the app does not carry (apricot, grape, rose…) so a real typo still
fails the suite.

`p5d_usercrops.js` lets anyone add a crop. It is a real table with real columns so the
`.sqlite` export sees it, it folds into `CROPS`/`CROP` on vault load and on import, and it
is **never** shown as sourced — the crop page says the figures are hers. `SCHEMA.usercrops`
lives in `p4_db.js`, not here, because the DB builds its caches from `SCHEMA` at IIFE time.

**`psf` and `sp` are two different conventions and both are right.** `psf` is square-foot
gardening density on an equidistant grid; `sp` is extension in-row spacing. Lettuce is 4
per square foot and 8″ apart in a row. The canvas measures everything off `sp` —
`Geom.fitsIn` is the exact inverse of `Geom.rootR` — so never mix them.

## Micro-climate

A zone describes a county. `sites` records the sun, slope, wind, shelter and frost of one
actual spot. A row is attached to a **plot**; every bed in that plot inherits it, and a bed
may carry its own row that overrides the plot's **field by field** (`Micro.profile`).
`horizon`, `photos`, `shots`, `rain_obs` and `frost_obs` are JSON strings on disk so the
`.sqlite` export stays real — always go through `Micro.encode/decode`, never touch the row.

`Solar` in `p8g_micro.js` is genuine astronomy: Spencer's declination series, altitude and
azimuth by hour angle, stepped 1° at a time (4 minutes) across the day against an 8-sector
horizon. **Sun hours are calculated, not entered.** Two things follow from that:

- `Solar.MIN_ALT` (3°) is applied to the surveyed site *and* to the open reference site, so
  the two stay comparable. Never raise one without the other.
- Nothing is compared against a hardcoded "8 hours", which means nothing at 60°N. The
  yardstick is `sunOpen` — what an unobstructed flat site at this same latitude would get —
  and `sunShare` is the ratio. Water and shade judgements use `sunShare`.

The clever part is `MicroUI.applySunChecks`. A photo with a known bearing and a known time
is not a picture, it is a measurement: if the sun was 40° up in the south-east and the
gardener says the spot was in shade, something at least 40° high stands to the south-east.
That constraint outranks every estimate in the survey and is why the questions after each
shot matter more than the shot.

**Ground truth beats the forecast.** A forecast cell is miles wide; gardeners watch it
promise half an inch and get dust. `MicroLog` asks, on days the forecast claimed rain, what
actually landed at each spot, and keeps the ratio. Under three confirmed days the canopy
estimate stands; it blends in to full weight at eight (`Micro.rainCal`). Frost works the
same way but only ever **suggests** a change to `frost_pocket` — evidence is never applied
behind the gardener's back. An unanswered day is not counted; nothing is inferred from
silence.

`Recommend.water` and `Recommend.now` are wrapped in `p8g_micro.js`. Both are additive: with
no profile they hand straight back to the original. Every adjustment carries its reason in
`micro.why` or in the rec's own `why`/`warn` — a number that moves without saying why is a
bug here.

## Testing — do not skip

```bash
node src/smoke.mjs docs/index.html
```

541 checks against a headless DOM (jsdom, installed to `/tmp/chk`). It covers encryption
round-trips, season maths, companion logic, grid spans, seed and maturity maths, the SQL guard,
every screen and modal, assistant tool execution, and data-accuracy invariants. It has caught
real bugs — an infinite retry loop, a data-truncating patch, stale-task rendering. Run it
before every deploy and add checks for anything new.

## Before you push: `node deploy.mjs`

One command, run from the project root. It stops at the first thing that is wrong:

1. **fetches origin and refuses if it has moved** — this is the check both sessions skipped
   on 2026-08-04, and skipping it is the entire story of that fork;
2. rebuilds from `src/` with the guard armed (below);
3. confirms `src/` reproduces the shipped file, normalising line endings — the Windows side
   writes CRLF and the sandbox writes LF, which makes an identical file look wholly changed;
4. **refuses a `BUILD` stamp that matches the live one**, because the updater compares that
   string and a collision means the phone says "up to date" forever (this already cost the
   throwaway commit `7f7db85`);
5. runs both suites and fails on the first red check;
6. prints the exact push command, and the `curl` to confirm it really went live.

It never pushes on its own. The sandbox has no GitHub credentials, so the push is always
Bruno's, from his own machine.

**`build.mjs` now refuses to write a file that has lost a major part of the app.** The way
work has actually been lost here is not a bad merge — it is a rebuild against a `src/` that
OneDrive quietly rolled back, which overwrites the only surviving copy of a day's work and
raises no error at all. The `REQUIRED` list at the bottom of `build.mjs` names the markers
that must survive; if any is missing the build aborts and `docs/index.html` is left
untouched. Add to that list whenever a major part lands. `--force` overrides it, and should
be rare enough to feel wrong.

## Never let this fork again

On 2026-08-04 two sessions ran against `main` in parallel from `5951411` and diverged for
most of a day. One replaced the planting model with the canvas; the other kept building on
the grid and pushed. Git cannot know two rewrites of the same functions were meant as
alternatives, so it correctly refused to merge them — 10 conflict blocks in `index.html`,
several over a thousand lines. Resolved at `4450d2e` by taking the canvas wholesale, after
checking that origin held nothing this line lacked.

1. **One session against `main` at a time.** If two must run, give each an explicitly
   disjoint scope, in both prompts.
2. **`git fetch origin && git log HEAD..origin/main` before any large piece of work**, and
   stop if origin has moved. Both sessions skipped this; that is the whole story.
3. **Bump `BUILD` once, at the end of a deploy.** A colliding `.13` stamp already cost a
   throwaway commit (`7f7db85`) because the updater compares strings and never fired.
4. **`src/` is under version control now, and the project is out of OneDrive.** This was the
   single highest-value fix and it is done. `git status` now answers "do `src/` and the
   shipped app agree?" for free — the question that, left unanswerable, produced a recovery
   report concluding the canvas had been lost when it had not. When diffing built files by
   hand, still normalise line endings: Windows writes CRLF and the sandbox writes LF, which
   makes an identical file look like every line changed.
5. **Snapshot before a merge.** `git branch backup/<name> <sha>` on both sides, and copy
   `docs/index.html` aside. The canvas work existed in exactly one place.

## Deploying

```bash
git add -A
git commit -m "..."
git push origin main
```

**Push needs credentials.** The Cowork sandbox has no GitHub auth, so `git push` from a session
fails with `could not read Username`. Commits still work — a session should commit its changes
and hand back a ready-to-push repo. Bruno runs the push from his own machine, where the Windows
credential manager already has GitHub access. If a session ever needs to deploy end to end on
its own, the fallback is the GitHub web UI (Add file → Upload files) via the Chrome extension,
which is how earlier deploys were done.

## The store builds

`dist/mobile/` is a Capacitor project wrapping the same `index.html` for Google Play and
the App Store. It is committed to the repo so CI can build it; GitHub Pages ignores it.

```bash
cd dist/mobile
npm install
npm run build          # sync-www.mjs -> www/, then cap sync
npm run screenshots    # renders the real app at both stores' required sizes
python scripts/make-assets.py   # regenerates every icon and splash
```

Three rules that matter:

1. **The app is bundled, not fetched.** `scripts/sync-www.mjs` copies the built app into
   `mobile/www` and strips the service worker registration from the copy. A store build that
   pointed at bzeitel25.github.io would be rejected by Apple under guideline 4.2 and would
   stop working the moment the gardener lost signal.
2. **Native behaviour lives only in `src/p19_native.js`.** Every patch there is guarded by
   `Native.active`, so the web build is untouched. Don't scatter Capacitor calls into feature
   files — that is the same mistake the packet reader made with the Anthropic endpoint.
3. **The self-updater is disabled in native builds.** An app that downloads and runs new code
   around review is a rejection on both stores. `p19_native.js` replaces `Updater.go`.

Voice input is Android and web only. The community speech plugin ships a CocoaPods podspec
and no `Package.swift`, so Capacitor 8's SPM-based iOS project excludes it and `cap sync ios`
warns about it. `p19_native.js` removes the mic button when no recogniser is present.

Every assistant answer carries a **"Report this answer"** control. That is not decoration —
Google Play's AI-Generated Content policy requires in-app reporting for anything a model
writes, and the listing is rejected without it. Keep it.

Neither store build can be compiled in a Cowork session: there is no Android SDK and no
macOS. `.github/workflows/` does both. The iOS workflow runs on a free GitHub macOS runner
and signs with an App Store Connect API key, which is what makes an iOS release possible
without owning a Mac. `dist/store/SUBMISSION.md` is the full runbook.

## Data and accuracy rules

- Crop figures for germination temperature, seed viability, water and pH are reconciled against
  primary extension sources in `p5b_sources.js`. That file is a **corrections layer applied over
  the base table**, so provenance stays visible. Change numbers there, not in `p5_plants.js`.
- Every crop and every diagnosis must resolve to a real source URL. Only use URLs actually seen
  on the publisher's own site — the smoke suite asserts they're https and on an official domain.
- Days to maturity is shown as a **range**, never a point, and defers to the gardener's own
  recorded first-harvest averages once she has three for a crop.
- Contested claims (milk spray, marigolds/nematodes, beetle traps) carry explicit caveats in
  `CLAIM_NOTES`. Keep it that way.

## Things that will bite you

- Top-level `const` in a classic script is **not** a property of `window`. The smoke test reaches
  app objects via `w.eval("({DB,CROPS,…})")`. Add new globals to that list or tests can't see them.
- `Write` can't reach paths that don't exist yet — create directories with bash first.
- The OneDrive-synced folder rejects `unlink` from the sandbox; git warns about `tmp_obj` files
  and lock files but the commit still succeeds. Harmless.
- Model names move. The assistant supports Gemini and Claude, ships current defaults, migrates
  retired ones on load, and can list models live from the user's key. Don't hardcode a single one.
