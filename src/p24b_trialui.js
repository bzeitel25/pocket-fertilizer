<script>
/* ============================================================
   THE SCREENS FOR PRODUCTS, RESULTS AND TRIALS

   Simple mode is a shelf of named bags and a "how much" answer.
   Advanced mode is the same answer with the arithmetic showing and
   a blender for people who mix their own. Nothing is computed
   differently between them.
   ============================================================ */

const ProductUI = {

  /* ---------- picking something off the catalogue ---------- */

  pick(cropId){
    const c = cropId ? crop(cropId) : null;
    const list = cropId ? Products.forCrop(cropId) : null;

    let h = '';
    if(c){
      h += '<p class="muted sm" style="margin-top:0">What is on the shelf for <b>' + esc(c.n) + '</b>. ' +
        'Whether a product is <i>meant</i> for a crop is the maker\'s claim off the label. ' +
        'Whether it is a good <i>shape</i> for it is this app\'s, and it comes from the same extension guidance as the rest of the feeding advice.</p>';
      const best = Products.pickFor(cropId);
      if(best) h += '<div class="note g">⭐ <b>' + esc(best.p.n) + '</b> — ' + esc(best.why) + '</div>';
    } else {
      h += '<p class="muted sm" style="margin-top:0">Pick what you have, or add your own from the bag.</p>';
    }

    h += '<div class="card pad0" style="margin-top:12px"><div class="list">';
    const rows = list ? list.map(x => x.p) : Feed.shelf().filter(p => p.npk && p.npk[0]);
    rows.slice(0, 24).forEach(p => {
      const meta = list ? list.find(x => x.p.id === p.id) : null;
      const ref = p.mine ? null : Products.ref(p.id);
      h += '<button class="item" onclick="ProductUI.detail(\'' + esc(p.id) + '\',' + (cropId ? "'" + cropId + "'" : "null") + ')">' +
        '<div class="av">' + (p.mine ? "🏷️" : p.organic ? "🌿" : "🧪") + '</div><div class="grow">' +
        '<div class="b">' + esc(p.n) + (p.mine ? ' <span class="chip tiny">yours</span>' : '') + '</div>' +
        '<div class="tiny muted">' + p.npk.join("-") +
        (Products.pHeavy(p) ? ' · <span style="color:var(--warn)">phosphate-heavy</span>' : '') +
        (meta && meta.intended === true ? ' · listed for this' : '') +
        (meta && meta.perLbN ? ' · $' + (Math.round(meta.perLbN * 100) / 100) + '/lb N' : '') +
        '</div></div><span class="go">›</span></button>';
    });
    h += '</div></div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn" onclick="ProductUI.addOwn()">＋ Add my own</button>' +
      '<button class="btn ghost" onclick="ProductUI.camera()">📷 Read the bag</button></div>';
    if(Products.advanced) h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="ProductUI.blender()">⚗️ Mix my own blend</button>';
    h += '<div class="tiny muted" style="margin-top:10px">Analyses are read off each maker\'s own page and carry the date they were checked. ' +
      'Formulations change — the bag in your hand always wins.</div>';

    openSheet(c ? "Plant food for " + c.n : "Plant food", h);
  },

  detail(id, cropId){
    const p = Feed.shelf().find(s => s.id === id); if(!p) return;
    const ref = p.mine ? (p.ref_id ? Products.ref(p.ref_id) : null) : Products.ref(id);
    const brand = ref ? Products.brandOf(ref) : null;

    let h = '<div class="row" style="gap:12px;margin-bottom:10px"><div style="font-size:2.2rem">' +
      (p.organic ? "🌿" : "🧪") + '</div><div class="grow"><div class="b">' + esc(p.n) + '</div>' +
      '<div class="tiny muted">' + (brand ? esc(brand.n) + ' · ' : '') + p.npk.join("-") +
      (ref && ref.omri ? ' · OMRI listed' : '') + '</div></div></div>';

    h += '<table class="mini"><tr><th>Nitrogen</th><td class="b">' + p.npk[0] + '%</td></tr>' +
      '<tr><th>Phosphate</th><td>' + p.npk[1] + '%</td></tr>' +
      '<tr><th>Potash</th><td>' + p.npk[2] + '%</td></tr>' +
      (ref && ref.ca ? '<tr><th>Calcium</th><td>' + ref.ca + '%</td></tr>' : '') + '</table>';

    const pn = Products.pNote(p);
    if(pn) h += '<div class="note w" style="margin-top:10px">⚠️ ' + escU(pn) + '</div>';

    const perN = Products.costPerLbN(p);
    if(perN !== null) h += '<div class="note i" style="margin-top:8px">💵 <b>$' + (Math.round(perN * 100) / 100) +
      ' per pound of actual nitrogen.</b> That is the only number that lets you compare two bags at different prices and analyses.</div>';
    else if(p.mine) h += '<div class="tiny muted" style="margin-top:8px">Add the bag weight and what you paid and the app can tell you what a pound of nitrogen costs you in this.</div>';

    if(ref && ref.use) h += '<div class="note g" style="margin-top:8px"><b>The maker says.</b> ' + escU(ref.use) + '</div>';
    if((ref && ref.note) || p.note) h += '<div class="tiny muted" style="margin-top:8px">' + escU((ref && ref.note) || p.note) + '</div>';

    const bl = p.mine ? Products.blendOf(DB.find("amendments", p.id)) : null;
    if(bl) h += '<div class="note i" style="margin-top:8px">⚗️ Your own blend: ' +
      esc(bl.map(x => x.parts + " × " + ((Feed.shelf().find(s => s.id === x.id) || {}).n || "?")).join(", ")) + '</div>';

    /* what else is like it — by what is in it, never by outcome */
    const sim = Products.similar(p, 3);
    if(sim.length){
      h += '<div class="sec" style="margin-top:14px"><h2>Similar</h2></div><div class="card"><div class="list">';
      sim.forEach(s => h += '<button class="item" onclick="ProductUI.detail(\'' + esc(s.p.id) + '\',' + (cropId ? "'" + cropId + "'" : "null") + ')">' +
        '<div class="av">' + (s.p.organic ? "🌿" : "🧪") + '</div><div class="grow"><div class="b">' + esc(s.p.n) + '</div>' +
        '<div class="tiny muted">' + s.p.npk.join("-") + ' · ' + esc(Products.whySimilar(p, s.p)) + '</div></div>' +
        '<span class="go">›</span></button>');
      h += '</div><div class="tiny muted" style="margin-top:8px">Matched on what is in the bag — the balance of nutrients, organic or not, and how it is applied. ' +
        'Not on how your garden did with it; that needs more records than one shelf can carry.</div></div>';
    }

    if(ref) h += '<div class="tiny muted" style="margin-top:10px">Label read on ' +
      esc(Products.brandOf(ref) ? Products.brandOf(ref).n : "the maker") + '\'s own page, ' + fmtY(ref.checked) + ' — ' +
      '<a href="' + esc(ref.url) + '" target="_blank" rel="noopener noreferrer">product page ↗</a><br>' +
      'This is a label, not an extension source. It says what is in the bag, not what your garden needs.</div>';

    if(!p.mine) h += '<button class="btn block" style="margin-top:14px" onclick="ProductUI.adopt(\'' + esc(id) + '\')">＋ Add to my shelf</button>';
    else h += '<button class="btn ghost block" style="margin-top:14px" onclick="FeedUI.editProduct(\'' + esc(id) + '\')">Edit</button>';
    if(cropId) h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="ProductUI.pick(\'' + cropId + '\')">‹ Back to the list</button>';
    openSheet(p.n, h);
  },

  adopt(refId){
    const a = Products.adopt(refId);
    if(!a) return toast("Could not add that");
    toast("On your shelf");
    FeedUI.editProduct(a.id);
  },

  addOwn(){ FeedUI.editProduct(); },

  /* ---------- reading the bag ---------- */

  camera(){
    if(!Vision.ready()){
      return openSheet("Read the bag",
        '<div class="note i">Reading a label from a photo needs an AI key connected — the same one the ✨ Ask tab and the seed packet reader use.</div>' +
        '<button class="btn block" style="margin-top:12px" onclick="closeSheet();setTimeout(Assist.setup,250)">Connect a key</button>' +
        '<button class="btn ghost block sm" style="margin-top:8px" onclick="ProductUI.addOwn()">Type it in instead</button>');
    }
    openSheet("Read the bag",
      '<p class="muted sm" style="margin-top:0">Photograph the guaranteed analysis panel — the small print with the three percentages, not the front of the bag.</p>' +
      '<div id="lbl-stage"></div>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn" onclick="ProductUI.shoot(true)">📷 Photograph</button>' +
      '<button class="btn ghost" onclick="ProductUI.shoot(false)">🖼️ Upload</button></div>' +
      '<button class="btn ghost block sm" style="margin-top:8px" onclick="ProductUI.addOwn()">Type it in instead</button>');
  },

  /* Same two-size trick the packet reader uses: a bigger copy is sent
     to be read because analysis panels are small print, and it is
     never stored — nothing about a fertiliser bag is worth a photo in
     the vault. */
  shoot(useCamera){
    const inp = useCamera ? $("#filepick-cam") : $("#filepick");
    if(!inp) return;
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files[0]; if(!f) return;
      const box = $("#lbl-stage");
      if(box) box.innerHTML = '<div class="note i" style="margin-top:10px">Reading the label…</div>';
      try{
        const hi = await shrinkImage(f, 1500, 0.86);
        const d = await Products.readLabel(Vision.fromDataUrl(hi.dataUrl));
        if(!d || (d.n === null && d.p === null && d.k === null))
          throw new Error("No guaranteed analysis found in that photo.");
        /* into the form with the read values pre-filled and flagged,
           exactly as the packet reader does it — she confirms, and the
           app never saves what a model said without being told to */
        FeedUI.editProduct(null, d);
        toast("Check what it read");
      }catch(e){
        const b2 = $("#lbl-stage");
        if(b2) b2.innerHTML = '<div class="note d" style="margin-top:10px">' + esc(e.message || "That did not read.") +
          ' Try a straighter, better-lit shot of the analysis panel, or type it in.</div>';
      }
    };
    inp.click();
  },

  /* ---------- mixing your own (advanced) ---------- */

  blender(){
    ProductUI._mix = ProductUI._mix || [];
    ProductUI.paintBlend();
  },
  paintBlend(){
    const shelf = Feed.shelf().filter(p => p.npk && (p.npk[0] || p.npk[1] || p.npk[2]));
    const mix = ProductUI._mix || [];
    const res = Products.blend(mix);

    let h = '<p class="muted sm" style="margin-top:0">Parts by weight. The analysis of the result is the weighted average of what went in, which is arithmetic — so the app can state it flatly rather than estimate it.</p>';
    h += '<div class="card"><div class="list">';
    mix.forEach((m, i) => {
      const p = shelf.find(s => s.id === m.id) || { n:"?", npk:[0,0,0] };
      h += '<div class="item"><div class="av">' + (i + 1) + '</div><div class="grow">' +
        '<div class="b">' + esc(p.n) + '</div><div class="tiny muted">' + p.npk.join("-") + '</div></div>' +
        '<input type="number" step="0.5" min="0" value="' + num(m.parts, 1) + '" style="width:64px" ' +
        'onchange="ProductUI.setPart(' + i + ',this.value)">' +
        '<button class="iconbtn" onclick="ProductUI.dropPart(' + i + ')">✕</button></div>';
    });
    if(!mix.length) h += '<div class="empty sm"><div class="tiny">Add two or more ingredients.</div></div>';
    h += '</div></div>';

    h += '<div class="field" style="margin-top:12px"><label class="f">Add an ingredient</label>' +
      '<select id="mix-add" onchange="ProductUI.addPart(this.value)"><option value="">— choose —</option>' +
      shelf.map(p => '<option value="' + esc(p.id) + '">' + esc(p.n) + ' ' + p.npk.join("-") + '</option>').join("") +
      '</select></div>';

    if(res){
      h += '<div class="hero" style="margin-top:12px"><div class="lbl">Your blend</div>' +
        '<div style="font-size:2rem;font-weight:800;line-height:1.1">' + res.npk.join("-") + '</div>' +
        '<div class="sm" style="opacity:.92">' + res.parts + ' parts by weight' +
        (res.form ? ' · behaves like a ' + esc(res.form) : '') + '</div></div>';
      if(!res.form) h += '<div class="note w" style="margin-top:8px">⚠️ One of these is a liquid concentrate. A dry blend and a dilution cannot be measured the same way, so this will not convert to cups.</div>';
      if(res.npk[1] >= res.npk[0]) h += '<div class="note w" style="margin-top:8px">⚠️ This blend carries at least as much phosphate as nitrogen. On most established beds the phosphate part does nothing.</div>';
      h += '<div class="field" style="margin-top:12px"><label class="f">Call it</label>' +
        '<input type="text" id="mix-name" placeholder="My tomato mix"></div>';
      h += '<button class="btn block" style="margin-top:10px" onclick="ProductUI.saveBlend()">Save to my shelf</button>';
    }
    openSheet("Mix a blend", h);
  },
  addPart(id){ if(!id) return; ProductUI._mix.push({ id:id, parts:1 }); ProductUI.paintBlend(); },
  setPart(i, v){ if(ProductUI._mix[i]) ProductUI._mix[i].parts = num(v, 1); ProductUI.paintBlend(); },
  dropPart(i){ ProductUI._mix.splice(i, 1); ProductUI.paintBlend(); },
  saveBlend(){
    const res = Products.blend(ProductUI._mix); if(!res) return;
    const name = ($("#mix-name") && $("#mix-name").value.trim()) || "My blend";
    DB.insert("amendments", {
      name: name, n: res.npk[0], p: res.npk[1], k: res.npk[2],
      form: res.form || "granular", organic:"0",
      blend: JSON.stringify(ProductUI._mix),
      notes:"Blended from " + ProductUI._mix.length + " ingredients on your own shelf."
    });
    ProductUI._mix = [];
    toast("Blend saved");
    FeedUI.shelf();
  },

  /* ---------- value table ---------- */

  value(){
    const t = Products.valueTable();
    let h = '<p class="muted sm" style="margin-top:0">What a pound of actual nitrogen costs in each thing you own. ' +
      'This is arithmetic, not an opinion — it says nothing about which grows better tomatoes, only what you are paying for the nutrient your crops run out of every year.</p>';
    if(t.priced.length){
      h += '<div class="card"><table class="mini"><tr><th>Product</th><th>Analysis</th><th>$ / lb N</th></tr>' +
        t.priced.map(p => '<tr><td class="b">' + esc(p.n) + '</td><td>' + p.npk.join("-") + '</td>' +
          '<td class="b">$' + (Math.round(p.perLbN * 100) / 100) + '</td></tr>').join("") + '</table>';
      const cheap = t.priced[0], dear = t.priced[t.priced.length - 1];
      if(t.priced.length > 1 && dear.perLbN > cheap.perLbN * 1.5)
        h += '<div class="note i" style="margin-top:10px">💵 <b>' + esc(cheap.n) + '</b> gives you nitrogen at $' +
          (Math.round(cheap.perLbN * 100) / 100) + ' a pound; <b>' + esc(dear.n) + '</b> at $' +
          (Math.round(dear.perLbN * 100) / 100) + '. Same nutrient. The difference is what you are paying for the blend, the brand and the bag.</div>';
      h += '</div>';
    }
    if(t.unpriced.length) h += '<div class="card" style="margin-top:12px"><div class="tiny b muted">Not priced yet</div>' +
      '<div class="tiny muted" style="margin-top:6px">' + esc(t.unpriced.map(p => p.n).join(", ")) +
      '. Add the bag weight and what you paid and they join the table.</div></div>';
    if(!t.priced.length && !t.unpriced.length) h += '<div class="card"><div class="empty sm"><span class="e">💵</span>' +
      '<div class="b">Nothing on the shelf yet</div></div></div>';
    openSheet("What nitrogen costs you", h);
  }
};

/* ============================================================
   RESULTS
   ============================================================ */
const OutcomeUI = {

  open(cropId){
    const crops = Outcomes.crops();
    if(!crops.length) return openSheet("What worked",
      '<div class="empty"><span class="e">📊</span><div class="b">Nothing to compare yet</div>' +
      '<div class="tiny">Log a feeding against a plant, then log what you picked from it. Once a few of those line up, this page writes itself.</div></div>');

    const cid = cropId || crops[0].crop_id;
    const list = Outcomes.byProduct(cid);

    let h = '<div class="scroller">' + crops.map(c =>
      '<button class="chip ' + (c.crop_id === cid ? "on" : "") + '" onclick="OutcomeUI.open(\'' + c.crop_id + '\')">' +
      cropEmoji(c.crop_id) + ' ' + esc(cropName(c.crop_id)) + '</button>').join("") + '</div>';

    h += '<div class="note w" style="margin-top:12px">⚠️ ' + esc(Outcomes.caveat(list)) + '</div>';

    if(!list.length){
      h += '<div class="card" style="margin-top:12px"><div class="empty sm"><div class="tiny">No feedings on this crop have a harvest logged against them yet.</div></div></div>';
      return openSheet("What worked", h);
    }

    const max = Math.max.apply(null, list.map(x => x.perSqFt).concat([0.0001]));
    h += '<div class="card" style="margin-top:12px">';
    list.forEach(x => {
      h += '<div style="margin-bottom:12px"><div class="row between">' +
        '<div class="sm b">' + esc(x.product) + (x.enough ? '' : ' <span class="chip warn tiny">thin</span>') + '</div>' +
        '<div class="tiny muted">' + Units.density(x.perSqFt) + '</div></div>' +
        '<div class="bar-track" style="margin-top:4px"><div class="bar-fill" style="width:' +
        Math.round(x.perSqFt / max * 100) + '%"></div></div>' +
        '<div class="tiny muted" style="margin-top:3px">' + x.n + ' planting' + (x.n === 1 ? "" : "s") +
        ' · ' + Units.weight(x.lbs) + ' picked · ' + x.bedN + ' bed' + (x.bedN === 1 ? "" : "s") +
        ' · ' + x.yearN + ' season' + (x.yearN === 1 ? "" : "s") +
        (x.trials ? ' · ' + x.trials + ' from a trial' : '') + '</div></div>';
    });
    h += '</div>';

    /* name the confounds between the top two, specifically */
    if(list.length > 1){
      const cf = Outcomes.confounds(list[0], list[1]);
      h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">' +
        'What else was different</div>';
      if(cf.length) h += cf.map(s => '<div class="note i" style="margin-bottom:6px">· ' + escU(s) + '</div>').join("");
      else h += '<div class="note g">Same bed, same season, same variety — as clean as an unplanned comparison gets. Still worth a split trial before you believe it.</div>';
      h += '</div>';
    }

    const t = Trials.running();
    h += '<button class="btn block" style="margin-top:12px" onclick="TrialUI.start(\'' + cid + '\')">🔬 Run a split trial on ' + esc(cropName(cid)) + '</button>';
    if(t.length) h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="TrialUI.list()">' +
      t.length + ' trial' + (t.length === 1 ? "" : "s") + ' running</button>';
    h += '<div class="tiny muted" style="margin-top:10px">These records are yours and stay on this device. They do not change what the app recommends to anyone, including you — ' +
      'the feeding rates stay the published ones.</div>';

    openSheet("What worked", h);
  }
};

/* ============================================================
   TRIALS
   ============================================================ */
const TrialUI = {

  start(cropId){
    const beds = DB.all("beds").filter(b =>
      DB.where("plantings", p => p.bed_id === b.id && p.crop_id === cropId && p.status !== "removed").length >= 2);

    let h = '<p class="muted sm" style="margin-top:0">Two products, one bed, one crop, one day. The app splits the plants into two halves and alternates them down the bed, ' +
      'so neither product gets the sunny end. Everything that makes an ordinary comparison unreliable is held still.</p>';

    if(!beds.length) return openSheet("Split trial", h +
      '<div class="note w">You need at least two ' + esc(cropName(cropId)) + ' plants in one bed, sown or planted on the same day. ' +
      'A head start is worth more than any fertiliser, so the app will not set up a trial that cannot measure one.</div>');

    h += '<div class="field" style="margin-top:12px"><label class="f">Bed</label><select id="tr-bed" onchange="TrialUI.checkBed(\'' + cropId + '\')">' +
      beds.map(b => '<option value="' + b.id + '">' + esc(b.name) + '</option>').join("") + '</select></div>';
    h += '<div id="tr-check"></div>';
    const shelf = Feed.shelf().filter(p => p.npk && p.npk[0]);
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Half A gets</label><select id="tr-a">' +
        shelf.map(p => '<option value="' + esc(p.id) + '">' + esc(p.n) + '</option>').join("") + '</select></div>' +
      '<div><label class="f">Half B gets</label><select id="tr-b">' +
        shelf.map((p, i) => '<option value="' + esc(p.id) + '"' + (i === 1 ? " selected" : "") + '>' + esc(p.n) + '</option>').join("") + '</select></div></div>';
    h += '<button class="btn block" style="margin-top:14px" onclick="TrialUI.create(\'' + cropId + '\')">Set up the trial</button>';
    openSheet("Split trial · " + cropName(cropId), h);
    setTimeout(() => TrialUI.checkBed(cropId), 40);
  },

  checkBed(cropId){
    const box = $("#tr-check"); if(!box) return;
    const c = Trials.can($("#tr-bed").value, cropId);
    box.innerHTML = c.ok
      ? '<div class="note g" style="margin-top:8px">✓ ' + c.n + ' plants, all in on the same day. They will be split ' +
        Math.ceil(c.n / 2) + ' and ' + Math.floor(c.n / 2) + '.</div>'
      : '<div class="note d" style="margin-top:8px">' + escU(c.why) + '</div>';
  },

  create(cropId){
    const bedId = $("#tr-bed").value;
    const aId = $("#tr-a").value, bId = $("#tr-b").value;
    if(aId === bId) return toast("Pick two different products");
    const a = Feed.shelf().find(p => p.id === aId), b = Feed.shelf().find(p => p.id === bId);
    const t = Trials.create(bedId, cropId, aId, bId, a.n, b.n);
    if(!t) return toast("That bed will not make a fair trial");
    closeSheet(); refresh(); toast("Trial set up 🔬");
    setTimeout(() => TrialUI.open(t.id), 260);
  },

  list(){
    const all = DB.all("trials");
    if(!all.length) return toast("No trials yet");
    let h = '<div class="card pad0"><div class="list">' + all.map(t =>
      '<button class="item" onclick="TrialUI.open(\'' + t.id + '\')"><div class="av">🔬</div>' +
      '<div class="grow"><div class="b">' + esc(t.name) + '</div>' +
      '<div class="tiny muted">' + esc(Journal.bedName(t.bed_id)) + ' · started ' + fmtY(t.started) +
      ' · ' + esc(t.status) + '</div></div><span class="go">›</span></button>').join("") + '</div></div>';
    openSheet("Trials", h);
  },

  open(id){
    const r = Trials.result(id); if(!r) return;
    const t = r.trial;
    let h = '<div class="row" style="gap:12px;margin-bottom:10px"><div style="font-size:2.2rem">🔬</div>' +
      '<div class="grow"><div class="b">' + esc(t.name) + '</div>' +
      '<div class="tiny muted">' + esc(Journal.bedName(t.bed_id)) + ' · from ' + fmtY(t.started) + '</div></div></div>';

    if(r.state === "waiting"){
      h += '<div class="note i">Nothing harvested from either half yet. Log harvests against these plants and the result fills itself in.</div>';
    } else if(r.state === "tie"){
      h += '<div class="hero"><div class="lbl">Result</div>' +
        '<div style="font-size:1.5rem;font-weight:800;line-height:1.2">No difference you could act on</div>' +
        '<div class="sm" style="opacity:.92">' + Math.round(r.edge * 100) + '% apart, which is inside the noise for a bed this size</div></div>';
      h += '<div class="note g" style="margin-top:10px">That is a real finding, and a useful one — it means you can buy whichever is cheaper. ' +
        'Check what a pound of nitrogen costs in each.</div>';
    } else {
      h += '<div class="hero"><div class="lbl">Result</div>' +
        '<div style="font-size:1.5rem;font-weight:800;line-height:1.2">' + esc(r.winnerLabel) + '</div>' +
        '<div class="sm" style="opacity:.92">yielded ' + Math.round(r.edge * 100) + '% more per ' + (Units.metric ? "square metre" : "square foot") + '</div></div>';
    }

    h += '<div class="card" style="margin-top:12px"><table class="mini">' +
      '<tr><th></th><th>Half A</th><th>Half B</th></tr>' +
      '<tr><td class="b">Product</td><td>' + esc(t.label_a) + '</td><td>' + esc(t.label_b) + '</td></tr>' +
      '<tr><td class="b">Plants</td><td>' + r.a.n + '</td><td>' + r.b.n + '</td></tr>' +
      '<tr><td class="b">Picked</td><td>' + Units.weightN(r.a.lbs) + '</td><td>' + Units.weightN(r.b.lbs) + '</td></tr>' +
      '<tr><td class="b">Per ' + (Units.metric ? "m²" : "sq ft") + '</td><td class="b">' + Units.density(r.a.perSqFt) +
      '</td><td class="b">' + Units.density(r.b.perSqFt) + '</td></tr></table></div>';

    h += '<div class="note i" style="margin-top:10px">' + escU(Trials.NOTE) + '</div>';

    if(r.a.n < 3 || r.b.n < 3) h += '<div class="note w" style="margin-top:8px">⚠️ ' +
      'With this few plants a side, one slug-eaten plant moves the answer. Read a small margin as no margin.</div>';

    if(t.status === "running") h += '<button class="btn ghost block" style="margin-top:12px" onclick="Trials.close(\'' + t.id + '\');TrialUI.open(\'' + t.id + '\')">Close this trial</button>';
    h += '<button class="btn ghost danger block sm" style="margin-top:8px" onclick="TrialUI.remove(\'' + t.id + '\')">Delete trial</button>';
    openSheet("Trial", h);
  },

  remove(id){
    DB.bulkRemove("trialarms", a => a.trial_id === id);
    DB.remove("trials", id);
    closeSheet(); refresh(); toast("Trial removed");
  }
};

/* ---- mode switch, results and value table, into Settings ---- */
(function productsInSettings(){
  const orig = Settings.render.bind(Settings);
  Settings.render = function(){
    orig();
    const box = $("#s-settings"); if(!box) return;
    const anchor = '<div class="sec"><h2>Feeding</h2></div>';
    if(box.innerHTML.indexOf(anchor) < 0) return;
    const adv = Products.advanced;
    const h = '<div class="card" style="margin-top:12px">' +
      '<div class="b">How much detail do you want?</div>' +
      '<div class="seg" style="margin-top:10px">' +
      '<button class="' + (adv ? "" : "on") + '" onclick="Products.mode=\'simple\';Settings.render()">Simple</button>' +
      '<button class="' + (adv ? "on" : "") + '" onclick="Products.mode=\'advanced\';Settings.render()">Advanced</button></div>' +
      '<div class="tiny muted" style="margin-top:8px">' + (adv
        ? "Percentages, the arithmetic behind every dose, and a blender for mixing your own from single ingredients."
        : "Pick a bag by name and get told how much to put down. The numbers are the same either way — this only decides how many of them are on screen.") +
      '</div>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn ghost sm" onclick="ProductUI.value()">💵 What nitrogen costs</button>' +
      '<button class="btn ghost sm" onclick="OutcomeUI.open()">📊 What worked</button></div>' +
      '</div>';
    box.innerHTML = box.innerHTML.replace(anchor, anchor + h.replace('<div class="card" style="margin-top:12px">', '<div class="card" style="margin-top:12px" id="feedmode">'));
  };
})();
</script>
