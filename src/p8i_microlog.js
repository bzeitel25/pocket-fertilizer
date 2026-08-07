<script>
/* ============================================================
   MICRO-CLIMATE — ground truth

   "The forecast said rain and we got none at our house" is the
   most common complaint any gardener has about weather data, and
   it is usually true: a forecast cell is several miles across and
   a summer shower is not.

   So the app stops treating the forecast as fact. On days it said
   rain, it asks what actually landed — per surveyed spot, because
   the bed under the eaves and the bed in the open do not get the
   same answer. The running ratio feeds straight back into the
   watering call. Same for frost: the nights it warned about get
   a yes or no, and enough surprises earn a suggestion that the
   spot is a cold pocket.

   Nothing is ever inferred from silence. An unanswered day is
   simply not counted.
   ============================================================ */
const MicroLog = {

  RAIN_MIN: 0.05,     /* inches — below this there is nothing to confirm */
  FROST_WATCH: 38,    /* °F forecast low worth asking about */
  WINDOW: 7,          /* days back the forecast payload actually covers */

  /* ---------- what still needs an answer ---------- */
  pending(){
    const w = APP.weather;
    const sites = Micro.sites();
    if(!w || !w.daily || !w.daily.time || !sites.length) return [];
    const d = w.daily, out = [];
    d.time.forEach((t, i) => {
      const dd = diffDays(today(), parseISO(t));
      if(dd >= 0 || dd < -MicroLog.WINDOW) return;               /* past days only */
      const rain = num(d.precipitation_sum[i], 0);
      const low = d.temperature_2m_min ? num(d.temperature_2m_min[i], 99) : 99;
      sites.forEach(s => {
        if(rain >= MicroLog.RAIN_MIN && !Micro.answered(s, "rain", t))
          out.push({ kind:"rain", date: t, site: s, forecast: Math.round(rain * 100) / 100, ago: Math.abs(dd) });
        if(low <= MicroLog.FROST_WATCH && !Micro.answered(s, "frost", t))
          out.push({ kind:"frost", date: t, site: s, low: Math.round(low), ago: Math.abs(dd) });
      });
    });
    return out.sort((a, b) => a.ago - b.ago || String(a.site.name).localeCompare(String(b.site.name)));
  },

  /* ---------- the card that appears on the weather screen ---------- */
  card(){
    const p = MicroLog.pending();
    const bias = Micro.rainBias();
    if(!p.length && !bias) return "";
    let h = '<div class="card" style="margin-top:12px">';
    if(p.length){
      const rain = p.filter(x => x.kind === "rain").length, frost = p.length - rain;
      h += '<div class="row between"><div class="grow"><div class="b">📏 Did that actually happen here?</div>' +
        '<div class="tiny muted">' +
        [rain ? rain + " rain day" + (rain > 1 ? "s" : "") : null,
         frost ? frost + " cold night" + (frost > 1 ? "s" : "") : null].filter(Boolean).join(" · ") +
        ' to confirm. Your answers tune the watering call for each spot.</div></div>' +
        '<button class="btn sm" onclick="MicroLog.open()">Confirm</button></div>';
    }
    if(bias){
      const pct = Math.round(bias.ratio * 100);
      h += '<div class="note ' + (bias.ratio < 0.8 ? "w" : bias.ratio > 1.2 ? "i" : "g") + '" style="margin-top:' + (p.length ? "10px" : "0") + '">' +
        '🌧️ <b>The forecast at your address.</b> Over ' + bias.n + ' rain days it promised ' + Units.water(bias.forecastIn) +
        ' and you recorded ' + Units.water(bias.observedIn) + ' — about <b>' + pct + '%</b>. ' +
        (bias.ratio < 0.8 ? "The watering call already discounts it by that much."
         : bias.ratio > 1.2 ? "It has been running low here, and the watering call allows for that."
         : "Close enough to trust as it stands.") +
        (bias.clean ? "" : " Measured in spots with something overhead, so part of the gap is interception rather than the forecast.") +
        '</div>';
    }
    h += '</div>';
    return h;
  },

  /* ---------- the confirmation sheet ---------- */
  open(){
    const p = MicroLog.pending();
    if(!p.length){ toast("Nothing left to confirm"); return; }
    MicroLog.queue = p;
    MicroLog.i = 0;
    MicroLog.step();
  },

  step(){
    const q = MicroLog.queue || [];
    if(MicroLog.i >= q.length) return MicroLog.done();
    const it = q[MicroLog.i];
    const left = q.length - MicroLog.i;

    let h = '<div class="row between" style="margin-bottom:12px"><div class="grow">' +
      '<div class="b">' + esc(it.site.name) + '</div>' +
      '<div class="tiny muted">' + fmt(it.date) + ' · ' + it.ago + ' day' + (it.ago > 1 ? "s" : "") + ' ago</div></div>' +
      '<div style="font-size:2rem">' + (it.kind === "rain" ? "🌧️" : "🥶") + '</div></div>';

    if(it.kind === "rain"){
      h += '<div class="note i">The forecast recorded <b>' + Units.water(it.forecast) + '</b> of rain for the garden that day. How much actually landed here?</div>';
      h += '<div class="row wrap" style="gap:6px;margin-top:12px">' +
        MicroLog.chips(it.forecast).map(c =>
          '<button class="chip" onclick="MicroLog.setAmount(' + c[1] + ')">' + esc(c[0]) + '</button>').join("") +
        '</div>';
      h += '<div class="field" style="margin-top:12px"><label class="f">Inches</label>' +
        '<input type="number" id="ml-amt" step="' + Units.waterStep() + '" min="0" max="' + Units.outWater(20) + '" value="' + Units.outWater(it.forecast) + '"></div>';
      h += '<div class="tiny muted" style="margin-top:6px">A rain gauge is ideal, but an honest guess beats trusting a forecast cell several miles wide. Answer for this spot — a bed under the eaves gets less than the one beside it.</div>';
      h += '<div class="row" style="gap:8px;margin-top:16px">' +
        '<button class="btn ghost" onclick="MicroLog.skip()">Not sure</button>' +
        '<button class="btn grow" onclick="MicroLog.saveRain()">Save</button></div>';
    } else {
      h += '<div class="note i">The forecast low for the garden that night was <b>' + Units.temp(it.low) + '</b>. Did this spot actually take a frost?</div>';
      h += '<div class="row" style="gap:8px;margin-top:14px">' +
        '<button class="btn grow" onclick="MicroLog.saveFrost(true)">❄️ Yes, it frosted</button>' +
        '<button class="btn ghost grow" onclick="MicroLog.saveFrost(false)">No frost here</button></div>';
      h += '<button class="btn outline block" style="margin-top:8px" onclick="MicroLog.skip()">Not sure / was not here</button>';
      h += '<div class="tiny muted" style="margin-top:8px">Cold air runs downhill and pools. A spot that frosts on a night the forecast called safe is telling you something no zone map can.</div>';
    }
    h += '<div class="tiny muted center" style="margin-top:12px">' + left + ' left</div>';
    openSheet("Confirm what happened", h);
  },

  /* the quick answers are offered in whatever unit the box is showing,
     so tapping one and typing by hand cannot mean two different things */
  chips(f){
    const u = v => Units.outWater(v);
    return [["None at all", 0], ["A trace", u(0.02)],
            ["About a quarter", u(f * 0.25)],
            ["About half", u(f * 0.5)],
            ["All of it", u(f)]];
  },
  setAmount(v){ const el = $("#ml-amt"); if(el) el.value = v; },

  saveRain(){
    const it = MicroLog.queue[MicroLog.i];
    const v = Units.inWater(num(($("#ml-amt") || {}).value, 0));
    Micro.logRain(it.site.scope, it.site.ref_id, it.date, it.forecast, v);
    MicroLog.i++; MicroLog.step();
  },
  saveFrost(yes){
    const it = MicroLog.queue[MicroLog.i];
    Micro.logFrost(it.site.scope, it.site.ref_id, it.date, it.low, yes);
    MicroLog.i++; MicroLog.step();
  },
  skip(){ MicroLog.i++; MicroLog.step(); },

  done(){
    Micro.invalidate();
    const notes = [];
    Micro.sites().forEach(s => {
      const cal = Micro.rainCal(s);
      if(cal.measured !== null) notes.push('<div class="note g" style="margin-bottom:8px">🌧️ <b>' + esc(s.name) + '</b> receives about <b>' +
        Math.round(cal.measured * 100) + '%</b> of the forecast rain, over ' + cal.n + ' confirmed days. The watering call for it has been adjusted.</div>');
      const fe = Micro.frostEvidence(s);
      if(fe.suggest) notes.push('<div class="note w" style="margin-bottom:8px">🥶 <b>' + esc(s.name) + '.</b> ' + esc(fe.msg) +
        '<br><button class="btn sm" style="margin-top:8px" onclick="MicroLog.applyFrost(\'' + s.scope + '\',\'' + s.ref_id + '\',\'' + fe.suggest + '\')">Record it as ' +
        esc(Micro.LABELS.frost_pocket[fe.suggest]) + '</button></div>');
    });
    if(!notes.length){
      closeSheet();
      Garden.render(); if(APP.tab === "weather") Weather.render();
      return toast("Recorded — thank you 📏");
    }
    openSheet("What that changes",
      '<p class="muted sm" style="margin-top:0">Your answers are now part of this garden\'s own record, and they outrank the forecast.</p>' +
      notes.join("") +
      '<button class="btn block" style="margin-top:12px" onclick="closeSheet();Garden.render();if(APP.tab===\'weather\')Weather.render()">Done</button>');
  },

  applyFrost(scope, refId, level){
    Micro.save(scope, refId, { frost_pocket: level });
    Micro.invalidate();
    closeSheet();
    Garden.render(); if(APP.tab === "weather") Weather.render();
    toast("Recorded — frost dates for that spot have moved");
  }
};

/* the ask belongs on the weather screen, where the forecast it doubts is */
(function wireWeather(){
  const orig = Weather.render;
  Weather.render = function(){
    orig.call(Weather);
    const box = $("#s-weather"); if(!box) return;
    const card = MicroLog.card(); if(!card) return;
    const sec = box.querySelector(".sec");
    if(sec) sec.insertAdjacentHTML("beforebegin", card);
    else box.insertAdjacentHTML("beforeend", card);
  };
})();

/* and a way in from the micro-climate sheet itself */
(function wireSummary(){
  const orig = MicroUI.summary;
  MicroUI.summary = function(d){
    let h = orig.call(MicroUI, d);
    if(!d) return h;
    const cal = d.rainCal || {};
    const fe = d.frostEvidence || {};
    let extra = '<div class="card" style="margin-top:12px"><div class="row between">' +
      '<div class="grow"><div class="b">📏 Ground truth</div><div class="tiny muted">' +
      (cal.measured !== null && cal.measured !== undefined
        ? cal.n + ' confirmed rain day' + (cal.n > 1 ? "s" : "") + ' · this spot gets ' + Math.round(cal.measured * 100) + '% of the forecast'
        : 'No rain days confirmed yet — the app is using the estimate from what is overhead.') +
      (fe.n ? ' · ' + fe.n + ' cold night' + (fe.n > 1 ? "s" : "") + ' logged' : '') +
      '</div></div>' +
      '<button class="btn sm ghost" onclick="MicroLog.open()">Confirm</button></div>';
    if(cal.measured === null || cal.measured === undefined)
      extra += '<div class="note i tiny" style="margin-top:10px">On any day the forecast says rain, the app will ask what actually landed here. After three answers it stops trusting the forecast and starts trusting you.</div>';
    extra += '</div>';
    return h + extra;
  };
})();
</script>
