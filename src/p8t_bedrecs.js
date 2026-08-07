<script>
/* ============================================================
   WHAT WOULD GO WELL WITH WHAT IS ALREADY HERE

   The app had two kinds of advice about companions and neither did
   this job. The bed view told you about pairings you had ALREADY
   made — good neighbours, warnings — which is a report card, not a
   suggestion. The crop picker badged individual crops as you
   scrolled past them, which only helps if you already had a
   shortlist in mind. "Suggest" ranked by season first, so in July
   it hands you the same list whatever is growing in the bed.

   What was missing is the obvious question: I have tomatoes and
   carrots in this bed — what else belongs in here?

   So: every crop the app knows, scored against WHAT IS PLANTED,
   named partner by partner with the reason, and anything that
   actively fights something already there thrown out rather than
   ranked low. Season and sun still speak, but as annotations on the
   answer rather than as the question.
   ============================================================ */

const BedRecs = {
  /* how much clear ground is left, roughly — used to say whether there is
     honestly room, not to refuse anything */
  freeSqFt(bed){
    const used = Geom.live(bed.id).reduce((a, p) => a + Math.PI * Geom.RR(p) * Geom.RR(p), 0);
    return Math.max(0, Math.round((Geom.areaSqIn(bed) - used) / 144 * 10) / 10);
  },

  forBed(bedId, limit){
    const bed = Geom.bed(DB.find("beds", bedId));
    if(!bed) return [];
    const live = Geom.live(bedId);
    if(!live.length) return [];

    /* one entry per crop in the bed, however many plants of it there are */
    const present = [];
    live.forEach(p => { if(present.indexOf(p.crop_id) < 0) present.push(p.crop_id); });

    const stock = {}; DB.all("seeds").forEach(s => { if(s.crop_id) stock[s.crop_id] = (stock[s.crop_id] || 0) + 1; });
    const recentFams = Recommend.recentFamilies(bedId);
    const sun = (typeof Micro !== "undefined" && Micro.sunHours) ? Micro.sunHours(bedId) : num(bed.sun_hours, 8);
    const out = [];

    CROPS.forEach(c => {
      if(present.indexOf(c.id) >= 0) return;

      const partners = [], clashes = [];
      present.forEach(oc => {
        const r = pairRating(c.id, oc);
        if(r.score >= 1) partners.push({ id: oc, score: r.score, why: r.why });
        else if(r.score <= -2) clashes.push({ id: oc, why: r.why });
      });
      /* the whole point is that this list is safe to plant from. Something
         that fights what is already in the bed does not belong on it at all,
         however well it scores otherwise. */
      if(clashes.length || !partners.length) return;

      let score = partners.reduce((a, x) => a + (x.score >= 2 ? 10 : 5), 0);
      const notes = [], warn = [];

      const st = Season.status(c.id, 10);
      if(st && st.inWindow){ score += 8; notes.push(st.w.icon + " " + st.w.label + " window is open now"); }
      else if(st && st.days > 0 && st.days < 75){ score += 2; notes.push("🗓️ " + st.w.label + " " + relDay(st.w.date)); }
      else { score -= 6; warn.push("Not in a sowing window at the moment."); }

      if(stock[c.id]){ score += 6; notes.push("🌰 You already have seed for this"); }

      if(sun >= c.sun) score += 3;
      else if(sun >= c.sun - 2){ score -= 5; warn.push("Wants " + c.sun + "h of sun and this bed gets " + sun + "h — a lighter crop."); }
      else { score -= 18; warn.push("Needs " + c.sun + "h of sun; this bed gets " + sun + "h."); }

      if(recentFams[c.fam]){ score -= 10; warn.push("A " + FAMILY[c.fam].n.toLowerCase() + " grew here " + recentFams[c.fam] + " — rotate if you can."); }

      const fits = Season.stillFits(c.id);
      if(fits && !fits.fits){ score -= 8; warn.push("Needs " + fits.needs + " days and " + fits.left + " remain before first frost."); }

      out.push({ crop: c, partners: partners, score: score, notes: notes, warn: warn,
                 hasSeed: !!stock[c.id], room: Geom.rootR(c.id, 1) });
    });

    out.sort((a, b) => (b.partners.length - a.partners.length) || (b.score - a.score));
    return limit ? out.slice(0, limit) : out;
  },

  /* one line naming who it would be joining — the reason is the useful part */
  line(r){
    const names = r.partners.slice(0, 3).map(x => cropEmoji(x.id) + " " + cropName(x.id));
    const more = r.partners.length - names.length;
    return "Goes with " + names.join(", ") + (more > 0 ? " and " + more + " more" : "");
  },

  /* ---------- the section under the bed ---------- */
  html(bed){
    const recs = BedRecs.forBed(bed.id, 6);
    if(!recs.length) return "";
    const free = BedRecs.freeSqFt(bed);
    let h = '<div class="sec"><h2>Would go well here</h2>' +
      '<span class="tiny muted">' + Units.area(free) + ' free</span></div><div class="card">';
    h += '<div class="tiny muted" style="margin-bottom:10px">Chosen for what is already planted in this bed, not just what is in season. ' +
      'Anything that would fight one of these plants has been left out.</div>';
    recs.forEach(r => {
      h += '<div class="note g" style="margin-bottom:8px"><div class="row between" style="gap:10px">' +
        '<div class="grow"><div class="b">' + r.crop.e + ' ' + esc(r.crop.n) + '</div>' +
        '<div class="tiny" style="margin-top:2px">💚 ' + esc(BedRecs.line(r)) + '</div>' +
        '<div class="tiny muted" style="margin-top:2px">' + esc(r.partners[0].why) + '</div>' +
        r.notes.slice(0, 2).map(n => '<div class="tiny muted" style="margin-top:2px">' + esc(n) + '</div>').join("") +
        r.warn.slice(0, 1).map(n => '<div class="tiny" style="margin-top:2px;color:var(--warn)">' + esc(n) + '</div>').join("") +
        '</div>' +
        '<button class="btn sm" onclick="BedRecs.plant(\'' + r.crop.id + '\')">Plant</button></div></div>';
    });
    h += '</div>';
    return h;
  },

  plant(cropId){
    Garden.paint = cropId; Garden.erase = false;
    if(typeof Sel !== "undefined") Sel.on = false;
    Garden.render();
    toast("Tap the bed to plant " + cropName(cropId));
  }
};

/* ============================================================
   WATERING, GROUPED

   `Recommend.water` answers for the bed as a whole by taking the
   thirstiest crop in it, which is the safe answer and the reason a
   bed of lettuce and rosemary gets watered to suit the lettuce. On
   a mixed bed that is how you drown herbs.

   So the same figures, grouped: who wants a soak, who wants a
   drink, and who would rather you left them alone. It is drawn
   from the same `water` column in inches per week that the bed
   verdict already uses, so the two can never disagree.
   ============================================================ */

const WaterGroups = {
  /* The thresholds sit where the crop data actually clusters. Nearly every
     vegetable in the table is the extension services' flat 1"/week; what
     stands apart is a short list that wants more, and the Mediterranean
     herbs and most of the flowers, which want distinctly less and are the
     ones that suffer when a bed is watered to suit the lettuce. */
  BANDS: [
    { k:"high", n:"Thirsty",  i:"💧💧", d:"1½\" a week or more — a deep soak, and mulch earns its keep", lo: 1.25 },
    { k:"med",  n:"Average",  i:"💧",   d:"about an inch a week",                                         lo: 0.9 },
    { k:"low",  n:"Sparing",  i:"🌵",   d:"half to three-quarters of an inch — let the top inch dry out between waterings", lo: 0 }
  ],

  band(cropId){
    const c = crop(cropId); if(!c) return null;
    const w = num(c.water, 1);
    return WaterGroups.BANDS.find(b => w >= b.lo) || WaterGroups.BANDS[2];
  },

  forBed(bedId){
    const out = {};
    Geom.live(bedId).forEach(p => {
      const b = WaterGroups.band(p.crop_id); if(!b) return;
      (out[b.k] = out[b.k] || { band: b, crops: {} });
      out[b.k].crops[p.crop_id] = (out[b.k].crops[p.crop_id] || 0) + num(p.qty, 1);
    });
    return WaterGroups.BANDS.map(b => out[b.k]).filter(Boolean);
  },

  html(bedId){
    const groups = WaterGroups.forBed(bedId);
    if(groups.length < 2) return "";     /* nothing to separate */
    let h = '<div class="note i" style="margin-top:10px"><div class="b sm" style="margin-bottom:6px">Not everything here wants the same amount</div>';
    groups.forEach(g => {
      const names = Object.keys(g.crops).map(id => cropEmoji(id) + " " + cropName(id));
      h += '<div class="tiny" style="margin-bottom:4px"><b>' + g.band.i + ' ' + esc(g.band.n) + '</b> · ' +
        esc(g.band.d) + '<br><span class="muted">' + esc(names.join(", ")) + '</span></div>';
    });
    h += '<div class="tiny muted" style="margin-top:6px">The verdict above is set by the thirstiest of them, which is the safe call for the bed. ' +
      'Water by hand at the base and the sparing group will thank you for being missed out.</div></div>';
    return h;
  }
};
</script>
