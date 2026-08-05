<script>
/* ============================================================
   DRAGGING ON THE CANVAS

   Two gestures, both on the same SVG:

   · press and hold a plant to lift it and move it anywhere. Not a
     bare drag — on a phone a bare drag competes with scrolling and
     the browser wins.
   · drag the white handle on a selected plant to resize what it
     will grow into.

   The point of doing this live is the feedback. Companion advice
   that only appears after you have committed to a spot is advice
   you have to undo. While the plant is in your hand every
   neighbour it comes near lights up — a heart for a pairing worth
   having, a warning for one worth avoiding, an amber ring where
   two root zones have started to fight over the same water.
   ============================================================ */

const CanvasDrag = {
  magnet: true,
  active: null,

  bind(){
    const svg = $("#pcanvas"); if(!svg) return;
    if(svg._bound) return;
    svg._bound = true;
    svg.addEventListener("pointerdown", CanvasDrag.down);
    svg.addEventListener("contextmenu", e => e.preventDefault());
  },

  /* ---------- shared helpers ---------- */
  bed(){ return Geom.bed(DB.find("beds", APP.bedId)); },
  at(ev){ return Canvas.toIn($("#pcanvas"), ev.clientX, ev.clientY); },
  live(html){ const g = $("#cvlive"); if(g) g.innerHTML = html || ""; },

  down(ev){
    if(ev.button !== undefined && ev.button > 0) return;
    const svg = $("#pcanvas"); if(!svg) return;
    const grip = ev.target && ev.target.closest && ev.target.closest("[data-grip]");
    if(grip) return CanvasDrag.resizeStart(ev, grip.getAttribute("data-grip"));
    const el = ev.target && ev.target.closest && ev.target.closest(".pl");
    if(el && !Garden.erase && !Garden.paint && !Garden.clip)
      return CanvasDrag.moveStart(ev, el.getAttribute("data-pid"), el);
    CanvasDrag.tapStart(ev);
  },

  /* ---------- a plain tap on soil or on a plant ---------- */
  tapStart(ev){
    const sx = ev.clientX, sy = ev.clientY;
    let moved = false;
    const move = e => { if(Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true; };
    const up = e => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if(moved) return;
      const pt = Canvas.toIn($("#pcanvas"), e.clientX, e.clientY);
      const bed = CanvasDrag.bed();
      if(!bed) return;
      /* a tap outside the outline is a miss, not a plant in the path */
      if(!Geom.inside(bed, pt.x, pt.y, 0) && !Garden.hit(bed.id, pt.x, pt.y)){
        if(Garden.sel){ Garden.sel = null; Garden.render(); }
        return;
      }
      Garden.tapAt(pt.x, pt.y);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  },

  /* ============================================================
     MOVING A PLANT
     ============================================================ */
  moveStart(ev, id, el){
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const bed = CanvasDrag.bed(); if(!bed) return;
    const svg = $("#pcanvas");
    const start = CanvasDrag.at(ev);
    const ox = Geom.PX(p), oy = Geom.PY(p);
    const touch = ev.pointerType === "touch" || ev.pointerType === "pen";
    let lifted = false, dead = false, far = 0, pos = { x: ox, y: oy };

    const blockScroll = e => { if(lifted && e.cancelable) e.preventDefault(); };
    document.addEventListener("touchmove", blockScroll, { passive:false });

    const lift = () => {
      if(dead || lifted) return;
      lifted = true;
      CanvasDrag.active = id;
      svg.classList.add("dragging");
      el.classList.add("sel");
      el.setAttribute("opacity", "0.9");
      haptic();
    };
    const timer = setTimeout(lift, 190);

    const move = e => {
      if(!lifted){
        const dx = Math.abs(e.clientX - ev.clientX), dy = Math.abs(e.clientY - ev.clientY);
        if(dx < 6 && dy < 6) return;
        /* a mostly-vertical swipe on a touchscreen is the page scrolling,
           and taking it away would trap her on this screen */
        if(touch && dy > dx * 1.4){ dead = true; clearTimeout(timer); finish(false); return; }
        clearTimeout(timer); lift();
        if(!lifted) return;
      }
      if(e.cancelable) e.preventDefault();
      far = Math.max(far, Math.abs(e.clientX - ev.clientX), Math.abs(e.clientY - ev.clientY));
      const now = CanvasDrag.at(e);
      pos = CanvasDrag.settle(bed, p, ox + (now.x - start.x), oy + (now.y - start.y));
      el.setAttribute("transform", "translate(" + (Math.round(pos.x*10)/10) + " " + (Math.round(pos.y*10)/10) + ")");
      CanvasDrag.live(CanvasDrag.feedback(bed, p, pos));
    };

    let done = false;
    const finish = drop => {
      if(done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("touchmove", blockScroll);
      svg.classList.remove("dragging");
      el.removeAttribute("opacity");
      CanvasDrag.active = null;
      CanvasDrag.live("");
      if(!drop || !lifted){ if(!lifted && far < 8) Garden.tapAt(start.x, start.y); return; }
      DB.update("plantings", id, { px: Math.round(pos.x*10)/10, py: Math.round(pos.y*10)/10,
        x: Math.floor(pos.x / Garden.cell(bed)), y: Math.floor(pos.y / Garden.cell(bed)) });
      Garden.sel = id;
      Garden.render();
      const msg = CanvasDrag.verdict(bed, DB.find("plantings", id));
      toast(msg || (cropName(p.crop_id) + " moved"));
    };
    const onUp = () => finish(true);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  },

  /* keep it inside the bed, honour the grid if it is on, and let a good
     companion pull it gently into place */
  settle(bed, p, x, y){
    const rr = Geom.RR(p);
    if(CanvasDrag.magnet){
      const pull = CanvasDrag.pullTo(bed, p, x, y);
      if(pull){ x = pull.x; y = pull.y; }
    }
    if(num(bed.snap_in) > 0){
      x = Geom.snap(x, num(bed.snap_in));
      y = Geom.snap(y, num(bed.snap_in));
    }
    const fit = Geom.clampInto(bed, x, y, Math.min(rr, 2));
    return { x: fit.x, y: fit.y };
  },

  /* companion magnetism: nudge toward the distance the two actually want,
     rather than refusing to let them near each other */
  pullTo(bed, p, x, y){
    let best = null, bd = Infinity;
    Geom.live(bed.id).forEach(o => {
      if(o.id === p.id || o.crop_id === p.crop_id) return;
      const r = pairRating(p.crop_id, o.crop_id);
      if(r.score < 1) return;
      const ox = Geom.PX(o), oy = Geom.PY(o);
      const d = Math.hypot(x - ox, y - oy);
      const ideal = Geom.RR(p) + Geom.RR(o) + 1.5;
      if(Math.abs(d - ideal) > Math.max(4, ideal * 0.45)) return;
      if(Math.abs(d - ideal) < bd){ bd = Math.abs(d - ideal); best = { o: o, ideal: ideal, d: d, ox: ox, oy: oy }; }
    });
    if(!best) return null;
    if(best.d < 0.01) return null;
    const t = best.ideal / best.d;
    return { x: best.ox + (x - best.ox) * t, y: best.oy + (y - best.oy) * t };
  },

  /* ---------- the live overlay ---------- */
  feedback(bed, p, pos){
    const rcP = Geom.RC(p), rrP = Geom.RR(p);
    let out = '';
    let anyBad = false;
    Geom.live(bed.id).forEach(o => {
      if(o.id === p.id) return;
      const ox = Geom.PX(o), oy = Geom.PY(o);
      const d = Math.hypot(pos.x - ox, pos.y - oy);
      const touch = d < rcP + Geom.RC(o);
      const clash = d < rrP + Geom.RR(o) - 0.5;
      if(!touch && d - rrP - Geom.RR(o) > Geom.NEAR_GAP) return;
      let kind = null;
      if(o.crop_id !== p.crop_id){
        const r = pairRating(p.crop_id, o.crop_id);
        if(r.score <= -2) kind = "bad";
        else if(r.score >= 1) kind = "good";
      }
      if(!kind && clash) kind = "crowd";
      if(!kind) return;
      if(kind === "bad") anyBad = true;
      const col = kind === "bad" ? "#c9453c" : kind === "good" ? "#2a8c5e" : "#d98324";
      const sym = kind === "bad" ? "!" : kind === "good" ? "♥" : "⊙";
      out += '<path d="M' + (Math.round(pos.x*10)/10) + ' ' + (Math.round(pos.y*10)/10) + 'L' +
             (Math.round(ox*10)/10) + ' ' + (Math.round(oy*10)/10) + '" stroke="' + col +
             '" stroke-width="0.5" stroke-dasharray="1.4 1.2" stroke-opacity="0.9"/>';
      const mx = (pos.x + ox) / 2, my = (pos.y + oy) / 2;
      const bs = Math.max(2.4, Math.min(Geom.W(bed), Geom.H(bed)) * 0.035);
      out += '<g transform="translate(' + (Math.round(mx*10)/10) + ' ' + (Math.round(my*10)/10) + ')">' +
        '<circle r="' + bs + '" fill="' + col + '"/>' +
        '<text y="' + (bs*0.38) + '" text-anchor="middle" font-size="' + (bs*1.2) + '" fill="#fff">' + sym + '</text></g>';
      if(clash)
        out += '<circle cx="' + (Math.round(ox*10)/10) + '" cy="' + (Math.round(oy*10)/10) + '" r="' +
               (Math.round(Geom.RR(o)*10)/10) + '" fill="none" stroke="#d98324" stroke-width="0.4" stroke-opacity="0.9"/>';
      /* a guild worth pointing out: shade-lover settling under something tall */
      if(kind !== "bad" && Geom.isTall(o.crop_id) && Geom.shadeOk(p.crop_id) && d < Geom.RC(o))
        out += '<circle cx="' + (Math.round(ox*10)/10) + '" cy="' + (Math.round(oy*10)/10) + '" r="' +
               (Math.round(Geom.RC(o)*10)/10) + '" fill="#2a8c5e" fill-opacity="0.18" stroke="#2a8c5e" stroke-width="0.4"/>';
    });
    /* where it will actually land */
    out += '<circle cx="' + (Math.round(pos.x*10)/10) + '" cy="' + (Math.round(pos.y*10)/10) + '" r="' +
           (Math.round(rrP*10)/10) + '" fill="none" stroke="' + (anyBad ? "#c9453c" : "#f7f3ea") +
           '" stroke-width="0.45" stroke-opacity="0.95"/>';
    return out;
  },

  /* one honest sentence about where it ended up */
  verdict(bed, p){
    if(!p) return null;
    let bad = null, good = null, crowd = null;
    Geom.live(bed.id).forEach(o => {
      if(o.id === p.id) return;
      const rel = Geom.relation(p, o);
      if(!rel.near) return;
      if(rel.rootsClash && !crowd) crowd = o;
      if(o.crop_id === p.crop_id) return;
      const r = pairRating(p.crop_id, o.crop_id);
      if(r.score <= -2 && !bad) bad = o;
      else if(r.score >= 1 && !good) good = o;
    });
    if(bad) return "⚠️ Now next to " + cropName(bad.crop_id) + " — they do not get on";
    if(crowd) return "⊙ Root zones overlap with " + cropName(crowd.crop_id);
    if(good) return "💚 Good company for " + cropName(good.crop_id);
    return null;
  },

  /* ============================================================
     RESIZING BY DRAGGING THE HANDLE
     ============================================================ */
  resizeStart(ev, id){
    ev.preventDefault(); ev.stopPropagation();
    const p = Geom.plant(DB.find("plantings", id)); if(!p) return;
    const bed = CanvasDrag.bed(); if(!bed) return;
    const svg = $("#pcanvas");
    const el = svg.querySelector('.pl[data-pid="' + id + '"]'); if(!el) return;
    const cx = Geom.PX(p), cy = Geom.PY(p);
    const rr0 = Geom.RR(p), rc0 = Geom.RC(p);
    const ratio = rc0 > 0 ? rr0 / rc0 : 0.7;
    const maxR = Math.max(Geom.W(bed), Geom.H(bed)) * 0.7;
    let rc = rc0;

    svg.classList.add("dragging");
    const blockScroll = e => { if(e.cancelable) e.preventDefault(); };
    document.addEventListener("touchmove", blockScroll, { passive:false });

    const paint = () => {
      const ring = el.querySelector(".canring");
      const art = el.querySelector("g.art");
      const grip = el.querySelector("[data-grip]");
      const root = el.querySelector('circle[stroke-opacity="0.7"]');
      const g = PlantArt.growth(p, Canvas.date());
      const grown = Math.max(0.18, PlantArt.sizeAt(g));
      if(ring) ring.setAttribute("r", Math.round(rc * grown * 10) / 10);
      if(art) art.setAttribute("transform", "scale(" + Canvas.iconR(bed, rc, grown) + ")");
      if(root) root.setAttribute("r", Math.round(rc * ratio * 10) / 10);
      if(grip){
        grip.setAttribute("cx", Math.round(rc * 0.7071 * 10) / 10);
        grip.setAttribute("cy", Math.round(rc * 0.7071 * 10) / 10);
        grip.setAttribute("r", Math.max(2, rc * 0.2));
      }
    };

    const move = e => {
      if(e.cancelable) e.preventDefault();
      const pt = CanvasDrag.at(e);
      rc = clamp(Math.hypot(pt.x - cx, pt.y - cy), 1.5, maxR);
      paint();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("touchmove", blockScroll);
      svg.classList.remove("dragging");
      Garden.setRadius(id, rc, rc * ratio);
      /* a footprint that changed by hand is a footprint she means —
         record it as one plant that sprawls, not a clump that grew */
      const q = DB.find("plantings", id);
      if(q && q.span_mode !== "single" && Math.abs(rc - rc0) > 1) Garden.syncQty(id);
      Garden.sel = id;
      Garden.render();
      haptic();
      toast(Math.round(rc * 2) + '" across');
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
};

/* the magnet is a preference, and some people want none of it */
Garden.toggleMagnet = function(){
  CanvasDrag.magnet = !CanvasDrag.magnet;
  Garden.render();
  toast(CanvasDrag.magnet ? "Companions will pull into place" : "Free placement — nothing snaps");
};
</script>
