<script>
/* ============================================================
   SELECTING SEVERAL PLANTS AT ONCE

   A row of twelve lettuces is twelve press-and-hold drags, and
   moving the row six inches off the path is twelve chances to put
   one of them somewhere you did not mean. The bed already knew how
   to copy one plant; what it never had was the idea of "these".

   Tap to add, tap again to drop. Press and hold anything already in
   the set and the whole set moves together, keeping its shape — a
   row stays a row. Remove and duplicate work on the set too, and
   both go on the undo stack as ONE action, because undoing a
   twelve-plant move one plant at a time would be its own punishment.
   ============================================================ */

const Sel = {
  on: false,
  ids: {},

  count(){ return Object.keys(Sel.ids).length; },
  has(id){ return !!Sel.ids[id]; },
  list(){ return Object.keys(Sel.ids).map(id => DB.find("plantings", id)).filter(Boolean).map(Geom.plant); },

  start(){
    Sel.on = true; Sel.ids = {};
    Garden.sel = null; Garden.paint = null; Garden.erase = false; Garden.clip = null;
    Garden.render();
    toast("Tap plants to gather them up");
  },
  stop(){ Sel.on = false; Sel.ids = {}; Garden.render(); },
  clear(silent){ Sel.ids = {}; if(!silent) Garden.render(); },

  toggle(id){
    if(Sel.ids[id]) delete Sel.ids[id]; else Sel.ids[id] = 1;
    haptic();
    Garden.repaint();
    Sel.paintBar();
  },

  all(){
    const bed = DB.find("beds", APP.bedId); if(!bed) return;
    Geom.live(bed.id).forEach(p => Sel.ids[p.id] = 1);
    Garden.repaint(); Sel.paintBar();
  },
  /* everything of the same crop — the usual reason you wanted a set */
  sameCrop(){
    const first = Sel.list()[0];
    if(!first) return toast("Pick one first and this gathers the rest of that crop");
    Geom.live(first.bed_id).forEach(p => { if(p.crop_id === first.crop_id) Sel.ids[p.id] = 1; });
    Garden.repaint(); Sel.paintBar();
    toast("All the " + cropName(first.crop_id).toLowerCase());
  },

  /* ---------- the bar under the toolbar ---------- */
  bar(){
    if(!Sel.on) return "";
    const n = Sel.count();
    let h = '<div class="selbar" id="selbar"><div class="row between" style="gap:8px">' +
      '<div class="b sm">' + (n ? n + " selected" : "Tap plants to select") + '</div>' +
      '<button class="chip" onclick="Sel.stop()">Done</button></div>' +
      '<div class="row wrap" style="gap:6px;margin-top:8px">' +
      '<button class="chip" onclick="Sel.all()">All</button>' +
      '<button class="chip" onclick="Sel.sameCrop()">Same crop</button>' +
      (n ? '<button class="chip" onclick="Sel.clear()">None</button>' +
           '<button class="chip" onclick="Sel.duplicateAll()">⧉ Duplicate</button>' +
           '<button class="chip bad" onclick="Sel.removeAll()">🧹 Remove</button>' : '') +
      '</div>';
    if(n) h += '<div class="tiny muted" style="margin-top:6px">Press and hold any of them to move the whole group.</div>';
    return h + '</div>';
  },
  paintBar(){
    const b = $("#selbar"); if(!b) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = Sel.bar();
    if(wrap.firstChild) b.replaceWith(wrap.firstChild);
  },

  /* ---------- acting on the set ---------- */
  removeAll(){
    const ps = Sel.list(); if(!ps.length) return;
    confirmSheet("Remove " + ps.length + " plant" + (ps.length === 1 ? "" : "s") + "?",
      "They come off the bed. Harvest records stay, and you can undo this.",
      "Remove them", () => {
        Undo.push("remove", "Removed " + ps.length + " plant" + (ps.length === 1 ? "" : "s"),
          ps.map(p => ({ id: p.id, status: p.status || "planned", removed_on: p.removed_on || null })));
        ps.forEach(p => Garden.removePlanting(p.id, true, true));
        Sel.ids = {};
        Garden.render();
        toast("Removed " + ps.length, 3200);
      }, true);
  },

  duplicateAll(){
    const ps = Sel.list(); if(!ps.length) return;
    const bed = Geom.bed(DB.find("beds", ps[0].bed_id)); if(!bed) return;
    const made = [];
    ps.forEach(p => {
      const spot = Garden.openSpot(bed, Geom.RR(p), Geom.PX(p) + Geom.RC(p) * 2, Geom.PY(p));
      if(!spot) return;
      const copy = DB.insert("plantings", {
        bed_id: bed.id, crop_id: p.crop_id, variety: p.variety, variety_id: p.variety_id,
        seed_id: p.seed_id, qty: p.qty, status: p.status, sown_on: p.sown_on, notes: p.notes,
        span_mode: p.span_mode, px: Math.round(spot.x*10)/10, py: Math.round(spot.y*10)/10,
        rr: Geom.RR(p), rc: Geom.RC(p),
        rot: Math.round(Math.random()*40 - 20), sv: Math.floor(Math.random()*100000),
        x: Math.floor(spot.x / Garden.cell(bed)), y: Math.floor(spot.y / Garden.cell(bed)), w:1, h:1
      });
      made.push(copy);
    });
    if(!made.length) return toast("No free ground for copies in this bed");
    Undo.push("duplicate", "Duplicated " + made.length + " plant" + (made.length === 1 ? "" : "s"),
      made.map(m => ({ id: m.id, created: true })));
    Cal.rebuild();
    Sel.ids = {}; made.forEach(m => Sel.ids[m.id] = 1);
    Garden.render();
    toast(made.length < ps.length ? "Room for " + made.length + " of " + ps.length : "Duplicated " + made.length);
  },

  /* ---------- tap, and press-and-hold to move the group ---------- */
  tapStart(ev, pid){
    if(!Sel.has(pid)){
      /* not in the set yet — a tap adds it, and nothing drags */
      const sx = ev.clientX, sy = ev.clientY;
      let moved = false;
      const mv = e => { if(Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true; };
      const up = () => {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        if(!moved) Sel.toggle(pid);
      };
      window.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
      return;
    }
    Sel.groupDrag(ev, pid);
  },

  groupDrag(ev, pid){
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const svg = $("#pcanvas"); if(!svg) return;
    const ps = Sel.list(); if(!ps.length) return;
    const start = Canvas.toIn(svg, ev.clientX, ev.clientY);
    const origin = ps.map(p => ({ id: p.id, x: Geom.PX(p), y: Geom.PY(p), rr: Geom.RR(p),
                                  el: svg.querySelector('.pl[data-pid="' + p.id + '"]') }));
    let lifted = false, dead = false, dx = 0, dy = 0, done = false;

    const blockScroll = e => { if(lifted && e.cancelable) e.preventDefault(); };
    document.addEventListener("touchmove", blockScroll, { passive:false });

    const lift = () => {
      if(dead || lifted) return;
      lifted = true;
      svg.classList.add("dragging");
      origin.forEach(o => { if(o.el) o.el.setAttribute("opacity", "0.9"); });
      haptic();
    };
    const timer = setTimeout(lift, 190);

    /* the whole set keeps its shape: one delta, and the largest delta that
       still leaves every member inside the outline wins */
    const fits = (ddx, ddy) => origin.every(o =>
      Geom.inside(bed, o.x + ddx, o.y + ddy, Math.min(o.rr, 2)));

    const move = e => {
      if(!lifted){
        const ax = Math.abs(e.clientX - ev.clientX), ay = Math.abs(e.clientY - ev.clientY);
        if(ax < 6 && ay < 6) return;
        if((ev.pointerType === "touch" || ev.pointerType === "pen") && ay > ax * 1.4){
          dead = true; clearTimeout(timer); finish(false); return;
        }
        clearTimeout(timer); lift();
      }
      if(e.cancelable) e.preventDefault();
      const now = Canvas.toIn(svg, e.clientX, e.clientY);
      let ndx = now.x - start.x, ndy = now.y - start.y;
      if(num(bed.snap_in) > 0){ ndx = Geom.snap(ndx, num(bed.snap_in)); ndy = Geom.snap(ndy, num(bed.snap_in)); }
      if(fits(ndx, ndy)){ dx = ndx; dy = ndy; }
      origin.forEach(o => { if(o.el)
        o.el.setAttribute("transform", "translate(" + (Math.round((o.x+dx)*10)/10) + " " +
          (Math.round((o.y+dy)*10)/10) + ")"); });
    };

    const finish = drop => {
      if(done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("touchmove", blockScroll);
      svg.classList.remove("dragging");
      origin.forEach(o => { if(o.el) o.el.removeAttribute("opacity"); });
      CanvasDrag.abort = null;
      if(!drop || !lifted) return;
      if(Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2){ Garden.repaint(); return; }
      Undo.push("move", "Moved " + origin.length + " plant" + (origin.length === 1 ? "" : "s"),
        origin.map(o => ({ id: o.id, px: o.x, py: o.y })));
      const c = Garden.cell(bed);
      origin.forEach(o => DB.update("plantings", o.id, {
        px: Math.round((o.x + dx) * 10) / 10, py: Math.round((o.y + dy) * 10) / 10,
        x: Math.floor((o.x + dx) / c), y: Math.floor((o.y + dy) / c) }));
      Garden.render();
      toast("Moved " + origin.length + " together");
    };
    const onUp = () => finish(true);
    CanvasDrag.abort = () => {
      origin.forEach(o => { if(o.el)
        o.el.setAttribute("transform", "translate(" + o.x + " " + o.y + ")"); });
      dx = 0; dy = 0; finish(false);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }
};
</script>
