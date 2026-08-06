<script>
/* ============================================================
   WHAT A PLANT LOOKS LIKE ON THE CANVAS

   The first version of this drew every plant procedurally — its own
   leaves, its own angles, no two alike. It looked like a garden and
   was useless: a bed of green blobs with "Tomato" written under one
   of them tells you nothing at a glance, which is the one thing a
   plan has to do.

   So the icon is the crop itself. A tomato looks like a tomato.

   Everything organic about the canvas lives in the two circles that
   Canvas draws around it — the root zone and the mature canopy, both
   translucent so overlaps read properly — and in the fact that those
   circles are real measured sizes. The icon only has to answer
   "what is planted here", and the label under it answers "which
   variety", because by August that is the question you are actually
   asking.

   What stays from the old version is the part that was doing real
   work: growth. A plant is drawn small in May and full size in
   August, scaled by its own days to maturity, and a bed previewed
   before its sowing date shows an intention rather than a plant.
   ============================================================ */

const PlantArt = (() => {

  /* ---------- growth habit ----------
     No longer drives the drawing, but it still describes the plant
     honestly, and the size and colour work reads off it. */
  const ARCH = {
    lettuce:"rosette", cabbage:"rosette", spinach:"rosette", chard:"rosette",
    kale:"rosette", arugula:"rosette", bokchoy:"rosette", mustard:"rosette",
    broccoli:"rosette", cauliflower:"rosette", collards:"rosette", kohlrabi:"rosette",

    tomato:"bush", pepper:"bush", hotpepper:"bush", eggplant:"bush", tomatillo:"bush",
    bushbean:"bush", basil:"bush", oregano:"bush", thyme:"bush", sage:"bush",
    rosemary:"bush", mint:"bush", marigold:"bush", nasturtium:"bush", borage:"bush",
    potato:"bush", okra:"bush", brussels:"bush",

    cucumber:"vine", zucchini:"vine", wintersquash:"vine", pumpkin:"vine",
    melon:"vine", watermelon:"vine", sweetpotato:"vine",

    carrot:"fern", dill:"fern", fennel:"fern", cilantro:"fern", parsley:"fern",

    onion:"strap", garlic:"strap", leek:"strap", chive:"strap", shallot:"strap",
    asparagus:"strap",

    corn:"grass",

    polebean:"climb", pea:"climb",

    beet:"root", radish:"root", turnip:"root", parsnip:"root", celery:"root",
    strawberry:"root", rhubarb:"root"
  };
  const ARCH_FAM = {
    cucurbit:"vine", poaceae:"grass", allium:"strap", apiaceae:"fern",
    solanaceae:"bush", legume:"bush", brassica:"rosette", aster:"rosette",
    chenopod:"rosette", lamiaceae:"bush"
  };
  function archetype(cropId){
    if(ARCH[cropId]) return ARCH[cropId];
    const c = crop(cropId);
    return (c && ARCH_FAM[c.fam]) || "bush";
  }

  /* the ripe colour, used to tint the canopy so a bed reads at a glance
     even when the icons are too small to make out */
  const FRUIT = {
    tomato:"#d8402f", tomatillo:"#a8bf46", pepper:"#d4402c", hotpepper:"#c2302a",
    eggplant:"#6b3f8f", cucumber:"#2f7a35", zucchini:"#3f8a3a", wintersquash:"#d08420",
    pumpkin:"#e07b18", melon:"#d6c05c", watermelon:"#2f6b3a", corn:"#e8c34a",
    bushbean:"#63a44e", polebean:"#54a047", pea:"#74b85c", okra:"#5f9c3c",
    radish:"#d24a5a", beet:"#8f2f52", carrot:"#e07b28", turnip:"#c9b8d0",
    onion:"#c9a06a", garlic:"#e6ded0", strawberry:"#e0424f", sunflower:"#f0c020",
    marigold:"#f0a020", nasturtium:"#e8743d", broccoli:"#3f7a3f",
    cauliflower:"#eee6cf", cabbage:"#7fae6a", potato:"#c9a878"
  };

  /* ---------- a repeatable random stream per planting ----------
     Still here: the soil texture uses it, and it keeps the small
     tilt on each icon consistent between renders. */
  function rng(seed){
    let a = (seed >>> 0) || 1;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const R1 = (r, lo, hi) => lo + r() * (hi - lo);

  function palette(cropId, r){
    const c = crop(cropId);
    const arch = archetype(cropId);
    let hue = 108, sat = 38, lit = 34;
    if(arch === "strap"){ hue = 128; sat = 30; lit = 38; }
    else if(arch === "fern"){ hue = 112; sat = 44; lit = 40; }
    else if(arch === "grass"){ hue = 92;  sat = 40; lit = 40; }
    else if(arch === "vine"){ hue = 104; sat = 42; lit = 31; }
    else if(arch === "rosette"){ hue = 96; sat = 42; lit = 38; }
    if(c && c.fam === "brassica"){ hue = 148; sat = 26; lit = 40; }
    if(c && c.fam === "chenopod"){ hue = 132; sat = 34; lit = 33; }
    if(r){ hue += R1(r, -9, 9); sat += R1(r, -5, 6); lit += R1(r, -4, 5); }
    const H = (v, s, l) => "hsl(" + Math.round(v) + " " + Math.round(s) + "% " + Math.round(l) + "%)";
    return {
      leaf:  H(hue, sat, lit),
      light: H(hue + 6, sat + 6, lit + 11),
      dark:  H(hue - 6, sat + 4, Math.max(14, lit - 10)),
      stem:  H(hue - 4, sat - 6, Math.max(16, lit - 6)),
      fruit: FRUIT[cropId] || ((c && FAMILY[c.fam]) ? FAMILY[c.fam].c : "#d8402f")
    };
  }

  /* ---------- how far along it is on a given date ---------- */
  function growth(p, when){
    const c = crop(p.crop_id);
    if(!c) return 1;
    const sown = parseISO(p.sown_on) || parseISO(String(p.created || "").slice(0, 10));
    if(!sown) return 1;
    let dtm = num(c.dtm, 70);
    /* the gardener's own recorded timing beats the catalogue, same as everywhere else */
    if(typeof Maturity !== "undefined" && Maturity.expected){
      const mx = Maturity.expected(p.crop_id, p.variety);
      if(mx && mx.lo && mx.hi) dtm = (mx.lo + mx.hi) / 2;
    }
    const days = diffDays(sown, when || today());
    if(days < 0) return -1;                       /* not sown yet on this date */
    /* something set out as a transplant is already a plant, not a seed */
    const base = c.from === "transplant" ? 0.24 : 0;
    return clamp(base + (1 - base) * days / Math.max(14, dtm), 0, 1.18);
  }
  function stage(g){
    if(g < 0) return "unsown";
    if(g < 0.10) return "seedling";
    if(g < 0.42) return "young";
    if(g < 0.80) return "growing";
    if(g < 1.02) return "mature";
    return "over";
  }
  /* the drawn size relative to full spread — a seedling is not a small adult,
     but it is genuinely smaller, and that is the point of the scrubber */
  function sizeAt(g){
    if(g < 0) return 0;
    return clamp(0.16 + 0.84 * Math.pow(clamp(g, 0, 1), 0.72), 0.16, 1);
  }

  /* what to show for this crop. The emoji in the crop table is the icon —
     it is the same one used in every list in the app, so a bed and the
     "growing here" list underneath it agree. */
  function icon(cropId){
    const c = crop(cropId);
    return (c && c.e) || "🌱";
  }

  /* ============================================================
     THE DRAWING — one <g> in a unit circle of radius 1, which the
     canvas scales to the size the icon should actually appear at.

     R is how much of that unit circle the art actually fills, and it
     is exported because the canvas has to fit the icon inside a
     measured circle: scale × R is the radius the drawing really
     occupies. Nothing below may reach further than R from the origin.
     The widest thing here is a seedling — the 🌱 badge sits at
     (0.5, -0.45) at font-size 0.7, so it ends at 0.85 — with the soil
     shadow (0.62 + 0.2) and the mature glyph (font-size 1.55, half an
     em either side = 0.775) both just inside it. Change the drawing
     and this number changes with it.
     ============================================================ */
  const R = 0.85;

  function svg(p, opts){
    const o = opts || {};
    const g = o.growth === undefined ? growth(p, o.when) : o.growth;
    const seed = num(p.sv, 0) || Geom.hash(p.id);
    const r = rng(seed);
    const pal = palette(p.crop_id, r);

    if(g < 0){
      /* not yet sown on the date being previewed — show the intention */
      return '<g opacity="0.55">' +
        '<circle r="0.55" fill="none" stroke="' + pal.stem +
        '" stroke-width="0.16" stroke-dasharray="0.34 0.28"/></g>';
    }

    /* a small consistent tilt so a row of the same crop does not read as
       a row of stamps, but nowhere near enough to make it hard to identify */
    const tilt = Math.round(clamp(num(p.rot, 0) * 0.3, -8, 8));
    const young = g < 0.10;
    return '<g transform="rotate(' + tilt + ')"' + (g > 1.02 ? ' opacity="0.75"' : '') + '>' +
      /* a soft shadow so the icon sits on the soil rather than floating */
      '<ellipse cx="0" cy="0.62" rx="0.62" ry="0.2" fill="#2b2118" fill-opacity="0.28"/>' +
      '<text x="0" y="0" text-anchor="middle" dominant-baseline="central" ' +
      'font-size="' + (young ? 1.05 : 1.55) + '" ' +
      'style="font-size:' + (young ? 1.05 : 1.55) + 'px">' + icon(p.crop_id) + '</text>' +
      (young ? '<text x="0.5" y="-0.45" text-anchor="middle" dominant-baseline="central" ' +
               'font-size="0.7" style="font-size:0.7px">🌱</text>' : '') +
      '</g>';
  }

  return { svg: svg, growth: growth, stage: stage, sizeAt: sizeAt, icon: icon, R: R,
           archetype: archetype, palette: palette, rng: rng, ARCH: ARCH, FRUIT: FRUIT };
})();
</script>
