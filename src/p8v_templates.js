<script>
/* ============================================================
   SAVED BEDS

   Duplicating a bed already worked, but only sideways — one bed to
   another, right now, in this garden. What it could not do is carry
   a plan across a season. The bed that worked last year is the most
   valuable thing a gardener owns, and every February it had to be
   rebuilt plant by plant from memory.

   So a bed can be SAVED: its outline, its size, and every plant on
   it with the variety, the spacing you dragged it to and where it
   stood. Starting a new bed from a saved one lays the whole thing
   out again in one tap.

   Two rules keep this honest:

   · A saved bed stores no dates and no harvest history. Reusing last
     year's layout must not tell the app you sowed last year's seed
     today, and it must never manufacture a maturity record — those
     are the figures the whole app defers to, and inventing one would
     poison the gardener's own data with a copy of itself.
   · Positions are stored as FRACTIONS of the bed, so a layout saved
     from a 4×8 works on a 3×10. The plants land in the same relative
     arrangement and anything that no longer fits is pulled inside
     the outline rather than dropped.

   It lives in settings rather than a table of its own because it is
   a preference about how you garden, not a record of what happened.
   ============================================================ */

const Templates = {
  KEY: "bedTemplates",

  all(){
    const raw = DB.get(Templates.KEY, null);
    if(!raw) return [];
    try{ const v = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(v) ? v : []; }
    catch(e){ return []; }
  },
  write(list){ DB.set(Templates.KEY, JSON.stringify(list.slice(0, 40))); },

  /* ---------- saving ---------- */
  save(bedId, name){
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId)); if(!bed) return null;
    const W = Geom.W(bed), H = Geom.H(bed);
    const plants = Geom.live(bed.id).map(p => ({
      crop_id: p.crop_id,
      variety: p.variety || null,
      qty: num(p.qty, 1),
      span_mode: p.span_mode || "fill",
      /* fractions, so the layout survives a different-sized bed */
      fx: Math.round(Geom.PX(p) / W * 1000) / 1000,
      fy: Math.round(Geom.PY(p) / H * 1000) / 1000,
      rr: Geom.RR(p), rc: Geom.RC(p),
      notes: p.notes || null
    }));
    const t = {
      id: uid(),
      name: (name || bed.name || "Saved bed").trim(),
      shape: Geom.shape(bed), w_in: W, h_in: H,
      poly: bed.poly || null,
      cell_in: num(bed.cell_in, 12), grid_on: num(bed.grid_on, 0),
      north_deg: num(bed.north_deg, 0),
      sun_hours: bed.sun_hours || null, soil: bed.soil || null, irrigation: bed.irrigation || null,
      plants: plants,
      saved: iso(today())
    };
    const list = Templates.all();
    list.unshift(t);
    Templates.write(list);
    return t;
  },

  remove(id){
    Templates.write(Templates.all().filter(t => t.id !== id));
  },
  rename(id, name){
    const list = Templates.all();
    const t = list.find(x => x.id === id); if(!t) return;
    t.name = String(name || "").trim() || t.name;
    Templates.write(list);
  },

  /* ---------- using one ---------- */
  create(tid, plotId){
    const t = Templates.all().find(x => x.id === tid); if(!t) return null;
    const bed = DB.insert("beds", {
      name: t.name, shape: t.shape, w_in: t.w_in, h_in: t.h_in, poly: t.poly || null,
      cell_in: t.cell_in, grid_on: t.grid_on, snap_in: t.grid_on ? t.cell_in : 0,
      north_deg: t.north_deg || 0,
      cols: Math.max(1, Math.round(t.w_in / (t.cell_in || 12))),
      rows: Math.max(1, Math.round(t.h_in / (t.cell_in || 12))),
      sun_hours: t.sun_hours, soil: t.soil, irrigation: t.irrigation,
      plot_id: plotId || APP.plotId || null
    });
    Templates.apply(t, bed.id);
    return bed;
  },

  /* lay a saved layout onto an existing bed */
  apply(t, bedId){
    const bed = Geom.bed(DB.find("beds", bedId)); if(!bed || !t) return 0;
    const W = Geom.W(bed), H = Geom.H(bed);
    const made = [];
    (t.plants || []).forEach(p => {
      if(!crop(p.crop_id)) return;          /* a crop she has since deleted */
      const fit = Geom.clampInto(bed, num(p.fx, 0.5) * W, num(p.fy, 0.5) * H, Math.min(num(p.rr, 6), 2));
      const row = DB.insert("plantings", {
        bed_id: bed.id, crop_id: p.crop_id, variety: p.variety || null,
        qty: Math.max(1, num(p.qty, 1)), span_mode: p.span_mode || "fill",
        /* planned, and dated today — never carrying last year's sowing date */
        status: "planned", sown_on: iso(today()), notes: p.notes || null,
        px: Math.round(fit.x * 10) / 10, py: Math.round(fit.y * 10) / 10,
        rr: num(p.rr, 6), rc: Math.max(num(p.rr, 6), num(p.rc, 8)),
        rot: Math.round(Math.random() * 40 - 20), sv: Math.floor(Math.random() * 100000),
        x: Math.floor(fit.x / Garden.cell(bed)), y: Math.floor(fit.y / Garden.cell(bed)), w: 1, h: 1
      });
      made.push(row);
    });
    if(made.length){
      Undo.push("template", "Laid out " + made.length + " plant" + (made.length === 1 ? "" : "s"),
        made.map(m => ({ id: m.id, created: true })));
      Cal.rebuild();
    }
    return made.length;
  },

  /* ---------- UI ---------- */
  sheet(){
    const list = Templates.all();
    const bed = APP.bedId ? Geom.bed(DB.find("beds", APP.bedId)) : null;
    let h = '<p class="muted sm" style="margin-top:0">A saved bed keeps its outline and every plant on it — variety, spacing and position — but no dates and no harvest records. ' +
      'Start next season from the one that worked.</p>';

    if(bed) h += '<button class="btn block" onclick="Templates.saveCurrent()">☆ Save “' +
      esc(bed.name) + '” as a layout</button>';

    if(!list.length) h += '<div class="note i" style="margin-top:12px">Nothing saved yet.</div>';
    else {
      h += '<div class="sec" style="margin-top:16px"><h2>Saved layouts</h2><span class="tiny muted">' + list.length + '</span></div>';
      h += '<div class="card pad0"><div class="list">';
      list.forEach(t => {
        const n = (t.plants || []).length;
        const icons = (t.plants || []).slice(0, 6).map(p => cropEmoji(p.crop_id)).join("");
        h += '<div class="item"><div class="av">' + ((Geom.SHAPES[t.shape] || {}).e || "▭") + '</div>' +
          '<div class="grow"><div class="b">' + esc(t.name) + '</div>' +
          '<div class="tiny muted">' + Units.dims(t.w_in, t.h_in) + ' · ' +
          n + ' plant' + (n === 1 ? "" : "s") + ' · saved ' + esc(t.saved || "") + '</div>' +
          '<div class="tiny" style="margin-top:2px">' + icons + '</div></div></div>' +
          '<div class="row wrap" style="gap:6px;padding:0 12px 12px">' +
          '<button class="chip" onclick="Templates.useNew(\'' + t.id + '\')">＋ New bed from this</button>' +
          (bed ? '<button class="chip" onclick="Templates.useHere(\'' + t.id + '\')">Add to this bed</button>' : '') +
          '<button class="chip bad" onclick="Templates.drop(\'' + t.id + '\')">Delete</button></div>';
      });
      h += '</div></div>';
    }
    openSheet("Saved beds", h);
  },

  saveCurrent(){
    const bed = Geom.bed(DB.find("beds", APP.bedId)); if(!bed) return;
    const n = Geom.live(bed.id).length;
    const t = Templates.save(bed.id, bed.name);
    if(!t) return;
    toast("Saved “" + t.name + "” · " + n + " plant" + (n === 1 ? "" : "s"));
    Templates.sheet();
  },
  useNew(tid){
    const bed = Templates.create(tid);
    if(!bed) return toast("That layout has gone");
    closeSheet();
    Garden.open(bed.id);
    toast("Bed created from your saved layout");
  },
  useHere(tid){
    const t = Templates.all().find(x => x.id === tid); if(!t) return;
    const n = Templates.apply(t, APP.bedId);
    closeSheet(); Garden.render();
    toast(n ? "Added " + n + " plant" + (n === 1 ? "" : "s") : "Nothing to add");
  },
  drop(tid){
    const t = Templates.all().find(x => x.id === tid); if(!t) return;
    confirmSheet("Delete “" + t.name + "”?", "The saved layout goes. Beds you already made from it are untouched.",
      "Delete", () => { Templates.remove(tid); Templates.sheet(); }, true);
  }
};

/* the bed menu grows two entries: save this as a layout, and which way it faces */
(function(){
  const orig = Garden.bedMenu;
  Garden.bedMenu = function(){
    orig.apply(Garden, arguments);
    const body = $("#sheet-body"); if(!body) return;
    const bed = Geom.bed(DB.find("beds", APP.bedId));
    const extra = document.createElement("div");
    extra.innerHTML =
      '<button class="btn ghost block" style="margin-top:8px" onclick="Orient.sheet()">🧭 Which way this bed faces · ' +
        esc(Orient.name(Orient.of(bed || {}))) + ' at the top</button>' +
      '<button class="btn ghost block" style="margin-top:8px" onclick="Templates.sheet()">☆ Saved beds and layouts</button>';
    const save = body.querySelector('button[onclick*="saveBed"]');
    if(save && save.parentNode) save.parentNode.insertBefore(extra, save.nextSibling);
    else body.appendChild(extra);
  };
})();
</script>
