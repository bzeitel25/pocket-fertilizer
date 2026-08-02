# Pocket Fertilizer — working notes for future sessions

## Layout

```
Pocket Fertilizer/
  src/      source parts (p1…p16) + smoke.mjs — EDIT HERE
  dist/     the built app AND a git working copy of the repo — DEPLOY FROM HERE
  README.md project documentation (mirrored into dist/ on build)
```

`dist/` is a git working copy of **https://github.com/bzeitel25/pocket-fertilizer** on `main`.
Its flat file layout matches the repo root 1:1, and GitHub Pages deploys from the repo root,
so a push goes live within a minute or two with no extra configuration.

## The build

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

## Testing — do not skip

```bash
node src/smoke.mjs dist/index.html
```

180 checks against a headless DOM (jsdom, installed to `/tmp/chk`). It covers encryption
round-trips, season maths, companion logic, grid spans, seed and maturity maths, the SQL guard,
every screen and modal, assistant tool execution, and data-accuracy invariants. It has caught
real bugs — an infinite retry loop, a data-truncating patch, stale-task rendering. Run it
before every deploy and add checks for anything new.

## Deploying

```bash
cd dist
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
