<script>
/* ============================================================
   LIVE DATA — all free, no API key, CORS-enabled
     phzmapi.org ............ USDA hardiness zone by US ZIP
     open-meteo geocoding ... place -> lat/lon (worldwide)
     open-meteo archive ..... 10y daily lows -> real frost dates
     open-meteo forecast .... 7-day weather, rain, frost alerts
     wikipedia REST ......... live plant reference lookups
   Every call degrades gracefully to offline defaults.
   ============================================================ */
const ZONE_FROST = {
  "2":["06-01","08-30"], "3":["05-25","09-10"], "4":["05-18","09-21"], "5":["05-08","10-05"],
  "6":["04-25","10-17"], "7":["04-08","11-02"], "8":["03-24","11-18"], "9":["02-20","12-10"],
  "10":["01-20","12-26"], "11":["01-01","12-31"], "12":["01-01","12-31"], "13":["01-01","12-31"]
};

const Live = (() => {
  const TO = 12000;
  function jget(url){
    const ctl = ("AbortController" in window) ? new AbortController() : null;
    const t = setTimeout(() => { if(ctl) ctl.abort(); }, TO);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, referrerPolicy:"no-referrer", credentials:"omit", mode:"cors" })
      .then(r => { if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => clearTimeout(t));
  }

  /* ---- location ---- */
  async function byZip(zip){
    const z = String(zip).trim();
    if(/^\d{5}$/.test(z)){
      try{
        const d = await jget("https://phzmapi.org/" + z + ".json");
        return { zip: z, zone: d.zone, lat: parseFloat(d.coordinates.lat), lon: parseFloat(d.coordinates.lon),
                 label: "ZIP " + z, tempRange: d.temperature_range, src: "phzmapi" };
      }catch(e){ /* fall through to place search */ }
    }
    const g = await jget("https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=en&name=" + encodeURIComponent(z));
    if(!g.results || !g.results.length) throw new Error("Couldn't find that place");
    const r = g.results[0];
    return { zip: null, zone: null, lat: r.latitude, lon: r.longitude,
             label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "), src: "open-meteo" };
  }
  async function byGPS(){
    const p = await new Promise((res, rej) => {
      if(!navigator.geolocation) return rej(new Error("No GPS"));
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, maximumAge: 600000 });
    });
    return { zip: null, zone: null, lat: p.coords.latitude, lon: p.coords.longitude, label: "Current location", src: "gps" };
  }

  /* ---- frost dates from 10 years of real daily lows ---- */
  async function frostDates(lat, lon){
    const end = new Date(); end.setDate(end.getDate() - 5);
    const y = end.getFullYear();
    const start = new Date(y - 10, 0, 1);
    const url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + lat.toFixed(3) + "&longitude=" + lon.toFixed(3) +
      "&start_date=" + iso(start) + "&end_date=" + iso(end) +
      "&daily=temperature_2m_min&temperature_unit=fahrenheit&timezone=auto";
    const d = await jget(url);
    const days = d.daily.time, mins = d.daily.temperature_2m_min;
    const lastByYear = {}, firstByYear = {}, coldByYear = {};
    for(let i = 0; i < days.length; i++){
      const t = mins[i]; if(t === null || t === undefined) continue;
      const dt = parseISO(days[i]); const yr = dt.getFullYear();
      const doy = Math.round((dt - new Date(yr, 0, 1)) / DAY);
      if(coldByYear[yr] === undefined || t < coldByYear[yr]) coldByYear[yr] = t;
      if(t <= 32){
        if(doy < 200){ if(lastByYear[yr] === undefined || doy > lastByYear[yr]) lastByYear[yr] = doy; }
        else { if(firstByYear[yr] === undefined || doy < firstByYear[yr]) firstByYear[yr] = doy; }
      }
    }
    const med = o => { const v = Object.keys(o).map(k => o[k]).sort((a,b) => a-b);
      return v.length ? v[Math.floor(v.length/2)] : null; };
    const lastDoy = med(lastByYear), firstDoy = med(firstByYear);
    const avgLow = (() => { const v = Object.keys(coldByYear).map(k => coldByYear[k]);
      return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; })();
    const yr = today().getFullYear();
    const mmdd = doy => doy === null ? null : iso(addDays(new Date(yr, 0, 1), doy)).slice(5);
    return {
      lastFrost: mmdd(lastDoy), firstFrost: mmdd(firstDoy),
      season: (lastDoy !== null && firstDoy !== null) ? (firstDoy - lastDoy) : null,
      avgAnnualLow: avgLow === null ? null : Math.round(avgLow),
      zoneFromLow: avgLow === null ? null : zoneFromLow(avgLow),
      years: Object.keys(coldByYear).length, src: "open-meteo archive (10-yr median)"
    };
  }
  function zoneFromLow(f){
    const z = Math.floor((f + 60) / 10) + 1;
    const half = ((f + 60) % 10) >= 5 ? "b" : "a";
    return clamp(z, 1, 13) + half;
  }

  /* ---- forecast ---- */
  async function forecast(lat, lon){
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(3) + "&longitude=" + lon.toFixed(3) +
      "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,sunrise,sunset,uv_index_max" +
      "&past_days=7&forecast_days=7&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph&timezone=auto";
    return jget(url);
  }
  const WMO = {0:["Clear","☀️"],1:["Mostly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],
    45:["Fog","🌫️"],48:["Rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌦️"],
    61:["Light rain","🌧️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],66:["Freezing rain","🌨️"],67:["Freezing rain","🌨️"],
    71:["Light snow","🌨️"],73:["Snow","❄️"],75:["Heavy snow","❄️"],77:["Snow grains","❄️"],
    80:["Showers","🌦️"],81:["Showers","🌧️"],82:["Violent showers","⛈️"],85:["Snow showers","🌨️"],86:["Snow showers","❄️"],
    95:["Thunderstorm","⛈️"],96:["Thunderstorm + hail","⛈️"],99:["Severe thunderstorm","⛈️"]};
  function wx(code){ return WMO[code] || ["—","🌡️"]; }

  /* ---- wikipedia ---- */
  async function wiki(term){
    const s = await jget("https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=" +
      encodeURIComponent(term));
    const hit = s.query && s.query.search && s.query.search[0];
    if(!hit) throw new Error("No article found");
    const sum = await jget("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(hit.title.replace(/ /g,"_")));
    return { title: sum.title, extract: sum.extract,
             thumb: sum.thumbnail ? sum.thumbnail.source : null,
             url: (sum.content_urls && sum.content_urls.desktop) ? sum.content_urls.desktop.page : null };
  }
  return { byZip, byGPS, frostDates, forecast, wiki, wx, zoneFromLow, jget };
})();

/* ============================================================
   SEASON MATH — frost dates -> real planting dates
   ============================================================ */
const Season = {
  get zone(){ return DB.get("zone", null); },
  get lastFrostISO(){
    const md = DB.get("lastFrost", null); if(!md) return null;
    return today().getFullYear() + "-" + md;
  },
  get firstFrostISO(){
    const md = DB.get("firstFrost", null); if(!md) return null;
    return today().getFullYear() + "-" + md;
  },
  fallbackFrom(zone){
    const z = String(zone || "6").replace(/[ab]/i, "");
    return ZONE_FROST[z] || ZONE_FROST["6"];
  },
  lastFrost(){ const s = Season.lastFrostISO; return s ? parseISO(s) : null; },
  firstFrost(){ const s = Season.firstFrostISO; return s ? parseISO(s) : null; },
  seasonDays(){ const a = Season.lastFrost(), b = Season.firstFrost(); return (a && b) ? diffDays(a, b) : null; },

  /* every sow/plant window for a crop, as real dates this year */
  windows(cropId){
    const c = crop(cropId); if(!c) return [];
    const LF = Season.lastFrost(), FF = Season.firstFrost();
    if(!LF || !FF) return [];
    const w = [], s = c.start || {};
    const W = n => addDays(LF, Math.round(n * 7));
    if(s.indoor !== undefined && s.indoor !== null)
      w.push({ kind:"indoor", label:"Start indoors", date: W(s.indoor), icon:"🏠",
               window: 14, note:"Sow in trays " + Math.abs(s.indoor) + " weeks " + (s.indoor < 0 ? "before" : "after") + " last frost." });
    if(s.tp !== undefined && s.tp !== null)
      w.push({ kind:"transplant", label:"Transplant out", date: W(s.tp), icon:"🌱",
               window: 21, note: s.tp < 0 ? "Goes out before last frost — it takes light cold." : "Wait until frost risk is gone." });
    if(s.direct !== undefined && s.direct !== null)
      w.push({ kind:"direct", label:"Direct sow", date: W(s.direct), icon:"🌰", window: 21, note:"Sow straight into the bed." });
    if(s.fall !== undefined && s.fall !== null && s.fall !== 0 && !s.fallPlant){
      const d = addDays(FF, Math.round(s.fall * 7));
      w.push({ kind:"fall", label:"Fall sowing", date: d, icon:"🍂", window: 14,
               note:"Sow " + Math.abs(s.fall) + " weeks before first frost for a fall harvest." });
    }
    if(s.fallPlant !== undefined && s.fallPlant !== null){
      const d = addDays(FF, Math.round(s.fallPlant * 7));
      w.push({ kind:"fall", label:"Plant in fall", date: d, icon:"🍂", window: 21,
               note:"Overwinters — plant " + Math.abs(s.fallPlant) + " weeks before first frost." });
    }
    return w;
  },

  /* is this crop plantable within N days of today? */
  status(cropId, slack){
    const sl = slack === undefined ? 12 : slack;
    const ws = Season.windows(cropId), t = today();
    let best = null;
    ws.forEach(w => {
      const from = addDays(w.date, -sl), to = addDays(w.date, w.window);
      const inWin = t >= from && t <= to;
      const days = diffDays(t, w.date);
      const cand = { w: w, inWindow: inWin, days: days, soon: days > 0 && days <= 30 };
      if(inWin && (!best || !best.inWindow)) best = cand;
      else if(!best) best = cand;
      else if(!best.inWindow && Math.abs(days) < Math.abs(best.days)) best = cand;
    });
    return best;
  },

  /* projected harvest from a sow/transplant date */
  harvestFrom(cropId, startISO, kind){
    const c = crop(cropId); if(!c || !startISO) return null;
    let d = parseISO(startISO); if(!d) return null;
    if(c.from === "transplant" && (kind === "indoor" || kind === "seed")){
      const s = c.start || {};
      const wk = (s.tp !== undefined && s.indoor !== undefined && s.tp !== null && s.indoor !== null) ? (s.tp - s.indoor) : 5;
      d = addDays(d, Math.round(wk * 7));
    }
    return addDays(d, c.dtm);
  },

  /* days until the first fall frost closes the window */
  daysLeft(){ const ff = Season.firstFrost(); return ff ? diffDays(today(), ff) : null; },

  /* can this crop still finish before frost if started today? */
  stillFits(cropId){
    const c = crop(cropId), left = Season.daysLeft();
    if(!c || left === null) return null;
    return { fits: left >= c.dtm + 7, left: left, needs: c.dtm };
  }
};

/* ============================================================
   RECOMMENDATION ENGINE
   ============================================================ */
const Recommend = {
  /* what should go in the ground right now */
  now(opts){
    const o = opts || {};
    const bed = o.bedId ? DB.find("beds", o.bedId) : null;
    const sunHours = o.sun !== undefined ? o.sun : (bed ? num(bed.sun_hours, 8) : 8);
    const occupants = bed ? DB.where("plantings", p => p.bed_id === bed.id && p.status !== "removed").map(p => p.crop_id) : [];
    const recentFams = bed ? Recommend.recentFamilies(bed.id) : {};
    const stock = {}; DB.all("seeds").forEach(s => { if(s.crop_id) stock[s.crop_id] = (stock[s.crop_id] || 0) + 1; });

    const out = [];
    CROPS.forEach(c => {
      const st = Season.status(c.id, o.slack === undefined ? 10 : o.slack);
      if(!st || !st.inWindow) return;
      let score = 50; const why = [], warn = [];
      why.push(st.w.icon + " " + st.w.label + " window is open " + (st.days === 0 ? "today" : (st.days > 0 ? "(peak " + relDay(st.w.date) + ")" : "(opened " + relDay(st.w.date) + ")")));

      if(sunHours >= c.sun){ score += 12; }
      else if(sunHours >= c.sun - 2){ score -= 8; warn.push("Wants " + c.sun + "h sun, this spot gets " + sunHours + "h — expect a lighter crop."); }
      else { score -= 30; warn.push("Needs " + c.sun + "h of sun; " + sunHours + "h is not enough."); }

      const fits = Season.stillFits(c.id);
      if(fits && !fits.fits && st.w.kind !== "fall" && st.w.kind !== "indoor"){
        score -= 25; warn.push("Needs " + fits.needs + " days and only " + fits.left + " remain before first frost.");
      }

      let comp = 0;
      occupants.forEach(oc => {
        const r = pairRating(c.id, oc);
        if(r.score >= 2){ comp += 8; why.push("💚 Great next to your " + cropName(oc)); }
        else if(r.score === 1){ comp += 4; why.push("🙂 Pairs well with your " + cropName(oc)); }
        else if(r.score <= -2){ comp -= 16; warn.push("⚠️ Keep away from your " + cropName(oc) + " — " + r.why); }
        else if(r.score === -1){ comp -= 5; warn.push("Same family as your " + cropName(oc) + "."); }
      });
      score += clamp(comp, -30, 24);

      if(recentFams[c.fam]){ score -= 14; warn.push("A " + FAMILY[c.fam].n.toLowerCase() + " grew here " + recentFams[c.fam] + " — rotate if you can."); }
      if(stock[c.id]){ score += 10; why.push("🌰 You already have seed for this"); }

      out.push({ crop: c, score: score, window: st.w, days: st.days, why: why, warn: warn, hasSeed: !!stock[c.id] });
    });
    return out.sort((a, b) => b.score - a.score);
  },

  recentFamilies(bedId){
    const out = {}, cut = addDays(today(), -730);
    DB.where("plantings", p => p.bed_id === bedId).forEach(p => {
      const c = crop(p.crop_id); if(!c) return;
      const d = parseISO(p.sown_on || p.created && p.created.slice(0,10));
      if(d && d >= cut) out[c.fam] = (d.getFullYear() === today().getFullYear() ? "this season" : "last season");
    });
    return out;
  },

  /* best companions for what's already in a bed */
  forBed(bedId){
    const occ = DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed").map(p => p.crop_id);
    if(!occ.length) return [];
    const tally = {};
    occ.forEach(id => {
      const cc = companionsFor(id);
      cc.good.forEach(g => { if(occ.indexOf(g) < 0) tally[g] = (tally[g] || 0) + 1; });
    });
    return Object.keys(tally).map(id => ({ id: id, n: tally[id] })).sort((a,b) => b.n - a.n).slice(0, 8);
  },

  /* conflicts currently planted in a bed */
  conflicts(bedId){
    const ps = DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed");
    const out = [];
    for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
      if(ps[i].crop_id === ps[j].crop_id) continue;
      const r = pairRating(ps[i].crop_id, ps[j].crop_id);
      if(r.score <= -2){
        const dist = Math.abs(num(ps[i].x) - num(ps[j].x)) + Math.abs(num(ps[i].y) - num(ps[j].y));
        if(dist <= 4) out.push({ a: ps[i], b: ps[j], why: r.why, dist: dist });
      }
    }
    return out;
  },

  /* watering call for a bed, from crop needs + real rainfall */
  water(bedId, weather){
    const ps = DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed");
    if(!ps.length) return null;
    let need = 0;
    ps.forEach(p => { const c = crop(p.crop_id); if(c) need = Math.max(need, c.water); });
    let rain = 0;
    if(weather && weather.daily){
      const t = iso(today());
      weather.daily.time.forEach((d, i) => {
        const dd = diffDays(parseISO(d), today());
        if(dd >= 0 && dd < 7) rain += num(weather.daily.precipitation_sum[i]);
      });
    }
    const logged = DB.where("journal", j => j.bed_id === bedId && j.type === "water" && diffDays(parseISO(j.date), today()) < 7)
      .reduce((a, j) => a + num(j.amount), 0);
    const deficit = need - rain - logged;
    return { need: need, rain: Math.round(rain * 100) / 100, logged: Math.round(logged * 100) / 100,
             deficit: Math.round(deficit * 100) / 100,
             verdict: deficit <= 0.05 ? "skip" : (deficit < 0.5 ? "light" : "water") };
  }
};
</script>
