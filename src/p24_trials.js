<script>
/* ============================================================
   DID IT ACTUALLY WORK?

   This file answers a question the app has never tried to answer
   before, and it is the easiest place in the whole project to lie.

   The data is one gardener, no control, no randomisation, and every
   confounder there is: weather, variety, which bed, how much sun,
   how much water, pest pressure, and the gardener getting better at
   gardening from one year to the next. Feed the tomatoes in the
   sunny bed with one thing in a good summer and the shady bed with
   another in a cool one, and a naive average will say — confidently,
   from her own records — that the first product is better. It is
   the most persuasive possible way to be wrong.

   So this file draws a hard line down the middle:

   · OBSERVED — what happened when she used a thing. Descriptive,
     always shows n, never ranked, never called a result, and the
     confounds that are actually present are listed by name.
   · MEASURED — a split trial. Same crop, same bed, same day, two
     products, two halves. That is a real comparison and it is
     allowed to say which side won.

   Nothing here feeds back into the app's defaults, and nothing here
   leaves the device. A shared library of other people's results is
   a separate future thing and is deliberately not wired in.
   ============================================================ */

/* Maturity waits for three records before it plans with the
   gardener's own figures. Nothing here is more certain than that, so
   nothing here speaks sooner. */
const OUTCOME_MIN = 3;

const Outcomes = {

  /* ---------- observed: what happened, stated as history ---------- */

  /* every feeding that reached a planting, with what that planting
     went on to yield. The join already exists — a feed row carries a
     planting, and harvests carry a planting. */
  rows(cropId){
    const out = [];
    DB.all("journal").filter(j => j.type === "feed" && j.planting_id && j.product).forEach(j => {
      const p = DB.find("plantings", j.planting_id); if(!p) return;
      if(cropId && p.crop_id !== cropId) return;
      const hv = DB.where("harvests", h => h.planting_id === p.id);
      if(!hv.length) return;                       /* nothing to say yet */
      const lbs = hv.reduce((a, h) => a + Journal.lbs(h), 0);
      const sqft = Feed.areaFor(p);
      out.push({
        product: j.product, amendment_id: j.amendment_id || null,
        planting_id: p.id, bed_id: p.bed_id, crop_id: p.crop_id,
        variety: p.variety || null,
        year: (j.date || "").slice(0, 4),
        lbs: lbs, sqft: sqft, perSqFt: sqft ? lbs / sqft : 0,
        trial: Trials.armFor(p.id)
      });
    });
    return out;
  },

  /* grouped by product, WITHIN one crop — comparing a product's
     tomatoes against its lettuces would be meaningless */
  byProduct(cropId){
    if(!cropId) return [];
    const g = {};
    Outcomes.rows(cropId).forEach(r => {
      const k = r.product;
      g[k] = g[k] || { product:k, n:0, lbs:0, sqft:0, beds:{}, years:{}, varieties:{}, trials:0 };
      const x = g[k];
      x.n++; x.lbs += r.lbs; x.sqft += r.sqft;
      if(r.bed_id) x.beds[r.bed_id] = 1;
      if(r.year) x.years[r.year] = 1;
      if(r.variety) x.varieties[r.variety] = 1;
      if(r.trial) x.trials++;
    });
    return Object.keys(g).map(k => {
      const x = g[k];
      x.perSqFt = x.sqft ? x.lbs / x.sqft : 0;
      x.bedN = Object.keys(x.beds).length;
      x.yearN = Object.keys(x.years).length;
      x.varietyN = Object.keys(x.varieties).length;
      x.enough = x.n >= OUTCOME_MIN;
      return x;
    }).sort((a, b) => b.n - a.n);
  },

  /* Which of the differences between two products' records are real
     differences in the GARDEN rather than in the product. Named
     explicitly, because a confounder you can see is one you can
     reason about and a confounder you cannot is just a wrong answer.
     Returns [] only when the comparison is genuinely clean. */
  confounds(a, b){
    const c = [];
    if(a.bedN > 1 || b.bedN > 1 || (a.bedN === 1 && b.bedN === 1 &&
       Object.keys(a.beds)[0] !== Object.keys(b.beds)[0]))
      c.push("different beds — sun, soil and drainage vary more between beds than most fertilisers do");
    if(a.yearN > 1 || b.yearN > 1 || (Object.keys(a.years)[0] !== Object.keys(b.years)[0]))
      c.push("different seasons — weather moves yield further than feeding does");
    if(a.varietyN > 1 || b.varietyN > 1 ||
       (a.varietyN === 1 && b.varietyN === 1 && Object.keys(a.varieties)[0] !== Object.keys(b.varieties)[0]))
      c.push("different varieties — days to maturity alone swings 30 days between varieties of one crop");
    return c;
  },

  /* the sentence the UI must print above any comparison. There is no
     version of this screen without it. */
  caveat(list){
    const thin = list.filter(x => !x.enough).length;
    return "This is a record of what happened, not a test of what works. " +
      (thin ? "Some of these have only a season or two behind them. " : "") +
      "One garden with no control plot cannot separate the fertiliser from the weather, the bed or the variety. " +
      "For an answer you can actually lean on, run a split trial.";
  },

  /* crops with anything at all to show */
  crops(){
    const seen = {};
    Outcomes.rows(null).forEach(r => { if(r.crop_id) seen[r.crop_id] = (seen[r.crop_id] || 0) + 1; });
    return Object.keys(seen).map(id => ({ crop_id: id, n: seen[id] })).sort((a, b) => b.n - a.n);
  }
};

/* ============================================================
   SPLIT TRIALS — the only comparison that earns the word "result"

   Same crop, same bed, same day, two products, two halves of the
   planting. Everything that confounds the observational version is
   held still by construction rather than apologised for afterwards.

   It is still n=1 and one season. It is not a paper. But it is a
   fair test, and no garden app the author has seen offers one.
   ============================================================ */
const Trials = {

  /* which arm, if any, a planting belongs to */
  armFor(plantingId){
    const a = DB.all("trialarms").find(x => x.planting_id === plantingId);
    if(!a) return null;
    const t = DB.find("trials", a.trial_id);
    return t ? { trial: t, arm: a.arm } : null;
  },

  /* Set one up from a bed: the plantings of one crop in it are split
     into two arms. Refuses anything that would make the comparison
     unfair rather than quietly allowing it — an unfair trial that
     looks like a trial is worse than no trial. */
  can(bedId, cropId){
    const here = DB.where("plantings", p => p.bed_id === bedId &&
      p.crop_id === cropId && p.status !== "removed");
    if(here.length < 2) return { ok:false, why:"A split needs at least two plants of the same crop in the bed." };
    const dates = {};
    here.forEach(p => { if(p.sown_on) dates[p.sown_on] = 1; });
    if(Object.keys(dates).length > 1)
      return { ok:false, why:"These went in on different dates. A head start is worth more than any fertiliser, so the trial would not be measuring the fertiliser." };
    if(!Object.keys(dates).length)
      return { ok:false, why:"Set the sown or planted date first — a trial has to start from a known day." };
    return { ok:true, n: here.length, plantings: here };
  },

  create(bedId, cropId, aId, bId, labelA, labelB){
    const c = Trials.can(bedId, cropId);
    if(!c.ok) return null;
    const t = DB.insert("trials", {
      name: cropName(cropId) + " · " + labelA + " vs " + labelB,
      bed_id: bedId, crop_id: cropId,
      product_a: aId, product_b: bId, label_a: labelA, label_b: labelB,
      started: (c.plantings[0] || {}).sown_on || iso(today()), status:"running"
    });
    /* alternate down the list so the two arms interleave across the
       bed. Giving one product the whole sunny end is exactly the
       confound the trial exists to remove. */
    c.plantings.forEach((p, i) => {
      DB.insert("trialarms", { trial_id: t.id, arm: i % 2 ? "b" : "a", planting_id: p.id });
    });
    return t;
  },

  arms(trialId){
    const t = DB.find("trials", trialId); if(!t) return null;
    const out = { a:{ arm:"a", label:t.label_a, n:0, lbs:0, sqft:0, plantings:[] },
                  b:{ arm:"b", label:t.label_b, n:0, lbs:0, sqft:0, plantings:[] } };
    DB.all("trialarms").filter(x => x.trial_id === trialId).forEach(x => {
      const p = DB.find("plantings", x.planting_id); if(!p) return;
      const side = out[x.arm]; if(!side) return;
      const lbs = DB.where("harvests", h => h.planting_id === p.id).reduce((a, h) => a + Journal.lbs(h), 0);
      side.n++; side.lbs += lbs; side.sqft += Feed.areaFor(p); side.plantings.push(p.id);
    });
    ["a","b"].forEach(k => { out[k].perSqFt = out[k].sqft ? out[k].lbs / out[k].sqft : 0; });
    return { trial: t, a: out.a, b: out.b };
  },

  /* The result — and the honesty is in the margin. Two plants against
     two plants differing by 4% is noise wearing a lab coat, so a
     margin under MIN_EDGE is reported as "no difference you could
     act on" rather than as a narrow win. */
  MIN_EDGE: 0.15,
  result(trialId){
    const r = Trials.arms(trialId); if(!r) return null;
    const { a, b } = r;
    if(!a.lbs && !b.lbs) return Object.assign({ state:"waiting" }, r);
    const hi = Math.max(a.perSqFt, b.perSqFt), lo = Math.min(a.perSqFt, b.perSqFt);
    const edge = lo > 0 ? (hi - lo) / lo : 1;
    const win = a.perSqFt > b.perSqFt ? a : b;
    if(edge < Trials.MIN_EDGE)
      return Object.assign({ state:"tie", edge: edge }, r);
    return Object.assign({ state:"edge", edge: edge, winner: win.arm, winnerLabel: win.label }, r);
  },

  /* what the trial is and is not, printed with every result */
  NOTE: "Both halves went into the same bed on the same day and were harvested by the same gardener, " +
        "so weather, soil, sun and variety are held still. That makes this a fair comparison in a way " +
        "that comparing two seasons never is. It is still one bed in one year — treat a small margin " +
        "as nothing at all.",

  close(trialId){ return DB.update("trials", trialId, { status:"done", ended: iso(today()) }); },
  running(){ return DB.where("trials", t => t.status === "running"); }
};
</script>
