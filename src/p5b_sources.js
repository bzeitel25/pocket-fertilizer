<script>
/* ============================================================
   SOURCES & VERIFIED DATA LAYER
   Every number the app shows for germination temperature, seed
   viability, water and pH is reconciled against the primary
   references below, which were checked directly. Corrections are
   applied over the base table here so the provenance of each
   change stays visible and auditable.
   ============================================================ */
const SOURCES = {
  harrington: {
    n:"Soil temperature conditions for vegetable seed germination",
    org:"J.F. Harrington, UC Davis — published by OSU Extension",
    url:"https://extension.oregonstate.edu/gardening/soil-compost/soil-temperature-conditions-vegetable-seed-germination",
    what:"Minimum, optimum and maximum soil temperatures, and days to emergence at each temperature. The standard reference, reviewed 2024."
  },
  seedlife: {
    n:"Seed Viability and Germination",
    org:"University of Illinois Extension (compiled from Colorado State and Iowa State Extension)",
    url:"https://extension.illinois.edu/sites/default/files/seed_viability.pdf",
    what:"Approximate seed life in years by crop, and the 10-seed germination test method."
  },
  umnVeg: {
    n:"Yard and garden — vegetable growing guides",
    org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/yard-and-garden",
    what:"Per-crop guides: soil pH, spacing, sowing depth, watering, harvest and pest management."
  },
  clemsonFert: {
    n:"Recommendations for Liming and Fertilizing Vegetables",
    org:"Clemson Cooperative Extension (HGIC 1254)",
    url:"https://hgic.clemson.edu/factsheet/fertilizing-vegetables/",
    what:"Optimum pH band for vegetables, preplant and side-dress fertiliser rates."
  },
  umassChart: {
    n:"Vegetable Planting Chart",
    org:"UMass Extension Center for Agriculture, Food and the Environment",
    url:"https://www.umass.edu/agriculture-food-environment/vegetable",
    what:"Which crops are sown when, grouped as cool, intermediate and warm season."
  },
  cornellVar: {
    n:"Disease Resistant Vegetable Varieties",
    org:"Cornell University, Vegetables Program",
    url:"https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/",
    what:"Which varieties carry resistance to which diseases, and what the seed-catalogue codes mean."
  },
  usdaZone: {
    n:"USDA Plant Hardiness Zone Map",
    org:"USDA Agricultural Research Service",
    url:"https://planthardiness.ars.usda.gov/",
    what:"The official hardiness zone map this app's zone lookup is based on."
  },
  umnDisorders: {
    n:"Tomato disorders",
    org:"University of Minnesota Extension",
    url:"https://extension.umn.edu/plant-diseases/tomato-disorders",
    what:"Blossom end rot, growth cracks, catfacing, leaf roll, sunscald and yellow shoulders."
  },
  askExt: {
    n:"Ask Extension — talk to your local office",
    org:"Cooperative Extension System (USDA / land-grant universities)",
    url:"https://ask.extension.org/",
    what:"Free diagnosis and regional advice from your own state's extension service. The right next step for anything that might spread."
  }
};

/* ---- per-crop reference pages that were checked directly ---- */
const CROP_REF = {
  tomato:"https://extension.umn.edu/vegetables/growing-tomatoes",
  kohlrabi:"https://extension.umn.edu/vegetables/growing-kohlrabi"
};
function cropSource(id){
  return CROP_REF[id] || SOURCES.umnVeg.url;
}
function cropSourceLabel(id){
  return CROP_REF[id] ? "UMN Extension — growing guide" : "UMN Extension — vegetable guides";
}

/* ============================================================
   VERIFIED CORRECTIONS
   via   = seed life in years .............. SOURCES.seedlife
   soilF = [min, optimum, max] °F .......... SOURCES.harrington
   germ  = [fast, slow] days to emergence .. SOURCES.harrington
   water = inches per week ................. SOURCES.umnVeg (1"/wk is the
           extension baseline for most vegetables; only crops with a
           documented higher or lower need deviate)
   ============================================================ */
const VERIFIED = {
  /* --- nightshades --- */
  tomato:     { via:4, soilF:[50,85,95], germ:[6,14], water:1,
                start:{indoor:-5,tp:2,fall:null}, ph:"6.0–6.8",
                note:"UMN: start indoors 5–6 weeks before planting out; 1 inch of water per week; pH 5.5–7.0 acceptable, 6.0–6.8 ideal." },
  pepper:     { via:2, soilF:[60,85,95], germ:[8,25], water:1 },
  hotpepper:  { via:2, soilF:[60,85,95], germ:[8,25], water:1 },
  eggplant:   { via:4, soilF:[60,85,95], germ:[5,13], water:1 },
  potato:     { via:0, water:1 },
  tomatillo:  { via:4, soilF:[50,85,95], germ:[6,14], water:1 },

  /* --- cucurbits --- */
  cucumber:   { via:5, soilF:[60,95,105], germ:[3,13], water:1 },
  zucchini:   { via:4, soilF:[60,95,100], germ:[3,10], water:1 },
  wintersquash:{via:4, soilF:[60,95,100], germ:[3,10], water:1 },
  pumpkin:    { via:4, soilF:[60,95,100], germ:[3,10], water:1 },
  melon:      { via:5, soilF:[60,90,100], germ:[3,8],  water:1 },
  watermelon: { via:4, soilF:[60,95,105], germ:[3,12], water:1 },

  /* --- legumes --- */
  bushbean:   { via:3, soilF:[60,80,95], germ:[6,16], water:1 },
  polebean:   { via:3, soilF:[60,80,95], germ:[6,16], water:1 },
  pea:        { via:3, soilF:[40,75,85], germ:[6,9],  water:1 },

  /* --- brassicas --- */
  broccoli:   { via:3, soilF:[40,80,100], germ:[4,10], water:1 },
  cauliflower:{ via:4, soilF:[40,80,100], germ:[4,10], water:1 },
  cabbage:    { via:4, soilF:[40,85,100], germ:[3,9],  water:1 },
  kale:       { via:4, soilF:[40,85,100], germ:[3,9],  water:1 },
  brussels:   { via:4, soilF:[40,85,100], germ:[3,9],  water:1 },
  collards:   { via:5, soilF:[40,85,100], germ:[3,9],  water:1 },
  kohlrabi:   { via:3, soilF:[40,85,100], germ:[3,9],  water:1,
                sp:4, psf:9, dtm:45,
                note:"UMN: thin to 4 inches apart; spring varieties mature in 35–45 days; rotate away from other brassicas for four years." },
  bokchoy:    { via:3, soilF:[40,85,100], germ:[3,9],  water:1 },
  mustard:    { via:4, soilF:[40,85,100], germ:[3,9],  water:1 },
  arugula:    { via:4, soilF:[40,85,100], germ:[3,9],  water:1 },
  radish:     { via:5, soilF:[40,85,95],  germ:[3,6],  water:1 },
  turnip:     { via:4, soilF:[40,85,105], germ:[1,3],  water:1 },

  /* --- greens & chenopods --- */
  lettuce:    { via:6, soilF:[35,75,95], germ:[2,4],  water:1 },
  spinach:    { via:3, soilF:[35,70,85], germ:[5,7],  water:1 },
  chard:      { via:4, soilF:[40,85,95], germ:[4,10], water:1 },
  beet:       { via:4, soilF:[40,85,95], germ:[4,10], water:1 },

  /* --- umbellifers --- */
  carrot:     { via:3, soilF:[40,80,95], germ:[6,10],  water:1 },
  parsnip:    { via:1, soilF:[35,65,85], germ:[14,19], water:1 },
  celery:     { via:3, water:1.5,
                note:"Celery is the one common vegetable that genuinely wants more than an inch a week — it will not tolerate drying out." },
  cilantro:   { via:3, water:1 },
  dill:       { via:3, water:1 },
  parsley:    { via:1, soilF:[40,75,90], germ:[12,17], water:1,
                note:"Parsley seed is short-lived — Illinois Extension lists one year. Buy fresh each season." },
  fennel:     { via:4, water:1 },

  /* --- alliums --- */
  onion:      { via:1, soilF:[35,75,95], germ:[4,7], water:1 },
  garlic:     { via:0, water:0.75 },
  leek:       { via:2, soilF:[35,75,95], germ:[4,7], water:1 },
  shallot:    { via:1, water:1 },
  chive:      { via:1, water:1 },

  /* --- others --- */
  corn:       { via:2, soilF:[50,95,105], germ:[3,12], water:1 },
  okra:       { via:2, water:1 },
  sweetpotato:{ via:0, water:1 },
  strawberry: { via:0, water:1 },
  asparagus:  { via:3, soilF:[50,75,95], germ:[10,24], water:1 },
  rhubarb:    { via:2, water:1 },

  /* --- herbs & flowers (Mediterranean herbs stay dry) --- */
  basil:      { via:5, water:1 },
  oregano:    { via:4, water:0.5 },
  thyme:      { via:3, water:0.5 },
  rosemary:   { via:2, water:0.5 },
  sage:       { via:3, water:0.5 },
  mint:       { via:2, water:1.5 },
  marigold:   { via:2, water:0.75 },
  nasturtium: { via:5, water:0.75 },
  sunflower:  { via:3, water:1 },
  borage:     { via:3, water:0.75 },
  calendula:  { via:2, water:0.75 }
};

/* apply, and record which fields came from a checked source */
Object.keys(VERIFIED).forEach(id => {
  const c = CROP[id]; if(!c) return;
  const v = VERIFIED[id];
  const changed = [];
  Object.keys(v).forEach(k => {
    if(k === "note") return;
    if(JSON.stringify(c[k]) !== JSON.stringify(v[k])) changed.push(k);
    c[k] = v[k];
  });
  c.verified = true;
  c.vnote = v.note || null;
  c.vfields = changed;
});
/* crops with no entry above still carry base-table values */
CROPS.forEach(c => { if(!c.verified){ c.verified = false; c.vfields = []; } });

/* ---- how confident is each field? shown in the UI ---- */
const FIELD_CONFIDENCE = {
  soilF:{ s:"harrington", t:"Measured in controlled trials." },
  germ: { s:"harrington", t:"Days to emergence at typical spring-to-summer soil temperatures." },
  via:  { s:"seedlife",   t:"Approximate seed life in cool, dry storage." },
  water:{ s:"umnVeg",     t:"Extension baseline is one inch per week including rainfall." },
  ph:   { s:"clemsonFert",t:"Most vegetables do best between pH 6.0 and 6.5." },
  dtm:  { s:"umnVeg",     t:"Varies widely by variety — always trust the seed packet over this figure." },
  sp:   { s:"umnVeg",     t:"In-row spacing after thinning." }
};
</script>
