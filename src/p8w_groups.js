<script>
/* ============================================================
   POTS, PLANTERS AND WINDOW BOXES

   Not every garden is a rectangle of soil. A row of half-barrels
   along a fence, six terracotta pots on a step, three window
   boxes — each is a separate pocket of soil, and each behaves
   like a small bed: a plant in one of them cannot send roots into
   the next, and the gap between them is not growing space.

   The old model could describe this only as fifteen beds called
   "Pot 1".."Pot 15", which is a filing system rather than a
   garden, and it made the map unreadable.

   So a bed may be a GROUP: one bed, one name, one micro-climate,
   one place on the map — made of several containers. Geom.parts
   does the work; this file is the editor that produces the list
   and the arithmetic that lays it out in rows.

   Two things it deliberately does NOT do:

   · It does not let a plant straddle two containers. Geom.inside
     asks each part separately, so dropping a courgette between
     two pots pulls it into the nearer one rather than leaving it
     rooted in mid-air.
   · It does not count the gaps as growing space. Area is the sum
     of the containers, which is what decides how much will fit
     and what the yield-per-area figures divide by.
   ============================================================ */

const Groups = {

  /* what people actually own, with sensible real sizes in inches */
  PRESETS: [
    { id:"pot",     n:"Round pots",    e:"◯", s:"circle", w:14, h:14, gap:4,  cols:4, rows:1 },
    { id:"barrel",  n:"Half barrels",  e:"◯", s:"circle", w:26, h:26, gap:8,  cols:3, rows:1 },
    { id:"window",  n:"Window boxes",  e:"▭", s:"rect",   w:30, h:8,  gap:4,  cols:1, rows:3 },
    { id:"planter", n:"Planters",      e:"▢", s:"round",  w:24, h:12, gap:6,  cols:2, rows:2 },
    { id:"grow",    n:"Grow bags",     e:"▢", s:"round",  w:16, h:16, gap:5,  cols:3, rows:2 },
    { id:"square",  n:"Square pots",   e:"▭", s:"rect",   w:12, h:12, gap:3,  cols:4, rows:2 }
  ],

  /* ------------------------------------------------------------
     Lay a grid of identical containers out and return both the
     parts and the bounding box they need.
     ------------------------------------------------------------ */
  layout(o){
    const cols = clamp(Math.round(num(o.cols, 3)), 1, 20);
    const rows = clamp(Math.round(num(o.rows, 1)), 1, 20);
    const w = clamp(num(o.w, 14), 2, 120), h = clamp(num(o.h, 14), 2, 120);
    const gap = clamp(num(o.gap, 4), 0, 60);
    const s = o.s || "circle";
    const pad = 3;                        /* a little air so nothing touches the edge */
    const parts = [];
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      parts.push({ s: s, x: pad + c * (w + gap), y: pad + r * (h + gap), w: w, h: h });
    }
    return {
      parts: parts,
      w_in: pad * 2 + cols * w + (cols - 1) * gap,
      h_in: pad * 2 + rows * h + (rows - 1) * gap,
      count: cols * rows
    };
  },

  /* growing space, which is the containers and not the bench they stand on */
  areaOf(parts){
    return (parts || []).reduce((a, p) => {
      const w = num(p.w, 0), h = num(p.h, 0);
      return a + ((p.s === "circle" || p.s === "ellipse") ? Math.PI * w / 2 * h / 2 : w * h);
    }, 0) / 144;
  },

  apply(bedId, o){
    const L = Groups.layout(o);
    Geom.saveParts(bedId, L.parts, L.w_in, L.h_in);
    /* keep cols/rows honest for the map, the recap and the assistant, which
       still read them — but they describe the CONTAINERS now, not squares */
    DB.update("beds", bedId, {
      cols: clamp(Math.round(num(o.cols, 3)), 1, 20),
      rows: clamp(Math.round(num(o.rows, 1)), 1, 20),
      grid_on: 0, snap_in: 0
    });
    /* anything that now sits in a gap gets pulled into the nearest container */
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

  /* ------------------------------------------------------------
     THE EDITOR
     ------------------------------------------------------------ */
  draft: null,

  open(bedId){
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId)); if(!bed) return;
    const cur = Geom.partList(bed);
    const first = cur && cur[0];
    Groups.draft = {
      bedId: bed.id,
      s: (first && first.s) || "circle",
      w: first ? num(first.w, 14) : 14,
      h: first ? num(first.h, 14) : 14,
      gap: Groups.guessGap(cur),
      cols: cur ? clamp(num(bed.cols, 3), 1, 20) : 4,
      rows: cur ? clamp(num(bed.rows, 1), 1, 20) : 1
    };
    Groups.sheet();
  },
  guessGap(parts){
    if(!parts || parts.length < 2) return 4;
    const a = parts[0], b = parts[1];
    const g = num(b.x, 0) - (num(a.x, 0) + num(a.w, 0));
    return g > 0 ? Math.round(g) : 4;
  },

  sheet(){
    const d = Groups.draft; if(!d) return;
    let h = '<p class="muted sm" style="margin-top:0">One bed made of several containers. They keep their own soil — a plant in one cannot root into the next — and the growing space counted is the containers, not the bench they stand on.</p>';

    h += '<div class="sec"><h2>Start from</h2></div><div class="row wrap" style="gap:6px">' +
      Groups.PRESETS.map(p => '<button class="chip" onclick="Groups.preset(\'' + p.id + '\')">' +
        p.e + ' ' + esc(p.n) + '</button>').join("") + '</div>';

    h += '<div class="canvaswrap" id="gp-prev" style="margin-top:12px;padding:6px">' + Groups.preview() + '</div>';
    h += '<div class="tiny muted center" id="gp-note" style="margin-top:6px">' + Groups.note() + '</div>';

    h += '<div class="sec"><h2>Each container</h2></div>';
    h += '<div class="row wrap" style="gap:6px">' +
      [["circle","◯ Round"],["rect","▭ Square or oblong"],["round","▢ Soft corners"]].map(x =>
        '<button class="chip ' + (d.s === x[0] ? "on" : "") + '" onclick="Groups.set(\'s\',\'' + x[0] + '\')">' +
        esc(x[1]) + '</button>').join("") + '</div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Across (' + Units.lenUnit() + ')</label>' +
        '<input type="number" id="gp-w" step="' + Units.lenStep() + '" min="' + Units.outLen(2) + '" max="' + Units.outLen(120) +
        '" value="' + Units.outLen(d.w) + '" oninput="Groups.read()"></div>' +
      '<div><label class="f">Front to back (' + Units.lenUnit() + ')</label>' +
        '<input type="number" id="gp-h" step="' + Units.lenStep() + '" min="' + Units.outLen(2) + '" max="' + Units.outLen(120) +
        '" value="' + Units.outLen(d.h) + '" oninput="Groups.read()"></div></div>';

    h += '<div class="sec"><h2>How they are arranged</h2></div>';
    h += '<div class="row between" style="gap:14px">' +
      '<div><div class="l tiny b muted" style="text-transform:uppercase">In a row</div><div class="stepper">' +
        '<button onclick="Groups.bump(\'cols\',-1)">−</button><span class="v">' + d.cols + '</span>' +
        '<button onclick="Groups.bump(\'cols\',1)">＋</button></div></div>' +
      '<div><div class="l tiny b muted" style="text-transform:uppercase">Rows</div><div class="stepper">' +
        '<button onclick="Groups.bump(\'rows\',-1)">−</button><span class="v">' + d.rows + '</span>' +
        '<button onclick="Groups.bump(\'rows\',1)">＋</button></div></div>' +
      '<div class="grow" style="text-align:right"><div class="tiny muted" id="gp-count">' +
        (d.cols * d.rows) + ' containers</div></div></div>';

    h += '<div class="field" style="margin-top:14px"><label class="f">Gap between them (' + Units.lenUnit() + ')</label>' +
      '<input type="number" id="gp-gap" step="' + Units.lenStep() + '" min="0" max="' + Units.outLen(60) +
      '" value="' + Units.outLen(d.gap) + '" oninput="Groups.read()"></div>';

    h += '<button class="btn block" style="margin-top:16px" onclick="Groups.save()">' +
      (Geom.isGroup(DB.find("beds", d.bedId)) ? "Save this arrangement" : "Turn this bed into a group") + '</button>';
    if(Geom.isGroup(DB.find("beds", d.bedId)))
      h += '<button class="btn ghost block" style="margin-top:8px" onclick="Groups.unGroup()">Back to one solid shape</button>';

    openSheet("Pots and planters", h);
  },

  preview(){
    const d = Groups.draft; if(!d) return "";
    const L = Groups.layout(d);
    const pad = 4, W = L.w_in, H = L.h_in;
    const sc = 300 / Math.max(W, 1);
    let s = '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + pad*2) + ' ' + (H + pad*2) +
      '" style="width:100%;height:auto;max-height:200px;display:block">';
    L.parts.forEach(p => {
      if(p.s === "circle")
        s += '<ellipse cx="' + (p.x + p.w/2) + '" cy="' + (p.y + p.h/2) + '" rx="' + (p.w/2) + '" ry="' + (p.h/2) +
          '" fill="#8a6a4f" stroke="#5d4634" stroke-width="' + Math.max(0.6, W/220) + '"/>';
      else {
        const r = p.s === "round" ? Math.min(p.w, p.h) * 0.18 : 0;
        s += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + r +
          '" fill="#8a6a4f" stroke="#5d4634" stroke-width="' + Math.max(0.6, W/220) + '"/>';
      }
    });
    return s + '</svg>';
  },
  note(){
    const d = Groups.draft; if(!d) return "";
    const L = Groups.layout(d);
    return L.count + ' container' + (L.count === 1 ? "" : "s") + ' · ' +
      Units.area(Groups.areaOf(L.parts)) + ' of soil · the whole thing takes up ' +
      Units.dims(L.w_in, L.h_in);
  },
  repaint(){
    const p = $("#gp-prev"); if(p) p.innerHTML = Groups.preview();
    const n = $("#gp-note"); if(n) n.innerHTML = Groups.note();
    const c = $("#gp-count"); if(c) c.textContent = (Groups.draft.cols * Groups.draft.rows) + " containers";
  },

  set(k, v){ Groups.draft[k] = v; Groups.sheet(); },
  bump(k, n){
    Groups.draft[k] = clamp(Groups.draft[k] + n, 1, 20);
    const el = $$("#sheet-body .stepper .v")[k === "cols" ? 0 : 1];
    if(el) el.textContent = Groups.draft[k];
    Groups.repaint();
  },
  preset(id){
    const p = Groups.PRESETS.find(x => x.id === id); if(!p) return;
    Object.assign(Groups.draft, { s: p.s, w: p.w, h: p.h, gap: p.gap, cols: p.cols, rows: p.rows });
    Groups.sheet();
  },
  read(){
    const d = Groups.draft;
    d.w = clamp(Units.inLen(num(($("#gp-w") || {}).value, Units.outLen(d.w))), 2, 120);
    d.h = clamp(Units.inLen(num(($("#gp-h") || {}).value, Units.outLen(d.h))), 2, 120);
    d.gap = clamp(Units.inLen(num(($("#gp-gap") || {}).value, Units.outLen(d.gap))), 0, 60);
    Groups.repaint();
  },

  save(){
    const d = Groups.draft; if(!d) return;
    const r = Groups.apply(d.bedId, d);
    closeSheet(); Garden.render();
    toast(r.count + " container" + (r.count === 1 ? "" : "s") +
      (r.moved ? " · " + r.moved + " plant" + (r.moved === 1 ? "" : "s") + " moved into one" : ""));
  },

  unGroup(){
    const d = Groups.draft; if(!d) return;
    const bed = Geom.bed(DB.find("beds", d.bedId));
    confirmSheet("Back to one shape?",
      "The bed becomes a single rectangle the size of the whole arrangement. Nothing planted is removed, but plants that were in separate pots will end up in one bed together.",
      "Do it", () => {
        DB.update("beds", d.bedId, { parts: null, shape: "rect" });
        Geom.saveParts && (Geom.partsOf(DB.find("beds", d.bedId)));
        Garden.render(); toast("Back to one shape");
      });
  }
};

/* ---------- ways in ---------- */
(function wireGroups(){
  /* the shape sheet: choosing "Pots & planters" opens the group editor */
  const origPick = Shape.pick;
  Shape.pick = function(bedId, shape){
    if(shape === "group") return Groups.open(bedId);
    /* leaving a group behind clears the parts, or the old containers would
       keep drawing underneath the new outline */
    const bed = DB.find("beds", bedId);
    if(bed && bed.parts) DB.update("beds", bedId, { parts: null });
    return origPick.call(Shape, bedId, shape);
  };

  /* the shape sheet hides the width/depth sliders for a group — the size is
     decided by the containers, not by dragging a box around them */
  const origOpen = Shape.open;
  Shape.open = function(bedId){
    origOpen.call(Shape, bedId);
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId));
    if(!bed || !Geom.isGroup(bed)) return;
    const body = $("#sheet-body"); if(!body) return;
    const w = body.querySelector("#sh-w");
    const grid = w ? w.closest(".grid2") : null;
    if(grid) grid.innerHTML = '<div class="note i" style="grid-column:1/-1;margin:0">' +
      'This bed is ' + (Geom.partList(bed) || []).length + ' separate containers. Their size and spacing set how big it is.' +
      '</div>';
    body.insertAdjacentHTML("afterbegin",
      '<button class="btn block" style="margin-bottom:12px" onclick="Groups.open(\'' + bed.id + '\')">⁙ Edit the containers</button>');
  };

  /* and from the bed menu, where the rest of the bed's settings live */
  const origMenu = Garden.bedMenu;
  Garden.bedMenu = function(){
    origMenu.apply(Garden, arguments);
    const body = $("#sheet-body"); if(!body || !APP.bedId) return;
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    body.insertAdjacentHTML("beforeend",
      '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Groups.open(\'' +
      APP.bedId + '\')},250)">⁙ ' + (Geom.isGroup(bed) ? "Edit the pots and planters" : "Make this a group of pots or planters") + '</button>');
  };

  /* the bed header should say what it is rather than calling a row of pots
     a "rounded rectangle" */
  const origBedView = Garden.bedView;
  Garden.bedView = function(){
    origBedView.call(Garden);
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    if(!bed || !Geom.isGroup(bed)) return;
    const box = $("#s-garden"); if(!box) return;
    const sub = box.querySelector(".row .tiny.muted");
    const n = (Geom.partList(bed) || []).length;
    if(sub) sub.innerHTML = '⁙ ' + n + ' container' + (n === 1 ? "" : "s") + ' · ' +
      Units.area(Geom.areaSqFt(bed)) + ' of soil · ' + esc(bed.sun_hours || "?") + 'h sun';
  };
})();
</script>
