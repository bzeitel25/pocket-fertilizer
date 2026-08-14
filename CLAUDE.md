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
node src/smoke.mjs docs/index.html   # 844 checks
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
p1_head.html  p2_body.html  p3_core.js  p4_db.js
p5_plants.js  p5b_sources.js  p5c_garden_plants.js  p6_live.js
p7_shell.js  p6b_place.js  p8_garden.js  p8b_span.js
p8c_varieties.js  p8e_map.js  p8j_geom.js  p8k_plantart.js
p8l_canvas.js  p8m_canvasui.js  p8n_canvasdrag.js  p8o_shapes.js
p8p_habit.js  p8q_zoom.js  p8r_undo.js  p8s_select.js
p8t_bedrecs.js  p8u_orient.js  p8v_templates.js  p8g_micro.js
p8w_groups.js  p8h_microui.js  p9_seeds.js  p9b_trays.js
p9c_trayui.js  p10_doctor.js  p10b_condsrc.js
p11_journal.js  p8d_maturity.js  p12_library.js  p5d_usercrops.js
p14_weather.js  p8i_microlog.js  p15_assistant.js  p15b_providers.js
p15c_assist_rules.js  p15e_microtools.js  p15d_coach.js  p16_sources_ui.js
p17_tips.js  p18_help.js  p12b_settings.js  p22b_unitsui.js
p20_calsync.js  p21_share.js  p19_native.js  p13_init.js
```
(the list above is documentation and drifts — `src/ORDER.txt` is what the build reads)
(`p22_units.js` sits between `p4_db.js` and `p5_plants.js` — it has to load before
anything that draws a measurement.)

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
- `p8q_zoom.js` — **zoom is a viewBox change and nothing else.** `Canvas.toIn` reads the
  live `viewBox` off the element, so pinching magnifies the picture *and* every gesture
  follows for free. A CSS transform would look identical and break all four of them. At
  1× `Zoom.viewBox` returns null and the caller emits the original string byte for byte —
  the smoke suite asserts that literal. A second finger calls `CanvasDrag.abort`.
- `p8r_undo.js` — an undo stack of *previous values*. Removal was always a soft delete
  (`status:"removed"`, row intact), which is what lets a plant come back as itself rather
  than as a copy that lost its variety and dates. One entry is a list of patches, so eight
  plants moved together undo as one action. `{id, created:true}` means "did not exist
  before — remove it again".
- `p8s_select.js` — multi-select. Tap to gather, press-and-hold any member to move the set
  keeping its shape. Group remove and duplicate are single undo entries.
- `p8t_bedrecs.js` — `BedRecs`, what would go well with **what is already planted**, and
  `WaterGroups`. Anything that conflicts with an occupant is excluded outright rather than
  ranked low, because the list has to be safe to plant from. The water bands sit where the
  data actually clusters (1½″+, 1″, and the herbs/flowers below that) — not on invented
  thresholds.
- `p8u_orient.js` — `beds.north_deg`, the bearing the **top of the drawing** points at.
  The micro-climate survey's photo bearings describe the *site*; nothing ever told the app
  which way the drawing was oriented, so `Recommend.shading` was assuming north-up and
  computing a `north` flag it then never used. Shade now falls away from the midday sun,
  and which way that is comes from the stored latitude — nothing is hardcoded to the
  northern hemisphere.
- `p8v_templates.js` — saved bed layouts. Positions are stored as **fractions** of the
  bed so a layout survives a different-sized one. It stores **no dates and no harvest
  records**: reusing last year's plan must never manufacture a maturity figure, because
  those are the numbers the whole app defers to.

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

## The calendar, and getting it off the phone

`p20_calsync.js` exports the schedule as RFC 5545 iCalendar. Two things there are not
decoration: every event carries a **stable UID** derived from `events.auto` or the row id,
so a second import *updates* the first rather than doubling it — which is why most exports
only ever get imported once; and lines are **folded at 75 octets**, which some importers
reject outright and others silently truncate.

**It is a file, not an account connection, and the UI says so.** A live Google sync needs
OAuth, a registered Cloud client and a server holding a refresh token. This app has no
server, no account and an encrypted local vault; calling a download "sync" would be a lie
about where the data goes. A *single* date can go straight into Google through their
compose URL, which needs no credentials because the person is already signed in.

## Inches or centimetres

`p22_units.js` (core, loaded right after `p4_db.js` so every later part can use it) and
`p22b_unitsui.js` (the switch itself, after `p12b_settings.js`).

**Everything stays stored the way it always was** — lengths in inches, weights in pounds,
temperatures in Fahrenheit, water in inches. That is not a preference, it is the only
arrangement in which the toggle is lossless. Rewriting rows on the switch would round a 48″
bed to 122cm and back to 48.03″, and a gardener who flipped it a few times would find her
beds had changed size. Conversion happens at exactly two boundaries: where a number is drawn,
and where one is typed. `Geom`, `Canvas`, `Solar`, `Recommend` and the spacing maths keep
working in inches and never need to know the file exists.

- `Units.metric` reads `DB.get("units")` **live**, never cached — so it is already right
  after a vault load, a restore or an imported garden, with no init step to forget.
- Display: `len` `big` `dims` `area` `weight` `density` `temp` `water` `waterWeek` `perArea`.
  Input: `inLen/outLen`, `inBig/outBig`, `inWeight/outWeight`, `inTemp/outTemp`,
  `inWater/outWater`, plus `lenStep/bigStep/waterStep` for the `step` attribute.
- **`tempDelta` is not `temp`.** A difference of 10°F is 5.6°C, not −12°C. Anything that is
  a span of degrees rather than a point on the scale goes through `tempDelta`.
- **`escU(s)` is `esc(Units.prose(s))`.** Growing notes, harvest instructions and diagnosis
  treatments carry measurements inside the sentences — "thin to 6–8 inches", "peppers sulk
  below 55°F", "push a finger two inches into the soil". `Units.prose` rewrites ranges before
  single figures, handles digits and the written-out numbers the tips actually use, and
  leaves anything it does not clearly recognise as a measurement exactly as written. Use
  `escU` at any site printing written guidance; plain `esc` everywhere else.
- **Harvests keep the unit they were recorded in.** The `harvests` table already had a
  per-row unit and `Journal.lbs()` to normalise; watering entries now have `Journal.waterIn()`
  for the same reason. What the gardener typed is a fact and is shown back verbatim — only
  the totals and the recap restate.
- **Assistant tool arguments stay canonical.** That contract is with the model, not the
  gardener. What the model *writes* cannot be converted after the fact, so `Assist.system()`
  tells it which system to answer in and not to quote raw tool units back.

The switch is a chip in the plot strip on the Garden tab and beside the size line on the bed
screen, plus a segmented control in Settings. `Units.flip()` re-renders the current tab; that
is the whole of "swap the app over", because every number on screen is derived.

## Pots, planters and a bed that is several shapes

`beds.parts` is a JSON list of sub-shapes in inches; `shape:"group"` turns it on.
`p8w_groups.js` is the editor, and the whole of the model is **`Geom.parts(bed)`** — an
array of outlines, which for an ordinary bed is a one-element array. There is one code
path, not two.

Everything that used to ask "is this point in the bed" now asks **"is it in ANY part"**:

- `Geom.inside` tests each part separately, so a plant cannot straddle the gap between
  two pots — the gap is bench, not soil.
- `Geom.areaSqIn` sums the containers. This matters beyond cosmetics: it is what decides
  how much fits and what the yield-per-area figures divide by. A row of six 14″ pots is
  4.3 sq ft of soil inside a 6.5 sq ft footprint.
- `Geom.centroid` returns the centre of the **largest** part, and `clampInto` walks a
  dropped plant toward the **nearest** part. Using the bed's overall middle would drop
  things onto the empty bench between two pots.
- `Geom.svgPath` emits one compound path with a subpath per container, so a single element
  still carries the whole bed and every clip, fill and gradient keeps working. `Canvas.bedShapeSVG`
  must not take its `isRound` shortcut for a group even when every container is round.

`parts` is parsed on demand and memoised against the raw string, **never written back onto
the row** — the same hazard `polyOf` warns about.

## Seed trays

`p9b_trays.js` (model) and `p9c_trayui.js` (the screen, folded into the Seeds tab behind a
segmented control). Two real tables, `trays` and `traycells`, rather than a JSON blob,
because the useful questions are asked across them and the `.sqlite` export should see them.

**`Trays.plan()` derives, never stores.** Sprout window is the crop's own `germ` range from
the sowing date. Time in the tray is the gap between the crop's own `start.indoor` and
`start.tp` offsets — and where a crop has no indoor window the answer is `null` and the UI
says so rather than inventing six weeks. Plant-out is never earlier than `lastFrost + start.tp`.
Everything being derived means a tray re-reads correctly if the frost dates are later corrected.

**The sowing date is the load-bearing part.** `Trays.plantOut` creates a planting carrying the
date the seed went into the TRAY, with today only as `transplant_on`. Dating it today would
teach `Maturity` that every transplanted crop finishes six weeks faster than it does, and
those are the figures the whole app defers to.

A tray is also the only honest measurement of what a packet is really doing, so germination
observed across its cells is offered back to the packet's `germ_rate` — as a confirm, never
silently, because she may have let that tray dry out and knows it.

## The plant icon is identification, not a second measurement

`Canvas.iconR` gives **every crop the same icon size**, derived from the bed
(`ICON_BASE` of its short side, clamped between `ICON_MIN_IN` and `ICON_MAX_IN`).
Only growth moves it, because a seedling really is smaller and the scrubber exists to
show that.

It used to be sized off the plant's own canopy, capped by its root circle. That drew a
squash as an enormous glyph and a carrot as a speck — the same thing the two circles
already say, said twice and said worse. There is deliberately **no cap against the
plant's own circles** now: that cap was solving a problem this app does not have, since
a dense sowing is ONE planting carrying a quantity rather than sixteen separate points,
so uniform icons do not pile up. The root ring is stroked **after** the icon, so where a
small crop's icon covers its circle the measurement is still the thing on top.

## Moving a garden between devices

`p21_share.js` exports one or more plots as a `.json` file that another copy of the app
**adds** to itself. It is not the backup and must never become it: the backup carries
everything and *replaces* everything, which is exactly what someone with a phone and a
tablet cannot use.

Four things there are load-bearing:

- **JSON, not Markdown.** A bed is a polygon in inches and a plant is a point carrying two
  radii. Prose can only describe that by rounding it and parsing the rounding back — a lossy
  round trip pretending to be a lossless one. `_about` is the first key in the file so opening
  it in a text editor explains itself, and `summary` is the same thing in sentences; there is
  also a "copy a readable summary" button for pasting into a message.
- **`pick()` whitelists against `SCHEMA`.** Nothing reaches the file that is not a real column.
  This is the same hazard `Geom.polyMemo` warns about — a working field stashed on a cached row
  ending up serialised into the gardener's data.
- **Ids are rewritten and references are followed.** `apply()` carries one old→new map through
  the whole pass: usercrops first (everything else names them), then photos, varieties, plots,
  beds, seeds, plantings, map items, sites, history. **An unresolved reference becomes `null`,
  never a surviving id** — a planting that silently kept a `seed_id` would point at an unrelated
  packet on the destination, which is worse than one that admits it has no packet. Bundled
  reference varieties (`ref:crop:Name`) are the one id that is kept, because both devices ship
  `VARIETY_REF`.
- **`maturity` is not carried, and the UI says why.** Those are the figures the app defers to
  after three records. A file can be imported twice; carrying them would let one garden be
  counted twice in its own average. Harvest *records* travel when history is ticked — they
  arrive as records and do not feed the learning, because `Maturity` writes its rows in
  `Journal.saveHarvest`, not by reading the harvests table.

A plot whose name is taken comes in as "Back yard (imported)". A planting whose crop this
build has never heard of is **skipped and counted**, and the report says to update and import
again — better than a bed full of unknown-crop placeholders. If the two devices are set to
different zones the preview says so up front: the beds and plants are exact, the dates are
recomputed from the destination's own frost dates.

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

## Feeding

`p23_feed.js` (the model) and `p23b_feedui.js` (the screens). This is the feature the
app is named after and it went in last, so the rules it follows are worth stating plainly.

**Nitrogen is computed. Phosphorus is refused.** That asymmetry is the whole design.
Nitrogen leaches, is consumed annually, and every extension service publishes a garden
rate for it, so `Feed.nFor` scales UMD's figures — 3 lb per 1,000 sq ft for a heavy
feeder, 2 for the general case — down to the ground a planting actually occupies.
Phosphorus is the opposite: OSU's own table applies **zero** bonemeal above a soil test
of 60 ppm, and UMN's dataset puts the median garden at 68 ppm against 26 ppm in farm
fields, because compost carries P and it does not leach. So `Feed.dose` returns
`{ok:false}` for anything carrying `rateOnly`, and the app quotes the published rate and
the test value it depends on instead of producing a number. **Do not add a P dose.**

**The light-feeder rate is the only invented figure and it is flagged.** No source states
one. `FEED_RATES.light.est` is `true` and the UI shows a `derived` chip, the same
convention as `Habit.estSpread` and the garden plants' `estfields`.

**Side-dress timing is kept in the source's words, not converted to a date.** Most of the
Missouri/K-State table is growth stages — "when the plant begins to set fruit", "when
plants are 8–10 inches tall" — and a stage is what the gardener should actually look at.
`stage:true` means the date on the calendar is only a reminder to go and look, and the UI
says so. Where a source gives no time at all the reminder falls at `SIDEDRESS_MID` (35
days), the middle of Missouri's general "four to six weeks after planting". Crops the
source says *not* to side-dress — carrots, beets, lettuce, watermelon, sweet potato, the
herbs — return a `none` step and no event. Legumes carry `noPre` and are never offered
nitrogen at planting, because the crop table has always said they fix their own and an
app that printed that and then scheduled a dose would be arguing with itself.

**`Feed.plan()` derives, never stores** — same contract as `Trays.plan`. Correct a sowing
date and the whole schedule re-reads.

**Cups come from a source too.** UMD weighs a cup of dry organic meal at 0.33 lb and a cup
of granular at 0.5 lb; OSU independently gives "1 pound ≈ 2 cups", which agrees on
granular. `LB_PER_CUP` is those two numbers and nothing else. Liquids are never converted,
and metric never sees a cup — those are US cups and `Feed.doseText` gives grams instead.

**`Cal.rebuild` is wrapped, and its prune is now namespaced.** The sweep in `p9_seeds.js`
used to remove *every* auto event it had not just written, which would have deleted the
feeding events a moment before the wrapper recreated them. It now only prunes
`frost|seed|exp|harv`. Any future wrapper adding auto events needs its own namespace and
its own `keep`.

## Named products, and whether any of it worked

`p23c_products.js` (the catalogue, cost per unit of nitrogen, similarity, the label
camera), `p24_trials.js` (outcomes and split trials), `p24b_trialui.js` (their screens).

**A guaranteed analysis is a LABEL fact. An extension rate is a RESEARCH fact.** They are
both true and they are not the same kind of thing, and the app must never let one borrow
the other's authority. `PRODUCT_REF` is deliberately **not** merged into `SOURCES` — the
smoke suite asserts that no manufacturer URL passes the `OFFICIAL` regex and that no
product id turns up in `SOURCES`. Every entry carries `checked`, the date its label was
read on the maker's own page, because formulations move: Jobe's Vegetable & Tomato has
shipped as both 2-7-4 and 2-5-3, and a catalogue with no date on it goes quietly wrong.
Each product's `url` must be on its own brand's domain; that is asserted too.

**`Feed.shelf` is wrapped, not edited.** `p23_feed.js` stays purely extension material,
and a build without `p23c` still works on the commodity ingredients alone. The wrapper
also drops any catalogue entry she has already adopted, so nothing appears twice under
two ids.

**Cost per pound of actual nitrogen is the one recommendation the app can make with total
confidence**, because it is arithmetic: `cost / bag_lbs / (N%/100)`. A 4 lb bag of 3-4-4
holds 0.12 lb of nitrogen. It says nothing about which grows better tomatoes, and the UI
says so.

**Simple and Advanced change what is on screen, never what is computed.** The smoke suite
asserts both modes produce an identical dose. Advanced adds percentages, the arithmetic,
and `Products.blend` — a weighted average of shelf items, which is arithmetic and so is
stated flatly. A blend containing a liquid returns `form:null` rather than pretending to
be measurable in cups.

**Outcomes is the easiest place in this project to lie, and it is built to make lying
hard.** One gardener, no control, no randomisation, and every confounder there is. So:

- comparisons are **within one crop only**, never across crops;
- `OUTCOME_MIN` is 3, the same threshold `Maturity` already uses — nothing here is more
  certain than that, so nothing here speaks sooner;
- `Outcomes.confounds` names the differences that are actually present (different beds,
  seasons, varieties) rather than waving at them, and `Outcomes.caveat` is unconditional
  and points at the split trial. The suite asserts the caveat renders **above** the first
  bar on screen;
- **nothing here feeds back into any default.** `Feed.rate` is unaffected and tested to be.

**A split trial is the only comparison allowed to use the word "result".** Same crop, same
bed, same day, two products, arms interleaved down the bed so neither gets the sunny end.
`Trials.can` **refuses** anything unfair — fewer than two plants, different sowing dates,
no date at all — because a trial that looks like a trial but is not is worse than none.
`Trials.MIN_EDGE` (15%) means a smaller margin is reported as "no difference you could act
on", which is itself a useful finding: buy the cheaper one.

**Everything here is local and stays local.** A shared library of other gardeners' results,
with opt-in visibility, is the agreed **next** addition and is deliberately not wired in —
keep it outside the app's inner workings when it lands, exactly as the outcome data is now.

## Testing — do not skip

```bash
node src/smoke.mjs docs/index.html
```

844 checks against a headless DOM (jsdom, installed to `/tmp/chk`). It covers encryption
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

**A session can push now, but only when Bruno asks.** That is his standing rule, not a
limitation — commit and hand back by default, and push on request. It keeps a human checkpoint
between "the suites are green" and "the updater has fired on the phone", which is the checkpoint
the 2026-08-04 fork went around.

### Hand Bruno this exact line, every time

He runs it from **cmd.exe**, and his shell opens on a different drive. `cd` alone will not
move him — without `/d` it changes directory *on C:* and leaves him where he was, silently.
The quotes are not optional either; the path has a space in it.

```cmd
cd /d "C:\Dev\Pocket Fertilizer" && git push origin main
```

Give him the whole line including the folder change. Not `git push origin main` on its own,
not a PowerShell variant unless he asks for one, and not a two-step "cd, then push" — one
line he can paste. He has had to ask for this more than once; that is the tell that a bare
push command is not a useful answer here.

To confirm it went live a minute or two later:

```cmd
curl -s https://bzeitel25.github.io/pocket-fertilizer/index.html | findstr "const BUILD"
```

The credential is a **fine-grained GitHub PAT scoped to this one repo** (Contents: read/write),
in `C:\Dev\.claude-secrets\gh-token.txt`. That folder is a **sibling of the repo, never inside
it** — this repo is public, so a token under `C:\Dev\Pocket Fertilizer` would be one `git add -A`
from being published, with `.gitignore` as the only thing in the way. Ask to connect
`C:\Dev\.claude-secrets` alongside the project folder; it is one approval, each session.

Feed it to git **per command**, so it never lands in `.git/config`:

```bash
HELPER='!f(){ echo username=bzeitel25; echo "password=$(tr -d " \t\r\n" < /path/to/gh-token.txt)"; };f'
git -c credential.helper="$HELPER" push origin main
```

Redact `github_pat_[A-Za-z0-9_]*` from anything printed. Verify with `push --dry-run` first: it
checks permissions for real, which is how the token's missing `Contents: read and write` was
caught. A **403 "Permission … denied"** means the token is valid but under-scoped — on a
fine-grained PAT the Repository permissions section only appears once **Repository access** is
set to *Only select repositories*, so leaving it on *Public repositories* silently yields a
read-only token. A **401** or `could not read Username` means it could not read the file at all.

SSH is not an option: the sandbox cannot resolve `github.com` over SSH, only HTTPS is allowlisted.
`gh` is not installed and there is no GitHub MCP connector. The old fallback — uploading through
the GitHub web UI with the Chrome extension — still works if the token ever lapses.

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

## Ids belong to the database

`DB.insert` **takes** the id rather than defaulting it. Anything a caller passes is
ignored and a `console.warn` names the table. This is not tidiness:

- `sqlWrite` inserts with `INSERT OR REPLACE`, so an id arriving from outside does not
  fail on a collision — it overwrites whichever row already held that id, with no error
  and nothing in the UI to see. It is the one shape of data loss this app cannot detect
  after the fact.
- `Object.assign` copies a key even when its value is `undefined`, so the
  `Object.assign({}, row, { id: undefined })` idiom used in `Garden.duplicateBed` to mean
  "give this a new id" did the exact opposite: it produced a row whose primary key was
  `undefined`, invisible to `DB.find` and written to SQLite as a NULL id. It also carried
  the source row's `created`, so a bed duplicated today claimed it was built last spring.

**To copy a row, use `DB.body(table, row)`** — real columns only, neither the identity nor
the timestamp of the row it came from. `Share.apply` does the same thing on the import
side and then rewrites every reference through its old→new map.

`uid()` carries a per-session counter as well as the millisecond stamp. Rows used to
arrive one tap at a time, where the stamp did most of the work; an imported garden writes
several hundred inside the same millisecond, which left six random base36 characters
carrying it alone — and `Math.random().toString(36)` is allowed to come back shorter than
that. The counter makes two ids from one session incapable of colliding at all.

## The camera

`Cam.rear()` defaults to a 1280×1280 `ideal`, and **a square ideal is a request no phone
sensor can satisfy** — browsers meet it by cropping, which arrives looking like the camera
zoomed itself in. Fine for a seed packet held close; wrong for a skyline, where the crop
silently removes the top of the obstruction being measured. Pass `{ native: true }` for the
sensor's own framing.

A live view must fit the phone with its shutter visible without scrolling. `.camstage` is a
fixed slice of the screen (`height:min(50vh,72vw)`) and the video is `object-fit: contain`,
not `cover` — the survey measures the whole frame. Pinch applies a digital zoom that
**`MicroUI.snap` crops to match**, so what is framed is what is recorded.

`Vision.json` takes a `maxTokens` and a `what`. The micro-climate survey asks for a nested
object with an obstruction array and needs ~2600; on the old 900 default a thinking model
spent the entire budget reasoning and returned a candidate **with no parts at all**, which
surfaced to the gardener mid-skyline-survey as "Could not make sense of the packet. Try a
straighter, better-lit shot of the front." An empty answer with `finishReason: MAX_TOKENS`
is now its own error and says what it actually is.

## Things that will bite you

- Top-level `const` in a classic script is **not** a property of `window`. The smoke test reaches
  app objects via `w.eval("({DB,CROPS,…})")`. Add new globals to that list or tests can't see them.
- `Write` can't reach paths that don't exist yet — create directories with bash first.
- **Ask for delete permission at the START of a session, before running any git command.**
  The FUSE mount that bridges the project into a Cowork sandbox starts out permitting create,
  write and rename but denying `unlink`. That single missing verb breaks git completely: git
  writes `.git/index.lock`, renames it over `.git/index`, then unlinks the remains — the last
  step fails, the lock survives, and **the next git command refuses to run at all**. So a
  session gets one `git add` and then nothing, and the repo stays wedged until someone deletes
  the lock from Windows. The `tmp_obj_*` warnings are the same cause and are harmless.

  It is not a hard limit. The `allow_cowork_file_delete` tool asks Bruno to enable deletion for
  the folder, and once he approves, `rm` works and git runs clean. **Request it before touching
  git, not after** — asking afterwards means he has already had to delete a lock by hand. An
  earlier version of this note said a session simply could not commit; that was wrong, and it
  also blamed OneDrive, which was wrong twice over since the project left OneDrive and the
  behaviour did not change. `*.tmp` is gitignored so a scratch file a session cannot clean up
  can never ride along in a commit.
- Model names move. The assistant supports Gemini and Claude, ships current defaults, migrates
  retired ones on load, and can list models live from the user's key. Don't hardcode a single one.
