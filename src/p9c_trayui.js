<script>
/* ============================================================
   THE TRAY SCREEN

   Lives on the Seeds tab behind a segmented control, because a
   tray is what you do with a packet and looking for it anywhere
   else would be odd. The tray itself is drawn as the grid it is,
   so the cell you are tapping is the cell in front of you.
   ============================================================ */

const TrayUI = {
  view: "packets",         /* packets | trays */
  open: null,              /* the tray being looked at */
  brush: null,             /* a crop armed for tapping across cells */

  setView(v){ TrayUI.view = v; TrayUI.open = null; Seeds.render(); },

  tabs(){
    const n = DB.count("trays");
    return '<div class="seg" style="margin-bottom:12px">' +
      '<button class="' + (TrayUI.view === "packets" ? "on" : "") + '" onclick="TrayUI.setView(\'packets\')">🌰 Packets</button>' +
      '<button class="' + (TrayUI.view === "trays" ? "on" : "") + '" onclick="TrayUI.setView(\'trays\')">🌱 Trays' +
        (n ? ' <span class="tiny">(' + n + ')</span>' : '') + '</button></div>';
  },

  /* ============================================================
     THE LIST
     ============================================================ */
  list(){
    const trays = Trays.all();
    let h = '';

    if(!trays.length){
      h += '<div class="card"><div class="empty"><span class="e">🌱</span><div class="b">No trays yet</div>' +
        '<div class="tiny">A tray records what went into which cell, works out when each one should sprout and when it can go outside, ' +
        'and plants it straight into a bed when it is ready — keeping the original sowing date so your harvest dates stay honest.</div></div>' +
        '<button class="btn block" onclick="TrayUI.newTray()">Start a tray</button></div>';
      return h;
    }

    const cells = DB.all("traycells").filter(c => c.crop_id && !c.out_on);
    const due = cells.filter(c => {
      const t = DB.find("trays", c.tray_id);
      const s = Trays.state(c, t);
      return s.k === "due" || s.k === "check" || s.k === "late";
    });
    h += '<div class="card"><div class="grid3">' +
      '<div class="stat"><span class="n">' + trays.length + '</span><span class="l">trays</span></div>' +
      '<div class="stat"><span class="n">' + cells.length + '</span><span class="l">growing</span></div>' +
      '<div class="stat"><span class="n">' + due.length + '</span><span class="l">need you</span></div>' +
      '</div></div>';

    if(due.length){
      h += '<div class="sec"><h2>Needs a look</h2></div><div class="card pad0"><div class="list">';
      due.slice(0, 8).forEach(c => {
        const t = DB.find("trays", c.tray_id);
        const s = Trays.state(c, t);
        h += '<button class="item" onclick="TrayUI.cell(\'' + c.id + '\')">' +
          '<div class="av">' + cropEmoji(c.crop_id) + '</div>' +
          '<div class="grow"><div class="b">' + esc(cropName(c.crop_id)) +
            (c.variety ? ' <span class="tiny muted">' + esc(c.variety) + '</span>' : '') + '</div>' +
          '<div class="tiny ' + (s.k === "late" ? '" style="color:var(--warn)' : 'muted') + '">' + esc(s.t) + '</div>' +
          '<div class="tiny muted">' + esc(t ? t.name : "") + ' · cell ' + (num(c.idx, 0) + 1) + '</div></div>' +
          '<span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    h += '<button class="btn block" style="margin-top:12px" onclick="TrayUI.newTray()">＋ New tray</button>';

    trays.forEach(t => {
      const s = Trays.summary(t);
      const r = Trays.rate(Trays.filled(t.id));
      h += '<div class="card" style="margin-top:12px"><div class="row between">' +
        '<div class="grow"><div class="b">' + esc(t.name) + '</div>' +
        '<div class="tiny muted">' + num(t.cols, 6) + '×' + num(t.rows, 4) + ' · sown ' + fmt(t.sown_on) +
          (t.location ? ' · ' + esc(t.location) : '') + (num(t.heat_mat) ? ' · heat mat' : '') + '</div>' +
        '<div class="tiny muted">' + s.n + ' of ' + s.size + ' sown · ' + s.up + ' up' +
          (s.no ? ' · ' + s.no + ' failed' : '') + (s.out ? ' · ' + s.out + ' planted out' : '') +
          (r ? ' · ' + r.pct + '% germination' : '') + '</div></div>' +
        '<button class="btn sm" onclick="TrayUI.show(\'' + t.id + '\')">Open</button></div>' +
        TrayUI.mini(t) + '</div>';
    });
    return h;
  },

  /* the tray drawn small, for the list */
  mini(t){
    const cells = Trays.cells(t.id), cols = Math.max(1, num(t.cols, 6));
    const cs = clamp(Math.floor(250 / cols), 9, 22);
    let h = '<div class="bedwrap" style="padding:4px;margin-top:8px"><div class="bed" style="grid-template-columns:repeat(' +
      cols + ',' + cs + 'px);gap:2px">';
    cells.forEach(c => {
      const st = c.crop_id ? Trays.state(c, t) : null;
      const bg = !c.crop_id ? "" : c.out_on ? "background:var(--green-300)"
        : c.sprouted === "0" ? "opacity:.4"
        : (st && (st.k === "late" || st.k === "check")) ? "outline:2px solid var(--warn)" : "";
      h += '<div class="cell ' + (c.crop_id ? "filled" : "") + '" style="width:' + cs + 'px;height:' + cs +
        'px;font-size:' + Math.round(cs * 0.6) + 'px;' + bg + '">' + (c.crop_id ? cropEmoji(c.crop_id) : "") + '</div>';
    });
    return h + '</div></div>';
  },

  /* ============================================================
     ONE TRAY
     ============================================================ */
  show(id){ TrayUI.open = id; TrayUI.brush = null; Seeds.render(); },
  back(){ TrayUI.open = null; TrayUI.brush = null; Seeds.render(); },

  detail(){
    const t = DB.find("trays", TrayUI.open);
    if(!t){ TrayUI.open = null; return TrayUI.list(); }
    const cells = Trays.cells(t.id);
    const cols = Math.max(1, num(t.cols, 6));
    const s = Trays.summary(t), r = Trays.rate(Trays.filled(t.id));

    let h = '<div class="row" style="margin-bottom:10px"><button class="iconbtn" onclick="TrayUI.back()">‹</button>' +
      '<div class="grow"><div class="b">' + esc(t.name) + '</div>' +
      '<div class="tiny muted">Sown ' + fmt(t.sown_on) + ' · ' + s.n + ' of ' + s.size + ' cells' +
        (r ? ' · ' + r.pct + '% up' : '') + '</div></div>' +
      '<button class="iconbtn" onclick="TrayUI.menu()">⋯</button></div>';

    h += '<div class="cvbar">';
    if(TrayUI.brush){
      h += '<span class="chip on">' + cropEmoji(TrayUI.brush.crop_id) + ' Tap cells to sow ' + esc(cropName(TrayUI.brush.crop_id)) + '</span>' +
        '<button class="chip" onclick="TrayUI.brush=null;Seeds.render()">Done</button>';
    } else {
      h += '<button class="chip" onclick="TrayUI.pickBrush()">🌱 Sow into cells</button>' +
        '<button class="chip" onclick="TrayUI.sproutSheet()">✓ Record what came up</button>' +
        '<button class="chip" onclick="TrayUI.outSheet()">🪴 Plant out</button>';
    }
    h += '</div>';

    const cs = clamp(Math.floor((Math.min(window.innerWidth, 520) - 60) / cols), 26, 64);
    h += '<div class="bedwrap" style="margin-top:10px"><div class="bed" style="grid-template-columns:repeat(' +
      cols + ',' + cs + 'px);gap:3px">';
    cells.forEach(c => {
      const st = c.crop_id ? Trays.state(c, t) : null;
      let extra = "";
      if(c.out_on) extra = "background:var(--green-300)";
      else if(c.sprouted === "0") extra = "opacity:.42";
      else if(st && (st.k === "late" || st.k === "check")) extra = "outline:2px solid var(--warn)";
      else if(st && st.k === "due") extra = "outline:2px solid var(--green-600)";
      h += '<button class="cell ' + (c.crop_id ? "filled" : "") + '" onclick="TrayUI.tap(\'' + c.id + '\')" ' +
        'style="width:' + cs + 'px;height:' + cs + 'px;font-size:' + Math.round(cs * 0.55) + 'px;' + extra + '">' +
        (c.crop_id ? cropEmoji(c.crop_id) : '<span style="opacity:.35;font-size:.7em">+</span>') +
        (c.sprouted === "1" && !c.out_on ? '<span style="position:absolute;right:1px;bottom:0;font-size:.44em">🌿</span>' : '') +
        '</button>';
    });
    h += '</div></div>';
    h += '<div class="row center tiny muted" style="gap:10px;margin-top:8px;justify-content:center;flex-wrap:wrap">' +
      '<span>🌿 up</span><span>▢ outlined = wants a decision</span><span>green = planted out</span></div>';

    /* what is coming, grouped by what the app wants you to do */
    const groups = { check:[], late:[], due:[], waiting:[], growing:[], out:[], failed:[] };
    Trays.filled(t.id).forEach(c => { const st = Trays.state(c, t); (groups[st.k] = groups[st.k] || []).push([c, st]); });
    const order = [["late","Overdue to sprout"],["check","Due to sprout — did they?"],["due","Ready for the garden"],
                   ["waiting","Still coming"],["growing","Growing on"],["out","In the garden"],["failed","Did not come up"]];
    order.forEach(g => {
      const arr = groups[g[0]] || []; if(!arr.length) return;
      h += '<div class="sec"><h2>' + g[1] + '</h2><span class="tiny muted">' + arr.length + '</span></div>' +
        '<div class="card pad0"><div class="list">';
      arr.forEach(pair => {
        const c = pair[0], st = pair[1], p = Trays.plan(c, t);
        h += '<button class="item" onclick="TrayUI.cell(\'' + c.id + '\')"><div class="av">' + cropEmoji(c.crop_id) + '</div>' +
          '<div class="grow"><div class="b">' + esc(cropName(c.crop_id)) +
            (c.variety ? ' · <span class="tiny">' + esc(c.variety) + '</span>' : '') +
            ' <span class="tiny muted">cell ' + (num(c.idx, 0) + 1) + '</span></div>' +
          '<div class="tiny muted">' + esc(st.t) + '</div>' +
          (p && p.harvest && !c.out_on ? '<div class="tiny muted">First harvest around ' + fmtY(p.harvest) + '</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    });

    if(r) h += '<div class="note ' + (r.pct >= 70 ? "g" : r.pct >= 40 ? "w" : "d") + '" style="margin-top:12px">🧪 <b>' +
      r.pct + '% germination</b> across ' + r.cells + ' cell' + (r.cells === 1 ? "" : "s") + ' you have judged. ' +
      'That is a real measurement of the seed you actually own — better than anything printed on the packet.' +
      '</div>';

    return h;
  },

  /* ============================================================
     TAPPING A CELL
     ============================================================ */
  tap(cellId){
    const c = DB.find("traycells", cellId); if(!c) return;
    haptic();
    if(TrayUI.brush && !c.out_on){
      Trays.sow(cellId, {
        crop_id: TrayUI.brush.crop_id, variety: TrayUI.brush.variety || null,
        variety_id: TrayUI.brush.variety_id || null, seed_id: TrayUI.brush.seed_id || null,
        seeds_sown: TrayUI.brush.seeds_sown || 2
      });
      return Seeds.render();
    }
    if(!c.crop_id) return TrayUI.sowSheet(cellId);
    TrayUI.cell(cellId);
  },

  cell(cellId){
    const c = DB.find("traycells", cellId); if(!c) return;
    const t = DB.find("trays", c.tray_id);
    const p = Trays.plan(c, t), st = Trays.state(c, t);
    const sd = c.seed_id ? DB.find("seeds", c.seed_id) : null;

    let h = '<div class="row" style="gap:12px;margin-bottom:12px"><div style="font-size:2.4rem">' + cropEmoji(c.crop_id) + '</div>' +
      '<div class="grow"><div class="b" style="font-size:1.1rem">' + esc(cropName(c.crop_id)) + '</div>' +
      '<div class="tiny muted">' + esc(t ? t.name : "") + ' · cell ' + (num(c.idx, 0) + 1) +
        (c.variety ? ' · ' + esc(c.variety) : '') + '</div>' +
      '<div class="tiny muted">' + esc(st.t) + '</div></div></div>';

    if(p){
      h += '<div class="card"><table class="mini">' +
        '<tr><th>Sown</th><td>' + fmtY(p.sownISO) + '</td></tr>' +
        '<tr><th>Should sprout</th><td>' + fmt(p.sproutFrom) + ' – ' + fmt(p.sproutTo) +
          ' <span class="tiny muted">(' + p.crop.germ[0] + '–' + p.crop.germ[1] + ' days)</span></td></tr>' +
        (p.harden ? '<tr><th>Harden off</th><td>' + fmtY(p.harden) + '</td></tr>' : '') +
        (p.out ? '<tr><th>Plant out</th><td>' + fmtY(p.out) +
          (p.weeksInTray ? ' <span class="tiny muted">(' + p.weeksInTray + ' weeks in the tray)</span>' : '') + '</td></tr>'
          : '<tr><th>Plant out</th><td class="muted">This crop has no published indoor window — it is usually sown where it grows.</td></tr>') +
        (p.harvest ? '<tr><th>First harvest</th><td>' + fmtY(p.harvest) + '</td></tr>' : '') +
        (sd ? '<tr><th>From packet</th><td>' + esc(sd.name) + (sd.brand ? ' · ' + esc(sd.brand) : '') + '</td></tr>' : '') +
        '<tr><th>Seeds in this cell</th><td>' + num(c.seeds_sown, 1) + '</td></tr>' +
        '</table></div>';
      h += '<div class="tiny muted" style="margin-top:8px">Planting it out keeps the sowing date above, so the harvest projection counts from the seed rather than from the day it reached the bed.</div>';
    }

    if(c.out_on){
      h += '<div class="note g" style="margin-top:12px">🪴 Planted out ' + fmtY(c.out_on) +
        (c.bed_id && DB.find("beds", c.bed_id) ? ' into <b>' + esc(DB.find("beds", c.bed_id).name) + '</b>' : '') + '.</div>';
      if(c.planting_id && DB.find("plantings", c.planting_id))
        h += '<button class="btn ghost block" style="margin-top:10px" onclick="closeSheet();setTimeout(function(){Garden.open(\'' +
          c.bed_id + '\')},250)">Open that bed →</button>';
    } else {
      h += '<div class="sec"><h2>Did it come up?</h2></div><div class="row" style="gap:8px">' +
        '<button class="btn ' + (c.sprouted === "1" ? "" : "ghost") + ' grow" onclick="TrayUI.mark(\'' + c.id + '\',true)">🌿 Yes</button>' +
        '<button class="btn ' + (c.sprouted === "0" ? "danger" : "ghost") + ' grow" onclick="TrayUI.mark(\'' + c.id + '\',false)">✕ No</button></div>';
      if(c.sprouted === "1" && c.sprouted_on)
        h += '<div class="tiny muted" style="margin-top:6px">Recorded as sprouting on ' + fmtY(c.sprouted_on) + '.</div>';

      if(c.sprouted !== "0")
        h += '<button class="btn block" style="margin-top:12px" onclick="TrayUI.outOne(\'' + c.id + '\')">🪴 Plant this out →</button>';
      h += '<div class="row" style="gap:8px;margin-top:8px">' +
        '<button class="btn ghost grow" onclick="TrayUI.sowSheet(\'' + c.id + '\')">Edit what is sown here</button>' +
        '<button class="btn ghost" onclick="TrayUI.clear(\'' + c.id + '\')">Empty</button></div>';
    }
    openSheet("Cell " + (num(c.idx, 0) + 1), h);
  },

  mark(cellId, up){
    Trays.mark(cellId, up);
    closeSheet(); Seeds.render();
    toast(up ? "Recorded as up 🌿" : "Recorded as a miss");
    if(!up) return;
    /* a tray is real evidence about a packet, and the packet's printed rate is
       a claim. Offer the swap; never make it silently — she may have let it dry out. */
    const c = DB.find("traycells", cellId);
    if(!c || !c.seed_id) return;
    const sd = DB.find("seeds", c.seed_id); if(!sd) return;
    const sibs = DB.where("traycells", x => x.seed_id === c.seed_id);
    const r = Trays.rate(sibs);
    if(!r || r.cells < 6) return;
    if(sd.germ_rate && Math.abs(num(sd.germ_rate) - r.pct) < 12) return;
    setTimeout(() => confirmSheet("Update this packet's germination?",
      "Across " + r.cells + " cells of " + sd.name + " you have had " + r.pct + "% come up" +
      (sd.germ_rate ? ", against the " + sd.germ_rate + "% currently recorded" : "") +
      ". Your own tray is better evidence than the packet. The app uses this figure to work out how much to sow.",
      "Use " + r.pct + "%", () => { DB.update("seeds", sd.id, { germ_rate: r.pct }); Seeds.render(); toast("Packet updated"); }), 260);
  },

  clear(cellId){
    Trays.clear(cellId); closeSheet(); Seeds.render(); toast("Cell emptied");
  },

  /* ============================================================
     SOWING
     ============================================================ */
  pickBrush(){
    TrayUI.chooseSeed("Sow into cells", pick => {
      TrayUI.brush = pick; closeSheet(); Seeds.render();
      toast("Tap cells to sow " + cropName(pick.crop_id));
    });
  },
  sowSheet(cellId){
    TrayUI.chooseSeed("What is in this cell?", pick => {
      Trays.sow(cellId, { crop_id: pick.crop_id, variety: pick.variety || null,
        variety_id: pick.variety_id || null, seed_id: pick.seed_id || null,
        seeds_sown: pick.seeds_sown || 2 });
      closeSheet(); Seeds.render(); toast("Sown");
    });
  },

  /* your own packets first — a tray is nearly always sown from one */
  chooseSeed(title, onPick){
    const packets = DB.all("seeds").slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    let h = '<p class="muted sm" style="margin-top:0">Pick the packet it came from where you can — the tray then knows the variety, ' +
      'and what actually sprouts feeds back into that packet\'s germination rate.</p>';
    h += '<div class="field"><label class="f">Seeds per cell</label>' +
      '<input type="number" id="tr-n" min="1" max="20" value="2"></div>';
    if(packets.length){
      h += '<div class="sec"><h2>Your packets</h2></div><div class="card pad0"><div class="list">';
      packets.forEach(s => {
        const v = Seeds.viability(s);
        h += '<button class="item" data-seed="' + s.id + '"><div class="av">' + cropEmoji(s.crop_id) + '</div>' +
          '<div class="grow"><div class="b">' + esc(s.name) + (s.variety ? ' · ' + esc(s.variety) : '') + '</div>' +
          '<div class="tiny muted">' + esc(cropName(s.crop_id)) + (s.brand ? ' · ' + esc(s.brand) : '') +
            (s.germ_rate ? ' · ' + esc(s.germ_rate) + '% germination' : '') + '</div>' +
          (v && v.level === "expired" ? '<div class="tiny" style="color:var(--warn)">Past its typical viability — sow it thicker</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }
    h += '<button class="btn ghost block" style="margin-top:12px" id="tr-nocrop">Pick a crop instead (no packet)</button>';
    openSheet(title, h);

    const seedsPer = () => clamp(num(($("#tr-n") || {}).value, 2), 1, 20);
    $$("#sheet-body .item[data-seed]").forEach(el => el.onclick = () => {
      const s = DB.find("seeds", el.dataset.seed); if(!s) return;
      onPick({ crop_id: s.crop_id, variety: s.variety || null, seed_id: s.id, seeds_sown: seedsPer() });
    });
    $("#tr-nocrop").onclick = () => {
      const n = seedsPer();
      Garden.cropPicker("Sow which crop?", id => onPick({ crop_id: id, seeds_sown: n }));
    };
  },

  /* ============================================================
     RECORDING RESULTS IN BULK — the realistic way it happens
     ============================================================ */
  sproutSheet(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    const pending = Trays.filled(t.id).filter(c => !c.sprouted && !c.out_on);
    if(!pending.length) return toast("Nothing waiting on an answer");
    let h = '<p class="muted sm" style="margin-top:0">Walk the tray and tap what is up. Anything you leave alone stays undecided.</p>';
    h += '<div class="card pad0"><div class="list">';
    pending.forEach(c => {
      h += '<div class="item"><div class="av">' + cropEmoji(c.crop_id) + '</div>' +
        '<div class="grow"><div class="b">' + esc(cropName(c.crop_id)) + ' <span class="tiny muted">cell ' + (num(c.idx, 0) + 1) + '</span></div>' +
        '<div class="tiny muted">' + esc(Trays.state(c, t).t) + '</div></div>' +
        '<div class="row" style="gap:6px">' +
        '<button class="chip good" onclick="TrayUI.quick(\'' + c.id + '\',true)">🌿</button>' +
        '<button class="chip bad" onclick="TrayUI.quick(\'' + c.id + '\',false)">✕</button></div></div>';
    });
    h += '</div></div>';
    openSheet("What came up?", h);
  },
  quick(cellId, up){
    Trays.mark(cellId, up);
    Seeds.render();
    TrayUI.sproutSheet();
  },

  /* ============================================================
     OUT INTO THE GARDEN
     ============================================================ */
  outOne(cellId){
    const c = DB.find("traycells", cellId); if(!c) return;
    TrayUI.pickBed("Plant it where?", bedId => {
      const r = Trays.plantOut(cellId, bedId);
      closeSheet();
      if(!r || r.error) return toast(r && r.error ? r.error : "Could not plant that out");
      Seeds.render();
      toast(cropName(c.crop_id) + " planted into " + r.bed.name);
    });
  },
  outSheet(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    const ready = Trays.filled(t.id).filter(c => !c.out_on && c.sprouted !== "0");
    if(!ready.length) return toast("Nothing ready to go out");
    const now = ready.filter(c => Trays.state(c, t).k === "due");
    let h = '<p class="muted sm" style="margin-top:0">' + ready.length + ' seedling' + (ready.length === 1 ? "" : "s") +
      ' could go out' + (now.length ? ', ' + now.length + ' of which the app thinks ' + (now.length === 1 ? "is" : "are") + ' ready now' : '') +
      '. Each becomes a planting that keeps its original sowing date.</p>';
    h += '<div class="note w">Check your own frost dates before moving anything tender outside — the app works from ten-year medians, and a late frost does not read them.</div>';
    h += '<div class="card pad0" style="margin-top:12px"><div class="list">';
    ready.forEach(c => {
      const st = Trays.state(c, t);
      h += '<button class="item" onclick="closeSheet();setTimeout(function(){TrayUI.outOne(\'' + c.id + '\')},220)">' +
        '<div class="av">' + cropEmoji(c.crop_id) + '</div><div class="grow">' +
        '<div class="b">' + esc(cropName(c.crop_id)) + (c.variety ? ' · ' + esc(c.variety) : '') + '</div>' +
        '<div class="tiny ' + (st.k === "due" ? '" style="color:var(--green-600)' : 'muted') + '">' + esc(st.t) + '</div></div>' +
        '<span class="go">›</span></button>';
    });
    h += '</div></div>';
    h += '<button class="btn block" style="margin-top:12px" onclick="TrayUI.outAll()">🪴 Plant all ' + ready.length + ' into one bed</button>';
    openSheet("Plant out", h);
  },
  outAll(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    TrayUI.pickBed("Plant them all where?", bedId => {
      const made = Trays.plantAllOut(t.id, bedId);
      closeSheet(); Seeds.render();
      const bed = DB.find("beds", bedId);
      toast(made.length ? made.length + " planted into " + bed.name : "No room in that bed");
    });
  },

  pickBed(title, onPick){
    const beds = DB.all("beds");
    if(!beds.length) return toast("Make a bed on the Garden tab first");
    let h = '<div class="card pad0"><div class="list">';
    beds.forEach(b => {
      const bb = Geom.bed(b);
      const n = Geom.live(b.id).length;
      h += '<button class="item" data-bed="' + b.id + '"><div class="av">🪴</div>' +
        '<div class="grow"><div class="b">' + esc(b.name) + '</div>' +
        '<div class="tiny muted">' + Units.dims(Geom.W(bb), Geom.H(bb)) + ' · ' + Units.area(Geom.areaSqFt(bb)) +
          ' · ' + n + ' planted' + (b.plot_id && DB.find("plots", b.plot_id) ? ' · ' + esc(DB.find("plots", b.plot_id).name) : '') +
        '</div></div><span class="go">›</span></button>';
    });
    h += '</div></div>';
    openSheet(title, h);
    $$("#sheet-body .item[data-bed]").forEach(el => el.onclick = () => onPick(el.dataset.bed));
  },

  /* ============================================================
     MAKING AND EDITING A TRAY
     ============================================================ */
  newTray(){
    openSheet("New tray",
      '<div class="field"><label class="f">Name</label><input type="text" id="tn-name" placeholder="Tomatoes and peppers"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Cells across</label><input type="number" id="tn-c" value="6" min="1" max="12"></div>' +
        '<div><label class="f">Cells down</label><input type="number" id="tn-r" value="4" min="1" max="12"></div></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Sown on</label><input type="date" id="tn-d" value="' + iso(today()) + '"></div>' +
        '<div><label class="f">Where it lives</label><input type="text" id="tn-loc" placeholder="Windowsill, under lights"></div></div>' +
      '<div class="row between" style="margin-top:14px"><div><div class="b sm">On a heat mat</div>' +
        '<div class="tiny muted">Worth noting — it changes what germinates and how fast.</div></div>' +
        '<button class="switch" id="tn-heat"></button></div>' +
      '<button class="btn block" style="margin-top:16px" onclick="TrayUI.saveNew()">Create tray</button>');
    const g = $("#tn-heat"); if(g) g.onclick = () => g.classList.toggle("on");
    setTimeout(() => { const el = $("#tn-name"); if(el) el.focus(); }, 300);
  },
  saveNew(){
    const t = Trays.create({
      name: ($("#tn-name").value || "").trim() || ("Tray " + (DB.count("trays") + 1)),
      cols: num($("#tn-c").value, 6), rows: num($("#tn-r").value, 4),
      sown_on: $("#tn-d").value || iso(today()),
      location: ($("#tn-loc").value || "").trim(),
      heat_mat: $("#tn-heat").classList.contains("on")
    });
    closeSheet(); TrayUI.view = "trays"; TrayUI.show(t.id);
    toast("Tray created — tap a cell to sow it");
  },

  menu(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    openSheet("Tray settings",
      '<div class="field"><label class="f">Name</label><input type="text" id="te-name" value="' + esc(t.name) + '"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Cells across</label><input type="number" id="te-c" value="' + num(t.cols, 6) + '" min="1" max="12"></div>' +
        '<div><label class="f">Cells down</label><input type="number" id="te-r" value="' + num(t.rows, 4) + '" min="1" max="12"></div></div>' +
      '<div class="grid2" style="margin-top:12px">' +
        '<div><label class="f">Sown on</label><input type="date" id="te-d" value="' + esc(t.sown_on || "") + '"></div>' +
        '<div><label class="f">Where it lives</label><input type="text" id="te-loc" value="' + esc(t.location || "") + '"></div></div>' +
      '<div class="field"><label class="f">Notes</label><textarea id="te-notes">' + esc(t.notes || "") + '</textarea></div>' +
      '<div class="tiny muted">Shrinking the grid only drops empty cells — a cell you have sown is a record and is never thrown away to fit.</div>' +
      '<button class="btn block" style="margin-top:14px" onclick="TrayUI.saveEdit()">Save</button>' +
      '<button class="btn danger block" style="margin-top:8px" onclick="TrayUI.del()">Delete this tray</button>');
  },
  saveEdit(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    Trays.resize(t.id, num($("#te-c").value, 6), num($("#te-r").value, 4));
    DB.update("trays", t.id, {
      name: ($("#te-name").value || "").trim() || t.name,
      sown_on: $("#te-d").value || t.sown_on,
      location: ($("#te-loc").value || "").trim(),
      notes: ($("#te-notes").value || "").trim()
    });
    Cal.rebuild();
    closeSheet(); Seeds.render(); toast("Tray saved");
  },
  del(){
    const t = DB.find("trays", TrayUI.open); if(!t) return;
    const s = Trays.summary(t);
    confirmSheet("Delete " + t.name + "?",
      s.out ? s.out + " seedling" + (s.out === 1 ? " has" : "s have") + " already been planted out. Those plantings stay in the garden; only the tray record goes."
            : "The tray and everything recorded in it goes. Seed packets are not touched.",
      "Delete", () => { Trays.remove(t.id); TrayUI.back(); closeSheet(); toast("Tray deleted"); }, true);
  }
};

/* ---------- fold it into the Seeds tab ---------- */
(function wireTrays(){
  const orig = Seeds.render;
  Seeds.render = function(){
    const box = $("#s-seeds");
    if(TrayUI.view === "trays"){
      box.innerHTML = TrayUI.tabs() + (TrayUI.open ? TrayUI.detail() : TrayUI.list());
      return;
    }
    orig.call(Seeds);
    box.innerHTML = TrayUI.tabs() + box.innerHTML;
    /* the search box loses its handler when the markup is re-wrapped */
    const qi = $("#sd-q");
    if(qi) qi.oninput = e => { Seeds.q = e.target.value; Seeds.render();
      setTimeout(() => { const n = $("#sd-q"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); };
  };
})();
</script>
