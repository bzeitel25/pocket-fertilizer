<script>
/* ============================================================
   THE PRODUCTS ON THE SHELF AT THE GARDEN CENTRE

   Two things live here and they are NOT the same kind of fact,
   which is the whole reason this file is separate from p23_feed.js:

   · p23_feed.js carries EXTENSION figures — how much nitrogen a
     crop wants, when to side-dress it. Those are research.
   · this file carries LABEL figures — what is in a particular bag.
     A guaranteed analysis is a legally registered number printed
     on the packaging, which makes it a fact about a product and
     not a recommendation about gardening.

   They must never be presented as the same thing, and the smoke
   suite asserts that a manufacturer URL can never turn up where an
   extension source is expected. Every entry carries the date its
   label was read, because formulations get reformulated — Jobe's
   Vegetable & Tomato has shipped as both 2-7-4 and 2-5-3, and a
   catalogue with no date on it goes quietly wrong.

   The catalogue is a convenience, not an authority. The bag in her
   shed outranks it, which is why "add your own" and "photograph the
   label" are the primary paths and this list is the shortcut.
   ============================================================ */

const PRODUCT_BRANDS = {
  espoma:  { n:"Espoma Organic",     url:"https://www.espoma.com/" },
  jobes:   { n:"Jobe's Company",     url:"https://jobescompany.com/" },
  drearth: { n:"Dr. Earth",          url:"https://drearth.com/" },
  scotts:  { n:"Scotts Miracle-Gro", url:"https://scottsmiraclegro.com/" },
  neptune: { n:"Neptune's Harvest",  url:"https://www.neptunesharvest.com/" }
};

/* `npk` is the guaranteed analysis exactly as registered.
   `checked` is when that label was last read on the maker's own page.
   `uses` is what the MAKER says it is for — a label claim, relayed as
   one, never as the app's own recommendation. */
const PRODUCT_REF = [
  { id:"espoma-plant-tone", brand:"espoma", n:"Plant-tone", npk:[5,3,3],
    form:"meal", organic:true, checked:"2026-08-14", uses:["all"],
    url:"https://www.espoma.com/product/plant-tone/",
    use:"Beds at 4 lb per 100 sq ft worked into the top 4 inches; 1 cup per vegetable plant, monthly through the season.",
    note:"Espoma states 1 lb is about 3 cups — 0.33 lb a cup, the same figure Maryland Extension gives for a dry organic meal, from a completely separate direction." },

  { id:"espoma-garden-tone", brand:"espoma", n:"Garden-tone", npk:[3,4,4],
    form:"meal", organic:true, checked:"2026-08-14", uses:["veg","herb"],
    url:"https://www.espoma.com/product/garden-tone/",
    use:"3 lb per 50 sq ft worked into the top 4–5 inches; up to ⅓ cup per plant. Herbs only at planting or after a big cut." },

  { id:"espoma-tomato-tone", brand:"espoma", n:"Tomato-tone", npk:[3,4,6],
    form:"meal", organic:true, checked:"2026-08-14", ca:8, uses:["fruiting"],
    url:"https://www.espoma.com/product/tomato-tone/",
    use:"3 lb per 50 sq ft before planting; 3 tbsp per plant, twice a month May through August.",
    note:"Carries 8% calcium. Blossom end rot is a calcium-uptake problem rather than a calcium-supply one, so this helps at the margins — even watering does the real work." },

  { id:"espoma-flower-tone", brand:"espoma", n:"Flower-tone", npk:[3,4,5],
    form:"meal", organic:true, checked:"2026-08-14", ca:5, uses:["flower"],
    url:"https://www.espoma.com/product/flower-tone/",
    use:"4 lb per 80 sq ft of bed, or ½ cup around a plant's drip line, monthly to mid-September.",
    note:"Feather meal, poultry manure, bone meal, alfalfa meal, greensand and sulfate of potash. 2.2% of the nitrogen is slow-release." },

  { id:"espoma-holly-tone", brand:"espoma", n:"Holly-tone", npk:[4,3,4],
    form:"meal", organic:true, checked:"2026-08-14", ca:3, uses:["acid"],
    url:"https://www.espoma.com/product/holly-tone/",
    use:"New beds 10 lb per 100 sq ft; established beds 5 lb per 100 sq ft, spring and late fall at half rate.",
    note:"For acid-loving plants — blueberries, azaleas, rhododendron. In the vegetable garden the only things it suits are blueberries and strawberries." },

  { id:"espoma-biotone", brand:"espoma", n:"Bio-tone Starter Plus", npk:[4,3,3],
    form:"meal", organic:true, checked:"2026-08-14", ca:5, uses:["starter"],
    url:"https://www.espoma.com/product/bio-tone-starter-plus/",
    use:"Mixed into the planting hole at transplanting.",
    note:"A starter, not a season feed — it carries mycorrhizae and is meant for the moment of transplant." },

  { id:"jobes-veg-tomato", brand:"jobes", n:"Organics Vegetable & Tomato", npk:[2,5,3],
    form:"granular", organic:true, omri:true, checked:"2026-08-14", uses:["veg","fruiting"],
    url:"https://jobescompany.com/product/jobes-organics-vegetable-tomato-granular/",
    note:"Has also shipped as 2-7-4. Check the bag in your hand against this — that is the whole reason every entry here carries the date it was read." },

  { id:"drearth-home-grown", brand:"drearth", n:"Home Grown Tomato, Vegetable & Herb", npk:[4,6,3],
    form:"meal", organic:true, checked:"2026-08-14", ca:7.5, uses:["veg","fruiting","herb"],
    url:"https://drearth.com/product/home-grown/" },

  { id:"neptune-fish-seaweed", brand:"neptune", n:"Fish & Seaweed Blend", npk:[2,3,1],
    form:"liquid", organic:true, omri:true, checked:"2026-08-14", uses:["all"],
    url:"https://www.neptunesharvest.com/fs-191.html",
    note:"Hydrolysed fish with seaweed. Liquid, so it acts fast and leaves fast — count it towards the season's nitrogen across all the feeds, not one can." },

  { id:"mg-allpurpose", brand:"scotts", n:"Miracle-Gro Water Soluble All Purpose", npk:[24,8,16],
    form:"liquid", organic:false, checked:"2026-08-14", uses:["all"],
    url:"https://scottsmiraclegro.com/en-us/brands/miracle-gro/products/plant-food-and-care/miracle-gro-water-soluble-all-purpose-plant-food.html",
    note:"Very concentrated and immediately available. Easy to overshoot with, and the nitrogen that is not taken up does not wait around." }
];

/* what a `uses` tag means, and which crops it covers. These are the
   MAKER's categories — the app maps them onto its own crop table so
   the picker can answer "what is on the shelf for a tomato". */
const PRODUCT_USE = {
  all:      { n:"Anything in the garden", match: () => true },
  veg:      { n:"Vegetables", match: c => c && c.fam !== "lamiaceae" },
  fruiting: { n:"Fruiting crops", match: c => c && ["solanaceae","cucurbit"].indexOf(c.fam) >= 0 },
  herb:     { n:"Herbs", match: c => c && ["lamiaceae","apiaceae"].indexOf(c.fam) >= 0 },
  flower:   { n:"Flowers", match: c => c && ["aster","tropaeolaceae","boraginaceae"].indexOf(c.fam) >= 0 },
  acid:     { n:"Acid-loving plants", match: c => c && ["strawberry","blueberry","rhubarb"].indexOf(c.id) >= 0 },
  starter:  { n:"Transplanting", match: c => c && c.from === "transplant" }
};

const Products = {

  ref(id){ return PRODUCT_REF.find(p => p.id === id) || null; },
  brand(k){ return PRODUCT_BRANDS[k] || null; },
  brandOf(p){ return p && p.brand ? PRODUCT_BRANDS[p.brand] : null; },
  /* the catalogue name as it reads on a shelf */
  fullName(p){
    const b = Products.brandOf(p);
    return b && p.n.indexOf(b.n.split(" ")[0]) < 0 ? b.n.split(" ")[0] + " " + p.n : p.n;
  },

  /* ============================================================
     WHAT A POUND OF NITROGEN ACTUALLY COSTS

     This is the one comparison the app can make with complete
     confidence, because it is arithmetic and nothing else. A 4 lb
     bag of a 3-4-4 holds 0.12 lb of nitrogen; the same money on a
     12-0-0 buys several times that. Nobody works this out in the
     aisle, and the "vegetable formula" premium is usually invisible
     without it.

     It says nothing about whether a product grows better tomatoes.
     It says what you are paying for the nutrient the crop actually
     runs out of.
     ============================================================ */
  costPerLbN(a){
    const bag = num(a.lbs_per_bag || a.lbsBag), cost = num(a.cost);
    const pct = a.npk ? a.npk[0] : num(a.n);
    if(!bag || !cost || !pct) return null;
    const lbsN = bag * (pct / 100);
    return cost / lbsN;
  },
  /* everything she owns, priced, cheapest nitrogen first. Anything
     missing a price or a bag weight cannot be ranked and is handed
     back separately rather than silently dropped. */
  valueTable(){
    const priced = [], unpriced = [];
    Feed.shelf().forEach(p => {
      if(p.rateOnly || !p.npk || !p.npk[0]) return;
      const c = Products.costPerLbN(p);
      (c === null ? unpriced : priced).push(Object.assign({ perLbN: c }, p));
    });
    priced.sort((a, b) => a.perLbN - b.perLbN);
    return { priced: priced, unpriced: unpriced };
  },

  /* ============================================================
     PHOSPHORUS YOU DID NOT ASK FOR

     Every popular "tomato" and "vegetable" blend on the shelf
     carries as much phosphorus as nitrogen or more — 3-4-4, 3-4-6,
     2-5-3, 4-6-3. On the ground most gardens actually have, that
     part of the bag does nothing but run off. Worth saying with the
     product's own numbers rather than in the abstract.
     ============================================================ */
  pHeavy(p){
    if(!p || !p.npk) return false;
    return p.npk[1] > 0 && p.npk[1] >= p.npk[0];
  },
  pNote(p){
    if(!Products.pHeavy(p)) return null;
    return "This is a " + p.npk.join("-") + " — there is more phosphate in the bag than nitrogen. " +
      "Nitrogen is the part your crops run out of every year; phosphorus is the part most established " +
      "beds already have too much of. You are buying it either way.";
  },

  /* ============================================================
     SIMILAR PRODUCTS — BY WHAT IS IN THEM

     Deliberately NOT "what worked for you". Similarity here is a
     fact about two labels: the shape of the analysis, whether it is
     organic, and whether it feeds slowly or all at once. That is
     honest with one data point. Ranking by outcome is not, and
     lives in Outcomes with a threshold in front of it.
     ============================================================ */
  ratio(p){
    const t = (p.npk || []).reduce((a, v) => a + num(v), 0);
    return t ? p.npk.map(v => num(v) / t) : [0, 0, 0];
  },
  similar(p, n){
    if(!p || !p.npk) return [];
    const r0 = Products.ratio(p);
    return Feed.shelf()
      .filter(q => q.id !== p.id && q.npk && q.npk[0])
      .map(q => {
        const r = Products.ratio(q);
        let d = 0; for(let i = 0; i < 3; i++) d += Math.pow(r[i] - r0[i], 2);
        d = Math.sqrt(d);
        if(q.organic !== p.organic) d += 0.15;      /* a real difference in how it feeds */
        if(q.form !== p.form) d += 0.10;
        return { p: q, d: d };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, n || 4);
  },
  /* why the app is offering this one, in words */
  whySimilar(a, b){
    const bits = [];
    const ra = Products.ratio(a), rb = Products.ratio(b);
    let d = 0; for(let i = 0; i < 3; i++) d += Math.pow(ra[i] - rb[i], 2);
    bits.push(Math.sqrt(d) < 0.08 ? "almost the same balance of N-P-K" : "a similar balance of N-P-K");
    if(a.organic === b.organic) bits.push(a.organic ? "both organic" : "both synthetic");
    if(a.form === b.form) bits.push("both " + (a.form === "liquid" ? "liquids" : a.form === "meal" ? "dry meals" : a.form + "s"));
    return bits.join(", ");
  },

  /* ============================================================
     SIMPLE AND ADVANCED

     Two different people are being served here. One wants to walk in
     with a bag of Garden-tone and be told how much to put down. The
     other mixes her own from blood meal and greensand and knows
     exactly what the numbers mean. Neither should have to use the
     other's screen.

     The mode is a stored preference and nothing else — no feature is
     hidden behind it that changes an answer, only how much of the
     arithmetic is on screen. Both modes compute the same dose.
     ============================================================ */
  get mode(){ return DB.get("feedMode", "simple") === "advanced" ? "advanced" : "simple"; },
  set mode(v){ DB.set("feedMode", v === "advanced" ? "advanced" : "simple"); },
  get advanced(){ return Products.mode === "advanced"; },

  /* ============================================================
     WHAT IS ON THE SHELF FOR THIS CROP

     Two separate questions, kept separate:

     · is it MEANT for this crop? That is the maker's own claim, off
       the label, and the app just relays it.
     · is it a good SHAPE for this crop? That is the app's, and it
       comes from the extension position already baked into Feed —
       nitrogen is the nutrient that runs out, phosphorus is the one
       most beds already have too much of.

     No part of this is "what worked in your garden". That question
     needs a threshold and lives in Outcomes.
     ============================================================ */
  forCrop(cropId){
    const c = crop(cropId);
    const rate = Feed.rate(cropId);
    return Feed.shelf()
      .filter(p => p.npk && p.npk[0])
      .map(p => {
        const ref = p.ref_id ? Products.ref(p.ref_id) : (p.mine ? null : Products.ref(p.id));
        const uses = (ref && ref.uses) || (p.uses || null);
        const intended = !uses ? null : uses.some(u => PRODUCT_USE[u] && PRODUCT_USE[u].match(c));
        /* how much of the bag is the nutrient this crop actually
           needs, against how much is the one it probably does not */
        const total = p.npk[0] + p.npk[1] + p.npk[2];
        const nShare = total ? p.npk[0] / total : 0;
        let score = nShare;
        if(Products.pHeavy(p)) score -= 0.15;
        if(intended === true) score += 0.25;
        if(intended === false) score -= 0.30;
        if(p.mine) score += 0.05;                 /* she already owns it */
        const perN = Products.costPerLbN(p);
        return { p: p, ref: ref, intended: intended, uses: uses, score: score, perLbN: perN,
                 why: Products.whyFor(p, c, intended, rate) };
      })
      .sort((a, b) => b.score - a.score);
  },
  whyFor(p, c, intended, rate){
    const bits = [];
    if(intended === true) bits.push("the maker lists it for this");
    if(Products.pHeavy(p)) bits.push("more phosphate than nitrogen, which most beds do not need");
    else bits.push("nitrogen-led, which is the part that runs out");
    if(rate && rate.n1000 >= 3) bits.push("this crop is a heavy feeder at " + rate.n1000 + " lb N per 1,000 sq ft");
    if(p.form === "liquid") bits.push("liquid, so it acts fast and does not last");
    return bits.join(" · ");
  },
  /* the honest "just tell me one" answer: the best-shaped thing she
     already owns, else the best-shaped thing in the catalogue */
  pickFor(cropId){
    const list = Products.forCrop(cropId);
    return list.find(x => x.p.mine) || list[0] || null;
  },

  /* ============================================================
     MIXING YOUR OWN

     For the gardener who buys blood meal and greensand separately.
     A blend is stored as parts by weight against shelf items, and its
     analysis is the weighted average — which is arithmetic, so the
     app can state it flatly. Everything downstream treats the result
     as an ordinary product.
     ============================================================ */
  blend(parts){
    /* parts: [{ id, parts }] against anything on the shelf */
    const shelf = Feed.shelf();
    let tot = 0; const acc = [0, 0, 0];
    (parts || []).forEach(x => {
      const p = shelf.find(s => s.id === x.id);
      const w = num(x.parts, 0);
      if(!p || !p.npk || w <= 0) return;
      tot += w;
      for(let i = 0; i < 3; i++) acc[i] += p.npk[i] * w;
    });
    if(!tot) return null;
    return {
      npk: acc.map(v => Math.round(v / tot * 100) / 100),
      parts: tot,
      /* a blend of meals behaves like a meal; anything mixed with a
         liquid is not a dry blend at all and is refused */
      form: (parts || []).every(x => { const p = shelf.find(s => s.id === x.id); return p && p.form !== "liquid"; })
        ? ((parts || []).every(x => { const p = shelf.find(s => s.id === x.id); return p && p.form === "meal"; }) ? "meal" : "granular")
        : null
    };
  },
  blendOf(a){
    if(!a || !a.blend) return null;
    try{ return JSON.parse(a.blend); }catch(e){ return null; }
  },

  /* ============================================================
     READING THE BAG WITH THE CAMERA

     Same path the seed packet reader uses, so it follows whichever
     provider is connected instead of picking one. A guaranteed
     analysis is large print in a fixed layout, which is a far easier
     read than a seed packet.
     ============================================================ */
  LABEL_PROMPT:
    "This is a photograph of a fertiliser or plant food package. Read the label and return JSON only:\n" +
    '{"name":"", "brand":"", "n":0, "p":0, "k":0, "form":"meal|granular|liquid|bulk", ' +
    '"organic":true, "lbs_per_bag":0, "calcium":0}\n' +
    "n, p and k are the three numbers of the guaranteed analysis in percent — nitrogen, available " +
    "phosphate (P2O5), soluble potash (K2O) — in that order. Use the guaranteed analysis panel, not " +
    "marketing text. form is how the product is applied: 'meal' for a dry powdery organic meal, " +
    "'granular' for pellets or prills, 'liquid' for anything diluted in water, 'bulk' for compost or " +
    "manure. organic is true only if the label says organic or OMRI. lbs_per_bag is the net weight in " +
    "pounds. Use null for anything you cannot read. Do not guess.",

  async readLabel(photo){
    if(!Vision.ready()) throw new Error("no vision provider");
    const d = await Vision.json(photo, Products.LABEL_PROMPT, { maxTokens: 700, what: "label" });
    if(!d) throw new Error("empty");
    /* coerce before anything is written into a number input, for the
       same reason Seeds._num exists: a number field silently discards
       what it cannot parse, and that looks exactly like a broken
       feature rather than a bad read */
    const pct = v => { const x = num(v); return (x >= 0 && x <= 100) ? x : null; };
    return {
      name: d.name ? String(d.name).slice(0, 60) : null,
      brand: d.brand ? String(d.brand).slice(0, 40) : null,
      n: pct(d.n), p: pct(d.p), k: pct(d.k),
      form: ["meal","granular","liquid","bulk"].indexOf(d.form) >= 0 ? d.form : "granular",
      organic: d.organic === true,
      lbs_per_bag: num(d.lbs_per_bag) > 0 ? num(d.lbs_per_bag) : null,
      ca: pct(d.calcium)
    };
  },

  /* put a catalogue entry onto her shelf as a real row she can then
     price and edit — the catalogue itself stays read-only */
  adopt(refId, extra){
    const r = Products.ref(refId); if(!r) return null;
    return DB.insert("amendments", Object.assign({
      name: Products.fullName(r), brand: (Products.brandOf(r) || {}).n || null,
      ref_id: r.id, n: r.npk[0], p: r.npk[1], k: r.npk[2],
      form: r.form, organic: r.organic ? "1" : "0",
      omri: r.omri ? "1" : "0", notes: r.note || null
    }, extra || {}));
  }
};

/* ============================================================
   THE CATALOGUE JOINS THE SHELF

   Feed.shelf() is what every picker, dose and comparison reads, so
   the named products have to be in it or they may as well not exist.
   Wrapped rather than edited into p23_feed.js so that file stays
   purely extension material — and so a build without this part still
   works on the generic ingredients alone.

   Order matters: what she owns first, then the branded catalogue,
   then the commodity ingredients.
   ============================================================ */
Feed._shelfBase = Feed.shelf;
Feed.shelf = function(){
  const base = Feed._shelfBase.call(Feed);
  const mine = base.filter(p => p.mine);
  const generic = base.filter(p => !p.mine);
  /* skip any catalogue entry she has already adopted onto her shelf,
     so it does not appear twice under two ids */
  const adopted = {};
  DB.all("amendments").forEach(a => { if(a.ref_id) adopted[a.ref_id] = 1; });
  const cat = PRODUCT_REF.filter(r => !adopted[r.id]).map(r => ({
    id: r.id, n: Products.fullName(r), npk: r.npk, form: r.form,
    organic: !!r.organic, mine: false, catalogue: true,
    uses: r.uses || null, note: r.note || null, src: null
  }));
  return mine.concat(cat, generic);
};

/* the catalogue is label data and must never be mistaken for the
   extension sources — so it is deliberately NOT merged into SOURCES */
</script>
