<script>
/* ============================================================
   DAYS TO MATURITY — ranges, and this garden's own averages

   Published days-to-maturity is a single number pretending to be
   precise. It shifts with heat, light, soil and season, and the
   same variety can swing weeks between gardens. So the app shows
   a RANGE, and every time a real first harvest is recorded it
   learns: after one picking it reports what actually happened,
   and after a few it uses her own average for projections
   instead of the catalogue figure.
   ============================================================ */
const Maturity = {
  /* published range — honest about the spread rather than a false point */
  cropRange(cropId){
    const c = crop(cropId); if(!c) return null;
    return { lo: Math.max(15, Math.round(c.dtm * 0.85)), hi: Math.round(c.dtm * 1.15), mid: c.dtm };
  },
  varietyRange(cropId, variety){
    if(!variety) return null;
    const v = Varieties.find(cropId, variety);
    if(!v || !num(v.dtm)) return null;
    const d = num(v.dtm);
    return { lo: Math.max(15, d - 7), hi: d + 10, mid: d };
  },

  /* ---- her own records ---- */
  mine(cropId, variety){
    let rows = DB.where("maturity", m => m.crop_id === cropId);
    if(variety){
      const exact = rows.filter(m => (m.variety || "").toLowerCase() === String(variety).toLowerCase());
      if(exact.length) rows = exact;
    }
    if(!rows.length) return null;
    const days = rows.map(m => num(m.days)).filter(d => d > 0);
    if(!days.length) return null;
    const avg = days.reduce((a, b) => a + b, 0) / days.length;
    return {
      n: days.length, avg: Math.round(avg),
      lo: Math.min.apply(null, days), hi: Math.max.apply(null, days),
      varietySpecific: !!variety && rows.every(m => (m.variety || "").toLowerCase() === String(variety).toLowerCase()),
      last: rows.sort((a, b) => (b.harvested_on || "").localeCompare(a.harvested_on || ""))[0]
    };
  },

  /* what the app should actually use for projections */
  expected(cropId, variety){
    const mine = Maturity.mine(cropId, variety);
    if(mine && mine.n >= 1){
      /* one record is a data point, three is a pattern — weight accordingly */
      const pub = Maturity.varietyRange(cropId, variety) || Maturity.cropRange(cropId);
      const w = Math.min(mine.n, 3) / 3;
      const blended = pub ? Math.round(mine.avg * w + pub.mid * (1 - w)) : mine.avg;
      return {
        days: mine.n >= 3 ? mine.avg : blended,
        lo: Math.min(mine.lo, pub ? pub.lo : mine.lo),
        hi: Math.max(mine.hi, pub ? pub.hi : mine.hi),
        source: mine.n >= 3 ? "yours" : "blend", n: mine.n, mine: mine, pub: pub
      };
    }
    const v = Maturity.varietyRange(cropId, variety);
    if(v) return { days: v.mid, lo: v.lo, hi: v.hi, source:"variety", n: 0, pub: v };
    const c = Maturity.cropRange(cropId);
    if(!c) return null;
    return { days: c.mid, lo: c.lo, hi: c.hi, source:"crop", n: 0, pub: c };
  },

  label(cropId, variety){
    const e = Maturity.expected(cropId, variety);
    if(!e) return "—";
    const tag = { yours:"your average", blend:"your results + catalogue", variety:"this variety", crop:"typical for the crop" }[e.source];
    return e.lo + "–" + e.hi + " days (" + tag + ")";
  },

  /* ---- recording a real first harvest ---- */
  record(plantingId, harvestedOn, note){
    const p = DB.find("plantings", plantingId); if(!p) return null;
    const sown = p.sown_on; if(!sown) return null;
    const hd = harvestedOn || iso(today());
    const days = diffDays(parseISO(sown), parseISO(hd));
    if(!(days > 0)) return null;
    const ex = DB.where("maturity", m => m.planting_id === plantingId)[0];
    const row = { crop_id: p.crop_id, variety: p.variety || null, days: days,
                  sown_on: sown, harvested_on: hd, planting_id: plantingId,
                  bed_id: p.bed_id, note: note || null };
    const saved = ex ? DB.update("maturity", ex.id, row) : DB.insert("maturity", row);
    DB.update("plantings", plantingId, { harvest_from: hd });
    return saved;
  },

  /* called whenever a harvest is logged, so it learns without being asked */
  noteHarvest(plantingId, dateISO){
    const p = DB.find("plantings", plantingId); if(!p || !p.sown_on) return null;
    if(DB.where("maturity", m => m.planting_id === plantingId).length) return null;
    const rec = Maturity.record(plantingId, dateISO);
    if(rec){
      const e = Maturity.expected(p.crop_id, p.variety);
      const pub = e && e.pub ? e.pub.mid : null;
      const diff = pub ? num(rec.days) - pub : 0;
      toast("📈 " + cropName(p.crop_id) + " took " + rec.days + " days" +
        (pub ? (Math.abs(diff) >= 5 ? " — " + Math.abs(diff) + " " + (diff > 0 ? "longer" : "faster") + " than the book" : " — right on schedule") : ""));
    }
    return rec;
  },

  /* everything she has learned, for the recap and library */
  summary(){
    const by = {};
    DB.all("maturity").forEach(m => {
      const k = m.crop_id + "|" + (m.variety || "");
      (by[k] = by[k] || { crop_id: m.crop_id, variety: m.variety, days: [] }).days.push(num(m.days));
    });
    return Object.keys(by).map(k => {
      const r = by[k], avg = r.days.reduce((a, b) => a + b, 0) / r.days.length;
      const pub = (Maturity.varietyRange(r.crop_id, r.variety) || Maturity.cropRange(r.crop_id));
      return { crop_id: r.crop_id, variety: r.variety, n: r.days.length,
               avg: Math.round(avg), lo: Math.min.apply(null, r.days), hi: Math.max.apply(null, r.days),
               pub: pub ? pub.mid : null, delta: pub ? Math.round(avg - pub.mid) : null };
    }).sort((a, b) => b.n - a.n);
  },

  /* the sheet for logging or correcting a first harvest */
  sheet(plantingId){
    const p = DB.find("plantings", plantingId); if(!p) return;
    const ex = DB.where("maturity", m => m.planting_id === plantingId)[0];
    const e = Maturity.expected(p.crop_id, p.variety);
    openSheet("First harvest",
      '<p class="muted sm" style="margin-top:0">Recording when this actually gave you its first pick teaches the app how ' +
      esc(cropName(p.crop_id)) + ' behaves in <b>your</b> garden. After a few records it uses your own timing instead of the catalogue figure.</p>' +
      (p.sown_on ? '<div class="note i">Sown <b>' + fmtY(p.sown_on) + '</b>' +
        (e ? ' · expected ' + e.lo + '–' + e.hi + ' days' : '') + '</div>'
        : '<div class="note w">This planting has no sowing date, so days to maturity cannot be worked out. Add one first.</div>') +
      '<div class="field" style="margin-top:12px"><label class="f">First harvest date</label>' +
        '<input type="date" id="mt-date" value="' + esc(ex ? ex.harvested_on : iso(today())) + '"></div>' +
      '<div class="field"><label class="f">Note (optional)</label>' +
        '<input type="text" id="mt-note" value="' + esc(ex ? ex.note || "" : "") + '" placeholder="Cool spring, slow start"></div>' +
      '<div id="mt-calc" class="tiny muted" style="margin-top:8px"></div>' +
      (p.sown_on ? '<button class="btn block" style="margin-top:14px" onclick="Maturity.save(\'' + plantingId + '\')">Save first harvest</button>' : '') +
      (ex ? '<button class="btn ghost block danger" style="margin-top:8px" onclick="DB.remove(\'maturity\',\'' + ex.id + '\');closeSheet();Garden.render();toast(\'Record removed\')">Remove this record</button>' : ''));
    const upd = () => {
      const d = $("#mt-date").value;
      if(!p.sown_on || !d) return;
      const n = diffDays(parseISO(p.sown_on), parseISO(d));
      $("#mt-calc").innerHTML = n > 0
        ? '<b>' + n + ' days</b> from sowing to first harvest.' +
          (e && e.pub ? ' The catalogue figure is ' + e.pub.mid + '.' : '')
        : 'That date is before the sowing date.';
    };
    if($("#mt-date")){ $("#mt-date").oninput = upd; upd(); }
  },
  save(plantingId){
    const d = $("#mt-date").value, note = $("#mt-note").value.trim();
    const rec = Maturity.record(plantingId, d, note);
    if(!rec) return toast("Check the dates");
    const p = DB.find("plantings", plantingId);
    const mine = Maturity.mine(p.crop_id, p.variety);
    closeSheet(); Garden.render();
    toast(mine && mine.n > 1
      ? "Saved · your average is now " + mine.avg + " days over " + mine.n + " plantings"
      : "Saved · " + rec.days + " days");
  }
};

/* projections use her own timing once she has any */
Season.harvestFrom = function(cropId, startISO, kind, variety){
  const c = crop(cropId); if(!c || !startISO) return null;
  let d = parseISO(startISO); if(!d) return null;
  if(c.from === "transplant" && (kind === "indoor" || kind === "seed")){
    const s = c.start || {};
    const wk = (s.tp !== undefined && s.indoor !== undefined && s.tp !== null && s.indoor !== null) ? (s.tp - s.indoor) : 5;
    d = addDays(d, Math.round(wk * 7));
  }
  const e = Maturity.expected(cropId, variety);
  return addDays(d, e ? e.days : c.dtm);
};

/* logging a harvest against a planting teaches the app automatically */
(function hookHarvest(){
  const orig = Journal.saveHarvest;
  Journal.saveHarvest = function(id){
    const pid = $("#hv-plant") ? $("#hv-plant").value : "";
    const date = $("#hv-date") ? $("#hv-date").value : iso(today());
    orig.call(Journal, id);
    if(pid && !id) setTimeout(() => Maturity.noteHarvest(pid, date), 400);
  };
})();
</script>
