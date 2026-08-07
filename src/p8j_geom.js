<script>
/* ============================================================
   BED GEOMETRY — the canvas underneath everything

   The grid had to go. Nothing in a garden grows in a box: leaves
   weave together overhead while roots keep their distance below,
   and a rigid lattice can express neither. Making the squares
   smaller would only have made the lattice finer.

   So a bed is now an OUTLINE measured in inches, and a planting is
   a POINT in that outline carrying two radii — the root zone it
   needs to itself, and the canopy it will throw once mature.
   Overlapping canopies are normal and drawn as such. Overlapping
   root zones are the thing worth warning about.

   The square-foot grid survives as an optional overlay and a
   snapping step, because plenty of people do plant in rows and
   the method is a good one. It is a preference now, not the model.
   ============================================================ */

const Geom = (() => {

  /* ---------- shapes ---------- */
  const SHAPES = {
    rect:    { n:"Rectangle",  e:"▭", d:"Raised beds, borders, rows" },
    round:   { n:"Rounded",    e:"▢", d:"A rectangle with soft corners" },
    circle:  { n:"Circle",     e:"◯", d:"Round beds, half-barrels, pots" },
    ellipse: { n:"Oval",       e:"⬭", d:"Island beds" },
    tri:     { n:"Triangle",   e:"△", d:"Corners — butt two together for a diamond" },
    trap:    { n:"Trapezoid",  e:"⏢", d:"Tapered ends, keyhole beds" },
    hex:     { n:"Hexagon",    e:"⬡", d:"Tiles against its neighbours with no waste" },
    ell:     { n:"L-shape",    e:"⌐", d:"Wraps a corner" },
    poly:    { n:"Draw it",    e:"✎", d:"Trace your own outline, corner by corner" },
    group:   { n:"Pots & planters", e:"⁙", d:"Several separate containers treated as one space" }
  };

  /* every preset is a normalised outline, 0..1, y downward */
  function outline(shape){
    switch(shape){
      case "tri":  return [[0.5,0],[1,1],[0,1]];
      case "trap": return [[0.24,0],[0.76,0],[1,1],[0,1]];
      case "hex":  return [[0.25,0],[0.75,0],[1,0.5],[0.75,1],[0.25,1],[0,0.5]];
      case "ell":  return [[0,0],[0.46,0],[0.46,0.54],[1,0.54],[1,1],[0,1]];
      default:     return [[0,0],[1,0],[1,1],[0,1]];
    }
  }
  const isRound = s => s === "circle" || s === "ellipse";

  /* ---------- lazy migration ----------
     A bed built before the canvas describes itself as cols × rows of
     cell_in squares. That is a rectangle in inches and converts exactly,
     so it is done on read rather than in a migration pass that could
     half-finish. Idempotent: once w_in is set it never runs again. */
  function bed(b){
    if(!b) return null;
    if(b.w_in === null || b.w_in === undefined || b.w_in === ""){
      const cell = num(b.cell_in, 12);
      DB.update("beds", b.id, {
        shape: b.shape || "rect",
        w_in: Math.max(6, num(b.cols, 4) * cell),
        h_in: Math.max(6, num(b.rows, 4) * cell),
        grid_on: b.grid_on === undefined || b.grid_on === null ? 0 : b.grid_on,
        snap_in: num(b.snap_in, 0)
      });
      b = DB.find("beds", b.id);
    }
    return b;
  }

  /* A traced outline is a JSON string on disk so the vault and the .sqlite
     export stay real. It is parsed on demand and memoised against the raw
     string — NEVER written back onto the row. Anything stashed on a cached
     row ends up serialised into the gardener's backup and, worse, stringified
     into the SQL export as "0,0,1,0,…". */
  let polyMemo = { src: null, val: null };
  function polyOf(b){
    const raw = b.poly;
    if(!raw) return null;
    if(Array.isArray(raw)) return raw;
    if(polyMemo.src === raw) return polyMemo.val;
    let val = null;
    try{ val = JSON.parse(raw); }catch(e){ val = null; }
    polyMemo = { src: raw, val: val };
    return val;
  }
  function savePoly(bedId, pts){
    DB.update("beds", bedId, { poly: JSON.stringify(pts), shape:"poly" });
    polyMemo = { src: null, val: null };
  }

  /* ============================================================
     A BED MADE OF SEVERAL SHAPES

     Plenty of gardens are not one outline. A row of pots along a
     wall, three half-barrels, a shelf of window boxes — each is its
     own pocket of soil, and asking someone to create fifteen beds
     called "Pot 1".."Pot 15" is a filing system, not a garden.

     So a bed may carry `parts`: a list of sub-shapes in inches,
     each an independent container. Everything that used to ask
     "is this point in the bed" now asks "is it in ANY part", and
     everything that measured the bed sums the parts. A normal bed
     is simply a bed with one part, so there is a single code path
     rather than two models to keep in agreement.

     Stored as a JSON string, parsed on demand and memoised against
     the raw string, NEVER written back onto the row — the same
     hazard polyOf warns about. */
  let partMemo = { src: null, val: null };
  function partsOf(b){
    const raw = b && b.parts;
    if(!raw) return null;
    if(Array.isArray(raw)) return raw;
    if(partMemo.src === raw) return partMemo.val;
    let val = null;
    try{ val = JSON.parse(raw); }catch(e){ val = null; }
    if(!Array.isArray(val) || !val.length) val = null;
    partMemo = { src: raw, val: val };
    return val;
  }
  function saveParts(bedId, list, wIn, hIn){
    DB.update("beds", bedId, {
      parts: JSON.stringify(list), shape: "group",
      w_in: Math.max(6, Math.round(wIn)), h_in: Math.max(6, Math.round(hIn))
    });
    partMemo = { src: null, val: null };
  }
  const isGroup = b => (bed(b) || {}).shape === "group" && !!partsOf(bed(b));

  /* one sub-shape as an absolute polygon in inches */
  function partPoly(p){
    const x = num(p.x, 0), y = num(p.y, 0);
    const w = Math.max(1, num(p.w, 12)), h = Math.max(1, num(p.h, 12));
    const s = p.s || "rect";
    if(s === "circle" || s === "ellipse"){
      const out = [];
      for(let i = 0; i < 40; i++){
        const t = i / 40 * Math.PI * 2;
        out.push([x + w/2 + w/2 * Math.cos(t), y + h/2 + h/2 * Math.sin(t)]);
      }
      return out;
    }
    return outline(s).map(q => [x + q[0] * w, y + q[1] * h]);
  }

  const W = b => Math.max(6, num(bed(b).w_in, 48));
  const H = b => Math.max(6, num(bed(b).h_in, 48));
  const shape = b => bed(b).shape || "rect";

  /* absolute outline in inches */
  function pts(b){
    const w = W(b), h = H(b), s = shape(b);
    const bb = bed(b);
    const pl = polyOf(bb);
    if(s === "poly" && Array.isArray(pl) && pl.length >= 3)
      return pl.map(p => [num(p[0]) * w, num(p[1]) * h]);
    if(isRound(s)){
      /* an ellipse sampled finely enough that the polygon maths below
         works on it too — one containment routine, not two */
      const out = [];
      for(let i = 0; i < 48; i++){
        const t = i / 48 * Math.PI * 2;
        out.push([w/2 + w/2 * Math.cos(t), h/2 + h/2 * Math.sin(t)]);
      }
      return out;
    }
    return outline(s).map(p => [p[0] * w, p[1] * h]);
  }

  /* every outline this bed is made of. A normal bed has exactly one. */
  function parts(b){
    const bb = bed(b);
    if(!isGroup(bb)) return [pts(bb)];
    return partsOf(bb).map(partPoly);
  }
  /* the raw sub-shape records, for the editor */
  function partList(b){ const bb = bed(b); return isGroup(bb) ? partsOf(bb) : null; }

  /* ---------- containment ---------- */
  function inPoly(poly, x, y){
    let inside = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }
  function segDist(x, y, ax, ay, bx, by){
    const dx = bx - ax, dy = by - ay;
    const L = dx*dx + dy*dy;
    let t = L ? ((x - ax) * dx + (y - ay) * dy) / L : 0;
    t = clamp(t, 0, 1);
    const px = ax + t*dx, py = ay + t*dy;
    return Math.sqrt((x-px)*(x-px) + (y-py)*(y-py));
  }
  function edgeDist(poly, x, y){
    let m = Infinity;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      m = Math.min(m, segDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    return m;
  }
  /* inside ANY part, and at least `margin` inches clear of that part's edges.
     A pot is a pot: a plant may not straddle the gap between two of them. */
  function inside(b, x, y, margin){
    return parts(b).some(P => inPoly(P, x, y) && (!margin || edgeDist(P, x, y) >= margin));
  }
  function polyCentroid(P){
    let a = 0, cx = 0, cy = 0;
    for(let i = 0, j = P.length - 1; i < P.length; j = i++){
      const f = P[j][0]*P[i][1] - P[i][0]*P[j][1];
      a += f; cx += (P[j][0] + P[i][0]) * f; cy += (P[j][1] + P[i][1]) * f;
    }
    if(Math.abs(a) < 1e-6) return null;
    return { x: cx / (3*a), y: cy / (3*a), a: Math.abs(a / 2) };
  }
  function centroid(b){
    /* the biggest part, so "the middle of the bed" is somewhere a plant can
       actually go rather than the empty air between two pots */
    let best = null;
    parts(b).forEach(P => { const c = polyCentroid(P); if(c && (!best || c.a > best.a)) best = c; });
    return best || { x: W(b)/2, y: H(b)/2 };
  }
  /* the part a point belongs to, or the nearest one to fall back into */
  function nearestPart(b, x, y, margin){
    const ps = parts(b);
    let hit = null, best = null, bd = Infinity;
    ps.forEach(P => {
      if(inPoly(P, x, y) && (!margin || edgeDist(P, x, y) >= margin)) hit = hit || P;
      const c = polyCentroid(P); if(!c) return;
      const d = Math.hypot(c.x - x, c.y - y);
      if(d < bd){ bd = d; best = P; }
    });
    return hit || best || ps[0];
  }
  /* pull a point back inside — walk it toward the centre until it fits */
  function clampInto(b, x, y, margin){
    if(inside(b, x, y, margin)) return { x: x, y: y };
    /* pull it into the container it was dropped nearest, not toward the bed's
       overall middle — on a row of pots that middle is usually bare bench */
    const pc = polyCentroid(nearestPart(b, x, y, margin));
    const c = pc || centroid(b);
    let lo = 0, hi = 1;
    if(!inside(b, c.x, c.y, margin)){
      /* the bed is too small for this plant at all — centre it and let the
         caller warn, rather than silently refusing the drop */
      return { x: c.x, y: c.y, tight: true };
    }
    for(let i = 0; i < 22; i++){
      const t = (lo + hi) / 2;
      const px = c.x + (x - c.x) * t, py = c.y + (y - c.y) * t;
      if(inside(b, px, py, margin)) lo = t; else hi = t;
    }
    return { x: c.x + (x - c.x) * lo, y: c.y + (y - c.y) * lo, clamped: true };
  }

  /* growing space is the sum of the containers, not the rectangle they sit in */
  function areaSqIn(b){
    return parts(b).reduce((sum, P) => {
      let a = 0;
      for(let i = 0, j = P.length - 1; i < P.length; j = i++)
        a += P[j][0]*P[i][1] - P[i][0]*P[j][1];
      return sum + Math.abs(a / 2);
    }, 0);
  }
  const areaSqFt = b => Math.round(areaSqIn(b) / 144 * 10) / 10;

  function svgPath(b){
    const s = shape(b);
    if(isRound(s)) return null;                       /* drawn as an <ellipse> */
    /* a group is one compound path of disjoint subpaths, so a single element
       still carries the whole bed and every clip and fill keeps working */
    return parts(b).map(P =>
      "M" + P.map(p => (Math.round(p[0]*10)/10) + " " + (Math.round(p[1]*10)/10)).join("L") + "Z"
    ).join(" ");
  }

  /* ============================================================
     PLANT FOOTPRINTS

     Root radius is half the crop's own in-row spacing, which is what
     that number has always meant: two plants are correctly spaced
     when their root circles touch. A clump of several plants sharing
     one spot needs the area to scale with the count, so the radius
     scales with its square root.

     Canopy is the mature foliage spread. It is not in the crop table,
     so it comes from growth habit — a cucumber sprawls over twice its
     root zone, an onion barely covers its own.
     ============================================================ */
  const SPREAD = {
    cucurbit:2.10, solanaceae:1.35, legume:1.20, brassica:1.30, aster:1.15,
    apiaceae:1.00, chenopod:1.15, allium:0.80, poaceae:0.95, lamiaceae:1.30,
    malvaceae:1.20, convolvulaceae:1.80, polygonaceae:1.10, rosaceae:1.20,
    asparagaceae:1.30, tropaeolaceae:1.60, boraginaceae:1.40
  };
  /* mature height in inches — what decides who shades whom */
  const HEIGHT = {
    corn:84, polebean:78, pea:54, sunflower:96, okra:60, tomato:56, asparagus:60,
    eggplant:32, pepper:30, hotpepper:30, tomatillo:48, potato:30, bushbean:22,
    zucchini:26, cucumber:16, wintersquash:16, pumpkin:16, melon:14, watermelon:14,
    kale:28, broccoli:26, cauliflower:24, cabbage:16, brussels:32, chard:20,
    lettuce:9, spinach:8, arugula:8, radish:7, carrot:11, beet:12, turnip:12,
    onion:16, garlic:20, leek:22, chive:12, basil:20, parsley:12, cilantro:14, dill:36
  };
  const HEIGHT_FAM = { poaceae:80, solanaceae:40, legume:30, cucurbit:16, brassica:24,
                       aster:12, apiaceae:14, allium:18, chenopod:16, lamiaceae:18 };

  function rootR(cropId, qty){
    const c = crop(cropId);
    const sp = c ? num(c.sp, 12) : 12;
    return Math.round(sp / 2 * Math.sqrt(Math.max(1, num(qty, 1))) * 10) / 10;
  }
  function canopyR(cropId, qty){
    const c = crop(cropId);
    const k = (c && SPREAD[c.fam]) || 1.2;
    return Math.round(rootR(cropId, qty) * k * 10) / 10;
  }
  function height(cropId){
    if(HEIGHT[cropId] !== undefined) return HEIGHT[cropId];
    const c = crop(cropId);
    return (c && HEIGHT_FAM[c.fam]) || 18;
  }
  const isTall = id => height(id) >= 44;
  /* a crop that genuinely produces in shade, per the crop table's own figure */
  const shadeOk = id => { const c = crop(id); return !!c && num(c.sun, 8) <= 5; };

  /* how many plants that footprint can honestly hold */
  function fitsIn(cropId, r){
    const c = crop(cropId); if(!c) return 1;
    const sq = Math.PI * r * r / 144;
    return Math.max(1, Math.round(num(c.psf, 1) * sq));
  }

  /* ---------- lazy migration of a planting ----------
     The old model gave a rectangle of cells. Its centre becomes the
     plant's position and its size is preserved as canopy, so a cucumber
     someone recorded sprawling over six square feet still shows sprawling
     over six square feet. */
  function plant(p){
    if(!p) return null;
    if(p.px !== null && p.px !== undefined && p.px !== "") return p;
    const b = DB.find("beds", p.bed_id);
    const cell = b ? num(b.cell_in, 12) : 12;
    const w = clamp(num(p.w, 1) || 1, 1, 40), h = clamp(num(p.h, 1) || 1, 1, 40);
    const px = (num(p.x, 0) + w / 2) * cell;
    const py = (num(p.y, 0) + h / 2) * cell;
    const qty = Math.max(1, num(p.qty, 1));
    let rr = rootR(p.crop_id, p.span_mode === "single" ? 1 : qty);
    let rc = canopyR(p.crop_id, p.span_mode === "single" ? 1 : qty);
    if(p.span_mode === "single" && (w > 1 || h > 1)){
      /* a sprawl she recorded herself outranks the catalogue */
      rc = Math.max(rc, Math.sqrt((w*cell)*(w*cell) + (h*cell)*(h*cell)) / 2);
    }
    DB.update("plantings", p.id, {
      px: Math.round(px * 10) / 10, py: Math.round(py * 10) / 10,
      rr: rr, rc: Math.round(Math.max(rr, rc) * 10) / 10,
      rot: Math.round((hash(p.id) % 41) - 20),
      sv: hash(p.id + "v") % 100000
    });
    return DB.find("plantings", p.id);
  }
  function hash(s){
    let h = 2166136261 >>> 0;
    s = String(s);
    for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /* every live planting in a bed, migrated */
  function live(bedId){
    return DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed").map(plant);
  }
  const PX = p => num(plant(p).px, 0);
  const PY = p => num(plant(p).py, 0);
  const RR = p => Math.max(1, num(plant(p).rr, 6));
  const RC = p => Math.max(RR(p), num(plant(p).rc, 8));
  function dist(a, b){
    const dx = PX(a) - PX(b), dy = PY(a) - PY(b);
    return Math.sqrt(dx*dx + dy*dy);
  }
  /* How close counts as "next to"? Companion advice is about plants sharing
     ground, so: their leaves meet, or there is under a foot of clear soil
     between their root zones. One definition, used everywhere — the bed view,
     the drag overlay and the planting sheet must never disagree. */
  const NEAR_GAP = 12;
  function relation(a, b){
    const d = dist(a, b);
    const gap = d - RR(a) - RR(b);
    return {
      d: Math.round(d * 10) / 10,
      rootsClash: d < RR(a) + RR(b) - 0.5,
      canopyTouch: d < RC(a) + RC(b),
      near: d < RC(a) + RC(b) || gap <= NEAR_GAP,
      gap: Math.round(gap * 10) / 10,
      /* one sitting inside the other's shade, which is a guild if the
         understorey crop actually wants it and a mistake if it does not */
      under: d < Math.max(RC(a), RC(b)) &&
             ((isTall(a.crop_id) && !isTall(b.crop_id)) || (isTall(b.crop_id) && !isTall(a.crop_id)))
    };
  }

  /* ---------- snapping ----------
     Corner to corner between beds, and vertex to vertex while drawing.
     A snap that only ever lines up to an invisible lattice is no use for
     butting two real beds together. */
  function snap(v, step){ return step > 0 ? Math.round(v / step) * step : v; }
  function nearest(x, y, cands, tol){
    let best = null, bd = tol;
    (cands || []).forEach(c => {
      const d = Math.sqrt((x - c[0])*(x - c[0]) + (y - c[1])*(y - c[1]));
      if(d <= bd){ bd = d; best = c; }
    });
    return best;
  }
  /* the corners of a bed as it sits on the plot map, in feet */
  function cornersFt(b){
    const bb = bed(b);
    const w = W(bb) / 12, h = H(bb) / 12;
    const rot = num(bb.rot) === 90;
    const ox = num(bb.mx, 0), oy = num(bb.my, 0);
    return pts(bb).map(p => {
      let px = p[0] / 12, py = p[1] / 12;
      if(rot){ const t = px; px = h - py; py = t; }
      return [ox + px, oy + py];
    });
  }
  function footprintFt(b){
    const bb = bed(b);
    const w = W(bb) / 12, h = H(bb) / 12;
    return num(bb.rot) === 90 ? { w: h, h: w } : { w: w, h: h };
  }

  return {
    SHAPES: SHAPES, SPREAD: SPREAD, HEIGHT: HEIGHT,
    outline: outline, isRound: isRound, bed: bed, savePoly: savePoly, polyOf: polyOf,
    parts: parts, partList: partList, partsOf: partsOf, saveParts: saveParts,
    isGroup: isGroup, partPoly: partPoly, nearestPart: nearestPart, polyCentroid: polyCentroid,
    W: W, H: H, shape: shape, pts: pts, svgPath: svgPath,
    inPoly: inPoly, inside: inside, centroid: centroid, clampInto: clampInto,
    edgeDist: edgeDist, segDist: segDist,
    areaSqIn: areaSqIn, areaSqFt: areaSqFt,
    rootR: rootR, canopyR: canopyR, height: height, isTall: isTall, shadeOk: shadeOk,
    fitsIn: fitsIn, plant: plant, live: live, hash: hash,
    PX: PX, PY: PY, RR: RR, RC: RC, dist: dist, relation: relation,
    snap: snap, nearest: nearest, cornersFt: cornersFt, footprintFt: footprintFt,
    NEAR_GAP: NEAR_GAP, near(a, b){ return relation(a, b).near; },

    /* one pass so the SQL console and exports are never half-converted */
    migrateAll(){
      DB.all("beds").forEach(bed);
      DB.all("plantings").forEach(plant);
    }
  };
})();

/* ============================================================
   THE OLD GRID API, NOW A VIEW OF THE CANVAS

   Plenty of the app — and the assistant's own tools — still speak in
   squares. Rather than run two models side by side, these read the
   canvas and answer in cells. There is one source of truth.
   ============================================================ */
Object.assign(Garden, {
  live(bedId){ return Geom.live(bedId); },
  cell(bed){ return num(Geom.bed(bed).cell_in, 12) || 12; },

  W(p){ return Math.max(1, Math.round(Geom.RC(p) * 2 / Garden.cell(DB.find("beds", p.bed_id) || {}))); },
  H(p){ return Garden.W(p); },

  /* does this plant's canopy fall over that square? */
  covers(p, x, y){
    const b = DB.find("beds", p.bed_id); if(!b) return false;
    const c = Garden.cell(b);
    const cx = (x + 0.5) * c, cy = (y + 0.5) * c;
    const dx = Geom.PX(p) - cx, dy = Geom.PY(p) - cy;
    return Math.sqrt(dx*dx + dy*dy) <= Geom.RC(p) + c * 0.2;
  },
  at(bedId, x, y){
    const list = Geom.live(bedId).filter(p => Garden.covers(p, x, y));
    if(!list.length) return null;
    const b = DB.find("beds", bedId), c = Garden.cell(b);
    const cx = (x + 0.5) * c, cy = (y + 0.5) * c;
    list.sort((a, z) => (Math.hypot(Geom.PX(a)-cx, Geom.PY(a)-cy) - Geom.RR(a)) -
                        (Math.hypot(Geom.PX(z)-cx, Geom.PY(z)-cy) - Geom.RR(z)));
    return list[0];
  },
  /* nearest plant to a point in inches, preferring one you actually hit */
  hit(bedId, ix, iy){
    let best = null, bd = Infinity;
    Geom.live(bedId).forEach(p => {
      const d = Math.hypot(Geom.PX(p) - ix, Geom.PY(p) - iy);
      const slack = d - Geom.RC(p);
      if(d <= Geom.RC(p) + 3 && slack < bd){ bd = slack; best = p; }
    });
    return best;
  },

  sqFt(bed, w, h){ const c = Garden.cell(bed) / 12; return w * h * c * c; },
  bedSqFt(bed){ return Geom.areaSqFt(bed); },

  /* would a plant of this footprint sit badly here? */
  blocked(bed, x, y, w, h, ignoreId){
    const c = Garden.cell(bed);
    const px = (num(x) + num(w, 1) / 2) * c, py = (num(y) + num(h, 1) / 2) * c;
    const r = Math.max(num(w, 1), num(h, 1)) * c / 2;
    if(!Geom.inside(bed, px, py, Math.min(r, 1))) return "outside";
    const hit = Geom.live(bed.id).find(p => p.id !== ignoreId &&
      Math.hypot(Geom.PX(p) - px, Geom.PY(p) - py) < Geom.RR(p) + r - 0.5);
    return hit || null;
  },

  fitPlants(cropId, bed, w, h){
    const c = crop(cropId); if(!c) return 1;
    return Math.max(1, Math.round(num(c.psf, 1) * Garden.sqFt(bed, w, h)));
  }
});
</script>
