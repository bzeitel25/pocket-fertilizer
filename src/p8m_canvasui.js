<script>
/* ============================================================
   THE BED SCREEN

   Canvas at the top, a scrubber under it, and everything the old
   grid screen said still said — companions, crowding, care,
   rotation — but measured off real distances rather than counted
   in squares.

   The scrubber is the part that changes how people plan. A bed
   looks sensible in April because in April everything is a
   seedling. Drag to July and the tomato you put on the south side
   is suddenly four feet across and the lettuce behind it has not
   seen the sun in a month. That is much easier to see than to
   reason about.
   ============================================================ */
Object.assign(Garden, {

  bedView(){
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    if(!bed){ APP.bedId = null; return Garden.listView(); }
    const box = $("#s-garden");
    const when = Canvas.date();
    const ps = Geom.live(bed.id);
    const conflicts = Recommend.conflicts(bed.id);
    const friends = Recommend.friends(bed.id);
    const crowd = Recommend.crowding(bed.id);
    const shade = Recommend.shading(bed.id, when);
    const sqft = Geom.areaSqFt(bed);
    const sh = Geom.SHAPES[Geom.shape(bed)] || Geom.SHAPES.rect;

    let h = '';
    h += '<div class="row" style="margin-bottom:10px"><button class="iconbtn" onclick="Garden.back()">‹</button>' +
      '<div class="grow"><div class="b">' + esc(bed.name) + '</div>' +
      '<div class="tiny muted">' + sh.e + ' ' + esc(sh.n.toLowerCase()) + ' · ' +
      Math.round(Geom.W(bed)/12*10)/10 + '×' + Math.round(Geom.H(bed)/12*10)/10 + ' ft · ' +
      sqft + ' sq ft · ' + esc(bed.sun_hours || "?") + 'h sun</div></div>' +
      '<button class="iconbtn" onclick="Garden.bedMenu()">⋯</button></div>';

    /* ---- toolbar ---- */
    h += '<div class="cvbar">';
    if(Garden.paint){
      h += '<span class="chip on">' + cropEmoji(Garden.paint) + ' Tap to plant ' + esc(cropName(Garden.paint)) + '</span>' +
           '<button class="chip" onclick="Garden.paint=null;Garden.render()">Done</button>';
    } else if(Garden.erase){
      h += '<span class="chip bad">🧹 Tap a plant to remove it</span>' +
           '<button class="chip" onclick="Garden.erase=false;Garden.render()">Done</button>';
    } else if(Garden.clip){
      h += '<span class="chip on">📋 Placing ' + esc(cropName(Garden.clip.crop_id)) + '</span>' +
           '<button class="chip" onclick="Garden.clearClip()">Done</button>';
    } else {
      h += '<button class="chip" onclick="Garden.pickPaint()">🌱 Plant</button>' +
           '<button class="chip" onclick="Garden.erase=true;Garden.render()">🧹 Remove</button>' +
           '<button class="chip" onclick="Garden.suggest()">✨ Suggest</button>' +
           '<button class="chip" onclick="Shape.open()">' + sh.e + ' Shape</button>';
    }
    h += '<button class="chip' + (num(bed.grid_on) ? " on" : "") + '" onclick="Garden.toggleGrid()">▦ Grid</button>' +
         '<button class="chip' + (Canvas.showRoots ? " on" : "") + '" onclick="Canvas.showRoots=!Canvas.showRoots;Garden.render()">⊙ Roots</button>' +
         '<button class="chip' + (Canvas.wantLabels(bed) ? " on" : "") + '" onclick="Garden.toggleLabels()">🏷️ Names</button>';
    h += '</div>';

    /* ---- the canvas ---- */
    h += '<div class="canvaswrap" id="cvhost" style="margin-top:10px">' +
      Canvas.svg(bed, { interactive:true, when: when }) + '</div>';
    h += '<div class="tiny muted center" style="margin-top:6px">Tap bare soil to plant. Press and hold a plant to drag it anywhere — ' +
      'the ring shows how wide it will get, and you can drag the white handle on a selected plant to resize it.</div>';

    /* ---- the scrubber ---- */
    h += '<div class="tlwrap"><div class="tlhead">' +
      '<div class="b" id="tl-date">' + (num(Garden.tl) === 0 ? "Today" : fmtY(when)) + '</div>' +
      '<div class="tiny muted" id="tl-note">' + esc(Garden.tlNote(bed, when)) + '</div></div>' +
      '<input type="range" id="tl-range" min="-6" max="34" step="1" value="' + num(Garden.tl, 0) +
      '" oninput="Garden.scrub(this.value)">' +
      '<div class="row between tiny muted"><span>6 weeks back</span>' +
      '<button class="chip" style="padding:2px 8px" onclick="Garden.scrub(0)">Today</button>' +
      '<span>8 months on</span></div></div>';

    /* ---- what the plan is telling her ---- */
    if(crowd.length){
      h += '<div class="sec"><h2>Too close together</h2><span class="tiny muted">' + crowd.length + '</span></div><div class="card">';
      crowd.slice(0, 4).forEach(c => h += '<div class="note w" style="margin-bottom:8px">⊙ ' +
        cropEmoji(c.a.crop_id) + ' <b>' + esc(cropName(c.a.crop_id)) + '</b> and ' +
        cropEmoji(c.b.crop_id) + ' <b>' + esc(cropName(c.b.crop_id)) + '</b> overlap at the root by ' +
        c.overlap + '". Leaves may weave together happily; roots competing for the same water is a smaller crop from both.</div>');
      h += '</div>';
    }
    if(shade.length){
      const bad = shade.filter(s => !s.ok), good = shade.filter(s => s.ok);
      h += '<div class="sec"><h2>Light and shade</h2></div><div class="card">';
      bad.slice(0, 3).forEach(s => h += '<div class="note d" style="margin-bottom:8px">🌑 ' +
        cropEmoji(s.tall.crop_id) + ' <b>' + esc(cropName(s.tall.crop_id)) + '</b> reaches about ' +
        Geom.height(s.tall.crop_id) + '" and will stand over ' + cropEmoji(s.low.crop_id) + ' <b>' +
        esc(cropName(s.low.crop_id)) + '</b>, which wants ' + crop(s.low.crop_id).sun +
        'h of sun. Move it to the sunny side, or swap in something that tolerates shade.</div>');
      const seenGuild = {};
      good.slice(0, 4).forEach(s => {
        const k = s.tall.crop_id + "|" + s.low.crop_id;
        if(seenGuild[k]) return; seenGuild[k] = 1;
        h += '<div class="note g" style="margin-bottom:8px">🌿 <b>Understorey.</b> ' +
        cropEmoji(s.low.crop_id) + ' ' + esc(cropName(s.low.crop_id)) + ' under ' +
        cropEmoji(s.tall.crop_id) + ' ' + esc(cropName(s.tall.crop_id)) + ' is a real guild — ' +
        (s.companion
          ? 'these two are recommended together, and the shade is part of why.'
          : 'it takes the shade, keeps the soil covered, and crops before the tall one closes over.') + '</div>';
      });
      h += '</div>';
    }
    if(friends.length){
      h += '<div class="sec"><h2>Good neighbours</h2></div><div class="card">';
      const seen = {};
      friends.slice(0, 6).forEach(f => {
        const key = [f.a.crop_id, f.b.crop_id].sort().join("|");
        if(seen[key]) return; seen[key] = 1;
        h += '<div class="note g" style="margin-bottom:8px">💚 ' + cropEmoji(f.a.crop_id) + ' <b>' + esc(cropName(f.a.crop_id)) +
          '</b> beside ' + cropEmoji(f.b.crop_id) + ' <b>' + esc(cropName(f.b.crop_id)) + '</b> · ' + f.dist +
          '" apart<br>' + esc(f.why) + '</div>';
      });
      h += '</div>';
    }
    if(conflicts.length){
      h += '<div class="sec"><h2>Companion warnings</h2></div><div class="card">';
      conflicts.slice(0, 5).forEach(c => h += '<div class="note d" style="margin-bottom:8px">⚠️ ' +
        cropEmoji(c.a.crop_id) + ' <b>' + esc(cropName(c.a.crop_id)) + '</b> ' + c.dist + '" from ' +
        cropEmoji(c.b.crop_id) + ' <b>' + esc(cropName(c.b.crop_id)) + '</b><br>' + esc(c.why) + '</div>');
      h += '</div>';
    }

    /* ---- growing here ---- */
    h += '<div class="sec"><h2>Growing here</h2><span class="tiny muted">' + ps.length +
      ' plant' + (ps.length === 1 ? "" : "s") + '</span></div>';
    if(!ps.length) h += '<div class="card center muted sm">Bare soil. Tap the bed to plant something.</div>';
    else {
      const byCrop = {};
      ps.forEach(p => { (byCrop[p.crop_id] = byCrop[p.crop_id] || []).push(p); });
      h += '<div class="card pad0"><div class="list">';
      Object.keys(byCrop).forEach(id => {
        const arr = byCrop[id], c = crop(id);
        const qty = arr.reduce((a, p) => a + num(p.qty, 1), 0);
        const g = PlantArt.growth(arr[0], when);
        const st = PlantArt.stage(g);
        const sunOk = !c || Micro.sunHours(bed.id) >= c.sun;
        h += '<button class="item" onclick="Library.open(\'' + id + '\')"><div class="av">' + cropEmoji(id) + '</div>' +
          '<div class="grow"><div class="b">' + esc(cropName(id)) + ' <span class="muted tiny">×' + qty + '</span></div>' +
          '<div class="tiny muted">' + esc({ unsown:"not sown by this date", seedling:"just up", young:"young",
            growing:"filling out", mature:"cropping", over:"past its best" }[st] || st) +
          ' · ' + Math.round(Geom.RC(arr[0]) * 2) + '" across when mature</div>' +
          (!sunOk ? '<div class="tiny" style="color:var(--warn)">Wants ' + c.sun + 'h sun, this bed gets ' +
            Micro.sunHours(bed.id) + 'h</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    /* ---- care ---- */
    const wtr = Recommend.water(bed.id, APP.weather);
    if(wtr){
      h += '<div class="sec"><h2>Care</h2></div><div class="card">';
      h += '<div class="row between"><div><div class="b">' +
        (wtr.verdict === "skip" ? "💧 Skip watering" : wtr.verdict === "light" ? '💧 Light top-up' : '💧 Water this week') + '</div>' +
        '<div class="tiny muted">Needs ' + wtr.need + '"/wk · ' + wtr.rain + '" rain · ' + wtr.logged + '" logged</div></div>' +
        '<button class="btn sm" onclick="Journal.quick(\'water\',\'' + bed.id + '\')">Log</button></div>';
      const heavy = ps.map(p => crop(p.crop_id)).filter(c => c && c.feeder === "heavy");
      if(heavy.length) h += '<div class="note w" style="margin-top:10px">🌿 Heavy feeders here (' +
        esc(heavy.map(c => c.n).filter((v,i,a) => a.indexOf(v) === i).join(", ")) +
        '). Side-dress with compost or a balanced organic feed every 3–4 weeks.</div>';
      h += '</div>';
    }

    /* ---- rotation ---- */
    const fams = Recommend.recentFamilies(bed.id);
    if(Object.keys(fams).length){
      h += '<div class="sec"><h2>Rotation history</h2></div><div class="card"><div class="row wrap" style="gap:6px">';
      Object.keys(fams).forEach(f => h += '<span class="chip"><span class="swatch" style="background:' +
        FAMILY[f].c + '"></span>' + esc(FAMILY[f].n) + ' · ' + esc(fams[f]) + '</span>');
      h += '</div><div class="tiny muted" style="margin-top:8px">Aim for a 3-year gap before the same family returns to a bed.</div></div>';
    }

    box.innerHTML = h;
    CanvasDrag.bind();
  },

  tlNote(bed, when){
    const ps = Geom.live(bed.id);
    if(!ps.length) return "nothing planted";
    if(num(Garden.tl) === 0) return ps.length + " plants, as they are now";
    const gs = ps.map(p => PlantArt.growth(p, when));
    const up = gs.filter(g => g >= 0).length;
    const done = gs.filter(g => g >= 1).length;
    return up + " up" + (done ? ", " + done + " cropping" : "") +
      (up < ps.length ? ", " + (ps.length - up) + " not sown yet" : "");
  },

  /* redraw only the canvas — a scrubber has to feel immediate */
  scrub(v){
    Garden.tl = clamp(Math.round(num(v, 0)), -6, 34);
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const when = Canvas.date();
    const host = $("#cvhost");
    if(host){ host.innerHTML = Canvas.svg(bed, { interactive:true, when: when }); CanvasDrag.bind(); }
    const d = $("#tl-date"); if(d) d.textContent = num(Garden.tl) === 0 ? "Today" : fmtY(when);
    const n = $("#tl-note"); if(n) n.textContent = Garden.tlNote(bed, when);
    const r = $("#tl-range"); if(r && num(r.value) !== Garden.tl) r.value = Garden.tl;
  },

  toggleGrid(){
    const bed = DB.find("beds", APP.bedId); if(!bed) return;
    const on = num(bed.grid_on) ? 0 : 1;
    DB.update("beds", bed.id, { grid_on: on, snap_in: on ? num(bed.cell_in, 12) : 0 });
    Garden.render();
    toast(on ? "Grid on — new plants snap to the squares" : "Grid off — plant anywhere");
  },
  toggleLabels(){
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    Canvas.labels = !Canvas.wantLabels(bed);
    Garden.render();
  },

  back(){ APP.bedId = null; Garden.sel = null; Garden.tl = 0; Garden.render(); }
});

/* ============================================================
   THE PLANTING SHEET — spacing in inches, and two ways to resize
   ============================================================ */
Garden.plantingSheet = function(p){
  if(!p) return;
  p = Geom.plant(p);
  const c = crop(p.crop_id), bed = Geom.bed(DB.find("beds", p.bed_id));
  if(!bed) return;
  const rr = Geom.RR(p), rc = Geom.RC(p);
  const single = p.span_mode === "single";
  const seeds = DB.where("seeds", s => s.crop_id === p.crop_id);
  const holds = Geom.fitsIn(p.crop_id, rr);
  const sn = Garden.seedsNeeded(p.crop_id, num(p.qty, 1), p.seed_id);
  const obs = Garden.observedSpread(p.crop_id);
  const when = Canvas.date();
  const g = PlantArt.growth(p, when);

  let h = '<div class="row" style="gap:12px;margin-bottom:12px"><div style="font-size:2.4rem">' + cropEmoji(p.crop_id) + '</div>' +
    '<div class="grow"><div class="b" style="font-size:1.1rem">' + esc(cropName(p.crop_id)) + '</div>' +
    '<div class="tiny muted">' + Math.round(Geom.PX(p)) + '", ' + Math.round(Geom.PY(p)) + '" into ' + esc(bed.name) +
    ' · ' + esc(PlantArt.stage(g)) + ' on ' + fmt(when) + '</div></div></div>';

  /* ---- footprint ---- */
  h += '<div class="card"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Footprint</div>';
  h += '<div class="field"><label class="f">Root zone — keep this clear · <b id="rr-v">' + rr + '"</b> radius</label>' +
    '<input type="range" id="pl-rr" min="1" max="' + Math.max(24, Math.ceil(rc)) + '" step="0.5" value="' + rr +
    '" oninput="Garden.liveRadius(\'' + p.id + '\',null,this.value)"></div>';
  h += '<div class="field" style="margin-top:8px"><label class="f">Mature canopy · <b id="rc-v">' + rc + '"</b> radius, ' +
    Math.round(rc*2) + '" across</label>' +
    '<input type="range" id="pl-rc" min="1.5" max="' + Math.max(36, Math.ceil(rc * 1.6)) + '" step="0.5" value="' + rc +
    '" oninput="Garden.liveRadius(\'' + p.id + '\',this.value,null)"></div>';
  h += '<div class="row between" style="margin-top:10px;gap:14px">' +
    '<div><div class="tiny muted">Nudge</div><div class="stepper">' +
      '<button onclick="Garden.resizeBy(\'' + p.id + '\',-1,0)">−</button><span class="v">' + Math.round(rc*2) + '"</span>' +
      '<button onclick="Garden.resizeBy(\'' + p.id + '\',1,0)">＋</button></div></div>' +
    '<div class="grow" style="text-align:right"><div class="tiny muted">' +
      (Math.round(Math.PI * rc * rc / 144 * 10) / 10) + ' sq ft of canopy</div>' +
      '<div class="tiny muted">' + (c ? c.sp + '" recommended spacing' : '') + '</div></div></div>';
  h += '<div class="tiny muted" style="margin-top:8px">You can also drag the white handle on the selected plant to resize it right on the bed.</div></div>';

  /* ---- one plant or a clump ---- */
  h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">What is planted here</div>' +
    '<div class="seg">' +
    '<button class="' + (single ? "on" : "") + '" onclick="Garden.setMode(\'' + p.id + '\',\'single\')">One plant</button>' +
    '<button class="' + (!single ? "on" : "") + '" onclick="Garden.setMode(\'' + p.id + '\',\'fill\')">A clump</button>' +
    '</div>';
  h += single
    ? '<div class="note i" style="margin-top:10px">A single ' + esc(cropName(p.crop_id)) + ' spreading ' +
      Math.round(rc*2) + '" across. Record what it really did and the app offers that much room next season.</div>'
    : '<div class="note g" style="margin-top:10px">At ' + esc(c ? c.sp + '"' : 'normal') + ' spacing, a ' +
      Math.round(rr*2) + '" patch holds about <b>' + holds + ' plant' + (holds === 1 ? "" : "s") + '</b>.</div>';
  h += '<div class="field" style="margin-top:12px"><label class="f">Plants here</label>' +
    '<input type="number" id="pl-qty" min="1" value="' + esc(p.qty || 1) + '"></div>';

  const vv = p.variety ? Varieties.find(p.crop_id, p.variety) : null;
  h += '<div class="field"><label class="f">Variety</label>' +
    '<button class="item" style="border:1px solid var(--line);border-radius:12px;width:100%" onclick="Garden.pickVariety(\'' + p.id + '\')">' +
      '<div class="av">' + (p.variety ? "🏷️" : "＋") + '</div>' +
      '<div class="grow"><div class="b">' + (p.variety ? esc(p.variety) : "Choose a variety") + '</div>' +
      '<div class="tiny muted">' + (vv ? ((vv.dtm ? vv.dtm + " days · " : "") + esc(vv.habit || "")) :
        (p.variety ? "Tap to change" : "Pick from the list, or look one up")) + '</div></div>' +
      '<span class="go">›</span></button>' +
    '<input type="hidden" id="pl-var" value="' + esc(p.variety || "") + '"></div>';
  h += '</div>';

  /* ---- seeds ---- */
  h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Seeds to sow</div>' +
    '<div class="row between"><div><div class="b" style="font-size:1.3rem">' + sn.seeds + ' seeds</div>' +
    '<div class="tiny muted">for ' + num(p.qty, 1) + ' plant' + (num(p.qty,1) === 1 ? "" : "s") +
    ' at ~' + sn.pct + '% germination, plus a little spare</div></div><div style="font-size:1.8rem">🌰</div></div>';
  if(seeds.length) h += '<div class="field" style="margin-top:10px"><label class="f">From packet</label><select id="pl-seed"><option value="">— none —</option>' +
    seeds.map(s => '<option value="' + s.id + '"' + (p.seed_id === s.id ? " selected" : "") + '>' +
      esc(s.name + (s.variety ? " · " + s.variety : "")) + '</option>').join("") + '</select></div>';
  else h += '<input type="hidden" id="pl-seed" value="">';
  h += '</div>';

  if(obs && obs.n) h += '<div class="note w" style="margin-top:12px">📐 <b>From your own garden.</b> You recorded ' +
    esc(cropName(p.crop_id)) + ' spreading about ' + obs.across + '" across (' + obs.sqft + ' sq ft)' +
    (obs.when ? ', ' + fmtY(obs.when) : '') + '. Worth allowing that much room again.</div>';

  /* ---- neighbours, by distance ---- */
  const others = Geom.live(bed.id).filter(x => x.id !== p.id);
  const near = others.map(o => ({ o: o, rel: Geom.relation(p, o), r: pairRating(p.crop_id, o.crop_id) }))
    .filter(x => x.rel.near)
    .sort((a, b) => a.rel.d - b.rel.d);
  if(near.length){
    h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Neighbours</div>';
    near.slice(0, 6).forEach(x => {
      const k = x.r.score >= 1 ? "g" : x.r.score <= -2 ? "d" : "i";
      const icon = x.r.score >= 1 ? "💚" : x.r.score <= -2 ? "⚠️" : "·";
      h += '<div class="note ' + k + '" style="margin-bottom:6px">' + icon + ' ' + cropEmoji(x.o.crop_id) +
        ' <b>' + esc(cropName(x.o.crop_id)) + '</b> — ' + x.rel.d + '" away' +
        (x.rel.rootsClash ? ', roots overlapping' : x.rel.canopyTouch ? ', leaves will meet' : '') +
        (x.r.score !== 0 ? '<br>' + esc(x.r.why) : '') + '</div>';
    });
    h += '</div>';
  }

  /* ---- status, dates, maturity ---- */
  h += '<div class="grid2" style="margin-top:12px">' +
    '<div><label class="f">Status</label><select id="pl-status">' +
      ["planned","seeded","growing","harvesting","done"].map(s => '<option value="' + s + '"' + (p.status === s ? " selected" : "") + '>' + s + '</option>').join("") +
    '</select></div>' +
    '<div><label class="f">Sown / planted</label><input type="date" id="pl-sown" value="' + esc(p.sown_on || "") + '"></div></div>';
  h += '<div class="field"><label class="f">Notes</label><textarea id="pl-notes" placeholder="How big it actually got, flavour, what you would change">' + esc(p.notes || "") + '</textarea></div>';

  if(c){
    const mx = Maturity.expected(p.crop_id, p.variety);
    const rec = DB.where("maturity", m => m.planting_id === p.id)[0];
    const harv = p.sown_on ? Season.harvestFrom(p.crop_id, p.sown_on, "seed", p.variety) : null;
    h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Days to maturity</div>';
    if(mx) h += '<div class="b" style="font-size:1.2rem">' + mx.lo + '–' + mx.hi + ' days</div>';
    if(harv) h += '<div class="note i" style="margin-top:8px">🗓️ First harvest around <b>' + fmtY(harv) + '</b>' +
      (Season.firstFrost() && harv > Season.firstFrost() ? '. That lands after your first frost.' : '.') + '</div>';
    h += '<button class="btn ' + (rec ? "ghost" : "") + ' block" style="margin-top:10px" onclick="Maturity.sheet(\'' + p.id + '\')">' +
      (rec ? '📈 First harvest recorded — ' + rec.days + ' days' : '📈 Record the first harvest') + '</button></div>';
  }

  h += '<div class="grid2" style="margin-top:16px">' +
    '<button class="btn ghost" onclick="Garden.duplicate(\'' + p.id + '\')">⧉ Duplicate</button>' +
    '<button class="btn ghost" onclick="Garden.copyPlanting(\'' + p.id + '\')">📋 Copy to place</button></div>';
  h += '<div class="row" style="gap:8px;margin-top:8px">' +
    '<button class="btn ghost" onclick="Garden.removePlanting(\'' + p.id + '\')">Remove</button>' +
    '<button class="btn grow" onclick="Garden.savePlanting(\'' + p.id + '\')">Save</button></div>';
  h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Library.open(\'' + p.crop_id + '\')},250)">Full growing guide →</button>';
  h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Journal.quick(\'harvest\',\'' + bed.id + '\',\'' + p.id + '\')},250)">🧺 Log a harvest from this plant</button>';

  openSheet("Planting", h);
};

/* sliders redraw the bed live rather than on release */
Garden.liveRadius = function(id, rc, rr){
  const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
  Garden.setRadius(id, rc === null || rc === undefined ? Geom.RC(p) : num(rc),
                       rr === null || rr === undefined ? Geom.RR(p) : num(rr));
  const q = DB.find("plantings", id);
  const a = $("#rr-v"); if(a) a.textContent = Geom.RR(q) + '"';
  const b = $("#rc-v"); if(b) b.textContent = Geom.RC(q) + '"';
  const rrEl = $("#pl-rr"); if(rrEl) rrEl.value = Geom.RR(q);
  Garden.repaint();
};
/* repaint the canvas in place, without rebuilding the whole screen */
Garden.repaint = function(){
  const bed = APP.bedId && DB.find("beds", APP.bedId); if(!bed) return;
  const host = $("#cvhost"); if(!host) return;
  host.innerHTML = Canvas.svg(Geom.bed(bed), { interactive:true, when: Canvas.date() });
  CanvasDrag.bind();
};

Garden.savePlanting = function(id){
  const p = DB.find("plantings", id); if(!p) return;
  const qty = $("#pl-qty") ? Math.max(1, num($("#pl-qty").value, 1)) : num(p.qty, 1);
  DB.update("plantings", id, {
    variety: $("#pl-var") ? $("#pl-var").value.trim() : p.variety,
    qty: qty,
    status: $("#pl-status") ? $("#pl-status").value : p.status,
    sown_on: $("#pl-sown") ? $("#pl-sown").value : p.sown_on,
    seed_id: ($("#pl-seed") && $("#pl-seed").value) || null,
    notes: $("#pl-notes") ? $("#pl-notes").value.trim() : p.notes
  });
  Cal.forPlanting(DB.find("plantings", id));
  closeSheet(); Garden.render(); toast("Saved");
};

Garden.suggest = function(){
  const bed = Geom.bed(DB.find("beds", APP.bedId));
  const recs = Recommend.now({ bedId: bed.id }).slice(0, 12);
  let h = '<p class="muted sm" style="margin-top:0">Ranked for <b>' + esc(bed.name) + '</b> — ' +
    Micro.sunHours(bed.id) + 'h of sun, ' + Geom.areaSqFt(bed) + ' sq ft, what is already growing there, ' +
    'what grew there before, and what is in your seed bank.</p>';
  if(!recs.length) h += '<div class="note i">No sowing windows are open right now.</div>';
  recs.forEach(r => {
    h += '<div class="card" style="margin-bottom:10px"><div class="row" style="gap:10px">' +
      '<div style="font-size:1.8rem">' + r.crop.e + '</div><div class="grow">' +
      '<div class="b">' + esc(r.crop.n) + '</div><div class="tiny muted">' + esc(FAMILY[r.crop.fam].n) +
      ' · ' + r.crop.dtm + ' days · needs ' + r.crop.sp + '" of room</div></div>' +
      '<button class="btn sm" onclick="Garden.paint=\'' + r.crop.id + '\';closeSheet();Garden.render();toast(\'Tap the bed to plant\')">Plant</button></div>';
    r.why.slice(0, 3).forEach(x => h += '<div class="tiny" style="margin-top:5px">' + esc(x) + '</div>');
    r.warn.slice(0, 2).forEach(x => h += '<div class="tiny" style="margin-top:5px;color:var(--warn)">' + esc(x) + '</div>');
    h += '</div>';
  });
  openSheet("Suggestions for this bed", h);
};
</script>
