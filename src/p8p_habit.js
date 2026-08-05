<script>
/* ============================================================
   GROWTH HABIT — how big it actually gets

   The canvas draws two circles per plant, so it needs two numbers
   the crop table never carried: how wide the mature foliage spreads,
   and how tall the plant stands. Guessing them would have made a
   very convincing-looking picture of nothing.

   The default is derived, not invented: in-row spacing IS a spread
   figure. Extension services set spacing from how wide the plant
   gets, so canopy diameter ≈ recommended spacing is a sound baseline
   for anything that behaves itself.

   It is wrong in one direction and badly so: sprawlers. A cucumber
   is spaced 12″ in the row and then runs two to three feet either
   side of it. Those crops, and the tall ones that decide who gets
   shaded, are corrected here against sources read on the
   publisher's own site — the same corrections-layer pattern
   p5b_sources.js uses for the crop table.

   Where no source states a figure, none is invented. The crop falls
   back to the derived rule and says so.
   ============================================================ */

/* the flower and herb pages are already loaded by p5c; reuse them rather than
   citing the same page twice under two names */
const HABIT_SRC = Object.assign({}, typeof GARDEN_SRC === "undefined" ? {} : GARDEN_SRC, {
  ilTomato: {
    n:"Tomato — Hort Answers", org:"University of Illinois Extension",
    url:"https://web.extension.illinois.edu/hortanswers/plantdetail.cfm?PlantID=294&PlantTypeID=9",
    what:"“Most modern determinate tomatoes easily grow 3 to 4 feet tall and indeterminates … easily reaching at least 6 feet.” Spacing: dwarf 12″, staked 15–24″, trellised or ground bed 24–36″, vigorous indeterminates 4 ft."
  },
  umnCuke: {
    n:"Growing cucumbers in home gardens", org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/vegetables/growing-cucumbers",
    what:"Vining types need “about two or three feet of space on either side of the row for the vines to spread”; 5–6 ft between hills. Trellises of 3–4 ft let rows be spaced closer."
  },
  umnSquash: {
    n:"Growing pumpkins and winter squash in home gardens", org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/vegetables/pumpkins-and-winter-squash",
    what:"Bush or short-vined 2–3 ft apart in rows 3–5 ft; large-vined 3–5 ft apart in rows 6–8 ft. Roots spread about as far as the vines."
  },
  umnSummer: {
    n:"Growing summer squash and zucchini in home gardens", org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/vegetables/growing-summer-squash-and-zucchini",
    what:"Bush-type plants that “do not spread like the plants of fall and winter squash and pumpkin”; mounds 4 ft apart, or single plants 24–36″ apart."
  },
  ilWatermelon: {
    n:"Watermelon — Home Vegetable Gardening", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/gardening/watermelon",
    what:"Hills 6 ft apart with 7–10 ft between rows; alternatively plants 5–6 ft apart in rows 6–8 ft apart."
  },
  ilMuskmelon: {
    n:"Muskmelon — Home Vegetable Gardening", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/gardening/muskmelon",
    what:"Thin to 18–24″ apart in the row, rows at least 5 ft apart."
  },
  ilOkra: {
    n:"Okra — Home Vegetable Gardening", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/gardening/okra",
    what:"Plants grow 3 to 6 ft or more; dwarf basal-branching types such as Annie Oakley 2½–5 ft."
  },
  ilBrussels: {
    n:"Brussels Sprouts — Home Vegetable Gardening", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/gardening/brussels-sprouts",
    what:"Plants reach 24–36″ in height, and are set 24″ apart in rows 30–36″ apart."
  },
  umnBeans: {
    n:"Growing beans in home gardens", org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/vegetables/growing-beans",
    what:"Pole beans are twining vines growing up to six feet and sometimes taller, and must be supported."
  },
  hgicPepper: {
    n:"Pepper (HGIC 1323)", org:"Clemson Cooperative Extension",
    url:"https://hgic.clemson.edu/factsheet/pepper/",
    what:"Peppers grow more slowly and are smaller than most tomato plants; set transplants 18–24″ apart in the row, or 14–18″ apart in all directions in beds."
  },
  ilCorn: {
    n:"Sweet corn — Hort Answers", org:"University of Illinois Extension",
    url:"https://web.extension.illinois.edu/hortanswers/plantdetail.cfm?PlantID=289&PlantTypeID=9",
    what:"Kernels 9–12″ apart in the row, 30–36″ between rows; side-dress when plants are 12–18″ tall. The page gives no mature height, so the figure used here is an estimate."
  }
});

/* spread is the mature FOLIAGE DIAMETER in inches; height is the mature
   height in inches. `est:true` means the source does not state that figure
   and the app is estimating it — those are shown as estimates in the UI. */
const HABIT = {
  /* --- sprawlers: the whole reason this layer exists --- */
  cucumber:     { spread: 60, height: 16, src:"umnCuke",
                  note:"Unsupported vines run 2–3 ft either side of the row. On a trellis they take barely more than their 12″ spacing — drag the ring in if yours are climbing." },
  zucchini:     { spread: 42, height: 26, src:"umnSummer", estHeight:true,
                  note:"A bush, not a vine — big leaves on a compact plant. Mounds are set 4 ft apart." },
  wintersquash: { spread: 84, height: 16, src:"umnSquash", estHeight:true,
                  note:"Large-vined types are planted 3–5 ft apart in rows 6–8 ft apart, and the roots reach about as far as the vines." },
  pumpkin:      { spread: 96, height: 16, src:"umnSquash", estHeight:true,
                  note:"Needs 6–8 ft between mounds. This is the plant most likely to swallow a small bed." },
  watermelon:   { spread: 84, height: 14, src:"ilWatermelon", estHeight:true,
                  note:"Hills 6 ft apart, 7–10 ft between rows." },
  melon:        { spread: 60, height: 14, src:"ilMuskmelon", estHeight:true,
                  note:"Thinned to 18–24″ in the row with rows 5 ft apart." },

  /* --- the tall ones, which decide who gets shaded --- */
  tomato:       { spread: 30, height: 60, src:"ilTomato",
                  note:"Determinates 3–4 ft, indeterminates 6 ft and upward. 60″ splits the two; a caged indeterminate will beat it." },
  pepper:       { spread: 20, height: 30, src:"hgicPepper", estHeight:true,
                  note:"Smaller than a tomato; set 18–24″ apart in the row." },
  okra:         { spread: 24, height: 60, src:"ilOkra", estSpread:true,
                  note:"3–6 ft or more, so it shades whatever stands north of it. Dwarf types 2½–5 ft." },
  brussels:     { spread: 24, height: 30, src:"ilBrussels", estSpread:true,
                  note:"24–36″ tall by harvest, and top-heavy with it — give it firm ground and room to reach." },
  polebean:     { spread: 12, height: 72, src:"umnBeans", estSpread:true,
                  note:"Twining to 6 ft and often taller. Narrow, but it casts a long shadow." },
  corn:         { spread: 14, height: 78, src:"ilCorn", estHeight:true,
                  note:"Extension guides give spacing (9–12″ in rows 30–36″ apart) but not a mature height; 6½ ft is a working estimate for a full-season variety." },

  /* --- flowers, tea and the beneficial-insect plants --- */
  lavender:     { spread: 30, height: 24, src:"usuLavender",
                  note:"English lavender makes 1–2 ft tall and 2–3 ft wide. Wider than it is high, which is why 18–24″ spacing looks generous and is not." },
  anisehyssop:  { spread: 24, height: 36, src:"wiscHyssop",
                  note:"Upright clumps 2–4 ft tall and 1–3 ft across." },
  yarrow:       { spread: 24, height: 24, src:"hgicYarrow",
                  note:"1–3 ft tall and about as wide, spaced 12–18″. It will keep going past that by rhizome if you let it." },
  alyssum:      { spread: 12, height: 6, src:"hgicAlyssum",
                  note:"Only 3–6″ high from seed but spreading a foot or more — it fills an edge without taking headroom off anything." },
  zinnia:       { spread: 12, height: 30, src:"hgicZinnia",
                  note:"8″ to 4 ft by cultivar. This is the common 2–3 ft sort, thinned to a foot apart." },
  lemonbalm:    { spread: 24, height: 24, src:"usuBalm", estSpread:true,
                  note:"10–24″ tall. Spread follows its 18″ spacing; left to seed it covers considerably more." },
  chamomile:    { spread: 12, height: 30, src:"ncsuToolbox", estSpread:true,
                  note:"13–30″ tall. The source gives height but not width." },
  beebalm:      { spread: 24, height: 36, src:"ncsuToolbox", estSpread:true,
                  note:"2–4 ft tall. Some kinds run at the root and will exceed any spread figure given for them." },
  echinacea:    { spread: 24, height: 42, src:"ncsuToolbox", estSpread:true,
                  note:"3–4 ft tall. Plan for the second year — from seed it usually roots the first and flowers the next." },
  cosmos:       { spread: 18, height: 48, src:"ilFlowers", estSpread:true,
                  note:"1–6 ft depending on the sort. Tall enough to shade a bed, so put it on the north side." },
  cornflower:   { spread: 10, height: 24, src:"ncsuToolbox", estSpread:true,
                  note:"1–3 ft. Narrow and upright — it slots between things." },
  phacelia:     { spread: 12, height: 30, src:"ncsuToolbox", estSpread:true, estHeight:true,
                  note:"Sown broadcast as a strip rather than spaced as individuals; the figures here describe one plant in a bed." }
};

/* Everything else derives from the crop table's own spacing figure, which is
   already reconciled against primary sources in p5b_sources.js. A handful of
   growth habits genuinely sit either side of "as wide as it is spaced":
   alliums are narrow uprights, herbs and brassicas bush out past theirs. */
const SPREAD_FAM = {
  allium: 0.72, poaceae: 0.85, apiaceae: 0.95, aster: 1.05, chenopod: 1.10,
  brassica: 1.15, lamiaceae: 1.20, legume: 1.05, solanaceae: 1.10,
  cucurbit: 1.60, tropaeolaceae: 1.40, boraginaceae: 1.30, convolvulaceae: 1.80
};

const Habit = {
  SRC: HABIT_SRC, TABLE: HABIT, FAM: SPREAD_FAM,

  row(cropId){ return HABIT[cropId] || null; },

  /* mature foliage diameter in inches, for one plant */
  spread(cropId){
    const h = HABIT[cropId];
    if(h && h.spread) return h.spread;
    const c = crop(cropId);
    if(!c) return 12;
    return Math.round(num(c.sp, 12) * (SPREAD_FAM[c.fam] || 1.05));
  },
  height(cropId){
    const h = HABIT[cropId];
    if(h && h.height) return h.height;
    return Geom.HEIGHT_FALLBACK(cropId);
  },
  /* where each figure came from, so the UI never states an estimate as fact */
  provenance(cropId){
    const h = HABIT[cropId];
    const c = crop(cropId);
    if(!h) return {
      spread: { value: Habit.spread(cropId), derived: true,
        how: "Derived from the " + (c ? num(c.sp, 12) : 12) + "″ spacing this crop is given, adjusted for growth habit." },
      height: { value: Habit.height(cropId), derived: true,
        how: "Estimated from growth habit. No extension source consulted states a mature height for this crop." },
      src: null
    };
    const s = HABIT_SRC[h.src];
    return {
      spread: { value: h.spread, derived: !!h.estSpread,
        how: h.estSpread ? "Estimated; the source below gives height rather than spread." : "From the source below." },
      height: { value: h.height, derived: !!h.estHeight,
        how: h.estHeight ? "Estimated; the source below gives spacing rather than a mature height." : "From the source below." },
      note: h.note, src: s || null
    };
  }
};

/* ---- fold the sourced figures into the geometry ---- */
Geom.HEIGHT_FALLBACK = function(cropId){
  if(Geom.HEIGHT[cropId] !== undefined) return Geom.HEIGHT[cropId];
  const c = crop(cropId);
  return (c && ({ poaceae:72, solanaceae:36, legume:26, cucurbit:16, brassica:24,
                  aster:12, apiaceae:14, allium:18, chenopod:16, lamiaceae:18 })[c.fam]) || 18;
};
Geom.canopyR = function(cropId, qty){
  /* the spread is for one plant; a clump of several needs the area to scale */
  const one = Habit.spread(cropId) / 2;
  return Math.round(one * Math.sqrt(Math.max(1, num(qty, 1))) * 10) / 10;
};
Geom.height = function(cropId){ return Habit.height(cropId); };
/* isTall closed over p8j's own height table, so every sourced height above was
   being ignored by the shading check — a four-foot cosmos read as a twelve-inch
   aster and shaded nothing. Rebind it to the same figure the rest of the app
   shows. */
Geom.isTall = function(cropId){ return Habit.height(cropId) >= 44; };
/* how many plants a patch of this radius really holds. It used psf, which is
   the square-foot-gardening density and does NOT match the in-row spacing the
   canvas measures root zones with — lettuce is 4/sq ft on a 6in grid but 8in
   apart in a row. One basis, and it is the spacing. */
Geom.fitsIn = function(cropId, r){
  const c = crop(cropId); if(!c) return 1;
  const sp = Math.max(1, num(c.sp, 12));
  /* the exact inverse of rootR, which sets a clump of N at (sp/2)*sqrt(N) —
     so asking how many fit in that radius gives N back, not N times pi/4 */
  return Math.max(1, Math.round((2 * r / sp) * (2 * r / sp)));
};

/* ---- and surface the provenance where the number is shown ---- */
(function habitInSheet(){
  const orig = Garden.plantingSheet.bind(Garden);
  Garden.plantingSheet = function(p){
    orig(p);
    if(!p) return;
    const body = $("#sheet-body"); if(!body) return;
    const pr = Habit.provenance(p.crop_id);
    let h = '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Where these sizes come from</div>';
    h += '<div class="tiny"><b>Spread ' + pr.spread.value + '″</b>' +
      (pr.spread.derived ? ' <span class="chip warn tiny">estimate</span>' : '') + '<br>' + esc(pr.spread.how) + '</div>';
    h += '<div class="tiny" style="margin-top:8px"><b>Height ' + pr.height.value + '″</b>' +
      (pr.height.derived ? ' <span class="chip warn tiny">estimate</span>' : '') + '<br>' + esc(pr.height.how) + '</div>';
    if(pr.note) h += '<div class="note i" style="margin-top:10px">' + esc(pr.note) + '</div>';
    if(pr.src) h += '<div class="tiny muted" style="margin-top:8px">' + esc(pr.src.org) + ' — <a href="' +
      esc(pr.src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(pr.src.n) + ' ↗</a></div>';
    h += '<div class="tiny muted" style="margin-top:8px">Whatever the book says, your own garden outranks it — resize the plant and the app remembers.</div></div>';
    const anchor = '<div class="grid2" style="margin-top:16px">';
    if(body.innerHTML.indexOf(anchor) >= 0) body.innerHTML = body.innerHTML.replace(anchor, h + anchor);
    else body.insertAdjacentHTML("beforeend", h);
  };
})();
</script>
