<script>
/* ============================================================
   POTS, PLANTERS AND VASES

   Not every garden is a rectangle of soil. A row of half-barrels
   along a fence, six terracotta pots on a step, three window
   boxes — each is a separate pocket of soil, and each behaves
   like a very small bed: a plant in one cannot root into the
   next, and the gap between them is not growing space.

   The old model could describe this only as fifteen beds called
   "Pot 1".."Pot 15", which is a filing system rather than a
   garden, and it made the map unreadable.

   So a bed may be a GROUP: one bed, one name, one micro-climate,
   one place on the map — made of containers you add one at a
   time and size individually, because a real collection is a
   couple of big vases and a row of small ones, not a tidy grid.

   Three rules hold it together:

   · `Geom.parts` is the whole model. An ordinary bed is a
     one-element array, so there is one code path and not two.
   · A plant cannot straddle two containers. `Geom.inside` asks
     each part separately, and a plant dropped in a gap is pulled
     into the nearest pot rather than left rooted in mid-air.
   · A pot holds ONE plant. That is what a pot is. Placing into a
     group finds an empty container first, and tapping an
     occupied one opens what is in it rather than crowding a
     second plant in beside it.
   ============================================================ */

const Groups = {

  DEFAULT: { s: "circle", w: 14, h: 14 },
  GAP: 5,

  /* the sizes people actually own, in inches across */
  SIZES: [
    { n:"Small pot",    w:8  },
    { n:"Medium pot",   w:12 },
    { n:"Large pot",    w:16 },
    { n:"Patio pot",    w:20 },
    { n:"Half barrel",  w:26 },
    { n:"Big vase",     w:32 }
  ],

  /* ------------------------------------------------------------
     Lay a list of containers out left to right, wrapping into
     rows. The gardener says what she owns; the app arranges it,
     and she can change the row width.
     ------------------------------------------------------------ */
  reflow(items, perRow, gap){
    const g = clamp(num(gap, Groups.GAP), 0, 60);
    const per = clamp(Math.round(num(perRow, 4)), 1, 20);
    const pad = 3;
    const parts = [];
    let x = pad, y = pad, rowH = 0, inRow = 0, maxX = 0;
    (items || []).forEach(it => {
      const w = clamp(num(it.w, 14), 2, 120), h = clamp(num(it.h, it.w || 14), 2, 120);
      if(inRow >= per){ x = pad; y += rowH + g; rowH = 0; inRow = 0; }
      parts.push({ s: it.s || "circle", x: Math.round(x), y: Math.round(y), w: w, h: h });
      x += w + g; inRow++;
      rowH = Math.max(rowH, h);
      maxX = Math.max(maxX, x - g);
    });
    return {
      parts: parts,
      w_in: Math.max(12, Math.round(maxX + pad)),
      h_in: Math.max(12, Math.round(y + rowH + pad)),
      count: parts.length
    };
  },

  /* growing space is the containers, not the bench they stand on */
  areaOf(parts){
    return (parts || []).reduce((a, p) => {
      const w = num(p.w, 0), h = num(p.h, 0);
      return a + ((p.s === "circle" || p.s === "ellipse") ? Math.PI * (w/2) * (h/2) : w * h);
    }, 0) / 144;
  },

  /* how many containers are still empty */
  freeCount(bedId){
    const bed = Geom.bed(DB.find("beds", bedId));
    if(!bed || !Geom.isGroup(bed)) return null;
    const parts = Geom.parts(bed);
    const live = Geom.live(bedId);
    return parts.filter(P => !live.some(p => Geom.inPoly(P, Geom.PX(p), Geom.PY(p)))).length;
  },

  /* a whole row or grid of identical containers, described once. The editor
     works in individual items; this is the shorthand for "six of these". */
  expand(spec){
    const cols = clamp(Math.round(num(spec.cols, 4)), 1, 20);
    const rows = clamp(Math.round(num(spec.rows, 1)), 1, 20);
    const w = clamp(num(spec.w, 14), 2, 120);
    const h = clamp(num(spec.h, spec.w || 14), 2, 120);
    const items = [];
    for(let i = 0; i < cols * rows; i++) items.push({ s: spec.s || "circle", w: w, h: h });
    return items;
  },

  apply(bedId, items, perRow, gap){
    /* accept either a list of containers or the "n of these" shorthand */
    if(items && !Array.isArray(items)){
      const spec = items;
      perRow = perRow === undefined ? num(spec.cols, 4) : perRow;
      gap = gap === undefined ? num(spec.gap, Groups.GAP) : gap;
      items = Groups.expand(spec);
    }
    const L = Groups.reflow(items, perRow, gap);
    if(!L.parts.length) return { count: 0, moved: 0 };
    Geom.saveParts(bedId, L.parts, L.w_in, L.h_in);
    DB.update("beds", bedId, {
      cols: clamp(Math.round(num(perRow, 4)), 1, 20),
      rows: Math.max(1, Math.ceil(L.count / clamp(Math.round(num(perRow, 4)), 1, 20))),
      grid_on: 0, snap_in: 0
    });
    /* anything now standing in a gap is pulled into the nearest container */
    let moved = 0;
    const bed = Geom.bed(DB.find("beds", bedId));
    Geom.live(bedId).forEach(p => {
      const fit = Geom.clampInto(bed, Geom.PX(p), Geom.PY(p), Math.min(Geom.RR(p), 2));
      if(fit.clamped || fit.tight){
        DB.update("plantings", p.id, { px: Math.round(fit.x*10)/10, py: Math.round(fit.y*10)/10 });
        moved++;
      }
    });
    return { count: L.count, moved: moved };
  },

  /* ============================================================
     THE EDITOR — a list of containers, added one at a time
     ============================================================ */
  draft: null,

  open(bedId){
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId)); if(!bed) return;
    const cur = Geom.partList(bed);
    Groups.draft = {
      bedId: bed.id,
      items: cur && cur.length
        ? cur.map(p => ({ s: p.s || "circle", w: num(p.w, 14), h: num(p.h, 14) }))
        : [Object.assign({}, Groups.DEFAULT), Object.assign({}, Groups.DEFAULT),
           Object.assign({}, Groups.DEFAULT), Object.assign({}, Groups.DEFAULT)],
      perRow: cur && cur.length ? clamp(num(bed.cols, 4), 1, 20) : 4,
      gap: Groups.gapOf(cur),
      sel: 0
    };
    Groups.sheet();
  },
  gapOf(parts){
    if(!parts || parts.length < 2) return Groups.GAP;
    const g = num(parts[1].x, 0) - (num(parts[0].x, 0) + num(parts[0].w, 0));
    return g > 0 && g < 60 ? Math.round(g) : Groups.GAP;
  },

  sheet(){
    const d = Groups.draft; if(!d) return;
    const sel = d.items[d.sel] || d.items[0] || null;
    const L = Groups.reflow(d.items, d.perRow, d.gap);

    let h = '<p class="muted sm" style="margin-top:0">Add the containers you actually have and size each one. ' +
      'They keep their own soil — a plant in one cannot root into the next — and <b>each holds one plant</b>, which is what a pot is.</p>';

    h += '<div class="canvaswrap" id="gp-prev" style="margin-top:12px;padding:6px">' + Groups.preview() + '</div>';
    h += '<div class="tiny muted center" id="gp-note" style="margin-top:6px">' + Groups.note() + '</div>';
    h += '<div class="tiny muted center" style="margin-top:2px">Tap a container above to select it.</div>';

    /* ---- add ---- */
    h += '<div class="sec"><h2>Add a container</h2></div>';
    h += '<div class="row wrap" style="gap:6px">' +
      Groups.SIZES.map(s => '<button class="chip" onclick="Groups.add(' + s.w + ')">＋ ' +
        esc(s.n) + ' <span class="tiny muted">' + Units.len(s.w) + '</span></button>').join("") + '</div>';
    h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="Groups.addLike()">＋ Another the same as the selected one</button>';

    /* ---- the selected container ---- */
    if(sel){
      h += '<div class="sec"><h2>Container ' + (d.sel + 1) + ' of ' + d.items.length + '</h2>' +
        '<span class="tiny muted">' + Units.len(sel.w) + (sel.s === "circle" ? " across" : " × " + Units.len(sel.h)) + '</span></div>';
      h += '<div class="card">';
      h += '<div class="row wrap" style="gap:6px">' +
        [["circle","◯ Round"],["rect","▢ Square"]].map(x =>
          '<button class="chip ' + (sel.s === x[0] ? "on" : "") + '" onclick="Groups.setShape(\'' + x[0] + '\')">' +
          esc(x[1]) + '</button>').join("") + '</div>';

      h += '<div class="field" style="margin-top:12px"><label class="f">Across · <b id="gp-wv">' + Units.len(sel.w) + '</b></label>' +
        '<input type="range" id="gp-w" min="' + Units.outLen(4) + '" max="' + Units.outLen(48) +
        '" step="' + Units.radiusStep() + '" value="' + Units.outLen(sel.w) + '" oninput="Groups.slide()"></div>';
      if(sel.s !== "circle")
        h += '<div class="field" style="margin-top:8px"><label class="f">Front to back · <b id="gp-hv">' + Units.len(sel.h) + '</b></label>' +
          '<input type="range" id="gp-h" min="' + Units.outLen(4) + '" max="' + Units.outLen(48) +
          '" step="' + Units.radiusStep() + '" value="' + Units.outLen(sel.h) + '" oninput="Groups.slide()"></div>';

      h += '<div class="row" style="gap:8px;margin-top:12px">' +
        '<button class="btn ghost grow sm" onclick="Groups.dupe()">Duplicate</button>' +
        '<button class="btn ghost grow sm" onclick="Groups.allLike()">Make them all this size</button>' +
        '<button class="btn ghost sm" onclick="Groups.drop()">Remove</button></div>';
      h += '</div>';
    }

    /* ---- arrangement ---- */
    h += '<div class="sec"><h2>How they stand</h2></div>';
    h += '<div class="row between" style="gap:14px">' +
      '<div><div class="l tiny b muted" style="text-transform:uppercase">Per row</div><div class="stepper">' +
        '<button onclick="Groups.bump(-1)">−</button><span class="v" id="gp-per">' + d.perRow + '</span>' +
        '<button onclick="Groups.bump(1)">＋</button></div></div>' +
      '<div class="grow"><label class="f">Gap between (' + Units.lenUnit() + ')</label>' +
        '<input type="number" id="gp-gap" step="' + Units.lenStep() + '" min="0" max="' + Units.outLen(60) +
        '" value="' + Units.outLen(d.gap) + '" oninput="Groups.read()"></div></div>';

    h += '<button class="btn block" style="margin-top:16px" onclick="Groups.save()">' +
      (Geom.isGroup(DB.find("beds", d.bedId)) ? "Save these containers" : "Use these containers") + '</button>';
    if(Geom.isGroup(DB.find("beds", d.bedId)))
      h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="Groups.unGroup()">Make it one solid bed instead</button>';

    openSheet("Pots and planters", h);
  },

  preview(){
    const d = Groups.draft; if(!d) return "";
    const L = Groups.reflow(d.items, d.perRow, d.gap);
    if(!L.parts.length) return '<div class="empty sm">No containers yet — add one below.</div>';
    const pad = 4, W = L.w_in, H = L.h_in;
    const sw = Math.max(0.7, W / 200);
    let s = '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + pad*2) + ' ' + (H + pad*2) +
      '" style="width:100%;height:auto;max-height:210px;display:block">';
    L.parts.forEach((p, i) => {
      const on = i === d.sel;
      const fill = on ? "#a37f5f" : "#8a6a4f", stroke = on ? "var(--green-600)" : "#5d4634";
      const attrs = 'fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (on ? sw * 2.2 : sw) + '"';
      if(p.s === "circle")
        s += '<ellipse cx="' + (p.x + p.w/2) + '" cy="' + (p.y + p.h/2) + '" rx="' + (p.w/2) + '" ry="' + (p.h/2) +
          '" ' + attrs + ' data-i="' + i + '" style="cursor:pointer"/>';
      else
        s += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + (Math.min(p.w,p.h)*0.1) +
          '" ' + attrs + ' data-i="' + i + '" style="cursor:pointer"/>';
      s += '<text x="' + (p.x + p.w/2) + '" y="' + (p.y + p.h/2 + Math.min(p.w,p.h)*0.13) +
        '" text-anchor="middle" font-size="' + Math.max(4, Math.min(p.w, p.h) * 0.38) +
        '" fill="#fff" opacity="' + (on ? ".95" : ".6") + '" style="pointer-events:none">' + (i + 1) + '</text>';
    });
    return s + '</svg>';
  },
  note(){
    const d = Groups.draft; if(!d) return "";
    const L = Groups.reflow(d.items, d.perRow, d.gap);
    if(!L.count) return "";
    return L.count + ' container' + (L.count === 1 ? "" : "s") + ' · ' +
      Units.area(Groups.areaOf(L.parts)) + ' of soil · takes up ' + Units.dims(L.w_in, L.h_in);
  },
  repaint(){
    const p = $("#gp-prev"); if(p){ p.innerHTML = Groups.preview(); Groups.bindPreview(); }
    const n = $("#gp-note"); if(n) n.innerHTML = Groups.note();
  },
  bindPreview(){
    $$("#gp-prev [data-i]").forEach(el => el.onclick = () => {
      Groups.draft.sel = num(el.dataset.i, 0);
      Groups.sheet();
    });
  },

  /* ---- editing ---- */
  add(w){
    const d = Groups.draft;
    d.items.push({ s: Groups.DEFAULT.s, w: num(w, 14), h: num(w, 14) });
    d.sel = d.items.length - 1;
    Groups.sheet();
  },
  addLike(){
    const d = Groups.draft;
    const src = d.items[d.sel] || Groups.DEFAULT;
    d.items.push({ s: src.s, w: src.w, h: src.h });
    d.sel = d.items.length - 1;
    Groups.sheet();
  },
  dupe(){ Groups.addLike(); },
  drop(){
    const d = Groups.draft;
    if(d.items.length <= 1) return toast("A group needs at least one container");
    d.items.splice(d.sel, 1);
    d.sel = clamp(d.sel, 0, d.items.length - 1);
    Groups.sheet();
  },
  setShape(s){
    const d = Groups.draft, it = d.items[d.sel]; if(!it) return;
    it.s = s;
    if(s === "circle") it.h = it.w;
    Groups.sheet();
  },
  allLike(){
    const d = Groups.draft, src = d.items[d.sel]; if(!src) return;
    d.items = d.items.map(() => ({ s: src.s, w: src.w, h: src.h }));
    Groups.sheet();
    toast("All " + d.items.length + " set to " + Units.len(src.w));
  },
  /* the sliders move the selected container live, without rebuilding the sheet */
  slide(){
    const d = Groups.draft, it = d.items[d.sel]; if(!it) return;
    it.w = clamp(Units.inLen(num(($("#gp-w") || {}).value, Units.outLen(it.w))), 4, 48);
    if(it.s === "circle") it.h = it.w;
    else it.h = clamp(Units.inLen(num(($("#gp-h") || {}).value, Units.outLen(it.h))), 4, 48);
    const wv = $("#gp-wv"); if(wv) wv.textContent = Units.len(it.w);
    const hv = $("#gp-hv"); if(hv) hv.textContent = Units.len(it.h);
    Groups.repaint();
  },
  read(){
    const d = Groups.draft;
    d.gap = clamp(Units.inLen(num(($("#gp-gap") || {}).value, Units.outLen(d.gap))), 0, 60);
    Groups.repaint();
  },
  bump(n){
    const d = Groups.draft;
    d.perRow = clamp(d.perRow + n, 1, 20);
    const el = $("#gp-per"); if(el) el.textContent = d.perRow;
    Groups.repaint();
  },

  save(){
    const d = Groups.draft; if(!d) return;
    const r = Groups.apply(d.bedId, d.items, d.perRow, d.gap);
    if(!r.count) return toast("Add at least one container");
    closeSheet(); Garden.render();
    toast(r.count + " container" + (r.count === 1 ? "" : "s") +
      (r.moved ? " · " + r.moved + " plant" + (r.moved === 1 ? "" : "s") + " moved into one" : ""));
  },

  unGroup(){
    const d = Groups.draft; if(!d) return;
    confirmSheet("One solid bed instead?",
      "It becomes a single rectangle the size of the whole arrangement. Nothing planted is removed, but plants that were in separate pots end up sharing one bed.",
      "Do it", () => {
        DB.update("beds", d.bedId, { parts: null, shape: "rect" });
        Garden.render(); toast("Back to one shape");
      });
  }
};

/* ============================================================
   ONE PLANT PER POT

   A 14-inch pot holds one tomato. The canvas already warns about
   overlapping root zones, but in a container that is not a
   warning, it is a rule — so placing into a group looks for an
   empty pot, and tapping an occupied one opens what is in it.
   ============================================================ */
(function onePerPot(){

  /* the index of the container a point falls in, or -1 */
  Geom.partIndexAt = function(bed, x, y){
    const ps = Geom.parts(bed);
    for(let i = 0; i < ps.length; i++) if(Geom.inPoly(ps[i], x, y)) return i;
    return -1;
  };
  /* is there already something growing in this container? */
  Geom.occupant = function(bed, idx, ignoreId){
    const ps = Geom.parts(bed);
    const P = ps[idx]; if(!P) return null;
    return Geom.live(Geom.bed(bed).id)
      .find(p => p.id !== ignoreId && Geom.inPoly(P, Geom.PX(p), Geom.PY(p))) || null;
  };

  /* placing into a group prefers a container that is free */
  const origSpot = Garden.openSpot;
  Garden.openSpot = function(bed, radius, nearX, nearY, ignoreId){
    bed = Geom.bed(bed);
    if(!Geom.isGroup(bed)) return origSpot.call(Garden, bed, radius, nearX, nearY, ignoreId);
    const ps = Geom.parts(bed);
    const nx = nearX === undefined ? Geom.W(bed)/2 : nearX;
    const ny = nearY === undefined ? Geom.H(bed)/2 : nearY;
    let best = null, bd = Infinity;
    ps.forEach((P, i) => {
      if(Geom.occupant(bed, i, ignoreId)) return;          /* that pot is taken */
      const c = Geom.polyCentroid(P); if(!c) return;
      const d = Math.hypot(c.x - nx, c.y - ny);
      if(d < bd){ bd = d; best = { x: c.x, y: c.y }; }
    });
    /* every pot full — fall back to the ordinary search so nothing is refused
       outright, and let the crowding warning speak for itself */
    return best || origSpot.call(Garden, bed, radius, nearX, nearY, ignoreId);
  };

  /* a plant dropped into a group is centred in its pot and sized to fit it */
  const origPlace = Garden.placeAt;
  Garden.placeAt = function(bed, px, py, cropId, opts){
    bed = Geom.bed(bed);
    if(!Geom.isGroup(bed)) return origPlace.call(Garden, bed, px, py, cropId, opts);
    const o = Object.assign({}, opts || {});
    let idx = Geom.partIndexAt(bed, px, py);
    if(idx < 0 || Geom.occupant(bed, idx)){
      const spot = Garden.openSpot(bed, 1, px, py);
      if(spot){ px = spot.x; py = spot.y; idx = Geom.partIndexAt(bed, px, py); }
    } else {
      const c = Geom.polyCentroid(Geom.parts(bed)[idx]);
      if(c){ px = c.x; py = c.y; }
    }
    /* a pot is one plant, and its roots may not exceed the pot */
    const P = Geom.parts(bed)[idx];
    if(P){
      let minR = Infinity;
      P.forEach(pt => { const d = Math.hypot(pt[0] - px, pt[1] - py); if(d < minR) minR = d; });
      if(isFinite(minR)){
        o.mode = "single";
        o.qty = 1;
        o.rr = Math.min(o.rr !== undefined ? num(o.rr) : Geom.rootR(cropId, 1), Math.max(2, minR));
      }
    }
    return origPlace.call(Garden, bed, px, py, cropId, o);
  };

  /* tapping a pot that already holds something opens that plant */
  const origTap = Garden.tapAt;
  Garden.tapAt = function(px, py){
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    if(bed && Geom.isGroup(bed) && !Garden.erase && !Garden.paint && !Garden.clip &&
       !(typeof Sel !== "undefined" && Sel.on)){
      const idx = Geom.partIndexAt(bed, px, py);
      const occ = idx >= 0 ? Geom.occupant(bed, idx) : null;
      if(occ){
        haptic();
        Garden.sel = occ.id; Garden.render(); Garden.plantingSheet(occ);
        return;
      }
      if(idx < 0){
        /* bare bench between the pots — say so rather than silently doing nothing */
        haptic();
        Garden.sel = null; Garden.render();
        return toast("That is the gap between containers — tap a pot");
      }
    }
    return origTap.call(Garden, px, py);
  };
})();

/* ---------- ways in ---------- */
(function wireGroups(){

  /* the shape sheet: choosing "Pots & planters" opens the container editor */
  const origPick = Shape.pick;
  Shape.pick = function(bedId, shape){
    if(shape === "group") return Groups.open(bedId);
    const bed = DB.find("beds", bedId);
    if(bed && bed.parts) DB.update("beds", bedId, { parts: null });
    return origPick.call(Shape, bedId, shape);
  };

  /* the width/depth sliders make no sense for a group — its size is decided
     by the containers in it */
  const origOpen = Shape.open;
  Shape.open = function(bedId){
    origOpen.call(Shape, bedId);
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId));
    if(!bed || !Geom.isGroup(bed)) return;
    const body = $("#sheet-body"); if(!body) return;
    const w = body.querySelector("#sh-w");
    const grid = w ? w.closest(".grid2") : null;
    const n = (Geom.partList(bed) || []).length;
    if(grid) grid.innerHTML = '<div class="note i" style="grid-column:1/-1;margin:0">' +
      'This bed is ' + n + ' separate container' + (n === 1 ? "" : "s") +
      '. Their sizes and spacing decide how big it is.</div>';
    body.insertAdjacentHTML("afterbegin",
      '<button class="btn block" style="margin-bottom:12px" onclick="Groups.open(\'' + bed.id + '\')">⁙ Edit the containers</button>');
  };

  /* from the bed menu */
  const origMenu = Garden.bedMenu;
  Garden.bedMenu = function(){
    origMenu.apply(Garden, arguments);
    const body = $("#sheet-body"); if(!body || !APP.bedId) return;
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    body.insertAdjacentHTML("beforeend",
      '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Groups.open(\'' +
      APP.bedId + '\')},250)">⁙ ' + (Geom.isGroup(bed) ? "Edit the pots and planters" : "Make this a group of pots or planters") + '</button>');
  };

  /* ------------------------------------------------------------
     CREATING ONE

     Choosing "Pots & planters" in the new-bed sheet used to write
     shape:"group" and no containers, so Geom.isGroup was false and
     the bed came out as the plain rectangle the fallback draws.
     That was the bug. Now the bed is created and the container
     editor opens straight away.
     ------------------------------------------------------------ */
  const origSave = Garden.saveNewBed;
  Garden.saveNewBed = function(){
    const sel = $("#sheet-body .shapegrid button.on");
    const isGroup = sel && sel.dataset.shape === "group";
    const before = DB.count("beds");
    origSave.call(Garden);
    if(!isGroup || DB.count("beds") === before) return;
    const bed = DB.all("beds")[DB.count("beds") - 1];
    /* something real to look at from the first frame, then let her change it */
    Groups.apply(bed.id, [
      Object.assign({}, Groups.DEFAULT), Object.assign({}, Groups.DEFAULT),
      Object.assign({}, Groups.DEFAULT), Object.assign({}, Groups.DEFAULT)
    ], 4, Groups.GAP);
    Garden.render();
    setTimeout(() => Groups.open(bed.id), 260);
  };

  /* the new-bed sheet should not ask for a width and depth it will ignore */
  const origNew = Garden.newBed;
  Garden.newBed = function(){
    origNew.call(Garden);
    const body = $("#sheet-body"); if(!body) return;
    const note = document.createElement("div");
    note.id = "nb-groupnote";
    note.className = "note i";
    note.style.cssText = "margin-top:12px;display:none";
    note.innerHTML = "You will pick the pots and their sizes next. The width and depth above are ignored for a group — the containers decide how big it is.";
    const btn = body.querySelector('button[onclick*="saveNewBed"]');
    if(btn && btn.parentNode) btn.parentNode.insertBefore(note, btn);
    $$("#sheet-body .shapegrid button").forEach(b => {
      const prev = b.onclick;
      b.onclick = () => {
        if(prev) prev();
        const on = $("#sheet-body .shapegrid button.on");
        const g = $("#nb-groupnote");
        if(g) g.style.display = (on && on.dataset.shape === "group") ? "" : "none";
      };
    });
  };

  /* the bed header should say what it is rather than calling a row of pots
     a rounded rectangle */
  const origBedView = Garden.bedView;
  Garden.bedView = function(){
    origBedView.call(Garden);
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    if(!bed || !Geom.isGroup(bed)) return;
    const box = $("#s-garden"); if(!box) return;
    const sub = box.querySelector(".row .tiny.muted");
    const n = (Geom.partList(bed) || []).length;
    const free = Groups.freeCount(bed.id);
    if(sub) sub.innerHTML = '⁙ ' + n + ' container' + (n === 1 ? "" : "s") +
      (free !== null ? ' · ' + free + ' empty' : '') + ' · ' +
      Units.area(Geom.areaSqFt(bed)) + ' of soil · ' + esc(bed.sun_hours || "?") + 'h sun';
  };
})();
</script>
