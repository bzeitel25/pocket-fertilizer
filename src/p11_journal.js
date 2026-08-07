<script>
/* ============================================================
   JOURNAL — water, feed, treat, spend, harvest
   ============================================================ */
const JTYPE = {
  water:    { i:"💧", n:"Watering",    unit:"inches",  amount:true, cost:false },
  feed:     { i:"🌿", n:"Fertilizer",  unit:"cups",    amount:true, cost:true  },
  amend:    { i:"🪵", n:"Amendment",   unit:"lbs",     amount:true, cost:true  },
  treat:    { i:"🧴", n:"Pest / disease treatment", unit:"applications", amount:true, cost:true },
  weed:     { i:"🌾", n:"Weeding",     unit:"",        amount:false, cost:false },
  prune:    { i:"✂️", n:"Pruning",     unit:"",        amount:false, cost:false },
  soil:     { i:"🧪", n:"Soil test",   unit:"",        amount:false, cost:true  },
  buy:      { i:"🧾", n:"Purchase",    unit:"",        amount:false, cost:true  },
  note:     { i:"📝", n:"Note",        unit:"",        amount:false, cost:false }
};

const Journal = {
  filter: "all",

  render(){
    const box = $("#s-journal");
    const yr = String(today().getFullYear());
    let rows = DB.all("journal").map(j => ({ kind:"j", d: j.date, o: j }))
      .concat(DB.all("harvests").map(x => ({ kind:"h", d: x.date, o: x })))
      .sort((a,b) => (b.d || "").localeCompare(a.d || ""));
    if(Journal.filter !== "all") rows = rows.filter(r => Journal.filter === "harvest" ? r.kind === "h" : (r.kind === "j" && r.o.type === Journal.filter));

    const jy = DB.all("journal").filter(j => (j.date||"").slice(0,4) === yr);
    const hy = DB.all("harvests").filter(x => (x.date||"").slice(0,4) === yr);
    const water = jy.filter(j => j.type === "water").reduce((a,j) => a + Journal.waterIn(j), 0);
    const spend = jy.reduce((a,j) => a + num(j.cost), 0);
    const lbs = hy.reduce((a,x) => a + Journal.lbs(x), 0);

    let h = '<div class="card"><div class="grid3">' +
      '<div class="stat"><span class="n">' + Units.weightN(lbs) + '</span><span class="l">' + Units.weightUnit() + ' picked</span></div>' +
      '<div class="stat"><span class="n">' + Units.waterN(water) + Units.waterMark() + '</span><span class="l">water logged</span></div>' +
      '<div class="stat"><span class="n">$' + Math.round(spend) + '</span><span class="l">spent</span></div>' +
      '</div></div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn" onclick="Journal.quick(\'harvest\')">🧺 Log harvest</button>' +
      '<button class="btn ghost" onclick="Journal.quick()">＋ Log activity</button></div>';

    h += '<div class="scroller" style="margin-top:12px">' +
      '<button class="chip ' + (Journal.filter === "all" ? "on" : "") + '" onclick="Journal.filter=\'all\';Journal.render()">All</button>' +
      '<button class="chip ' + (Journal.filter === "harvest" ? "on" : "") + '" onclick="Journal.filter=\'harvest\';Journal.render()">🧺 Harvests</button>' +
      Object.keys(JTYPE).map(k => '<button class="chip ' + (Journal.filter === k ? "on" : "") + '" onclick="Journal.filter=\'' + k + '\';Journal.render()">' +
        JTYPE[k].i + ' ' + JTYPE[k].n + '</button>').join("") + '</div>';

    if(!rows.length){
      h += '<div class="card" style="margin-top:12px"><div class="empty"><span class="e">📖</span><div class="b">Nothing logged yet</div>' +
        '<div class="tiny">Every watering, feeding and harvest you log feeds the end-of-season recap — yield per bed, cost per pound, what actually paid off.</div></div></div>';
    } else {
      h += '<div class="card pad0" style="margin-top:12px"><div class="list">';
      let lastDate = null;
      rows.slice(0, 120).forEach(r => {
        if(r.d !== lastDate){ lastDate = r.d;
          h += '<div style="padding:8px 14px 4px;background:var(--surface-2)" class="tiny b muted">' + fmtY(r.d) + '</div>'; }
        if(r.kind === "h"){
          const x = r.o;
          h += '<button class="item" onclick="Journal.openHarvest(\'' + x.id + '\')"><div class="av">🧺</div>' +
            '<div class="grow"><div class="b">' + esc(cropName(x.crop_id)) + ' · ' + esc(x.weight) + ' ' + esc(x.unit || "lbs") + '</div>' +
            '<div class="tiny muted">' + (x.value ? '$' + esc(x.value) + ' value · ' : '') + esc(Journal.bedName(x.bed_id)) + '</div></div><span class="go">›</span></button>';
        } else {
          const j = r.o, t = JTYPE[j.type] || JTYPE.note;
          h += '<button class="item" onclick="Journal.openEntry(\'' + j.id + '\')"><div class="av">' + t.i + '</div>' +
            '<div class="grow"><div class="b">' + esc(t.n) + (j.amount ? ' · ' + esc(j.amount) + ' ' + esc(j.unit || t.unit) : '') + '</div>' +
            '<div class="tiny muted truncate">' + esc(Journal.bedName(j.bed_id)) + (j.product ? ' · ' + esc(j.product) : '') +
            (j.cost ? ' · $' + esc(j.cost) : '') + (j.notes ? ' · ' + esc(j.notes.slice(0, 40)) : '') + '</div></div><span class="go">›</span></button>';
        }
      });
      h += '</div></div>';
    }
    box.innerHTML = h;
  },

  lbs(x){ const w = num(x.weight); return x.unit === "oz" ? w/16 : x.unit === "kg" ? w*2.205 : x.unit === "g" ? w/453.6 : w; },
  /* the same idea for watering. A row records the unit it was entered in, so
     a garden logged half in inches and half in centimetres still totals
     correctly — which it did not before the switch existed. */
  waterIn(j){ const a = num(j.amount); const u = String(j.unit || "").toLowerCase();
    return u === "cm" ? a / 2.54 : u === "mm" ? a / 25.4 : a; },
  /* what a new entry of this kind should be measured in */
  unitFor(type){
    if(type === "water") return Units.metric ? "cm" : "inches";
    if(type === "amend") return Units.metric ? "kg" : "lbs";
    return (JTYPE[type] || JTYPE.note).unit;
  },
  bedName(id){ const b = id ? DB.find("beds", id) : null; return b ? b.name : "Garden"; },

  quick(type, bedId, plantingId){
    if(type === "harvest") return Journal.harvestForm(null, bedId, plantingId);
    const beds = DB.all("beds");
    const t = type || "water";
    let h = '<div class="field"><label class="f">Activity</label><select id="jl-type" onchange="Journal.formSwap()">' +
      Object.keys(JTYPE).map(k => '<option value="' + k + '"' + (k === t ? " selected" : "") + '>' + JTYPE[k].i + ' ' + JTYPE[k].n + '</option>').join("") +
      '</select></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Date</label><input type="date" id="jl-date" value="' + iso(today()) + '"></div>' +
      '<div><label class="f">Bed</label><select id="jl-bed"><option value="">Whole garden</option>' +
        beds.map(b => '<option value="' + b.id + '"' + (bedId === b.id ? " selected" : "") + '>' + esc(b.name) + '</option>').join("") + '</select></div></div>';
    h += '<div id="jl-dyn"></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="jl-notes"></textarea></div>';
    h += '<button class="btn block" style="margin-top:14px" onclick="Journal.save()">Save entry</button>';
    openSheet("Log activity", h);
    Journal.formSwap();
  },

  formSwap(){
    const t = JTYPE[$("#jl-type").value] || JTYPE.note;
    let h = '';
    if(t.amount) h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Amount</label><input type="number" step="0.01" id="jl-amt" placeholder="1"></div>' +
      '<div><label class="f">Unit</label><input type="text" id="jl-unit" value="' + esc(Journal.unitFor($("#jl-type").value)) + '"></div></div>';
    if($("#jl-type").value === "water") h += '<div class="note i" style="margin-top:8px">' + (Units.metric
      ? 'Log in centimetres to match what the crops ask for. Rough guide: 10 litres per square metre ≈ 1 cm of water.'
      : 'Log in inches to match crop requirements. Rough guide: 0.6 gallons per square foot ≈ 1 inch of water.') + '</div>';
    if($("#jl-type").value === "feed" || $("#jl-type").value === "treat" || $("#jl-type").value === "amend")
      h += '<div class="field"><label class="f">Product</label><input type="text" id="jl-prod" placeholder="Fish emulsion 5-1-1"></div>';
    if($("#jl-type").value === "soil") h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">pH</label><input type="number" step="0.1" id="jl-ph" placeholder="6.5"></div>' +
      '<div><label class="f">Soil temp ' + Units.tempUnit() + '</label><input type="number" id="jl-temp" placeholder="' + Units.tempN(62) + '"></div></div>';
    if(t.cost) h += '<div class="field"><label class="f">Cost ($)</label><input type="number" step="0.01" id="jl-cost" placeholder="0.00"></div>';
    h += '<div class="field"><label class="f">Time spent (minutes)</label><input type="number" id="jl-min" placeholder="15"></div>';
    $("#jl-dyn").innerHTML = h;
  },

  save(){
    const type = $("#jl-type").value;
    const rec = {
      date: $("#jl-date").value, type: type, bed_id: $("#jl-bed").value || null,
      amount: $("#jl-amt") ? num($("#jl-amt").value) : null,
      unit: $("#jl-unit") ? $("#jl-unit").value : null,
      product: $("#jl-prod") ? $("#jl-prod").value.trim() : null,
      cost: $("#jl-cost") ? num($("#jl-cost").value) : null,
      minutes: $("#jl-min") ? num($("#jl-min").value) : null,
      notes: $("#jl-notes").value.trim()
    };
    DB.insert("journal", rec);
    if(type === "soil" && $("#jl-ph"))
      DB.insert("observations", { date: rec.date, bed_id: rec.bed_id, ph: num($("#jl-ph").value),
        soil_temp: $("#jl-temp").value === "" ? null : Units.inTemp(num($("#jl-temp").value)), notes: rec.notes });
    closeSheet(); Journal.render(); refresh(); toast("Logged");
  },

  openEntry(id){
    const j = DB.find("journal", id); if(!j) return;
    const t = JTYPE[j.type] || JTYPE.note;
    openSheet(t.n,
      '<div class="row" style="gap:12px"><div style="font-size:2.2rem">' + t.i + '</div><div class="grow">' +
      '<div class="b">' + esc(t.n) + '</div><div class="tiny muted">' + fmtY(j.date) + ' · ' + esc(Journal.bedName(j.bed_id)) + '</div></div></div>' +
      '<table class="mini" style="margin-top:14px">' +
        (j.amount ? '<tr><th>Amount</th><td>' + esc(j.amount) + ' ' + esc(j.unit || "") + '</td></tr>' : '') +
        (j.product ? '<tr><th>Product</th><td>' + esc(j.product) + '</td></tr>' : '') +
        (j.cost ? '<tr><th>Cost</th><td>$' + esc(j.cost) + '</td></tr>' : '') +
        (j.minutes ? '<tr><th>Time</th><td>' + esc(j.minutes) + ' min</td></tr>' : '') +
      '</table>' +
      (j.notes ? '<div class="note i" style="margin-top:12px">' + esc(j.notes) + '</div>' : '') +
      '<button class="btn danger block" style="margin-top:16px" onclick="DB.remove(\'journal\',\'' + id + '\');closeSheet();Journal.render()">Delete entry</button>');
  },

  /* ---------- harvests ---------- */
  harvestForm(h0, bedId, plantingId){
    const beds = DB.all("beds");
    const plantings = DB.where("plantings", p => p.status !== "removed");
    let h = '<div class="grid2">' +
      '<div><label class="f">Date</label><input type="date" id="hv-date" value="' + esc(h0 ? h0.date : iso(today())) + '"></div>' +
      '<div><label class="f">Bed</label><select id="hv-bed"><option value="">Garden</option>' +
        beds.map(b => '<option value="' + b.id + '"' + ((h0 && h0.bed_id === b.id) || bedId === b.id ? " selected" : "") + '>' + esc(b.name) + '</option>').join("") + '</select></div></div>';
    h += '<div class="field"><label class="f">Plant</label><select id="hv-plant" onchange="Journal.hvSync()"><option value="">— pick from your beds —</option>' +
      plantings.map(p => { const b = DB.find("beds", p.bed_id);
        return '<option value="' + p.id + '" data-crop="' + esc(p.crop_id) + '"' + ((h0 && h0.planting_id === p.id) || plantingId === p.id ? " selected" : "") + '>' +
          esc(cropName(p.crop_id)) + ' · ' + esc(b ? b.name : "?") + '</option>'; }).join("") + '</select></div>';
    h += '<div class="field"><label class="f">Crop</label><select id="hv-crop">' +
      '<option value="">— choose —</option>' + CROPS.map(c => '<option value="' + c.id + '"' + (h0 && h0.crop_id === c.id ? " selected" : "") + '>' + esc(c.n) + '</option>').join("") + '</select></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Weight</label><input type="number" step="0.01" id="hv-w" value="' + esc(h0 ? h0.weight : "") + '" placeholder="1.5"></div>' +
      '<div><label class="f">Unit</label><select id="hv-unit">' + ["lbs","oz","kg","g","count"].map(u =>
        '<option' + ((h0 ? h0.unit === u : u === (Units.metric ? "kg" : "lbs")) ? " selected" : "") + '>' + u + '</option>').join("") + '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Count (optional)</label><input type="number" id="hv-count" value="' + esc(h0 ? h0.count : "") + '" placeholder="12"></div>' +
      '<div><label class="f">Value ($)</label><input type="number" step="0.01" id="hv-val" value="' + esc(h0 ? h0.value : "") + '" placeholder="market price"></div></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="hv-notes" placeholder="Flavour, size, what you would change">' + esc(h0 ? h0.notes || "" : "") + '</textarea></div>';
    h += '<div class="note i" style="margin-top:12px">What you pick is recorded in the unit you choose here, exactly as you entered it. ' +
      'Totals and the recap are shown in ' + (Units.metric ? "kilograms" : "pounds") + ', whatever mix of units you have used. ' +
      'Filling in value turns the recap into a real cost-per-' + (Units.metric ? "kilo" : "pound") + ' picture.</div>';
    h += '<button class="btn block" style="margin-top:14px" onclick="Journal.saveHarvest(' + (h0 ? "'" + h0.id + "'" : "null") + ')">Save harvest</button>';
    openSheet(h0 ? "Edit harvest" : "Log a harvest", h);
    setTimeout(Journal.hvSync, 50);
  },
  hvSync(){
    const sel = $("#hv-plant"); if(!sel || !sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    const cid = opt.getAttribute("data-crop");
    if(cid && $("#hv-crop")) $("#hv-crop").value = cid;
    const p = DB.find("plantings", sel.value);
    if(p && p.bed_id && $("#hv-bed")) $("#hv-bed").value = p.bed_id;
  },
  saveHarvest(id){
    const rec = {
      date: $("#hv-date").value, bed_id: $("#hv-bed").value || null, planting_id: $("#hv-plant").value || null,
      crop_id: $("#hv-crop").value || null, weight: num($("#hv-w").value), unit: $("#hv-unit").value,
      count: num($("#hv-count").value), value: num($("#hv-val").value), notes: $("#hv-notes").value.trim()
    };
    if(!rec.crop_id) return toast("Pick a crop");
    if(id) DB.update("harvests", id, rec); else DB.insert("harvests", rec);
    if(rec.planting_id) DB.update("plantings", rec.planting_id, { status:"harvesting" });
    closeSheet(); Journal.render(); refresh(); toast("Harvest logged 🧺");
  },
  openHarvest(id){
    const x = DB.find("harvests", id); if(!x) return;
    openSheet("Harvest",
      '<div class="row" style="gap:12px"><div style="font-size:2.2rem">' + cropEmoji(x.crop_id) + '</div>' +
      '<div class="grow"><div class="b">' + esc(cropName(x.crop_id)) + '</div>' +
      '<div class="tiny muted">' + fmtY(x.date) + ' · ' + esc(Journal.bedName(x.bed_id)) + '</div></div></div>' +
      '<table class="mini" style="margin-top:14px">' +
        '<tr><th>Weight</th><td>' + esc(x.weight) + ' ' + esc(x.unit) + '</td></tr>' +
        (x.count ? '<tr><th>Count</th><td>' + esc(x.count) + '</td></tr>' : '') +
        (x.value ? '<tr><th>Value</th><td>$' + esc(x.value) + '</td></tr>' : '') +
      '</table>' + (x.notes ? '<div class="note i" style="margin-top:12px">' + esc(x.notes) + '</div>' : '') +
      '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost grow" onclick="closeSheet();setTimeout(function(){Journal.harvestForm(DB.find(\'harvests\',\'' + id + '\'))},250)">Edit</button>' +
      '<button class="btn danger grow" onclick="DB.remove(\'harvests\',\'' + id + '\');closeSheet();Journal.render()">Delete</button></div>');
  }
};

/* ============================================================
   SEASON RECAP
   ============================================================ */
const Recap = {
  year: null,

  render(){
    const box = $("#s-recap");
    const years = {};
    DB.all("harvests").forEach(x => { if(x.date) years[x.date.slice(0,4)] = 1; });
    DB.all("journal").forEach(x => { if(x.date) years[x.date.slice(0,4)] = 1; });
    years[String(today().getFullYear())] = 1;
    const ys = Object.keys(years).sort().reverse();
    if(!Recap.year || ys.indexOf(Recap.year) < 0) Recap.year = ys[0];
    const Y = Recap.year;

    const hv = DB.all("harvests").filter(x => (x.date||"").slice(0,4) === Y);
    const jl = DB.all("journal").filter(x => (x.date||"").slice(0,4) === Y);
    const sd = DB.all("seeds").filter(s => (s.created||"").slice(0,4) === Y);
    const dx = DB.all("diagnoses").filter(x => (x.date||"").slice(0,4) === Y);

    const lbs = hv.reduce((a,x) => a + Journal.lbs(x), 0);
    const value = hv.reduce((a,x) => a + num(x.value), 0);
    const spendJ = jl.reduce((a,x) => a + num(x.cost), 0);
    const spendS = sd.reduce((a,s) => a + num(s.cost), 0);
    const spend = spendJ + spendS;
    const water = jl.filter(j => j.type === "water").reduce((a,j) => a + Journal.waterIn(j), 0);
    const mins = jl.reduce((a,j) => a + num(j.minutes), 0);
    const feeds = jl.filter(j => j.type === "feed").length;

    let h = '';
    h += '<div class="scroller">' + ys.map(y => '<button class="chip ' + (y === Y ? "on" : "") + '" onclick="Recap.year=\'' + y + '\';Recap.render()">' + y + '</button>').join("") + '</div>';

    h += '<div class="hero" style="margin-top:12px"><div class="lbl">' + Y + ' season</div>' +
      '<div style="font-size:2.4rem;font-weight:800;line-height:1.1">' + Units.weight(lbs) + '</div>' +
      '<div class="sm" style="opacity:.92">' + hv.length + ' harvests across ' +
      Object.keys(hv.reduce((a,x) => (a[x.crop_id]=1, a), {})).length + ' crops</div>' +
      '<div class="row" style="gap:16px;margin-top:12px;font-size:.82rem;opacity:.95">' +
      '<span>💵 $' + Math.round(value) + ' value</span><span>🧾 $' + Math.round(spend) + ' spent</span>' +
      '<span>' + (value - spend >= 0 ? "📈 +$" : "📉 −$") + Math.abs(Math.round(value - spend)) + '</span></div></div>';

    if(!hv.length && !jl.length){
      h += '<div class="card" style="margin-top:12px"><div class="empty"><span class="e">📊</span><div class="b">Nothing logged for ' + Y + '</div>' +
        '<div class="tiny">Log harvests and inputs through the season and this page writes itself.</div></div></div>';
      box.innerHTML = h; return;
    }

    /* per crop */
    const byCrop = {};
    hv.forEach(x => { const k = x.crop_id || "other";
      byCrop[k] = byCrop[k] || { lbs:0, val:0, n:0 };
      byCrop[k].lbs += Journal.lbs(x); byCrop[k].val += num(x.value); byCrop[k].n++; });
    const cropRows = Object.keys(byCrop).map(k => ({ id:k, ...byCrop[k] })).sort((a,b) => b.lbs - a.lbs);
    const maxL = Math.max.apply(null, cropRows.map(r => r.lbs).concat([1]));

    h += '<div class="sec"><h2>What produced</h2></div><div class="card">';
    cropRows.forEach(r => {
      h += '<div style="margin-bottom:10px"><div class="row between"><div class="sm b">' + cropEmoji(r.id) + ' ' + esc(cropName(r.id)) + '</div>' +
        '<div class="tiny muted">' + Units.weight(r.lbs) + (r.val ? ' · $' + Math.round(r.val) : '') + '</div></div>' +
        '<div class="bar-track" style="margin-top:4px"><div class="bar-fill" style="width:' + Math.round(r.lbs/maxL*100) + '%"></div></div></div>';
    });
    h += '</div>';

    /* per bed productivity */
    const byBed = {};
    hv.forEach(x => { const k = x.bed_id || "none"; byBed[k] = byBed[k] || { lbs:0, val:0 };
      byBed[k].lbs += Journal.lbs(x); byBed[k].val += num(x.value); });
    const bedRows = Object.keys(byBed).filter(k => k !== "none").map(k => {
      const b = DB.find("beds", k);
      const sq = b ? num(b.cols) * num(b.rows) * Math.pow(num(b.cell_in,12)/12, 2) : 0;
      return { name: b ? b.name : "—", lbs: byBed[k].lbs, sq: sq, per: sq ? byBed[k].lbs / sq : 0 };
    }).sort((a,b) => b.per - a.per);
    if(bedRows.length){
      h += '<div class="sec"><h2>Bed productivity</h2></div><div class="card"><table class="mini">' +
        '<tr><th>Bed</th><th>Yield</th><th>' + Units.areaUnit() + '</th><th>Density</th></tr>' +
        bedRows.map(r => '<tr><td class="b">' + esc(r.name) + '</td><td>' + Units.weightN(r.lbs) + '</td><td>' +
          Units.areaN(r.sq) + '</td><td class="b">' + Units.density(r.per) + '</td></tr>').join("") +
        '</table><div class="tiny muted" style="margin-top:8px">A well-run intensive bed runs about ' +
        Units.density(0.5) + '–' + Units.density(1.5) + ' a season. Use this to decide what to expand.</div></div>';
    }

    /* resources */
    h += '<div class="sec"><h2>Resources used</h2></div><div class="card"><div class="grid2">' +
      '<div class="stat"><span class="n">' + Units.waterN(water) + Units.waterMark() + '</span><span class="l">water logged</span></div>' +
      '<div class="stat"><span class="n">' + feeds + '</span><span class="l">feedings</span></div>' +
      '<div class="stat"><span class="n">' + Math.round(mins/60*10)/10 + 'h</span><span class="l">time logged</span></div>' +
      '<div class="stat"><span class="n">' + dx.length + '</span><span class="l">problems diagnosed</span></div>' +
      '</div>';
    if(lbs > 0){
      h += '<table class="mini" style="margin-top:12px">' +
        '<tr><th>Cost per ' + Units.perUnitWord() + '</th><td class="b">$' + (Math.round(spend/Units.weightN(lbs)*100)/100) + '</td></tr>' +
        '<tr><th>Value per ' + Units.perUnitWord() + '</th><td>$' + (value ? Math.round(value/Units.weightN(lbs)*100)/100 : "—") + '</td></tr>' +
        (mins ? '<tr><th>' + Units.weightUnit() + ' per hour</th><td>' + (Math.round(Units.weightN(lbs)/(mins/60)*10)/10) + '</td></tr>' : '') +
        '</table>';
    }
    h += '</div>';

    /* spend breakdown */
    const bySpend = {};
    jl.forEach(j => { if(num(j.cost)) bySpend[j.type] = (bySpend[j.type] || 0) + num(j.cost); });
    if(spendS) bySpend.seeds = spendS;
    if(Object.keys(bySpend).length){
      h += '<div class="sec"><h2>Where the money went</h2></div><div class="card"><table class="mini">' +
        Object.keys(bySpend).sort((a,b) => bySpend[b] - bySpend[a]).map(k =>
          '<tr><td>' + ((JTYPE[k] ? JTYPE[k].i + " " + JTYPE[k].n : "🌰 Seeds")) + '</td><td class="b">$' + (Math.round(bySpend[k]*100)/100) + '</td></tr>').join("") +
        '</table></div>';
    }

    /* problems */
    if(dx.length){
      const byDx = {}; dx.forEach(d => byDx[d.result] = (byDx[d.result] || 0) + 1);
      h += '<div class="sec"><h2>Problems this season</h2></div><div class="card"><div class="row wrap" style="gap:6px">' +
        Object.keys(byDx).sort((a,b) => byDx[b] - byDx[a]).map(k => '<span class="chip warn">' + esc(k) + ' ×' + byDx[k] + '</span>').join("") +
        '</div><div class="tiny muted" style="margin-top:8px">Repeat problems are usually a siting or rotation issue, not bad luck. Change the variable before next season.</div></div>';
    }

    /* what the garden has taught the app */
    const mat = Maturity.summary();
    if(mat.length){
      h += '<div class="sec"><h2>Your days to maturity</h2></div><div class="card"><table class="mini">' +
        '<tr><th>Crop</th><th>Yours</th><th>Published</th><th>Difference</th></tr>' +
        mat.map(m => '<tr><td class="b">' + cropEmoji(m.crop_id) + ' ' + esc(cropName(m.crop_id)) +
          (m.variety ? '<div class="tiny muted" style="font-weight:400">' + esc(m.variety) + '</div>' : '') + '</td>' +
          '<td>' + m.avg + 'd<div class="tiny muted">' + m.n + ' record' + (m.n === 1 ? "" : "s") + '</div></td>' +
          '<td>' + (m.pub || "—") + '</td>' +
          '<td class="b" style="color:' + (m.delta === null ? "inherit" : m.delta > 0 ? "var(--warn)" : "var(--green-600)") + '">' +
          (m.delta === null ? "—" : (m.delta > 0 ? "+" : "") + m.delta + "d") + '</td></tr>').join("") +
        '</table><div class="tiny muted" style="margin-top:8px">Positive means your garden runs slower than the catalogue. Once a crop has three records the app plans with your figure instead.</div></div>';
    }

    /* takeaways */
    h += '<div class="sec"><h2>Notes for next year</h2></div><div class="card">';
    const notes = [];
    if(cropRows.length) notes.push("🏆 <b>" + esc(cropName(cropRows[0].id)) + "</b> was your biggest producer at " + (Math.round(cropRows[0].lbs*10)/10) + " lbs. Give it at least as much space.");
    const dud = cropRows.filter(r => r.lbs < 0.3);
    if(dud.length) notes.push("🤔 " + dud.map(r => esc(cropName(r.id))).join(", ") + " barely produced. Either the spot is wrong or the variety is — worth changing one thing, not both.");
    if(bedRows.length > 1) notes.push("📐 <b>" + esc(bedRows[0].name) + "</b> was your most productive ground at " + (Math.round(bedRows[0].per*100)/100) + " lbs/sq ft.");
    if(lbs && spend) notes.push("💵 You grew food at $" + (Math.round(spend/lbs*100)/100) + " per pound" + (value > spend ? " and came out ahead by $" + Math.round(value - spend) + "." : "."));
    if(!water) notes.push("💧 No watering logged — start logging it and next year's recap can tell you gallons per pound.");
    if(dx.length) notes.push("🔬 " + dx.length + " problem" + (dx.length > 1 ? "s" : "") + " diagnosed. Check the rotation history on those beds before replanting the same family.");
    notes.forEach(n => h += '<div class="note g" style="margin-bottom:8px">' + n + '</div>');
    h += '</div>';

    h += '<div class="grid2" style="margin-top:14px">' +
      '<button class="btn ghost" onclick="Recap.csv()">⬇︎ Export CSV</button>' +
      '<button class="btn ghost" onclick="window.print()">🖨️ Print recap</button></div>';

    box.innerHTML = h;
  },

  csv(){
    const Y = Recap.year;
    const rows = [["type","date","crop","bed","amount","unit","value","cost","notes"]];
    DB.all("harvests").filter(x => (x.date||"").slice(0,4) === Y).forEach(x =>
      rows.push(["harvest", x.date, cropName(x.crop_id), Journal.bedName(x.bed_id), x.weight, x.unit, x.value || "", "", (x.notes||"").replace(/[\r\n]+/g," ")]));
    DB.all("journal").filter(x => (x.date||"").slice(0,4) === Y).forEach(j =>
      rows.push([j.type, j.date, "", Journal.bedName(j.bed_id), j.amount || "", j.unit || "", "", j.cost || "", (j.notes||"").replace(/[\r\n]+/g," ")]));
    const csv = rows.map(r => r.map(v => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g,'""') + '"').join(",")).join("\n");
    download("pocket-fertilizer-" + Y + ".csv", new Blob([csv], { type:"text/csv" }));
  }
};

function download(name, blob){
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { if(URL.revokeObjectURL) URL.revokeObjectURL(u); }, 4000);
}
</script>
