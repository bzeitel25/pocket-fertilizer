<script>
/* ============================================================
   PLANT LIBRARY
   ============================================================ */
const Library = {
  q: "", filter: "all",

  render(opts){
    if(opts && opts.filter) Library.filter = opts.filter;
    const box = $("#s-library");
    let list = CROPS.slice();
    const q = Library.q.toLowerCase().trim();
    if(q) list = list.filter(c => (c.n + " " + c.id + " " + FAMILY[c.fam].n).toLowerCase().indexOf(q) >= 0);
    if(Library.filter === "now") list = list.filter(c => { const s = Season.status(c.id); return s && s.inWindow; });
    if(Library.filter === "shade") list = list.filter(c => c.sun <= 5);
    if(Library.filter === "fast") list = list.filter(c => c.dtm <= 55);
    if(Library.filter === "mine") { const own = {}; DB.all("seeds").forEach(s => own[s.crop_id] = 1);
      DB.all("plantings").forEach(p => own[p.crop_id] = 1); list = list.filter(c => own[c.id]); }

    let h = '<input type="search" id="lb-q" placeholder="Search crops, families…" value="' + esc(Library.q) + '">';
    h += '<div class="scroller" style="margin-top:10px">' +
      [["all","All " + CROPS.length],["now","Sow now"],["mine","My garden"],["fast","Under 55 days"],["shade","Shade tolerant"]]
      .map(f => '<button class="chip ' + (Library.filter === f[0] ? "on" : "") + '" onclick="Library.filter=\'' + f[0] + '\';Library.render()">' + f[1] + '</button>').join("") + '</div>';

    const byFam = {};
    list.forEach(c => (byFam[c.fam] = byFam[c.fam] || []).push(c));
    if(!list.length) h += '<div class="card center muted sm" style="margin-top:12px">Nothing matches.</div>';
    Object.keys(byFam).forEach(f => {
      h += '<div class="sec"><h2><span class="swatch" style="display:inline-block;background:' + FAMILY[f].c + '"></span> ' + esc(FAMILY[f].n) + '</h2>' +
        '<span class="tiny muted">' + byFam[f].length + '</span></div><div class="card pad0"><div class="list">';
      byFam[f].forEach(c => {
        const st = Season.status(c.id);
        h += '<button class="item" onclick="Library.open(\'' + c.id + '\')"><div class="av">' + c.e + '</div>' +
          '<div class="grow"><div class="b">' + esc(c.n) + '</div>' +
          '<div class="tiny muted">' + c.sun + 'h sun · ' + Units.waterWeek(c.water) + ' · ' + Units.len(c.sp) + ' apart · ' + c.dtm + ' days</div>' +
          (st && st.inWindow ? '<div class="tiny" style="color:var(--green-600)">' + esc(st.w.label) + ' now</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    });
    box.innerHTML = h;
    const qi = $("#lb-q");
    if(qi) qi.oninput = e => { Library.q = e.target.value; Library.render();
      setTimeout(() => { const n = $("#lb-q"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); };
  },

  open(id){
    const c = crop(id); if(!c) return;
    const cc = companionsFor(id);
    const ws = Season.windows(id);
    const own = DB.where("seeds", s => s.crop_id === id);
    const growing = DB.where("plantings", p => p.crop_id === id && p.status !== "removed");
    const fits = Season.stillFits(id);

    let h = '<div class="row" style="gap:12px;margin-bottom:12px"><div style="font-size:2.6rem">' + c.e + '</div>' +
      '<div class="grow"><div class="b" style="font-size:1.15rem">' + esc(c.n) + '</div>' +
      '<div class="tiny muted">' + esc(FAMILY[c.fam].n) + ' · rotation group</div></div></div>';

    h += '<div class="grid3">' +
      '<div class="stat"><span class="n">' + c.sun + 'h</span><span class="l">sun</span></div>' +
      '<div class="stat"><span class="n">' + Units.waterN(c.water) + Units.waterMark() + '</span><span class="l">water/wk</span></div>' +
      '<div class="stat"><span class="n">' + (function(){ const r = Maturity.cropRange(id); return r ? r.lo + '–' + r.hi : c.dtm; })() +
      '</span><span class="l">days</span></div></div>';
    const myMat = Maturity.mine(id, null);
    h += myMat
      ? '<div class="note g" style="margin-top:8px">🌱 <b>In your garden</b> this has averaged <b>' + myMat.avg + ' days</b> over ' +
        myMat.n + ' planting' + (myMat.n === 1 ? "" : "s") + (myMat.n > 1 ? ' (' + myMat.lo + '–' + myMat.hi + ')' : '') +
        '. The app uses this instead of the published figure once you have a few records.</div>'
      : '<div class="tiny muted" style="margin-top:6px">Days to maturity is a range, not a number — it swings with variety, heat and light. Record a first harvest on any planting and the app starts learning your garden\'s real timing.</div>';

    h += '<table class="mini" style="margin-top:14px">' +
      '<tr><th>Spacing</th><td>' + Units.len(c.sp) + ' apart · ' + Units.perArea(c.psf) + '</td></tr>' +
      '<tr><th>Sow depth</th><td>' + Units.len(c.depth) + '</td></tr>' +
      '<tr><th>Germination</th><td>' + c.germ[0] + '–' + c.germ[1] + ' days at ' + Units.temp(c.soilF[1]) +
        ' (range ' + Units.tempN(c.soilF[0]) + '–' + Units.temp(c.soilF[2]) + ')</td></tr>' +
      '<tr><th>Soil pH</th><td>' + esc(c.ph) + '</td></tr>' +
      '<tr><th>Feeding</th><td>' + esc(c.feeder) + ' feeder</td></tr>' +
      '<tr><th>Seed viability</th><td>~' + c.via + ' years' + (c.verified ? ' <span class="tiny" style="color:var(--green-600)">✓ checked</span>' : '') + '</td></tr>' +
      '<tr><th>Typical yield</th><td>' + (c.yield ? Units.weight(c.yield) + ' per plant' : "—") + '</td></tr>' +
      (c.succ ? '<tr><th>Succession</th><td>Re-sow every ' + c.succ + ' days</td></tr>' : '') +
      '</table>';

    if(ws.length){
      h += '<div class="sec"><h2>Your dates this year</h2></div>';
      ws.forEach(w => {
        const past = diffDays(today(), w.date) < 0;
        h += '<div class="note ' + (past ? "i" : "g") + '" style="margin-bottom:8px">' + w.icon + ' <b>' + esc(w.label) + ' — ' + fmtY(w.date) + '</b> (' + relDay(w.date) + ')<br>' + esc(w.note) + '</div>';
      });
      if(fits && !fits.fits) h += '<div class="note w">⏳ Only ' + fits.left + ' days remain before your first frost and this needs ' + fits.needs + '. A planting started today probably will not finish outdoors.</div>';
    } else {
      h += '<div class="note i" style="margin-top:14px">Set your location to see exact sowing dates for this crop.</div>';
    }

    h += '<div class="sec"><h2>Growing it well</h2></div>';
    /* escU, not esc — these sentences carry measurements inside them
       ("thin to 6–8 inches", "peppers sulk below 55°F") and a page whose
       table reads in centimetres while its advice reads in inches is worse
       than not offering the switch */
    h += '<div class="note g"><b>Tips.</b> ' + escU(c.tips) + '</div>';
    h += '<div class="note w" style="margin-top:8px"><b>Feeding.</b> ' + escU(c.npk) + '</div>';
    h += '<div class="note i" style="margin-top:8px"><b>Harvest.</b> ' + escU(c.harvest) + '</div>';

    h += '<div class="sec"><h2>Companions</h2></div><div class="card">';
    h += '<div class="tiny b muted" style="margin-bottom:6px">PLANT WITH</div><div class="row wrap" style="gap:6px">' +
      (cc.good.length ? cc.good.map(g => '<button class="chip good" onclick="Library.open(\'' + g + '\')">' + cropEmoji(g) + ' ' + esc(cropName(g)) + '</button>').join("") : '<span class="tiny muted">Nothing specific.</span>') + '</div>';
    h += '<div class="tiny b muted" style="margin:12px 0 6px">KEEP APART FROM</div><div class="row wrap" style="gap:6px">' +
      (cc.bad.length ? cc.bad.map(g => '<button class="chip bad" onclick="Library.open(\'' + g + '\')">' + cropEmoji(g) + ' ' + esc(cropName(g)) + '</button>').join("") : '<span class="tiny muted">No known conflicts.</span>') + '</div>';
    h += '</div>';

    if(own.length || growing.length){
      h += '<div class="sec"><h2>In your garden</h2></div><div class="card">';
      if(own.length) h += '<div class="sm">🌰 ' + own.length + ' packet' + (own.length>1?"s":"") + ' in your seed bank</div>';
      if(growing.length) h += '<div class="sm" style="margin-top:4px">🪴 Growing in ' +
        esc(growing.map(p => Journal.bedName(p.bed_id)).filter((v,i,a) => a.indexOf(v) === i).join(", ")) + '</div>';
      h += '</div>';
    }

    h += '<div class="sec"><h2>Check these numbers</h2></div><div class="card">';
    h += c.verified
      ? '<div class="note g"><b>Checked against a primary source.</b> Germination temperature, days to emerge, seed viability and watering for ' +
        esc(c.n) + ' were reconciled against university extension references.' +
        (c.vnote ? '<br><br>' + esc(c.vnote) : '') + '</div>'
      : '<div class="note w"><b>Not individually source-checked.</b> The figures for ' + esc(c.n) +
        ' come from general horticultural references rather than a crop-specific extension page. Treat spacing and days to maturity as approximate and follow your seed packet.</div>';
    h += '<div class="list" style="margin-top:10px">' +
      '<a class="item" href="' + esc(cropSource(id)) + '" target="_blank" rel="noopener noreferrer" style="border-radius:12px;border:1px solid var(--line)">' +
        '<div class="av">🔗</div><div class="grow"><div class="b">' + esc(cropSourceLabel(id)) + '</div>' +
        '<div class="tiny muted">Official growing guidance for ' + esc(c.n) + '</div></div><span class="go">↗</span></a>' +
      '<a class="item" href="' + esc(SOURCES.harrington.url) + '" target="_blank" rel="noopener noreferrer" style="border-radius:12px;border:1px solid var(--line);margin-top:6px">' +
        '<div class="av">🌡️</div><div class="grow"><div class="b">Germination temperatures</div>' +
        '<div class="tiny muted">Harrington table, OSU Extension</div></div><span class="go">↗</span></a>' +
      '<a class="item" href="' + esc(SOURCES.seedlife.url) + '" target="_blank" rel="noopener noreferrer" style="border-radius:12px;border:1px solid var(--line);margin-top:6px">' +
        '<div class="av">🌰</div><div class="grow"><div class="b">Seed viability</div>' +
        '<div class="tiny muted">Illinois Extension seed life table</div></div><span class="go">↗</span></a>' +
      '</div>';
    h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="closeSheet();go(\'sources\')">All sources & how to read the numbers →</button>';
    h += '</div>';

    h += '<div class="sec"><h2>Background</h2></div><div id="wiki-' + id + '" class="card"><button class="btn ghost block sm" onclick="Library.wiki(\'' + id + '\')">🌐 Look up ' + esc(c.n) + ' on Wikipedia</button></div>';

    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost grow" onclick="closeSheet();setTimeout(function(){Seeds.add({crop_id:\'' + id + '\',name:\'' + esc(c.n) + '\'})},250)">＋ Add seed</button>' +
      '<button class="btn grow" onclick="closeSheet();setTimeout(function(){Library.plantIt(\'' + id + '\')},250)">🪴 Plant it</button></div>';

    openSheet(c.n, h);
  },

  plantIt(id){
    const beds = DB.all("beds");
    if(!beds.length){ toast("Create a bed first"); return go("garden"); }
    Garden.paint = id;
    if(beds.length === 1){ Garden.open(beds[0].id); toast("Tap squares to place " + cropName(id)); return; }
    openSheet("Which bed?", '<div class="list">' + beds.map(b =>
      '<button class="item" onclick="closeSheet();Garden.open(\'' + b.id + '\');toast(\'Tap squares to place\')"><div class="av">🪴</div>' +
      '<div class="grow"><div class="b">' + esc(b.name) + '</div><div class="tiny muted">' + b.cols + '×' + b.rows + ' · ' + esc(b.sun_hours) + 'h sun</div></div>' +
      '<span class="go">›</span></button>').join("") + '</div>');
  },

  async wiki(id){
    const c = crop(id), box = $("#wiki-" + id);
    box.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Fetching from Wikipedia…</span></div>';
    try{
      const w = await Live.wiki(c.n + " plant");
      box.innerHTML = (w.thumb ? '<img class="photo" src="' + esc(w.thumb) + '" style="max-height:180px;object-fit:cover;margin-bottom:10px">' : '') +
        '<div class="b">' + esc(w.title) + '</div><p class="sm" style="margin:6px 0">' + esc(w.extract) + '</p>' +
        (w.url ? '<a class="tiny b" href="' + esc(w.url) + '" target="_blank" rel="noopener noreferrer">Read the full article ↗</a>' : '');
    }catch(e){
      box.innerHTML = '<div class="note w">Could not reach Wikipedia. Everything else in this guide works offline.</div>';
    }
  }
};

/* ============================================================
   SETTINGS
   ============================================================ */
const Settings = {
  render(){
    const box = $("#s-settings");
    const yr = today().getFullYear();
    let h = '';

    h += '<div class="sec"><h2>Location & season</h2></div><div class="card">';
    h += '<div class="row between"><div><div class="b">' + esc(DB.get("locLabel") || "Not set") + '</div>' +
      '<div class="tiny muted">Zone ' + esc(DB.get("zone") || "—") +
      (DB.get("avgLow") !== undefined ? ' · avg low ' + Units.temp(DB.get("avgLow")) : '') + '</div></div>' +
      '<button class="btn sm" onclick="Onboard.open()">Change</button></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Last spring frost</label><input type="date" id="st-lf" value="' + esc(Season.lastFrostISO || "") + '"></div>' +
      '<div><label class="f">First fall frost</label><input type="date" id="st-ff" value="' + esc(Season.firstFrostISO || "") + '"></div></div>';
    h += '<div class="tiny muted" style="margin-top:6px">Source: ' + esc(DB.get("frostSrc") || "not set") + '. Override if you know your microclimate better than the average does.</div>';
    h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="Settings.saveFrost()">Save frost dates</button></div>';

    h += '<div class="sec"><h2>Security</h2></div><div class="card">';
    h += '<div class="note g"><b>Everything is encrypted on this device.</b> Your garden database is sealed with AES-256-GCM before it is written to storage. Keys never leave the device and nothing is uploaded to any server.</div>';
    h += '<table class="mini" style="margin-top:10px">' +
      '<tr><th>Encryption</th><td>AES-256-GCM (WebCrypto)</td></tr>' +
      '<tr><th>Key protection</th><td>' + (Vault.mode === "pass" ? "Passphrase (PBKDF2-SHA256, " + Crypto.ITER.toLocaleString() + " iterations)" : "Device key") + '</td></tr>' +
      '<tr><th>Database</th><td>SQLite ' + (DB.engine === "sqlite" ? "(WASM, active)" : "(offline — JSON vault)") + '</td></tr>' +
      '<tr><th>Storage</th><td>' + esc(DB.backend) + '</td></tr>' +
      '<tr><th>Photos stored</th><td>' + DB.count("photos") + ' (' + Math.round(Photos.bytes()/1024) + ' KB)</td></tr>' +
      '</table>';
    if(Vault.mode === "pass"){
      h += '<button class="btn ghost block" style="margin-top:10px" onclick="Settings.removePass()">Remove passphrase</button>' +
           '<button class="btn ghost block" style="margin-top:8px" onclick="location.reload()">🔒 Lock now</button>';
    } else {
      h += '<div class="note w" style="margin-top:10px">Without a passphrase, anyone who can unlock this device can open your garden data. Set one for real at-rest protection.</div>' +
           '<button class="btn block" style="margin-top:8px" onclick="Settings.setPass()">Set a passphrase</button>';
    }
    h += '</div>';

    h += '<div class="sec"><h2>Gardening assistant</h2></div><div class="card">';
    h += '<div class="row between"><div class="grow"><div class="b">' + esc(Assist.providerName()) + '</div>' +
      '<div class="tiny muted">' + (Assist.ready() ? "Connected · " + esc(Assist.modelName()) : "Not connected") + '</div></div>' +
      '<button class="btn sm" onclick="Assist.setup()">' + (Assist.ready() ? "Change" : "Connect") + '</button></div>';
    h += '<div class="tiny muted" style="margin-top:8px">Powers the \u2728 Ask tab \u2014 voice and text commands, questions about your own data, and web search.</div></div>';

    h += '<div class="sec"><h2>Plant Doctor AI (optional)</h2></div><div class="card">';
    h += '<div class="tiny muted" style="margin-bottom:8px">Everything works without this. Adding a Claude API key turns on photo reading for seed packets and AI vision in the Plant Doctor.</div>';
    h += '<div class="field"><label class="f">Claude API key</label><input type="password" id="st-key" value="' + esc(DB.get("aiKey") || "") + '" placeholder="sk-ant-…"></div>';
    h += '<div class="field"><label class="f">Model</label><input type="text" id="st-model" value="' + esc(DB.get("aiModel","claude-sonnet-5")) + '"></div>';
    h += '<div class="note w" style="margin-top:10px">The key is stored inside your encrypted vault, but any key used from a browser is inherently more exposed than one on a server. Use a key with a low spend cap, and delete it here when you are done.</div>';
    h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="Settings.saveKey()">Save key</button></div>';

    h += '<div class="sec"><h2>Appearance</h2></div><div class="card">' +
      '<div class="row between"><div class="b">Dark mode</div>' +
      '<button class="switch ' + (document.documentElement.dataset.theme === "dark" ? "on" : "") + '" onclick="toggleTheme();Settings.render()"></button></div></div>';

    h += '<div class="sec"><h2>Your data</h2></div><div class="card">';
    h += '<div class="grid2"><button class="btn ghost sm" onclick="Settings.exportJSON()">⬇︎ Backup (.json)</button>' +
      '<button class="btn ghost sm" onclick="Settings.exportSqlite()">⬇︎ Database (.sqlite)</button></div>';
    h += '<div class="grid2" style="margin-top:8px"><button class="btn ghost sm" onclick="Settings.importJSON()">⬆︎ Restore backup</button>' +
      '<button class="btn ghost sm" onclick="go(\'sql\')">🗄️ SQL console</button></div>';
    h += '<div class="tiny muted" style="margin-top:10px">The .json backup is decrypted plain text — store it somewhere safe. The .sqlite file opens in any SQLite tool, DB Browser, Python, Excel via ODBC.</div>';
    h += '</div>';

    h += '<div class="sec"><h2>App version</h2></div><div class="card">' +
      '<div class="row between"><div><div class="b">Build ' + esc(BUILD) + '</div>' +
      '<div class="tiny muted">' + (Updater.installed ? "Installed to home screen" : "Running in browser") + '</div></div>' +
      '<button class="btn sm" onclick="go(\'sources\')">Sources</button></div>' +
      '<button class="btn block" style="margin-top:10px" onclick="Updater.go()">' + Updater.label() + '</button>' +
      '<div id="upd-status" style="margin-top:10px"></div></div>';

    h += '<div class="sec"><h2>Demo & reset</h2></div><div class="card">' +
      '<button class="btn ghost block sm" onclick="Settings.demo()">🌱 Load a demo garden</button>' +
      '<button class="btn danger block" style="margin-top:8px" onclick="Settings.wipe()">Erase everything</button></div>';

    h += '<div class="card" style="margin-top:16px"><div class="tiny muted center">Pocket Fertilizer · prototype build<br>' +
      CROPS.length + ' crops · ' + CONDITIONS.length + ' diagnoses · offline-first<br>' +
      'Assistant: Google Gemini · Voice: Web Speech API<br>' +
      'Live data: Open-Meteo, USDA PHZM, Wikipedia</div></div>';

    box.innerHTML = h;
  },

  saveFrost(){
    const lf = $("#st-lf").value, ff = $("#st-ff").value;
    if(lf) DB.set("lastFrost", lf.slice(5));
    if(ff) DB.set("firstFrost", ff.slice(5));
    DB.set("frostSrc", "manually set");
    Cal.rebuild(); Settings.render(); toast("Frost dates saved");
  },
  saveKey(){
    /* The live settings screen (p12b) renders only #st-key. Reading #st-model
       unguarded threw on null, so the key was never saved and every AI button
       stayed hidden — with no error the gardener could see. */
    const keyEl = $("#st-key"); if(!keyEl) return;
    const k = keyEl.value.trim();
    DB.set("aiKey", k);
    const modelEl = $("#st-model");
    const m = modelEl ? modelEl.value.trim() : "";
    if(m){ DB.set("aiModel", m); DB.set("claudeModel", m); }
    else if(!DB.get("claudeModel")) DB.set("claudeModel", PROVIDERS.claude.def);
    /* a key pasted here is an Anthropic key — point the app at that provider
       so the packet reader and Plant Doctor actually use it */
    if(k) DB.set("aiProvider", "claude");
    toast(k ? "AI features enabled" : "Key removed"); Settings.render();
  },

  setPass(){
    openSheet("Set a passphrase",
      '<p class="muted sm" style="margin-top:0">Your encryption key gets wrapped with this passphrase. It is never stored and never transmitted — which also means <b>nobody can recover it for you</b>. Write it down.</p>' +
      '<div class="field"><label class="f">Passphrase</label><input type="password" id="pw1" placeholder="At least 8 characters"></div>' +
      '<div class="field"><label class="f">Confirm</label><input type="password" id="pw2"></div>' +
      '<div class="note w" style="margin-top:12px">Forget it and the data is gone for good. Export a backup first if you want a safety net.</div>' +
      '<button class="btn block" style="margin-top:12px" id="pw-go">Encrypt with this passphrase</button>');
    $("#pw-go").onclick = async () => {
      const a = $("#pw1").value, b = $("#pw2").value;
      if(a.length < 8) return toast("At least 8 characters");
      if(a !== b) return toast("They don't match");
      await Vault.setPassphrase(a);
      await DB.persist();
      closeSheet(); Settings.render(); toast("🔒 Passphrase set");
    };
  },
  removePass(){
    confirmSheet("Remove the passphrase?", "Your data stays encrypted, but the key will be stored on this device so anyone who can open the app can read it.", "Remove", async () => {
      await Vault.removePassphrase(); await DB.persist(); Settings.render(); toast("Passphrase removed");
    }, true);
  },

  exportJSON(){ download("pocket-fertilizer-backup-" + iso(today()) + ".json", new Blob([DB.exportJSON()], { type:"application/json" })); },
  exportSqlite(){
    const bytes = DB.exportSqlite();
    if(!bytes) return toast("SQL engine unavailable offline — use the .json backup");
    download("pocket-fertilizer-" + iso(today()) + ".sqlite", new Blob([bytes], { type:"application/octet-stream" }));
  },
  importJSON(){
    const inp = $("#filepick-json"); inp.value = "";
    inp.onchange = () => {
      const f = inp.files[0]; if(!f) return;
      const fr = new FileReader();
      fr.onload = () => confirmSheet("Restore this backup?", "Everything currently in the app is replaced.", "Restore", async () => {
        try{ await DB.importJSON(fr.result); Cal.rebuild(); go("home"); toast("Backup restored"); }
        catch(e){ toast("That file could not be read"); }
      }, true);
      fr.readAsText(f);
    };
    inp.click();
  },

  wipe(){
    confirmSheet("Erase everything?", "Every bed, seed, harvest, photo and diagnosis is permanently deleted from this device.", "Erase it all", async () => {
      await DB.wipeAll(); Vault.wipe();
      localStorage.removeItem("pf.theme");
      await Blobs.del("vault");
      location.reload();
    }, true);
  },

  demo(){
    confirmSheet("Load the demo garden?", "Adds two beds, a handful of seed packets and some harvest history so you can see how it all fits together. Your own data is not touched.", "Load it", () => {
      if(!DB.get("zone")){ DB.set("zone","6b"); DB.set("lastFrost","04-25"); DB.set("firstFrost","10-17");
        DB.set("locLabel","Demo garden (zone 6b)"); DB.set("frostSrc","demo defaults"); }
      const plot = DB.insert("plots", { name:"Back yard" });
      const b1 = DB.insert("beds", { plot_id: plot.id, name:"Raised bed 1", cols:4, rows:8, cell_in:12, sun_hours:8, soil:"raised mix", irrigation:"drip" });
      const b2 = DB.insert("beds", { plot_id: plot.id, name:"Shady side bed", cols:3, rows:6, cell_in:12, sun_hours:4, soil:"loam", irrigation:"hand water" });
      const put = (bed, x, y, id) => Garden.place(bed, x, y, id, true);
      [["tomato",0,0],["tomato",0,1],["basil",1,0],["basil",1,1],["marigold",2,0],["pepper",2,1],
       ["bushbean",3,0],["bushbean",3,1],["carrot",0,2],["onion",1,2],["lettuce",2,2],["radish",3,2]]
        .forEach(t => put(b1, t[1], t[2], t[0]));
      [["kale",0,0],["lettuce",1,0],["spinach",2,0],["chard",0,1],["mint",1,1],["parsley",2,1]]
        .forEach(t => put(b2, t[1], t[2], t[0]));
      [["Cherry Tomato","tomato","Sungold","Johnny's",2025,4.25],
       ["Genovese Basil","basil","Genovese","Baker Creek",2024,2.95],
       ["Provider Bush Bean","bushbean","Provider","Fedco",2023,3.5],
       ["Danvers Carrot","carrot","Danvers 126","Seed Savers",2021,3.0],
       ["Bloomsdale Spinach","spinach","Long Standing","Botanical",2025,2.75],
       ["Lacinato Kale","kale","Toscano","Baker Creek",2024,3.25]]
        .forEach(s => DB.insert("seeds", { name:s[0], crop_id:s[1], variety:s[2], brand:s[3], packed_year:s[4], cost:s[5], qty:50, unit:"seeds", germ_rate:85 }));
      const yr = today().getFullYear();
      [["tomato",3.2,8.5,-20],["tomato",2.4,6.4,-12],["bushbean",1.1,3.3,-16],["lettuce",0.8,2.5,-30],
       ["kale",1.4,4.2,-9],["radish",0.5,1.5,-40],["carrot",2.0,4.0,-5]]
        .forEach(x => DB.insert("harvests", { date: iso(addDays(today(), x[3])), crop_id:x[0], bed_id:b1.id,
          weight:x[1], unit:"lbs", value:x[2] }));
      [["water",1.0,-3],["water",0.8,-10],["feed",1,-14],["weed",null,-6]]
        .forEach(x => DB.insert("journal", { date: iso(addDays(today(), x[2])), type:x[0], bed_id:b1.id,
          amount:x[1], unit:x[0]==="water"?"inches":"cups", cost:x[0]==="feed"?12.99:null, minutes:25,
          product:x[0]==="feed"?"Fish emulsion 5-1-1":null }));
      Cal.rebuild(); go("home"); toast("Demo garden loaded 🌱");
    });
  }
};

/* ============================================================
   SQL CONSOLE
   ============================================================ */
const SqlView = {
  render(){
    const box = $("#s-sql");
    const samples = [
      ["Seed packets by age", "SELECT name, variety, brand, packed_year,\n  (" + today().getFullYear() + " - CAST(packed_year AS INT)) AS age_years\nFROM seeds ORDER BY age_years DESC;"],
      ["Harvest totals by crop", "SELECT crop_id, ROUND(SUM(CAST(weight AS REAL)),2) AS lbs,\n  ROUND(SUM(CAST(value AS REAL)),2) AS value, COUNT(*) AS pickings\nFROM harvests GROUP BY crop_id ORDER BY lbs DESC;"],
      ["What is planted where", "SELECT b.name AS bed, p.crop_id, p.variety, p.qty, p.sown_on\nFROM plantings p JOIN beds b ON b.id = p.bed_id\nWHERE p.status != 'removed' ORDER BY b.name;"],
      ["Spend by category", "SELECT type, ROUND(SUM(CAST(cost AS REAL)),2) AS spent\nFROM journal WHERE cost IS NOT NULL GROUP BY type ORDER BY spent DESC;"],
      ["Diagnoses this year", "SELECT date, crop_id, result, confidence FROM diagnoses ORDER BY date DESC;"]
    ];
    let h = '';
    if(DB.engine !== "sqlite"){
      h += '<div class="note w">The SQLite engine loads from a CDN on first run and is not available right now (offline, or blocked). Your data is safe and fully readable — the app keeps its own encrypted copy — but queries need the engine. Reconnect and reopen the app.</div>';
    } else {
      h += '<div class="note g">Live SQLite database, rebuilt from your encrypted vault at launch. Reads and writes both work; changes made here are saved back.</div>';
    }
    h += '<div class="card" style="margin-top:12px"><label class="f">Query</label>' +
      '<textarea id="sq-q" style="font-family:ui-monospace,monospace;min-height:110px" spellcheck="false">SELECT name, variety, packed_year FROM seeds ORDER BY name;</textarea>' +
      '<button class="btn block" style="margin-top:10px" onclick="SqlView.run()">▶ Run query</button></div>';
    h += '<div class="sec"><h2>Examples</h2></div><div class="scroller">' +
      samples.map((s, i) => '<button class="chip" onclick="SqlView.sample(' + i + ')">' + esc(s[0]) + '</button>').join("") + '</div>';
    h += '<div id="sq-out" style="margin-top:12px"></div>';
    h += '<div class="sec"><h2>Schema</h2></div><div class="card"><table class="mini">' +
      Object.keys(SCHEMA).map(t => '<tr><td class="b">' + t + '</td><td class="tiny muted">' + SCHEMA[t].join(", ") + '</td></tr>').join("") +
      '</table></div>';
    box.innerHTML = h;
    SqlView._samples = samples;
  },
  sample(i){ $("#sq-q").value = SqlView._samples[i][1]; SqlView.run(); },
  run(){
    const q = $("#sq-q").value.trim(); const out = $("#sq-out");
    if(!q) return;
    try{
      const res = DB.query(q);
      DB.save();
      if(!res.length){ out.innerHTML = '<div class="note g">Statement ran. No rows returned.</div>'; return; }
      let h = "";
      res.forEach(r => {
        h += '<div class="card pad0" style="margin-bottom:12px;overflow:auto"><table class="mini" style="min-width:100%">' +
          '<tr>' + r.cols.map(c => '<th>' + esc(c) + '</th>').join("") + '</tr>' +
          r.rows.slice(0, 200).map(row => '<tr>' + row.map(v => '<td>' + esc(v === null ? "—" : v) + '</td>').join("") + '</tr>').join("") +
          '</table></div>';
        if(r.rows.length > 200) h += '<div class="tiny muted">Showing first 200 of ' + r.rows.length + ' rows.</div>';
      });
      out.innerHTML = h;
    }catch(e){
      out.innerHTML = '<div class="note d"><b>Query error.</b><br>' + esc(e.message || String(e)) + '</div>';
    }
  }
};
</script>
