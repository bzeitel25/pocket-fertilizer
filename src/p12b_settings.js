<script>
/* ============================================================
   SETTINGS — plain language on the surface, detail on request

   Everything a gardener actually needs sits at the top in ordinary
   words. Anything technical lives behind an ⓘ, and the machinery
   she will probably never touch is folded into Advanced, closed
   by default.
   ============================================================ */
const INFO = {
  location: { t:"Your location",
    b:"The app uses your ZIP to look up your growing zone and the dates frost usually arrives and leaves. Those two dates drive every planting date it suggests.",
    tech:"Zone comes from phzmapi.org (USDA Plant Hardiness Zone Map). Frost dates are calculated from ten years of daily minimum temperatures at your coordinates via the Open-Meteo historical archive, taking the median first and last day at or below 32°F. Falls back to a zone-average table if the archive is unreachable. Coordinates are stored locally and sent only with those read-only lookups." },
  frost: { t:"Frost dates",
    b:"The app's best guess at when frost ends in spring and returns in autumn, worked out from ten years of local weather. Change them if you know your garden runs warmer or colder.",
    tech:"Stored as MM-DD and applied to the current year, rolling forward to next year once a window has passed. Sowing windows are computed as week offsets from these two anchors per crop. Editing them here sets the source to 'manually set' and rebuilds the calendar." },
  assistant: { t:"The assistant",
    b:"Lets you ask the app questions out loud or by typing — “what should I plant this week”, “add tomatoes to plot A” — and it does the work for you. It needs a free key from Google or Anthropic to think.",
    tech:"Runs against Google Gemini or Anthropic Claude with function calling. Tools cover planting, seed bank, harvests, weather, the crop database, and a read-only SELECT against the local SQLite. No delete tools are exposed; the only undo it has is for seed packets it created in the same conversation. Web search results are passed as reference material flagged as untrusted." },
  passphrase: { t:"App passphrase",
    b:"Adds a password to open the app. Without one, anyone who picks up this phone can read your garden notes. Worth setting if the phone is shared.\n\nIf you forget it, the notes cannot be recovered by anyone — not by us, not by Google. Save a backup first.",
    tech:"Data is always encrypted with AES-256-GCM. Without a passphrase the data key sits in local storage on the device. Setting one wraps that key with a key derived by PBKDF2-SHA256 at 310,000 iterations; the passphrase itself is never stored or transmitted, so there is no recovery path. The app auto-locks after ten minutes in the background." },
  backup: { t:"Backups",
    b:"Saves everything — beds, seeds, harvests, photos, notes — into one file you can keep somewhere safe or move to a new phone.",
    tech:"The .json backup is decrypted plain text: readable by anything, so store it somewhere private. The .sqlite export is the same data as a real database file that opens in DB Browser, Python or R. Restoring replaces the current contents entirely." },
  database: { t:"The database",
    b:"Your garden is stored in a proper database on this phone, not in the cloud. This lets you look at it directly if you ever want to.",
    tech:"SQLite compiled to WebAssembly (sql.js), eleven tables, rebuilt at launch from the encrypted vault and kept in sync on writes. The console runs arbitrary SQL against it. Export produces a genuine .sqlite file." },
  doctorAI: { t:"Reading photos with AI",
    b:"Optional. Photograph a seed packet and the app reads it and fills in the crop, variety, brand, dates and planting notes for you — you check them and correct anything before saving. It also adds a second opinion on plant problems from a photo. Everything in the Plant Doctor works without it.",
    tech:"Uses whichever provider the assistant is connected to — Google Gemini or Anthropic Claude — with a vision model. Sends only the photo you capture plus, for a diagnosis, the symptoms you ticked. Packet reading asks for strict JSON and every value is coerced and range-checked before it reaches a field, so an unreadable value leaves the field blank rather than silently failing. The rules-based diagnosis runs entirely on-device and is unaffected." },
  reminders: { t:"Daily reminders",
    b:"A morning nudge with anything due — sowing, harvesting, watering, a frost warning — and a gardening tip when there is nothing pressing.\n\nThey come from the app on this phone, so they arrive while it is open or recently used, and there is always a catch-up the moment you open it.",
    tech:"Uses the Notifications API via the service worker registration where available, falling back to the page-level Notification constructor. No push server and no subscription, so nothing is sent to or stored on any server, and delivery when the app is fully closed is not guaranteed by the browser. The daily timer is re-armed on each launch; a catch-up fires on open if none has been shown that day." },
  storage: { t:"Where things are kept",
    b:"Everything lives on this phone. Nothing is uploaded, there is no account, and no one else can see it.",
    tech:"IndexedDB where available, falling back to localStorage (about 5MB). Photos are downscaled to 900px. The only outbound requests are weather, zone and Wikipedia lookups, plus the assistant if you connect it." }
};

function infoBtn(key){
  return '<button class="ibtn" onclick="Settings.info(\'' + key + '\')" aria-label="More about this">i</button>';
}

Settings.info = function(key){
  const i = INFO[key]; if(!i) return;
  openSheet(i.t,
    '<p class="sm" style="margin-top:0;white-space:pre-line">' + esc(i.b) + '</p>' +
    '<details style="margin-top:14px"><summary class="sm b" style="cursor:pointer;color:var(--text-2)">Technical detail</summary>' +
    '<p class="tiny muted" style="margin-top:8px;line-height:1.6">' + esc(i.tech) + '</p></details>' +
    '<button class="btn block ghost" style="margin-top:16px" onclick="closeSheet()">Got it</button>');
};

Settings.advOpen = false;
Settings.toggleAdv = function(){ Settings.advOpen = !Settings.advOpen; Settings.render(); };

Settings.render = function(){
  const box = $("#s-settings");
  const zone = DB.get("zone"), lf = Season.lastFrostISO, ff = Season.firstFrostISO;
  let h = "";

  /* ---------- everyday ---------- */
  h += '<div class="sec"><h2>Your garden</h2></div><div class="card">';
  h += '<div class="row between"><div class="grow"><div class="row" style="gap:6px"><div class="b">Where you garden</div>' + infoBtn("location") + '</div>' +
    '<div class="tiny muted">' + esc(DB.get("locLabel") || "Not set yet") + '</div></div>' +
    '<button class="btn sm" onclick="Onboard.open()">' + (zone ? "Change" : "Set") + '</button></div>';
  if(zone) h += '<div class="note g" style="margin-top:10px">Growing zone <b>' + esc(zone) + '</b>' +
    (lf && ff ? '<br>Frost usually ends around <b>' + fmt(lf) + '</b> and returns around <b>' + fmt(ff) + '</b>.' : '') +
    '<br><span class="tiny">Everything the app suggests is worked out from these.</span></div>';
  h += '</div>';

  h += '<div class="sec"><h2>The assistant</h2></div><div class="card">';
  h += '<div class="row between"><div class="grow"><div class="row" style="gap:6px"><div class="b">Ask questions, get things done</div>' + infoBtn("assistant") + '</div>' +
    '<div class="tiny muted">' + (Assist.ready() ? "On · using " + esc(Assist.providerName()) : "Off — tap Connect to switch it on") + '</div></div>' +
    '<button class="btn sm" onclick="Assist.setup()">' + (Assist.ready() ? "Change" : "Connect") + '</button></div>';
  h += '<div class="tiny muted" style="margin-top:8px">Free to set up. Talk to it from the ✨ Ask tab.</div></div>';

  h += '<div class="sec"><h2>Help</h2></div><div class="card">' +
    '<div class="row between"><div class="grow"><div class="b">How to use this app</div>' +
    '<div class="tiny muted">A short guide to everything it does</div></div>' +
    '<button class="btn sm" onclick="go(\'help\')">Open</button></div>' +
    '<button class="btn ghost block sm" style="margin-top:10px" onclick="Help.download()">⬇︎ Save the guide as a text file</button></div>';

  h += '<div class="sec"><h2>Reminders</h2></div><div class="card">' +
    '<div class="row between"><div class="grow"><div class="row" style="gap:6px"><div class="b">Daily reminders and tips</div>' + infoBtn("reminders") + '</div>' +
    '<div class="tiny muted">' + (Notify.on ? "On · around " + (Notify.hour > 12 ? (Notify.hour-12) + "pm" : Notify.hour + "am") : "Off") + '</div></div>' +
    '<button class="btn sm" onclick="Notify.sheet()">' + (Notify.on ? "Change" : "Turn on") + '</button></div></div>';

  h += '<div class="sec"><h2>Look and feel</h2></div><div class="card">' +
    '<div class="row between"><div class="b">Dark mode</div>' +
    '<button class="switch ' + (document.documentElement.dataset.theme === "dark" ? "on" : "") + '" onclick="toggleTheme();Settings.render()"></button></div></div>';

  h += '<div class="sec"><h2>Keep your notes safe</h2></div><div class="card">';
  h += '<div class="row between"><div class="grow"><div class="row" style="gap:6px"><div class="b">Save a backup</div>' + infoBtn("backup") + '</div>' +
    '<div class="tiny muted">One file with everything in it</div></div>' +
    '<button class="btn sm" onclick="Settings.exportJSON()">Save</button></div>';
  h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="Settings.importJSON()">Restore from a backup</button>';
  h += '<div class="row between" style="margin-top:14px"><div class="grow"><div class="row" style="gap:6px"><div class="b">Lock with a passphrase</div>' + infoBtn("passphrase") + '</div>' +
    '<div class="tiny muted">' + (Vault.mode === "pass" ? "On — the app asks for it when you open it" : "Off — anyone with this phone can open the app") + '</div></div>' +
    '<button class="btn sm ' + (Vault.mode === "pass" ? "ghost" : "") + '" onclick="' + (Vault.mode === "pass" ? "Settings.removePass()" : "Settings.setPass()") + '">' +
    (Vault.mode === "pass" ? "Remove" : "Set up") + '</button></div>';
  if(Vault.mode === "pass") h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="location.reload()">🔒 Lock the app now</button>';
  h += '<div class="note g" style="margin-top:12px">🔒 Your garden notes are stored only on this phone, and always scrambled so they cannot be read off it. Nothing is uploaded anywhere. ' + infoBtn("storage") + '</div>';
  h += '</div>';

  h += '<div class="sec"><h2>App</h2></div><div class="card">' +
    '<div class="row between"><div><div class="b">Version ' + esc(BUILD) + '</div>' +
    '<div class="tiny muted">' + (Updater.installed ? "Installed to your home screen" : "Running in the browser") + '</div></div>' +
    '<button class="btn sm ghost" onclick="go(\'sources\')">Where advice comes from</button></div>' +
    '<button class="btn block" style="margin-top:10px" onclick="Updater.go()">' + Updater.label() + '</button>' +
    '<div id="upd-status" style="margin-top:10px"></div></div>';

  /* ---------- advanced ---------- */
  h += '<div class="sec" style="margin-top:24px"><h2>&nbsp;</h2></div>';
  h += '<button class="card" style="width:100%;text-align:left" onclick="Settings.toggleAdv()">' +
    '<div class="row between"><div><div class="b">Advanced settings</div>' +
    '<div class="tiny muted">Frost dates, the database, AI photo diagnosis, demo data</div></div>' +
    '<div style="font-size:1.2rem;color:var(--text-3)">' + (Settings.advOpen ? "⌄" : "›") + '</div></div></button>';

  if(Settings.advOpen){
    h += '<div class="card" style="margin-top:12px">' +
      '<div class="row" style="gap:6px"><div class="b">Frost dates</div>' + infoBtn("frost") + '</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">Source: ' + esc(DB.get("frostSrc") || "not set") + '</div>' +
      '<div class="grid2">' +
      '<div><label class="f">Last spring frost</label><input type="date" id="st-lf" value="' + esc(lf || "") + '"></div>' +
      '<div><label class="f">First fall frost</label><input type="date" id="st-ff" value="' + esc(ff || "") + '"></div></div>' +
      '<button class="btn ghost block sm" style="margin-top:10px" onclick="Settings.saveFrost()">Save frost dates</button></div>';

    h += '<div class="card" style="margin-top:12px">' +
      '<div class="row" style="gap:6px"><div class="b">Reading photos with AI</div>' + infoBtn("doctorAI") + '</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">' + (Vision.ready()
        ? "On — using " + esc(Vision.who()) + ". Seed packets fill themselves in from a photo, and the Plant Doctor can give a second opinion."
        : "Off. Photographing a seed packet will not fill in the fields until an assistant key is connected. Everything else works without it.") + '</div>' +
      '<button class="btn ' + (Vision.ready() ? "ghost " : "") + 'block sm" onclick="Assist.setup()">' +
        (Vision.ready() ? "Change provider or key" : "Connect an AI key") + '</button>' +
      '<div class="tiny muted" style="margin-top:8px">This uses the same key as the ✨ Ask tab — Gemini or Claude, whichever you connected.</div></div>';

    h += '<div class="card" style="margin-top:12px">' +
      '<div class="row" style="gap:6px"><div class="b">The database</div>' + infoBtn("database") + '</div>' +
      '<table class="mini" style="margin-top:8px">' +
      '<tr><th>Engine</th><td>SQLite ' + (DB.engine === "sqlite" ? "(active)" : "(offline — using the encrypted copy)") + '</td></tr>' +
      '<tr><th>Stored in</th><td>' + esc(DB.backend) + '</td></tr>' +
      '<tr><th>Encryption</th><td>AES-256-GCM</td></tr>' +
      '<tr><th>Key protection</th><td>' + (Vault.mode === "pass" ? "Passphrase (PBKDF2, " + Crypto.ITER.toLocaleString() + " rounds)" : "Device key") + '</td></tr>' +
      '<tr><th>Photos</th><td>' + DB.count("photos") + ' (' + Math.round(Photos.bytes()/1024) + ' KB)</td></tr>' +
      '</table>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn ghost sm" onclick="Settings.exportSqlite()">⬇︎ .sqlite file</button>' +
      '<button class="btn ghost sm" onclick="go(\'sql\')">🗄️ SQL console</button></div></div>';

    h += '<div class="card" style="margin-top:12px"><div class="b">Try it out</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">Fills the app with a sample garden so you can see how it works. Your own data is left alone.</div>' +
      '<button class="btn ghost block sm" onclick="Settings.demo()">🌱 Load a demo garden</button></div>';

    h += '<div class="card" style="margin-top:12px"><div class="b" style="color:var(--danger)">Erase everything</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">Permanently deletes every bed, seed, harvest, photo and note on this phone. Save a backup first.</div>' +
      '<button class="btn danger block" onclick="Settings.wipe()">Erase everything</button></div>';

    h += '<div class="card" style="margin-top:12px"><div class="tiny muted center">' +
      CROPS.length + ' crops · ' + CONDITIONS.length + ' diagnoses · ' + VARIETY_REF.length + ' varieties<br>' +
      'Works offline · encrypted on this device<br>' +
      'Live data: Open-Meteo, USDA, Wikipedia</div></div>';
  }

  box.innerHTML = h;
};
</script>
