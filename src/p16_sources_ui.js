<script>
/* ============================================================
   BUILD / INSTALL / SELF-UPDATE
   ============================================================ */
const BUILD = "2026-08-07.4";

const Updater = {
  prompt: null, installed: false,

  init(){
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault(); Updater.prompt = e;
      if(APP.tab === "sources" || APP.tab === "settings") render(APP.tab);
    });
    window.addEventListener("appinstalled", () => {
      Updater.prompt = null; Updater.installed = true; toast("Installed 🌱");
    });
    Updater.installed = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  },

  label(){
    if(Updater.prompt) return "📲 Install on this phone";
    return Updater.installed ? "↻ Check for updates" : "↻ Check for updates";
  },

  async go(){
    if(Updater.prompt){
      const p = Updater.prompt; Updater.prompt = null;
      try{ p.prompt(); const r = await p.userChoice;
        toast(r.outcome === "accepted" ? "Installing…" : "Install dismissed");
      }catch(e){ toast("Install unavailable here"); }
      render(APP.tab); return;
    }
    Updater.update();
  },

  /* fetch the live copy, compare build stamps, then hard-refresh if newer */
  async update(){
    const el = $("#upd-status");
    const say = (t, cls) => { if(el) el.innerHTML = '<div class="note ' + (cls || "i") + '">' + t + '</div>'; else toast(t.replace(/<[^>]+>/g, "")); };
    if(location.protocol.indexOf("http") !== 0){
      return say("Updates only work when the app is opened from its web address, not from a local file.", "w");
    }
    say('<span class="spinner"></span> Checking for a newer version…');
    let latest = null;
    try{
      const r = await fetch("index.html?ts=" + Date.now(), { cache:"no-store" });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const txt = await r.text();
      const m = txt.match(/const BUILD = "([^"]+)"/);
      latest = m ? m[1] : null;
    }catch(e){
      return say("Could not reach the server. You are offline, or the connection dropped — the app keeps working either way.", "w");
    }
    if(latest && latest === BUILD){
      /* still refresh the service worker quietly so assets stay current */
      try{ const reg = await navigator.serviceWorker.getRegistration(); if(reg) reg.update(); }catch(e){}
      return say("✅ You are on the latest version (" + esc(BUILD) + ").", "g");
    }
    say('<span class="spinner"></span> New version ' + esc(latest || "") + ' found — installing…', "g");
    await Updater.hardRefresh();
  },

  async hardRefresh(){
    try{ await DB.flush(); }catch(e){}
    try{
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg){ await reg.update(); if(reg.waiting) reg.waiting.postMessage({ type:"SKIP_WAITING" }); }
    }catch(e){}
    try{
      if(window.caches){ const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
    }catch(e){}
    setTimeout(() => location.replace(location.pathname + "?u=" + Date.now()), 600);
  }
};

/* ============================================================
   SOURCES & ACCURACY SCREEN
   ============================================================ */
const Sources = {
  render(){
    const box = $("#s-sources");
    const verified = CROPS.filter(c => c.verified).length;
    let h = "";

    h += '<div class="card"><div class="row" style="gap:10px"><div style="font-size:1.8rem">📚</div>' +
      '<div class="grow"><div class="b">Where this advice comes from</div>' +
      '<div class="tiny muted">University extension services and USDA — the same sources Master Gardener programmes train from.</div></div></div></div>';

    h += '<div class="sec"><h2>How to read the numbers</h2></div><div class="card">';
    h += '<div class="note g"><b>Checked against a primary source.</b> Germination soil temperatures, days to emergence, seed viability, watering and pH were reconciled crop by crop against the references below. ' +
      verified + ' of ' + CROPS.length + ' crops carry corrected values.</div>';
    h += '<div class="note w" style="margin-top:8px"><b>Days to maturity is a guide, not a fact.</b> It swings 30 days or more between varieties of the same crop. Always trust the seed packet over the figure shown here.</div>';
    h += '<div class="note w" style="margin-top:8px"><b>Spacing and sowing dates are regional.</b> Extension guidance differs between states because the climate does. The dates in this app are calculated from your own frost dates, which is the best available approximation — your local extension office will always beat it.</div>';
    h += '<div class="note i" style="margin-top:8px"><b>Companion planting is mixed evidence.</b> Some pairings are well documented — trap crops, the Three Sisters, marigolds against root-knot nematodes as a dense planting. Others are traditional. The conflicts this app flags lean on the defensible cases: shared pests, shared disease, allelopathy and competition.</div>';
    h += '</div>';

    h += '<div class="sec"><h2>Primary references</h2></div><div class="card pad0"><div class="list">';
    Object.keys(SOURCES).forEach(k => {
      const s = SOURCES[k];
      h += '<a class="item" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="av">🔗</div><div class="grow"><div class="b">' + esc(s.n) + '</div>' +
        '<div class="tiny muted">' + esc(s.org) + '</div>' +
        '<div class="tiny muted" style="margin-top:3px">' + esc(s.what) + '</div></div>' +
        '<span class="go">↗</span></a>';
    });
    h += '</div></div>';

    h += '<div class="sec"><h2>Field by field</h2></div><div class="card"><table class="mini">' +
      '<tr><th>Value</th><th>Source</th></tr>' +
      Object.keys(FIELD_CONFIDENCE).map(f => {
        const fc = FIELD_CONFIDENCE[f], s = SOURCES[fc.s];
        const nm = { soilF:"Germination soil temp", germ:"Days to germinate", via:"Seed viability",
                     water:"Water per week", ph:"Soil pH", dtm:"Days to maturity", sp:"Spacing" }[f] || f;
        return '<tr><td class="b">' + nm + '<div class="tiny muted" style="font-weight:400">' + esc(fc.t) + '</div></td>' +
          '<td><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.org.split("—")[0].trim()) + ' ↗</a></td></tr>';
      }).join("") + '</table></div>';

    h += '<div class="sec"><h2>When to stop trusting an app</h2></div><div class="card">' +
      '<div class="note d">Anything that can spread through a garden or a neighbourhood — late blight, bacterial wilt, a virus, an unfamiliar insect — deserves a real identification. Your county extension office does this free or nearly free, and they know what is moving locally this season.</div>' +
      '<a class="btn block" style="margin-top:10px" href="https://ask.extension.org/" target="_blank" rel="noopener noreferrer">Find your extension office ↗</a></div>';

    h += '<div class="sec"><h2>App version</h2></div><div class="card">' +
      '<div class="row between"><div><div class="b">Build ' + esc(BUILD) + '</div>' +
      '<div class="tiny muted">' + (Updater.installed ? "Installed to your home screen" : "Running in the browser") + '</div></div></div>' +
      '<button class="btn block" style="margin-top:10px" onclick="Updater.go()">' + Updater.label() + '</button>' +
      '<div id="upd-status" style="margin-top:10px"></div>' +
      '<div class="tiny muted" style="margin-top:8px">Checking for updates pulls the newest build and reloads. Your garden data is untouched — it lives in the encrypted store on this device, not in the app file.</div>' +
      '</div>';

    box.innerHTML = h;
  }
};
</script>
