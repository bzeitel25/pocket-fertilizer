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
Plots contain beds; beds are adjustable grids from 1×1 to 24×24, with any square size (12″ by default, the classic square-foot method). Tap a square to plant it, or arm a crop and paint across several.

**Plantings stretch to any shape.** Select one and drag its corner handle, or use the width and height steppers, to cover 1×2, 2×3, 1×10 — whatever the plant actually takes. Each spanning planting is one of two things, and the app tracks which:

- **One plant, sprawling** — a single cucumber that ate six square feet. Recording it this way means the app remembers that footprint and offers it the next time you plant that crop.
- **Filled with plants** — the area packed at proper spacing, auto-populated from real per-square-foot data (1 tomato, 4 lettuce, 9 beets, 16 carrots per square foot).

Either way it works out how many seeds to sow, adjusted for the germination rate of the actual packet you linked — an old packet at 40% viability asks for more seed than a fresh one.

Companion conflicts are flagged on the grid as you plant, measured edge-to-edge between plantings, and rotation history tracks which plant family last occupied each bed.

### Varieties
Every planting and seed packet can carry a variety. The app ships a reference list of long-established varieties with days to maturity, growth habit, disease-resistance codes and a note on what makes each one distinctive — Sungold, Cherokee Purple, Marketmore 76, Waltham Butternut, Provider, Lacinato and dozens more. Anything not on the list can be typed in by hand, or looked up: with the assistant connected, **Look it up** searches the web and fills in the details for review before saving. Saved varieties are reusable across plantings and packets. ### Days to maturity that learns your garden
Published days-to-maturity is a single number pretending to be precise — it swings with variety, heat, light and season. So the app shows a **range** and says where it came from: typical for the crop, typical for this variety, or your own average.

Record a first harvest on any planting and it starts learning. One record and it blends yours with the catalogue figure; after three it plans with **your** number instead. The season recap tabulates every crop's real timing against the published figure, so you can see at a glance that your garden runs, say, nine days slower than the packet claims — and every future harvest projection quietly corrects for it. Logging a harvest against a planting records this automatically, so it usually happens without being asked.

### Crop database
60 crops with sun hours, weekly water, spacing, sow depth, germination days and soil temperatures, days to maturity, pH range, feeder class, seed viability, succession interval and typical yield — plus companions, antagonists, and written guidance on growing, feeding and harvesting each one.

### Seed bank
Photograph packets or type them in. Tracks quantity, brand, lot, packed year, printed expiry, germination rate and cost. Each packet gets a viability level and an expected germination percentage derived from that crop's seed life, so fading and expired packets surface before they waste bed space. Includes the 10-seed paper-towel test calculator.

### Grow calendar
Builds itself. Every packet in the bank generates sow, transplant and fall-sowing dates anchored to your frost dates, plus projected first-harvest dates for anything planted and warnings as seed reaches its viability limit. Month grid, colour-coded timeline, and your own tasks alongside.

### Plant doctor
Capture from the in-app camera or upload a photo. The image is analysed on-device for green/yellow/brown ratios and whether damage concentrates at the leaf margins, which pre-selects the matching symptoms. 63 observations then run against 43 conditions — nutrient deficiencies, watering and light problems, fungal and bacterial disease, pests, and cultural issues like herbicide drift and pH lockout. You get ranked diagnoses with confidence, a 48-hour action plan, prevention, and a note when the top two are too close to call. Everything saves to plant history.

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

## Accuracy and sourcing

Every figure the app shows for germination soil temperature, days to emergence, seed viability, watering and pH has been reconciled against a primary reference, and the app links to that reference from the crop page. A **Sources & accuracy** screen lists them all and explains how much weight each number deserves.

Primary references used:

| Reference | Publisher |
|---|---|
| [Soil temperature conditions for vegetable seed germination](https://extension.oregonstate.edu/gardening/soil-compost/soil-temperature-conditions-vegetable-seed-germination) | J.F. Harrington, UC Davis — via OSU Extension |
| [Seed Viability and Germination](https://extension.illinois.edu/sites/default/files/seed_viability.pdf) | University of Illinois Extension (from Colorado State and Iowa State) |
| [Vegetable growing guides](https://extension.umn.edu/yard-and-garden) | University of Minnesota Extension |
| [Liming and Fertilizing Vegetables](https://hgic.clemson.edu/factsheet/fertilizing-vegetables/) | Clemson Cooperative Extension |
| [Disease Resistant Vegetable Varieties](https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/) | Cornell University |
| [Plant Hardiness Zone Map](https://planthardiness.ars.usda.gov/) | USDA Agricultural Research Service |

Each of the 43 diagnoses in the Plant Doctor links to the extension page that published the guidance. Claims where the evidence is genuinely mixed — milk sprays on powdery mildew, marigolds against nematodes, Japanese beetle traps — carry an explicit caveat rather than being stated flatly.

Two things the app is deliberately honest about: days to maturity swings 30 days or more between varieties of the same crop, so the seed packet always wins; and spacing and sowing dates are regional, so a local extension office will always beat a calculated date.

## Installing and updating

The Sources screen and Settings both carry one button that does the right thing for where you are:

- Not installed yet → **Install on this phone**, using the browser's own install prompt.
- Already installed → **Check for updates**. It fetches the live copy, compares build stamps, and either confirms you are current or pulls the new build, clears the cached app shell, and reloads.

Garden data is never touched by an update — it lives in the encrypted store on the device, separate from the app file.

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

113 automated checks run against a headless DOM covering boot and decryption round-trip, season maths, companion logic, grid placement and resize pruning, seed viability, calendar generation, diagnostic ranking, every screen and modal, assistant tool execution, the SQL guard, snapshot rendering, and confirmation that the persisted vault is unreadable ciphertext.
