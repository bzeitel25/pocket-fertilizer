# Getting Pocket Fertilizer into both stores

Written to be worked through in order. Everything the repository can hold is
already in it; what remains is the part that needs your name, your card and
your signature.

**Two things dominate the timeline, and neither is work you can hurry:**

- **Google Play** — a personal developer account opened after 13 November 2023
  must run a closed test with **at least 12 testers, opted in continuously for
  14 days**, before it is allowed to apply for production access. Start this
  first. Everything else can happen during those two weeks.
- **Apple** — review takes roughly 24–48 hours, but a first submission that
  looks like a wrapped website gets rejected under guideline 4.2, and each
  round trip costs days. The build in this repository is set up to avoid that;
  the review notes in `LISTING.md` are the other half of it.

Realistic: **Apple live in about a week. Play live in about three.**

---

## 0. What is already done

| | |
|---|---|
| Native Android + iOS projects | `mobile/android`, `mobile/ios` |
| App bundled inside the binary, offline | `mobile/scripts/sync-www.mjs` |
| SQLite engine shipped locally | `sql/sql-wasm.{js,wasm}` |
| Native camera, files, share, haptics, back button, voice | `src/p19_native.js` |
| Permission strings | `mobile/ios/App/App/Info.plist`, `AndroidManifest.xml` |
| Icons, adaptive icons, monochrome, splash | `mobile/scripts/make-assets.py` |
| Store icon, feature graphic | `store/` |
| Release signing wired to env vars and CI | `mobile/android/app/build.gradle` |
| Android build → signed .aab | `.github/workflows/android-release.yml` |
| iOS build → TestFlight, **no Mac needed** | `.github/workflows/ios-release.yml` |
| Privacy policy, support page | `privacy.html`, `support.html` |
| Listing copy, keywords, review notes | `store/LISTING.md` |
| In-app reporting of AI answers (required by Play) | `src/p15_assistant.js` |

Still yours to do: accounts, the signing key, screenshots, and the console forms.

---

## 1. Accounts

| | Cost | Where | Note |
|---|---|---|---|
| Google Play Console | $25 once | play.google.com/console/signup | Identity verification takes 1–3 days. Do this today. |
| Apple Developer Program | $99/year | developer.apple.com/programs | Verification can take 24–48h, occasionally longer for an individual. |

Register as an **individual** unless you have a company with a D-U-N-S number.
An individual Play account is what triggers the 12-tester rule; an organisation
account is exempt, but getting one requires a registered business.

---

## 2. Make the upload key — do this once, then guard it

Losing this key means never being able to update the Android app under the same
listing again. Run this on your own machine (Java is installed with Android
Studio, or install a JDK):

```bat
keytool -genkeypair -v ^
  -keystore pocket-fertilizer-upload.jks ^
  -alias upload ^
  -keyalg RSA -keysize 4096 -validity 10000 ^
  -storetype PKCS12
```

Then:

1. Store `pocket-fertilizer-upload.jks` and both passwords somewhere that is
   **not** this computer and not OneDrive alone — a password manager entry with
   the file attached is ideal.
2. Base64-encode it for CI:
   ```bat
   certutil -encode pocket-fertilizer-upload.jks keystore.txt
   ```
   Open `keystore.txt`, delete the `-----BEGIN/END CERTIFICATE-----` lines, and
   copy what is left.
3. In GitHub → repository → Settings → Secrets and variables → Actions, add:

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | the pasted base64 |
   | `ANDROID_KEYSTORE_PASSWORD` | the store password |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | the key password |

Accept **Play App Signing** when Play offers it at first upload. It gives you a
recovery route if the upload key is ever lost, which is the only such route
that exists.

---

## 3. Screenshots

Run once on your machine — it renders the real app, seeds the demo garden, and
writes exactly-sized images for both stores:

```bat
cd dist\mobile
npm install
npx playwright install chromium
npm run screenshots
```

Output lands in `store/screenshots/`:

| Folder | Size | Used for |
|---|---|---|
| `ios-iphone-6.9` | 1320 × 2868 | **Required.** The only iPhone size App Store Connect asks for; it scales the rest itself. |
| `ios-ipad-13` | 2064 × 2752 | Required **only if** you submit for iPad. See §7. |
| `play-phone` | 1080 × 1920 | Required. Minimum 2, upload all 6. |
| `play-tablet-7` | 1200 × 1920 | Optional. |
| `play-tablet-10` | 1600 × 2560 | Optional. |

They come out as JPEG deliberately — a Chromium PNG carries an alpha channel
even when the page is opaque, and "screenshot contains an alpha channel" is the
most common invalid-asset rejection on both stores.

Look at them before uploading. If a screen came out empty, the demo seeding
timed out; increase the `waitForTimeout` values in `scripts/screenshots.mjs`
and run it again.

---

## 4. Google Play

### 4a. Build the bundle

GitHub → Actions → **Android release bundle** → Run workflow. Download
`pocket-fertilizer-aab` from the finished run.

Or locally, if you have Android Studio:

```bat
cd dist\mobile
npm install
npm run aab
```

### 4b. Create the app

Play Console → Create app. Name `Pocket Fertilizer`, English (US), **App**,
**Free**.

### 4c. Fill in the declarations

Work down the left-hand "Set up your app" list. The answers:

**App access** — All functionality is available without special access. Use the
note in `LISTING.md`.

**Ads** — No, this app does not contain ads.

**Content rating** — start the questionnaire, category **Utility, Productivity,
Communication or Other**, and answer **No** to every content question. There is
no violence, sexuality, profanity, gambling, drug reference or user-to-user
communication. Expect **Everyone / PEGI 3**.

**Target audience** — 18 and over (or 13+). Do **not** tick any age band under
13; that puts the app into the Families programme with a much heavier review.

**News app** — No.

**Health apps** — No.

**Financial features** — None.

**Data safety** — this is the one people get wrong. The honest answers:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all user data encrypted in transit? | Yes (nothing is transmitted; what is, is HTTPS) |
| Do you provide a way for users to request data deletion? | Yes — Settings erases everything on the device |

The app stores photos, location and personal notes **on the device only**.
Play's definition of "collection" is data transmitted off the device, and
nothing here is. The one genuine edge case is the optional AI assistant: when
the user supplies their own key, their question and any photo they submit go
directly to Google or Anthropic. Add this in the Data safety free-text box:

```
The app has no backend and transmits no user data. An optional assistant,
disabled until the user enters their own third-party API key, sends the
question the user types and any photo the user explicitly submits directly
from the device to that provider. No other feature transmits anything.
```

**Government apps** — No.

**Advertising ID** — No, the app does not use an advertising ID. (It does not,
and declaring one you do not use fails review.)

**AI-generated content** — Yes, the app contains generative AI features. Play
requires in-app reporting for these; it is implemented — every assistant answer
carries a "Report this answer" control.

### 4d. Store listing

Paste from `LISTING.md`. Upload:

- App icon → `store/play-icon-512.png`
- Feature graphic → `store/play-feature-graphic-1024x500.png`
- Phone screenshots → `store/screenshots/play-phone/`
- Privacy policy URL → `https://bzeitel25.github.io/pocket-fertilizer/privacy.html`

### 4e. Closed testing — start this the day the account is verified

1. Testing → Closed testing → create a track, upload the AAB.
2. Create an email list of **at least 12** Google accounts. Real people who
   will actually install it: family, gardening friends, a neighbour. They must
   each opt in through the link and **stay opted in for 14 unbroken days**.
3. Send them the opt-in URL. Ask them to install it and open it a few times —
   Play looks at whether the test was real.
4. The 14 days start once the release is approved **and** 12 testers have
   opted in, not when you created the track. Watch the count on the dashboard.
5. After 14 days: Dashboard → Apply for production access. Google reviews the
   application itself, usually within a few days.
6. Then promote the release to Production.

Do not remove testers during the window. The counter resets.

---

## 5. Apple, without a Mac

The iOS workflow builds and uploads from a GitHub-hosted macOS runner, which is
free for public repositories. You never touch Xcode.

### 5a. Register the App ID

developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+**

- Description: `Pocket Fertilizer`
- Bundle ID: **Explicit** → `io.github.bzeitel25.pocketfertilizer`
- Capabilities: none needed.

### 5b. Create an App Store Connect API key

App Store Connect → Users and Access → Integrations → App Store Connect API →
**+**. Name it `github-actions`, role **App Manager**. It downloads a
`.p8` file **once** — save it.

Add three GitHub secrets:

| Secret | Where to find it |
|---|---|
| `APPSTORE_API_KEY_ID` | the "Key ID" column, e.g. `2X9ABC3DEF` |
| `APPSTORE_API_ISSUER_ID` | the UUID above the key list |
| `APPSTORE_API_PRIVATE_KEY` | the entire contents of the `.p8`, including the BEGIN/END lines |

### 5c. Create the app record

App Store Connect → My Apps → **+** → New App. Platform iOS, name
`Pocket Fertilizer`, primary language English (U.S.), the bundle ID from 5a,
SKU `pocket-fertilizer-1`.

### 5d. Build and upload

GitHub → Actions → **iOS build and TestFlight upload** → Run workflow.

The runner archives, signs with a certificate it creates itself through the API
key, and uploads to TestFlight. Expect 15–25 minutes, then another 10–30
minutes for Apple to finish processing the build before it appears.

If it fails on signing the first time, the usual cause is the App ID from 5a
not existing yet, or the API key having the wrong role.

### 5e. Fill in the App Store Connect forms

**App Privacy** — Get started, then answer:

> Do you or your third-party partners collect data from this app? → **No**

That is accurate: nothing is collected. The optional assistant sends the user's
own question to a provider under the user's own API key and account, which is
not collection by you. Note it in the review notes, which `LISTING.md` already
does.

**Age rating** — work through the questionnaire. Answer No to violence,
sexuality, profanity, gambling, horror and drugs. Two newer questions matter:

- *Does your app include an AI chatbot or generative AI features?* → **Yes.**
  It is a gardening assistant, off by default, with reporting on every answer.
- *Does your app provide unrestricted web access?* → **No.** External links open
  in the system browser; there is no in-app browser.

Expect **4+**, possibly **12+** because of the assistant. Do not try to argue
it down — a rating that is too low is a rejection, one that is too high is not.

**Export compliance** — the app uses only standard encryption to protect data
on the device. `ITSAppUsesNonExemptEncryption` is already `false` in
`Info.plist`, so App Store Connect will stop asking after the first build.

**Content rights** — you own or have rights to all content. The extension-service
material is linked to, not reproduced.

**App Review Information** — paste the notes from `LISTING.md`.
**Before you submit, replace the placeholder with a real throwaway Gemini API
key that has a spend cap.** A reviewer who cannot test a visible feature is a
reviewer who rejects it under 2.1.

### 5f. Submit

Attach the processed build, add screenshots from `store/screenshots/ios-iphone-6.9/`,
set the release to **manual**, and submit. Manual release means you decide when
it goes live rather than it appearing the moment review passes.

---

## 6. If Apple rejects under 4.2

It is the likeliest rejection, and it is answerable rather than fatal. Reply in
Resolution Center with the specifics, not a general appeal:

> The app is not a web view of a website. The entire application — a 60-crop
> database, the bed planner, seed bank, calendar, and the Plant Doctor's 43
> conditions and 63 observations — is bundled in the binary and works in
> airplane mode; the reviewer can verify this by enabling airplane mode and
> using Library → "Load the demo garden".
>
> It integrates native iOS capabilities directly: AVFoundation camera capture
> and PhotoKit for diagnosing plants and reading seed packets, Speech
> Recognition for voice input, the Files app and the system share sheet for
> SQLite/CSV/JSON export, and haptics on the planting grid.
>
> It stores data in an encrypted local database rather than a server, and there
> is no corresponding website offering this functionality.

Then, if pushed further, add something Safari cannot do at all. The cheapest
real answer is local notifications for sowing and watering dates — the calendar
already computes them, so it is a plugin and a scheduler, not a new feature.

---

## 6b. One feature that differs between the two builds

**Voice input works on Android and on the web, and is absent on iOS.**

The Web Speech API belongs to Chrome and Safari, not to the web views the
store builds run in, so `window.SpeechRecognition` does not exist in either
native shell. Android is rebuilt on the platform recogniser via
`@capacitor-community/speech-recognition`. That plugin ships a CocoaPods
podspec and no `Package.swift`, and Capacitor 8's iOS project is SPM-based, so
`cap sync ios` excludes it and says so:

```
[warn] @capacitor-community/speech-recognition does not have a Package.swift
```

Rather than leave a mic button that cannot listen — which App Review does look
for — `p19_native.js` removes the button when no recogniser is present. The
App Store description makes no promise about voice as a result. Everything else
is identical across the two builds.

If the plugin gains SPM support, delete the removal block in `p19_native.js`
and it works on iOS with no other change.

---

## 7. Two decisions worth making before you submit

**iPad.** Supporting it means iPad screenshots, and every layout has to hold up
at 1024pt wide with both orientations. If you would rather not, set
`TARGETED_DEVICE_FAMILY = 1` in the Xcode project and submit iPhone-only. You
can add iPad later; you cannot easily drop it.

**The bundle ID.** `io.github.bzeitel25.pocketfertilizer` is defensible — you
demonstrably control that GitHub Pages domain. It is also **permanent**. If you
ever want `com.pocketfertilizer.app`, change it in
`mobile/capacitor.config.json`, `mobile/android/app/build.gradle`,
`mobile/android/app/src/main/res/values/strings.xml` and the two workflows
**before the first upload to either store**. After that it is fixed for the
life of the listing.

---

## 8. Shipping an update afterwards

```bat
REM 1. edit src/, then:
node build.mjs
node src\smoke.mjs dist\index.html
node verify_camera.mjs dist\index.html
```

Then bump all three version numbers together — they drift apart otherwise:

| File | Field |
|---|---|
| `src/p16_sources_ui.js` | `const BUILD` |
| `mobile/android/app/build.gradle` | `versionCode` **+1**, `versionName` |
| App Store Connect | version string (the workflow sets the build number itself) |

Commit, push, then run the two workflows. The web version at
bzeitel25.github.io updates on push as it always has; the store versions update
when each release is approved.
