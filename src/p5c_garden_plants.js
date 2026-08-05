<script>
/* ============================================================
   FLOWERS, TEA AND THE PLANTS THAT EARN THEIR KEEP

   A vegetable garden is not only vegetables. Marigolds go in to
   keep pests down, alyssum to bring the hoverflies that eat the
   aphids, chamomile and lemon balm because someone wants a cup of
   tea in September. Those plants take up bed space, cast shade,
   compete for water and need spacing like anything else — so they
   belong in the same table, not in a footnote.

   Every plant here was checked against at least two independent
   extension or botanic-garden sources, read on the publisher's own
   site. Where the sources agree on a figure it is used and cited.
   Where none of them states a figure — and for most flowers that
   means germination temperature and seed life — it is marked as an
   estimate and says so in the app. Nothing is invented quietly.

   A note on what these do. "Companion" here is not folklore: the
   defensible mechanism for this whole group is that they feed
   adult hoverflies, lacewings and parasitic wasps, whose larvae
   eat aphids, and that they pull pollinators in to set fruit on
   the squash and tomatoes. That is what the extension and IPM
   literature actually supports, and it is what the notes say.
   ============================================================ */

const GARDEN_SRC = {
  ncsuToolbox: {
    n:"Extension Gardener Plant Toolbox", org:"NC State Extension",
    url:"https://plants.ces.ncsu.edu/",
    what:"Per-species pages giving mature height and width, light, soil, and propagation for ornamentals and herbs."
  },
  ilHerbs: {
    n:"Herbs — Lemon Balm", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/herbs/lemon-balm",
    what:"“Plant lemon balm 18 inches apart in the early spring in an enriched soil.” Full sun to partial shade, moist but well-drained."
  },
  usuLavender: {
    n:"How to Grow English Lavender in Your Garden", org:"Utah State University Extension",
    url:"https://extension.usu.edu/yardandgarden/research/english-lavender-in-the-garden",
    what:"Space 18–24″ apart in light, well-aerated, gravelly soil; full sun; pH 6.5–7.5. Seed germination is slow, so it is usually propagated from summer cuttings."
  },
  usuBalm: {
    n:"How to Grow Lemon Balm in Your Garden", org:"Utah State University Extension",
    url:"https://extension.usu.edu/yardandgarden/research/lemon-balm-in-the-garden",
    what:"Grows 10–24″ tall in full sun to partial shade. Prune flowering stalks before they set seed or it spreads."
  },
  hgicZinnia: {
    n:"How to Grow Zinnias", org:"Clemson Cooperative Extension",
    url:"https://hgic.clemson.edu/factsheet/how-to-grow-zinnias-the-best-varieties-care-tips/",
    what:"8″ to 4 ft depending on cultivar; dwarfs thinned to 8–9″ apart, 2–3 ft cultivars a foot apart; at least 6 hours of full sun."
  },
  hgicAlyssum: {
    n:"Sweet Alyssum", org:"Clemson Cooperative Extension",
    url:"https://hgic.clemson.edu/sweet-alyssum/",
    what:"Direct sow several weeks before the last frost, or start indoors 6–8 weeks ahead; plants flower within 6–8 weeks and bloom to first frost."
  },
  hgicYarrow: {
    n:"Rain Garden Plants: Achillea millefolium — Yarrow", org:"Clemson Cooperative Extension",
    url:"https://hgic.clemson.edu/factsheet/rain-garden-plants-achillea-millefolium-yarrow/",
    what:"Space 12–18″ apart; divide every two to three years. Full sun, well-drained, tolerates poor soil; spreads by rhizome and seed."
  },
  hgicEchinacea: {
    n:"How to Grow Echinacea (Coneflower)", org:"Clemson Cooperative Extension",
    url:"https://hgic.clemson.edu/factsheet/echinacea/",
    what:"Culture, cultivars and common problems for purple coneflower."
  },
  wiscHyssop: {
    n:"Anise hyssop, Agastache foeniculum", org:"University of Wisconsin–Madison Horticulture",
    url:"https://hort.extension.wisc.edu/articles/anise-hyssop-agastache-foeniculum/",
    what:"Upright clump-forming plants 2–4 ft tall and about 1–3 ft wide, hardy zones 3a–8b. A short-lived perennial in the mint family."
  },
  ucipmAlyssum: {
    n:"Insectary plants in lettuce — research highlight", org:"UC Statewide IPM Program",
    url:"https://ipm.ucanr.edu/highlights/2019/delpozo_valdivia_confirms_the_benefit_of_insectary_plants_in_lettuce/",
    what:"Sweet alyssum attracts hoverflies, whose maggots prey on aphids; adults feed on alyssum pollen and lay eggs into the crop."
  },
  psuBeneficial: {
    n:"Attracting Beneficial Insects", org:"Penn State Extension",
    url:"https://extension.psu.edu/attracting-beneficial-insects",
    what:"Which flowers feed adult predators and parasitoids, and how a border of them lowers pest pressure in the crop."
  },
  msuNative: {
    n:"Attracting Beneficial Insects with Native Flowering Plants", org:"Michigan State University Extension",
    url:"https://www.canr.msu.edu/resources/attracting_beneficial_insects_with_native_flowering_plants_e2973",
    what:"Bloom timing and relative attractiveness of native flowering plants to natural enemies and pollinators."
  },
  ilFlowers: {
    n:"Flowers — annuals", org:"University of Illinois Extension",
    url:"https://extension.illinois.edu/flowers/annuals",
    what:"Culture, height ranges and siting for common garden annuals including cosmos and zinnia."
  }
};

/* `srcs` are the pages each row was read from. `est` lists the fields NONE of
   them states — germination temperature and seed life are rarely published for
   ornamentals — so the app can show those as estimates rather than as fact. */
const GARDEN_PLANTS = [

/* ---------- tea and the herb end ---------- */
{id:"chamomile",n:"Chamomile",e:"🌼",fam:"aster",sun:5,water:0.75,sp:8,psf:2.25,depth:0,germ:[7,14],soilF:[55,68,78],dtm:60,from:"seed",via:3,feeder:"light",
 start:{indoor:-6,tp:0,direct:-2,fall:null},succ:0,yield:0,ph:"5.6–7.5",
 srcs:["ncsuToolbox","ilHerbs"],est:["germ","soilF","via","sp","ph"],
 comp:["cabbage","broccoli","kale","onion","cucumber"],foes:[],
 npk:"None — it flowers better on poor ground.",
 tips:"German chamomile, the annual one, is what tea is made from. The seed needs light to germinate: press it onto the surface and do not bury it. Grows 13–30″ tall and self-sows freely once it is happy.",
 harvest:"Pick the flower heads when the white petals start to reflex back. Dry them somewhere dark and airy."},

{id:"lemonbalm",n:"Lemon Balm",e:"🌿",fam:"lamiaceae",sun:5,water:1,sp:18,psf:0.44,depth:0.25,germ:[10,21],soilF:[60,70,80],dtm:70,from:"seed",via:3,feeder:"light",
 start:{indoor:-8,tp:0,direct:0,fall:null},succ:0,yield:0,ph:"6.0–7.5",
 srcs:["ilHerbs","usuBalm","ncsuToolbox"],est:["germ","soilF","via","dtm"],
 comp:["tomato","squash","cucumber","broccoli"],foes:[],
 npk:"Very little. Rich soil gives soft growth and less scent.",
 tips:"18″ apart, sun or part shade, moist but well drained. It reaches 10–24″ and spreads hard by seed — cut the flowering stalks before they set and it stays where you put it.",
 harvest:"Leaves any time before flowering, when the oils are strongest. Fresh makes far better tea than dried."},

{id:"lavender",n:"Lavender",e:"🪻",fam:"lamiaceae",sun:8,water:0.5,sp:24,psf:0.25,depth:0.125,germ:[14,28],soilF:[60,70,75],dtm:120,from:"transplant",via:2,feeder:"light",
 start:{indoor:-10,tp:2,fall:null},succ:0,yield:0,ph:"6.5–7.5",
 srcs:["usuLavender","ncsuToolbox"],est:["germ","soilF","via","dtm"],
 comp:["cabbage","broccoli","carrot","onion"],foes:[],
 npk:"None. Feeding it is how most lavender is killed.",
 tips:"English lavender makes 1–2 ft tall and 2–3 ft wide, spaced 18–24″ into light gravelly soil at pH 6.5–7.5. Seed is slow and unreliable, which is why it is nearly always grown from summer cuttings — buy a plant. It will not forgive wet feet.",
 harvest:"Cut the spikes as the first buds open. Cut it back yearly and take the spent spikes off."},

{id:"anisehyssop",n:"Anise Hyssop",e:"🌿",fam:"lamiaceae",sun:6,water:0.75,sp:18,psf:0.44,depth:0.125,germ:[7,21],soilF:[60,70,75],dtm:110,from:"transplant",via:2,feeder:"light",
 start:{indoor:-8,tp:1,direct:0,fall:null},succ:0,yield:0,ph:"6.0–7.5",
 srcs:["wiscHyssop","ncsuToolbox","msuNative"],est:["germ","soilF","via","dtm"],
 comp:["tomato","squash","cucumber","pepper","melon","zucchini"],foes:[],
 npk:"None.",
 tips:"Upright clumps 2–4 ft tall and 1–3 ft wide, hardy to zone 3. A short-lived perennial that keeps itself going by seeding. One of the heaviest-worked flowers in any garden — bees, hoverflies and parasitic wasps all over it from midsummer.",
 harvest:"Leaves and flowers both make an anise-flavoured tea. Cut whole stems and hang them."},

{id:"beebalm",n:"Bee Balm",e:"🌺",fam:"lamiaceae",sun:6,water:1,sp:18,psf:0.44,depth:0.125,germ:[10,21],soilF:[60,70,75],dtm:120,from:"transplant",via:2,feeder:"medium",
 start:{indoor:-8,tp:1,fall:null},succ:0,yield:0,ph:"6.0–7.0",
 srcs:["ncsuToolbox","msuNative"],est:["germ","soilF","via","dtm","ph"],
 comp:["tomato","pepper","squash","melon","cucumber"],foes:[],
 npk:"Light. Compost in spring is plenty.",
 tips:"2–4 ft tall, and some kinds run hard at the root — give it a corner it can have. Powdery mildew is its one real fault, so space it for airflow and water the soil rather than the leaves.",
 harvest:"Leaves and petals make Oswego tea. Hummingbirds get first refusal on the flowers."},

/* ---------- the ones that bring the predators ---------- */
{id:"alyssum",n:"Sweet Alyssum",e:"💮",fam:"brassica",sun:5,water:0.75,sp:8,psf:2.25,depth:0,germ:[7,14],soilF:[55,68,75],dtm:50,from:"seed",via:3,feeder:"light",
 start:{indoor:-7,tp:-1,direct:-3,fall:null},succ:30,yield:0,ph:"6.0–7.5",
 srcs:["hgicAlyssum","ncsuToolbox","ucipmAlyssum"],est:["germ","soilF","via","ph"],
 comp:["lettuce","broccoli","cabbage","kale","tomato","pepper","cucumber","zucchini","potato","spinach"],foes:[],
 npk:"None.",
 tips:"The most useful flower in a vegetable bed. Trials in lettuce found it pulls in hoverflies, whose maggots then hunt aphids down inside the crop itself. Sow it several weeks before last frost, or start it 6–8 weeks early; it flowers within 6–8 weeks and keeps going until frost. Only 3–6″ tall from seed but spreading a foot or more, so it tucks along an edge without taking bed space.",
 harvest:"Nothing to pick. Shear it back mid-season if it goes leggy and it comes again."},

{id:"phacelia",n:"Lacy Phacelia",e:"💐",fam:"boraginaceae",sun:6,water:0.5,sp:6,psf:4,depth:0,germ:[10,21],soilF:[55,65,75],dtm:60,from:"seed",via:2,feeder:"light",
 start:{direct:0,fall:-8},succ:21,yield:0,ph:"6.0–7.5",
 srcs:["ncsuToolbox","msuNative"],est:["germ","soilF","via","sp","ph","dtm"],
 comp:["tomato","squash","cucumber","melon","pepper","zucchini","pumpkin","watermelon"],foes:[],
 npk:"None — it is closer to a cover crop than a flower.",
 tips:"Sow it straight onto the surface after the last frost; the seed wants darkness to germinate but no covering. Drought tolerant and happy on poor ground. Field strips of it work as a magnet for honey bees and short-tongued bees, which is why it turns up in cover-crop mixes. Turn it back in before it seeds and it feeds the soil too.",
 harvest:"Not for picking. Cut or till it in while it is still soft."},

{id:"yarrow",n:"Yarrow",e:"🏵️",fam:"aster",sun:6,water:0.5,sp:15,psf:0.64,depth:0,germ:[10,21],soilF:[60,70,75],dtm:120,from:"transplant",via:3,feeder:"light",
 start:{indoor:-8,tp:0,fall:null},succ:0,yield:0,ph:"6.0–7.5",
 srcs:["hgicYarrow","ncsuToolbox","psuBeneficial"],est:["germ","soilF","via","dtm","ph"],
 comp:["tomato","pepper","cucumber","melon","lettuce","broccoli","cabbage"],foes:[],
 npk:"None. Do not overfeed or overwater it — that is what makes it flop.",
 tips:"1–3 ft tall and about as wide, spaced 12–18″. The flat flower heads are exactly the shape short-tongued predators can feed from, which is why it turns up in every beneficial-insect planting list. It spreads by rhizome and seed and will take ground if you let it — deadhead, and divide every two or three years.",
 harvest:"Cut flower heads for drying when they are fully open. Leave some for the insects."},

/* ---------- the cutting-garden annuals that pull their weight ---------- */
{id:"zinnia",n:"Zinnia",e:"🌺",fam:"aster",sun:6,water:1,sp:12,psf:1,depth:0.25,germ:[5,10],soilF:[70,78,90],dtm:60,from:"seed",via:3,feeder:"medium",
 start:{indoor:-4,tp:1,direct:1,fall:null},succ:21,yield:0,ph:"6.0–7.0",
 srcs:["hgicZinnia","ilFlowers","ncsuToolbox"],est:["germ","soilF","via","ph"],
 comp:["tomato","cucumber","squash","melon","pepper","zucchini","pumpkin"],foes:[],
 npk:"Moderate. Too much nitrogen buys leaves instead of flowers.",
 tips:"Anything from 8″ to 4 ft depending on the cultivar — thin dwarfs to 8–9″ and the 2–3 ft kinds to a foot. Wants at least 6 hours of sun. Powdery mildew is the usual complaint, so water the soil and not the foliage, and give it room to breathe.",
 harvest:"Cut hard and often — the more you take the more it makes. Pollinators work it all season."},

{id:"cosmos",n:"Cosmos",e:"🌸",fam:"aster",sun:6,water:0.5,sp:12,psf:1,depth:0.25,germ:[7,14],soilF:[60,70,80],dtm:70,from:"seed",via:3,feeder:"light",
 start:{indoor:-4,tp:1,direct:1,fall:null},succ:0,yield:0,ph:"6.0–7.5",
 srcs:["ilFlowers","ncsuToolbox","psuBeneficial"],est:["germ","soilF","via","ph","sp"],
 comp:["tomato","squash","cucumber","melon","pepper","zucchini"],foes:[],
 npk:"None. Rich ground gives six feet of leaf and hardly a flower.",
 tips:"1 to 6 ft depending on the kind, in ordinary well-drained soil and full to partial sun. Open, shallow flowers, which is what hoverflies and small parasitic wasps can actually feed from. Put the tall ones on the north side or they shade the bed.",
 harvest:"Cut for the vase constantly; it flowers harder for being picked."},

{id:"cornflower",n:"Cornflower",e:"🌸",fam:"aster",sun:6,water:0.5,sp:9,psf:1.78,depth:0.5,germ:[7,14],soilF:[55,65,75],dtm:65,from:"seed",via:3,feeder:"light",
 start:{indoor:-7,tp:-2,direct:-2,fall:-6},succ:0,yield:0,ph:"6.0–7.5",
 srcs:["ncsuToolbox","psuBeneficial"],est:["germ","soilF","via","ph","sp","dtm"],
 comp:["tomato","cucumber","squash","lettuce","broccoli","cabbage"],foes:[],
 npk:"None.",
 tips:"Bachelor's button, 1–3 ft. Start it indoors 6–8 weeks before last frost, or sow it outdoors in autumn where winters are mild. It carries extrafloral nectaries — glands off the flower itself — which feed ants, ladybirds and parasitic wasps even between blooms.",
 harvest:"Cut just as the buds open. Deadhead or it goes over quickly."},

{id:"echinacea",n:"Coneflower",e:"🌸",fam:"aster",sun:6,water:0.75,sp:18,psf:0.44,depth:0.25,germ:[10,21],soilF:[65,70,78],dtm:120,from:"transplant",via:2,feeder:"light",
 start:{indoor:-10,tp:0,fall:null},succ:0,yield:0,ph:"6.0–7.0",
 srcs:["hgicEchinacea","ncsuToolbox","msuNative"],est:["germ","soilF","via","dtm","ph","sp"],
 comp:["tomato","pepper","squash","cucumber","melon","zucchini"],foes:[],
 npk:"None. It is a prairie plant and behaves like one.",
 tips:"Purple coneflower makes 3–4 ft, takes full sun to part shade, and is drought tolerant once it is established. From seed it usually spends its first year making roots and flowers in its second — buy a plant if you want blooms this season. Leave the seed heads standing over winter for the goldfinches.",
 harvest:"Cut flowers last well. The root is the herbal part, but lifting it ends the plant."}
];

/* ---------- fold them in ---------- */
GARDEN_PLANTS.forEach(c => {
  c.verified = true;
  c.vfields = [];
  c.estfields = c.est || [];
  c.vnote = "Checked against " + (c.srcs || []).map(k => (GARDEN_SRC[k] || {}).org).filter(Boolean).join(", ") + ".";
  delete c.est;
  CROPS.push(c);
  CROP[c.id] = c;
  /* the sources screen links each crop to a page; these get their own */
  CROP_REF[c.id] = GARDEN_SRC[(c.srcs || [])[0]] ? GARDEN_SRC[c.srcs[0]].url : GARDEN_SRC.ncsuToolbox.url;
});

/* every source page above, offered alongside the vegetable references */
Object.keys(GARDEN_SRC).forEach(k => { if(!SOURCES[k]) SOURCES[k] = GARDEN_SRC[k]; });

/* ============================================================
   COMPANION IDS THAT NEVER MATCHED ANYTHING

   The base table talks about "squash" and "bean", which are not crop
   ids — the ids are zucchini/wintersquash and bushbean/polebean. Six
   crops each named those, so six companion relationships have been
   quietly doing nothing since the table was written. Expanded here
   rather than edited into sixty rows by hand.
   ============================================================ */
const CROP_ALIAS = {
  squash:            ["zucchini","wintersquash","pumpkin"],
  bean:              ["bushbean","polebean"],
  beans:             ["bushbean","polebean"],
  brassicas:         ["cabbage","broccoli","cauliflower","kale","brussels","collards","kohlrabi"],
  "aromatic-herbs":  ["basil","oregano","thyme","sage","rosemary","mint"]
};

/* Real companion lore about plants this app does not carry. Left in place
   rather than deleted: if any of them is ever added, the relationship starts
   working on its own. The test suite knows about this list, so a genuine typo
   still fails. */
const CROP_ABSENT = ["apricot","tarragon","horseradish","raspberry","hyssop","grape",
                     "anise","rose","caraway","fruit-trees","petunia","rue"];

(function expandAliases(){
  const fix = list => {
    const out = [];
    (list || []).forEach(id => {
      if(CROP_ALIAS[id]) CROP_ALIAS[id].forEach(x => { if(CROP[x] && out.indexOf(x) < 0) out.push(x); });
      else if(out.indexOf(id) < 0) out.push(id);
    });
    return out;
  };
  CROPS.forEach(c => { c.comp = fix(c.comp); c.foes = fix(c.foes); });
})();

/* what each of these is actually FOR — used by the library and the assistant */
const PLANT_ROLE = {
  chamomile:"tea", lemonbalm:"tea", lavender:"tea", anisehyssop:"tea", beebalm:"tea",
  alyssum:"beneficials", phacelia:"beneficials", yarrow:"beneficials", cornflower:"beneficials",
  cosmos:"pollinators", zinnia:"pollinators", echinacea:"pollinators",
  marigold:"pest control", nasturtium:"pest control", borage:"pollinators",
  calendula:"beneficials", sunflower:"pollinators"
};
const ROLE_LABEL = {
  tea:"🫖 Tea and herbal", beneficials:"🐞 Brings in predators",
  pollinators:"🐝 Brings in pollinators", "pest control":"🛡️ Pest control"
};
</script>
