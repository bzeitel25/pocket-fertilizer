<script>
/* ============================================================
   SEED TRAYS

   The seed bank knows what you own. A tray is what you actually
   did with it on a particular Sunday in February, and it is the
   part of the season with the most to remember and the least to
   look at: forty identical cells under a light, and no way to
   tell which is which in three weeks except by having written it
   down.

   So a tray is a real object with real cells. Each cell carries a
   crop, a variety, the packet it came from and how many seeds went
   in. From the sowing date and the crop's own figures the app works
   out three dates that matter and keeps them in front of you:

     · when it should sprout        — the crop's germination range
     · when to pot on / harden off  — a week before it goes out
     · when it can go in the ground — the crop's own transplant
                                      window, never before your
                                      last frost for a tender crop

   Then it asks what actually happened. A cell that sprouted, and
   when. A cell that did not. That is the only honest source for
   what a packet is really doing, and it is fed back as an OFFER to
   update the packet's germination rate — never silently, because
   the gardener may have drowned that tray and knows it.

   Planting out is the payoff: pick a bed and the cell becomes a
   planting that keeps the ORIGINAL SOWING DATE, so days-to-maturity
   counts from the seed going into the tray rather than from the day
   it reached the garden. Getting that wrong would quietly teach the
   app that everything matures a month faster than it does.
   ============================================================ */

const Trays = {

  /* ---------- reading ---------- */
  all(){ return DB.all("trays").slice().sort((a, b) => String(b.sown_on || "").localeCompare(String(a.sown_on || ""))); },
  cells(trayId){
    return DB.where("traycells", c => c.tray_id === trayId)
      .sort((a, b) => num(a.idx, 0) - num(b.idx, 0));
  },
  filled(trayId){ return Trays.cells(trayId).filter(c => c.crop_id); },
  size(t){ return Math.max(1, num(t.cols, 6)) * Math.max(1, num(t.rows, 4)); },

  /* ============================================================
     THE THREE DATES

     Everything here is derived, never stored, so a tray re-reads
     correctly if the frost dates are later corrected.
     ============================================================ */
  plan(cell, tray){
    const c = crop(cell.crop_id);
    const sownISO = cell.sown_on || (tray && tray.sown_on) || null;
    const sown = sownISO ? parseISO(sownISO) : null;
    if(!c || !sown) return null;

    const germLo = Math.max(1, num(c.germ[0], 7)), germHi = Math.max(germLo, num(c.germ[1], 14));
    const sproutFrom = addDays(sown, germLo), sproutTo = addDays(sown, germHi);

    /* How long this crop is meant to sit in a tray is the gap between its own
       two published offsets — start indoors, then transplant out. Where a crop
       has no indoor window (a carrot, a bean) there is no honest figure, so the
       app says so instead of inventing six weeks. */
    const st = c.start || {};
    const weeks = (st.indoor !== null && st.indoor !== undefined && st.tp !== null && st.tp !== undefined)
      ? Math.max(1, num(st.tp, 2) - num(st.indoor, -6)) : null;

    let out = weeks ? addDays(sown, Math.round(weeks * 7)) : null;
    /* never before the crop's own transplant window — a tomato started early
       under a light is still a tomato that dies in a late frost */
    const LF = Season.lastFrost();
    if(LF && st.tp !== null && st.tp !== undefined){
      const earliest = addDays(LF, Math.round(num(st.tp, 2) * 7));
      if(!out || out < earliest) out = earliest;
    }
    const harden = out ? addDays(out, -7) : null;

    return {
      crop: c, sown: sown, sownISO: iso(sown),
      sproutFrom: sproutFrom, sproutTo: sproutTo,
      weeksInTray: weeks, harden: harden, out: out,
      /* transplant-raised crops count maturity from sowing, which is why the
         planting created at plant-out keeps this date and not today's */
      harvest: Season.harvestFrom(cell.crop_id, iso(sown), "seed")
    };
  },

  /* what this cell is waiting on, in one line */
  state(cell, tray){
    if(cell.out_on) return { k:"out", t:"Planted out " + fmt(cell.out_on) };
    if(cell.sprouted === "0") return { k:"failed", t:"Did not come up" };
    const p = Trays.plan(cell, tray);
    const t = today();
    if(cell.sprouted === "1"){
      if(!p || !p.out) return { k:"growing", t:"Sprouted " + fmt(cell.sprouted_on || "") };
      const d = diffDays(t, p.out);
      if(d < 0) return { k:"due", t:"Overdue to plant out — " + Math.abs(d) + " days past" };
      if(d <= 7) return { k:"due", t:"Ready to plant out " + relDay(p.out) };
      return { k:"growing", t:"Plant out around " + fmt(p.out) };
    }
    if(!p) return { k:"waiting", t:"Sown" + (cell.sown_on ? " " + fmt(cell.sown_on) : "") };
    if(t < p.sproutFrom) return { k:"waiting", t:"Should sprout " + fmt(p.sproutFrom) + "–" + fmt(p.sproutTo) };
    if(t <= p.sproutTo) return { k:"check", t:"Due to sprout now — did it?" };
    return { k:"late", t:"Overdue to sprout since " + fmt(p.sproutTo) };
  },

  /* the whole tray in one line, for the list */
  summary(tray){
    const cs = Trays.filled(tray.id);
    const up = cs.filter(c => c.sprouted === "1").length;
    const no = cs.filter(c => c.sprouted === "0").length;
    const out = cs.filter(c => c.out_on).length;
    return { n: cs.length, up: up, no: no, out: out, size: Trays.size(tray),
             pending: cs.filter(c => !c.sprouted && !c.out_on).length };
  },

  /* observed germination, which is the only figure here that is a measurement */
  rate(cs){
    const judged = cs.filter(c => c.sprouted === "1" || c.sprouted === "0");
    if(!judged.length) return null;
    const sown = judged.reduce((a, c) => a + Math.max(1, num(c.seeds_sown, 1)), 0);
    const up = judged.filter(c => c.sprouted === "1").reduce((a, c) => a + Math.max(1, num(c.seeds_sown, 1)), 0);
    return { cells: judged.length, sown: sown, up: up, pct: Math.round(up / sown * 100) };
  },

  /* ---------- writing ---------- */
  create(o){
    const t = DB.insert("trays", {
      name: (o.name || "Tray").trim(), cols: clamp(num(o.cols, 6), 1, 12), rows: clamp(num(o.rows, 4), 1, 12),
      sown_on: o.sown_on || iso(today()), location: o.location || null, medium: o.medium || null,
      heat_mat: o.heat_mat ? "1" : "0", status: "active", notes: o.notes || null
    });
    const n = Trays.size(t);
    for(let i = 0; i < n; i++) DB.insert("traycells", { tray_id: t.id, idx: i });
    Cal.rebuild();
    return t;
  },
  resize(trayId, cols, rows){
    const t = DB.find("trays", trayId); if(!t) return;
    cols = clamp(num(cols, 6), 1, 12); rows = clamp(num(rows, 4), 1, 12);
    const want = cols * rows;
    const have = Trays.cells(trayId);
    /* shrinking only ever drops EMPTY cells from the end; a sown cell is a
       record of something that happened and is not thrown away to fit a grid */
    if(want < have.length){
      const droppable = have.slice(want).filter(c => !c.crop_id);
      if(have.slice(want).length !== droppable.length) return toast("Empty the cells at the end first");
      droppable.forEach(c => DB.remove("traycells", c.id));
    } else {
      for(let i = have.length; i < want; i++) DB.insert("traycells", { tray_id: trayId, idx: i });
    }
    DB.update("trays", trayId, { cols: cols, rows: rows });
  },
  remove(trayId){
    DB.bulkRemove("traycells", c => c.tray_id === trayId);
    DB.remove("trays", trayId);
    Cal.rebuild();
  },

  sow(cellId, patch){
    const c = DB.find("traycells", cellId); if(!c) return null;
    const t = DB.find("trays", c.tray_id);
    const row = DB.update("traycells", cellId, Object.assign({
      sown_on: c.sown_on || (t ? t.sown_on : iso(today()))
    }, patch));
    Cal.rebuild();
    return row;
  },
  clear(cellId){
    const c = DB.find("traycells", cellId); if(!c) return;
    DB.update("traycells", cellId, { crop_id:null, variety:null, variety_id:null, seed_id:null,
      seeds_sown:null, sprouted:null, sprouted_on:null, potted_on:null, notes:null });
    Cal.rebuild();
  },
  mark(cellId, up){
    const c = DB.find("traycells", cellId); if(!c) return;
    DB.update("traycells", cellId, {
      sprouted: up ? "1" : "0",
      sprouted_on: up ? (c.sprouted_on || iso(today())) : null
    });
    Cal.rebuild();
  },

  /* ============================================================
     INTO THE GROUND

     The planting keeps the tray's sowing date. Days to maturity is
     the figure this whole app defers to, and it is counted from
     seed — dating the planting today would teach it that every
     transplanted crop matures six weeks faster than it does.
     ============================================================ */
  plantOut(cellId, bedId, x, y){
    const c = DB.find("traycells", cellId); if(!c || !c.crop_id) return null;
    const bed = Geom.bed(DB.find("beds", bedId)); if(!bed) return null;
    const t = DB.find("trays", c.tray_id);
    const p = Trays.plan(c, t);

    const rr = Geom.rootR(c.crop_id, 1), rc = Geom.canopyR(c.crop_id, 1);
    const spot = Garden.openSpot(bed, rr, num(x, Geom.W(bed) / 2), num(y, Geom.H(bed) / 2));
    if(!spot) return { error: "No free ground that size in " + bed.name };

    const row = DB.insert("plantings", {
      bed_id: bed.id, crop_id: c.crop_id, variety: c.variety || null, variety_id: c.variety_id || null,
      seed_id: c.seed_id || null, qty: 1, span_mode: "single", status: "growing",
      /* the date the seed went into the tray, not today */
      sown_on: p ? p.sownISO : (c.sown_on || iso(today())),
      transplant_on: iso(today()),
      notes: "From " + ((t && t.name) || "a seed tray"),
      px: Math.round(spot.x * 10) / 10, py: Math.round(spot.y * 10) / 10,
      rr: rr, rc: rc,
      rot: Math.round(Math.random() * 40 - 20), sv: Math.floor(Math.random() * 100000),
      x: Math.floor(spot.x / Garden.cell(bed)), y: Math.floor(spot.y / Garden.cell(bed)), w: 1, h: 1
    });
    DB.update("traycells", cellId, { out_on: iso(today()), planting_id: row.id, bed_id: bed.id,
      sprouted: c.sprouted || "1", sprouted_on: c.sprouted_on || null });
    Cal.rebuild();
    return { planting: row, bed: bed };
  },

  /* everything in this tray that is ready, in one go */
  plantAllOut(trayId, bedId){
    const ready = Trays.filled(trayId).filter(c => !c.out_on && c.sprouted !== "0");
    const made = [];
    for(const c of ready){
      const r = Trays.plantOut(c.id, bedId);
      if(r && r.planting) made.push(r.planting);
    }
    if(made.length) Undo.push("trayout", "Planted out " + made.length + " seedling" + (made.length === 1 ? "" : "s"),
      made.map(m => ({ id: m.id, created: true })));
    return made;
  }
};

/* ============================================================
   CALENDAR — a tray puts its own dates on the grid
   ============================================================ */
(function trayCalendar(){
  const orig = Cal.rebuild;
  Cal.rebuild = function(){
    orig.call(Cal);
    if(!Season.lastFrost() || !Season.firstFrost()) return;
    const keep = {};
    const put = (key, o) => {
      keep[key] = 1;
      const ex = DB.all("events").find(e => e.auto === key);
      if(ex) return DB.update("events", ex.id, o);
      return DB.insert("events", Object.assign({ auto: key, done: "0" }, o));
    };
    DB.all("trays").forEach(t => {
      Trays.filled(t.id).forEach(c => {
        if(c.out_on) return;                       /* already in the ground */
        const p = Trays.plan(c, t);
        if(!p) return;
        const label = cropName(c.crop_id) + (c.variety ? " · " + c.variety : "");
        if(!c.sprouted)
          put("tray:germ:" + c.id, { date: iso(p.sproutTo), type:"seed", crop_id: c.crop_id, seed_id: c.seed_id || null,
            title: "Check " + label + " has sprouted", notes: t.name + " — sown " + fmt(p.sownISO) +
              ", expected " + fmt(p.sproutFrom) + " to " + fmt(p.sproutTo) + "." });
        if(p.harden && c.sprouted !== "0")
          put("tray:harden:" + c.id, { date: iso(p.harden), type:"transplant", crop_id: c.crop_id,
            title: "Start hardening off " + label, notes: t.name + " — a week outside in the day before it goes in the ground." });
        if(p.out && c.sprouted !== "0")
          put("tray:out:" + c.id, { date: iso(p.out), type:"transplant", crop_id: c.crop_id,
            title: "Plant out " + label, notes: t.name + " — " + (p.weeksInTray ? p.weeksInTray + " weeks in the tray. " : "") +
              "Maturity is counted from the sowing date, not from today." });
      });
    });
    DB.bulkRemove("events", e => e.auto && /^tray:/.test(e.auto) && !keep[e.auto] && e.done !== "1");
  };
})();
</script>
