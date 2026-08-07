<script>
/* ============================================================
   MICRO-CLIMATE — the engine

   A hardiness zone describes a county. It cannot tell you that the
   strip in front of the house bakes against a south wall and never
   sees rain under the eaves, while the bed behind it sits in a
   cold pocket that loses two hours of afternoon sun to a maple.
   That difference is the whole game, and almost no app records it.

   A micro-climate profile is a `sites` row attached to a PLOT.
   Every bed in that plot inherits it; any bed may override single
   fields with its own row. Nothing here invents weather — the sun
   figures are real solar geometry for the garden's own latitude,
   and everything else is an explicit, editable estimate carrying
   its own confidence.
   ============================================================ */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* the eight compass sectors the horizon is recorded in */
const SECTORS = ["N","NE","E","SE","S","SW","W","NW"];
const SECTOR_AZ = [0, 45, 90, 135, 180, 225, 270, 315];

const Solar = {
  /* Spencer's Fourier series — declination good to about 0.03° */
  declination(doy){
    const g = 2 * Math.PI * (doy - 1) / 365;
    return (0.006918
      - 0.399912 * Math.cos(g)     + 0.070257 * Math.sin(g)
      - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.001480 * Math.sin(3 * g)) * R2D;
  },

  /* altitude and azimuth (clockwise from true north) at an hour angle,
     H in degrees: 0 = solar noon, negative = morning */
  pos(lat, doy, H){
    const d = Solar.declination(doy) * D2R, p = lat * D2R, h = H * D2R;
    const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h));
    /* atan2 form, measured from south then rotated to north */
    const azS = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(p) - Math.tan(d) * Math.cos(p));
    let az = azS * R2D + 180;
    az = ((az % 360) + 360) % 360;
    return { alt: alt * R2D, az: az };
  },

  /* solar noon is 12:00 solar time; convert a local clock hour to an
     hour angle using longitude and the equation of time */
  eqTime(doy){
    const g = 2 * Math.PI * (doy - 1) / 365;
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));   /* minutes */
  },
  hourAngle(dateObj, lat, lon){
    const start = new Date(dateObj.getFullYear(), 0, 0);
    const doy = Math.floor((dateObj - start) / DAY);
    const mins = dateObj.getHours() * 60 + dateObj.getMinutes();
    const tzMin = -dateObj.getTimezoneOffset();
    const trueSolar = mins + Solar.eqTime(doy) + 4 * lon - tzMin;
    return { doy: doy, H: trueSolar / 4 - 180 };
  },
  /* where the sun actually is, right now, over this garden */
  now(lat, lon, when){
    const d = when || new Date();
    const ha = Solar.hourAngle(d, lat, lon);
    return Object.assign(Solar.pos(lat, ha.doy, ha.H), { doy: ha.doy, H: ha.H, at: d });
  },

  /* obstruction elevation at any bearing, interpolated between sectors */
  horizonAt(hz, az){
    if(!hz || !hz.length) return 0;
    const a = ((az % 360) + 360) % 360;
    const i = Math.floor(a / 45) % 8, f = (a - Math.floor(a / 45) * 45) / 45;
    const lo = num(hz[i], 0), hi = num(hz[(i + 1) % 8], 0);
    return lo + (hi - lo) * f;
  },

  /* Sun within a few degrees of the horizon is not doing garden work: the
     beam crosses ten-odd air masses and every real site loses it to distant
     trees and terrain that no survey records. Everything below this is
     ignored, for the open reference site as well as the surveyed one, so
     the two stay comparable. */
  MIN_ALT: 3,

  /* hours of direct sun on a given day, and the direct-beam energy
     relative to an unobstructed flat site (1.0 = wide open) */
  day(lat, doy, hz, tiltDeg, tiltAzDeg){
    let mins = 0, beam = 0, open = 0;
    const b = (tiltDeg || 0) * D2R, ba = (tiltAzDeg === null || tiltAzDeg === undefined ? 180 : tiltAzDeg) * D2R;
    for(let H = -180; H < 180; H += 1){          /* 1° of hour angle = 4 minutes */
      const p = Solar.pos(lat, doy, H);
      if(p.alt <= Solar.MIN_ALT) continue;
      const sinA = Math.sin(p.alt * D2R);
      open += sinA;
      if(p.alt <= Solar.horizonAt(hz, p.az)) continue;
      mins += 4;
      /* cosine of incidence on the sloped ground */
      const ci = sinA * Math.cos(b) + Math.cos(p.alt * D2R) * Math.sin(b) * Math.cos((p.az * D2R) - ba);
      beam += Math.max(0, ci);
    }
    return { hours: Math.round(mins / 60 * 10) / 10, gain: open > 0 ? beam / open : 0 };
  },

  /* the 15th of each month — a fair sample of the month's sun */
  MID_DOY: [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349],
  year(lat, hz, tiltDeg, tiltAzDeg){
    const hours = [], gain = [];
    for(let m = 0; m < 12; m++){
      const r = Solar.day(lat, Solar.MID_DOY[m], hz, tiltDeg, tiltAzDeg);
      hours.push(r.hours); gain.push(Math.round(r.gain * 100) / 100);
    }
    return { hours: hours, gain: gain };
  }
};

/* ============================================================
   MICRO — profiles, derived numbers, and the reasons for them
   ============================================================ */
const Micro = (() => {

  const JSON_FIELDS = ["horizon", "sun_hours_by_month", "sun_gain_by_month", "photos", "shots", "rain_obs", "frost_obs"];

  const DEFAULTS = {
    horizon: [0,0,0,0,0,0,0,0],
    slope_pct: 0, slope_dir: null,
    wind_exposure: "normal", shelter: "none",
    canopy: "open", reflect: "none",
    drainage: "normal", surface: "soil",
    frost_pocket: "none",
    method: null, confidence: null
  };

  const WIND    = { sheltered:0.85, normal:1.00, breezy:1.12, exposed:1.30 };
  const CANOPY  = { open:1.00, partial:0.85, tree:0.65, eaves:0.25 };
  const REFLECT = { none:1.00, some:1.08, strong:1.18 };
  const DRAIN   = { fast:1.15, normal:1.00, slow:0.90, boggy:0.80 };

  const LABELS = {
    wind_exposure:{ sheltered:"Sheltered", normal:"Normal", breezy:"Breezy", exposed:"Open and exposed" },
    canopy:{ open:"Open sky", partial:"Partly overhung", tree:"Under tree canopy", eaves:"Under eaves or a roof" },
    reflect:{ none:"No reflected heat", some:"Some reflected heat", strong:"Strong reflected heat" },
    drainage:{ fast:"Fast draining", normal:"Normal", slow:"Slow draining", boggy:"Stays wet" },
    frost_pocket:{ elevated:"High and free-draining air", none:"Neither", slight:"Slightly low", pocket:"A cold pocket" },
    surface:{ soil:"Bare soil", lawn:"Lawn", mulch:"Mulch", gravel:"Gravel", paving:"Paving", deck:"Deck" }
  };

  /* ---------- storage ---------- */
  function decode(row){
    if(!row) return null;
    const out = Object.assign({}, row);
    JSON_FIELDS.forEach(f => {
      const v = out[f];
      if(typeof v === "string" && v){ try{ out[f] = JSON.parse(v); }catch(e){ out[f] = null; } }
    });
    return out;
  }
  function encode(obj){
    const out = Object.assign({}, obj);
    JSON_FIELDS.forEach(f => { if(out[f] !== undefined && out[f] !== null && typeof out[f] !== "string") out[f] = JSON.stringify(out[f]); });
    return out;
  }

  function row(scope, refId){
    if(!refId) return null;
    return decode(DB.all("sites").find(s => s.scope === scope && s.ref_id === refId) || null);
  }
  function save(scope, refId, patch){
    const raw = DB.all("sites").find(s => s.scope === scope && s.ref_id === refId);
    const body = encode(Object.assign({}, patch, { scope: scope, ref_id: refId, updated: new Date().toISOString() }));
    const saved = raw ? DB.update("sites", raw.id, body) : DB.insert("sites", body);
    Micro._cache = {};
    return decode(saved);
  }
  function clear(scope, refId){
    const raw = DB.all("sites").find(s => s.scope === scope && s.ref_id === refId);
    if(raw) DB.remove("sites", raw.id);
    Micro._cache = {};
  }

  /* ---------- resolution: bed overrides plot, plot is the default ---------- */
  function profile(bedId){
    const bed = DB.find("beds", bedId);
    if(!bed) return null;
    const plotSite = bed.plot_id ? row("plot", bed.plot_id) : null;
    const bedSite  = row("bed", bed.id);
    if(!plotSite && !bedSite) return null;
    const merged = Object.assign({}, DEFAULTS, plotSite || {});
    if(bedSite) Object.keys(bedSite).forEach(k => {
      if(bedSite[k] !== null && bedSite[k] !== undefined && bedSite[k] !== "" && k !== "id" && k !== "created") merged[k] = bedSite[k];
    });
    merged._from = bedSite && plotSite ? "bed override" : (bedSite ? "bed" : "plot");
    merged._plotId = bed.plot_id || null;
    return merged;
  }

  /* growing months, from this garden's own frost dates */
  function growMonths(){
    const lf = Season.lastFrostISO, ff = Season.firstFrostISO;
    const a = lf ? parseISO(lf).getMonth() : 3, b = ff ? parseISO(ff).getMonth() : 8;
    const out = [];
    for(let m = a; ; m = (m + 1) % 12){ out.push(m); if(m === b) break; if(out.length > 12) break; }
    return out;
  }

  /* ---------- the derived picture ---------- */
  function derive(site){
    if(!site) return null;
    const lat = DB.get("lat", null);
    const hz = Array.isArray(site.horizon) ? site.horizon : DEFAULTS.horizon;
    const slope = clamp(num(site.slope_pct, 0), 0, 60);
    const tilt = Math.atan(slope / 100) * R2D;
    const tiltAz = site.slope_dir === null || site.slope_dir === undefined || site.slope_dir === ""
      ? null : num(site.slope_dir, 180);

    const out = { site: site, lat: lat, slopeDeg: Math.round(tilt * 10) / 10, why: [] };

    if(lat === null || lat === undefined){
      out.sunKnown = false;
      out.why.push({ k:"w", t:"No location set", m:"Set the garden's location and the sun hours here are calculated from real solar geometry rather than guessed." });
    } else {
      const yr = Solar.year(num(lat), hz, tilt, tiltAz);
      out.sunKnown = true;
      out.sunByMonth = yr.hours;
      out.gainByMonth = yr.gain;
      const gm = growMonths();
      out.sunGrowing = Math.round(gm.reduce((a, m) => a + yr.hours[m], 0) / gm.length * 10) / 10;
      out.gainGrowing = Math.round(gm.reduce((a, m) => a + yr.gain[m], 0) / gm.length * 100) / 100;
      out.sunPeak = Math.max.apply(null, yr.hours);
      out.sunLow  = Math.min.apply(null, gm.map(m => yr.hours[m]));
      /* the yardstick for everything below: what an unobstructed flat site
         at this same latitude gets. Water and shade are judged against this,
         never against a hardcoded "8 hours" that means nothing at 60°N. */
      const openYr = Solar.year(num(lat), DEFAULTS.horizon, 0, null);
      out.sunOpen = Math.round(gm.reduce((a, m) => a + openYr.hours[m], 0) / gm.length * 10) / 10;
      out.sunShare = out.sunOpen > 0 ? Math.round(out.sunGrowing / out.sunOpen * 100) / 100 : 1;
      out.lost = Math.round((out.sunOpen - out.sunGrowing) * 10) / 10;
      if(out.lost >= 1) out.why.push({ k:"i", t: out.lost + "h of sun lost to obstructions",
        m:"An open site at this latitude averages " + out.sunOpen + "h through the growing season. What you have around this spot brings it to " + out.sunGrowing + "h." });
      if(out.gainGrowing >= 1.04) out.why.push({ k:"g", t:"Slope tilts into the sun",
        m:"The ground here faces the sun more squarely than flat ground — about " + Math.round((out.gainGrowing - 1) * 100) + "% more direct-beam energy. It warms earlier in spring." });
      if(out.gainGrowing <= 0.94 && slope >= 4) out.why.push({ k:"w", t:"Slope tilts away from the sun",
        m:"About " + Math.round((1 - out.gainGrowing) * 100) + "% less direct-beam energy than flat ground. Expect slower spring warm-up and later ripening." });
    }

    /* ---- water ---- */
    const wind = WIND[site.wind_exposure] || 1;
    const shelterAdj = (site.shelter && site.shelter !== "none") ? 0.92 : 1;
    /* shade cuts evaporative demand — measured against an open site here,
       not against an absolute hour count */
    const sunAdj = out.sunKnown ? clamp(0.7 + 0.3 * (out.sunShare / 0.95), 0.7, 1.1) : 1;
    const reflect = REFLECT[site.reflect] || 1;
    const runoff = slope >= 20 ? 1.18 : slope >= 10 ? 1.12 : slope >= 4 ? 1.06 : 1;
    const drain = DRAIN[site.drainage] || 1;
    out.windFactor = Math.round(wind * shelterAdj * 100) / 100;
    out.waterFactor = Math.round(clamp(wind * shelterAdj * sunAdj * reflect * runoff * drain, 0.6, 1.9) * 100) / 100;
    out.rainCal = rainCal(site);
    out.rainCatch = out.rainCal.ratio;
    if(out.rainCal.measured !== null) out.why.push({ k:"g", t:"Measured against " + out.rainCal.n + " real rain days",
      m:"The forecast promised " + Units.water(out.rainCal.forecastIn) + ' over those days and you recorded ' + Units.water(out.rainCal.observedIn) +
        ' here — about ' + Math.round(out.rainCal.measured * 100) + "%. That is what the watering call now assumes, instead of trusting the forecast at face value." });
    out.frostEvidence = frostEvidence(site);

    if(out.waterFactor >= 1.12) out.why.push({ k:"w", t:"Dries out faster than the rest of the garden",
      m:"Wind, sun and slope here add up to about " + Math.round((out.waterFactor - 1) * 100) + "% more water than a sheltered flat bed needs. Mulch is worth more here than anywhere else." });
    if(out.waterFactor <= 0.9) out.why.push({ k:"g", t:"Holds moisture longer",
      m:"About " + Math.round((1 - out.waterFactor) * 100) + "% less water than an open bed. Water less often and watch for rot rather than drought." });
    if(out.rainCatch <= 0.7) out.why.push({ k:"w", t:"Rain does not reach this spot",
      m:(site.canopy === "eaves"
        ? "Under eaves or a roof overhang, roughly three-quarters of the rain never lands here. This bed is effectively hand-watered year round."
        : "Tree canopy intercepts a good third of the rainfall before it reaches the soil, and the roots above are drinking too.") });

    /* ---- frost ---- */
    let sLast = 0, sFirst = 0;
    if(site.frost_pocket === "pocket"){ sLast += 9; sFirst -= 9;
      out.why.push({ k:"d", t:"Cold air collects here",
        m:"Cold air is heavy and flows downhill until something dams it. A low or enclosed spot frosts first in autumn and last in spring — plan roughly a week either side of the garden's average dates." }); }
    else if(site.frost_pocket === "slight"){ sLast += 4; sFirst -= 4; }
    else if(site.frost_pocket === "elevated"){ sLast -= 3; sFirst += 3;
      out.why.push({ k:"g", t:"Cold air drains away",
        m:"Air moves off this spot rather than pooling in it, which buys a few frost-free days at both ends of the season." }); }

    if(site.reflect === "strong"){ sLast -= 5; sFirst += 5;
      out.why.push({ k:"g", t:"A wall works as a storage heater",
        m:"Masonry soaks up sun all day and releases it overnight. A south-facing wall commonly runs a week ahead of open ground in spring and holds tender crops later in autumn." }); }
    else if(site.reflect === "some"){ sLast -= 2; sFirst += 2; }

    if(site.canopy === "tree" || site.canopy === "eaves"){ sLast -= 3; sFirst += 3;
      out.why.push({ k:"i", t:"Overhead cover blunts radiation frost",
        m:"Anything overhead reflects heat back down on a clear night, so this spot escapes light frosts that catch open beds." }); }

    if(slope >= 4 && tiltAz !== null){
      const southish = Math.cos((tiltAz - 180) * D2R);          /* 1 = due south, -1 = due north */
      if(southish > 0.5){ sLast -= 3; sFirst += 3; }
      else if(southish < -0.5){ sLast += 3; sFirst -= 3;
        out.why.push({ k:"w", t:"North-facing slope runs cold",
          m:"Ground tilted away from the sun warms later in spring and cools sooner in autumn. Start heat-lovers elsewhere." }); }
    }

    out.frostShiftLast = clamp(Math.round(sLast), -14, 14);
    out.frostShiftFirst = clamp(Math.round(sFirst), -14, 14);
    out.lastFrost = Season.lastFrost() ? addDays(Season.lastFrost(), out.frostShiftLast) : null;
    out.firstFrost = Season.firstFrost() ? addDays(Season.firstFrost(), out.frostShiftFirst) : null;
    out.seasonShift = out.frostShiftFirst - out.frostShiftLast;

    /* ---- an honest headline ---- */
    if(out.sunKnown){
      out.band = out.sunGrowing >= 6 ? "full sun" : out.sunGrowing >= 4 ? "part sun" : out.sunGrowing >= 2 ? "part shade" : "full shade";
    }
    out.aspect = aspectLabel(hz);
    return out;
  }

  /* ============================================================
     GROUND TRUTH

     A forecast is for a grid square several miles across. Gardeners
     watch it promise half an inch and then walk out to dust. Rather
     than argue with the forecast, the app asks — on the days it said
     rain — what actually landed, and keeps the ratio.

     That single number absorbs two real effects at once: how much
     the forecast runs high over this address, and how much of what
     does fall is intercepted by eaves or canopy before it reaches
     the soil. Both make the same difference to the watering call.
     Until there is enough evidence it stays out of the way and the
     canopy estimate stands.
     ============================================================ */
  function rainCal(site){
    const est = CANOPY[site.canopy] === undefined ? 1 : CANOPY[site.canopy];
    const obs = (Array.isArray(site.rain_obs) ? site.rain_obs : [])
      .filter(o => o && num(o.f, 0) >= 0.05);
    const fc = obs.reduce((a, o) => a + num(o.f, 0), 0);
    const ob = obs.reduce((a, o) => a + num(o.o, 0), 0);
    if(obs.length < 3 || fc < 0.3) return { ratio: est, measured: null, n: obs.length, est: est, source:"estimated" };
    const measured = clamp(ob / fc, 0.05, 1.35);
    /* eight confirmed rain days is enough to trust the record outright;
       fewer and it is blended with the estimate rather than replacing it */
    const wt = Math.min(1, obs.length / 8);
    return {
      ratio: Math.round((est * (1 - wt) + measured * wt) * 100) / 100,
      measured: Math.round(measured * 100) / 100,
      n: obs.length, est: est, weight: Math.round(wt * 100) / 100,
      forecastIn: Math.round(fc * 100) / 100, observedIn: Math.round(ob * 100) / 100,
      source: wt >= 1 ? "measured" : "measured and estimated"
    };
  }

  /* how far the forecast itself runs off at this address, judged from the
     most open surveyed spot — the one where nothing overhead can be blamed */
  function rainBias(){
    const rows = DB.all("sites").map(decode);
    const open = rows.filter(r => (r.canopy || "open") === "open");
    const pool = (open.length ? open : rows);
    const obs = [];
    pool.forEach(r => (Array.isArray(r.rain_obs) ? r.rain_obs : []).forEach(o => { if(o && num(o.f, 0) >= 0.05) obs.push(o); }));
    if(obs.length < 4) return null;
    const fc = obs.reduce((a, o) => a + num(o.f, 0), 0);
    const ob = obs.reduce((a, o) => a + num(o.o, 0), 0);
    if(fc < 0.5) return null;
    return { ratio: Math.round(ob / fc * 100) / 100, n: obs.length,
             forecastIn: Math.round(fc * 100) / 100, observedIn: Math.round(ob * 100) / 100,
             clean: open.length > 0 };
  }

  /* frost is the other thing a forecast gets wrong locally, and the one
     the gardener notices most. Evidence is recorded and a change is
     SUGGESTED — never applied behind her back. */
  function frostEvidence(site){
    const obs = (Array.isArray(site.frost_obs) ? site.frost_obs : []).filter(Boolean);
    if(!obs.length) return { n: 0, suggest: null };
    let colder = 0, warmer = 0;
    obs.forEach(o => {
      const low = num(o.low, 40);
      if(o.frost === true && low > 34) colder++;
      else if(o.frost === false && low <= 32) warmer++;
    });
    const order = ["elevated", "none", "slight", "pocket"];
    const at = Math.max(0, order.indexOf(site.frost_pocket || "none"));
    let suggest = null, msg = null;
    if(colder - warmer >= 2 && at < 3){
      suggest = order[at + 1];
      msg = "Frost has caught this spot " + colder + " times on nights the forecast low stayed above freezing. That is what a cold pocket looks like.";
    } else if(warmer - colder >= 2 && at > 0){
      suggest = order[at - 1];
      msg = "This spot has escaped frost " + warmer + " times on nights the forecast said freezing. It is running warmer than the garden average.";
    }
    return { n: obs.length, colder: colder, warmer: warmer, suggest: suggest, msg: msg };
  }

  /* which way the sky is most open — the plain-English aspect */
  function aspectLabel(hz){
    if(!hz || !hz.length) return null;
    let best = 0, bestV = 999;
    SECTOR_AZ.forEach((az, i) => { const v = num(hz[i], 0); if(v < bestV){ bestV = v; best = i; } });
    let worst = 0, worstV = -1;
    SECTOR_AZ.forEach((az, i) => { const v = num(hz[i], 0); if(v > worstV){ worstV = v; worst = i; } });
    if(worstV < 5) return "open on every side";
    return "opens to the " + ({N:"north",NE:"north-east",E:"east",SE:"south-east",S:"south",SW:"south-west",W:"west",NW:"north-west"})[SECTORS[best]] +
      ", closed to the " + ({N:"north",NE:"north-east",E:"east",SE:"south-east",S:"south",SW:"south-west",W:"west",NW:"north-west"})[SECTORS[worst]];
  }

  /* ---------- cached lookups the rest of the app calls ---------- */
  const api = {
    SECTORS: SECTORS, SECTOR_AZ: SECTOR_AZ, DEFAULTS: DEFAULTS, LABELS: LABELS,
    _cache: {},

    row: row, save: save, clear: clear, profile: profile, aspectLabel: aspectLabel,
    encode: encode, decode: decode, growMonths: growMonths,
    rainCal: rainCal, rainBias: rainBias, frostEvidence: frostEvidence,

    /* every spot with a profile, plot or bed */
    sites(){
      return DB.all("sites").map(decode).map(s => Object.assign({}, s, {
        name: s.scope === "plot" ? ((DB.find("plots", s.ref_id) || {}).name || null)
                                 : ((DB.find("beds", s.ref_id) || {}).name || null)
      })).filter(s => s.name);
    },

    /* append one confirmed rain day. Re-answering a day replaces it. */
    logRain(scope, refId, dateISO, forecastIn, observedIn){
      const s = row(scope, refId); if(!s) return null;
      const obs = (Array.isArray(s.rain_obs) ? s.rain_obs : []).filter(o => o && o.d !== dateISO);
      obs.push({ d: dateISO, f: Math.round(num(forecastIn, 0) * 100) / 100,
                 o: Math.round(clamp(num(observedIn, 0), 0, 20) * 100) / 100 });
      obs.sort((a, b) => String(a.d).localeCompare(String(b.d)));
      const saved = save(scope, refId, { rain_obs: obs.slice(-60) });
      api.invalidate();
      return saved;
    },
    logFrost(scope, refId, dateISO, forecastLow, frosted){
      const s = row(scope, refId); if(!s) return null;
      const obs = (Array.isArray(s.frost_obs) ? s.frost_obs : []).filter(o => o && o.d !== dateISO);
      obs.push({ d: dateISO, low: Math.round(num(forecastLow, 40)), frost: !!frosted });
      obs.sort((a, b) => String(a.d).localeCompare(String(b.d)));
      const saved = save(scope, refId, { frost_obs: obs.slice(-40) });
      api.invalidate();
      return saved;
    },
    answered(s, kind, dateISO){
      const arr = Array.isArray(s[kind === "rain" ? "rain_obs" : "frost_obs"]) ? s[kind === "rain" ? "rain_obs" : "frost_obs"] : [];
      return arr.some(o => o && o.d === dateISO);
    },

    /* everything derived for a bed, memoised per render pass */
    forBed(bedId){
      if(!bedId) return null;
      if(api._cache[bedId] !== undefined) return api._cache[bedId];
      const p = profile(bedId);
      return (api._cache[bedId] = p ? derive(p) : null);
    },
    forPlot(plotId){
      const s = row("plot", plotId);
      return s ? derive(Object.assign({}, DEFAULTS, s)) : null;
    },
    derive: derive,
    invalidate(){ api._cache = {}; },

    /* the sun figure the rest of the app should use for a bed:
       the surveyed number when there is one, the gardener's own otherwise */
    sunHours(bedId){
      const bed = DB.find("beds", bedId);
      const d = api.forBed(bedId);
      if(d && d.sunKnown && !d.site.sun_override) return d.sunGrowing;
      return bed ? num(bed.sun_hours, 8) : 8;
    },
    sunSource(bedId){
      const d = api.forBed(bedId);
      return (d && d.sunKnown && !d.site.sun_override) ? "surveyed" : "entered";
    },

    /* frost dates for one bed rather than the whole county */
    frostFor(bedId){
      const d = api.forBed(bedId);
      if(!d) return { last: Season.lastFrost(), first: Season.firstFrost(), shifted: false };
      return { last: d.lastFrost || Season.lastFrost(), first: d.firstFrost || Season.firstFrost(),
               shifted: !!(d.frostShiftLast || d.frostShiftFirst),
               shiftLast: d.frostShiftLast, shiftFirst: d.frostShiftFirst };
    },
    daysLeft(bedId){
      const f = api.frostFor(bedId);
      return f.first ? diffDays(today(), f.first) : null;
    },

    /* a one-line summary for a card */
    chip(bedId){
      const d = api.forBed(bedId);
      if(!d) return null;
      const bits = [];
      if(d.sunKnown) bits.push(d.sunGrowing + "h sun");
      if(d.waterFactor !== 1) bits.push((d.waterFactor > 1 ? "+" : "") + Math.round((d.waterFactor - 1) * 100) + "% water");
      if(d.rainCatch < 1) bits.push(Math.round((1 - d.rainCatch) * 100) + "% rain blocked");
      if(d.seasonShift) bits.push((d.seasonShift > 0 ? "+" : "") + d.seasonShift + "d season");
      return bits.join(" · ");
    },

    /* has anything been surveyed at all? */
    any(){ return DB.count("sites") > 0; },
    hasFor(bedId){ return !!profile(bedId); }
  };
  return api;
})();

/* ============================================================
   WIRING — the profile has to actually change the advice, or it
   is just a form. Both wrappers are additive: with no profile
   they hand straight back to the original behaviour.
   ============================================================ */
(function wireRecommend(){

  /* ---- watering: crop need scaled by the site, rain scaled by what reaches it ---- */
  const origWater = Recommend.water;
  Recommend.water = function(bedId, weather){
    const base = origWater.call(Recommend, bedId, weather);
    if(!base) return base;
    const d = Micro.forBed(bedId);
    if(!d) return base;

    const need = Math.round(base.need * d.waterFactor * 100) / 100;
    const rain = Math.round(base.rain * d.rainCatch * 100) / 100;
    const deficit = Math.round((need - rain - base.logged) * 100) / 100;
    const why = [];
    if(d.waterFactor !== 1) why.push(
      (d.waterFactor > 1 ? "Needs " + Math.round((d.waterFactor - 1) * 100) + "% more" : "Needs " + Math.round((1 - d.waterFactor) * 100) + "% less") +
      " than the crop table alone — " +
      [ d.site.wind_exposure === "exposed" || d.site.wind_exposure === "breezy" ? "wind here" : null,
        d.sunKnown && d.sunShare >= 0.95 ? "an open sky all day" : null,
        d.site.reflect !== "none" ? "reflected heat" : null,
        num(d.site.slope_pct, 0) >= 4 ? "runoff down the slope" : null,
        d.site.drainage === "fast" ? "fast-draining soil" : null,
        d.site.drainage === "slow" || d.site.drainage === "boggy" ? "soil that holds water" : null
      ].filter(Boolean).join(", ") + ".");
    if(d.rainCatch < 1) why.push("Only about " + Math.round(d.rainCatch * 100) + "% of rainfall reaches this spot" +
      (d.site.canopy === "eaves" ? " — it sits under an overhang." : " — the canopy above takes the rest."));

    return Object.assign({}, base, {
      need: need, rain: rain, deficit: deficit,
      verdict: deficit <= 0.05 ? "skip" : (deficit < 0.5 ? "light" : "water"),
      baseNeed: base.need, baseRain: base.rain,
      micro: { factor: d.waterFactor, rainCatch: d.rainCatch, why: why }
    });
  };

  /* ---- recommendations: surveyed sun, and this bed's own frost dates ---- */
  const origNow = Recommend.now;
  Recommend.now = function(opts){
    const o = Object.assign({}, opts || {});
    const d = o.bedId ? Micro.forBed(o.bedId) : null;
    if(d && d.sunKnown && o.sun === undefined) o.sun = d.sunGrowing;
    const out = origNow.call(Recommend, o);
    if(!d) return out;

    const left = Micro.daysLeft(o.bedId);
    out.forEach(r => {
      if(d.sunKnown) r.why.push("☀️ " + d.sunGrowing + "h of surveyed sun here in season" +
        (d.lost >= 1 ? " (" + d.lost + "h less than open ground)" : ""));
      /* the frost window this bed actually gets, not the county's */
      if(left !== null && d.frostShiftFirst){
        const needs = r.crop.dtm;
        if(left < needs + 7 && r.window.kind !== "fall" && r.window.kind !== "indoor"){
          r.score -= 10;
          r.warn.push("This spot frosts " + Math.abs(d.frostShiftFirst) + " days " +
            (d.frostShiftFirst < 0 ? "earlier" : "later") + " than the garden average — " + left + " days left, and it needs " + needs + ".");
        } else if(d.frostShiftFirst > 0){
          r.score += 3;
          r.why.push("🍂 Frost holds off about " + d.frostShiftFirst + " days longer here.");
        }
      }
      if(d.waterFactor >= 1.15 && r.crop.water >= 1.2){
        r.score -= 6;
        r.warn.push("Thirsty crop in a spot that dries fast — mulch heavily or pick somewhere else.");
      }
      if(d.rainCatch <= 0.4){
        r.warn.push("Rain barely reaches this spot; everything here is hand-watered.");
      }
    });
    return out.sort((a, b) => b.score - a.score);
  };
})();
</script>
