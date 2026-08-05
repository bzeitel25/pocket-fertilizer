<script>
/* ============================================================
   UNDO

   Until now the bed was the one screen in this app you had to be
   careful on. Removing a plant took one tap with no confirmation
   and no way back, and re-creating it meant remembering the variety,
   the packet it came from, the date it went in, the size you had
   dragged it to and where it stood. People edit timidly when a
   mistake is expensive, and a plan you are afraid to change is not
   really a plan.

   The saving grace is that a removal here has always been a SOFT
   delete — `status` goes to "removed" and the row stays whole. So
   putting one back is a matter of clearing two fields, and the plant
   comes back as itself rather than as a fresh copy that lost half of
   what you knew about it.

   The stack holds the PREVIOUS values of whatever changed. Every
   entry is a list of patches, so one entry can cover eight plants
   moved together as easily as one removed.
   ============================================================ */

const Undo = {
  LIMIT: 40,
  stack: [],

  /* rows: [{ id, ...fields as they were before }]  or  { id, created:true }
     for something that did not exist yet and should be removed again. */
  push(kind, label, rows){
    if(!rows || !rows.length) return;
    Undo.stack.push({ kind: kind, label: label || "Change", rows: rows, at: Date.now() });
    if(Undo.stack.length > Undo.LIMIT) Undo.stack.shift();
    Undo.paint();
  },

  can(){ return Undo.stack.length > 0; },
  peek(){ return Undo.stack.length ? Undo.stack[Undo.stack.length - 1] : null; },
  clear(){ Undo.stack = []; Undo.paint(); },

  /* what the button should say — "Undo remove" is less use than the name
     of the thing you are about to get back */
  label(){
    const e = Undo.peek();
    return e ? e.label : "";
  },

  go(){
    const e = Undo.stack.pop();
    if(!e){ toast("Nothing to undo"); return; }
    let gone = 0;
    e.rows.forEach(r => {
      if(!r || !r.id) return;
      const row = DB.find("plantings", r.id);
      if(!row){ gone++; return; }
      if(r.created){
        /* it never existed before this action — take it away completely,
           along with the calendar entries it generated */
        DB.bulkRemove("events", ev => ev.planting_id === r.id);
        DB.remove("plantings", r.id);
        return;
      }
      const patch = {};
      Object.keys(r).forEach(k => { if(k !== "id") patch[k] = r[k]; });
      DB.update("plantings", r.id, patch);
    });
    /* a restored planting wants its sowing and harvest dates back on the
       calendar; rebuild rather than try to reconstruct which ones went */
    if(typeof Cal !== "undefined" && Cal.rebuild) Cal.rebuild();
    Garden.sel = null;
    if(typeof Sel !== "undefined") Sel.clear(true);
    haptic();
    Garden.render();
    toast(gone === e.rows.length ? "Nothing left to put back" : "Undone — " + e.label.toLowerCase());
  },

  /* the chip in the bed toolbar */
  chip(){
    if(!Undo.can()) return "";
    return '<button class="chip" id="undochip" onclick="Undo.go()" title="' + esc(Undo.label()) +
      '">↩︎ Undo</button>';
  },
  paint(){
    const box = $(".cvbar"); if(!box) return;
    const ex = $("#undochip");
    if(!Undo.can()){ if(ex) ex.remove(); return; }
    if(ex){ ex.title = Undo.label(); return; }
    const b = document.createElement("button");
    b.className = "chip"; b.id = "undochip"; b.textContent = "↩︎ Undo";
    b.title = Undo.label(); b.onclick = Undo.go;
    box.appendChild(b);
  }
};

/* ---------- the other places a change happens ---------- */

/* the sliders and the steppers in the planting sheet */
(function(){
  const orig = Garden.resizeBy;
  Garden.resizeBy = function(id, dw, dh){
    const p = Geom.plant(DB.find("plantings", id));
    if(p) Undo.push("resize", "Resized " + cropName(p.crop_id),
      [{ id: id, rc: Geom.RC(p), rr: Geom.RR(p) }]);
    return orig.apply(Garden, arguments);
  };
})();

/* clearing a whole bed is the most expensive single tap in the app */
(function(){
  const orig = Garden.clearBed;
  Garden.clearBed = function(){
    const live = DB.where("plantings", p => p.bed_id === APP.bedId && p.status !== "removed");
    if(live.length) Undo.push("clear", "Cleared " + live.length + " plant" + (live.length === 1 ? "" : "s"),
      live.map(p => ({ id: p.id, status: p.status || "planned", removed_on: p.removed_on || null })));
    return orig.apply(Garden, arguments);
  };
})();

/* pasting a copied plant, and duplicating one */
(function(){
  const dup = Garden.duplicate;
  Garden.duplicate = function(id){
    const before = DB.count("plantings");
    const r = dup.apply(Garden, arguments);
    const all = DB.all("plantings");
    if(DB.count("plantings") > before){
      const made = all[all.length - 1];
      Undo.push("duplicate", "Duplicated " + cropName(made.crop_id), [{ id: made.id, created: true }]);
    }
    return r;
  };
})();
</script>
