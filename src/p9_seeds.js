<script>
/* ============================================================
   SEED BANK — inventory, viability, packet photos
   ============================================================ */
const Seeds = {
  q: "", filter: "all",

  viability(s){
    const c = crop(s.crop_id);
    const yrs = c && c.via ? c.via : 3;
    const packed = num(s.packed_year, 0);
    const yr = today().getFullYear();
    if(s.exp_date){
      const d = parseISO(s.exp_date);
      if(d && d < today()) return { level:"expired", age: packed ? yr - packed : null, pct: 20, yrs: yrs,
        msg:"Past the printed date — test before sowing." };
    }
    if(!packed) return { level:"unknown", age:null, pct:null, yrs:yrs, msg:"No packed year — add one to track viability." };
    const age = yr - packed, r = age / yrs;
    const base = num(s.germ_rate, 85);
    const pct = Math.round(clamp(base * Math.pow(0.72, Math.max(0, r * 1.4)), 5, 100));
    if(r < 0.4) return { level:"fresh",   age: age, pct: pct, yrs: yrs, msg:"Fresh — sow with confidence." };
    if(r < 0.85) return { level:"good",    age: age, pct: pct, yrs: yrs, msg:"Still strong. Sow normally." };
    if(r < 1.15) return { level:"fading", age: age, pct: pct, yrs: yrs, msg:"Getting old — sow thicker and use these first." };
    return { level:"expired", age: age, pct: pct, yrs: yrs, msg:"Past typical viability. Run a paper-towel test on 10 seeds before giving up bed space." };
  },
  badge(v){
    const m = { fresh:["good","Fresh"], good:["good","Good"], fading:["warn","Fading"], expired:["bad","Expired"], unknown:["","Unknown"] };
    const x = m[v.level] || m.unknown;
    return '<span class="chip ' + x[0] + ' tiny">' + x[1] + (v.pct !== null ? " · ~" + v.pct + "%" : "") + '</span>';
  },

  render(){
    const box = $("#s-seeds");
    let list = DB.all("seeds").slice();
    const q = Seeds.q.toLowerCase();
    if(q) list = list.filter(s => (s.name + " " + (s.variety||"") + " " + (s.brand||"") + " " + cropName(s.crop_id)).toLowerCase().indexOf(q) >= 0);
    if(Seeds.filter !== "all") list = list.filter(s => {
      const v = Seeds.viability(s);
      if(Seeds.filter === "expired") return v.level === "expired";
      if(Seeds.filter === "fading") return v.level === "fading";
      if(Seeds.filter === "sownow"){ const st = Season.status(s.crop_id); return st && st.inWindow; }
      return true;
    });
    list.sort((a,b) => (a.name || "").localeCompare(b.name || ""));

    const all = DB.all("seeds");
    const counts = { expired: 0, fading: 0, sownow: 0 };
    all.forEach(s => { const v = Seeds.viability(s);
      if(v.level === "expired") counts.expired++; if(v.level === "fading") counts.fading++;
      const st = Season.status(s.crop_id); if(st && st.inWindow) counts.sownow++; });

    let h = '';
    h += '<div class="card"><div class="grid3">' +
      '<div class="stat"><span class="n">' + all.length + '</span><span class="l">packets</span></div>' +
      '<div class="stat"><span class="n">' + counts.sownow + '</span><span class="l">sow now</span></div>' +
      '<div class="stat"><span class="n">' + counts.expired + '</span><span class="l">expired</span></div>' +
      '</div></div>';

    h += '<div class="row" style="gap:8px;margin-top:12px">' +
      '<button class="btn grow" onclick="Seeds.add()">＋ Add packet</button>' +
      '<button class="btn ghost" onclick="Seeds.germTest()">🧪 Germ test</button></div>';

    h += '<input type="search" id="sd-q" placeholder="Search your seed bank…" style="margin-top:12px" value="' + esc(Seeds.q) + '">';
    h += '<div class="scroller" style="margin-top:10px">' +
      ['all','sownow','fading','expired'].map(f => '<button class="chip ' + (Seeds.filter === f ? "on" : "") + '" onclick="Seeds.filter=\'' + f + '\';Seeds.render()">' +
        ({all:"All", sownow:"Sow now", fading:"Fading", expired:"Expired"})[f] + '</button>').join("") + '</div>';

    if(!all.length){
      h += '<div class="card" style="margin-top:12px"><div class="empty"><span class="e">🌰</span><div class="b">Your seed bank is empty</div>' +
        '<div class="tiny">Snap a photo of a packet or type it in. Every packet you add fills in your grow calendar automatically.</div></div>' +
        '<button class="btn block" onclick="Seeds.add()">Add my first packet</button></div>';
    } else if(!list.length){
      h += '<div class="card center muted sm" style="margin-top:12px">Nothing matches that filter.</div>';
    } else {
      h += '<div class="card pad0" style="margin-top:12px"><div class="list">';
      list.forEach(s => {
        const v = Seeds.viability(s);
        const st = Season.status(s.crop_id);
        const ph = Photos.url(s.photo_id);
        h += '<button class="item" onclick="Seeds.open(\'' + s.id + '\')">' +
          '<div class="av">' + (ph ? '<img src="' + ph + '" alt="">' : cropEmoji(s.crop_id)) + '</div>' +
          '<div class="grow"><div class="b truncate">' + esc(s.name) + (s.variety ? ' <span class="muted">· ' + esc(s.variety) + '</span>' : '') + '</div>' +
          '<div class="tiny muted truncate">' + esc(s.brand || "—") + (s.packed_year ? ' · packed ' + esc(s.packed_year) : '') +
            (s.qty ? ' · ' + esc(s.qty) + ' ' + esc(s.unit || "seeds") : '') + '</div>' +
          '<div class="row wrap" style="gap:4px;margin-top:4px">' + Seeds.badge(v) +
            (st && st.inWindow ? '<span class="chip info tiny">' + esc(st.w.label) + ' now</span>' : '') + '</div></div>' +
          '<span class="go">›</span></button>';
      });
      h += '</div></div>';
    }
    box.innerHTML = h;
    const qi = $("#sd-q");
    if(qi) qi.oninput = e => { Seeds.q = e.target.value; Seeds.render(); setTimeout(() => { const n = $("#sd-q"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); };
  },

  /* ---------- add / edit ---------- */
  add(prefill){
    Seeds.form(null, prefill);
  },
  open(id){ Seeds.form(DB.find("seeds", id)); },

  form(s, prefill){
    s = s || null;
    Seeds._editId = s ? s.id : null;
    const cur = Object.assign({}, s || {}, prefill || {});
    const yr = today().getFullYear();
    Seeds._readState = null;
    Seeds._aiFields = {};
    Seeds._readSrc = null;
    /* "Packed for year" is pre-filled with this year as a convenience. That is a
       default, not something she typed, so the packet reader may replace it. */
    Seeds._defaults = { "#sd-packed": cur.packed_year ? "" : String(yr) };
    let h = '';

    h += '<div id="sd-photo">' + Seeds.photoBlock(cur.photo_id) + '</div>';
    h += '<div class="row" style="gap:8px;margin:10px 0">' +
      '<button class="btn ghost grow sm" onclick="Seeds.capture(true)">📷 Photograph packet</button>' +
      '<button class="btn ghost grow sm" onclick="Seeds.capture(false)">🖼️ Upload</button></div>';
    h += '<div id="sd-airead" style="margin-bottom:12px">' + Seeds.readBlock() + '</div>';

    h += '<div class="field"><label class="f">Crop</label><div class="row" style="gap:8px">' +
      '<input type="text" id="sd-cropname" readonly value="' + esc(cur.crop_id ? cropName(cur.crop_id) : "") + '" placeholder="Pick a crop">' +
      '<button class="btn ghost sm" onclick="Seeds.pickCrop()">Choose</button></div>' +
      '<input type="hidden" id="sd-crop" value="' + esc(cur.crop_id || "") + '"></div>';
    h += '<div class="field"><label class="f">Packet name</label><input type="text" id="sd-name" value="' + esc(cur.name || "") + '" placeholder="Cherry Tomato"></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Variety</label><div class="row" style="gap:6px">' +
        '<input type="text" id="sd-var" value="' + esc(cur.variety || "") + '" placeholder="Sungold">' +
        (cur.crop_id ? '<button class="btn ghost sm" onclick="Seeds.pickVariety()">▾</button>' : '') + '</div></div>' +
      '<div><label class="f">Brand</label><input type="text" id="sd-brand" value="' + esc(cur.brand || "") + '" placeholder="Baker Creek"></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Quantity</label><input type="number" id="sd-qty" value="' + esc(cur.qty || "") + '" placeholder="50"></div>' +
      '<div><label class="f">Unit</label><select id="sd-unit">' + ["seeds","grams","oz","packets","cloves","slips"].map(u =>
        '<option' + (cur.unit === u ? " selected" : "") + '>' + u + '</option>').join("") + '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Packed for year</label><input type="number" id="sd-packed" value="' + esc(cur.packed_year || yr) + '" min="1990" max="' + (yr+3) + '"></div>' +
      '<div><label class="f">Printed expiry</label><input type="date" id="sd-exp" value="' + esc(cur.exp_date || "") + '"></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Germination %</label><input type="number" id="sd-germ" value="' + esc(cur.germ_rate || "") + '" placeholder="85" min="1" max="100"></div>' +
      '<div><label class="f">Cost ($)</label><input type="number" id="sd-cost" step="0.01" value="' + esc(cur.cost || "") + '" placeholder="3.95"></div></div>';
    h += '<div class="field"><label class="f">Source / lot</label><input type="text" id="sd-source" value="' + esc(cur.source || "") + '" placeholder="Where you got it, lot number"></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="sd-notes" placeholder="Saved from my own plants, gifted, etc.">' + esc(cur.notes || "") + '</textarea></div>';

    if(s){
      const v = Seeds.viability(s), c = crop(s.crop_id);
      h += '<div class="note ' + (v.level === "expired" ? "d" : v.level === "fading" ? "w" : "g") + '" style="margin-top:14px">' +
        '<b>' + (v.age !== null ? v.age + ' year' + (v.age === 1 ? "" : "s") + ' old' : 'Age unknown') + '.</b> ' + esc(v.msg) +
        (c ? ' ' + esc(c.n) + ' seed typically stays viable about ' + v.yrs + ' years.' : '') + '</div>';
      const ws = Season.windows(s.crop_id);
      if(ws.length){
        h += '<div class="note i" style="margin-top:8px"><b>Your sowing dates</b><br>' +
          ws.map(w => w.icon + ' ' + esc(w.label) + ': <b>' + fmt(w.date) + '</b>').join("<br>") + '</div>';
      }
      if(c) h += '<div class="note g" style="margin-top:8px"><b>Germination.</b> ' + c.depth + '" deep · ' +
        c.germ[0] + '–' + c.germ[1] + ' days · soil ' + c.soilF[0] + '–' + c.soilF[2] + '°F (best at ' + c.soilF[1] + '°F).</div>';
    }

    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      (s ? '<button class="btn ghost" onclick="Seeds.del(\'' + s.id + '\')">Delete</button>' : '') +
      '<button class="btn grow" onclick="Seeds.save()">Save packet</button></div>';
    if(s) h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Library.open(\'' + s.crop_id + '\')},250)">Growing guide →</button>';

    openSheet(s ? "Edit packet" : "Add seed packet", h);
    Seeds._photoId = cur.photo_id || null;
  },

  photoBlock(id){
    const u = Photos.url(id);
    return u ? '<img class="photo" src="' + u + '" alt="Seed packet" style="max-height:220px;object-fit:cover">'
             : '<div class="center muted sm" style="padding:22px;background:var(--surface-2);border-radius:var(--radius)">📷 No packet photo yet</div>';
  },

  capture(useCamera){
    const inp = useCamera ? $("#filepick-cam") : $("#filepick");
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files[0]; if(!f) return;
      try{
        /* Two sizes. Packet print is small, so the copy sent for reading keeps
           more pixels — but that copy is never stored, because a vault holding
           twenty full-size packet photos would blow past the localStorage
           fallback. What gets saved is the usual 900px thumbnail. */
        const lo = await shrinkImage(f, 900, 0.72);
        if(Seeds._photoId) Photos.drop(Seeds._photoId);
        Seeds._photoId = Photos.put(lo.dataUrl, lo.w, lo.h);
        const box = $("#sd-photo"); if(box) box.innerHTML = Seeds.photoBlock(Seeds._photoId);
        Seeds._readSrc = null;
        if(Vision.ready()){
          try{ const hi = await shrinkImage(f, 1500, 0.86); Seeds._readSrc = Vision.fromDataUrl(hi.dataUrl); }
          catch(e){ /* fall back to the stored thumbnail */ }
          /* the point of photographing a packet is not having to type it in,
             so read it straight away rather than waiting to be asked */
          Seeds.readPacket();
        } else { Seeds.paint(); toast("Photo attached"); }
      }catch(e){ toast("Could not read that image"); }
    };
    inp.click();
  },

  /* ---------- the AI-read strip under the photo ---------- */
  readBlock(state){
    state = state || Seeds._readState || null;
    if(!Vision.ready()){
      return !Seeds._photoId ? '' :
        '<div class="note i tiny">Connect an AI key in Settings and the app will read packets for you automatically.' +
        ' <button class="btn ghost sm" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Assist.setup()},250)">Connect</button></div>';
    }
    if(state && state.busy)
      return '<div class="note i sm"><span class="spinner"></span> Reading the packet with ' + esc(Vision.who()) + '…</div>';
    if(state && state.err)
      return '<div class="note d sm"><b>Could not read the packet.</b><br>' + esc(state.err) + '</div>' +
        '<button class="btn outline block sm" style="margin-top:8px" onclick="Seeds.readPacket()">↻ Try reading it again</button>';
    if(state && state.filled)
      return '<div class="note g sm"><b>✨ Filled in from the photo.</b> ' +
        (state.filled.length ? esc(state.filled.join(", ")) + '. ' : '') +
        'Check each field and correct anything it got wrong before saving.</div>' +
        (state.missed && state.missed.length
          ? '<div class="note w tiny" style="margin-top:6px">Could not read: ' + esc(state.missed.join(", ")) + '. Fill those in yourself.</div>' : '') +
        '<button class="btn ghost block sm" style="margin-top:8px" onclick="Seeds.readPacket()">↻ Read the photo again</button>';
    return Seeds._photoId
      ? '<button class="btn outline block sm" onclick="Seeds.readPacket()">✨ Read the packet with ' + esc(Vision.who()) + '</button>'
      : '';
  },
  paint(){ const b = $("#sd-airead"); if(b) b.innerHTML = Seeds.readBlock(); },

  pickVariety(){
    const d = Seeds.readForm();
    if(!d.crop_id) return toast("Pick a crop first");
    Seeds._draft = d;
    const editId = Seeds._editId;
    Varieties.pick(d.crop_id, name => {
      closeSheet();
      setTimeout(() => {
        Seeds.form(editId ? DB.find("seeds", editId) : null,
          Object.assign({}, Seeds._draft, { variety: name || "" }));
      }, 220);
    });
  },

  pickCrop(){
    Seeds._draft = Seeds.readForm();          /* capture what is typed BEFORE the sheet swaps */
    const editId = Seeds._editId;
    Garden.cropPicker("Which crop is this?", id => {
      closeSheet();
      setTimeout(() => {
        const merged = Object.assign({}, Seeds._draft || {}, {
          crop_id: id, photo_id: Seeds._photoId,
          name: (Seeds._draft && Seeds._draft.name) || cropName(id)
        });
        Seeds.form(editId ? DB.find("seeds", editId) : null, merged);
      }, 230);
    });
  },

  readForm(){
    if(!$("#sd-name")) return {};
    return {
      crop_id: $("#sd-crop").value, name: $("#sd-name").value.trim(), variety: $("#sd-var").value.trim(),
      brand: $("#sd-brand").value.trim(), qty: $("#sd-qty").value, unit: $("#sd-unit").value,
      packed_year: $("#sd-packed").value, exp_date: $("#sd-exp").value, germ_rate: $("#sd-germ").value,
      cost: $("#sd-cost").value, source: $("#sd-source").value.trim(), notes: $("#sd-notes").value.trim(),
      photo_id: Seeds._photoId
    };
  },

  save(id){
    if(id === undefined) id = Seeds._editId;
    const d = Seeds.readForm();
    if(!d.name && !d.crop_id) return toast("Add a name or pick a crop");
    if(!d.name) d.name = cropName(d.crop_id);
    if(id) DB.update("seeds", id, d); else DB.insert("seeds", d);
    Cal.rebuild();
    closeSheet(); Seeds.render(); toast("Packet saved");
  },
  del(id){
    confirmSheet("Delete this packet?", "It is removed from your seed bank and its calendar entries go with it.", "Delete", () => {
      const s = DB.find("seeds", id); if(s && s.photo_id) Photos.drop(s.photo_id);
      DB.bulkRemove("events", e => e.seed_id === id);
      DB.remove("seeds", id); Seeds.render(); toast("Deleted");
    }, true);
  },

  germTest(){
    openSheet("Germination test",
      '<p class="muted sm" style="margin-top:0">The 10-seed paper towel test tells you in a week whether an old packet is worth bed space.</p>' +
      '<div class="note g"><b>How to run it</b><br>1. Count out 10 seeds.<br>2. Fold them into a damp paper towel, slide it into a zip bag.<br>' +
      '3. Keep it somewhere warm — on top of the fridge is perfect.<br>4. Check daily; count sprouts at the crop\'s max germination day.</div>' +
      '<div class="grid2" style="margin-top:14px">' +
      '<div><label class="f">Seeds tested</label><input type="number" id="gt-n" value="10"></div>' +
      '<div><label class="f">Sprouted</label><input type="number" id="gt-s" value="0"></div></div>' +
      '<button class="btn block" style="margin-top:12px" onclick="Seeds.germResult()">Calculate</button>' +
      '<div id="gt-out" style="margin-top:12px"></div>');
  },
  germResult(){
    const n = num($("#gt-n").value, 10), s = num($("#gt-s").value, 0);
    const pct = n ? Math.round(s / n * 100) : 0;
    let msg, cls;
    if(pct >= 80){ msg = "Excellent. Sow at normal density."; cls = "g"; }
    else if(pct >= 60){ msg = "Usable. Sow about 25% thicker than the packet says."; cls = "g"; }
    else if(pct >= 40){ msg = "Weak. Sow double, and don't give it your best bed space."; cls = "w"; }
    else if(pct >= 20){ msg = "Poor. Worth using only for greens you sow thickly anyway — or start them in a tray and transplant what comes up."; cls = "w"; }
    else { msg = "Effectively dead. Compost it and buy fresh."; cls = "d"; }
    $("#gt-out").innerHTML = '<div class="note ' + cls + '"><b>' + pct + '% germination.</b> ' + esc(msg) + '</div>';
  },

  /* ---------- reading the packet photo ----------
     Models are cheerful about returning "approx. 25 seeds", "Packed for 2025"
     or "10/2026" in fields that are <input type="number"> and <input type="date">.
     A browser silently rejects a value it cannot parse, which is exactly what
     "the picture appears but nothing fills in" looks like. So every value is
     coerced to the shape its input accepts before it is written.            */
  PACKET_PROMPT:
    "This is a photograph of a garden seed packet. Read the printed text and return ONLY a JSON " +
    "object — no prose, no markdown fence — with exactly these keys:\n" +
    '{"crop":"","name":"","variety":"","brand":"","qty":"","unit":"","packed_year":"","exp_date":"",' +
    '"germ_rate":"","notes":""}\n' +
    "crop = the plain common vegetable/herb/flower name only, e.g. \"tomato\", \"cucumber\", \"sweet pepper\".\n" +
    "name = what the packet calls itself, e.g. \"Cherry Tomato\".\n" +
    "variety = the cultivar only, e.g. \"Sungold\" — not the crop name.\n" +
    "brand = the seed company.\n" +
    "qty = a bare number only (no words or units). unit = one of: seeds, grams, oz, packets, cloves, slips.\n" +
    "packed_year = a 4-digit year. exp_date = YYYY-MM-DD. germ_rate = a bare number 0-100.\n" +
    "notes = the planting instructions printed on the packet, condensed to two or three short sentences.\n" +
    "Use an empty string for anything not printed on the packet or not legible. Never guess or invent a value.",

  /* value coercion */
  _num(v){ const m = String(v == null ? "" : v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return m ? m[0] : ""; },
  _year(v){ const m = String(v == null ? "" : v).match(/\b(19|20)\d{2}\b/); return m ? m[0] : ""; },
  _date(v){
    const s = String(v == null ? "" : v).trim();
    if(!s) return "";
    let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if(m) return m[0];
    /* a packet usually prints a month and year — treat that as the end of that month */
    m = s.match(/\b(\d{1,2})\s*[\/.-]\s*((?:19|20)\d{2})\b/);
    if(m){ const mo = clamp(num(m[1], 1), 1, 12), yr = num(m[2]);
      return iso(new Date(yr, mo, 0)); }
    m = s.match(/\b((?:19|20)\d{2})\s*[\/.-]\s*(\d{1,2})\b/);
    if(m){ const yr = num(m[1]), mo = clamp(num(m[2], 1), 1, 12);
      return iso(new Date(yr, mo, 0)); }
    m = s.match(/\b((?:19|20)\d{2})\b/);
    if(m) return m[1] + "-12-31";
    return "";
  },
  _unit(v){
    const s = String(v == null ? "" : v).trim().toLowerCase();
    const opts = ["seeds","grams","oz","packets","cloves","slips"];
    if(opts.indexOf(s) >= 0) return s;
    if(/^(g|gram|gm|gms)\b/.test(s)) return "grams";
    if(/^(oz|ounce)/.test(s)) return "oz";
    if(/seed/.test(s)) return "seeds";
    if(/clove/.test(s)) return "cloves";
    if(/slip/.test(s)) return "slips";
    if(/packet|pkt/.test(s)) return "packets";
    return "";
  },

  /* the old matcher took the first crop whose first word appeared anywhere in the
     text, so "Sweet Corn" could be claimed by an earlier entry. Longest match wins,
     and a handful of aliases cover names a packet uses but the crop table does not. */
  CROP_ALIASES: {
    pepper:["bell pepper","sweet bell pepper","sweet pepper","capsicum","pepper"],
    hotpepper:["hot pepper","chili pepper","chilli pepper","chile pepper","jalapeno","jalapeño","habanero","cayenne","serrano","poblano"],
    tomato:["tomato","tomatoes"], cucumber:["cucumber","cucumbers","cuke"],
    zucchini:["zucchini","courgette","summer squash","yellow squash","crookneck"],
    wintersquash:["winter squash","butternut","acorn squash","spaghetti squash","delicata","kabocha"],
    melon:["cantaloupe","muskmelon","honeydew","melon"], watermelon:["watermelon"],
    bushbean:["bush bean","green bean","snap bean","string bean","wax bean","haricot"],
    polebean:["pole bean","runner bean","climbing bean"],
    pea:["pea","peas","snap pea","snow pea","shelling pea","garden pea"],
    corn:["sweet corn","corn"], chard:["swiss chard","chard","silverbeet"],
    beet:["beet","beetroot","beets"], arugula:["arugula","rocket"],
    bokchoy:["bok choy","pak choi","pak choy"], mustard:["mustard greens","mustard"],
    collards:["collards","collard greens"], brussels:["brussels sprouts","brussel sprouts"],
    chive:["chives","chive"], cilantro:["cilantro","coriander"],
    sweetpotato:["sweet potato","sweetpotato"], okra:["okra"], eggplant:["eggplant","aubergine"],
    lettuce:["lettuce","romaine","butterhead","looseleaf"], spinach:["spinach"],
    marigold:["marigold","tagetes"], calendula:["calendula","pot marigold"],
    nasturtium:["nasturtium"], sunflower:["sunflower"], borage:["borage"]
  },
  matchCrop(text){
    const t = " " + String(text || "").toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ") + " ";
    if(t.trim() === "") return null;
    let best = null, bestLen = 0;
    CROPS.forEach(c => {
      const names = [c.n].concat(c.n.split("/"))
        .concat(Seeds.CROP_ALIASES[c.id] || []);
      names.forEach(n => {
        n = String(n).trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
        if(!n || n.length <= bestLen) return;
        if(t.indexOf(" " + n + " ") >= 0 || t.indexOf(" " + n + "s ") >= 0 || t.indexOf(" " + n + "es ") >= 0){
          best = c; bestLen = n.length;
        }
      });
    });
    return best;
  },

  async readPacket(){
    if(!Vision.ready()){ Seeds._readState = null; Seeds.paint(); return Assist.setup(); }
    if(!Seeds._photoId){ Seeds._readState = null; Seeds.paint(); return toast("Take a photo of the packet first"); }

    Seeds._readState = { busy:true }; Seeds.paint();
    let d;
    try{
      d = await Vision.json(Seeds._readSrc || Seeds._photoId, Seeds.PACKET_PROMPT);
    }catch(e){
      Seeds._readState = { err: Vision.explain(e) }; Seeds.paint();
      return;
    }

    const filled = [], missed = [];
    /* never silently overwrite something she typed herself */
    const put = (sel, val, label, force) => {
      const el = $(sel);
      if(!el){ return; }
      if(val === "" || val === null || val === undefined){ if(label) missed.push(label); return; }
      const had = String(el.value || "").trim();
      const wasDefault = had && had === (Seeds._defaults || {})[sel];
      if(had && !wasDefault && !force && !(Seeds._aiFields || {})[sel]) return;
      el.value = val;
      if(String(el.value || "").trim() !== String(val).trim()){ if(label) missed.push(label); return; }
      el.classList.add("ai-filled");
      (Seeds._aiFields = Seeds._aiFields || {})[sel] = 1;
      if(label) filled.push(label);
    };

    const name = String(d.name || "").trim();
    const variety = String(d.variety || "").trim();
    const cropText = [d.crop, name, variety, d.notes].filter(Boolean).join(" ");
    const guess = Seeds.matchCrop(cropText);

    put("#sd-name", name || (guess ? guess.n : ""), "name");
    put("#sd-var", variety, "variety");
    put("#sd-brand", String(d.brand || "").trim(), "brand");
    put("#sd-qty", Seeds._num(d.qty), "quantity");
    put("#sd-packed", Seeds._year(d.packed_year), "packed year");
    put("#sd-exp", Seeds._date(d.exp_date), "expiry");
    put("#sd-germ", Seeds._num(d.germ_rate), "germination %");
    put("#sd-notes", String(d.notes || "").trim(), "packet instructions");

    const u = Seeds._unit(d.unit);
    if(u){ const el = $("#sd-unit"); if(el) el.value = u; }

    if(guess && !$("#sd-crop").value){
      $("#sd-crop").value = guess.id;
      const cn = $("#sd-cropname");
      if(cn){ cn.value = guess.n; cn.classList.add("ai-filled"); }
      filled.unshift("crop (" + guess.n + ")");
    } else if(!guess && !$("#sd-crop").value){
      missed.push("crop — pick it with Choose");
    }

    if(!filled.length){
      Seeds._readState = { err:"Nothing legible on that photo. Fill the front of the packet, hold steady, and avoid glare." };
    } else {
      Seeds._readState = { filled: filled, missed: missed };
      haptic();
    }
    Seeds.paint();
  }
};

/* ============================================================
   GROW CALENDAR
   ============================================================ */
const EV = {
  indoor:    { c:"#9b6bd6", i:"🏠", n:"Start indoors" },
  transplant:{ c:"#2a8c5e", i:"🌱", n:"Transplant" },
  direct:    { c:"#f0a500", i:"🌰", n:"Direct sow" },
  fall:      { c:"#c96a2f", i:"🍂", n:"Fall sowing" },
  harvest:   { c:"#c9453c", i:"🧺", n:"Harvest window" },
  expiry:    { c:"#8b9a91", i:"⏳", n:"Seed expiry" },
  frost:     { c:"#2f6fb0", i:"❄️", n:"Frost date" },
  task:      { c:"#5c6b62", i:"📌", n:"Task" }
};

const Cal = {
  month: null,

  /* regenerate auto events from the seed bank, plantings and frost dates */
  rebuild(){
    const yr = today().getFullYear();
    if(!Season.lastFrost() || !Season.firstFrost()) return;
    const keep = {};

    const put = (key, o) => {
      keep[key] = 1;
      const ex = DB.all("events").find(e => e.auto === key);
      if(ex){ DB.update("events", ex.id, o); return ex; }
      return DB.insert("events", Object.assign({ auto: key, done: "0" }, o));
    };

    /* frost markers */
    put("frost:last:" + yr, { date: Season.lastFrostISO, type:"frost", title:"Average last spring frost" });
    put("frost:first:" + yr, { date: Season.firstFrostISO, type:"frost", title:"Average first fall frost" });

    /* one set of sowing events per crop you own seed for */
    const owned = {};
    DB.all("seeds").forEach(s => { if(s.crop_id) (owned[s.crop_id] = owned[s.crop_id] || []).push(s); });
    Object.keys(owned).forEach(cid => {
      const s0 = owned[cid][0];
      Season.windows(cid).forEach(w => {
        put("seed:" + cid + ":" + w.kind + ":" + (w.year || yr), {
          date: iso(w.date), type: w.kind, crop_id: cid, seed_id: s0.id,
          title: w.label + " " + cropName(cid), notes: w.note
        });
      });
      owned[cid].forEach(s => {
        const v = Seeds.viability(s);
        if(s.packed_year && v.yrs){
          const endYr = num(s.packed_year) + v.yrs;
          if(endYr >= yr && endYr <= yr + 1)
            put("exp:" + s.id, { date: endYr + "-01-15", type:"expiry", crop_id: cid, seed_id: s.id,
              title: s.name + " seed reaches typical viability limit", notes:"Sow it before this or run a germination test." });
        }
      });
    });

    /* harvest windows for real plantings */
    DB.where("plantings", p => p.status !== "removed" && p.sown_on).forEach(p => {
      const h = Season.harvestFrom(p.crop_id, p.sown_on, "seed");
      if(!h) return;
      put("harv:" + p.id, { date: iso(h), type:"harvest", crop_id: p.crop_id, bed_id: p.bed_id, planting_id: p.id,
        title: "First harvest: " + cropName(p.crop_id), notes:"Roughly " + crop(p.crop_id).dtm + " days from planting." });
    });

    /* prune stale auto events */
    DB.bulkRemove("events", e => e.auto && !keep[e.auto] && e.done !== "1");
  },

  forPlanting(p){ if(p) Cal.rebuild(); },

  render(){
    const box = $("#s-calendar");
    if(!Cal.month){ const t = today(); Cal.month = new Date(t.getFullYear(), t.getMonth(), 1); }
    const m = Cal.month;
    const evs = DB.all("events");
    const byDate = {};
    evs.forEach(e => { if(!e.date) return; (byDate[e.date] = byDate[e.date] || []).push(e); });

    let h = '';
    if(!Season.lastFrost()){
      h += '<div class="card"><div class="note i">Set your location and the calendar builds itself from your frost dates and seed bank.</div>' +
        '<button class="btn block" style="margin-top:10px" onclick="Onboard.open()">Set location</button></div>';
      box.innerHTML = h; return;
    }

    h += '<div class="card"><div class="row between" style="margin-bottom:10px">' +
      '<button class="iconbtn" onclick="Cal.shift(-1)">‹</button>' +
      '<div class="b">' + MONF[m.getMonth()] + ' ' + m.getFullYear() + '</div>' +
      '<button class="iconbtn" onclick="Cal.shift(1)">›</button></div>';

    h += '<div class="cal">';
    DOW.forEach(d => h += '<div class="dow">' + d[0] + '</div>');
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    for(let i = 0; i < 42; i++){
      const d = addDays(start, i), k = iso(d);
      const out = d.getMonth() !== m.getMonth();
      const list = byDate[k] || [];
      const types = list.map(e => e.type).filter((v, ix, a) => a.indexOf(v) === ix).slice(0, 3);
      h += '<button class="d ' + (out ? "out" : "") + ' ' + (k === iso(today()) ? "today" : "") + '" onclick="Cal.day(\'' + k + '\')">' +
        '<span>' + d.getDate() + '</span><span class="dots">' +
        types.map(t => '<span class="dot" style="background:' + (EV[t] ? EV[t].c : "#888") + '"></span>').join("") +
        '</span></button>';
    }
    h += '</div>';
    h += '<div class="row wrap tiny muted" style="gap:8px;margin-top:10px">' +
      Object.keys(EV).map(k => '<span class="row" style="gap:4px"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:' + EV[k].c + ';display:inline-block"></span>' + EV[k].n + '</span>').join("") +
      '</div></div>';

    /* upcoming list */
    const upcoming = evs.filter(e => e.date && diffDays(today(), parseISO(e.date)) >= -14)
      .sort((a,b) => a.date < b.date ? -1 : 1).slice(0, 40);
    h += '<div class="sec"><h2>What is next</h2><button class="tiny b" onclick="Cal.addTask()">＋ Task</button></div>';
    if(!upcoming.length) h += '<div class="card center muted sm">Nothing scheduled yet. Add packets to your seed bank.</div>';
    else {
      h += '<div class="card"><div class="tl">';
      let lastMonth = null;
      upcoming.forEach(e => {
        const d = parseISO(e.date), mk = d.getFullYear() + "-" + d.getMonth();
        if(mk !== lastMonth){ lastMonth = mk;
          h += '<div class="tiny b muted" style="margin:8px 0 2px;text-transform:uppercase;letter-spacing:.06em">' + MONF[d.getMonth()] + '</div>'; }
        const late = diffDays(today(), d) < 0 && e.done !== "1";
        h += '<div class="ev"><button class="row" style="width:100%;text-align:left;gap:10px" onclick="Cal.openEvent(\'' + e.id + '\')">' +
          '<span style="font-size:1.2rem">' + (EV[e.type] ? EV[e.type].i : "📌") + '</span>' +
          '<span class="grow"><span class="b" style="display:block' + (e.done === "1" ? ";opacity:.5;text-decoration:line-through" : "") + '">' + esc(e.title) + '</span>' +
          '<span class="tiny ' + (late ? "" : "muted") + '"' + (late ? ' style="color:var(--danger)"' : '') + '>' + fmt(d) + ' · ' + relDay(d) + (late ? ' · overdue' : '') + '</span></span>' +
          '<span class="go">›</span></button></div>';
      });
      h += '</div></div>';
    }
    box.innerHTML = h;
  },

  shift(n){ Cal.month = new Date(Cal.month.getFullYear(), Cal.month.getMonth() + n, 1); Cal.render(); },

  day(k){
    const list = DB.where("events", e => e.date === k).sort((a,b) => (a.type||"").localeCompare(b.type||""));
    let h = '<div class="b" style="margin-bottom:10px">' + fmtY(k) + '</div>';
    if(!list.length) h += '<div class="empty sm">Nothing scheduled.</div>';
    else { h += '<div class="list">';
      list.forEach(e => h += '<button class="item" onclick="Cal.openEvent(\'' + e.id + '\')"><div class="av">' +
        (EV[e.type] ? EV[e.type].i : "📌") + '</div><div class="grow"><div class="b">' + esc(e.title) + '</div>' +
        '<div class="tiny muted">' + esc(EV[e.type] ? EV[e.type].n : e.type) + (e.done === "1" ? " · done" : "") + '</div></div><span class="go">›</span></button>');
      h += '</div>'; }
    h += '<button class="btn block ghost" style="margin-top:12px" onclick="Cal.addTask(\'' + k + '\')">＋ Add a task on this day</button>';
    openSheet(fmt(k), h);
  },

  openEvent(id){
    const e = DB.find("events", id); if(!e) return;
    const c = e.crop_id ? crop(e.crop_id) : null;
    let h = '<div class="row" style="gap:12px;margin-bottom:10px"><div style="font-size:2.2rem">' + (EV[e.type] ? EV[e.type].i : "📌") + '</div>' +
      '<div class="grow"><div class="b" style="font-size:1.05rem">' + esc(e.title) + '</div>' +
      '<div class="tiny muted">' + fmtY(e.date) + ' · ' + relDay(e.date) + '</div></div></div>';
    if(e.notes) h += '<div class="note i">' + esc(e.notes) + '</div>';
    if(c){
      h += '<div class="note g" style="margin-top:8px"><b>' + esc(c.n) + ' at a glance.</b><br>' +
        'Sow ' + c.depth + '" deep · germinates in ' + c.germ[0] + '–' + c.germ[1] + ' days at ' + c.soilF[1] + '°F<br>' +
        'Space ' + c.sp + '" apart · ' + c.sun + 'h sun · ' + c.water + '"/week · ' + c.dtm + ' days to maturity</div>';
      if(e.type === "indoor" || e.type === "direct" || e.type === "fall")
        h += '<div class="note w" style="margin-top:8px"><b>Tip.</b> ' + esc(c.tips) + '</div>';
    }
    h += '<div class="row" style="gap:8px;margin-top:14px">';
    h += '<button class="btn ' + (e.done === "1" ? "ghost" : "") + ' grow" onclick="Cal.toggleDone(\'' + e.id + '\')">' +
      (e.done === "1" ? "Mark not done" : "✓ Mark done") + '</button>';
    if(c) h += '<button class="btn ghost" onclick="closeSheet();setTimeout(function(){Library.open(\'' + c.id + '\')},250)">Guide</button>';
    h += '</div>';
    if(!e.auto) h += '<button class="btn ghost block danger" style="margin-top:8px" onclick="DB.remove(\'events\',\'' + e.id + '\');closeSheet();Cal.render()">Delete task</button>';
    openSheet("Calendar entry", h);
  },
  toggleDone(id){
    const e = DB.find("events", id);
    DB.update("events", id, { done: e.done === "1" ? "0" : "1" });
    closeSheet(); Cal.render(); refresh();
    if(e.done !== "1") toast("Nice — logged as done");
  },

  addTask(dateISO){
    openSheet("New task",
      '<div class="field"><label class="f">What needs doing?</label><input type="text" id="tk-title" placeholder="Side-dress the tomatoes"></div>' +
      '<div class="field"><label class="f">Date</label><input type="date" id="tk-date" value="' + esc(dateISO || iso(today())) + '"></div>' +
      '<div class="field"><label class="f">Notes</label><textarea id="tk-notes"></textarea></div>' +
      '<button class="btn block" style="margin-top:14px" onclick="Cal.saveTask()">Add to calendar</button>');
    setTimeout(() => $("#tk-title").focus(), 300);
  },
  saveTask(){
    const t = $("#tk-title").value.trim(); if(!t) return toast("Give it a title");
    DB.insert("events", { title: t, date: $("#tk-date").value, notes: $("#tk-notes").value.trim(), type:"task", done:"0" });
    closeSheet(); Cal.render(); toast("Task added");
  }
};
</script>
