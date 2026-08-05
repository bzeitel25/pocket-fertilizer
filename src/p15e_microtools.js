<script>
/* ============================================================
   MICRO-CLIMATE — assistant tools

   The gardener can talk her way through the survey: "the front bed
   is against a south wall and never gets rain" is a complete answer
   and should not require finding a form. The tools are deliberately
   narrow — they set the same fields the form sets, nothing more, and
   they refuse to invent a number that was not offered.
   ============================================================ */
AI_TOOLS.push(
  { name:"get_microclimate",
    description:"The micro-climate profile of a plot or bed: real calculated sun hours by month, how much more or less water it needs than the crop table alone, how much rain actually reaches it, and its own frost dates. Call this before advising on watering, siting a crop, or anything about sun and shade in a specific spot. With no argument it lists every surveyed spot.",
    parameters:{ type:"OBJECT", properties:{
      bed:{ type:"STRING", description:"Bed name." },
      plot:{ type:"STRING", description:"Plot name, e.g. 'front of house'." }
    } } },

  { name:"set_microclimate",
    description:"Record or correct micro-climate facts the gardener has just told you about a plot or bed. Only pass fields she actually stated — never guess. Sun hours are calculated from the skyline, so do not try to set them directly; describe what blocks the sky instead.",
    parameters:{ type:"OBJECT", properties:{
      plot:{ type:"STRING", description:"Plot name. Prefer this — beds inherit from the plot." },
      bed:{ type:"STRING", description:"Bed name, only when this one bed differs from the rest of its plot." },
      blocked_north:{ type:"NUMBER", description:"Degrees above the horizon blocked to the north (fence ~10, house ~40, tall tree ~60, open sky 0)." },
      blocked_east:{ type:"NUMBER" }, blocked_south:{ type:"NUMBER" }, blocked_west:{ type:"NUMBER" },
      blocked_northeast:{ type:"NUMBER" }, blocked_southeast:{ type:"NUMBER" },
      blocked_southwest:{ type:"NUMBER" }, blocked_northwest:{ type:"NUMBER" },
      slope_percent:{ type:"NUMBER", description:"0 for flat, ~5 slight, ~12 moderate, ~25 steep." },
      slope_downhill:{ type:"STRING", enum:["N","NE","E","SE","S","SW","W","NW"] },
      wind:{ type:"STRING", enum:["sheltered","normal","breezy","exposed"] },
      overhead:{ type:"STRING", enum:["open","partial","tree","eaves"], description:"'eaves' means under a roof overhang, where rain does not land." },
      reflected_heat:{ type:"STRING", enum:["none","some","strong"], description:"'strong' for a bed right against a sunny masonry wall." },
      drainage:{ type:"STRING", enum:["fast","normal","slow","boggy"] },
      cold_air:{ type:"STRING", enum:["elevated","none","slight","pocket"], description:"'pocket' when cold air visibly settles there — it frosts first." },
      surface:{ type:"STRING", enum:["soil","lawn","mulch","gravel","paving","deck"] },
      notes:{ type:"STRING" }
    } } },

  { name:"survey_microclimate",
    description:"Open the guided photo survey on screen for a plot or bed, so the gardener can walk out and shoot the four directions. Use when she asks to survey, scan or photograph a space.",
    parameters:{ type:"OBJECT", properties:{
      plot:{ type:"STRING" }, bed:{ type:"STRING" }
    } } },

  { name:"log_real_rain",
    description:"Record what rain ACTUALLY fell at a spot on a day the forecast called for some — the gardener's own reading beats the forecast, which is drawn for a grid square miles across. Use whenever she says something like 'it was supposed to rain yesterday but we got nothing'. After three confirmed days the app stops trusting the forecast for that spot.",
    parameters:{ type:"OBJECT", properties:{
      plot:{ type:"STRING" }, bed:{ type:"STRING" },
      date:{ type:"STRING", description:"YYYY-MM-DD. Defaults to yesterday." },
      inches:{ type:"NUMBER", description:"What actually fell. 0 for none." }
    }, required:["inches"] } }
);

(function microTools(){
  const orig = Assist.run.bind(Assist);

  const DIR_KEY = { blocked_north:0, blocked_northeast:1, blocked_east:2, blocked_southeast:3,
                    blocked_south:4, blocked_southwest:5, blocked_west:6, blocked_northwest:7 };

  function findPlot(s){
    const plots = DB.all("plots");
    if(!s) return null;
    const q = String(s).toLowerCase().trim();
    return plots.find(p => (p.name || "").toLowerCase() === q)
        || plots.find(p => (p.name || "").toLowerCase().indexOf(q) >= 0)
        || plots.find(p => q.indexOf((p.name || "").toLowerCase()) >= 0)
        || null;
  }

  function report(d, label){
    if(!d) return { ok:true, surveyed:false, spot: label,
      note:"No micro-climate survey for this spot yet. It is using the garden's county-wide zone and frost dates. Offer to survey it — survey_microclimate opens the guided photo survey." };
    const s = d.site;
    return { ok:true, surveyed:true, spot: label,
      recorded_by: s.method || "unknown", confidence: s.confidence || null,
      sun_hours_in_season: d.sunKnown ? d.sunGrowing : null,
      sun_hours_by_month: d.sunKnown ? d.sunByMonth : null,
      sun_hours_open_site_would_get: d.sunKnown ? d.sunOpen : null,
      light_band: d.band || null,
      aspect: d.aspect || null,
      skyline_blocked_degrees: (function(){
        const o = {}; Micro.SECTORS.forEach((k, i) => o[k] = num(s.horizon && s.horizon[i], 0)); return o;
      })(),
      slope_percent: num(s.slope_pct, 0),
      water_multiplier: d.waterFactor,
      share_of_rain_that_lands_here: d.rainCatch,
      wind: s.wind_exposure, overhead: s.canopy, reflected_heat: s.reflect,
      drainage: s.drainage, cold_air: s.frost_pocket,
      last_frost_here: d.lastFrost ? iso(d.lastFrost) : null,
      first_frost_here: d.firstFrost ? iso(d.firstFrost) : null,
      season_days_vs_garden_average: d.seasonShift,
      reasons: d.why.map(w => w.t + " — " + w.m),
      notes: s.notes || null,
      guidance:"These figures already feed the watering call and the crop recommendations for this spot. Quote them; do not recalculate them." };
  }

  Assist.run = async function(name, args){
    args = args || {};

    if(name === "get_microclimate"){
      Micro.invalidate();
      if(args.bed){
        const b = Assist.findBed(args.bed);
        if(!b) return { ok:false, error:"No bed matching '" + args.bed + "'." };
        return report(Micro.forBed(b.id), b.name);
      }
      if(args.plot){
        const p = findPlot(args.plot);
        if(!p) return { ok:false, error:"No plot matching '" + args.plot + "'. Plots: " + (DB.all("plots").map(x => x.name).join(", ") || "none yet") };
        return report(Micro.forPlot(p.id), p.name);
      }
      const rows = DB.all("sites");
      if(!rows.length) return { ok:true, surveyed_spots: 0,
        note:"Nothing has been surveyed yet. Every bed is using the garden's county-wide zone, which cannot tell the front of the house from the back." };
      return { ok:true, surveyed_spots: rows.length,
        spots: rows.map(r => {
          const nm = r.scope === "plot" ? (DB.find("plots", r.ref_id) || {}).name : (DB.find("beds", r.ref_id) || {}).name;
          const d = r.scope === "plot" ? Micro.forPlot(r.ref_id) : Micro.forBed(r.ref_id);
          return { scope: r.scope, name: nm || "(deleted)",
                   sun_hours_in_season: d && d.sunKnown ? d.sunGrowing : null,
                   water_multiplier: d ? d.waterFactor : null,
                   season_days_vs_average: d ? d.seasonShift : null };
        }) };
    }

    if(name === "set_microclimate"){
      let scope = null, refId = null, label = "";
      if(args.bed){
        const b = Assist.findBed(args.bed);
        if(!b) return { ok:false, error:"No bed matching '" + args.bed + "'." };
        scope = "bed"; refId = b.id; label = b.name;
      } else if(args.plot){
        const p = findPlot(args.plot);
        if(!p) return { ok:false, error:"No plot matching '" + args.plot + "'. Plots: " + (DB.all("plots").map(x => x.name).join(", ") || "none yet") +
          ". Create the plot in the Garden tab first." };
        scope = "plot"; refId = p.id; label = p.name;
      } else return { ok:false, error:"Say which plot or bed this describes." };

      const existing = Micro.row(scope, refId);
      const patch = Object.assign({}, Micro.DEFAULTS, existing || {});
      const hz = Array.isArray(patch.horizon) ? patch.horizon.slice() : [0,0,0,0,0,0,0,0];
      const touched = [];

      Object.keys(DIR_KEY).forEach(k => {
        if(args[k] === undefined || args[k] === null) return;
        hz[DIR_KEY[k]] = clamp(Math.round(num(args[k], 0)), 0, 85);
        touched.push(k.replace("blocked_", "") + " " + hz[DIR_KEY[k]] + "°");
      });
      patch.horizon = hz;

      if(args.slope_percent !== undefined && args.slope_percent !== null){
        patch.slope_pct = clamp(Math.round(num(args.slope_percent, 0)), 0, 60); touched.push("slope " + patch.slope_pct + "%"); }
      if(args.slope_downhill){
        const i = Micro.SECTORS.indexOf(args.slope_downhill);
        if(i >= 0){ patch.slope_dir = Micro.SECTOR_AZ[i]; touched.push("downhill " + args.slope_downhill); } }
      [["wind","wind_exposure"],["overhead","canopy"],["reflected_heat","reflect"],
       ["drainage","drainage"],["cold_air","frost_pocket"],["surface","surface"]].forEach(pair => {
        if(args[pair[0]]){ patch[pair[1]] = args[pair[0]]; touched.push(pair[0] + " " + args[pair[0]]); } });
      if(args.notes) patch.notes = ((patch.notes ? patch.notes + " " : "") + args.notes).slice(0, 900);

      if(!touched.length && !args.notes)
        return { ok:false, error:"Nothing was passed to record. Ask the gardener what actually blocks the sky, or open the photo survey." };

      patch.method = existing && existing.method && /photo survey/.test(existing.method)
        ? existing.method + " + assistant" : "told to the assistant";
      patch.confidence = "gardener";
      delete patch.id; delete patch.created;
      Micro.save(scope, refId, patch);
      Micro.invalidate();
      Assist.remember("recorded micro-climate for " + label + " (" + touched.join(", ") + ")");
      if(APP.tab === "garden") Garden.render();

      const d = scope === "plot" ? Micro.forPlot(refId) : Micro.forBed(refId);
      return Object.assign({ ok:true, updated: label, fields: touched }, report(d, label));
    }

    if(name === "log_real_rain"){
      const targets = [];
      if(args.bed){
        const b = Assist.findBed(args.bed);
        if(!b) return { ok:false, error:"No bed matching '" + args.bed + "'." };
        targets.push({ scope:"bed", ref_id: b.id, name: b.name });
      } else if(args.plot){
        const p = findPlot(args.plot);
        if(!p) return { ok:false, error:"No plot matching '" + args.plot + "'." };
        targets.push({ scope:"plot", ref_id: p.id, name: p.name });
      } else {
        Micro.sites().forEach(s => targets.push(s));
      }
      if(!targets.length) return { ok:false, error:"Nothing is surveyed yet, so there is nowhere to record this. Offer to survey a plot first — survey_microclimate." };

      const date = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : iso(addDays(today(), -1));
      /* the forecast figure has to come from the record, not from the model */
      let fc = null;
      const w = APP.weather;
      if(w && w.daily && w.daily.time){
        const i = w.daily.time.indexOf(date);
        if(i >= 0) fc = Math.round(num(w.daily.precipitation_sum[i], 0) * 100) / 100;
      }
      if(fc === null) return { ok:false, error:"There is no forecast on file for " + date +
        ", so there is nothing to compare against. Only days the forecast covered can be confirmed." };
      if(fc < 0.05) return { ok:true, nothing_to_confirm:true,
        message:"The forecast did not call for meaningful rain on " + date + " either, so there is no discrepancy to record." };

      const inches = clamp(num(args.inches, 0), 0, 20);
      targets.forEach(t => Micro.logRain(t.scope, t.ref_id, date, fc, inches));
      Micro.invalidate();
      Assist.remember("recorded " + inches + '" of real rainfall on ' + date + " for " + targets.map(t => t.name).join(", "));
      if(APP.tab === "weather") Weather.render();
      if(APP.tab === "garden") Garden.render();

      return { ok:true, date: date, forecast_inches: fc, actual_inches: inches,
        recorded_for: targets.map(t => t.name),
        calibration: targets.map(t => {
          const s = Micro.row(t.scope, t.ref_id);
          const c = s ? Micro.rainCal(s) : null;
          return { spot: t.name, confirmed_days: c ? c.n : 0,
                   share_of_forecast_rain_received: c ? c.measured : null,
                   in_use: c ? c.ratio : null };
        }),
        note:"Three confirmed days are needed before the record outweighs the estimate. Say plainly how many she has." };
    }

    if(name === "survey_microclimate"){
      let scope = null, refId = null, label = "";
      if(args.bed){
        const b = Assist.findBed(args.bed);
        if(!b) return { ok:false, error:"No bed matching '" + args.bed + "'." };
        scope = "bed"; refId = b.id; label = b.name;
      } else {
        const p = args.plot ? findPlot(args.plot) : DB.all("plots")[0];
        if(!p) return { ok:false, error:"There are no plots yet. Create one in the Garden tab — a plot is a group of beds that share a spot, like 'front of house'." };
        scope = "plot"; refId = p.id; label = p.name;
      }
      go("garden");
      setTimeout(() => MicroUI.open(scope, refId), 260);
      return { ok:true, opened: label,
        note:"The survey is on screen. Tell her to stand in the middle of the space and shoot north, east, south and west, answering the short question card after each shot." };
    }

    return orig(name, args);
  };
})();

/* --- action labels --- */
(function microLabels(){
  const orig = Assist.label.bind(Assist);
  Assist.label = function(call){
    const a = call.args || {};
    const extra = {
      get_microclimate:"Checking the micro-climate of " + (a.bed || a.plot || "the garden"),
      set_microclimate:"Recording the micro-climate of " + (a.bed || a.plot || "that spot"),
      survey_microclimate:"Opening the photo survey",
      log_real_rain:"Recording what actually fell"
    };
    return extra[call.name] || orig(call);
  };
})();

/* --- the standing instructions gain a micro-climate section --- */
(function microSystem(){
  const orig = Assist.system.bind(Assist);
  Assist.system = function(){
    const rows = DB.all("sites");
    const known = rows.map(r => {
      const nm = r.scope === "plot" ? (DB.find("plots", r.ref_id) || {}).name : (DB.find("beds", r.ref_id) || {}).name;
      return nm ? r.scope + " " + nm : null;
    }).filter(Boolean);

    return orig() + "\n\nMICRO-CLIMATE:\n" +
      "· A hardiness zone describes a county. This garden also records the sun, slope, wind, shelter and frost of individual spots. " +
      (known.length ? "Surveyed so far: " + known.join(", ") + ".\n" : "Nothing is surveyed yet.\n") +
      "· Before any advice about watering, shade, siting a crop or frost timing in a NAMED bed or plot, call get_microclimate for it. The numbers it returns already drive the app's own watering call and recommendations — quote them rather than working them out again.\n" +
      "· Sun hours there are calculated from real solar geometry for this latitude and the skyline the gardener recorded. Never override them with a rule of thumb.\n" +
      "· When she describes a spot in passing — 'it's against the south wall', 'nothing grows there after two o'clock', 'that corner floods' — record it with set_microclimate. Pass only what she said. If she gives no angle for what blocks the sky, ask one short question rather than guessing a number.\n" +
      "· If she wants to survey a space properly, call survey_microclimate; it opens the guided photo walkthrough on screen.\n" +
      "· A forecast covers a grid square miles wide and is routinely wrong about rain over one address. If she says the promised rain never arrived, or arrived and was heavier, call log_real_rain. Her reading outranks the forecast, and after three confirmed days the watering call uses it instead. Never record a rainfall figure she did not give you.";
  };
})();
</script>
