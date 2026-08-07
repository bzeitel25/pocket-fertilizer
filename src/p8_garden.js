<script>
/* ============================================================
   GARDEN PLANNER — plots, adjustable grids, companion checks
   ============================================================ */
const Garden = {
  paint: null,     /* crop id being painted */
  erase: false,

  /* ---------- routing ---------- */
  open(bedId){ APP.bedId = bedId; Garden.paint = null; Garden.erase = false; go("garden"); },
  back(){ APP.bedId = null; Garden.render(); },
  render(){ APP.bedId ? Garden.bedView() : Garden.listView(); },

  /* ---------- plots + bed list ---------- */
  listView(){
    const box = $("#s-garden");
    const plots = DB.all("plots"), beds = DB.all("beds");
    let h = "";

    if(!plots.length && !beds.length){
      h += '<div class="card"><div class="empty"><span class="e">🪴</span><div class="b">Plan your first bed</div>' +
        '<div class="tiny">A bed is a grid. One square usually equals one square foot — the classic square-foot method — but you can change the square size to anything.</div></div>' +
        '<button class="btn block" onclick="Garden.newBed()">＋ New bed</button></div>';
      box.innerHTML = h; return;
    }

    const cur = APP.plotId && DB.find("plots", APP.plotId) ? APP.plotId : null;
    h += '<div class="scroller">';
    h += '<button class="chip ' + (!cur ? "on" : "") + '" onclick="APP.plotId=null;Garden.render()">All plots</button>';
    plots.forEach(p => h += '<button class="chip ' + (cur === p.id ? "on" : "") + '" onclick="APP.plotId=\'' + p.id + '\';Garden.render()">' + esc(p.name) + '</button>');
    h += '<button class="chip" onclick="Garden.newPlot()">＋ Plot</button>';
    h += '</div>';

    const shown = beds.filter(b => !cur || b.plot_id === cur);
    const totalSq = shown.reduce((a, b) => a + num(b.cols) * num(b.rows) * Math.pow(num(b.cell_in, 12)/12, 2), 0);
    const planted = shown.reduce((a, b) => a + DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed").length, 0);
    h += '<div class="card"><div class="grid3">' +
      '<div class="stat"><span class="n">' + shown.length + '</span><span class="l">beds</span></div>' +
      '<div class="stat"><span class="n">' + Math.round(totalSq) + '</span><span class="l">sq ft</span></div>' +
      '<div class="stat"><span class="n">' + planted + '</span><span class="l">planted</span></div>' +
      '</div></div>';

    shown.forEach(b => {
      const ps = DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed");
      const conf = Recommend.conflicts(b.id);
      const crops = {}; ps.forEach(p => crops[p.crop_id] = (crops[p.crop_id] || 0) + 1);
      h += '<div class="card"><div class="bedtitle"><div class="grow"><div class="b">' + esc(b.name) + '</div>' +
        '<div class="tiny muted">' + b.cols + '×' + b.rows + ' squares · ' + esc(b.cell_in || 12) + '" each · ' + esc(b.sun_hours || "?") + 'h sun' +
        (b.plot_id && DB.find("plots", b.plot_id) ? ' · ' + esc(DB.find("plots", b.plot_id).name) : '') + '</div></div>' +
        '<button class="btn sm" onclick="Garden.open(\'' + b.id + '\')">Open</button></div>';
      h += Garden.miniGrid(b);
      h += '<div class="row wrap" style="gap:6px;margin-top:10px">';
      Object.keys(crops).slice(0, 8).forEach(id => h += '<span class="chip">' + cropEmoji(id) + ' ' + esc(cropName(id)) + ' ×' + crops[id] + '</span>');
      if(!ps.length) h += '<span class="chip">empty</span>';
      if(conf.length) h += '<span class="chip bad">⚠️ ' + conf.length + ' conflict' + (conf.length > 1 ? "s" : "") + '</span>';
      h += '</div></div>';
    });
    h += '<button class="btn block ghost" style="margin-top:12px" onclick="Garden.newBed()">＋ New bed</button>';
    box.innerHTML = h;
  },

  miniGrid(b){
    const cols = num(b.cols, 4), rows = num(b.rows, 4);
    const cs = clamp(Math.floor(260 / cols), 10, 26);
    const map = {};
    DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed").forEach(p => map[p.x + "," + p.y] = p);
    let h = '<div class="bedwrap" style="padding:4px"><div class="bed" style="grid-template-columns:repeat(' + cols + ',' + cs + 'px);gap:2px;--cs:' + cs + 'px">';
    for(let y = 0; y < rows; y++) for(let x = 0; x < cols; x++){
      const p = map[x + "," + y];
      h += '<div class="cell ' + (p ? "filled" : "") + '" style="width:' + cs + 'px;height:' + cs + 'px;font-size:' + Math.round(cs*0.62) + 'px">' + (p ? cropEmoji(p.crop_id) : "") + '</div>';
    }
    return h + '</div></div>';
  },

  /* ---------- bed detail ---------- */
  bedView(){
    const b = DB.find("beds", APP.bedId);
    if(!b){ APP.bedId = null; return Garden.listView(); }
    const box = $("#s-garden");
    const cols = num(b.cols, 4), rows = num(b.rows, 4);
    const ps = DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed");
    const map = {}; ps.forEach(p => map[p.x + "," + p.y] = p);
    const conflicts = Recommend.conflicts(b.id);
    const friends = Recommend.friends(b.id);
    const conflictCells = {};
    conflicts.forEach(c => { conflictCells[c.a.x + "," + c.a.y] = 1; conflictCells[c.b.x + "," + c.b.y] = 1; });

    let h = '';
    h += '<div class="row" style="margin-bottom:10px"><button class="iconbtn" onclick="Garden.back()">‹</button>' +
      '<div class="grow"><div class="b">' + esc(b.name) + '</div><div class="tiny muted">' + cols + '×' + rows + ' · ' + esc(b.cell_in || 12) + '" squares · ' + esc(b.sun_hours || "?") + 'h sun</div></div>' +
      '<button class="iconbtn" onclick="Garden.bedMenu()">⋯</button></div>';

    /* size controls */
    h += '<div class="card"><div class="row between" style="gap:14px">' +
      '<div><div class="l tiny b muted" style="text-transform:uppercase">Columns</div><div class="stepper">' +
        '<button onclick="Garden.resize(-1,0)">−</button><span class="v">' + cols + '</span><button onclick="Garden.resize(1,0)">＋</button></div></div>' +
      '<div><div class="l tiny b muted" style="text-transform:uppercase">Rows</div><div class="stepper">' +
        '<button onclick="Garden.resize(0,-1)">−</button><span class="v">' + rows + '</span><button onclick="Garden.resize(0,1)">＋</button></div></div>' +
      '<div class="grow" style="text-align:right"><div class="tiny muted">' +
        Math.round(cols * rows * Math.pow(num(b.cell_in,12)/12, 2)) + ' sq ft</div>' +
        '<div class="tiny muted">' + ps.length + '/' + (cols*rows) + ' filled</div></div>' +
      '</div></div>';

    /* paint toolbar */
    h += '<div class="card" style="margin-top:12px"><div class="row wrap" style="gap:6px">';
    if(Garden.paint){
      h += '<span class="chip on">' + cropEmoji(Garden.paint) + ' Placing ' + esc(cropName(Garden.paint)) + '</span>' +
           '<button class="chip" onclick="Garden.paint=null;Garden.render()">Done</button>';
    } else if(Garden.erase){
      h += '<span class="chip bad">🧹 Tap squares to clear</span><button class="chip" onclick="Garden.erase=false;Garden.render()">Done</button>';
    } else {
      h += '<button class="chip" onclick="Garden.pickPaint()">🖌️ Place a crop</button>' +
           '<button class="chip" onclick="Garden.erase=true;Garden.render()">🧹 Clear squares</button>' +
           '<button class="chip" onclick="Garden.suggest()">✨ Suggest for this bed</button>';
    }
    h += '</div><div class="tiny muted" style="margin-top:8px">Tap any square to plant it or see what is growing there.</div></div>';

    /* the grid — spans are drawn as single stretched cells */
    const cs = clamp(Math.floor((Math.min(window.innerWidth, 520) - 64) / cols), 22, 62);
    Garden._cs = cs;
    h += '<div class="bedwrap" style="margin-top:12px">' +
      Garden.gridHTML(b, { cs: cs, gap: 3, interactive: true, conflicts: conflicts, friends: friends }) + '</div>';
    h += '<div class="row center tiny muted" style="gap:12px;margin-top:8px;justify-content:center">' +
      '<span>💚 good neighbours</span><span>⚠️ keep apart</span></div>';
    h += '<div class="tiny muted center" style="margin-top:6px">Tap a planting to select it, then drag its corner handle — or use the width and height steppers — to cover more ground.</div>';

    /* good neighbours */
    if(friends.length){
      h += '<div class="sec"><h2>Good neighbours</h2><span class="tiny muted">💚 on the grid</span></div><div class="card">';
      const seen = {};
      friends.slice(0, 6).forEach(f => {
        const key = [f.a.crop_id, f.b.crop_id].sort().join("|");
        if(seen[key]) return; seen[key] = 1;
        h += '<div class="note g" style="margin-bottom:8px">' + cropEmoji(f.a.crop_id) + ' <b>' + esc(cropName(f.a.crop_id)) +
          '</b> beside ' + cropEmoji(f.b.crop_id) + ' <b>' + esc(cropName(f.b.crop_id)) + '</b><br>' + esc(f.why) + '</div>';
      });
      h += '</div>';
    }

    /* conflicts */
    if(conflicts.length){
      h += '<div class="sec"><h2>Companion warnings</h2></div><div class="card">';
      conflicts.slice(0, 5).forEach(c => {
        h += '<div class="note d" style="margin-bottom:8px">' + cropEmoji(c.a.crop_id) + ' <b>' + esc(cropName(c.a.crop_id)) + '</b> next to ' +
          cropEmoji(c.b.crop_id) + ' <b>' + esc(cropName(c.b.crop_id)) + '</b><br>' + esc(c.why) + '</div>';
      });
      h += '</div>';
    }

    /* what is growing */
    h += '<div class="sec"><h2>Growing here</h2><span class="tiny muted">' + ps.length + ' plantings</span></div>';
    if(!ps.length){ h += '<div class="card center muted sm">Empty bed. Tap a square to plant.</div>'; }
    else {
      const byCrop = {};
      ps.forEach(p => { (byCrop[p.crop_id] = byCrop[p.crop_id] || []).push(p); });
      h += '<div class="card pad0"><div class="list">';
      Object.keys(byCrop).forEach(id => {
        const arr = byCrop[id], c = crop(id);
        const qty = arr.reduce((a, p) => a + num(p.qty, 1), 0);
        const sown = arr.map(p => p.sown_on).filter(Boolean).sort()[0];
        const harv = sown && c ? Season.harvestFrom(id, sown, "seed") : null;
        const sunOk = !c || num(b.sun_hours, 8) >= c.sun;
        h += '<button class="item" onclick="Library.open(\'' + id + '\')"><div class="av">' + cropEmoji(id) + '</div>' +
          '<div class="grow"><div class="b">' + esc(cropName(id)) + ' <span class="muted tiny">×' + qty + ' plants</span></div>' +
          '<div class="tiny muted">' + (sown ? 'Sown ' + fmt(sown) : 'No sow date') +
            (harv ? ' · harvest ~' + fmt(harv) : '') + '</div>' +
          '<div class="tiny muted">' + arr.map(x => Garden.W(x) + '×' + Garden.H(x) +
            (x.span_mode === "single" && (Garden.W(x)*Garden.H(x)) > 1 ? ' (one plant)' : '')).join(", ") + '</div>' +
          (!sunOk ? '<div class="tiny" style="color:var(--warn)">Wants ' + c.sun + 'h sun, bed gets ' + esc(b.sun_hours) + 'h</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    /* bed care summary */
    const w = Recommend.water(b.id, APP.weather);
    if(w){
      h += '<div class="sec"><h2>Care</h2></div><div class="card">';
      h += '<div class="row between"><div><div class="b">' +
        (w.verdict === "skip" ? "💧 Skip watering" : w.verdict === "light" ? '💧 Light top-up' : '💧 Water this week') + '</div>' +
        '<div class="tiny muted">Needs ' + w.need + '"/wk · ' + w.rain + '" rain · ' + w.logged + '" logged</div></div>' +
        '<button class="btn sm" onclick="Journal.quick(\'water\',\'' + b.id + '\')">Log</button></div>';
      const heavy = ps.map(p => crop(p.crop_id)).filter(c => c && c.feeder === "heavy");
      if(heavy.length) h += '<div class="note w" style="margin-top:10px">🌿 Heavy feeders here (' +
        esc(heavy.map(c => c.n).filter((v,i,a) => a.indexOf(v) === i).join(", ")) + '). Side-dress with compost or a balanced organic feed every 3–4 weeks.</div>';
      h += '</div>';
    }

    /* rotation */
    const fams = Recommend.recentFamilies(b.id);
    if(Object.keys(fams).length){
      h += '<div class="sec"><h2>Rotation history</h2></div><div class="card"><div class="row wrap" style="gap:6px">';
      Object.keys(fams).forEach(f => h += '<span class="chip"><span class="swatch" style="background:' + FAMILY[f].c + '"></span>' + esc(FAMILY[f].n) + ' · ' + esc(fams[f]) + '</span>');
      h += '</div><div class="tiny muted" style="margin-top:8px">Aim for a 3-year gap before the same family returns to a bed. It starves out soil-borne disease and evens out nutrient draw.</div></div>';
    }

    box.innerHTML = h;
  },

  /* ---------- interactions ---------- */
  tapCell(x, y){
    haptic();
    const b = DB.find("beds", APP.bedId);
    const ex = DB.where("plantings", p => p.bed_id === b.id && num(p.x) === x && num(p.y) === y && p.status !== "removed")[0];
    if(Garden.erase){ if(ex){ DB.update("plantings", ex.id, { status:"removed", removed_on: iso(today()) }); Garden.render(); } return; }
    if(Garden.paint){
      if(ex && ex.crop_id === Garden.paint) return;
      if(ex) DB.update("plantings", ex.id, { status:"removed", removed_on: iso(today()) });
      Garden.place(b, x, y, Garden.paint, true);
      Garden.render(); return;
    }
    ex ? Garden.plantingSheet(ex) : Garden.pickCrop(x, y);
  },

  place(b, x, y, cropId, silent){
    const c = crop(cropId);
    const cell = num(b.cell_in, 12) / 12;
    const qty = Math.max(1, Math.round((c ? c.psf : 1) * cell * cell));
    const p = DB.insert("plantings", {
      bed_id: b.id, x: x, y: y, crop_id: cropId, qty: qty, status: "planned", sown_on: iso(today())
    });
    if(!silent) toast(cropName(cropId) + " placed");
    Cal.forPlanting(p);
    return p;
  },

  pickPaint(){
    Garden.cropPicker("Choose a crop to place", id => {
      Garden.paint = id; Garden.erase = false; closeSheet(); Garden.render();
      toast("Tap squares to place " + cropName(id));
    });
  },

  pickCrop(x, y){
    const b = DB.find("beds", APP.bedId);
    Garden.cropPicker("Plant row " + (y+1) + ", column " + (x+1), id => {
      closeSheet();
      const p = Garden.place(b, x, y, id);
      Garden.render();
      setTimeout(() => Garden.plantingSheet(p), 250);
    }, b);
  },

  cropPicker(title, onPick, bed){
    const stock = {}; DB.all("seeds").forEach(s => { if(s.crop_id) stock[s.crop_id] = (stock[s.crop_id] || 0) + 1; });
    const recs = Recommend.now({ bedId: bed ? bed.id : null }).slice(0, 30);
    const recIds = recs.map(r => r.crop.id);
    let h = '<input type="search" id="cp-q" placeholder="Search 50+ crops…" style="margin-bottom:10px">';
    h += '<div class="row wrap" style="gap:6px;margin-bottom:10px">' +
      '<button class="chip on" data-f="all">All</button>' +
      '<button class="chip" data-f="now">In season now</button>' +
      '<button class="chip" data-f="seed">I have seed</button>' +
      '<button class="chip" data-f="comp">Good companions</button></div>';
    h += '<div id="cp-list"></div>';
    openSheet(title, h);

    const compIds = bed ? Recommend.forBed(bed.id).map(x => x.id) : [];
    let filter = "all", q = "";
    function draw(){
      let list = CROPS.slice();
      if(filter === "now") list = list.filter(c => recIds.indexOf(c.id) >= 0);
      if(filter === "seed") list = list.filter(c => stock[c.id]);
      if(filter === "comp") list = list.filter(c => compIds.indexOf(c.id) >= 0);
      if(q) list = list.filter(c => (c.n + " " + c.id + " " + FAMILY[c.fam].n).toLowerCase().indexOf(q) >= 0);
      if(filter === "now") list.sort((a,b2) => recIds.indexOf(a.id) - recIds.indexOf(b2.id));
      let out = '<div class="list">';
      if(!list.length) out += '<div class="empty sm">Nothing matches.</div>';
      list.slice(0, 80).forEach(c => {
        const st = Season.status(c.id);
        const inWin = st && st.inWindow;
        let badge = "";
        if(inWin) badge = '<span class="chip good tiny">' + esc(st.w.label) + ' now</span>';
        else if(st && st.days > 0 && st.days < 60) badge = '<span class="chip info tiny">' + esc(st.w.label) + ' ' + relDay(st.w.date) + '</span>';
        let compBadge = "";
        if(bed){
          const occ = DB.where("plantings", p => p.bed_id === bed.id && p.status !== "removed").map(p => p.crop_id);
          let worst = 0, best = 0;
          occ.forEach(o => { const r = pairRating(c.id, o); worst = Math.min(worst, r.score); best = Math.max(best, r.score); });
          if(worst <= -2) compBadge = '<span class="chip bad tiny">conflict here</span>';
          else if(best >= 1) compBadge = '<span class="chip good tiny">good pairing</span>';
        }
        out += '<button class="item" data-id="' + c.id + '"><div class="av">' + c.e + '</div>' +
          '<div class="grow"><div class="b">' + esc(c.n) + (stock[c.id] ? ' <span class="tiny" style="color:var(--green-600)">🌰</span>' : '') + '</div>' +
          '<div class="tiny muted">' + esc(FAMILY[c.fam].n) + ' · ' + c.sun + 'h sun · ' + c.dtm + 'd</div>' +
          '<div class="row wrap" style="gap:4px;margin-top:3px">' + badge + compBadge + '</div></div>' +
          '<span class="go">›</span></button>';
      });
      out += '</div>';
      $("#cp-list").innerHTML = out;
      $$("#cp-list .item").forEach(el => el.onclick = () => onPick(el.dataset.id));
    }
    $("#cp-q").oninput = e => { q = e.target.value.toLowerCase().trim(); draw(); };
    $$("#sheet-body .chip[data-f]").forEach(el => el.onclick = () => {
      filter = el.dataset.f;
      $$("#sheet-body .chip[data-f]").forEach(x => x.classList.toggle("on", x === el));
      draw();
    });
    draw();
  },

  plantingSheet(p){
    const c = crop(p.crop_id), b = DB.find("beds", p.bed_id);
    const seeds = DB.where("seeds", s => s.crop_id === p.crop_id);
    const harv = p.sown_on ? Season.harvestFrom(p.crop_id, p.sown_on, "seed") : null;
    let h = '<div class="row" style="gap:12px;margin-bottom:12px"><div style="font-size:2.4rem">' + cropEmoji(p.crop_id) + '</div>' +
      '<div class="grow"><div class="b" style="font-size:1.1rem">' + esc(cropName(p.crop_id)) + '</div>' +
      '<div class="tiny muted">Row ' + (num(p.y)+1) + ', column ' + (num(p.x)+1) + ' of ' + esc(b.name) + '</div></div></div>';

    h += '<div class="field"><label class="f">Variety</label><input type="text" id="pl-var" value="' + esc(p.variety || "") + '" placeholder="e.g. Sungold, Cherokee Purple"></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Plants in this square</label><input type="number" id="pl-qty" min="1" value="' + esc(p.qty || 1) + '"></div>' +
      '<div><label class="f">Status</label><select id="pl-status">' +
        ["planned","seeded","growing","harvesting","done"].map(s => '<option value="' + s + '"' + (p.status === s ? " selected" : "") + '>' + s + '</option>').join("") +
      '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Sown / planted</label><input type="date" id="pl-sown" value="' + esc(p.sown_on || "") + '"></div>' +
      '<div><label class="f">From seed packet</label><select id="pl-seed"><option value="">— none —</option>' +
        seeds.map(s => '<option value="' + s.id + '"' + (p.seed_id === s.id ? " selected" : "") + '>' + esc(s.name + (s.variety ? " · " + s.variety : "")) + '</option>').join("") +
      '</select></div></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="pl-notes" placeholder="Anything worth remembering">' + esc(p.notes || "") + '</textarea></div>';

    if(c){
      h += '<div class="note g" style="margin-top:12px"><b>Spacing check.</b> ' + esc(c.n) + ' wants ' + c.sp + '" between plants — about ' +
        (Math.round(c.psf * 100)/100) + ' per square foot. Your ' + esc(b.cell_in || 12) + '" squares fit ' +
        Math.max(1, Math.round(c.psf * Math.pow(num(b.cell_in,12)/12, 2))) + ' comfortably.</div>';
      if(harv) h += '<div class="note i" style="margin-top:8px">🗓️ ' + c.dtm + ' days to maturity — first harvest around <b>' + fmtY(harv) + '</b>' +
        (Season.firstFrost() && harv > Season.firstFrost() ? '. That is after your first frost — this planting may not finish.' : '.') + '</div>';
      const occ = DB.where("plantings", x => x.bed_id === b.id && x.status !== "removed" && x.id !== p.id);
      const bad = [], good = [];
      occ.forEach(o => { const r = pairRating(p.crop_id, o.crop_id);
        if(r.score <= -2) bad.push(cropName(o.crop_id)); else if(r.score >= 1) good.push(cropName(o.crop_id)); });
      if(good.length) h += '<div class="note g" style="margin-top:8px">💚 Happy neighbours: ' + esc(good.filter((v,i,a)=>a.indexOf(v)===i).join(", ")) + '</div>';
      if(bad.length) h += '<div class="note d" style="margin-top:8px">⚠️ Poor neighbours: ' + esc(bad.filter((v,i,a)=>a.indexOf(v)===i).join(", ")) + ' — move one if you can.</div>';
    }

    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost" onclick="Garden.removePlanting(\'' + p.id + '\')">Clear square</button>' +
      '<button class="btn grow" onclick="Garden.savePlanting(\'' + p.id + '\')">Save</button></div>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Library.open(\'' + p.crop_id + '\')},250)">Full growing guide →</button>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Journal.quick(\'harvest\',\'' + b.id + '\',\'' + p.id + '\')},250)">🧺 Log a harvest from this plant</button>';
    openSheet("Square details", h);
  },

  savePlanting(id){
    const p = DB.find("plantings", id); if(!p) return;
    DB.update("plantings", id, {
      variety: $("#pl-var").value.trim(), qty: num($("#pl-qty").value, 1),
      status: $("#pl-status").value, sown_on: $("#pl-sown").value,
      seed_id: $("#pl-seed").value || null, notes: $("#pl-notes").value.trim()
    });
    Cal.forPlanting(DB.find("plantings", id));
    closeSheet(); Garden.render(); toast("Saved");
  },
  removePlanting(id){
    DB.update("plantings", id, { status:"removed", removed_on: iso(today()) });
    DB.bulkRemove("events", e => e.planting_id === id && e.done !== "1");
    closeSheet(); Garden.render(); toast("Square cleared");
  },

  resize(dc, dr){
    const b = DB.find("beds", APP.bedId);
    const cols = clamp(num(b.cols) + dc, 1, 24), rows = clamp(num(b.rows) + dr, 1, 24);
    const orphan = DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed" && (num(p.x) >= cols || num(p.y) >= rows));
    const apply = () => {
      orphan.forEach(p => DB.update("plantings", p.id, { status:"removed", removed_on: iso(today()) }));
      DB.update("beds", b.id, { cols: cols, rows: rows });
      Garden.render();
    };
    if(orphan.length) confirmSheet("Shrink the bed?",
      orphan.length + " planted square" + (orphan.length > 1 ? "s fall" : " falls") + " outside the new size and will be cleared.",
      "Shrink anyway", apply, true);
    else apply();
  },

  suggest(){
    const b = DB.find("beds", APP.bedId);
    const recs = Recommend.now({ bedId: b.id }).slice(0, 12);
    let h = '<p class="muted sm" style="margin-top:0">Ranked for <b>' + esc(b.name) + '</b> — ' + esc(b.sun_hours || "?") +
      'h of sun, what is already growing there, what grew there before, and what is in your seed bank.</p>';
    if(!recs.length) h += '<div class="note i">No sowing windows are open right now. Check the calendar for what is next.</div>';
    recs.forEach(r => {
      h += '<div class="card" style="margin-bottom:10px"><div class="row" style="gap:10px">' +
        '<div style="font-size:1.8rem">' + r.crop.e + '</div><div class="grow">' +
        '<div class="b">' + esc(r.crop.n) + '</div><div class="tiny muted">' + esc(FAMILY[r.crop.fam].n) + ' · ' + r.crop.dtm + ' days · ' + r.crop.sun + 'h sun</div></div>' +
        '<button class="btn sm" onclick="Garden.paint=\'' + r.crop.id + '\';closeSheet();Garden.render();toast(\'Tap squares to place\')">Place</button></div>';
      r.why.slice(0, 3).forEach(x => h += '<div class="tiny" style="margin-top:5px">' + esc(x) + '</div>');
      r.warn.slice(0, 2).forEach(x => h += '<div class="tiny" style="margin-top:5px;color:var(--warn)">' + esc(x) + '</div>');
      h += '</div>';
    });
    openSheet("Suggestions for this bed", h);
  },

  bedMenu(){
    const b = DB.find("beds", APP.bedId);
    openSheet("Bed settings",
      '<div class="field"><label class="f">Name</label><input type="text" id="bd-name" value="' + esc(b.name) + '"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Square size (inches)</label><input type="number" id="bd-cell" value="' + esc(b.cell_in || 12) + '" min="3" max="48"></div>' +
        '<div><label class="f">Direct sun (hours)</label><input type="number" id="bd-sun" value="' + esc(b.sun_hours || 8) + '" min="0" max="16"></div>' +
      '</div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Soil</label><select id="bd-soil">' +
          ["","loam","sandy","clay","raised mix","container","silt"].map(s => '<option' + (b.soil === s ? " selected" : "") + '>' + s + '</option>').join("") + '</select></div>' +
        '<div><label class="f">Irrigation</label><select id="bd-irr">' +
          ["","hand water","drip","soaker","sprinkler","rain only"].map(s => '<option' + (b.irrigation === s ? " selected" : "") + '>' + s + '</option>').join("") + '</select></div>' +
      '</div>' +
      '<div class="field"><label class="f">Plot / group</label><select id="bd-plot"><option value="">— none —</option>' +
        DB.all("plots").map(p => '<option value="' + p.id + '"' + (b.plot_id === p.id ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select></div>' +
      '<div class="field"><label class="f">Notes</label><textarea id="bd-notes">' + esc(b.notes || "") + '</textarea></div>' +
      '<button class="btn block" style="margin-top:14px" onclick="Garden.saveBed()">Save bed</button>' +
      '<button class="btn ghost block" style="margin-top:8px" onclick="Garden.duplicateBed()">Duplicate this bed</button>' +
      '<button class="btn ghost block" style="margin-top:8px" onclick="Garden.clearBed()">Clear all plantings</button>' +
      '<button class="btn danger block" style="margin-top:8px" onclick="Garden.deleteBed()">Delete bed</button>');
  },
  saveBed(){
    const b = DB.find("beds", APP.bedId);
    DB.update("beds", b.id, {
      name: $("#bd-name").value.trim() || b.name, cell_in: num($("#bd-cell").value, 12),
      sun_hours: num($("#bd-sun").value, 8), soil: $("#bd-soil").value, irrigation: $("#bd-irr").value,
      plot_id: $("#bd-plot").value || null, notes: $("#bd-notes").value.trim()
    });
    closeSheet(); Garden.render(); toast("Bed saved");
  },
  /* DB.body, not Object.assign({}, row, {id: undefined}) — that idiom read as
     "give this a new id" and did the reverse, because Object.assign copies a
     key whose value is undefined. It also carried the original's `created`
     stamp, so a bed duplicated today claimed to have been built last spring. */
  duplicateBed(){
    const b = Geom.bed(DB.find("beds", APP.bedId)); if(!b) return;
    const nb = DB.insert("beds", Object.assign(DB.body("beds", b), { name: b.name + " (copy)" }));
    DB.where("plantings", p => p.bed_id === b.id && p.status !== "removed").forEach(p =>
      DB.insert("plantings", Object.assign(DB.body("plantings", p), { bed_id: nb.id })));
    closeSheet(); Garden.open(nb.id); toast("Bed duplicated");
  },
  clearBed(){
    confirmSheet("Clear the bed?", "Every planting in this bed is removed. Harvest records stay.", "Clear it", () => {
      DB.where("plantings", p => p.bed_id === APP.bedId).forEach(p => DB.update("plantings", p.id, { status:"removed", removed_on: iso(today()) }));
      Garden.render(); toast("Bed cleared");
    }, true);
  },
  deleteBed(){
    confirmSheet("Delete this bed?", "The bed and its plantings are permanently removed.", "Delete", () => {
      DB.bulkRemove("plantings", p => p.bed_id === APP.bedId);
      DB.bulkRemove("events", e => e.bed_id === APP.bedId);
      DB.remove("beds", APP.bedId);
      APP.bedId = null; Garden.render(); toast("Bed deleted");
    }, true);
  },

  newPlot(){
    openSheet("New plot",
      '<p class="muted sm" style="margin-top:0">A plot is a group of beds — "back yard", "community plot", "greenhouse".</p>' +
      '<div class="field"><label class="f">Plot name</label><input type="text" id="pt-name" placeholder="Back yard"></div>' +
      '<button class="btn block" style="margin-top:14px" onclick="Garden.savePlot()">Create plot</button>');
    setTimeout(() => $("#pt-name").focus(), 300);
  },
  savePlot(){
    const n = $("#pt-name").value.trim(); if(!n) return toast("Give it a name");
    const p = DB.insert("plots", { name: n });
    APP.plotId = p.id; closeSheet(); Garden.render(); toast("Plot created");
  },

  newBed(){
    const plots = DB.all("plots");
    openSheet("New bed",
      '<div class="field"><label class="f">Bed name</label><input type="text" id="nb-name" placeholder="Raised bed 1"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Columns</label><input type="number" id="nb-cols" value="4" min="1" max="24"></div>' +
        '<div><label class="f">Rows</label><input type="number" id="nb-rows" value="8" min="1" max="24"></div>' +
      '</div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Square size (in)</label><input type="number" id="nb-cell" value="12" min="3" max="48"></div>' +
        '<div><label class="f">Direct sun (hrs)</label><input type="number" id="nb-sun" value="8" min="0" max="16"></div>' +
      '</div>' +
      (plots.length ? '<div class="field"><label class="f">Plot</label><select id="nb-plot"><option value="">— none —</option>' +
        plots.map(p => '<option value="' + p.id + '"' + (APP.plotId === p.id ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select></div>' : '') +
      '<div class="note i" style="margin-top:12px">12" squares are the classic square-foot grid: 1 tomato, 4 lettuce, 9 beets, or 16 carrots per square. Change the size for wide-row or in-ground beds.</div>' +
      '<button class="btn block" style="margin-top:14px" onclick="Garden.saveNewBed()">Create bed</button>');
    setTimeout(() => $("#nb-name").focus(), 300);
  },
  saveNewBed(){
    const b = DB.insert("beds", {
      name: $("#nb-name").value.trim() || ("Bed " + (DB.count("beds") + 1)),
      cols: clamp(num($("#nb-cols").value, 4), 1, 24), rows: clamp(num($("#nb-rows").value, 8), 1, 24),
      cell_in: num($("#nb-cell").value, 12), sun_hours: num($("#nb-sun").value, 8),
      plot_id: ($("#nb-plot") ? $("#nb-plot").value : "") || APP.plotId || null
    });
    closeSheet(); Garden.open(b.id); toast("Bed created — tap a square to plant");
  }
};
</script>
