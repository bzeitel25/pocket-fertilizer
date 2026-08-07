<script>
/* ============================================================
   APP SHELL — router, header, home, onboarding
   ============================================================ */
const APP = { tab: "home", weather: null, wxAt: 0, bedId: null, plotId: null, month: null, dx: null };

const TABS = {
  home:     { t:"Pocket Fertilizer", s:"Your garden, today" },
  garden:   { t:"Garden Plan",       s:"Beds, grids & companions" },
  seeds:    { t:"Seed Bank",         s:"Inventory & viability" },
  calendar: { t:"Grow Calendar",     s:"Sow, transplant, harvest" },
  doctor:   { t:"Plant Doctor",      s:"Scan & diagnose" },
  weather:  { t:"Weather",           s:"Forecast & garden risks" },
  assist:   { t:"Ask",               s:"Your gardening assistant" },
  sources:  { t:"Sources",           s:"Where the advice comes from" },
  help:     { t:"How to use it",     s:"Starter guide & manual" },
  journal:  { t:"Garden Journal",    s:"Water, feed, harvest, cost" },
  recap:    { t:"Season Recap",      s:"Yield & resources" },
  library:  { t:"Plant Library",     s:"Care, spacing, companions" },
  settings: { t:"Settings",          s:"Location, security, data" },
  sql:      { t:"SQL Console",       s:"Query your garden database" }
};

function go(tab, opts){
  APP.tab = tab;
  $$(".screen").forEach(s => s.classList.remove("active"));
  const el = $("#s-" + tab); if(el) el.classList.add("active");
  $$("nav.tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const meta = TABS[tab] || TABS.home;
  $("#scr-title").textContent = meta.t;
  $("#scr-sub").textContent = meta.s;
  window.scrollTo(0, 0);
  render(tab, opts);
}
function render(tab, opts){
  const fn = ({ home: Home, garden: Garden, seeds: Seeds, calendar: Cal, doctor: Doctor,
                weather: Weather, assist: Assist, sources: Sources, help: Help,
                journal: Journal, recap: Recap, library: Library, settings: Settings, sql: SqlView })[tab];
  if(fn && fn.render) fn.render(opts);
}
function refresh(){ render(APP.tab); }

/* ---------- weather cache ---------- */
async function getWeather(force){
  const lat = DB.get("lat"), lon = DB.get("lon");
  if(!lat || !lon) return null;
  if(!force && APP.weather && Date.now() - APP.wxAt < 30 * 60 * 1000) return APP.weather;
  try{
    APP.weather = await Live.forecast(lat, lon);
    APP.wxAt = Date.now();
    DB.set("wxCache", { at: Date.now(), data: APP.weather });
  }catch(e){
    const c = DB.get("wxCache");
    if(c && c.data){ APP.weather = c.data; APP.wxAt = c.at; }
  }
  return APP.weather;
}

/* ============================================================
   HOME
   ============================================================ */
const Home = {
  render(){
    const box = $("#s-home");
    const zone = DB.get("zone"), lf = Season.lastFrost(), ff = Season.firstFrost();
    const left = Season.daysLeft();
    const beds = DB.all("beds"), plantings = DB.where("plantings", p => p.status !== "removed");
    const seeds = DB.all("seeds");
    /* actionable tasks only: frost markers live in the hero, and nothing
       older than three weeks should still be nagging as "overdue" */
    const dueEvents = DB.where("events", e => {
      if(e.done === "1" || e.done === true || e.type === "frost") return false;
      const d = parseISO(e.date); if(!d) return false;
      const n = diffDays(today(), d);
      return n >= -21 && n <= 7;
    }).sort((a,b) => a.date < b.date ? -1 : 1);

    let h = "";

    /* hero */
    h += '<div class="hero">';
    const town = DB.get("town"), region = DB.get("region"), zipc = DB.get("zip");
    const where = town ? (town + (region ? ", " + region : "")) : (DB.get("locLabel") || "Set your location");
    h += '<div class="row between"><div><div class="lbl">' + esc(where) + '</div>' +
         '<div style="font-size:2rem;font-weight:800;line-height:1">Zone ' + esc(zone || "—") + '</div>' +
         '<div class="sm" style="opacity:.9">' + (zipc ? 'ZIP ' + esc(zipc) : (zone ? 'Growing zone' : 'Tap below to set your location')) + '</div></div>' +
         '<div style="text-align:right">' +
         (left !== null ? '<div class="lbl">Season left</div><div style="font-size:2rem;font-weight:800;line-height:1">' +
            (left > 0 ? left : 0) + '</div><div class="sm" style="opacity:.9">days to frost</div>' : '') +
         '</div></div>';
    if(lf && ff) h += '<div class="row" style="gap:14px;margin-top:12px;font-size:.8rem;opacity:.95">' +
      '<span>❄️ Last frost ' + fmt(lf) + '</span><span>🍂 First frost ' + fmt(ff) + '</span></div>';
    h += '</div>';

    if(!zone) h += '<div class="card" style="margin-top:12px"><div class="note i">Set your location to unlock frost dates, planting windows and weather-aware watering.</div>' +
      '<button class="btn block" style="margin-top:10px" onclick="Onboard.open()">Set my location</button></div>';

    /* weather strip */
    h += '<div id="wxstrip"></div>';

    /* quick actions */
    h += '<div class="sec"><h2>Quick actions</h2></div>';
    h += '<div class="grid2">' +
      '<button class="card" style="text-align:left" onclick="go(\'doctor\')"><div style="font-size:1.5rem">🔬</div><div class="b">Scan a plant</div><div class="tiny muted">Diagnose leaf issues</div></button>' +
      '<button class="card" style="text-align:left" onclick="Seeds.add()"><div style="font-size:1.5rem">🌰</div><div class="b">Add seed packet</div><div class="tiny muted">Photo or manual</div></button>' +
      '<button class="card" style="text-align:left" onclick="Journal.quick(\'harvest\')"><div style="font-size:1.5rem">🧺</div><div class="b">Log a harvest</div><div class="tiny muted">Weight & value</div></button>' +
      '<button class="card" style="text-align:left" onclick="go(\'assist\')"><div style="font-size:1.5rem">✨</div><div class="b">Ask the assistant</div><div class="tiny muted">Type or speak</div></button>' +
      '</div>';

    /* tasks */
    h += '<div class="sec"><h2>Next 7 days</h2><a class="tiny b" onclick="go(\'calendar\')">Calendar →</a></div>';
    if(!dueEvents.length){
      h += '<div class="card center muted sm">Nothing scheduled. Add seeds to your bank and the calendar fills itself in.</div>';
    } else {
      h += '<div class="card pad0"><div class="list">';
      dueEvents.slice(0, 6).forEach(e => {
        const overdue = diffDays(today(), parseISO(e.date)) < 0;
        h += '<button class="item" onclick="Cal.openEvent(\'' + e.id + '\')">' +
          '<div class="av">' + (e.crop_id ? cropEmoji(e.crop_id) : "📌") + '</div>' +
          '<div class="grow"><div class="b truncate">' + esc(e.title) + '</div>' +
          '<div class="tiny ' + (overdue ? "" : "muted") + '" ' + (overdue ? 'style="color:var(--danger)"' : '') + '>' +
          (overdue ? "Overdue — " : "") + relDay(e.date) + ' · ' + fmt(e.date) + '</div></div>' +
          '<span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    /* recommendations */
    const recs = Recommend.now({ slack: 10 }).slice(0, 4);
    h += '<div class="sec"><h2>Plant this week</h2><a class="tiny b" onclick="Library.render({filter:\'now\'});go(\'library\')">All →</a></div>';
    if(!zone){ h += '<div class="card center muted sm">Set your location first.</div>'; }
    else if(!recs.length){ h += '<div class="card center muted sm">No sowing windows are open right now — check the calendar for what is coming up.</div>'; }
    else {
      h += '<div class="scroller">';
      recs.forEach(r => {
        h += '<button class="card" style="width:170px;text-align:left" onclick="Library.open(\'' + r.crop.id + '\')">' +
          '<div style="font-size:1.7rem">' + r.crop.e + '</div>' +
          '<div class="b truncate">' + esc(r.crop.n) + '</div>' +
          '<div class="tiny muted" style="height:32px;overflow:hidden">' + esc(r.window.label) + ' · ' + esc(r.window.note.slice(0, 46)) + '</div>' +
          '<div class="row" style="gap:4px;margin-top:6px">' +
            (r.hasSeed ? '<span class="chip good tiny">have seed</span>' : '') +
            (r.warn.length ? '<span class="chip warn tiny">' + r.warn.length + ' note' + (r.warn.length > 1 ? "s" : "") + '</span>' : '<span class="chip good tiny">good fit</span>') +
          '</div></button>';
      });
      h += '</div>';
    }

    /* beds + watering */
    h += '<div class="sec"><h2>Your beds</h2><a class="tiny b" onclick="go(\'garden\')">Plan →</a></div>';
    if(!beds.length){
      h += '<div class="card center"><div class="empty"><span class="e">🪴</span>No beds yet.<div class="tiny">Lay out a grid and start planning.</div></div>' +
        '<button class="btn block" onclick="Garden.newBed()">Create my first bed</button></div>';
    } else {
      h += '<div class="card pad0"><div class="list">';
      beds.forEach(b => {
        const n = DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed").length;
        const cells = num(b.cols) * num(b.rows);
        const w = Recommend.water(b.id, APP.weather);
        let wtxt = "", wcls = "muted";
        if(w){
          if(w.verdict === "skip"){ wtxt = "💧 No water needed — " + Units.water(w.rain) + ' rain this week'; wcls = "muted"; }
          else if(w.verdict === "light"){ wtxt = '💧 Top up ~' + Units.water(w.deficit) + ' this week'; }
          else { wtxt = '💧 Needs ' + Units.water(w.deficit) + ' more this week'; }
        }
        h += '<button class="item" onclick="Garden.open(\'' + b.id + '\')">' +
          '<div class="av">🪴</div><div class="grow"><div class="b truncate">' + esc(b.name) + '</div>' +
          '<div class="tiny muted">' + b.cols + '×' + b.rows + ' · ' + n + '/' + cells + ' squares planted · ' + esc(b.sun_hours || "?") + 'h sun</div>' +
          (wtxt ? '<div class="tiny ' + wcls + '">' + esc(wtxt) + '</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    /* stats */
    const yr = today().getFullYear();
    const hv = DB.where("harvests", x => (x.date || "").slice(0,4) === String(yr));
    const lbs = hv.reduce((a, x) => a + (x.unit === "oz" ? num(x.weight)/16 : num(x.weight)), 0);
    const val = hv.reduce((a, x) => a + num(x.value), 0);
    const spent = DB.all("journal").filter(j => (j.date||"").slice(0,4) === String(yr)).reduce((a,j) => a + num(j.cost), 0)
                + DB.all("seeds").reduce((a,s) => a + num(s.cost), 0);
    h += '<div class="sec"><h2>' + yr + ' so far</h2><a class="tiny b" onclick="go(\'recap\')">Recap →</a></div>';
    h += '<div class="card"><div class="grid3">' +
      '<div class="stat"><span class="n">' + (Math.round(lbs*10)/10) + '</span><span class="l">lbs picked</span></div>' +
      '<div class="stat"><span class="n">$' + Math.round(val) + '</span><span class="l">value</span></div>' +
      '<div class="stat"><span class="n">' + plantings.length + '</span><span class="l">growing</span></div>' +
      '</div>' +
      (spent > 0 ? '<div class="tiny muted" style="margin-top:10px">$' + Math.round(spent) + ' spent · ' +
        (lbs > 0 ? '$' + (Math.round(spent/lbs*100)/100) + ' per lb' : 'no harvest logged yet') + '</div>' : '') +
      '</div>';

    /* tip of the day */
    h += '<div class="sec"><h2>Tip of the day</h2></div>' + Tips.card();

    /* seed alerts */
    const bad = seeds.filter(s => Seeds.viability(s).level === "expired");
    const soon = seeds.filter(s => Seeds.viability(s).level === "fading");
    if(bad.length || soon.length){
      h += '<div class="sec"><h2>Seed bank alerts</h2><a class="tiny b" onclick="go(\'seeds\')">Bank →</a></div><div class="card">';
      if(bad.length) h += '<div class="note d" style="margin-bottom:8px">' + bad.length + ' packet' + (bad.length>1?"s are":" is") + ' past viable age — germination will be poor. Test 10 seeds on a damp paper towel before you commit bed space.</div>';
      if(soon.length) h += '<div class="note w">' + soon.length + ' packet' + (soon.length>1?"s are":" is") + ' getting old — sow these first this season.</div>';
      h += '</div>';
    }

    box.innerHTML = h;
    Home.weather();
  },

  async weather(){
    const w = await getWeather();
    const strip = $("#wxstrip"); if(!strip) return;
    if(!w || !w.daily){ strip.innerHTML = ""; return; }
    const d = w.daily, t = iso(today());
    let h = '<div class="sec"><h2>Weather</h2><button class="tiny b" onclick="go(\'weather\')">Full forecast →</button></div>';
    const cur = w.current || {};
    const frostSoon = [];
    d.time.forEach((dt, i) => { const dd = diffDays(today(), parseISO(dt));
      if(dd >= 0 && dd <= 6 && num(d.temperature_2m_min[i], 99) <= 36) frostSoon.push({ dt: dt, t: d.temperature_2m_min[i] }); });
    h += '<div class="card">';
    h += '<div class="row between"><div class="row" style="gap:8px"><div style="font-size:1.8rem">' + Live.wx(cur.weather_code)[1] + '</div>' +
      '<div><div class="b">' + Units.temp(num(cur.temperature_2m)) + ' · ' + esc(Live.wx(cur.weather_code)[0]) + '</div>' +
      '<div class="tiny muted">' + Math.round(num(cur.relative_humidity_2m)) + '% humidity · wind ' + Math.round(num(cur.wind_speed_10m)) + ' mph</div></div></div>' +
      '<button class="iconbtn" onclick="go(\'weather\')">›</button></div>';
    h += '<div class="scroller" style="margin-top:10px;padding-bottom:0">';
    d.time.forEach((dt, i) => {
      const dd = diffDays(today(), parseISO(dt));
      if(dd < 0 || dd > 6) return;
      const cold = num(d.temperature_2m_min[i], 99) <= 36;
      h += '<div class="center" style="min-width:52px">' +
        '<div class="tiny muted">' + (dd === 0 ? "Today" : DOW[parseISO(dt).getDay()]) + '</div>' +
        '<div style="font-size:1.3rem">' + Live.wx(d.weather_code[i])[1] + '</div>' +
        '<div class="tiny b">' + Math.round(num(d.temperature_2m_max[i])) + '°</div>' +
        '<div class="tiny ' + (cold ? "" : "muted") + '" ' + (cold ? 'style="color:var(--info)"' : '') + '>' + Units.tempN(num(d.temperature_2m_min[i])) + '°</div>' +
        (num(d.precipitation_sum[i]) > 0.01 ? '<div class="tiny" style="color:var(--info)">' + Units.water(num(d.precipitation_sum[i])) + '</div>' : '<div class="tiny">&nbsp;</div>') +
        '</div>';
    });
    h += '</div>';
    if(frostSoon.length) h += '<div class="note w" style="margin-top:10px">🥶 Cold coming: ' +
      Units.temp(frostSoon[0].t) + ' on ' + fmt(frostSoon[0].dt) + '. Cover tender crops (tomato, pepper, basil, squash) or bring pots in.</div>';
    let rain7 = 0; d.time.forEach((dt, i) => { const dd = diffDays(today(), parseISO(dt)); if(dd >= 0 && dd < 7) rain7 += num(d.precipitation_sum[i]); });
    if(rain7 > 0.4) h += '<div class="note i" style="margin-top:8px">🌧️ ' + Units.water(rain7) + ' of rain forecast this week — hold off on watering established beds.</div>';
    h += '</div>';
    strip.innerHTML = h;
  }
};

/* ============================================================
   ONBOARDING — location, zone, frost dates
   ============================================================ */
const Onboard = {
  open(){
    openSheet("Where do you garden?",
      '<p class="muted sm" style="margin-top:0">Your ZIP unlocks your USDA zone, ten-year median frost dates, and live weather. Nothing leaves your device except the lookup itself.</p>' +
      '<div class="field"><label class="f">US ZIP code or place name</label>' +
      '<input type="text" id="ob-zip" placeholder="97202 or Portland, Oregon" autocomplete="postal-code"></div>' +
      '<div class="row" style="margin-top:12px;gap:8px">' +
        '<button class="btn grow" id="ob-go">Look it up</button>' +
        '<button class="btn ghost" id="ob-gps" title="Use GPS">📍</button>' +
      '</div>' +
      '<div id="ob-out" style="margin-top:14px"></div>');
    $("#ob-go").onclick = () => Onboard.lookup($("#ob-zip").value);
    $("#ob-gps").onclick = () => Onboard.lookup(null, true);
    $("#ob-zip").addEventListener("keydown", e => { if(e.key === "Enter") Onboard.lookup($("#ob-zip").value); });
    const z = DB.get("zip"); if(z) $("#ob-zip").value = z;
  },

  async lookup(q, gps){
    const out = $("#ob-out");
    if(!gps && !String(q || "").trim()){ out.innerHTML = '<div class="note d">Enter a ZIP or a place name.</div>'; return; }
    out.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Finding your zone…</span></div>';
    let loc;
    try{ loc = gps ? await Live.byGPS() : await Live.byZip(q); }
    catch(e){ out.innerHTML = '<div class="note d">' + esc(e.message || "Lookup failed") + '. Check your connection, or set frost dates manually in Settings.</div>'; return; }

    out.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Reading 10 years of local frost history…</span></div>';
    let fr = null;
    try{ fr = await Live.frostDates(loc.lat, loc.lon); }catch(e){ /* fallback below */ }

    const zone = loc.zone || (fr && fr.zoneFromLow) || "6b";
    let lastF, firstF, src;
    if(fr && fr.lastFrost && fr.firstFrost){ lastF = fr.lastFrost; firstF = fr.firstFrost; src = fr.src; }
    else { const f = Season.fallbackFrom(zone); lastF = f[0]; firstF = f[1]; src = "zone average (offline estimate)"; }

    DB.set("zip", loc.zip || String(q || "").trim());
    DB.set("locLabel", loc.label);
    DB.set("lat", loc.lat); DB.set("lon", loc.lon);
    DB.set("zone", zone);
    DB.set("lastFrost", lastF); DB.set("firstFrost", firstF);
    DB.set("frostSrc", src);
    if(fr && fr.avgAnnualLow !== null && fr.avgAnnualLow !== undefined) DB.set("avgLow", fr.avgAnnualLow);
    DB.set("onboarded", true);

    const yr = today().getFullYear();
    out.innerHTML =
      '<div class="note g"><div class="b" style="font-size:1rem">Zone ' + esc(zone) + ' · ' + esc(loc.label) + '</div>' +
      '<div style="margin-top:6px">❄️ Last spring frost <b>' + fmt(yr + "-" + lastF) + '</b><br>' +
      '🍂 First fall frost <b>' + fmt(yr + "-" + firstF) + '</b><br>' +
      '🌱 Growing season <b>' + diffDays(parseISO(yr + "-" + lastF), parseISO(yr + "-" + firstF)) + ' days</b></div>' +
      '<div class="tiny" style="margin-top:6px;opacity:.8">Source: ' + esc(src) + (fr && fr.avgAnnualLow !== null && fr.avgAnnualLow !== undefined ? ' · avg annual low ' + Units.temp(fr.avgAnnualLow) : '') + '</div></div>' +
      '<button class="btn block" style="margin-top:12px" onclick="closeSheet();Cal.rebuild();refresh();toast(\'Location saved\')">Use these dates</button>' +
      '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();go(\'settings\')">Adjust manually</button>';
    await getWeather(true);
  }
};
</script>
