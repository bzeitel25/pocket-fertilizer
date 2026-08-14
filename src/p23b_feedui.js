<script>
/* ============================================================
   FEEDING — the screens

   Three places this shows up, and no new tab for any of them:

   · a card in the planting sheet, saying what this plant is owed
     and when the next feed falls
   · a dose sheet — pick something off the shelf, get a measurement
     you can actually take, log it in one tap
   · the shelf itself, in Settings, where a product she owns gets
     its label analysis typed in once

   The calendar side is already handled: Cal.rebuild writes the
   events, and the event sheet gets a "log this feeding" button
   wired up at the bottom of this file.
   ============================================================ */

const FeedUI = {

  /* ---------- the card in the planting sheet ---------- */

  card(p){
    const c = crop(p.crop_id); if(!c) return "";
    const steps = Feed.plan(p);
    const rate = Feed.rate(p.crop_id);
    const sqft = Feed.areaFor(p);
    const done = DB.all("journal").filter(j => j.type === "feed" && j.planting_id === p.id);

    let h = '<div class="card" style="margin-top:12px">' +
      '<div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Feeding</div>';

    const none = steps.find(s => s.kind === "none");
    if(none){
      h += '<div class="note g">🌿 <b>' + esc(none.label) + '.</b> ' + esc(none.text) + '</div>';
    }

    /* what it is owed for the season */
    const lbsN = Feed.nFor(p.crop_id, sqft);
    if(lbsN > 0){
      h += '<div class="b" style="font-size:1.1rem">' + FeedUI.nText(lbsN) + ' of nitrogen</div>' +
        '<div class="tiny muted">for the season, over the ' + Units.area(Math.round(sqft * 10) / 10) +
        ' this ' + esc(c.n.toLowerCase()) + ' has to itself · ' +
        rate.n1000 + ' lb per 1,000 sq ft' + (rate.est ? ' <span class="chip warn tiny">derived</span>' : '') + '</div>';
      h += '<div class="tiny muted" style="margin-top:6px">' + esc(rate.why) + '</div>';
    }

    /* the schedule */
    const dated = steps.filter(s => s.date);
    if(dated.length){
      h += '<div class="list" style="margin-top:10px">';
      dated.forEach((s, i) => {
        const idx = steps.indexOf(s);
        const late = diffDays(today(), parseISO(s.date)) < 0;
        h += '<button class="item" onclick="FeedUI.open(\'' + p.id + '\',' + idx + ')">' +
          '<div class="av">' + (s.kind === "pre" ? "🌱" : "🌿") + '</div><div class="grow">' +
          '<div class="b">' + esc(s.label) + ' · ' + FeedUI.nText(s.lbsN) + ' N</div>' +
          '<div class="tiny ' + (late ? "" : "muted") + '"' + (late ? ' style="color:var(--warn)"' : '') + '>' +
          fmt(s.date) + (s.stage ? ' · when the plant says so' : '') + '</div>' +
          '</div><span class="go">›</span></button>';
      });
      h += '</div>';
      const stage = dated.find(s => s.stage);
      if(stage) h += '<div class="note i" style="margin-top:8px">🕐 <b>' + esc(stage.text) + '.</b> ' +
        'The date is only a reminder to go and look — the plant is what decides.</div>';
      const warn = dated.map(s => s.warn).filter(Boolean)[0];
      if(warn) h += '<div class="note w" style="margin-top:8px">⚠️ ' + escU(warn) + '</div>';
      const est = dated.find(s => s.est);
      if(est) h += '<div class="tiny muted" style="margin-top:8px"><b>Timing is inferred.</b> ' + esc(est.estWhy) + '</div>';
      const gen = dated.find(s => s.generic);
      if(gen) h += '<div class="tiny muted" style="margin-top:8px">No per-crop timing is published for this one, so the general rule is used: about four to six weeks after planting, if growth has gone pale or slow.</div>';
    } else if(!none && !p.sown_on && !p.transplant_on){
      h += '<div class="note i" style="margin-top:8px">Set the sown or planted date above and the feeding dates work themselves out.</div>';
    }

    if(done.length){
      h += '<div class="tiny muted" style="margin-top:10px">✓ Fed ' + done.length + ' time' + (done.length === 1 ? "" : "s") +
        ' · ' + FeedUI.nText(done.reduce((a, j) => a + num(j.n_lbs), 0)) + ' of nitrogen logged</div>';
    }

    /* the bed-level over-application check, which is the failure
       mode the sources actually warn about */
    const over = p.bed_id ? Feed.overFed(p.bed_id) : null;
    if(over) h += '<div class="note d" style="margin-top:10px">⚠️ <b>This bed has had ' + over.pct + '% of what it is owed.</b> ' +
      'Maryland Extension is blunt about it — more is not better. Surplus nitrogen buys leaf at the expense of fruit and makes plants likelier to get sick.</div>';

    h += '<div class="note g" style="margin-top:10px">🌱 ' + esc(Feed.OM_NOTE) + '</div>';
    h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="FeedUI.open(\'' + p.id + '\',-1)">🌿 Work out a dose</button>';
    h += '</div>';
    return h;
  },

  nText(lbs){ return Feed.mass(lbs); },

  /* ---------- the dose sheet ---------- */

  open(plantingId, idx){
    const p = DB.find("plantings", plantingId); if(!p) return;
    FeedUI.ctx = { pid: plantingId, idx: num(idx, -1) };
    const steps = Feed.plan(p);
    const step = (idx >= 0 && steps[idx]) || null;
    const scopes = Feed.scopes(p);
    const def = Feed.defaultScope(p);
    FeedUI.ctx.scopes = scopes;
    FeedUI.ctx.half = !!(step && step.kind === "side");

    let h = '<div class="row" style="gap:12px;margin-bottom:10px"><div style="font-size:2.2rem">' + cropEmoji(p.crop_id) + '</div>' +
      '<div class="grow"><div class="b">' + esc(cropName(p.crop_id)) + (step ? ' · ' + esc(step.label) : '') + '</div>' +
      '<div class="tiny muted">' + esc(Journal.bedName(p.bed_id)) + '</div></div></div>';

    if(step && step.text) h += '<div class="note i">🕐 ' + escU(step.text) + '</div>';
    if(step && step.warn) h += '<div class="note w" style="margin-top:8px">⚠️ ' + escU(step.warn) + '</div>';

    /* One plant's share of a bed is usually a teaspoon of something,
       which is not a job anybody walks outside to do. Default to the
       pass she would actually make. */
    if(scopes.length > 1){
      h += '<div class="field" style="margin-top:12px"><label class="f">Feeding what?</label>' +
        '<select id="fd-scope" onchange="FeedUI.recalc()">' +
        scopes.map(s => '<option value="' + esc(s.key) + '"' + (def && s.key === def.key ? " selected" : "") + '>' +
          esc(s.label) + ' · ' + Units.area(Math.round(s.sqft * 10) / 10) + '</option>').join("") +
        '</select></div>';
    }

    h += '<div id="fd-hero"></div>';
    h += '<div class="field" style="margin-top:12px"><label class="f">What are you using?</label>' +
      '<select id="fd-prod" onchange="FeedUI.recalc()">' + FeedUI.options() + '</select></div>';
    h += '<div id="fd-out"></div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Date</label><input type="date" id="fd-date" value="' + esc(step && step.date ? step.date : iso(today())) + '"></div>' +
      '<div><label class="f">Cost ($)</label><input type="number" step="0.01" id="fd-cost" placeholder="optional"></div></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="fd-notes" placeholder="Anything you noticed"></textarea></div>';
    h += '<button class="btn block" style="margin-top:12px" onclick="FeedUI.save()">Log this feeding</button>';
    h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="FeedUI.shelf()">Manage what is on my shelf</button>';

    openSheet("Feed " + cropName(p.crop_id), h);
    setTimeout(FeedUI.recalc, 40);
  },

  options(){
    const shelf = Feed.shelf();
    const mine = shelf.filter(s => s.mine), ref = shelf.filter(s => !s.mine);
    let o = '';
    if(mine.length) o += '<optgroup label="On my shelf">' +
      mine.map(s => '<option value="' + esc(s.id) + '">' + esc(s.n) + ' ' + s.npk.join("-") + '</option>').join("") + '</optgroup>';
    o += '<optgroup label="Nitrogen">' + ref.filter(s => !s.rateOnly).map(s =>
      '<option value="' + esc(s.id) + '">' + esc(s.n) + ' ' + s.npk.join("-") + '</option>').join("") + '</optgroup>';
    o += '<optgroup label="Measured a different way">' + ref.filter(s => s.rateOnly).map(s =>
      '<option value="' + esc(s.id) + '">' + esc(s.n) + '</option>').join("") + '</optgroup>';
    return o;
  },

  /* the chosen scope, and the nitrogen that follows from it */
  scope(){
    const list = FeedUI.ctx.scopes || [];
    const sel = $("#fd-scope");
    return (sel && list.find(s => s.key === sel.value)) || list[0] || null;
  },

  recalc(){
    const box = $("#fd-out"); if(!box) return;
    const sc = FeedUI.scope();
    /* a side-dress is half the season figure, whatever ground it covers */
    const lbsN = sc ? sc.lbsN / (FeedUI.ctx.half ? 2 : 1) : 0;
    FeedUI.ctx.lbsN = lbsN;
    FeedUI.ctx.sqft = sc ? sc.sqft : 0;

    const hero = $("#fd-hero");
    const p0 = DB.find("plantings", FeedUI.ctx.pid);
    if(hero && sc) hero.innerHTML = '<div class="hero" style="margin-top:12px"><div class="lbl">Nitrogen to apply</div>' +
      '<div style="font-size:2rem;font-weight:800;line-height:1.1">' + FeedUI.nText(lbsN) + '</div>' +
      '<div class="sm" style="opacity:.92">' +
      (sc.whole ? 'the hungriest crop in this bed' : Feed.rate(p0.crop_id).n1000 + ' lb per 1,000 sq ft') +
      ', over ' + Units.area(Math.round(sc.sqft * 10) / 10) +
      (FeedUI.ctx.half ? ', halved for a mid-season feed' : '') + '</div></div>';

    const prod = Feed.product($("#fd-prod").value);
    let h = '';
    if(!prod){ box.innerHTML = ''; return; }

    if(prod.rateOnly){
      h += '<div class="note w" style="margin-top:10px">📏 <b>' + esc(prod.n) + ' is not dosed off a nitrogen figure.</b><br>' +
        escU(prod.note || "") + '</div>';
      if(prod.manure) h += '<div class="tiny muted" style="margin-top:8px">Oregon State puts this manure at ' +
        prod.manure[0] + '% N, ' + prod.manure[1] + '% P₂O₅ and ' + prod.manure[2] + '% K₂O, and spreads it 1.5 inches deep for the first three years, half an inch after that. ' +
        'Only a quarter to a half of that nitrogen is available the first year.</div>';
      if(prod.nutrient === "P") h += '<div class="note d" style="margin-top:8px">🚫 ' + escU(Feed.P_NOTE) + '</div>';
      if(prod.nutrient === "K") h += '<div class="note i" style="margin-top:8px">' + escU(Feed.K_NOTE) + '</div>';
      FeedUI.ctx.dose = null; FeedUI.ctx.prod = prod;
      box.innerHTML = h; return;
    }

    const d = Feed.dose(lbsN, prod);
    FeedUI.ctx.dose = d; FeedUI.ctx.prod = prod;

    h += '<div class="card" style="margin-top:10px;background:var(--surface-2)">' +
      '<div class="tiny muted">Apply</div>' +
      '<div class="b" style="font-size:1.4rem">' + esc(Feed.doseText(d)) + '</div>' +
      '<div class="tiny muted" style="margin-top:4px">of ' + esc(prod.n) + ' at ' + d.pct + '% nitrogen' +
      (d.liquid ? '' : ' — ' + FeedUI.nText(lbsN) + ' ÷ ' + (d.pct / 100).toFixed(2)) + '</div>';
    if(!d.liquid && !Units.metric && d.cups) h += '<div class="tiny muted" style="margin-top:6px">' +
      'Cups come from Maryland Extension: a cup of a dry organic meal weighs about 0.33 lb, a cup of granular about 0.5 lb. ' +
      'Weigh it if you have a scale — a cup of anything is a rough measure.</div>';
    h += '</div>';

    if(d.liquid) h += '<div class="note i" style="margin-top:8px">This is a liquid concentrate, so there is no honest dry measure for it. ' +
      'Dilute as the bottle says and treat the nitrogen figure above as the target for the season, not for one watering can.</div>';
    if(prod.note) h += '<div class="tiny muted" style="margin-top:8px">' + escU(prod.note) + '</div>';
    if(prod.npk && prod.npk[1] > 0) h += '<div class="note w" style="margin-top:8px">⚠️ <b>This also carries phosphorus.</b> ' + escU(Feed.P_NOTE) + '</div>';
    if(prod.mine) h += '<div class="tiny muted" style="margin-top:8px">Your own product — the figures are the ones off the bag, not from an extension source.</div>';
    else if(prod.src && FEED_SRC[prod.src]) h += '<div class="tiny muted" style="margin-top:8px">' +
      esc(FEED_SRC[prod.src].org) + ' — <a href="' + esc(FEED_SRC[prod.src].url) + '" target="_blank" rel="noopener noreferrer">' +
      esc(FEED_SRC[prod.src].n) + ' ↗</a></div>';

    /* Oregon State works in 100 sq ft, so restate the answer that way —
       it is the figure their tables are written in and it is how you
       check this app against them. */
    if(!d.liquid && FeedUI.ctx.sqft > 0){
      const per100 = d.lbs / FeedUI.ctx.sqft * 100;
      h += '<div class="tiny muted" style="margin-top:8px">That works out at ' +
        esc(Feed.mass(per100)) + ' of ' + esc(prod.n) + ' per 100 sq ft — the unit Oregon State writes its tables in, ' +
        'if you want to check this against them.</div>';
    }
    box.innerHTML = h;
  },

  save(){
    const p = DB.find("plantings", FeedUI.ctx.pid); if(!p) return;
    const prod = FeedUI.ctx.prod, d = FeedUI.ctx.dose;
    const sc = FeedUI.scope();
    /* a whole-bed pass is not attributable to one planting, and saying
       it was would make the per-plant history a lie */
    const rec = {
      date: $("#fd-date").value, bed_id: p.bed_id,
      planting_id: sc && sc.whole ? null : p.id,
      crop_id: sc && sc.whole ? null : p.crop_id,
      product: prod ? prod.n : null,
      amendment_id: prod && prod.mine ? prod.id : null,
      amount: d && d.ok ? Math.round(d.lbs * 1000) / 1000 : null,
      unit: d && d.ok && !d.liquid ? "lbs" : null,
      n_lbs: d && d.ok ? Math.round(FeedUI.ctx.lbsN * 1000) / 1000 : null,
      cost: num($("#fd-cost").value) || null,
      notes: $("#fd-notes").value.trim()
    };
    if(!rec.date) return toast("Pick a date");
    Feed.log(rec);
    /* tick off the calendar event this answers, so the reminder stops
       nagging without her having to find it separately */
    if(FeedUI.ctx.idx >= 0){
      const key = "feed:" + p.id + ":" + FeedUI.ctx.idx;
      const ev = DB.all("events").find(e => e.auto === key);
      if(ev) DB.update("events", ev.id, { done:"1" });
    }
    closeSheet(); refresh(); toast("Feeding logged 🌿");
  },

  /* ---------- the shelf ---------- */

  shelf(){
    const mine = DB.all("amendments");
    let h = '<p class="muted sm" style="margin-top:0">What you actually own. Type the three numbers off the front of the bag once, ' +
      'and every dose the app works out can be measured in that product.</p>';
    if(mine.length){
      h += '<div class="card pad0"><div class="list">';
      mine.forEach(a => {
        h += '<button class="item" onclick="FeedUI.editProduct(\'' + a.id + '\')"><div class="av">🌿</div>' +
          '<div class="grow"><div class="b">' + esc(a.name) + '</div>' +
          '<div class="tiny muted">' + num(a.n) + '-' + num(a.p) + '-' + num(a.k) + ' · ' + esc(a.form || "granular") +
          (num(a.cost) ? ' · $' + num(a.cost) + (num(a.lbs_per_bag) ? ' for ' + num(a.lbs_per_bag) + ' lbs' : '') : '') +
          '</div></div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    } else {
      h += '<div class="card"><div class="empty sm"><span class="e">🪴</span><div class="b">Nothing on the shelf yet</div>' +
        '<div class="tiny">Until you add something, doses are worked out in the reference products the extension services publish.</div></div></div>';
    }
    h += '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn" onclick="ProductUI.pick()">＋ Pick a product</button>' +
      '<button class="btn ghost" onclick="FeedUI.editProduct()">Type one in</button></div>';
    if(mine.length) h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="ProductUI.value()">💵 What a pound of nitrogen costs you</button>';
    openSheet("My shelf", h);
  },

  /* `pre` is a label read off a photograph: the fields it filled are
     marked so she can see what came from the camera and what she
     typed, the same convention the seed packet reader uses. */
  editProduct(id, pre){
    const a = id ? DB.find("amendments", id) : null;
    const v = k => pre && pre[k] !== null && pre[k] !== undefined ? pre[k] : (a ? a[k] : "");
    const ai = k => (pre && pre[k] !== null && pre[k] !== undefined) ? ' class="ai-filled"' : '';
    let h = '';
    if(pre) h += '<div class="note i">📷 Read off the label. Check every number against the bag before saving — anything wrong here is wrong in every dose afterwards.</div>';
    h += '<div class="field"><label class="f">Name, as it says on the bag</label>' +
      '<input type="text" id="am-name"' + ai("name") + ' value="' + esc(pre && pre.name ? pre.name : (a ? a.name : "")) + '" placeholder="Espoma Garden-tone"></div>';
    h += '<div class="field"><label class="f">Brand</label>' +
      '<input type="text" id="am-brand"' + ai("brand") + ' value="' + esc(pre && pre.brand ? pre.brand : (a ? a.brand || "" : "")) + '" placeholder="Espoma"></div>';
    h += '<div class="grid3" style="margin-top:12px">' +
      '<div><label class="f">N %</label><input type="number" step="0.1" id="am-n"' + ai("n") + ' value="' + esc(v("n")) + '" placeholder="3"></div>' +
      '<div><label class="f">P %</label><input type="number" step="0.1" id="am-p"' + ai("p") + ' value="' + esc(v("p")) + '" placeholder="4"></div>' +
      '<div><label class="f">K %</label><input type="number" step="0.1" id="am-k"' + ai("k") + ' value="' + esc(v("k")) + '" placeholder="4"></div></div>';
    h += '<div class="note i" style="margin-top:8px">The three numbers on the front of the bag, in that order. A 3-4-4 is 3% nitrogen, 4% phosphate, 4% potash.</div>';
    h += '<div class="field"><label class="f">What is it like?</label><select id="am-form">' +
      ['meal','granular','liquid','bulk'].map(f => '<option value="' + f + '"' + (a && a.form === f ? " selected" : "") + '>' +
        ({ meal:"A dry meal or powder", granular:"Granules or pellets", liquid:"A liquid concentrate", bulk:"Bulky — compost, manure, ash" })[f] +
        '</option>').join("") + '</select></div>';
    h += '<div class="tiny muted">This only decides how a weight becomes a cup measure: Maryland Extension weighs a cup of dry meal at 0.33 lb and a cup of granular at 0.5 lb. A liquid is never converted.</div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Bag weight (lbs)</label><input type="number" step="0.1" id="am-bag"' + ai("lbs_per_bag") +
        ' value="' + esc(pre && pre.lbs_per_bag ? pre.lbs_per_bag : (a ? a.lbs_per_bag : "")) + '" placeholder="4"></div>' +
      '<div><label class="f">Bag cost ($)</label><input type="number" step="0.01" id="am-cost" value="' + esc(a ? a.cost : "") + '" placeholder="14.99"></div></div>';
    h += '<div class="tiny muted">Fill both and the app can tell you what a pound of actual nitrogen costs you in this — the only fair way to compare two bags.</div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="am-notes">' + esc(a ? a.notes || "" : "") + '</textarea></div>';
    h += '<button class="btn block" style="margin-top:14px" onclick="FeedUI.saveProduct(' + (a ? "'" + a.id + "'" : "null") + ')">Save</button>';
    if(a) h += '<button class="btn ghost danger block" style="margin-top:8px" onclick="DB.remove(\'amendments\',\'' + a.id + '\');FeedUI.shelf()">Remove from the shelf</button>';
    openSheet(a ? "Edit product" : "Add a product", h);
  },

  saveProduct(id){
    const name = $("#am-name").value.trim();
    if(!name) return toast("Give it a name");
    const rec = {
      name: name, brand: $("#am-brand") ? $("#am-brand").value.trim() || null : null,
      n: num($("#am-n").value), p: num($("#am-p").value), k: num($("#am-k").value),
      form: $("#am-form").value, organic: "0",
      lbs_per_bag: num($("#am-bag").value) || null, cost: num($("#am-cost").value) || null,
      notes: $("#am-notes").value.trim()
    };
    if(!rec.n && !rec.p && !rec.k) return toast("It needs at least one number off the analysis");
    if(id) DB.update("amendments", id, rec); else DB.insert("amendments", rec);
    FeedUI.shelf(); toast("Saved");
  }
};

/* ---- the feeding card, into the planting sheet ---- */
(function feedInSheet(){
  const orig = Garden.plantingSheet.bind(Garden);
  Garden.plantingSheet = function(p){
    orig(p);
    if(!p || !p.crop_id) return;
    const body = $("#sheet-body"); if(!body) return;
    const h = FeedUI.card(p);
    if(!h) return;
    const anchor = '<div class="grid2" style="margin-top:16px">';
    if(body.innerHTML.indexOf(anchor) >= 0) body.innerHTML = body.innerHTML.replace(anchor, h + anchor);
    else body.insertAdjacentHTML("beforeend", h);
  };
})();

/* ---- "log this feeding" on a feed event ---- */
(function feedInCalendar(){
  const orig = Cal.openEvent.bind(Cal);
  Cal.openEvent = function(id){
    orig(id);
    const e = DB.find("events", id);
    if(!e || e.type !== "feed" || !e.planting_id) return;
    const body = $("#sheet-body"); if(!body) return;
    const m = /^feed:[^:]+:(\d+)$/.exec(e.auto || "");
    body.insertAdjacentHTML("beforeend",
      '<button class="btn block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){FeedUI.open(\'' +
      e.planting_id + '\',' + (m ? m[1] : -1) + ')},250)">🌿 Work out the dose and log it</button>');
  };
})();

/* ---- the shelf, from Settings ---- */
(function feedInSettings(){
  const orig = Settings.render.bind(Settings);
  Settings.render = function(){
    orig();
    const box = $("#s-settings"); if(!box) return;
    const n = DB.all("amendments").length;
    const h = '<div class="sec"><h2>Feeding</h2></div><div class="card">' +
      '<div class="row between"><div class="grow"><div class="b">My shelf</div>' +
      '<div class="tiny muted">' + (n ? n + ' product' + (n === 1 ? "" : "s") + ' you own' : "Nothing added — doses use the published reference products") + '</div></div>' +
      '<button class="btn sm ghost" onclick="FeedUI.shelf()">Manage</button></div>' +
      '<div class="tiny muted" style="margin-top:10px">Feeding rates come from Maryland, Oregon State and Missouri Extension. ' +
      'The app works out nitrogen and refuses to guess at phosphorus, because most established beds already have more than they can use.</div>' +
      '</div>';
    const anchor = '<div class="sec" style="margin-top:24px"><h2>&nbsp;</h2></div>';
    if(box.innerHTML.indexOf(anchor) >= 0) box.innerHTML = box.innerHTML.replace(anchor, h + anchor);
    else box.insertAdjacentHTML("beforeend", h);
  };
})();
</script>
