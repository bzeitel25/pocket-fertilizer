# Pocket Fertilizer

A gardener's pocket assistant: lay out beds of any shape on an organic canvas, track a seed bank, get a calendar built from your own frost dates, diagnose sick plants from a photo, read the weather for what it means to your plants, and ask for any of it by voice.

**Live app → [bzeitel25.github.io/pocket-fertilizer](https://bzeitel25.github.io/pocket-fertilizer/)**

*Working on this project? Read **[START-HERE.md](START-HERE.md)** before anything else.*

Offline-first, no account, no server. Everything stays encrypted on the device.

---

## Getting started

Open the link, enter a ZIP code, and everything else unlocks from there.

On a phone, use **Add to Home Screen**. It installs like a native app — own icon, full screen, no browser chrome — and the whole app shell is cached, so it works with no signal at the far end of the garden. Weather and web search need a connection; nothing else does.

---

## Features

### Garden planner
**There is no grid.** Nothing in a garden grows in a box — leaves weave together overhead while roots keep their distance below — and a lattice cannot express either. So a bed is an outline measured in inches, and you place plants anywhere inside it.

Pick the outline: rectangle, rounded, circle, oval, triangle, trapezoid, hexagon or L-shape, each freely resized and rotated. Or trace your own, corner by corner. The tracer snaps to a three-inch grid and to corners you have already dropped, so a shape closes cleanly instead of leaving a sliver — and on the garden map, dragging one bed against another snaps them corner to corner. Butt two triangles into a diamond, tile hexagons, wrap a path. Any layout you can walk, you can draw.

**Every plant gets two circles.** A solid inner one is the root zone it needs to itself. A soft outer one is the foliage it will actually throw when mature. Overlapping leaves are fine — that is what a full bed looks like in July, and whatever sits in front is drawn see-through so nothing hides underneath. Overlapping *roots* are the thing worth knowing about, and they are what the app warns you off.

Those sizes are not invented. In-row spacing is a spread figure — extension services set spacing from how wide a plant gets — so that is the baseline. Where it is badly wrong, which is sprawlers, real figures are used and cited: a cucumber is spaced 12″ and then runs two to three feet either side of the row; a pumpkin wants six to eight feet between mounds. Tap any planting and it shows you where its size came from, and says plainly when a number is an estimate rather than something a source states.

**You can see what is planted where.** Each plant is drawn as its own crop — a tomato looks like a tomato — sized to how far along it is on the date you are looking at, and tilted a few degrees so a row does not read as a row of stamps. The label underneath names the *variety* when you have set one, because once the icon has told you it is a tomato, "Mountain Fresh" is the thing you actually wanted to know. Where two crops share a picture — six of the herbs are all the same leaf — the app stops treating labels as optional and always shows them.

**Drag the season.** A bed looks sensible in April because in April everything is a seedling. Drag the slider to July and the tomato you put on the south side is four feet across and the lettuce behind it has not seen sun in a month. Plants scale by their real growth rate, change from two seed leaves to a bushy mass to something carrying fruit, and the app tells you who is standing in whose light on that date — and when it is a guild rather than a mistake, it says so. Tomato over basil is shade; it is also the oldest companion advice there is, and the app does not argue with itself.

**Feedback while the plant is still in your hand.** Press and hold to lift a plant and move it anywhere. As it comes near its neighbours they light up — a heart for a pairing worth having, a warning for one worth avoiding, an amber ring where two root zones have started to compete. Advice that only arrives after you have committed is advice you have to undo. Plants that like each other pull gently into proper spacing as you drag, and you can switch that off if you would rather place freehand.

Resize a plant either way: sliders in its sheet, or drag the white handle on the selected plant right on the bed. Record what it really did and the app offers that much room next season.

The square-foot grid is still here for anyone who wants rows — a switch turns on the overlay and snaps new plants to it. It is a preference now, not the model. Companion conflicts are measured as real distances between plants, and rotation history still tracks which family last occupied each bed.

### Micro-climate
Your hardiness zone describes a county. It cannot know that the strip in front of the house bakes against a south wall and never sees rain under the eaves, while the bed out back loses the afternoon to a maple and frosts a week early. That difference decides what grows, and almost nothing records it. This does.

Give a plot a micro-climate and every bed in it inherits one; a single bed that genuinely differs can override it field by field.

**Survey it with the camera.** Stand in the middle of the space and shoot north, east, south and west. After each shot the app asks the short questions that make the photo readable: which way you were facing (it will read the compass if the phone has one), what time it is, whether the ground is flat or sloping, and whether that spot is in sun or shade *right now*. That last question is the important one. Knowing your latitude and the time, the app knows exactly where the sun was — so if it was 40° up in the south-east and you say you were standing in shade, then something at least 40° high stands to the south-east. No estimating required. With an AI key connected the photo is also read for what surrounds you, how high it rises, the slope, the surface and what is overhead; without one the app measures sky, brightness and shadow on the device and asks you the rest. Either way you land on the same form, with everything filled in as an editable estimate.

**Or just fill in the form.** Eight sliders for how high the skyline rises in each direction, plus slope, wind, shelter, what is overhead, reflected heat and whether cold air settles there. No camera, no key, no network.

**Then it does real astronomy.** Sun hours are not typed in and not guessed — they are calculated from solar geometry at your latitude, stepped four minutes at a time across the day and blocked by the skyline you recorded, for all twelve months. You get a month-by-month sun chart, how many hours you lose to what is around you compared with open ground, and whether a slope is tilted into the sun or away from it.

All of it feeds the advice rather than sitting in a form:

- **Watering** — the weekly figure is scaled for wind, sun, slope runoff, reflected heat and drainage, and rainfall is discounted by how much actually reaches that spot. A bed under eaves is effectively hand-watered year round, and the app says so.
- **Frost** — a cold pocket frosts earlier in autumn and later in spring; a sunny masonry wall does the opposite. Each spot gets its own two dates.
- **What to plant** — recommendations use the surveyed sun rather than the number you typed, and warn when a crop needs more days than that particular bed has left.

Every adjustment shows its reasoning in plain language. Nothing moves silently.

### The forecast is a claim, not a fact
A forecast cell is several miles across and a summer shower is not. Everyone has watched it promise half an inch and walked out to dust.

So the app checks. On days the forecast called for rain, it asks what actually landed — per spot, because the bed under the eaves and the bed in the open do not get the same answer. A rain gauge is ideal; an honest guess still beats trusting a grid square. Under three confirmed days nothing changes. From three it starts to matter, and by eight your record has replaced the forecast entirely in the watering call. The weather screen reports the running figure: *over 11 rain days it promised 3.2″ and you recorded 1.9″ — about 59%.*

Cold nights work the same way. The app asks whether it really frosted, and if a spot keeps frosting on nights the forecast said were safe, it tells you what that means and offers to record it as a cold pocket. It never changes your garden on its own evidence — you decide.

You can also just say it: *"it was supposed to rain yesterday but we got nothing"* is enough.

### Flowers, tea and the plants that earn their keep
A vegetable garden is not only vegetables. Marigolds go in to keep pests down, alyssum to bring the hoverflies that eat the aphids, chamomile and lemon balm because someone wants a cup of tea in September. Those plants take bed space, cast shade and need spacing like anything else, so they are in the same table — chamomile, lemon balm, lavender, anise hyssop, bee balm, sweet alyssum, lacy phacelia, yarrow, zinnia, cosmos, cornflower and coneflower, alongside the marigolds, nasturtiums, calendula, borage and sunflowers already there.

Each was checked against two or three independent extension sources, read on the publisher's own site. Where they agree, the figure is used and cited. Where none of them states a figure — and for ornamentals that usually means germination temperature and seed life — it is marked as an estimate rather than dressed up as fact.

The claim these make is not folklore. Trials in lettuce found sweet alyssum pulls in hoverflies whose maggots then hunt aphids inside the crop itself; yarrow's flat flower heads are the shape short-tongued predators can actually feed from; phacelia is a honey-bee magnet used in cover-crop mixes. That is what the notes say, and it is what the app plans around.

### Anything else you grow
The crop table is open. Add your own — a regional green, a herb, a tea, whatever came back from the seed swap — and it behaves like every other crop: it spaces, waters, rotates, appears in the calendar, the seed bank and the companion checks. With one deliberate difference. Every built-in figure traces to an extension service; yours traces to you, and the app says so plainly on the crop's own page rather than quietly presenting your guess as research. That distinction is what makes the rest of the numbers worth anything.

### Varieties
Every planting and seed packet can carry a variety. The app ships a reference list of long-established varieties with days to maturity, growth habit, disease-resistance codes and a note on what makes each one distinctive — Sungold, Cherokee Purple, Marketmore 76, Waltham Butternut, Provider, Lacinato and dozens more. Anything not on the list can be typed in by hand, or looked up: with the assistant connected, **Look it up** searches the web and fills in the details for review before saving. Saved varieties are reusable across plantings and packets. ### Days to maturity that learns your garden
Published days-to-maturity is a single number pretending to be precise — it swings with variety, heat, light and season. So the app shows a **range** and says where it came from: typical for the crop, typical for this variety, or your own average.

Record a first harvest on any planting and it starts learning. One record and it blends yours with the catalogue figure; after three it plans with **your** number instead. The season recap tabulates every crop's real timing against the published figure, so you can see at a glance that your garden runs, say, nine days slower than the packet claims — and every future harvest projection quietly corrects for it. Logging a harvest against a planting records this automatically, so it usually happens without being asked.

### Crop database
72 crops with sun hours, weekly water, spacing, sow depth, germination days and soil temperatures, days to maturity, pH range, feeder class, seed viability, succession interval and typical yield — plus companions, antagonists, and written guidance on growing, feeding and harvesting each one.

### Seed bank
Photograph packets or type them in. Tracks quantity, brand, lot, packed year, printed expiry, germination rate and cost. Each packet gets a viability level and an expected germination percentage derived from that crop's seed life, so fading and expired packets surface before they waste bed space. Includes the 10-seed paper-towel test calculator.

### Feeding
The app is called Pocket Fertilizer, and this is the part that earns the name. Every planting carries a nitrogen figure worked out from its feeder class and the actual ground its roots have — 3 lb per 1,000 sq ft for a heavy feeder, 2 for everything else, scaled down to your 4×8 bed. Pick something off the shelf and it becomes a measurement you can take: *about ⅓ cup of blood meal*, not 0.31 pounds.

Feeding dates land on the calendar alongside the sowing ones. The timing is per crop and it is the published timing, kept in the source's own words, because most of these are growth stages rather than dates — a cabbage three weeks after transplanting, sweet corn at 8–10 inches, a tomato **when it starts setting fruit and not before**, since early nitrogen on a tomato buys leaves and costs fruit. Carrots, beets and lettuce get told they need nothing. Watermelon, sweet potatoes and the herbs get told that feeding them makes them worse. Beans and peas are never offered nitrogen at planting at all — they make their own.

Log what you actually put on and the app tracks nitrogen per bed for the season, and says so when a bed has had more than it is owed.

**What it refuses to do is guess at phosphorus.** Most established beds are already saturated with it — compost carries phosphorus and it does not leach away, which is why Minnesota's garden soils run a median of 68 ppm against 26 ppm in farm fields, and why Oregon State's own table applies *zero* bonemeal above 60 ppm. So the app computes nitrogen, quotes the published rates for potassium and lime against the soil-test values they depend on, and tells you plainly that two-thirds of a balanced 10-10-10 is probably doing nothing but running into the creek. It also tells you when you may not need to feed at all: every 1% of soil organic matter releases roughly 0.4 lb of nitrogen per 1,000 sq ft, so a well-composted bed at 5% is already supplying the whole recommendation.

### Grow calendar
Builds itself. Every packet in the bank generates sow, transplant and fall-sowing dates anchored to your frost dates, plus projected first-harvest dates for anything planted and warnings as seed reaches its viability limit — and the feeding dates above sit in the same timeline. Month grid, colour-coded timeline, and your own tasks alongside.

### Plant doctor
Capture from the in-app camera or upload a photo. The image is analysed on-device for green/yellow/brown ratios and whether damage concentrates at the leaf margins, which pre-selects the matching symptoms. 63 observations then run against 43 conditions — nutrient deficiencies, watering and light problems, fungal and bacterial disease, pests, and cultural issues like herbicide drift and pH lockout. You get ranked diagnoses with confidence, a 48-hour action plan, prevention, and a note when the top two are too close to call. Everything saves to plant history.

### Weather
Current conditions, the week ahead and the week just gone, sunrise/sunset and UV, plus a per-bed watering call that subtracts actual rainfall from what each bed needs. Forecasts are read for what they mean to plants: frost nights, heat above the 90°F threshold where tomato and pepper pollen goes sterile, wet spells that spread blight, dry weeks that need deep watering. Snapshot buttons render the day or the week as a shareable image.

### Ask — the assistant
A tab in the bottom bar. Type, or hold the mic and talk. It's wired to the app's real functions, so it acts rather than just advises: *"add tomatoes to plot A"* opens Plot A with tomatoes ready to place, and warns you if the bed is short on sun or already holds a bad neighbour. It also creates beds, adds seed packets, logs harvests and watering, reads the weather, pulls any crop's full guide, answers questions about your own records, and searches the web when the built-in data falls short. It knows each spot's micro-climate too: ask why one bed needs more water than another and it quotes that bed's own surveyed figures, and when you mention something in passing — *"it's against the south wall"*, *"nothing grows there after two o'clock"*, *"the rain never reached us"* — it records it. Answers can be read aloud.

### Journal and season recap
Log watering, feeding, amendments, treatments, weeding, soil tests, purchases and harvests with weight, count, value, cost and time. The recap computes yield by crop, pounds per square foot by bed, cost per pound, spend breakdown, recurring problems, and written takeaways for next season. Exports to CSV.

### Seed trays
Alongside the packets, plan the trays you actually sow. Set out the cells, record what went into each one and from which packet, and the app works out the three dates that matter: when it should sprout, when to start hardening it off, and when it can go in the ground — the last never earlier than that crop's own transplant window after your last frost. All three land on the calendar.

Then tell it what happened. Walk the tray and tap what came up. What did not is recorded too, because that is the only honest measurement of what a packet is really doing — and if enough cells have been judged, the app offers to update that packet's germination rate with your figure rather than the printed one.

Planting out picks a bed and creates a real planting that **keeps the original sowing date**. Days to maturity counts from the seed, so a February tomato that reaches the garden in May still projects its harvest from February.

### Pots, planters and window boxes
A bed does not have to be one shape. A row of half-barrels, six pots on a step, three window boxes — set them up as a single bed made of several containers, with one name, one place on the map and one micro-climate.

They behave like the separate pockets of soil they are: a plant cannot straddle the gap between two pots, and one dropped in a gap is pulled into the nearest container. Growing space counts the containers and not the bench they stand on, which is what the spacing and yield-per-area figures depend on.

### Inches or centimetres
Sliders and typed fields both work in whichever system is on — dragging a bed's size in metric steps in whole centimetres, which is finer than the half-inch it replaced.

A **⇄** button sits in the plot strip on the Garden tab, and beside the size line when a bed is open. Tap it and the whole app swaps: bed dimensions, spacing, sow depth, canopy spread, rainfall, watering calls, harvest weights, yield per bed, and temperatures. Settings has the same switch for setting it once and forgetting it.

It changes how figures are shown, not what is recorded. Everything stays stored in one system and is converted where it is drawn, so you can flip back and forth as often as you like and your beds cannot drift a fraction of an inch either way. The growing notes convert too — "thin to 6–8 inches" reads as "thin to 15–20 cm" — and anything the app cannot confidently identify as a measurement is left exactly as written.

Harvests keep whatever unit you logged them in; the totals and the season recap restate them in the system you are reading in.

### Two devices
A phone in the garden and a tablet indoors are two separate copies of this app. **Copy this garden to another device** saves one file — pick which plots go, and whether to bring seed packets, journal and harvests, and photos — and sends it however suits: AirDrop, Nearby Share, email, a cloud drive.

Importing it **adds**, it never replaces. The other device shows you what is in the file before writing a row: how many beds and plants, and any varieties or hand-added crops it has not seen, which it creates for you. Whatever was already there is untouched, and a plot arriving under a name that is taken comes in with *(imported)* after it. That is the difference between this and Restore from a backup, which wipes the device and puts the backup in its place.

Beds and plants come across exactly — outlines, positions, spacing, varieties, the seed packet each plant came from. Two things stay behind on purpose. Your own days-to-maturity averages are not carried, because a file can be imported twice and counting one garden twice in its own average would skew every harvest date afterwards. And sowing dates are recalculated from the receiving device's frost dates, so gardens in two different climates will show different dates for the same bed.

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
| [Fertilizing Vegetable Gardens](https://extension.umd.edu/resource/fertilizing-vegetable-gardens) | University of Maryland Extension |
| [Fertilizing your garden: vegetables, fruits and ornamentals (EC 1503)](https://extension.oregonstate.edu/catalog/pub/ec-1503-fertilizing-your-garden-vegetables-fruits-ornamentals) | Oregon State University Extension |
| [Side-dressing: mid-season boost for hungry plants](https://ipm.missouri.edu/meg/2024/6/side_dressing-dt/) | University of Missouri Extension (table credited to Kansas State) |
| [You might be over-fertilizing your garden](https://extension.umn.edu/yard-and-garden-news/you-might-be-over-fertilizing-your-garden) | University of Minnesota Extension |

Each of the 43 diagnoses in the Plant Doctor links to the extension page that published the guidance. Claims where the evidence is genuinely mixed — milk sprays on powdery mildew, marigolds against nematodes, Japanese beetle traps — carry an explicit caveat rather than being stated flatly.

Two things the app is deliberately honest about: days to maturity swings 30 days or more between varieties of the same crop, so the seed packet always wins; and spacing and sowing dates are regional, so a local extension office will always beat a calculated date.

## Installing and updating

The Sources screen and Settings both carry one button that does the right thing for where you are:

- Not installed yet → **Install on this phone**, using the browser's own install prompt.
- Already installed → **Check for updates**. It fetches the live copy, compares build stamps, and either confirms you are current or pulls the new build, clears the cached app shell, and reloads.

Garden data is never touched by an update — it lives in the encrypted store on the device, separate from the app file.

### The app store versions

`mobile/` wraps the same `index.html` in a native shell for Google Play and the App Store. The whole app is bundled inside the binary — nothing is fetched from this site at runtime, so it opens and works with no signal at all. Those builds get the system camera and photo picker, the share sheet and Files for exports, haptics on the planting grid, and the Android hardware Back button. Updates arrive through the store rather than the in-app updater.

One difference worth knowing: **voice input works in the browser and on Android, but not on iOS.** The Web Speech API belongs to Safari rather than to the web view an iOS app runs in, and the plugin that would replace it is not compatible with the current iOS build system. Rather than leave a mic button that cannot listen, the iOS build hides it. Everything else is identical.

`store/SUBMISSION.md` is the release runbook, and `.github/workflows/` builds both binaries — including the iOS one, on a hosted macOS runner, so no Mac is needed.

## Limits worth knowing

- Frost dates are ten-year medians. A south wall, a frost pocket or a hilltop can shift them by a week or more — override them in Settings.
- Image analysis measures colour and pattern. It cannot identify a species or a pathogen; the symptom answers do the diagnostic work. For anything that spreads — late blight, bacterial wilt, a virus — a county extension office will confirm it free or nearly free.
- Companion planting evidence ranges from well-documented (marigolds and root-knot nematodes, trap crops, the Three Sisters) to traditional. Conflicts flagged here lean on the well-supported cases: shared pests, shared disease, allelopathy and competition.
- Storage is per-browser. Export a backup before clearing site data. To run the same garden on a second device, use **Copy this garden to another device** rather than the backup — the backup replaces everything on the device it lands on.
- Photos are downscaled to 900px to keep the vault small. Where IndexedDB is unavailable the app falls back to localStorage, which caps out around 5MB and will warn you.

---

## Technical notes

Single self-contained `index.html` — no build step, no dependencies to install. Only sql.js is loaded from a CDN, and it's cached by the service worker after first run.

```
index.html              the entire app
sw.js                   service worker, offline app shell
manifest.webmanifest    PWA install metadata
icon-*.png              app icons
sql/                    SQLite compiled to WebAssembly, shipped rather than fetched
privacy.html            privacy policy
support.html            help and contact
mobile/                 Capacitor shells for Google Play and the App Store
store/                  listing copy, submission runbook, store art
```

For local development, serve rather than opening the file directly — the camera and IndexedDB both need a secure context:

```bash
python3 -m http.server 8000
```

347 automated checks run against a headless DOM covering boot and decryption round-trip, season maths, companion logic, grid placement and resize pruning, seed viability, calendar generation, diagnostic ranking, every screen and modal, assistant tool execution, the SQL guard, snapshot rendering, and confirmation that the persisted vault is unreadable ciphertext.
