# Pocket Fertilizer

A gardener's pocket assistant: plan beds on a grid, track a seed bank, get a calendar built from your own frost dates, diagnose sick plants from a photo, read the weather for what it means to your plants, and ask for any of it by voice.

**Live app → [bzeitel25.github.io/pocket-fertilizer](https://bzeitel25.github.io/pocket-fertilizer/)**

Offline-first, no account, no server. Everything stays encrypted on the device.

---

## Getting started

Open the link, enter a ZIP code, and everything else unlocks from there.

On a phone, use **Add to Home Screen**. It installs like a native app — own icon, full screen, no browser chrome — and the whole app shell is cached, so it works with no signal at the far end of the garden. Weather and web search need a connection; nothing else does.

---

## Features

### Garden planner
Plots contain beds; beds are adjustable grids from 1×1 to 24×24, with any square size (12″ by default, the classic square-foot method). Tap a square to plant it, or arm a crop and paint across several. Per-square plant counts come from real spacing data — 1 tomato, 4 lettuce, 9 beets, 16 carrots. Companion conflicts are flagged on the grid itself as you plant, and rotation history tracks which plant family last occupied each bed so you get a warning when one comes back too soon.

### Crop database
58 crops with sun hours, weekly water, spacing, sow depth, germination days and soil temperatures, days to maturity, pH range, feeder class, seed viability, succession interval and typical yield — plus companions, antagonists, and written guidance on growing, feeding and harvesting each one.

### Seed bank
Photograph packets or type them in. Tracks quantity, brand, lot, packed year, printed expiry, germination rate and cost. Each packet gets a viability level and an expected germination percentage derived from that crop's seed life, so fading and expired packets surface before they waste bed space. Includes the 10-seed paper-towel test calculator.

### Grow calendar
Builds itself. Every packet in the bank generates sow, transplant and fall-sowing dates anchored to your frost dates, plus projected first-harvest dates for anything planted and warnings as seed reaches its viability limit. Month grid, colour-coded timeline, and your own tasks alongside.

### Plant doctor
Capture from the in-app camera or upload a photo. The image is analysed on-device for green/yellow/brown ratios and whether damage concentrates at the leaf margins, which pre-selects the matching symptoms. 84 observations then run against 34 conditions — nutrient deficiencies, watering and light problems, fungal and bacterial disease, 14 pests, and cultural issues like herbicide drift and pH lockout. You get ranked diagnoses with confidence, a 48-hour action plan, prevention, and a note when the top two are too close to call. Everything saves to plant history.

### Weather
Current conditions, the week ahead and the week just gone, sunrise/sunset and UV, plus a per-bed watering call that subtracts actual rainfall from what each bed needs. Forecasts are read for what they mean to plants: frost nights, heat above the 90°F threshold where tomato and pepper pollen goes sterile, wet spells that spread blight, dry weeks that need deep watering. Snapshot buttons render the day or the week as a shareable image.

### Ask — the assistant
A tab in the bottom bar. Type, or hold the mic and talk. It's wired to the app's real functions, so it acts rather than just advises: *"add tomatoes to plot A"* opens Plot A with tomatoes ready to place, and warns you if the bed is short on sun or already holds a bad neighbour. It also creates beds, adds seed packets, logs harvests and watering, reads the weather, pulls any crop's full guide, answers questions about your own records, and searches the web when the built-in data falls short. Answers can be read aloud.

### Journal and season recap
Log watering, feeding, amendments, treatments, weeding, soil tests, purchases and harvests with weight, count, value, cost and time. The recap computes yield by crop, pounds per square foot by bed, cost per pound, spend breakdown, recurring problems, and written takeaways for next season. Exports to CSV.

---

## Live data

No API keys, no signup — all of it degrades gracefully to bundled offline defaults.

| Source | Used for |
|---|---|
| [phzmapi.org](https://phzmapi.org) | USDA hardiness zone from a US ZIP |
| [Open-Meteo Geocoding](https://open-meteo.com) | Place lookup worldwide |
| [Open-Meteo Archive](https://open-meteo.com) | Frost dates from ten years of actual daily lows at your coordinates — not a zone average |
| [Open-Meteo Forecast](https://open-meteo.com) | 7-day weather, frost alerts, rainfall for watering maths |
| [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) | Plant reference in the library |

---

## Data and security

**Storage is a real SQLite database.** The app ships [sql.js](https://sql.js.org) — SQLite compiled to WebAssembly — with eleven tables covering plots, beds, plantings, seeds, events, journal, harvests, diagnoses, observations and photos. A SQL console in the menu runs queries against your own garden, and Settings exports a genuine `.sqlite` file that opens in DB Browser, Python, R or Excel. A plain-JSON backup export is also available.

**Everything is encrypted at rest.** Data is sealed with AES-256-GCM through the browser's native WebCrypto before it is written to storage. Setting a passphrase in Settings wraps the data key with PBKDF2-SHA256 at 310,000 iterations; the passphrase is never stored or transmitted, and the app auto-locks after ten minutes in the background.

**Nothing is uploaded.** No account, no cloud, no telemetry. The only outbound calls are the read-only lookups in the table above, which carry no personal data.

**Assistant guardrails.** No delete or wipe functions are exposed to it. Database access is restricted to a single read-only `SELECT` — `DELETE`, `UPDATE`, `DROP` and piggybacked statements are rejected before they reach SQLite. Web search results are passed to it as reference material and explicitly marked as something it must not take instructions from.

---

## Connecting the assistant

The assistant runs on Google Gemini and needs an API key, which is free:

1. Open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account.
2. Click **Create API key**.
3. Paste it into the app under Settings → Gardening assistant.

Note that a Gemini app subscription (Google One AI / AI Pro) does not include API access — the API is a separate product with its own free tier. `gemini-2.5-flash` is the default and normal garden use stays well within the free limit; no card is required.

The key is stored inside the encrypted vault on the device. It is still a browser-held key, so it's worth setting a spend cap in Google Cloud and removing it from Settings when no longer needed.

Voice input uses the browser's built-in speech recognition and needs no key or account.

Optionally, a Claude API key can also be added to enable reading seed packets from a photo and a second opinion on plant diagnosis. Every part of the Plant Doctor works without it.

---

## Limits worth knowing

- Frost dates are ten-year medians. A south wall, a frost pocket or a hilltop can shift them by a week or more — override them in Settings.
- Image analysis measures colour and pattern. It cannot identify a species or a pathogen; the symptom answers do the diagnostic work. For anything that spreads — late blight, bacterial wilt, a virus — a county extension office will confirm it free or nearly free.
- Companion planting evidence ranges from well-documented (marigolds and root-knot nematodes, trap crops, the Three Sisters) to traditional. Conflicts flagged here lean on the well-supported cases: shared pests, shared disease, allelopathy and competition.
- Storage is per-browser. Export a backup before clearing site data or switching devices.
- Photos are downscaled to 900px to keep the vault small. Where IndexedDB is unavailable the app falls back to localStorage, which caps out around 5MB and will warn you.

---

## Technical notes

Single self-contained `index.html` — no build step, no dependencies to install. Only sql.js is loaded from a CDN, and it's cached by the service worker after first run.

```
index.html              the entire app
sw.js                   service worker, offline app shell
manifest.webmanifest    PWA install metadata
icon-*.png              app icons
```

For local development, serve rather than opening the file directly — the camera and IndexedDB both need a secure context:

```bash
python3 -m http.server 8000
```

89 automated checks run against a headless DOM covering boot and decryption round-trip, season maths, companion logic, grid placement and resize pruning, seed viability, calendar generation, diagnostic ranking, every screen and modal, assistant tool execution, the SQL guard, snapshot rendering, and confirmation that the persisted vault is unreadable ciphertext.
