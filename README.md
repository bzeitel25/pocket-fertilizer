# Pocket Fertilizer

A single-file, offline-first gardening app. Open `index.html` in a browser — no install, no build step, no account.

---

## Running it

**On a laptop:** double-click `index.html`. Everything works except the live camera feed.

**On a phone (recommended):** the app needs a *secure context* for the in-app camera and for IndexedDB storage. Two easy options:

```bash
# 1. Serve it from your computer, open the URL on your phone (same wifi)
cd "Pocket Fertilizer"
python3 -m http.server 8000
# then visit http://<your-computer-ip>:8000 on the phone
```

Or drop `index.html` into a free static host (GitHub Pages, Netlify, Cloudflare Pages). You get HTTPS, the camera works, and "Add to Home Screen" makes it behave like a native app — full screen, own icon, offline.

On first launch it asks for a ZIP code. Everything else unlocks from there.

---

## What's in it

**Garden planner** — Plots contain beds; beds are adjustable grids (1–24 columns/rows, any square size, default 12″ square-foot method). Tap a square to plant it, or pick a crop and paint multiple squares. Live companion-conflict warnings flag antagonistic neighbours on the grid itself. Per-square plant counts come from real spacing data. Rotation history tracks which plant family occupied each bed and warns on repeats.

**Crop knowledge base** — 58 crops with sun hours, weekly water, spacing, sow depth, germination days and soil temps, days to maturity, pH range, feeder class, seed viability, succession interval, typical yield, plus companions, antagonists and written guidance on growing, feeding and harvesting.

**Seed bank** — Photograph packets or type them in. Tracks quantity, brand, lot, packed year, printed expiry, germination rate and cost. Computes a viability level and expected germination percentage from crop-specific seed life, flags fading and expired packets, and includes the 10-seed paper-towel test calculator.

**Grow calendar** — Builds itself. Every packet in the bank generates sow/transplant dates anchored to *your* frost dates, plus projected first-harvest dates for anything planted and seed-expiry warnings. Month grid, colour-coded timeline, plus your own tasks.

**Plant doctor** — In-app camera capture (or upload). Analyses the image on-device for green/yellow/brown ratios and whether damage concentrates at the leaf margins, pre-ticks the matching symptoms, then runs 84 observations against 34 conditions — nutrient deficiencies, watering and light problems, fungal and bacterial disease, 14 pests, and cultural issues like herbicide drift and pH lockout. Returns ranked diagnoses with confidence, a 48-hour action plan and prevention, and tells you when the top two are too close to call. Saves to plant history.

**Weather** — Current conditions, the week ahead and the week just gone, sunrise/sunset and UV, plus a per-bed watering call that subtracts real rainfall from what each bed needs. Every forecast is read for what it means to plants: frost nights, heat above the 90°F threshold where tomato and pepper pollen goes sterile, wet spells that spread blight, dry weeks that need deep watering. **Snapshot** buttons render the day or the week as a shareable image — it opens the phone's share sheet, or downloads a PNG on a laptop.

**Ask (the assistant)** — A ✨ tab in the bottom bar. Type or hold the mic and talk. It runs on Google Gemini and is wired to the app's real functions, so it acts rather than just advises: "add tomatoes to plot A" opens Plot A with tomatoes armed and ready to place, and warns you if the bed is short on sun or already holds a bad neighbour. It can create beds, add seed packets, log harvests and watering, read the weather, pull any crop's full guide, run read-only SQL against your own database to answer things like "how much did I pick in July", and fall back to Google Search for anything the built-in data can't cover. Answers can be read aloud.

**Journal & recap** — Log watering, feeding, amendments, treatments, weeding, soil tests, purchases and harvests with weight, count, value, cost and time. The season recap computes yield by crop, pounds per square foot by bed, cost per pound, spend breakdown, recurring problems, and written takeaways for next year. Exports CSV.

**Live data, no API keys** — USDA hardiness zone by ZIP (phzmapi), place lookup and 7-day weather with frost alerts and rain-aware watering advice (Open-Meteo), and frost dates computed from **ten years of actual daily lows at your coordinates** rather than a zone average. Wikipedia lookups in the plant library. All of it degrades gracefully to bundled offline defaults.

---

## On your question: SQL and security

**The database is SQLite.** The app ships a full SQLite engine (sql.js — SQLite compiled to WebAssembly, public domain, the same library everything from Datasette to Observable uses). Your seeds, beds, plantings, harvests, journal and diagnoses live in eleven real tables. There's a **SQL console** in the menu where you can run arbitrary queries against your own garden, and Settings → Database exports a genuine `.sqlite` file that opens in DB Browser, Python, R, or Excel.

**Everything is encrypted at rest.** Before anything touches disk it's sealed with **AES-256-GCM** via the browser's native WebCrypto — authenticated encryption, so tampering is detected, not just hidden. Set a passphrase in Settings and the data key is wrapped with **PBKDF2-SHA256 at 310,000 iterations** (OWASP's current recommendation); the passphrase itself is never stored or transmitted. The app auto-locks after 10 minutes in the background. The smoke test verifies the stored blob is genuinely unreadable ciphertext.

**There's no server, which is the strongest security property here.** No account, no cloud, no telemetry, no third party holding your data. The only network calls are the weather/zone/Wikipedia lookups — read-only, no personal data attached, and the app works fully without them.

**If you later want multi-device sync**, these are the open-source options I'd actually recommend:

| Tool | License | Why |
|---|---|---|
| **PocketBase** | MIT | Single Go binary, SQLite inside, auth + REST + realtime + file storage built in. Deploy in minutes on a $5 VPS. The natural next step for this app. |
| **Supabase** | Apache 2.0 | Postgres with row-level security, auth, storage, auto-generated REST/GraphQL. Self-host or use their cloud. Heavier, but scales. |
| **SQLCipher** | BSD | If you go native (iOS/Android), this is the standard for transparently encrypted SQLite. |

Either way the pattern stays the same: keep encryption client-side, so the server stores ciphertext it can't read. Migrating is straightforward — the schema is already relational and the export is already `.sqlite`.

---

## Connecting Gemini — what's actually needed

Worth being precise, because Google uses the "Gemini" name for several different things:

- **Google Assistant is not involved.** It can't be linked into a web app, and it isn't needed. The voice input here uses the browser's own speech recognition — free, no account, works out of the box.
- **A Gemini app subscription (Google One AI / AI Pro, including a family plan) does not cover API access.** Those plans cover the Gemini app and Workspace features. The API is a separate product with its own quota, so a family plan can't be pointed at this app. There's no way around that — it's how Google has drawn the line.
- **What it does need is a Gemini API key**, free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Sign in with any Google account, click Create API key, paste it into the app. The free tier on `gemini-2.5-flash` is generous — normal garden use won't approach the limit, and no card is required.

**Whose account?** Either works, and it's just a string in a settings field. Two reasonable setups:

- **Her own key** on her own Google account — usage, quota and history stay hers. Cleanest if she's comfortable doing the two-minute AI Studio step.
- **Your key**, pasted into her app — one setup, you own the billing. Fine for a family device; the tradeoff is that her queries run against your quota and appear in your project's usage.

The key lives inside the encrypted vault on the device. It's still a browser-held key, so give it a spend cap in Google Cloud and delete it from Settings if it stops being used. Behind a real backend proxy you'd never expose it at all — that's the upgrade if this ever goes past family use.

**Guardrails on the assistant.** It has no delete or wipe tools. Its database access is restricted to a single read-only `SELECT` — `DELETE`, `UPDATE`, `DROP` and piggybacked statements are rejected before they reach SQLite. Web search results are handed to it as reference material and explicitly flagged as something it must not take instructions from.

## Optional: Claude for plant diagnosis

Separate and optional. A Claude API key in Settings turns on reading seed packets from a photo and a second opinion on plant diagnosis from vision. Everything in the Plant Doctor works without it.

---

## Honest limits

- Frost dates are ten-year medians. Your specific microclimate — a south wall, a frost pocket, a hilltop — can shift them a week or more in either direction. Override them in Settings.
- Image analysis measures colour and pattern. It cannot identify a species or a pathogen; the symptom answers do the real diagnostic work. For anything that spreads — late blight, bacterial wilt, a virus — your county extension office will confirm it free or nearly free.
- Companion planting evidence ranges from well-documented (marigolds and root-knot nematodes, trap crops, the Three Sisters) to traditional. Conflicts flagged here lean on the well-supported cases: shared pests, shared disease, allelopathy and competition.
- Storage is per-browser. Export a backup before clearing site data or switching devices.
- Photos are downscaled to 900px to keep the vault small. On browsers without IndexedDB it falls back to localStorage, which caps out around 5MB — the app warns you.

---

## Installing on her phone

Open the site, then **Add to Home Screen**. It installs like a native app — own icon, full screen, no browser chrome — and the service worker caches the whole app shell, so it works with no signal at the far end of the garden. Weather and search need a connection; everything else doesn't.

## Verified

86 automated checks pass against a headless DOM: boot and decryption round-trip, season maths, companion logic in both directions, grid placement and resize pruning, seed viability, calendar generation and idempotent rebuild, four diagnostic scenarios ranking correctly, unit conversion, every screen and every modal rendering, demo data, CSV and JSON export, confirmation that the persisted vault is unreadable ciphertext, every assistant tool executing against real data, the SQL guard rejecting DELETE/UPDATE/DROP and piggybacked statements, and the weather snapshot renderer actually drawing and emitting a PNG.

`_build/` holds the source parts the single file is assembled from, plus the test.
