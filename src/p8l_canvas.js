<style>
/* ---------- the planting canvas ---------- */
.canvaswrap{position:relative;background:var(--surface);border:1px solid var(--line);
  border-radius:18px;padding:10px;overflow:hidden;box-shadow:var(--shadow)}
.canvaswrap svg{display:block;width:100%;height:auto;touch-action:pan-y;user-select:none}
.canvaswrap svg.dragging{touch-action:none}
.pl{cursor:pointer}
.pl.sel .canring{stroke-width:0.9;stroke-dasharray:none}
.pl.ghosted{opacity:.55}
.pl.marked .markring{stroke-dasharray:2 1.4}
.grip{cursor:nwse-resize}
.pmenu{cursor:pointer}
.hitpad{cursor:pointer}
.canvaswrap svg.zoomed{touch-action:none;cursor:grab}
.zoomtag{position:absolute;right:14px;top:14px;z-index:4;background:rgba(20,16,12,.72);
  color:#fff;border-radius:999px;padding:3px 10px;font-size:.68rem;font-weight:700;
  letter-spacing:.02em;pointer-events:none}
.selbar{margin-top:8px;background:var(--surface-2);border:1px solid var(--line);
  border-radius:14px;padding:10px 12px}
.cvbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.cvbar .chip{flex:0 0 auto}
.tlwrap{margin-top:12px;background:var(--surface-2);border:1px solid var(--line);
  border-radius:14px;padding:10px 12px}
.tlwrap input[type=range]{width:100%;margin:6px 0 2px}
.tlhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.tlhead .b{font-size:.9rem}
.shapegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.shapegrid button{padding:12px 6px;border-radius:14px;border:1px solid var(--line);
  background:var(--surface-2);text-align:center}
.shapegrid button.on{border-color:var(--green-600);background:var(--green-100)}
.shapegrid .g{font-size:1.5rem;line-height:1}
.shapegrid .n{font-size:.7rem;font-weight:650;margin-top:4px}
.badge-t{font-size:.62rem;font-weight:700}
</style>
<script>
/* ============================================================
   THE PLANTING CANVAS

   One SVG, drawn in inches. The viewBox does the scaling, so every
   number in this file is a real garden measurement and nothing has
   to be converted twice.

   Draw order is back to front by depth, which is how you actually
   see a bed: the plants nearer you overlap the ones behind. Anything
   that overlaps what is behind it goes slightly transparent, so a
   sprawling squash never hides the beetroot it has grown over.
   ============================================================ */

const Canvas = {
  PAD: 5,                 /* inches of soil edge around the bed */
  showRoots: false,
  showCanopy: true,
  labels: null,           /* null = decide by how crowded the bed is */

  /* the date the plan is being previewed at */
  date(){ return addDays(today(), num(Garden.tl, 0) * 7); },

  /* How much of the inner circle's radius the icon may occupy. Short of the
     line on purpose: an icon that touches the circle it sits in reads as one
     blob, and the gap is what makes the ring legible as a measurement. */
  ICON_FIT: 0.9,

  /* How big to draw the icon. PlantArt draws in a unit circle, so this is a
     scale factor, and `scale × PlantArt.R` is the radius the drawing occupies
     in inches.

     THE ICON IS IDENTIFICATION, NOT A SECOND MEASUREMENT. It used to be sized
     off the plant's own canopy, which meant an apple was drawn as an enormous
     glyph and a carrot as a speck — the same information the two circles were
     already carrying, said twice, and said worse. A bed of mixed crops read as
     a jumble of wildly different-sized stickers.

     So every crop now gets the SAME icon, sized off the bed rather than off the
     plant. Only two things move it:

       · growth — a seedling really is smaller than the mature plant, and the
         season scrubber exists to show exactly that;
       · the bed — a big bed gets a slightly bigger icon so it stays legible,
         which keeps the whole thing readable at any bed size.

     There is deliberately NO cap against the plant's own root circle. That cap
     is what produced the disparity in the first place, and it was solving a
     problem this app does not have: a dense sowing is ONE planting carrying a
     quantity, not sixteen separate points, so uniform icons do not pile up.
     The root ring is stroked AFTER the icon, so on a small crop whose icon
     covers its circle the measurement is still the thing drawn on top. */
  ICON_BASE: 0.075,       /* icon radius as a fraction of the bed's short side */
  ICON_MIN_IN: 1.6,       /* never a speck, whatever the bed */
  ICON_MAX_IN: 7,         /* never a billboard, whatever the bed */

  iconR(bed, rc, grown, rr){
    const short = Math.min(Geom.W(bed), Geom.H(bed));
    /* one size for every crop in this bed */
    const base = clamp(short * Canvas.ICON_BASE, Canvas.ICON_MIN_IN, Canvas.ICON_MAX_IN);
    /* a seedling is smaller than the grown plant — but never below two-thirds,
       or an early-season bed becomes unreadable */
    const g = clamp(num(grown, 1), 0.66, 1);
    return Math.round(base * g / PlantArt.R * 100) / 100;
  },

  /* How big a companion badge should be.
     This was a flat `Math.max(2.4, rc * 0.42)` — a radius in *inches*, with a
     hard 2.4" floor. On a radish that is a badge nearly as wide as the plant,
     so a bed of small crops turned into a field of hearts and told you less
     than the plants themselves did. It is a fraction of the bed now, which
     means a constant small size on screen whatever the plot measures, with a
     warning allowed to be a little larger than a heart because a warning is
     the one you must not miss. */
  badgeR(bed, rc, bad){
    const span = Math.min(Geom.W(bed), Geom.H(bed));
    const ts = typeof Zoom !== "undefined" ? Zoom.textScale() : 1;
    const p = num(rc, 6);
    /* the floor keeps a badge visible on a big plot; the cap against the
       plant's own canopy is the point of the whole change — a marker that is
       wider than the thing it marks tells you nothing you wanted to know */
    const r = Math.min(clamp(p * 0.26, span * 0.009, span * 0.020), p * 0.6) * ts;
    return Math.round((bad ? r * 1.3 : r) * 100) / 100;
  },

  /* How big the two buttons on a selected plant are — the resize handle and
     the ⋯ menu — and how far out they sit.

     This was `Math.max(2, rc * 0.2)`: a fifth of the canopy, in inches. So
     dragging a pumpkin's spread out to four feet grew its own handle to nearly
     ten inches across, and the control ended up larger than most of the plants
     around it. A button is not a measurement. It should be the same size on
     screen whatever the plant measures and whatever the magnification, the way
     a map's controls are — which means a fraction of the bed (constant on
     screen at 1×) times Zoom.textScale (constant on screen at every zoom, by
     shrinking in inches exactly as fast as the view magnifies).

     The fraction is of the bed's WIDTH plus the soil margin, not of its
     shorter side, because that is the number the SVG actually scales by: the
     element is `width:100%; height:auto`, so pixels-per-inch comes from the
     viewBox width and nothing else. Measuring off `min(W,H)` the way the
     badges do left a 96×48 bed's buttons at half the size of a 48×96 one's,
     for no reason a gardener could see.

     Nothing caps it against the plant, deliberately: the buttons sit outboard
     of the canopy rather than on it, and a handle that shrank with the radish
     it belonged to would be the same inconsistency in the other direction.
     What a small plant gets instead is `gripAt` pushing the two apart far
     enough that they clear each other. */
  GRIP_SCREEN: 0.033,     /* of the view width — a ~7% wide button, at any zoom */
  gripR(bed){
    const view = Geom.W(bed) + Canvas.PAD * 2;
    const ts = typeof Zoom !== "undefined" ? Zoom.textScale() : 1;
    return Math.round(view * Canvas.GRIP_SCREEN * ts * 100) / 100;
  },
  /* on the diagonal, at the canopy edge — but never so close in that the two
     buttons overlap each other on a plant smaller than they are */
  gripAt(bed, rc){
    const br = Canvas.gripR(bed);
    return Math.round(Math.max(num(rc, 6) * 0.7071, br * 1.15) * 10) / 10;
  },
  /* the invisible touch target behind each one — a fat finger's worth wider
     than the circle it sits under. It rides gripR, so it tracks zoom too;
     a fixed-inch pad would cover the neighbours at 4×. */
  gripTap(bed){ return Math.round(Canvas.gripR(bed) * 1.4 * 10) / 10; },

  wantLabels(bed){
    if(Canvas.labels !== null) return Canvas.labels;
    const ps = Geom.live(bed.id);
    /* Six of the herbs share one emoji, and so do asparagus and rhubarb. The
       icon cannot tell basil from sage, so when a bed holds two crops that
       look alike the labels are not optional — that is the whole job of the
       screen. */
    const seen = {};
    for(const p of ps){
      const k = PlantArt.icon(p.crop_id);
      if(seen[k] && seen[k] !== p.crop_id) return true;
      seen[k] = p.crop_id;
    }
    return ps.length <= 14;
  },

  /* ---------- soil ---------- */
  soilDefs(bed){
    const r = PlantArt.rng(Geom.hash(bed.id + "soil"));
    let spec = "";
    for(let i = 0; i < 26; i++){
      const x = r() * 16, y = r() * 16, rad = 0.18 + r() * 0.55;
      const tone = ["#7d6249","#4a3728","#6b5140","#8a6f52","#3f2f22"][Math.floor(r() * 5)];
      spec += '<circle cx="' + (Math.round(x*10)/10) + '" cy="' + (Math.round(y*10)/10) +
              '" r="' + (Math.round(rad*100)/100) + '" fill="' + tone + '" fill-opacity="' +
              (Math.round((0.25 + r() * 0.5) * 100) / 100) + '"/>';
    }
    const id = "soil-" + bed.id;
    return '<pattern id="' + id + '" width="16" height="16" patternUnits="userSpaceOnUse">' +
      '<rect width="16" height="16" fill="#5d4634"/>' + spec + '</pattern>' +
      '<radialGradient id="vig-' + bed.id + '" cx="50%" cy="42%" r="72%">' +
        '<stop offset="55%" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset="100%" stop-color="#000" stop-opacity="0.34"/>' +
      '</radialGradient>';
  },

  bedShapeSVG(bed, attrs){
    const s = Geom.shape(bed), w = Geom.W(bed), h = Geom.H(bed);
    /* a group is always a compound path, never a single ellipse, even when
       every container in it happens to be round */
    if(Geom.isRound(s) && !Geom.isGroup(bed))
      return '<ellipse cx="' + (w/2) + '" cy="' + (h/2) + '" rx="' + (w/2) + '" ry="' + (h/2) + '" ' + attrs + '/>';
    if(s === "round")
      return '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' +
             Math.min(w, h) * 0.12 + '" ' + attrs + '/>';
    return '<path d="' + Geom.svgPath(bed) + '" ' + attrs + '/>';
  },

  /* ---------- the whole picture ---------- */
  svg(bed, opts){
    const o = opts || {};
    bed = Geom.bed(bed);
    const W = Geom.W(bed), H = Geom.H(bed), P = o.pad === undefined ? Canvas.PAD : o.pad;
    const when = o.when || Canvas.date();
    const ps = Geom.live(bed.id).slice().sort((a, b) => Geom.PY(a) - Geom.PY(b));
    const inter = !!o.interactive;
    const clip = "clip-" + bed.id;

    /* Zoom is a viewBox change and nothing else. Canvas.toIn reads the live
       viewBox off the element, so every gesture in the app — tap, drag,
       resize, the buttons — stays correct at any magnification for free. A
       CSS transform would have broken all of them. At 1× this emits exactly
       the string it always did. */
    const vb = (inter && typeof Zoom !== "undefined") ? Zoom.viewBox(bed, P) : null;
    let h = '<svg viewBox="' + (vb || ((-P) + ' ' + (-P) + ' ' + (W + P*2) + ' ' + (H + P*2))) +
      '" xmlns="http://www.w3.org/2000/svg"' + (inter ? ' id="pcanvas"' : '') + '>';
    h += '<defs>' + Canvas.soilDefs(bed) +
      '<clipPath id="' + clip + '">' + Canvas.bedShapeSVG(bed, '') + '</clipPath></defs>';

    /* the bed itself */
    h += Canvas.bedShapeSVG(bed, 'fill="url(#soil-' + bed.id + ')"');
    h += '<g clip-path="url(#' + clip + ')">';
    if(num(bed.grid_on)){
      const c = Garden.cell(bed);
      let g = '';
      for(let x = c; x < W; x += c) g += '<path d="M' + x + ' 0V' + H + '"/>';
      for(let y = c; y < H; y += c) g += '<path d="M0 ' + y + 'H' + W + '"/>';
      h += '<g stroke="#fff" stroke-opacity="0.13" stroke-width="0.35">' + g + '</g>';
    }
    h += Canvas.bedShapeSVG(bed, 'fill="url(#vig-' + bed.id + ')"');
    h += '</g>';
    h += Canvas.bedShapeSVG(bed, 'fill="none" stroke="#3a2c20" stroke-opacity="0.75" stroke-width="' +
      Math.max(0.5, Math.min(W, H) * 0.012) + '"');

    /* who gets on with whom, worked out once for the whole bed */
    const flags = Canvas.flags(bed.id);
    const detail = clamp(1.25 - ps.length * 0.02, 0.4, 1.2);

    h += '<g class="plants">';
    ps.forEach((p, i) => {
      const px = Geom.PX(p), py = Geom.PY(p), rc = Geom.RC(p), rr = Geom.RR(p);
      const g = PlantArt.growth(p, when);
      const grown = Math.max(0.18, PlantArt.sizeAt(g));
      const over = ps.slice(0, i).some(q => Geom.dist(p, q) < rc + Geom.RC(q) - 0.5);
      const marked = typeof Sel !== "undefined" && Sel.has(p.id);
      const sel = Garden.sel === p.id && !marked;
      const f = flags[p.id] || {};

      h += '<g class="pl' + (sel ? " sel" : "") + (marked ? " marked" : "") + (over ? " ghosted" : "") +
           '" data-pid="' + p.id +
           '" transform="translate(' + (Math.round(px*10)/10) + ' ' + (Math.round(py*10)/10) + ')">';

      if(marked)
        h += '<circle class="markring" r="' + (Math.round(rc * grown * 1.06 * 10) / 10) +
             '" fill="none" stroke="#f0a500" stroke-width="' +
             (Math.round(Math.max(0.4, Math.min(Geom.W(bed), Geom.H(bed)) * 0.006) * 100) / 100) + '"/>';

      if(Canvas.showCanopy && g >= 0)
        h += '<circle class="canring" r="' + (Math.round(rc * grown * 10) / 10) +
             '" fill="' + (f.bad ? "#c9453c" : f.good ? "#2a8c5e" : "#4a7a52") +
             '" fill-opacity="' + (f.bad ? 0.20 : 0.16) + '" stroke="' +
             (f.bad ? "#c9453c" : f.good ? "#2a8c5e" : "#ffffff") + '" stroke-opacity="' +
             (f.bad || f.good ? 0.55 : 0.28) + '" stroke-width="0.35" stroke-dasharray="1.6 1.2"/>';

      h += '<g class="art" transform="scale(' + Canvas.iconR(bed, rc, grown, rr) + ')">' +
           PlantArt.svg(p, { growth: g }) + '</g>';

      /* after the icon, not before: at a carrot's size the icon is wider than
         the root circle, and the circle is the part that means something */
      if(Canvas.showRoots || sel)
        h += '<circle r="' + (Math.round(rr*10)/10) + '" fill="none" stroke="' +
             (f.crowded ? "#d98324" : "#f7f3ea") + '" stroke-opacity="0.7" stroke-width="0.32"/>';

      if(num(p.qty, 1) > 1 && rc >= 4)
        h += '<text x="0" y="' + (Math.round((rc * grown + 2.4) * 10) / 10) +
             '" text-anchor="middle" font-size="' + (Math.max(2.2, rc * 0.34)) +
             '" fill="#fff" fill-opacity="0.82" font-weight="700">×' + num(p.qty, 1) + '</text>';

      if(f.bad || f.good){
        const bs = Canvas.badgeR(bed, rc, f.bad);
        /* outboard of the canopy, so it sits beside the plant rather than on it */
        const bo = Math.round((rc * grown + bs * 0.9) * 0.7071 * 10) / 10;
        h += '<g class="cbadge" transform="translate(' + bo + ' ' + (-bo) + ')">' +
          '<circle r="' + bs + '" fill="' + (f.bad ? "#c9453c" : "#2a8c5e") +
          '" stroke="#fff" stroke-opacity="0.55" stroke-width="' + (Math.round(bs*0.18*100)/100) + '"/>' +
          '<text y="' + (Math.round(bs * 0.38 * 100) / 100) + '" text-anchor="middle" font-size="' +
          (Math.round(bs * 1.15 * 100) / 100) + '" fill="#fff">' + (f.bad ? "!" : "♥") + '</text></g>';
      }

      if(sel && inter){
        /* A constant size on screen, at every plant size and every zoom, with
           an invisible hit circle behind each — zoom is the real cure for a
           small target, this is the belt. */
        const gx = Canvas.gripAt(bed, rc);
        const br = Canvas.gripR(bed);
        const tap = Canvas.gripTap(bed);
        h += '<circle class="hitpad" data-grip="' + p.id + '" cx="' + gx + '" cy="' + gx +
             '" r="' + tap + '" fill="transparent"/>' +
             '<circle class="grip" data-grip="' + p.id + '" cx="' + gx + '" cy="' + gx +
             '" r="' + br + '" fill="#fff" stroke="#2a8c5e" stroke-width="' +
             (Math.round(br*0.22*100)/100) + '"/>';
        /* …and its twin bottom-left: everything about this plant — variety,
           how many, which packet, dates, notes. */
        h += '<circle class="hitpad" data-menu="' + p.id + '" cx="' + (-gx) + '" cy="' + gx +
             '" r="' + tap + '" fill="transparent"/>' +
             '<g class="pmenu" data-menu="' + p.id + '" transform="translate(' + (-gx) + ' ' + gx + ')">' +
             '<circle r="' + br + '" fill="#fff" stroke="#2a8c5e" stroke-width="' +
             (Math.round(br*0.22*100)/100) + '"/>' +
             '<text y="' + (Math.round(br*0.34*100)/100) + '" text-anchor="middle" font-size="' +
             (Math.round(br*1.25*100)/100) + '" fill="#2a8c5e" font-weight="700">⋯</text></g>';
      }
      h += '</g>';
    });
    h += '</g>';

    if(Canvas.wantLabels(bed)){
      h += '<g class="labels" pointer-events="none">';
      ps.forEach(p => {
        const rc = Geom.RC(p), rr = Geom.RR(p);
        const fs = clamp(Math.min(W, H) * 0.045, 2.1, 4.2) *
          (inter && typeof Zoom !== "undefined" ? Zoom.textScale() : 1);
        const grown = Math.max(0.18, PlantArt.sizeAt(PlantArt.growth(p, when)));
        const below = Math.max(rc * grown, Canvas.iconR(bed, rc, grown, rr) * PlantArt.R * 1.15);
        h += '<text x="' + (Math.round(Geom.PX(p)*10)/10) + '" y="' +
          (Math.round((Geom.PY(p) + below + fs * 1.5) * 10) / 10) +
          '" text-anchor="middle" font-size="' + (Math.round(fs*10)/10) +
          '" font-weight="700" fill="#fff" fill-opacity="0.92" stroke="#2b2118" stroke-width="' +
          (fs*0.24) + '" paint-order="stroke">' + esc(Canvas.label(p)) + '</text>';
      });
      h += '</g>';
    }

    h += '<g id="cvlive"></g>';        /* live drag feedback draws in here */
    h += '</svg>';
    return h;
  },

  /* The variety is the useful label once the icon has said what the crop is.
     "Mountain Fresh" tells you something "Tomato" does not, when the icon is
     already a tomato. */
  label(p){
    const v = String(p.variety || "").trim();
    return v || cropName(p.crop_id);
  },

  /* ---------- who is next to whom ---------- */
  flags(bedId){
    const ps = Geom.live(bedId), out = {};
    for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
      const a = ps[i], b = ps[j];
      if(a.crop_id === b.crop_id) continue;
      const rel = Geom.relation(a, b);
      if(!rel.near) continue;
      const r = pairRating(a.crop_id, b.crop_id);
      if(r.score <= -2){ (out[a.id] = out[a.id] || {}).bad = 1; (out[b.id] = out[b.id] || {}).bad = 1; }
      else if(r.score >= 1){ (out[a.id] = out[a.id] || {}).good = 1; (out[b.id] = out[b.id] || {}).good = 1; }
    }
    /* crowding is about roots, and is nobody's fault but the spacing */
    for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
      if(Geom.relation(ps[i], ps[j]).rootsClash){
        (out[ps[i].id] = out[ps[i].id] || {}).crowded = 1;
        (out[ps[j].id] = out[ps[j].id] || {}).crowded = 1;
      }
    }
    return out;
  },

  /* ---------- screen to garden ---------- */
  toIn(svgEl, clientX, clientY){
    const r = svgEl.getBoundingClientRect();
    const vb = (svgEl.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
    if(!r.width || !r.height) return { x: 0, y: 0 };
    return { x: vb[0] + (clientX - r.left) / r.width * vb[2],
             y: vb[1] + (clientY - r.top) / r.height * vb[3] };
  }
};

/* ============================================================
   PLACING — free, anywhere the outline allows
   ============================================================ */
Object.assign(Garden, {
  tl: 0,                 /* timeline offset in weeks */
  clip: null,            /* a copied planting waiting to be placed */
  sel: null,
  clearClip(){ Garden.clip = null; Garden.render(); },

  placeAt(bed, px, py, cropId, opts){
    const o = opts || {};
    bed = Geom.bed(bed);
    const mode = o.mode || "fill";
    let qty = o.qty !== undefined ? Math.max(1, num(o.qty, 1))
      : (mode === "single" ? 1
        : (o.w || o.h) ? Garden.fitPlants(cropId, bed, num(o.w, 1), num(o.h, 1))
        : Garden.fitPlants(cropId, bed, 1, 1));
    let rr = o.rr !== undefined ? num(o.rr) : Geom.rootR(cropId, qty);
    let rc = o.rc !== undefined ? num(o.rc) : Geom.canopyR(cropId, qty);
    /* a sprawl she recorded before is better evidence than the catalogue */
    if(!o.rc && mode === "single"){
      const obs = Garden.observedSpread(cropId);
      if(obs && obs.r) rc = Math.max(rc, obs.r);
    }
    if(num(bed.snap_in) > 0){
      px = Geom.snap(px, num(bed.snap_in));
      py = Geom.snap(py, num(bed.snap_in));
    }
    const fit = Geom.clampInto(bed, px, py, Math.min(rr, 2));
    const p = DB.insert("plantings", {
      bed_id: bed.id, crop_id: cropId, qty: qty, status:"planned", sown_on: iso(today()),
      span_mode: mode,
      px: Math.round(fit.x * 10) / 10, py: Math.round(fit.y * 10) / 10,
      rr: Math.round(rr * 10) / 10, rc: Math.round(Math.max(rr, rc) * 10) / 10,
      rot: Math.round(Math.random() * 40 - 20), sv: Math.floor(Math.random() * 100000),
      x: Math.floor(fit.x / Garden.cell(bed)), y: Math.floor(fit.y / Garden.cell(bed)),
      w: 1, h: 1
    });
    if(!o.silent) toast(cropName(cropId) + " planted");
    if(!o.noUndo) Undo.push("place", "Planted " + cropName(cropId), [{ id: p.id, created: true }]);
    Cal.forPlanting(p);
    return p;
  },

  /* the old signature still works — the assistant and the tests speak in squares */
  place(bed, x, y, cropId, silent, opts){
    const o = opts || {};
    const c = Garden.cell(bed);
    const w = num(o.w, 1), h = num(o.h, 1);
    return Garden.placeAt(bed, (num(x, 0) + w / 2) * c, (num(y, 0) + h / 2) * c, cropId,
      Object.assign({}, o, { silent: silent }));
  },

  /* what this crop has actually done in this garden, as a radius */
  observedSpread(cropId){
    const list = DB.where("plantings", p => p.crop_id === cropId && p.span_mode === "single")
      .map(Geom.plant).filter(p => Geom.RC(p) > Geom.canopyR(cropId, 1) * 1.15);
    if(!list.length) return null;
    let best = list[0];
    list.forEach(p => { if(Geom.RC(p) > Geom.RC(best)) best = p; });
    const r = Geom.RC(best);
    return { r: r, n: list.length, across: Math.round(r * 2),
             sqft: Math.round(Math.PI * r * r / 144 * 10) / 10,
             when: best.sown_on || String(best.created || "").slice(0, 10) };
  },

  /* ---------- resizing ---------- */
  setRadius(id, rc, rr){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const bed = Geom.bed(DB.find("beds", p.bed_id));
    const maxR = Math.max(Geom.W(bed), Geom.H(bed)) * 0.7;
    const nrc = clamp(num(rc, Geom.RC(p)), 1.5, maxR);
    const nrr = clamp(rr === undefined ? Geom.RR(p) : num(rr), 1, nrc);
    DB.update("plantings", id, { rr: Math.round(nrr*10)/10, rc: Math.round(nrc*10)/10 });
  },
  /* keep the plant count honest when the footprint changes */
  syncQty(id){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    if(p.span_mode === "single"){ DB.update("plantings", id, { qty: 1 }); return; }
    DB.update("plantings", id, { qty: Geom.fitsIn(p.crop_id, Geom.RR(p)) });
  },
  setMode(id, mode){
    DB.update("plantings", id, { span_mode: mode });
    Garden.syncQty(id);
    const p = DB.find("plantings", id);
    if(mode === "fill") Garden.setRadius(id, Geom.canopyR(p.crop_id, p.qty), Geom.rootR(p.crop_id, p.qty));
    Garden.plantingSheet(DB.find("plantings", id));
    Garden.render();
  },
  setQty(id, q){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const qty = Math.max(1, Math.round(num(q, 1)));
    DB.update("plantings", id, { qty: qty });
    if(p.span_mode !== "single")
      Garden.setRadius(id, Geom.canopyR(p.crop_id, qty), Geom.rootR(p.crop_id, qty));
  },

  /* the steppers still work; they just move inches now */
  resizeBy(id, dw, dh){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const step = (num(dw, 0) + num(dh, 0)) * Garden.cell(DB.find("beds", p.bed_id)) / 2;
    Garden.setRadius(id, Geom.RC(p) + step);
    Garden.plantingSheet(DB.find("plantings", id));
    Garden.render();
  },

  /* A removal is a soft delete — status goes to "removed" and the row stays —
     so putting one back is a matter of clearing two fields. That is what makes
     undo honest here rather than a re-creation that quietly loses the variety,
     the packet it came from and the date it went in. */
  removePlanting(id, silent, noUndo){
    const p = DB.find("plantings", id); if(!p) return;
    if(!noUndo) Undo.push("remove", "Removed " + cropName(p.crop_id),
      [{ id: id, status: p.status || "planned", removed_on: p.removed_on || null }]);
    DB.update("plantings", id, { status:"removed", removed_on: iso(today()) });
    DB.bulkRemove("events", e => e.planting_id === id && e.done !== "1");
    if(Garden.sel === id) Garden.sel = null;
    if(!silent){ closeSheet(); Garden.render(); toast("Removed", 3200); }
  },

  /* ---------- taps ---------- */
  tapAt(px, py){
    haptic();
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const ex = Garden.hit(bed.id, px, py);

    if(typeof Sel !== "undefined" && Sel.on){ if(ex) Sel.toggle(ex.id); return; }
    if(Garden.clip){ if(!ex) Garden.pasteAt(px, py); else toast("Something is already there"); return; }
    if(Garden.erase){ if(ex){ Garden.removePlanting(ex.id, true); Garden.render(); } return; }
    if(Garden.paint){ Garden.placeAt(bed, px, py, Garden.paint, { silent:true }); Garden.render(); return; }
    if(ex){
      /* Tapping a plant used to TOGGLE selection, and the details sheet only
         opened on the tap that selected. A freshly placed plant is already
         selected, so the very next tap deselected it and nothing opened —
         which is why the variety picker looked as though it had been removed.
         A tap on a plant always opens that plant. Bare soil deselects. */
      Garden.sel = ex.id;
      Garden.render();
      Garden.plantingSheet(ex);
      return;
    }
    Garden.sel = null;
    Garden.pickCropAt(px, py);
  },
  /* squares still map onto the canvas, for the assistant and old callers */
  tapCell(x, y){
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const c = Garden.cell(bed);
    Garden.tapAt((x + 0.5) * c, (y + 0.5) * c);
  },

  pickCropAt(px, py){
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    Garden.cropPicker("Plant here", id => {
      closeSheet();
      const obs = Garden.observedSpread(id);
      const p = Garden.placeAt(bed, px, py, id, obs ? { mode:"single", qty:1, rc: obs.r, silent:true } : { silent:true });
      Garden.sel = p.id;
      Garden.render();
      if(obs) toast("Sized to the " + obs.across + '" spread you recorded before');
      setTimeout(() => Garden.plantingSheet(DB.find("plantings", p.id)), 250);
    }, bed);
  },
  pickCrop(x, y){
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    const c = Garden.cell(bed);
    Garden.pickCropAt((num(x,0) + 0.5) * c, (num(y,0) + 0.5) * c);
  },

  pasteAt(px, py){
    const c = Garden.clip; if(!c) return;
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const p = Garden.placeAt(bed, px, py, c.crop_id, {
      mode: c.span_mode, qty: c.qty, rr: c.rr, rc: c.rc, silent: true });
    DB.update("plantings", p.id, { variety: c.variety, variety_id: c.variety_id,
      seed_id: c.seed_id, notes: c.notes, status: c.status, sown_on: c.sown_on });
    haptic(); Garden.render();
    toast(cropName(c.crop_id) + " added");
  },
  copyPlanting(id){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    Garden.clip = {
      crop_id: p.crop_id, variety: p.variety || null, variety_id: p.variety_id || null,
      rr: Geom.RR(p), rc: Geom.RC(p), span_mode: p.span_mode || "fill",
      qty: num(p.qty, 1), seed_id: p.seed_id || null, notes: p.notes || null,
      status: p.status || "planned", sown_on: p.sown_on || iso(today())
    };
    Garden.paint = null; Garden.erase = false; Garden.sel = null;
    closeSheet(); Garden.render();
    toast("Copied " + cropName(p.crop_id) + " — tap the bed to place more");
  },

  /* somewhere with room, searching outward from a point */
  freeSpot(bed, w, h, fromX, fromY){
    bed = Geom.bed(bed);
    const c = Garden.cell(bed);
    const r = Math.max(num(w, 1), num(h, 1)) * c / 2;
    const sx = fromX === undefined ? Geom.W(bed)/2 : (num(fromX) + 0.5) * c;
    const sy = fromY === undefined ? Geom.H(bed)/2 : (num(fromY) + 0.5) * c;
    const spot = Garden.openSpot(bed, r, sx, sy);
    return spot ? { x: Math.floor(spot.x / c), y: Math.floor(spot.y / c), px: spot.x, py: spot.y } : null;
  },
  openSpot(bed, radius, nearX, nearY, ignoreId){
    bed = Geom.bed(bed);
    const W = Geom.W(bed), H = Geom.H(bed);
    const nx = nearX === undefined ? W/2 : nearX, ny = nearY === undefined ? H/2 : nearY;
    const step = Math.max(2, Math.min(W, H) / 22);
    let best = null, bd = Infinity;
    for(let y = step/2; y < H; y += step) for(let x = step/2; x < W; x += step){
      if(!Geom.inside(bed, x, y, Math.min(radius, 2))) continue;
      const clash = Geom.live(bed.id).some(p => p.id !== ignoreId &&
        Math.hypot(Geom.PX(p) - x, Geom.PY(p) - y) < Geom.RR(p) + radius - 0.5);
      if(clash) continue;
      const d = Math.hypot(x - nx, y - ny);
      if(d < bd){ bd = d; best = { x: x, y: y }; }
    }
    return best;
  },
  duplicate(id){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const bed = Geom.bed(DB.find("beds", p.bed_id));
    const spot = Garden.openSpot(bed, Geom.RR(p), Geom.PX(p) + Geom.RC(p) * 2, Geom.PY(p));
    if(!spot) return toast("No free ground that size in this bed");
    const copy = DB.insert("plantings", {
      bed_id: bed.id, crop_id: p.crop_id, variety: p.variety, variety_id: p.variety_id,
      seed_id: p.seed_id, qty: p.qty, status: p.status, sown_on: p.sown_on, notes: p.notes,
      span_mode: p.span_mode, px: Math.round(spot.x*10)/10, py: Math.round(spot.y*10)/10,
      rr: Geom.RR(p), rc: Geom.RC(p),
      rot: Math.round(Math.random()*40 - 20), sv: Math.floor(Math.random()*100000),
      x: Math.floor(spot.x / Garden.cell(bed)), y: Math.floor(spot.y / Garden.cell(bed)), w:1, h:1
    });
    Cal.forPlanting(copy);
    Garden.sel = copy.id; closeSheet(); Garden.render();
    toast("Duplicated alongside");
  },

  /* the bed list preview is the same canvas, small and inert */
  miniGrid(b){
    return '<div class="canvaswrap" style="padding:5px;border-radius:14px;margin-top:8px">' +
      Canvas.svg(b, { interactive:false, pad: 3 }) + '</div>';
  }
});

/* ============================================================
   COMPANIONS ON A CANVAS
   Distance is now inches between centres, and "next to" means the
   canopies actually meet — which is what the gardening advice was
   always about, rather than how many squares apart two icons sat.
   ============================================================ */
function nearPairs(bedId, test){
  const ps = Geom.live(bedId), out = [];
  for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
    const a = ps[i], b = ps[j];
    if(a.crop_id === b.crop_id) continue;
    const rel = Geom.relation(a, b);
    if(!rel.near) continue;
    const r = pairRating(a.crop_id, b.crop_id);
    if(!test(r)) continue;
    out.push({ a: a, b: b, why: r.why, score: r.score, dist: rel.d, rel: rel });
  }
  return out;
}
Recommend.conflicts = bedId => nearPairs(bedId, r => r.score <= -2).sort((x, y) => x.dist - y.dist);
Recommend.friends   = bedId => nearPairs(bedId, r => r.score >= 1).sort((x, y) => y.score - x.score);

/* root zones that overlap — a spacing problem, not a companion one */
Recommend.crowding = function(bedId){
  const ps = Geom.live(bedId), out = [];
  for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
    const rel = Geom.relation(ps[i], ps[j]);
    if(rel.rootsClash) out.push({ a: ps[i], b: ps[j], overlap: Math.round(-rel.gap * 10) / 10 });
  }
  return out.sort((a, b) => b.overlap - a.overlap);
};

/* who is standing in whose light, at the date being previewed */
Recommend.shading = function(bedId, when){
  const ps = Geom.live(bedId), out = [];
  ps.forEach(tall => {
    if(!Geom.isTall(tall.crop_id)) return;
    if(PlantArt.growth(tall, when) < 0.35) return;
    ps.forEach(low => {
      if(low.id === tall.id || Geom.isTall(low.crop_id)) return;
      const d = Geom.dist(tall, low);
      if(d > Geom.RC(tall) + Geom.RC(low)) return;
      /* Shade under a tall crop is only a problem if the plant underneath
         cannot take it. Two things say it can: its own sun figure in the crop
         table, and the companion data — tomato over basil is the oldest
         recommendation in the book, and flagging it as a shading fault would
         have the app arguing with itself. */
      const r = pairRating(tall.crop_id, low.crop_id);
      const north = Geom.PY(low) < Geom.PY(tall);
      out.push({ tall: tall, low: low, dist: Math.round(d*10)/10,
                 ok: Geom.shadeOk(low.crop_id) || r.score >= 1,
                 companion: r.score >= 1, north: north });
    });
  });
  return out;
};
</script>
