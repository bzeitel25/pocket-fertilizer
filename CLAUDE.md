# Pocket Fertilizer — working notes for future sessions

## Layout

```
Pocket Fertilizer/
  src/      source parts (p1…p19) + smoke.mjs — EDIT HERE
  dist/     the built app AND a git working copy of the repo — DEPLOY FROM HERE
    mobile/     Capacitor Android + iOS shells for the app stores
    store/      listing copy, submission runbook, store art
    .github/    CI that builds the .aab and the .ipa
  README.md project documentation (mirrored into dist/ on build)
```

`dist/` is a git working copy of **https://github.com/bzeitel25/pocket-fertilizer** on `main`.
Its flat file layout matches the repo root 1:1, and GitHub Pages deploys from the repo root,
so a push goes live within a minute or two with no extra configuration.

## The build

```bash
node build.mjs                        # src/ -> dist/index.html
node src/smoke.mjs dist/index.html    # 347 checks
node verify_camera.mjs dist/index.html # 26 checks on the camera -> AI -> form path
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

## Testing — do not skip

```bash
node src/smoke.mjs dist/index.html
```

347 checks against a headless DOM (jsdom, installed to `/tmp/chk`). It covers encryption
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
