<script>
/* ============================================================
   BED SHAPES

   Beds are rectangles in catalogues and almost nowhere else. Real
   ones follow a fence, wrap a corner, fill a triangle beside a
   path, or are a half-barrel. So: eight presets that resize and
   rotate, and a pencil for everything they miss.

   The drawing tool snaps corner to corner. That is the whole
   trick — a shape you trace freehand never closes cleanly and
   never butts up against its neighbour, so you end up with
   overlapping slivers. Snapping to a three-inch grid and to
   corners you have already placed means two beds drawn separately
   still meet exactly, and hexagons or triangles tile into any
   layout you like.
   ============================================================ */

const Shape = {
  draft: null,          /* the polygon being drawn, in inches */

  /* ---------- the sheet ---------- */
  open(bedId){
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId)); if(!bed) return;
    const cur = Geom.shape(bed);
    let h = '<p class="muted sm" style="margin-top:0">Pick an outline, then set the size. Every shape can be rotated on the garden map, and several can be butted together to build a layout no single shape covers.</p>';

    h += '<div class="shapegrid">';
    Object.keys(Geom.SHAPES).forEach(k => {
      const s = Geom.SHAPES[k];
      h += '<button class="' + (cur === k ? "on" : "") + '" onclick="Shape.pick(\'' + bed.id + '\',\'' + k + '\')">' +
        '<div class="g">' + s.e + '</div><div class="n">' + esc(s.n) + '</div></button>';
    });
    h += '</div>';
    h += '<div class="tiny muted" style="margin-top:8px">' + esc((Geom.SHAPES[cur] || {}).d || "") + '</div>';

    h += '<div class="canvaswrap" id="sh-prev" style="margin-top:12px;padding:6px">' +
      Canvas.svg(bed, { interactive:false, pad:3 }) + '</div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Width · <b id="sh-wv">' + Shape.ft(Geom.W(bed)) + '</b></label>' +
        '<input type="range" id="sh-w" min="12" max="480" step="3" value="' + Geom.W(bed) +
        '" oninput="Shape.size(\'' + bed.id + '\')"></div>' +
      '<div><label class="f">Depth · <b id="sh-hv">' + Shape.ft(Geom.H(bed)) + '</b></label>' +
        '<input type="range" id="sh-h" min="12" max="480" step="3" value="' + Geom.H(bed) +
        '" oninput="Shape.size(\'' + bed.id + '\')"></div></div>';
    h += '<div class="tiny muted" id="sh-area" style="margin-top:6px">' + Units.area(Geom.areaSqFt(bed)) + ' of growing space</div>';

    h += '<div class="row between" style="margin-top:14px"><div><div class="b sm">Square-foot grid</div>' +
      '<div class="tiny muted">Shows the squares and snaps new plants to them.</div></div>' +
      '<button class="switch ' + (num(bed.grid_on) ? "on" : "") + '" id="sh-grid"></button></div>';
    h += '<div class="field" style="margin-top:10px"><label class="f">Square size (' + Units.lenUnit() + ')</label>' +
      '<input type="number" id="sh-cell" step="' + Units.lenStep() + '" min="' + Units.outLen(3) + '" max="' + Units.outLen(48) +
      '" value="' + esc(Units.outLen(num(bed.cell_in, 12))) + '"></div>';

    /* Companion magnetism used to be buried here. It is a thing you change
       while you are dragging plants about, not while you are choosing how big
       the bed is, so it lives on the bed's own toolbar now — 🧲 Snap. */

    h += '<button class="btn ghost block" style="margin-top:14px" onclick="Shape.drawStart(\'' + bed.id + '\')">✎ Trace my own outline</button>';
    h += '<button class="btn block" style="margin-top:8px" onclick="Shape.save(\'' + bed.id + '\')">Save</button>';

    openSheet("Shape and size", h);
    const g = $("#sh-grid"); if(g) g.onclick = () => g.classList.toggle("on");
  },

  /* feet-and-inches reads naturally in one system and is meaningless in the
     other, so metric gets a plain centimetre figure rather than a translation
     of a convention that does not exist there */
  ft(inches){
    if(Units.metric) return Units.big(inches);
    const f = Math.floor(inches / 12), i = Math.round(inches - f * 12);
    return (f ? f + "\u2032" : "") + (i ? " " + i + "\u2033" : (f ? "" : "0\u2033"));
  },

  pick(bedId, shape){
    const bed = DB.find("beds", bedId); if(!bed) return;
    if(shape === "poly") return Shape.drawStart(bedId);
    DB.update("beds", bedId, { shape: shape });
    Shape.open(bedId);
  },

  size(bedId){
    const w = clamp(num(($("#sh-w") || {}).value, 48), 12, 480);
    const h = clamp(num(($("#sh-h") || {}).value, 48), 12, 480);
    DB.update("beds", bedId, { w_in: w, h_in: h });
    const bed = DB.find("beds", bedId);
    const wv = $("#sh-wv"); if(wv) wv.textContent = Shape.ft(w);
    const hv = $("#sh-hv"); if(hv) hv.textContent = Shape.ft(h);
    const pv = $("#sh-prev"); if(pv) pv.innerHTML = Canvas.svg(Geom.bed(bed), { interactive:false, pad:3 });
    const ar = $("#sh-area"); if(ar) ar.textContent = Units.area(Geom.areaSqFt(Geom.bed(bed))) + " of growing space";
  },

  save(bedId){
    const cell = clamp(Units.inLen(num(($("#sh-cell") || {}).value, Units.outLen(12))), 3, 48);
    const gridOn = $("#sh-grid") && $("#sh-grid").classList.contains("on") ? 1 : 0;
    const bed = Geom.bed(DB.find("beds", bedId));
    /* cols and rows are only the grid overlay now, but the map, the recap
       and the assistant still read them, so keep them honest */
    DB.update("beds", bedId, {
      cell_in: cell, grid_on: gridOn, snap_in: gridOn ? cell : 0,
      cols: Math.max(1, Math.round(Geom.W(bed) / cell)),
      rows: Math.max(1, Math.round(Geom.H(bed) / cell))
    });
    const b = DB.find("beds", bedId);
    /* anything now outside the new outline is pulled back in rather than lost */
    let moved = 0;
    Geom.live(bedId).forEach(p => {
      const fit = Geom.clampInto(Geom.bed(b), Geom.PX(p), Geom.PY(p), Math.min(Geom.RR(p), 2));
      if(fit.clamped || fit.tight){
        DB.update("plantings", p.id, { px: Math.round(fit.x*10)/10, py: Math.round(fit.y*10)/10 });
        moved++;
      }
    });
    closeSheet(); Garden.render();
    toast(moved ? moved + " plant" + (moved > 1 ? "s" : "") + " moved back inside" : "Bed updated");
  },

  /* ============================================================
     TRACING AN OUTLINE

     Tap to drop corners. Each one snaps to a 3-inch grid, and to
     any corner already placed — including the first, which is how
     you close the shape cleanly instead of leaving a sliver.
     ============================================================ */
  GRID: 3,
  drawStart(bedId){
    const bed = Geom.bed(DB.find("beds", bedId));
    Shape.draft = { bedId: bedId, pts: [], w: Geom.W(bed), h: Geom.H(bed) };
    Shape.drawSheet();
  },

  drawSheet(){
    const d = Shape.draft; if(!d) return;
    const n = d.pts.length;
    let h = '<p class="muted sm" style="margin-top:0">Tap to drop a corner. Corners snap to the ' + Units.len(Shape.GRID) +
      ' grid and to each other — tap the first corner again to close the shape.</p>';
    h += '<div class="canvaswrap" id="sh-draw" style="padding:6px">' + Shape.drawSVG() + '</div>';
    h += '<div class="row between tiny muted" style="margin-top:8px">' +
      '<span>' + n + ' corner' + (n === 1 ? "" : "s") + (n >= 3 ? ' · ' + Units.area(Shape.draftArea()) : '') + '</span>' +
      '<span>' + Shape.ft(d.w) + ' × ' + Shape.ft(d.h) + ' canvas</span></div>';
    h += '<div class="row" style="gap:8px;margin-top:12px">' +
      '<button class="btn ghost" onclick="Shape.undo()">↶ Undo</button>' +
      '<button class="btn ghost" onclick="Shape.drawStart(\'' + d.bedId + '\')">Clear</button>' +
      '<button class="btn grow" onclick="Shape.drawSave()"' + (n < 3 ? " disabled" : "") + '>Use this outline</button></div>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="Shape.open(\'' + d.bedId + '\')">← Back to the presets</button>';
    openSheet("Trace the bed", h);
    Shape.bindDraw();
  },

  drawSVG(){
    const d = Shape.draft;
    const P = Shape.GRID;
    let g = '';
    for(let x = 0; x <= d.w; x += P * 4) g += '<path d="M' + x + ' 0V' + d.h + '"/>';
    for(let y = 0; y <= d.h; y += P * 4) g += '<path d="M0 ' + y + 'H' + d.w + '"/>';
    let h = '<svg id="drawsvg" viewBox="-4 -4 ' + (d.w + 8) + ' ' + (d.h + 8) +
      '" xmlns="http://www.w3.org/2000/svg" style="touch-action:none">';
    h += '<rect x="0" y="0" width="' + d.w + '" height="' + d.h + '" fill="var(--surface-2)" stroke="var(--line)" stroke-width="0.6"/>';
    h += '<g stroke="var(--line)" stroke-width="0.4" fill="none">' + g + '</g>';
    if(d.pts.length >= 2){
      const path = "M" + d.pts.map(p => p[0] + " " + p[1]).join("L") + (d.pts.length >= 3 ? "Z" : "");
      h += '<path d="' + path + '" fill="#5d4634" fill-opacity="' + (d.pts.length >= 3 ? "0.6" : "0") +
           '" stroke="#2a8c5e" stroke-width="0.9" stroke-linejoin="round"/>';
    }
    d.pts.forEach((p, i) => {
      h += '<circle class="vtx" data-i="' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="' +
        (i === 0 ? "#2a8c5e" : "#fff") + '" stroke="#2a8c5e" stroke-width="0.8"/>';
    });
    h += '</svg>';
    return h;
  },

  draftArea(){
    const pts = Shape.draft.pts;
    let a = 0;
    for(let i = 0, j = pts.length - 1; i < pts.length; j = i++)
      a += pts[j][0]*pts[i][1] - pts[i][0]*pts[j][1];
    return Math.round(Math.abs(a / 2) / 144 * 10) / 10;
  },

  /* every corner already placed is a snap target, and so is the grid */
  snapPt(x, y){
    const d = Shape.draft;
    const hit = Geom.nearest(x, y, d.pts, 6);
    if(hit) return { x: hit[0], y: hit[1], onVertex: true, i: d.pts.indexOf(hit) };
    return { x: clamp(Geom.snap(x, Shape.GRID), 0, d.w), y: clamp(Geom.snap(y, Shape.GRID), 0, d.h) };
  },

  bindDraw(){
    const svg = $("#drawsvg"); if(!svg) return;
    svg.addEventListener("pointerdown", ev => {
      const d = Shape.draft; if(!d) return;
      const vtx = ev.target && ev.target.closest && ev.target.closest(".vtx");
      if(vtx) return Shape.dragVertex(ev, num(vtx.getAttribute("data-i"), 0));
      const pt = Canvas.toIn(svg, ev.clientX, ev.clientY);
      const s = Shape.snapPt(pt.x, pt.y);
      if(s.onVertex && s.i === 0 && d.pts.length >= 3){ return Shape.drawSave(); }
      if(s.onVertex) return;
      d.pts.push([s.x, s.y]);
      haptic();
      Shape.drawSheet();
    });
  },

  dragVertex(ev, i){
    ev.preventDefault();
    const svg = $("#drawsvg"), d = Shape.draft;
    const move = e => {
      const pt = Canvas.toIn(svg, e.clientX, e.clientY);
      const others = d.pts.filter((p, k) => k !== i);
      const hit = Geom.nearest(pt.x, pt.y, others, 6);
      d.pts[i] = hit ? [hit[0], hit[1]]
                     : [clamp(Geom.snap(pt.x, Shape.GRID), 0, d.w), clamp(Geom.snap(pt.y, Shape.GRID), 0, d.h)];
      const host = $("#sh-draw"); if(host){ host.innerHTML = Shape.drawSVG(); Shape.bindDraw(); }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      Shape.drawSheet();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  },

  undo(){
    if(!Shape.draft || !Shape.draft.pts.length) return;
    Shape.draft.pts.pop();
    Shape.drawSheet();
  },

  drawSave(){
    const d = Shape.draft;
    if(!d || d.pts.length < 3) return toast("Three corners at least");
    /* trim the canvas to what was actually drawn, and store normalised */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    d.pts.forEach(p => { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
                         maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    const w = Math.max(12, maxX - minX), h = Math.max(12, maxY - minY);
    const norm = d.pts.map(p => [Math.round((p[0] - minX) / w * 1000) / 1000,
                                 Math.round((p[1] - minY) / h * 1000) / 1000]);
    DB.update("beds", d.bedId, { w_in: Math.round(w), h_in: Math.round(h) });
    Geom.savePoly(d.bedId, norm);
    Shape.draft = null;
    closeSheet(); Garden.render();
    toast("Outline saved · " + Units.area(Geom.areaSqFt(Geom.bed(DB.find("beds", d.bedId)))));
  }
};

/* ============================================================
   THE GARDEN MAP — real outlines, and beds that snap together
   ============================================================ */
Gmap.bedFeet = function(b){ return Geom.footprintFt(b); };

/* every corner of everything else, as somewhere this bed could latch on */
Gmap.snapTargets = function(plotId, exceptId){
  const out = [];
  Gmap.items(plotId).forEach(i => {
    if(i.id === exceptId || i.x === null || i.y === null) return;
    if(i.kind === "bed"){
      Geom.cornersFt(i.row).forEach(c => out.push(c));
    } else {
      out.push([i.x, i.y], [i.x + i.size.w, i.y], [i.x, i.y + i.size.h], [i.x + i.size.w, i.y + i.size.h]);
    }
  });
  return out;
};

/* offset that lands one of this item's corners exactly on one of theirs */
Gmap.snapOffset = function(item, nx, ny, targets, tol){
  const dx = nx - item.x, dy = ny - item.y;
  let mine;
  if(item.kind === "bed"){
    mine = Geom.cornersFt(item.row).map(c => [c[0] + dx, c[1] + dy]);
  } else {
    mine = [[nx, ny], [nx + item.size.w, ny], [nx, ny + item.size.h], [nx + item.size.w, ny + item.size.h]];
  }
  let best = null, bd = tol === undefined ? 0.45 : tol;
  mine.forEach(m => {
    const t = Geom.nearest(m[0], m[1], targets, bd);
    if(!t) return;
    const d = Math.hypot(t[0] - m[0], t[1] - m[1]);
    if(d < bd){ bd = d; best = [t[0] - m[0], t[1] - m[1]]; }
  });
  return best;
};

Gmap.dragStart = function(ev, el){
  if(!Gmap.arrange) return;
  ev.preventDefault();
  const id = el.dataset.id, kind = el.dataset.kind;
  const table = kind === "bed" ? "beds" : "mapitems";
  const row = DB.find(table, id); if(!row) return;
  const plotId = APP.plotId && DB.find("plots", APP.plotId) ? APP.plotId : null;
  const item = Gmap.items(plotId).find(i => i.id === id); if(!item) return;
  const targets = Gmap.snapTargets(plotId, id);
  const ppf = Gmap._ppf;
  const sx = ev.clientX, sy = ev.clientY;
  const ox = num(row.mx, 0), oy = num(row.my, 0);
  el._moved = false;
  let snapped = false;

  const move = e => {
    const dxf = (e.clientX - sx) / ppf, dyf = (e.clientY - sy) / ppf;
    if(Math.abs(e.clientX - sx) > 4 || Math.abs(e.clientY - sy) > 4) el._moved = true;
    let nx = Math.max(0, Math.round((ox + dxf) * 4) / 4);
    let ny = Math.max(0, Math.round((oy + dyf) * 4) / 4);
    const off = Gmap.snapOffset(Object.assign({}, item, { x: ox, y: oy }), nx, ny, targets);
    if(off){ nx = Math.max(0, nx + off[0]); ny = Math.max(0, ny + off[1]);
      if(!snapped){ snapped = true; haptic(); }
      el.classList.add("snapped");
    } else { snapped = false; el.classList.remove("snapped"); }
    el.style.left = Math.round(nx * ppf) + "px";
    el.style.top = Math.round(ny * ppf) + "px";
    el._nx = nx; el._ny = ny;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    el.classList.remove("snapped");
    if(el._moved && el._nx !== undefined){
      DB.update(table, id, { mx: el._nx, my: el._ny });
      Gmap.sel = id; haptic(); Garden.render();
      if(snapped) toast("Snapped corner to corner");
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
};

/* ============================================================
   MAKING AND RESIZING A BED
   ============================================================ */
Garden.newBed = function(){
  const plots = DB.all("plots");
  let h = '<div class="field"><label class="f">Bed name</label><input type="text" id="nb-name" placeholder="Raised bed 1"></div>';
  h += '<div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Outline</div>';
  h += '<div class="shapegrid">';
  Object.keys(Geom.SHAPES).forEach((k, i) => {
    if(k === "poly") return;
    const s = Geom.SHAPES[k];
    h += '<button class="' + (i === 0 ? "on" : "") + '" data-shape="' + k + '">' +
      '<div class="g">' + s.e + '</div><div class="n">' + esc(s.n) + '</div></button>';
  });
  h += '</div>';
  h += '<div class="grid2" style="margin-top:14px">' +
    '<div><label class="f">Width (' + Units.bigUnit() + ')</label><input type="number" id="nb-w" value="' + Units.outBig(48) +
      '" min="' + Units.outBig(12) + '" max="' + Units.outBig(480) + '" step="' + Units.bigStep() + '"></div>' +
    '<div><label class="f">Depth (' + Units.bigUnit() + ')</label><input type="number" id="nb-h" value="' + Units.outBig(96) +
      '" min="' + Units.outBig(12) + '" max="' + Units.outBig(480) + '" step="' + Units.bigStep() + '"></div></div>';
  h += '<div class="grid2" style="margin-top:12px">' +
    '<div><label class="f">Direct sun (hrs)</label><input type="number" id="nb-sun" value="8" min="0" max="16"></div>' +
    '<div><label class="f">Square size (' + Units.lenUnit() + ')</label><input type="number" id="nb-cell" value="' + Units.outLen(12) +
      '" min="' + Units.outLen(3) + '" max="' + Units.outLen(48) + '" step="' + Units.lenStep() + '"></div></div>';
  if(plots.length) h += '<div class="field"><label class="f">Plot</label><select id="nb-plot"><option value="">— none —</option>' +
    plots.map(p => '<option value="' + p.id + '"' + (APP.plotId === p.id ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select></div>';
  h += '<div class="note i" style="margin-top:12px">Plants go anywhere inside the outline — no grid unless you ask for one. The square size only sets the optional overlay, and how far plants jump when you snap them to it.</div>';
  h += '<button class="btn block" style="margin-top:14px" onclick="Garden.saveNewBed()">Create bed</button>';
  openSheet("New bed", h);
  $$("#sheet-body .shapegrid button").forEach(b => b.onclick = () =>
    $$("#sheet-body .shapegrid button").forEach(x => x.classList.toggle("on", x === b)));
  setTimeout(() => { const el = $("#nb-name"); if(el) el.focus(); }, 300);
};

Garden.saveNewBed = function(){
  const sel = $("#sheet-body .shapegrid button.on");
  const shape = sel ? sel.dataset.shape : "rect";
  /* typed in whatever system is on, stored in inches either way */
  const cell = clamp(Units.inLen(num(($("#nb-cell") || {}).value, Units.outLen(12))), 3, 48);
  const wIn = Math.round(clamp(Units.inBig(num(($("#nb-w") || {}).value, Units.outBig(48))), 12, 480));
  const hIn = Math.round(clamp(Units.inBig(num(($("#nb-h") || {}).value, Units.outBig(96))), 12, 480));
  const b = DB.insert("beds", {
    name: (($("#nb-name") || {}).value || "").trim() || ("Bed " + (DB.count("beds") + 1)),
    shape: shape, w_in: wIn, h_in: hIn, cell_in: cell, grid_on: 0, snap_in: 0,
    cols: Math.max(1, Math.round(wIn / cell)), rows: Math.max(1, Math.round(hIn / cell)),
    sun_hours: num(($("#nb-sun") || {}).value, 8),
    plot_id: (($("#nb-plot") || {}).value) || APP.plotId || null
  });
  closeSheet(); Garden.open(b.id);
  toast("Bed created — tap the soil to plant");
};

/* the old cols/rows resize still works; it just moves the outline */
Garden.resize = function(dc, dr){
  const b = Geom.bed(DB.find("beds", APP.bedId)); if(!b) return;
  const cell = Garden.cell(b);
  const cols = clamp(num(b.cols, 4) + num(dc, 0), 1, 40);
  const rows = clamp(num(b.rows, 4) + num(dr, 0), 1, 40);
  DB.update("beds", b.id, { cols: cols, rows: rows, w_in: cols * cell, h_in: rows * cell });
  const bb = DB.find("beds", b.id);
  let moved = 0;
  Geom.live(b.id).forEach(p => {
    const fit = Geom.clampInto(Geom.bed(bb), Geom.PX(p), Geom.PY(p), Math.min(Geom.RR(p), 2));
    if(fit.clamped || fit.tight){
      DB.update("plantings", p.id, { px: Math.round(fit.x*10)/10, py: Math.round(fit.y*10)/10 });
      moved++;
    }
  });
  Garden.render();
  if(moved) toast(moved + " plant" + (moved > 1 ? "s" : "") + " moved back inside");
};

/* a way into the shape sheet from bed settings */
(function shapeInMenu(){
  const orig = Garden.bedMenu.bind(Garden);
  Garden.bedMenu = function(){
    orig();
    const body = $("#sheet-body"); if(!body || !APP.bedId) return;
    body.insertAdjacentHTML("afterbegin",
      '<button class="btn ghost block" style="margin-bottom:12px" onclick="closeSheet();setTimeout(function(){Shape.open(\'' +
      APP.bedId + '\')},250)">◈ Shape and size</button>');
  };
})();

/* draw the bed's real outline on the map rather than a stand-in box */
(function shapedMap(){
  const orig = Gmap.render.bind(Gmap);
  Gmap.render = function(){
    orig();
    $$("#mapplot .mapbed").forEach(el => {
      const b = DB.find("beds", el.dataset.id); if(!b) return;
      const bb = Geom.bed(b);
      const rot = num(bb.rot) === 90;
      const w = rot ? Geom.H(bb) : Geom.W(bb), h = rot ? Geom.W(bb) : Geom.H(bb);
      const s = Geom.shape(bb);
      let inner;
      if(Geom.isRound(s)) inner = '<ellipse cx="50" cy="50" rx="50" ry="50" fill="#8a6a4f" stroke="#5d4634" stroke-width="2"/>';
      else {
        const pts = Geom.pts(bb).map(p => {
          let x = p[0] / Geom.W(bb) * 100, y = p[1] / Geom.H(bb) * 100;
          if(rot){ const t = x; x = 100 - y; y = t; }
          return (Math.round(x*10)/10) + " " + (Math.round(y*10)/10);
        });
        inner = '<path d="M' + pts.join("L") + 'Z" fill="#8a6a4f" stroke="#5d4634" stroke-width="2"/>';
      }
      el.insertAdjacentHTML("afterbegin",
        '<svg class="mapshape" viewBox="0 0 100 100" preserveAspectRatio="none" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;z-index:-1">' + inner + '</svg>');
    });
    Gmap.bind();
  };
})();
</script>
