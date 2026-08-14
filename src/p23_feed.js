<script>
/* ============================================================
   FEEDING — what to feed, how much of it, and when

   The app is called Pocket Fertilizer and until now feeding was a
   sentence of prose on each crop page. This turns it into a number
   she can act on, WITHOUT pretending to know things only a soil
   test can tell her.

   The line this file will not cross:

   · NITROGEN can be recommended blind. It leaches, it is consumed
     every season, and every extension service publishes a garden
     rate for it in lb per 1,000 sq ft.
   · PHOSPHORUS cannot. OSU's own table says apply ZERO bonemeal
     where the soil test reads above 60 ppm, and UMN's dataset puts
     the median garden at 68 ppm against 26 ppm in farm fields —
     because compost carries P and gardens get compost every year.
     So the app never computes a P dose. It says what a test would
     have to show first.
   · POTASSIUM sits between the two: OSU gives a wood-ash rate, but
     only against a soil test value, and refuses it outright above
     600 ppm or at pH 7 and over.

   Everything here that is a number came off a publisher's own page.
   Anything derived rather than published is marked `est` and the UI
   says so, the same way Habit and the garden plants do it.
   ============================================================ */

const FEED_SRC = {
  umdFert: {
    n:"Fertilizing Vegetable Gardens",
    org:"University of Maryland Extension, Home & Garden Information Center",
    url:"https://extension.umd.edu/resource/fertilizing-vegetable-gardens",
    what:"Nitrogen rates per 1,000 sq ft for general and heavy-feeding vegetables, the analysis of the common high-nitrogen organic fertilisers, the arithmetic for converting a nitrogen rate into a weight of product, and the cup-to-pound weights this app converts with."
  },
  osuFert: {
    n:"Fertilizing your garden: vegetables, fruits and ornamentals (EC 1503)",
    org:"Oregon State University Extension Service",
    url:"https://extension.oregonstate.edu/catalog/pub/ec-1503-fertilizing-your-garden-vegetables-fruits-ornamentals",
    what:"Per-100-square-foot application rates, the phosphorus and potassium tables that are keyed to a soil test, manure nutrient content and first-year availability, wood-ash and lime rates, and the row-and-plant area conversions."
  },
  muSide: {
    n:"Side-dressing: mid-season boost for hungry plants",
    org:"University of Missouri Extension, Integrated Pest Management (timing table credited to Kansas State University Extension)",
    url:"https://ipm.missouri.edu/meg/2024/6/side_dressing-dt/",
    what:"When to side-dress each garden vegetable, which crops should not be side-dressed at all, side-dress rates for blood meal and cottonseed meal, and why nitrogen early on a tomato costs you the fruit."
  },
  umnOver: {
    n:"You might be over-fertilizing your garden",
    org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/yard-and-garden-news/you-might-be-over-fertilizing-your-garden",
    what:"Soil-test phosphorus thresholds above which no phosphorus should be applied, and the statewide garden readings showing most gardens are already well over them."
  },
  umnCompost: {
    n:"Compost and soil organic matter: the more, the merrier?",
    org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/yard-and-garden-news/compost-and-soil-organic-matter-more-merrier",
    what:"What repeated compost applications do to garden phosphorus levels over time."
  }
};

/* These are primary references like any other, so they belong on the
   Sources screen with the rest rather than in a corner of their own.
   SOURCES is what that screen reads. */
Object.keys(FEED_SRC).forEach(k => { SOURCES[k] = FEED_SRC[k]; });

/* ============================================================
   HOW MUCH NITROGEN A SEASON

   UMD states two figures and only two: 2 lb N per 1,000 sq ft as
   the general vegetable rate, and 3 lb for heavy feeders, naming
   tomato, broccoli and beet. There is no published third figure for
   light feeders, so the app derives one and says it derived it.
   ============================================================ */
const FEED_RATES = {
  heavy:  { n1000:3, est:false, src:"umdFert",
            why:"UMD Extension puts heavy feeders — it names tomato, broccoli and beet — at 3 lb of nitrogen per 1,000 sq ft." },
  medium: { n1000:2, est:false, src:"umdFert",
            why:"UMD Extension's general recommendation for vegetable crops is 2 lb of nitrogen per 1,000 sq ft." },
  light:  { n1000:1, est:true,  src:"umdFert",
            why:"No extension source states a separate light-feeder rate. This is half the general figure, chosen to sit under it rather than over it — for most of these crops compost alone is enough." }
};

/* ============================================================
   WHAT IS ON THE SHELF

   Reference products, each carrying the analysis the source states
   and nothing more. `form` decides how a weight becomes a household
   measure; UMD gives both figures:

     meal      1 cup of a dry organic meal ....... 0.33 lb
     granular  1 cup of a synthetic granular ..... 0.50 lb

   OSU says the same thing from the other end — "1 pound of packaged
   fertilizer mix usually equals about 2 cups" — so the two agree on
   granular and only UMD speaks for meals.

   `n`/`p`/`k` are label percentages. A product with no analysis its
   source states carries `rateOnly` and is never used to compute a
   dose; the app quotes the published application rate instead.
   ============================================================ */
const LB_PER_CUP = { meal:0.33, granular:0.50 };

const AMEND_REF = [
  /* --- nitrogen, organic --- */
  { id:"bloodmeal",   n:"Blood meal",        npk:[12,0,0], form:"meal", organic:true, src:"umdFert",
    note:"Fast for an organic source. Missouri puts it at about 12% nitrogen too, and side-dresses it at 2 lb per 100 sq ft." },
  { id:"cottonseed",  n:"Cottonseed meal",   npk:[6,2,1],  form:"meal", organic:true, src:"umdFert",
    note:"UMD gives the label analysis as 6-2-1. Missouri quotes about 7% nitrogen for the same material — a bag can be either, so check yours." },
  { id:"fishmeal",    n:"Fish meal",         npk:[8,0,0],  form:"meal", organic:true, src:"umdFert", low:true,
    note:"UMD states a range of 8–10% nitrogen. The app works from 8, the low end, so it errs towards under-applying." },
  { id:"fishemul",    n:"Fish emulsion",     npk:[5,0,0],  form:"liquid", organic:true, src:"umdFert",
    note:"A liquid concentrate, diluted before use — there is no honest cup-per-bed figure. Follow the dilution on the bottle." },
  { id:"organicmix",  n:"Organic blend 7-3-2", npk:[7,3,2], form:"meal", organic:true, src:"osuFert",
    note:"OSU names 7-3-2 as the common blended organic fertiliser and gives conversions from its own tables to it." },

  /* --- nitrogen, synthetic --- */
  { id:"nitrateSoda", n:"Nitrate of soda",   npk:[15,0,0], form:"granular", organic:false, src:"umdFert" },
  { id:"calnitrate",  n:"Calcium nitrate",   npk:[16,0,0], form:"granular", organic:false, src:"umdFert" },
  { id:"urea",        n:"Urea",              npk:[46,0,0], form:"granular", organic:false, src:"umdFert",
    note:"Very concentrated — a small measuring error is a large dose. Water it in." },
  { id:"ammsulf",     n:"Ammonium sulfate 21-0-0", npk:[21,0,0], form:"granular", organic:false, src:"osuFert",
    note:"OSU's side-dress standard: half a cup per 10 feet of row. Also acidifies, which is useful on alkaline ground and not on acid ground." },

  /* --- balanced mixes --- */
  { id:"tenten",      n:"10-10-10",          npk:[10,10,10], form:"granular", organic:false, src:"osuFert" },
  { id:"fifteen",     n:"15-15-15",          npk:[15,15,15], form:"granular", organic:false, src:"osuFert" },
  { id:"twelve",      n:"12-12-12",          npk:[12,12,12], form:"granular", organic:false, src:"muSide",
    note:"Missouri side-dresses this at about 3 lb per 100 sq ft." },
  { id:"fivetenfive", n:"5-10-5",            npk:[5,10,5],  form:"granular", organic:false, src:"osuFert" },

  /* --- things the sources give a RATE for but not an analysis --- */
  { id:"bonemeal",    n:"Bone meal",  rateOnly:true, nutrient:"P", form:"meal", organic:true, src:"osuFert",
    note:"Phosphorus, and phosphorus is the one thing this app will not dose blind. OSU's table applies 4 lb per 100 sq ft only where a soil test reads under 25 ppm, 2.5 lb from 25–60, and zero above 60." },
  { id:"woodash",     n:"Wood ash",   rateOnly:true, nutrient:"K", form:"bulk", organic:true, src:"osuFert",
    note:"OSU: 1–1.5 lb per 100 sq ft where the potassium test is under 300 ppm, nothing at all above it, and never more than 5–10 lb per 100 sq ft. Not on soil already at pH 7, not around potatoes, not on blueberries." },
  { id:"compost",     n:"Compost",    rateOnly:true, nutrient:"OM", form:"bulk", organic:true, src:"umdFert",
    note:"Feeds the soil rather than the plant. UMD reckons each 1% of organic matter releases about 0.4 lb of nitrogen per 1,000 sq ft, so a bed at 5% organic matter is already supplying the whole general recommendation." },
  { id:"manureDairy", n:"Dairy manure, composted", rateOnly:true, nutrient:"N", form:"bulk", organic:true, src:"osuFert", manure:[0.50,0.16,0.44] },
  { id:"manurePoult", n:"Poultry manure, composted", rateOnly:true, nutrient:"N", form:"bulk", organic:true, src:"osuFert", manure:[1.30,1.02,0.50],
    note:"About 75% of its nitrogen is available the first year, against 25–50% for the other manures." },
  { id:"manureHorse", n:"Horse manure, composted", rateOnly:true, nutrient:"N", form:"bulk", organic:true, src:"osuFert", manure:[0.70,0.25,0.60] }
];

/* ============================================================
   WHEN TO SIDE-DRESS

   Straight off the Missouri / Kansas State table, which is the only
   per-crop timing list this project found on a publisher's own site.
   The trigger is kept as the source WORDS, because most of them are
   growth stages and a growth stage is what she should actually look
   at. `days` only exists so the reminder has somewhere to sit.

   · days       — days after the planting date, when the source
                  states a time
   · thirds     — the source says "about one-third grown", so the
                  date comes from this crop's own days-to-maturity
   · stage      — the date is a placeholder, the words are the rule.
                  Where the source gives no time at all, the date
                  falls at 35 days, the middle of Missouri's general
                  "four to six weeks after planting"
   · none       — the source says do not, and why
   ============================================================ */
const SIDEDRESS_MID = 35;   /* middle of MU's "four to six weeks after planting" */

const FEED_PLAN = {
  tomato:      { days:SIDEDRESS_MID, stage:true, repeat:18,
                 text:"When the plant begins to set fruit, then every two to three weeks",
                 warn:"Nitrogen early on a tomato buys leaves and costs fruit, and Missouri links it to blossom end rot later. Wait for fruit set. OSU goes further and leaves tomatoes off its mid-season nitrogen entirely." },
  pepper:      { days:SIDEDRESS_MID, stage:true, text:"After the first fruits set" },
  hotpepper:   { days:SIDEDRESS_MID, stage:true, text:"After the first fruits set" },
  eggplant:    { days:SIDEDRESS_MID, stage:true, text:"After the first fruits set" },

  cucumber:    { days:SIDEDRESS_MID, stage:true, repeat:21, repeats:1,
                 text:"A week after flowering starts, and again three weeks later" },
  melon:       { days:SIDEDRESS_MID, stage:true, repeat:21, repeats:1,
                 text:"A week after flowering starts, and again three weeks later" },
  pumpkin:     { days:SIDEDRESS_MID, stage:true, repeat:21, repeats:1,
                 text:"A week after flowering starts, and again three weeks later" },
  zucchini:    { days:SIDEDRESS_MID, stage:true, repeat:21, repeats:1,
                 text:"A week after flowering starts, and again three weeks later",
                 est:true, estWhy:"Missouri lists cucumber, cantaloupe and pumpkin. Summer squash is the same crop group and is treated the same way here." },
  wintersquash:{ days:SIDEDRESS_MID, stage:true, repeat:21, repeats:1,
                 text:"A week after flowering starts, and again three weeks later",
                 est:true, estWhy:"Missouri lists cucumber, cantaloupe and pumpkin. Winter squash is the same crop group and is treated the same way here." },

  broccoli:    { days:21, from:"transplant", text:"Three weeks after transplanting" },
  cauliflower: { days:21, from:"transplant", text:"Three weeks after transplanting" },
  cabbage:     { days:21, from:"transplant", text:"Three weeks after transplanting" },
  brussels:    { days:21, from:"transplant", text:"Three weeks after transplanting",
                 est:true, estWhy:"Missouri names cabbage, cauliflower and broccoli. Brussels sprouts are transplanted the same way and are treated the same way here." },

  spinach:     { thirds:true, text:"When the plants are about one-third grown" },
  kale:        { thirds:true, text:"When the plants are about one-third grown" },
  mustard:     { thirds:true, text:"When the plants are about one-third grown" },
  collards:    { thirds:true, text:"When the plants are about one-third grown" },
  bokchoy:     { thirds:true, text:"When the plants are about one-third grown" },
  chard:       { thirds:true, text:"When the plants are about one-third grown" },
  arugula:     { thirds:true, text:"When the plants are about one-third grown" },

  corn:        { days:SIDEDRESS_MID, stage:true, repeat:28, repeats:1,
                 text:"When the plants are 8–10 inches tall, and again a week after tasseling" },
  potato:      { days:28, stage:true, text:"When the plants are 4–6 inches tall" },
  onion:       { days:21, text:"Two to four weeks after planting" },
  shallot:     { days:21, text:"Two to four weeks after planting",
                 est:true, estWhy:"Missouri names mature onions. A shallot is the same crop and is treated the same way here." },
  rhubarb:     { days:SIDEDRESS_MID, stage:true, text:"When the plants are 2–10 inches tall" },
  asparagus:   { days:SIDEDRESS_MID, stage:true,
                 text:"Before growth starts in spring, or after the last cut" },

  /* Legumes get no pre-plant nitrogen at all. The crop table has said
     "fixes its own nitrogen — do NOT fertilize with N" since the first
     build, and an app that printed that on the crop page and then put
     a dose on the calendar would be arguing with itself. Missouri's
     pod-set timing is the only point in the season these want any. */
  pea:         { days:SIDEDRESS_MID, stage:true, noPre:true, text:"After heavy flowering and pod set",
                 warn:"A pea makes its own nitrogen, so nothing goes on before pod set — and the app does not offer a feed at planting for this one." },
  bushbean:    { days:SIDEDRESS_MID, stage:true, noPre:true, text:"After heavy flowering and pod set",
                 warn:"A bean makes its own nitrogen, so nothing goes on before pod set." },
  polebean:    { days:SIDEDRESS_MID, stage:true, noPre:true, text:"After heavy flowering and pod set",
                 warn:"A bean makes its own nitrogen, so nothing goes on before pod set." },

  /* --- the source says don't --- */
  carrot:      { none:"Not normally needed if the bed was fed before planting." },
  beet:        { none:"Not normally needed if the bed was fed before planting." },
  turnip:      { none:"Not normally needed if the bed was fed before planting." },
  parsnip:     { none:"Not normally needed if the bed was fed before planting." },
  lettuce:     { none:"Not normally needed if the bed was fed before planting." },
  sweetpotato: { none:"Not recommended — extra nitrogen costs you yield or quality, or both." },
  watermelon:  { none:"Not recommended — extra nitrogen costs you yield or quality, or both." },
  basil:       { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  oregano:     { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  thyme:       { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  rosemary:    { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  sage:        { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  mint:        { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  cilantro:    { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  dill:        { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  parsley:     { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." },
  chive:       { none:"Herbs are on Missouri's do-not list — extra nitrogen costs flavour." }
};

/* a crop that finishes this fast is out of the ground before a
   side-dress could do anything, which is the same reasoning the
   source applies to carrots, beets and lettuce */
const FEED_QUICK_DAYS = 45;

const Feed = {

  /* ---------- rates ---------- */

  rate(cropId){
    const c = crop(cropId);
    const k = (c && c.feeder) || "medium";
    return FEED_RATES[k] || FEED_RATES.medium;
  },

  /* lb of nitrogen for a piece of ground, at this crop's rate */
  nFor(cropId, sqFt){
    return Feed.rate(cropId).n1000 / 1000 * num(sqFt, 0);
  },

  /* the ground one planting is entitled to. The app already measures
     a plant's root zone in inches, so use that rather than OSU's
     coarse "a large plant is about 5 square feet" — which is kept
     below only as a sanity check on the answer. */
  areaFor(p){
    const g = Geom.plant(p);
    const rr = Geom.RR(g);
    if(!rr) return 0;
    return Math.PI * rr * rr / 144 * Math.max(1, num(p.qty, 1));
  },

  /* ---------- products ---------- */

  shelf(){
    const mine = DB.all("amendments").map(a => ({
      id: a.id, n: a.name, npk: [num(a.n), num(a.p), num(a.k)],
      form: a.form || "granular", organic: a.organic === "1",
      cost: num(a.cost), lbsBag: num(a.lbs_per_bag), mine: true, note: a.notes || null
    }));
    return mine.concat(AMEND_REF.map(r => Object.assign({ mine:false }, r)));
  },
  product(id){ return Feed.shelf().find(p => p.id === id) || null; },

  /* what weight of this product carries that much nitrogen, and what
     that is in cups. The arithmetic is UMD's: lb of product = lb of
     N wanted / the fraction of N in the product. */
  dose(lbsN, prod){
    if(!prod || prod.rateOnly) return { ok:false, why:"rateOnly" };
    const pct = prod.npk && prod.npk[0];
    if(!pct) return { ok:false, why:"noNitrogen" };
    const lbs = num(lbsN, 0) / (pct / 100);
    const perCup = LB_PER_CUP[prod.form] || null;
    return {
      ok: true,
      lbs: lbs,
      oz: lbs * 16,
      cups: perCup ? lbs / perCup : null,
      liquid: prod.form === "liquid",
      pct: pct
    };
  },

  /* a dose written the way she measures it. Cups are a US kitchen
     measure and UMD's figures are US cups, so metric gets grams and
     is not offered a cup count it cannot use. */
  doseText(d){
    if(!d || !d.ok) return "—";
    if(d.liquid) return "dilute per the bottle";
    const mass = Feed.mass(d.lbs);
    if(Units.metric || !d.cups) return mass;
    return Feed.cupText(d.cups) + " (" + mass + ")";
  },
  /* A weight small enough to round to "0 oz" is not a weight, it is a
     bug on screen. Carry enough decimals that the number is always
     readable, and switch units before the digits run out. */
  mass(lbs){
    const v = num(lbs, 0);
    if(Units.metric){
      const g = v * 453.592;
      if(g < 10) return (Math.round(g * 10) / 10) + " g";
      if(g < 1000) return Math.round(g) + " g";
      return Units.weight(v);
    }
    const oz = v * 16;
    if(oz < 1) return (Math.round(oz * 100) / 100) + " oz";
    if(oz < 16) return (Math.round(oz * 10) / 10) + " oz";
    return (Math.round(v * 100) / 100) + " lbs";
  },
  /* Kitchen measures, because "0.24 cups" is not something anybody can
     take out of a bag. Worked in teaspoons — 48 to a US cup — because a
     single plant's share of a bed lands well below a cup and rounding
     to cups turns every small crop into "a pinch". */
  cupText(cups){
    const t = num(cups, 0) * 48;
    if(t < 0.5)  return "a pinch";
    if(t < 0.8)  return "about ½ tsp";
    if(t < 1.6)  return "about 1 tsp";
    if(t < 2.5)  return "about 2 tsp";
    if(t < 4.5)  return "about 1 tbsp";
    if(t < 7.5)  return "about 2 tbsp";
    if(t < 10.5) return "about 3 tbsp";
    if(t < 14)   return "about ¼ cup";
    if(t < 20)   return "about ⅓ cup";
    if(t < 28)   return "about ½ cup";
    if(t < 40)   return "about ¾ cup";
    if(t < 56)   return "about 1 cup";
    const r = Math.round(t / 48 * 2) / 2;
    return "about " + (r % 1 ? r.toFixed(1) : r) + " cups";
  },

  /* ============================================================
     WHAT PIECE OF GROUND ARE WE FEEDING?

     One plant's share of a bed is often a teaspoon of something, and
     nobody walks out to the garden to give one corn plant a teaspoon.
     Extension publishes rates per 100 sq ft for exactly this reason.
     So the dose is offered at three scopes and defaults to the one
     that matches how the job is actually done: everything of that
     crop in that bed, in one pass.
     ============================================================ */
  scopes(p){
    if(!p) return [];
    const out = [];
    const mine = Feed.areaFor(p);
    out.push({ key:"plant", label:"This " + cropName(p.crop_id).toLowerCase(),
               sqft: mine, lbsN: Feed.nFor(p.crop_id, mine) });

    if(p.bed_id){
      const same = DB.where("plantings", q => q.bed_id === p.bed_id &&
        q.crop_id === p.crop_id && q.status !== "removed");
      if(same.length > 1){
        const sq = same.reduce((a, q) => a + Feed.areaFor(q), 0);
        out.push({ key:"crop", label:"All " + same.length + " " + cropName(p.crop_id).toLowerCase() +
                   " in " + (DB.find("beds", p.bed_id) || {}).name,
                   sqft: sq, lbsN: Feed.nFor(p.crop_id, sq), n: same.length });
      }
      const bed = DB.find("beds", p.bed_id);
      if(bed){
        const sq = Geom.areaSqFt(Geom.bed(bed));
        /* a whole-bed pass is rated for the hungriest thing in it,
           which is what bedBudget already answers */
        out.push({ key:"bed", label:"The whole of " + bed.name,
                   sqft: sq, lbsN: Feed.bedBudget(p.bed_id), whole:true });
      }
    }
    return out;
  },
  /* the scope to open on: a single plant's share is usually too small
     to measure, so prefer doing the crop in one pass */
  defaultScope(p){
    const s = Feed.scopes(p);
    return (s.find(x => x.key === "crop") || s[0] || null);
  },

  /* ---------- the schedule ---------- */

  /* every feeding this planting should get, derived and never stored.
     Same contract as Trays.plan — if the frost dates or the sowing
     date are corrected later, this re-reads correctly. */
  plan(p){
    if(!p || !p.crop_id) return [];
    const c = crop(p.crop_id); if(!c) return [];
    const plan = FEED_PLAN[p.crop_id] || null;
    const start = p.transplant_on || p.sown_on;
    const out = [];
    const sqft = Feed.areaFor(p);
    const lbsN = Feed.nFor(p.crop_id, sqft);

    /* the pre-plant feed, at the crop's own season rate */
    if(!(plan && (plan.noPre || plan.none)) && lbsN > 0){
      out.push({
        kind:"pre", date: start ? iso(parseISO(start)) : null,
        label:"Feed at planting", lbsN: lbsN, sqft: sqft,
        text:"Worked into the top 2–4 inches before or at planting.",
        est: Feed.rate(p.crop_id).est
      });
    }

    if(!start) return out;
    const s = parseISO(start);

    if(plan && plan.none){
      out.push({ kind:"none", date:null, label:"No side-dressing", text: plan.none });
      return out;
    }
    if(!plan && num(c.dtm, 0) && num(c.dtm) < FEED_QUICK_DAYS){
      out.push({ kind:"none", date:null, label:"No side-dressing",
        text:"This one is out of the ground in " + c.dtm + " days — too quick for a mid-season feed to reach it." });
      return out;
    }

    /* how many days in the side-dress falls */
    let days;
    if(plan && plan.thirds) days = Math.round(num(c.dtm, 60) / 3);
    else if(plan && plan.days) days = plan.days;
    else days = SIDEDRESS_MID;

    /* a side-dress is nitrogen only and it is not the whole season's
       worth — Missouri's rates work out near half the pre-plant
       figure, so that is what is offered */
    const sideN = lbsN / 2;
    const base = {
      kind:"side", lbsN: sideN, sqft: sqft,
      text: (plan && plan.text) || "About four to six weeks after planting, if growth has gone pale or slow.",
      stage: !!(plan && plan.stage),
      warn: (plan && plan.warn) || null,
      est: !!(plan && plan.est), estWhy: (plan && plan.estWhy) || null,
      generic: !plan
    };
    out.push(Object.assign({ date: iso(addDays(s, days)), label:"Side-dress" }, base));

    const reps = (plan && plan.repeats) || 0;
    if(plan && plan.repeat){
      /* a repeat every N days: bounded by the number the source
         states, or by the crop finishing */
      const dtm = num(c.dtm, 90);
      let d = days, n = 0;
      const cap = reps || 4;
      while(n < cap){
        d += plan.repeat;
        if(d > dtm + 21) break;
        n++;
        out.push(Object.assign({ date: iso(addDays(s, d)), label:"Side-dress again" }, base));
      }
    }
    return out;
  },

  /* ---------- what has actually gone on ---------- */

  seasonN(bedId, year){
    const y = String(year || today().getFullYear());
    return DB.all("journal")
      .filter(j => j.type === "feed" && (j.date || "").slice(0,4) === y && (!bedId || j.bed_id === bedId))
      .reduce((a, j) => a + num(j.n_lbs), 0);
  },
  /* the bed's own entitlement: the hungriest thing growing in it,
     across the whole bed */
  bedBudget(bedId){
    const bed = DB.find("beds", bedId); if(!bed) return 0;
    const sq = Geom.areaSqFt(Geom.bed(bed));
    const here = DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed");
    let rate = 0;
    here.forEach(p => { rate = Math.max(rate, Feed.rate(p.crop_id).n1000); });
    if(!rate) rate = FEED_RATES.medium.n1000;
    return rate / 1000 * sq;
  },
  /* over-application is the failure mode UMD warns about, so say it
     with the number rather than in general terms */
  overFed(bedId){
    const budget = Feed.bedBudget(bedId);
    if(!budget) return null;
    const used = Feed.seasonN(bedId);
    if(used <= budget * 1.25) return null;
    return { used: used, budget: budget, pct: Math.round(used / budget * 100) };
  },

  /* ---------- logging ---------- */

  /* one row in the journal she already has, so the recap, the spend
     breakdown and the CSV export all pick it up for free. n_lbs is
     what makes the season tally possible. */
  log(rec){
    return DB.insert("journal", Object.assign({ type:"feed", unit:"lbs" }, rec));
  },

  /* ---------- the standing caveats ---------- */

  /* Phosphorus is the one the app refuses to guess at, and this is
     the sentence that says why. Shown wherever a P-carrying product
     is chosen. */
  P_NOTE: "Most established beds are already high in phosphorus — compost carries it and it does not leach away. " +
          "Minnesota's garden readings run a median of 68 ppm against 26 ppm in farm fields, and Oregon State's own table " +
          "applies zero bonemeal above 60 ppm. Without a soil test the safe assumption is that you need none, and the " +
          "excess ends up in the nearest creek.",
  K_NOTE: "Potassium is worth adding only against a test. Oregon State gives 1–1.5 lb of wood ash per 100 sq ft below 300 ppm, " +
          "nothing above it, and none at all on soil already at pH 7 or over.",
  OM_NOTE: "Every 1% of organic matter in the soil releases roughly 0.4 lb of nitrogen per 1,000 sq ft over a season. " +
           "A bed at 5% is already supplying the whole general recommendation on its own — which is why well-composted " +
           "gardens often need no fertiliser at all."
};

/* ============================================================
   FEEDING ON THE CALENDAR

   Cal.rebuild owns every auto event and prunes anything it did not
   just write, so feeding has to be generated inside the same pass
   rather than alongside it. Wrapping keeps p9_seeds.js unaware of
   this file, the same way p8d_maturity.js wraps Journal.saveHarvest.
   ============================================================ */
EV.feed = { c:"#7a9a3d", i:"🌿", n:"Feed" };

Feed._calBase = Cal.rebuild;
Cal.rebuild = function(){
  Feed._calBase.call(Cal);
  if(!Season.lastFrost() || !Season.firstFrost()) return;
  const yr = today().getFullYear();
  const keep = {};

  DB.where("plantings", p => p.status !== "removed" && (p.sown_on || p.transplant_on)).forEach(p => {
    Feed.plan(p).forEach((step, i) => {
      if(!step.date || step.kind === "none") return;
      if(parseISO(step.date).getFullYear() !== yr) return;
      const key = "feed:" + p.id + ":" + i;
      keep[key] = 1;
      const body = {
        date: step.date, type:"feed", crop_id: p.crop_id, bed_id: p.bed_id, planting_id: p.id,
        title: (step.kind === "pre" ? "Feed " : "Side-dress ") + cropName(p.crop_id),
        notes: step.text + (step.stage ? " The date is only a reminder — the plant is the trigger." : "")
      };
      const ex = DB.all("events").find(e => e.auto === key);
      if(ex) DB.update("events", ex.id, body);
      else DB.insert("events", Object.assign({ auto:key, done:"0" }, body));
    });
  });

  /* prune feeding events whose planting is gone or whose schedule
     moved, leaving anything already ticked off alone */
  DB.bulkRemove("events", e => e.auto && e.auto.indexOf("feed:") === 0 && !keep[e.auto] && e.done !== "1");
};
</script>
