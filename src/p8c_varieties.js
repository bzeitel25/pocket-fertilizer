<script>
/* ============================================================
   VARIETIES
   A reference list of long-established varieties, plus anything
   the gardener adds herself or looks up with the assistant.

   Days to maturity here is the figure seed catalogues broadly
   agree on for these varieties. It still shifts with climate and
   season — the packet in her hand always wins. Disease-resistance
   codes are only listed where they are a settled part of the
   variety's identity; Cornell's list is the authority:
   https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/
   ============================================================ */
const VARIETY_REF = [
/* tomato */
["tomato","Sungold",57,"Indeterminate cherry","","Orange cherry, exceptionally sweet. Prone to splitting after rain — pick promptly."],
["tomato","Sweet 100",65,"Indeterminate cherry","","Enormous trusses of small red cherries. Needs a tall support."],
["tomato","Early Girl",57,"Indeterminate","","The reliable early slicer. First ripe fruit weeks before the big beefsteaks."],
["tomato","Better Boy",75,"Indeterminate","VFN","Classic big red slicer. Stake heavily."],
["tomato","Big Beef",73,"Indeterminate","VFFNTA","Beefsteak size with unusually broad disease resistance."],
["tomato","Celebrity",70,"Determinate","VFFNT","Compact and dependable — a good choice for containers and short seasons."],
["tomato","Roma",75,"Determinate paste","VF","Dense, low-moisture paste tomato. Watch for blossom end rot in dry spells."],
["tomato","San Marzano",80,"Indeterminate paste","","The classic sauce tomato. Long season, worth the wait."],
["tomato","Amish Paste",85,"Indeterminate paste","","Larger and meatier than Roma, better flavour raw."],
["tomato","Cherokee Purple",80,"Indeterminate heirloom","","Dusky rose beefsteak, outstanding flavour. Soft skin, cracks easily."],
["tomato","Brandywine",85,"Indeterminate heirloom","","Benchmark heirloom flavour. Low yields and late — grow it for taste, not volume."],
["tomato","Black Krim",80,"Indeterminate heirloom","","Dark, slightly salty flavour. Shoulders stay green when ripe."],
["tomato","Green Zebra",78,"Indeterminate heirloom","","Ripe when green with yellow stripes and slightly soft — trust feel, not colour."],
["tomato","Mortgage Lifter",85,"Indeterminate heirloom","","Very large mild pink fruit. Needs serious support."],
/* peppers */
["pepper","California Wonder",75,"Bell","","The standard blocky green-to-red bell."],
["pepper","Banana (sweet)",70,"Sweet frying","","Long yellow tapering fruit, heavy yields, very early."],
["pepper","Shishito",60,"Frying","","Pick green and blister in a hot pan. Roughly one in ten is unexpectedly hot."],
["hotpepper","Jalapeño",75,"Hot","","Pick green for crunch, red for sweetness and more heat."],
["hotpepper","Serrano",75,"Hot","","Hotter and thinner-walled than jalapeño. Excellent fresh in salsa."],
["hotpepper","Cayenne, Long Slim",70,"Hot","","Dries beautifully on the plant or on a string."],
["hotpepper","Poblano / Ancho",75,"Mild hot","","Mild and meaty fresh; called ancho once dried."],
["hotpepper","Habanero",90,"Very hot","","Needs a long hot season. Start earliest of anything in the tray."],
/* cucumber */
["cucumber","Marketmore 76",65,"Slicing","Scab, CMV, DM, PM","The standard garden slicer, bred at Cornell for disease resistance."],
["cucumber","Straight Eight",58,"Slicing","","Long-time favourite. Trellis it for straight fruit."],
["cucumber","Boston Pickling",55,"Pickling","","Heavy set of small blocky fruit. Pick daily at 3–4 inches."],
["cucumber","Lemon",65,"Slicing heirloom","","Round yellow fruit, mild and never bitter."],
["cucumber","Suyo Long",60,"Asian slicing","","Long ribbed burpless fruit — needs a trellis to grow straight."],
["cucumber","Diva",58,"Slicing","","Seedless and bitter-free without pollination. Thin tender skin."],
/* squash */
["zucchini","Black Beauty",50,"Bush zucchini","","The dark green standard. Check daily once it starts."],
["zucchini","Costata Romanesco",52,"Bush zucchini","","Ribbed Italian type, far better flavour, lower yield."],
["zucchini","Yellow Crookneck",50,"Bush summer squash","","Best picked small, under 6 inches."],
["wintersquash","Waltham Butternut",105,"Vining winter squash","","Stores for months. Solid stems resist squash vine borer."],
["wintersquash","Delicata",100,"Semi-bush winter squash","","Edible skin, no peeling. Stores a shorter time than butternut."],
["wintersquash","Spaghetti",90,"Vining winter squash","","Flesh separates into strands when baked."],
["pumpkin","Sugar Pie",100,"Vining pie pumpkin","","Small and sweet — the one to actually cook with."],
["pumpkin","Connecticut Field",110,"Vining","","The classic large jack-o'-lantern. Give it serious room."],
/* beans & peas */
["bushbean","Provider",50,"Bush snap","","Germinates in cooler soil than most beans. Very dependable."],
["bushbean","Blue Lake 274",58,"Bush snap","","Straight round pods, excellent for freezing and canning."],
["bushbean","Contender",50,"Bush snap","","Early and heat-tolerant."],
["polebean","Kentucky Wonder",65,"Pole snap","","The classic pole bean. Keeps producing if picked constantly."],
["polebean","Scarlet Runner",70,"Pole","","Grown for scarlet flowers as much as beans. Hummingbirds love it."],
["pea","Sugar Snap",65,"Vining snap pea","","Eat pod and all. Needs 6 feet of support."],
["pea","Oregon Sugar Pod II",60,"Semi-dwarf snow pea","","Flat edible pods, compact vines."],
["pea","Little Marvel",60,"Bush shelling pea","","Compact, good for small beds."],
/* roots */
["carrot","Danvers 126",75,"Storage carrot","","Broad-shouldered and tapered — copes with heavier soil than most."],
["carrot","Scarlet Nantes",68,"Fresh carrot","","Sweet, blunt-tipped, wants loose soil."],
["carrot","Little Finger",55,"Baby carrot","","Short roots for containers and shallow beds."],
["carrot","Chantenay Red Core",70,"Storage carrot","","Short and thick — the best choice for clay."],
["beet","Detroit Dark Red",60,"Storage beet","","The all-purpose standard, roots and greens both good."],
["beet","Chioggia",55,"Heirloom beet","","Pink and white rings inside, milder flavour."],
["beet","Golden",55,"Golden beet","","Does not bleed. Germinates less reliably than red types — sow thicker."],
["radish","Cherry Belle",22,"Round red","","Ready in three weeks. The fastest thing in the garden."],
["radish","French Breakfast",25,"Oblong","","Mild and crisp; goes woody fast in heat."],
["radish","Daikon",60,"Winter radish","","Long white root, best as a fall crop."],
/* greens */
["lettuce","Black Seeded Simpson",45,"Loose leaf","","Very fast, cut-and-come-again. Bolts early in heat."],
["lettuce","Buttercrunch",55,"Butterhead","","Holds longer before bolting than most butterheads."],
["lettuce","Parris Island Cos",68,"Romaine","","The standard romaine. Upright heads, good heat tolerance."],
["lettuce","Little Gem",55,"Mini romaine","","Small dense heads, good for tight spacing."],
["lettuce","Salad Bowl",50,"Loose leaf","","Deeply lobed leaves, slow to bolt."],
["spinach","Bloomsdale Long Standing",45,"Savoyed","","Crinkled leaves, the classic. Slower to bolt than smooth types."],
["spinach","Space",40,"Smooth leaf","","Fast and upright, easy to wash."],
["kale","Lacinato (Toscano)",60,"Dinosaur kale","","Dark strappy leaves, sweetens hard after frost."],
["kale","Red Russian",50,"Flat leaf","","Tender enough to eat raw young. Very cold hardy."],
["kale","Winterbor",60,"Curly","","Heavily curled and extremely hardy — stands through snow."],
["chard","Fordhook Giant",55,"White stem","","Heavy yields, the most productive chard."],
["chard","Bright Lights",55,"Mixed stems","","Stems in yellow, pink, orange and red. Slightly milder."],
/* brassicas */
["broccoli","Waltham 29",75,"Fall broccoli","","Bred for autumn. Large main head, good side shoots."],
["broccoli","De Cicco",50,"Sprouting","","Small main head then weeks of side shoots — better for home gardens."],
["cabbage","Early Jersey Wakefield",63,"Pointed head","","Small conical heads, resists splitting."],
["cabbage","Copenhagen Market",70,"Round head","","Compact uniform round heads."],
["cabbage","Red Acre",75,"Red","","Stores well, resists splitting."],
/* alliums */
["onion","Walla Walla",125,"Long day sweet","","Grow north of about 36°N. Very sweet, poor keeper — eat it fresh."],
["onion","Candy",100,"Intermediate day","","The safest choice if unsure of your day length."],
["onion","Texas Early Grano",110,"Short day","","For southern gardens. Sweet, mild, does not store long."],
["garlic","Music",240,"Porcelain hardneck","","Large easy-peel cloves, strong flavour, produces scapes."],
["garlic","German Extra Hardy",240,"Porcelain hardneck","","Very cold hardy, excellent keeper."],
["garlic","Inchelium Red",240,"Softneck","","Mild, braidable, best in milder winters."],
/* melons */
["melon","Hale's Best Jumbo",85,"Cantaloupe","","Reliable heirloom muskmelon. Slips from the vine when ripe."],
["watermelon","Sugar Baby",75,"Icebox watermelon","","Small round fruit, the best bet for short seasons."],
["watermelon","Crimson Sweet",85,"Picnic watermelon","","Large striped fruit, classic flavour. Needs heat and space."],
/* herbs */
["basil","Genovese",68,"Sweet basil","","The pesto basil. Pinch constantly to delay flowering."],
["basil","Thai",64,"Thai basil","","Anise flavour, holds up to cooking, handles heat better."],
["basil","Lemon",60,"Citrus basil","","Strong lemon scent, good with fish and in tea."],
["cilantro","Santo",45,"Slow bolt","","Slower to bolt than generic cilantro, but still fast in heat."],
["dill","Bouquet",45,"Seed and leaf","","Large heads, the standard for pickling."],
["parsley","Italian Flat Leaf",75,"Flat leaf","","Better flavour than curled types."]
];

const Varieties = {
  /* bundled + saved, for one crop */
  forCrop(cropId){
    const ref = VARIETY_REF.filter(v => v[0] === cropId).map(v => ({
      id: "ref:" + cropId + ":" + v[1], crop_id: v[0], name: v[1], dtm: v[2],
      habit: v[3], resistance: v[4], notes: v[5], source: "reference"
    }));
    const mine = DB.where("varieties", v => v.crop_id === cropId)
      .map(v => Object.assign({}, v, { source: v.source || "saved" }));
    return mine.concat(ref);
  },
  find(cropId, name){
    if(!name) return null;
    const n = String(name).toLowerCase().trim();
    return Varieties.forCrop(cropId).find(v => v.name.toLowerCase() === n) ||
           Varieties.forCrop(cropId).find(v => v.name.toLowerCase().indexOf(n) >= 0) || null;
  },
  save(v){
    const ex = DB.where("varieties", x => x.crop_id === v.crop_id &&
      (x.name || "").toLowerCase() === String(v.name || "").toLowerCase())[0];
    if(ex) return DB.update("varieties", ex.id, v);
    return DB.insert("varieties", v);
  },

  /* ---------- picker ---------- */
  pick(cropId, onPick){
    const list = Varieties.forCrop(cropId);
    let h = '<p class="muted sm" style="margin-top:0">Varieties of ' + esc(cropName(cropId)) +
      '. Days to maturity is the figure catalogues broadly agree on — your seed packet is the authority.</p>';
    h += '<input type="search" id="vp-q" placeholder="Search or type a new variety name…">';
    h += '<div id="vp-list" style="margin-top:10px"></div>';
    h += '<div class="row" style="gap:8px;margin-top:12px">' +
      '<button class="btn ghost grow" id="vp-add">＋ Add manually</button>' +
      (DB.get("gemKey") ? '<button class="btn grow" id="vp-ai">✨ Look it up</button>' : '') + '</div>';
    if(!DB.get("gemKey")) h += '<div class="tiny muted" style="margin-top:8px">Connect the assistant in Settings and this can search the web for any variety and fill in the details.</div>';
    h += '<div id="vp-out" style="margin-top:12px"></div>';
    openSheet("Choose a variety", h);

    const draw = q => {
      const f = list.filter(v => !q || v.name.toLowerCase().indexOf(q) >= 0);
      let o = '<div class="card pad0"><div class="list">';
      o += '<button class="item" data-v=""><div class="av">—</div><div class="grow"><div class="b">No variety</div>' +
           '<div class="tiny muted">Just the crop</div></div></button>';
      if(!f.length) o += '<div class="empty sm">Nothing matches — add it manually or look it up.</div>';
      f.forEach(v => {
        o += '<button class="item" data-v="' + esc(v.name) + '"><div class="av">' + cropEmoji(cropId) + '</div>' +
          '<div class="grow"><div class="b">' + esc(v.name) + (v.source !== "reference" ? ' <span class="chip good tiny">yours</span>' : '') + '</div>' +
          '<div class="tiny muted">' + (v.dtm ? v.dtm + ' days · ' : '') + esc(v.habit || "") +
          (v.resistance ? ' · ' + esc(v.resistance) : '') + '</div>' +
          (v.notes ? '<div class="tiny muted" style="margin-top:2px">' + esc(v.notes) + '</div>' : '') +
          '</div><span class="go">›</span></button>';
      });
      o += '</div></div>';
      $("#vp-list").innerHTML = o;
      $$("#vp-list .item").forEach(el => el.onclick = () => onPick(el.dataset.v, Varieties.find(cropId, el.dataset.v)));
    };
    $("#vp-q").oninput = e => draw(e.target.value.toLowerCase().trim());
    $("#vp-add").onclick = () => Varieties.form(cropId, $("#vp-q").value.trim(), onPick);
    if($("#vp-ai")) $("#vp-ai").onclick = () => Varieties.lookup(cropId, $("#vp-q").value.trim(), onPick);
    draw("");
  },

  form(cropId, name, onPick, prefill){
    const p = prefill || {};
    openSheet("Add a variety",
      '<div class="field"><label class="f">Variety name</label><input type="text" id="vf-name" value="' + esc(p.name || name || "") + '"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Days to maturity</label><input type="number" id="vf-dtm" value="' + esc(p.dtm || "") + '"></div>' +
      '<div><label class="f">Habit / type</label><input type="text" id="vf-habit" value="' + esc(p.habit || "") + '" placeholder="Indeterminate"></div></div>' +
      '<div class="field"><label class="f">Disease resistance</label><input type="text" id="vf-res" value="' + esc(p.resistance || "") + '" placeholder="VFN"></div>' +
      '<div class="field"><label class="f">Notes</label><textarea id="vf-notes">' + esc(p.notes || "") + '</textarea></div>' +
      (p.source ? '<div class="note i" style="margin-top:10px">Filled in from a web search. Check it against your packet before trusting the numbers.</div>' : '') +
      '<a class="chip info" style="margin-top:10px" href="https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/" target="_blank" rel="noopener noreferrer">🔗 What the resistance codes mean (Cornell) ↗</a>' +
      '<button class="btn block" style="margin-top:14px" id="vf-save">Save variety</button>');
    $("#vf-save").onclick = () => {
      const n = $("#vf-name").value.trim();
      if(!n) return toast("Give it a name");
      Varieties.save({ crop_id: cropId, name: n, dtm: num($("#vf-dtm").value) || null,
        habit: $("#vf-habit").value.trim(), resistance: $("#vf-res").value.trim(),
        notes: $("#vf-notes").value.trim(), source: p.source || "manual" });
      toast("Variety saved");
      onPick(n, Varieties.find(cropId, n));
    };
  },

  /* ---------- assistant lookup ---------- */
  async lookup(cropId, name, onPick){
    const key = DB.get("gemKey");
    if(!key) return toast("Variety lookup uses Gemini — connect it in Settings");
    if(!name) return toast("Type the variety name first");
    const out = $("#vp-out");
    out.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Searching for ' + esc(name) + '…</span></div>';
    try{
      const r = await fetch(GEM_URL + DB.get("gemModel", PROVIDERS.gemini.def) + ":generateContent?key=" + encodeURIComponent(key), {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          contents:[{ role:"user", parts:[{ text:
            "Look up the vegetable variety '" + name + "' of " + cropName(cropId) + ". " +
            "Return ONLY a JSON object with keys: name, dtm (days to maturity as a number), habit (e.g. Indeterminate, Bush, Determinate paste), " +
            "resistance (standard disease-resistance letter codes if the variety is known for them, else empty string), " +
            "notes (two short sentences a home gardener would want: flavour, growth habit, any quirk). " +
            "If you cannot find reliable information, return {\\\"error\\\":\\\"not found\\\"}. Do not invent numbers." }] }],
          tools:[{ google_search:{} }]
        })
      });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const cand = (j.candidates || [])[0] || {};
      const txt = ((cand.content || {}).parts || []).map(p => p.text || "").join("");
      const m = txt.match(/\{[\s\S]*\}/);
      if(!m) throw new Error("No result");
      const d = JSON.parse(m[0]);
      if(d.error) throw new Error("Nothing reliable found for that name");
      const gm = cand.groundingMetadata || {};
      const srcs = (gm.groundingChunks || []).map(g => (g.web || {}).title).filter(Boolean).slice(0, 3);
      out.innerHTML = '<div class="note g"><b>' + esc(d.name || name) + '</b><br>' +
        (d.dtm ? d.dtm + ' days to maturity · ' : '') + esc(d.habit || "") +
        (d.resistance ? '<br>Resistance: ' + esc(d.resistance) : '') +
        (d.notes ? '<br><br>' + esc(d.notes) : '') +
        (srcs.length ? '<div class="tiny" style="margin-top:6px;opacity:.8">Sources: ' + esc(srcs.join(" · ")) + '</div>' : '') +
        '</div>' +
        '<div class="note w" style="margin-top:8px">From a web search, not a checked reference. Confirm against your seed packet.</div>' +
        '<button class="btn block" style="margin-top:10px" id="vp-use">Review and save</button>';
      $("#vp-use").onclick = () => Varieties.form(cropId, d.name || name, onPick,
        { name: d.name || name, dtm: d.dtm, habit: d.habit, resistance: d.resistance, notes: d.notes, source:"web search" });
    }catch(e){
      out.innerHTML = '<div class="note d">' + esc(e.message || "Lookup failed") + '. You can still add it manually.</div>';
    }
  }
};

/* wire the variety picker into the planting sheet */
Garden.pickVariety = function(plantingId){
  const p = DB.find("plantings", plantingId); if(!p) return;
  Varieties.pick(p.crop_id, (name, v) => {
    DB.update("plantings", plantingId, { variety: name || null, variety_id: v ? v.id : null });
    closeSheet();
    setTimeout(() => { Garden.plantingSheet(DB.find("plantings", plantingId)); Garden.render(); }, 220);
  });
};
</script>
