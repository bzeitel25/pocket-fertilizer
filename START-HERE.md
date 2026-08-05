# START HERE — read this before touching anything

**Every session, human or AI, reads this file first.** It is short on purpose.
`CLAUDE.md` explains how the app is built; this explains how to not break it.

Everything below happened. None of it is hypothetical.

---

## The project moved. Check you are in the right folder.

```
C:\Dev\Pocket Fertilizer          <- THE REAL ONE. Work here.
C:\Users\bzeit\OneDrive\Desktop\Pocket Fertilizer   <- OLD. Dead. Safe to delete.
```

On 2026-08-04 the project moved **out of OneDrive**, and the git repo root moved **up**
from `dist/` to the project folder. Both changes were needed together, and both were to
stop work disappearing:

- **Out of OneDrive**, because it silently rolled back edited source files mid-session
  and corrupted `.git` lock files. Git already gives history and GitHub already gives
  off-machine backup — OneDrive was contributing nothing here except the failures.
- **Repo root up**, because until then git tracked only the *build output*. `src/` — the
  actual source — had no version control at all. That is the single reason work kept
  vanishing without a trace.

`dist/` was renamed `docs/` in the same move so GitHub Pages could serve a subfolder,
which is what lets the source and the built app live in one repo.

**If a path in a prompt, a script or an old note points at the OneDrive copy, it is
stale.** Editing there changes nothing that ships. The old folder is kept only as a
belt-and-braces backup and can be deleted whenever.

---

## The one rule

```bash
cd "C:\Dev\Pocket Fertilizer"
node deploy.mjs
```

Run it **before every push**. It stops at the first thing that is wrong and tells you
what to do. It never pushes on its own. Every failure mode in this document is one
of its checks.

Then, when it says you are clear:

```bash
git push origin main
```

The sandbox has **no GitHub credentials**. The push is always Bruno's, from his own
machine. An AI session should commit and hand back a ready-to-push repo — never claim
it pushed, and never route around this by uploading files through the GitHub web UI
(see mistake 2).

---

## Where things live

```
C:\Dev\Pocket Fertilizer\     <- the git repo root. NOT in OneDrive.
  src/        the source. EDIT HERE. 46 files.
  docs/       the built app. GitHub Pages serves from this folder.
  index.html  a redirect to docs/. Not the app.
  build.mjs   src/ -> docs/index.html, with the guard
  deploy.mjs  the pre-flight
```

- Live app: **https://bzeitel25.github.io/pocket-fertilizer/**
- Pages setting: **`main` branch, `/docs` folder**. Settings → Pages.
- `docs/index.html` is a **build artifact**. Never hand-edit it. Edit `src/` and rebuild.

---

## The seven ways this project has actually broken

### 1. A rebuild against a rolled-back `src/` destroyed a day's work
The project used to live in OneDrive, which silently reverted edited source files
mid-session. `build.mjs` then ran happily against the stale tree and overwrote
`docs/index.html` — often the only surviving copy — with an older app. No error. Nothing
looked wrong until you opened it.

**Fixed by:** moving out of OneDrive, putting `src/` under version control, and a guard
in `build.mjs` that refuses to write a file that has lost a major part of the app.
**Still true:** if you add a major new part, add its marker to `REQUIRED` in `build.mjs`.

### 2. Two sessions ran against `main` at once and forked
Both started from the same commit, neither fetched, both rebuilt the same three
features. One replaced the planting model with the canvas; the other kept building on
the grid and pushed. Git correctly refused to merge them — 10 conflict blocks, several
over a thousand lines. It cost most of a day.

**Never run two sessions against `main` at the same time.** If two must run, give each
an explicitly disjoint scope, in both prompts. `deploy.mjs` fetches first and stops if
origin has moved; that single check would have prevented the whole thing.

A contributing cause: one session pushed via the **GitHub web UI**, because the sandbox
has no push credentials. That lands commits the other session's local repo has never
seen. Do not do this. Hand the push back to Bruno instead.

### 3. A colliding BUILD stamp meant the app never updated
The in-app updater fetches the live `index.html`, greps `const BUILD`, and does a
**plain string comparison**. If the string does not change, the app tells the gardener
she is already current and never refreshes — regardless of what actually changed.

Bump `const BUILD` in `src/p16_sources_ui.js`, **once, at the end of a deploy.**
A `.13` collision already cost a throwaway commit (`7f7db85`).

The rule is *if the app changed, the stamp must change* — not *always change it*. A
pure restructure ships a byte-identical app, and bumping there just makes every phone
re-download the same file. `deploy.mjs` gets this distinction right.

### 4. Commits sat local for two days while the phone said "up to date"
The phone was right. `2026-08-02.14` genuinely was live; six commits had never reached
GitHub. **"It works locally" and "it is live" are different facts.** Check the second
one, every time:

```bash
curl -s "https://bzeitel25.github.io/pocket-fertilizer/?t=1" | grep -o 'const BUILD = "[^"]*"'
```

### 5. Moving the app to `docs/` made the site render the README
GitHub Pages was still set to serve the repo root. The root had no `index.html`, so
Jekyll rendered `README.md` and the site looked exactly like the app had been deleted.
It had not — it was in `docs/` the whole time.

**A layout change and the Pages setting are one change, not two.** There is now a
redirect at the repo root so getting this wrong degrades to a redirect instead of to an
apparently empty repository.

### 6. A stale service worker kept serving the broken page
After the server was fixed, the browser still showed the README. The app registers a
service worker at that URL scope, and it had cached the README page.

**A hard refresh (Ctrl+F5) is part of verifying a deploy.** If that is not enough:
F12 → Application → Service Workers → Unregister, then Clear site data. On a phone,
force-close the installed PWA and reopen it while online — otherwise its *offline* copy
stays broken.

### 7. CRLF vs LF made an identical file look completely different
Windows writes CRLF; the sandbox writes LF. `diff` then reports every line as changed
and the byte count differs by exactly one per line. This nearly caused a "the source
does not match the build" panic when the two were identical.

**Always normalise line endings before comparing built files:**
```bash
diff <(tr -d '\r' < a.html) <(tr -d '\r' < b.html)
```

---

## When something looks catastrophic

Three times in one day something looked like data loss and was not: a merge report
concluding the canvas work had been destroyed, a CRLF diff, and the README page. In
**every** case the work was intact and the alarming thing was a pointer — a setting, a
cache, a stale ref.

**Before acting on an alarming conclusion, verify the underlying fact yourself.**

- Reports and summaries from other sessions are *evidence*, not truth. A recovery plan
  handed to this session was wrong on two of its three main claims — it said `src/` was
  missing every canvas part (it had been rebuilt since that check) and that a ZIP
  place-name fix was absent (the app solved it another way, in `p6b_place.js`).
- Compare things by their real identifiers, not by commit messages or keyword greps. The
  question "did we lose origin's features?" was settled in one command by diffing the
  set of top-level objects in each built file.
- The safest first move is a snapshot, not a fix:
  ```bash
  git branch backup/<name> <sha>
  cp docs/index.html /tmp/backup.html
  ```

---

## Before a large piece of work

```bash
git fetch origin && git log --oneline HEAD..origin/main   # stop if this prints anything
git status                                                # commit or stash first
```

Now that `src/` is tracked, `git status` answers "do the source and the shipped app
agree?" for free. That question, left unanswerable, is what produced the false recovery
report.

Prove the repo can still rebuild itself if you are ever unsure:

```bash
git archive origin/main | tar -x -C /tmp/clonetest && cd /tmp/clonetest && node build.mjs
```

---

## Testing — do not skip

```bash
node src/smoke.mjs docs/index.html      # 541 checks
node verify_camera.mjs docs/index.html  # 26 checks
```

Both run against a headless DOM and have caught real bugs: an infinite retry loop, a
data-truncating patch, a cache flag being serialised into the gardener's encrypted
backup, and a shading check that silently ignored every sourced plant height.

**Add checks for anything new.** If a check fails, fix it or retire it deliberately and
say which — never delete a failing test quietly.

---

## Data honesty — the non-negotiable one

Every crop figure resolves to a real source URL on the publisher's own site, and the
smoke suite asserts it. Where no source states a figure, it is marked as an estimate and
the app says so — sweet corn's mature height and most ornamentals' germination
temperatures are estimates, and are labelled as such.

**Never add a figure without a URL you have actually read.** A crop the gardener adds
herself is never shown as sourced. That distinction is the reason the rest of the data
is worth anything.

---

## Still outstanding

- **Build in CI.** Today the guarantee that `docs/index.html` came from `src/` depends on
  a human remembering to build. A GitHub Action would make it structural.
- **Tag releases.** `git tag v2026-08-04.5 && git push --tags` turns "go back to what was
  live" into one command.
