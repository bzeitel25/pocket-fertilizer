<script>
/* ============================================================
   ZOOMING THE BED

   A forty-foot plot drawn to fit a phone screen renders a radish
   about two pixels across. You cannot drag it, you cannot hit its
   handle, and you certainly cannot tell it from the beetroot beside
   it. Everything else on this screen is measured honestly in inches;
   without a magnifier that honesty is what makes small plants
   unusable on a big plot.

   The whole feature is one idea: ZOOM IS A VIEWBOX CHANGE.

   Canvas.toIn reads the live viewBox attribute off the element every
   time it converts a touch into garden inches, so shrinking the
   viewBox magnifies the picture AND every gesture in the app follows
   correctly with no further work — tap, press-and-hold drag, the
   resize handle, the details button. A CSS transform would have
   looked identical and broken all four, because none of them would
   have known the picture had moved.

   Two gestures:
   · pinch and spread with two fingers, anchored so the point of
     garden between your fingers stays between your fingers;
   · once magnified, one finger on bare soil pans.

   And because a mouse has no pinch, ctrl+wheel and a pair of buttons
   do the same thing.
   ============================================================ */

const Zoom = {
  MAX: 8,
  z: 1,
  cx: null, cy: null,        /* centre of the view, in garden inches */

  pointers: {},
  n: 0,
  pinch: null,
  pan: null,

  pinching(){ return Zoom.n >= 2; },
  active(){ return Zoom.z > 1.001; },
  reset(){ Zoom.z = 1; Zoom.cx = null; Zoom.cy = null; Zoom.pinch = null; Zoom.pan = null; },

  /* ---------- the viewBox ----------
     Returns null at 1×, and the caller then emits exactly the string it
     always emitted. That matters: the test suite asserts the unzoomed
     viewBox literally, and a bed at rest should render byte for byte as
     it did before this file existed. */
  viewBox(bed, P){
    if(!Zoom.active()) return null;
    const W = Geom.W(bed), H = Geom.H(bed);
    const fw = W + P * 2, fh = H + P * 2;
    const z = clamp(Zoom.z, 1, Zoom.MAX);
    const vw = fw / z, vh = fh / z;
    const cx = Zoom.cx === null ? W / 2 : Zoom.cx;
    const cy = Zoom.cy === null ? H / 2 : Zoom.cy;
    const vx = clamp(cx - vw / 2, -P, -P + fw - vw);
    const vy = clamp(cy - vh / 2, -P, -P + fh - vh);
    return (Math.round(vx*100)/100) + ' ' + (Math.round(vy*100)/100) + ' ' +
           (Math.round(vw*100)/100) + ' ' + (Math.round(vh*100)/100);
  },

  /* text and badges are drawn in inches, so at 4× they would render four
     times larger on screen. Maps do not do that and neither should this —
     a label is a label at any magnification. */
  textScale(){ return Zoom.active() ? 1 / clamp(Zoom.z, 1, Zoom.MAX) : 1; },

  /* push the current view onto the live element without a re-render;
     a gesture at 60fps must not rebuild the DOM */
  paint(){
    const svg = $("#pcanvas"); if(!svg) return;
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const vb = Zoom.viewBox(bed, Canvas.PAD);
    if(vb) svg.setAttribute("viewBox", vb);
    else svg.setAttribute("viewBox", (-Canvas.PAD) + ' ' + (-Canvas.PAD) + ' ' +
      (Geom.W(bed) + Canvas.PAD*2) + ' ' + (Geom.H(bed) + Canvas.PAD*2));
    svg.classList.toggle("zoomed", Zoom.active());
    const tag = $("#zoomtag");
    if(tag) tag.textContent = Math.round(clamp(Zoom.z, 1, Zoom.MAX) * 100) + "%";
    if(tag) tag.style.display = Zoom.active() ? "" : "none";
  },

  /* ---------- setting the level, about a fixed screen point ----------
     `anchor` is a client point that should keep showing the same soil. */
  to(z, anchor){
    const svg = $("#pcanvas");
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const W = Geom.W(bed), H = Geom.H(bed), P = Canvas.PAD;
    const fw = W + P*2, fh = H + P*2;
    const before = (svg && anchor) ? Canvas.toIn(svg, anchor.x, anchor.y) : null;
    Zoom.z = clamp(num(z, 1), 1, Zoom.MAX);
    if(!Zoom.active()){ Zoom.cx = null; Zoom.cy = null; Zoom.paint(); return; }
    if(Zoom.cx === null){ Zoom.cx = W/2; Zoom.cy = H/2; }
    if(before && svg){
      /* keep `before` under the same fraction of the box it was under */
      const r = svg.getBoundingClientRect();
      const fx = r.width ? (anchor.x - r.left) / r.width : 0.5;
      const fy = r.height ? (anchor.y - r.top) / r.height : 0.5;
      const vw = fw / Zoom.z, vh = fh / Zoom.z;
      Zoom.cx = before.x - (fx - 0.5) * vw;
      Zoom.cy = before.y - (fy - 0.5) * vh;
    }
    Zoom.paint();
  },

  by(mult){
    const svg = $("#pcanvas");
    let anchor = null;
    if(svg){ const r = svg.getBoundingClientRect(); anchor = { x: r.left + r.width/2, y: r.top + r.height/2 }; }
    Zoom.to(Zoom.z * mult, anchor);
  },
  in(){ Zoom.by(1.6); haptic(); },
  out(){ Zoom.by(1/1.6); haptic(); },
  fit(){ Zoom.reset(); Zoom.paint(); Garden.repaint(); toast("Whole bed"); },

  /* ---------- gestures ---------- */
  bind(svg){
    if(!svg || svg._zbound) return;
    svg._zbound = true;
    svg.addEventListener("pointerdown", Zoom.down, true);
    svg.addEventListener("wheel", Zoom.wheel, { passive: false });
    Zoom.paint();
  },

  down(ev){
    Zoom.pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    Zoom.n = Object.keys(Zoom.pointers).length;
    window.addEventListener("pointermove", Zoom.move, { passive: false });
    window.addEventListener("pointerup", Zoom.up);
    window.addEventListener("pointercancel", Zoom.up);

    if(Zoom.n === 2){
      /* a pinch has begun. Whatever single-finger gesture was running is
         no longer what the gardener means — call it off rather than fling
         the plant across the bed while she zooms. */
      if(CanvasDrag.abort){ const a = CanvasDrag.abort; CanvasDrag.abort = null; try{ a(); }catch(e){} }
      Zoom.pan = null;
      const ids = Object.keys(Zoom.pointers);
      const a = Zoom.pointers[ids[0]], b = Zoom.pointers[ids[1]];
      Zoom.pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: Zoom.z };
      return;
    }

    /* one finger on bare soil, already magnified, is a pan */
    if(Zoom.n === 1 && Zoom.active()){
      const onPlant = ev.target && ev.target.closest &&
        (ev.target.closest(".pl") || ev.target.closest("[data-grip]") || ev.target.closest("[data-menu]"));
      if(!onPlant && !Garden.paint && !Garden.erase && !Garden.clip){
        const svg = $("#pcanvas");
        const g = svg ? Canvas.toIn(svg, ev.clientX, ev.clientY) : null;
        Zoom.pan = g ? { gx: g.x, gy: g.y, cx: Zoom.cx, cy: Zoom.cy, moved: 0,
                         sx: ev.clientX, sy: ev.clientY } : null;
      }
    }
  },

  move(ev){
    if(Zoom.pointers[ev.pointerId]) Zoom.pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };

    if(Zoom.n >= 2 && Zoom.pinch){
      if(ev.cancelable) ev.preventDefault();
      const ids = Object.keys(Zoom.pointers);
      const a = Zoom.pointers[ids[0]], b = Zoom.pointers[ids[1]];
      if(!a || !b) return;
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      Zoom.to(Zoom.pinch.z0 * (d / Zoom.pinch.d0), mid);
      return;
    }

    if(Zoom.n === 1 && Zoom.pan){
      const svg = $("#pcanvas"); if(!svg) return;
      Zoom.pan.moved = Math.max(Zoom.pan.moved,
        Math.abs(ev.clientX - Zoom.pan.sx), Math.abs(ev.clientY - Zoom.pan.sy));
      if(Zoom.pan.moved < 6) return;
      if(ev.cancelable) ev.preventDefault();
      const now = Canvas.toIn(svg, ev.clientX, ev.clientY);
      Zoom.cx = num(Zoom.pan.cx, 0) - (now.x - Zoom.pan.gx);
      Zoom.cy = num(Zoom.pan.cy, 0) - (now.y - Zoom.pan.gy);
      Zoom.paint();
    }
  },

  up(ev){
    delete Zoom.pointers[ev.pointerId];
    Zoom.n = Object.keys(Zoom.pointers).length;
    if(Zoom.n < 2 && Zoom.pinch){
      Zoom.pinch = null;
      /* one redraw at the end: labels and badges are sized against the zoom */
      Garden.repaint();
      haptic();
    }
    if(Zoom.n === 0){
      Zoom.pan = null;
      window.removeEventListener("pointermove", Zoom.move);
      window.removeEventListener("pointerup", Zoom.up);
      window.removeEventListener("pointercancel", Zoom.up);
    }
  },

  /* a mouse has no pinch */
  wheel(ev){
    if(!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    Zoom.to(Zoom.z * (ev.deltaY < 0 ? 1.12 : 1/1.12), { x: ev.clientX, y: ev.clientY });
    clearTimeout(Zoom._wt);
    Zoom._wt = setTimeout(() => Garden.repaint(), 220);
  },

  /* the toolbar control */
  chip(){
    return '<button class="chip' + (Zoom.active() ? " on" : "") + '" onclick="Zoom.in()">🔍 Zoom</button>' +
      (Zoom.active()
        ? '<button class="chip" onclick="Zoom.out()">− Out</button>' +
          '<button class="chip" onclick="Zoom.fit()">⤢ Whole bed</button>'
        : '');
  }
};

/* bind the zoom listeners wherever the drag listeners are bound — one
   canvas, one place that knows when it has been rebuilt */
(function(){
  const orig = CanvasDrag.bind;
  CanvasDrag.bind = function(){
    orig.apply(CanvasDrag, arguments);
    Zoom.bind($("#pcanvas"));
  };
})();

/* leaving a bed must leave its magnification behind, or the next bed opens
   zoomed into a corner of somewhere else */
(function(){
  const back = Garden.back;
  Garden.back = function(){ Zoom.reset(); return back.apply(Garden, arguments); };
  const open = Garden.open;
  if(typeof open === "function")
    Garden.open = function(){ Zoom.reset(); return open.apply(Garden, arguments); };
})();
</script>
