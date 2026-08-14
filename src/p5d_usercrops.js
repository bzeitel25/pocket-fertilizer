<script>
/* ============================================================
   CROPS THE GARDENER ADDS HERSELF

   Seventy-two plants covers most of a vegetable garden and none of
   the interesting edges: a regional green nobody outside one state
   grows, a tea her grandmother kept going, whatever came back from
   the seed swap without a label.

   So the table is open. A crop added here behaves like any other —
   it plants, spaces, waters, rotates, shows up in the calendar and
   the seed bank — with one deliberate difference: it is never
   presented as sourced. Every built-in figure in this app traces to
   an extension service, and a self-entered one traces to the person
   who typed it. The app says which, plainly, wherever the number
   appears. That distinction is the whole reason the rest of the
   data is worth anything.

   Stored as real columns rather than a JSON blob, so the .sqlite
   export and the SQL console can see them like everything else.
   ============================================================ */

const UserCrops = {
  PREFIX: "my-",

  /* ---------- turning a row into a crop the app understands ---------- */
  toCrop(row){
    const sp = clamp(num(row.sp, 12), 1, 96);
    const list = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);
    const st = {};
    ["indoor","tp","direct","fall"].forEach(k => {
      const v = row["start_" + k];
      st[k] = (v === null || v === undefined || v === "") ? null : num(v, 0);
    });
    return {
      id: row.slug, n: row.name || "Untitled", e: row.emoji || "🌱",
      fam: FAMILY[row.fam] ? row.fam : "aster",
      sun: clamp(num(row.sun, 6), 0, 16),
      water: clamp(num(row.water, 1), 0, 4),
      sp: sp, psf: Math.round(144 / (sp * sp) * 100) / 100,
      depth: clamp(num(row.depth, 0.25), 0, 6),
      germ: [Math.max(1, num(row.germ_lo, 7)), Math.max(1, num(row.germ_hi, 14))],
      soilF: [num(row.soil_lo, 55), num(row.soil_opt, 70), num(row.soil_hi, 85)],
      dtm: clamp(num(row.dtm, 60), 1, 400),
      from: row.from === "transplant" ? "transplant" : "seed",
      via: clamp(num(row.via, 3), 0, 20),
      feeder: ["light","medium","heavy"].indexOf(row.feeder) >= 0 ? row.feeder : "medium",
      ph: row.ph || "6.0–7.0",
      start: st, succ: num(row.succ, 0), yield: num(row.yield, 0),
      comp: list(row.comp), foes: list(row.foes),
      npk: row.npk || "", tips: row.tips || "", harvest: row.harvest || "",
      /* the honest part */
      verified: false, vfields: [], estfields: [], mine: true, rowId: row.id
    };
  },

  /* a readable, collision-proof id */
  slug(name){
    const base = UserCrops.PREFIX + String(name || "crop").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || (UserCrops.PREFIX + "crop");
    let s = base, n = 2;
    while(CROP[s]) s = base + "-" + (n++);
    return s;
  },

  /* ---------- fold every saved row into the crop table ---------- */
  apply(){
    /* drop any that were removed since the last pass */
    Object.keys(CROP).forEach(id => {
      if(CROP[id] && CROP[id].mine && !DB.all("usercrops").some(r => r.slug === id)){
        delete CROP[id];
        const i = CROPS.findIndex(c => c.id === id);
        if(i >= 0) CROPS.splice(i, 1);
      }
    });
    DB.all("usercrops").forEach(row => {
      if(!row.slug) return;
      const c = UserCrops.toCrop(row);
      const i = CROPS.findIndex(x => x.id === c.id);
      if(i >= 0) CROPS[i] = c; else CROPS.push(c);
      CROP[c.id] = c;
    });
  },
  all(){ return DB.all("usercrops"); },
  isMine(id){ const c = CROP[id]; return !!(c && c.mine); },

  save(row, id){
    const saved = id ? DB.update("usercrops", id, row) : DB.insert("usercrops", row);
    UserCrops.apply();
    Cal.rebuild();
    return saved;
  },
  remove(id){
    const row = DB.find("usercrops", id); if(!row) return;
    DB.remove("usercrops", id);
    UserCrops.apply();
  },
  /* what would break if this went away */
  usage(slug){
    return {
      plantings: DB.where("plantings", p => p.crop_id === slug && p.status !== "removed").length,
      seeds: DB.where("seeds", s => s.crop_id === slug).length,
      harvests: DB.where("harvests", h => h.crop_id === slug).length
    };
  },

  /* ============================================================
     THE EDITOR
     ============================================================ */
  EMOJI: ["🌱","🌿","🍃","🌾","🌼","🌸","🌺","🌻","🌷","🪻","💮","🏵️","🍀","🥬","🥕","🥔",
          "🍅","🫑","🌶️","🧄","🧅","🥒","🎃","🍆","🌽","🫘","🍓","🫐","🍇","🍈","🍏","🍐","🌰"],

  /* opts (all optional):
       name    seed the Name field — what she typed into the search that found nothing
       onDone  called with the new slug instead of jumping to the library, so the
               screen that sent her here can carry on with the crop she just made
       onBack  render a way back to where she came from, so abandoning this form
               does not also throw away the half-filled packet behind it       */
  open(id, opts){
    const row = id ? DB.find("usercrops", id) : null;
    UserCrops._opts = opts || null;
    const v = (k, d) => row && row[k] !== null && row[k] !== undefined && row[k] !== "" ? row[k] : d;
    const emoji = v("emoji", "🌱");

    let h = '';
    if(opts && opts.onBack)
      h += '<button class="btn ghost sm" id="uc-back" style="margin-bottom:10px">‹ Back to the crop list</button>';
    h += '<p class="muted sm" style="margin-top:0">Everything the app does for a built-in crop it will do for this one — spacing, watering, the calendar, rotation, companions. The only difference is that it will always be shown as <b>your figures</b> rather than an extension service\'s.</p>';

    h += '<div class="grid2"><div><label class="f">Name</label>' +
      '<input type="text" id="uc-name" value="' + esc(v("name", (opts && opts.name) || "")) + '" placeholder="Lemongrass"></div>' +
      '<div><label class="f">Family</label><select id="uc-fam">' +
      Object.keys(FAMILY).map(k => '<option value="' + k + '"' + (v("fam","aster") === k ? " selected" : "") + '>' +
        esc(FAMILY[k].n) + '</option>').join("") + '</select>' +
      '<div class="tiny muted">Decides rotation and shared pests.</div></div></div>';

    h += '<div class="field" style="margin-top:12px"><label class="f">Icon</label>' +
      '<div class="row wrap" style="gap:6px" id="uc-emoji">' +
      UserCrops.EMOJI.map(e => '<button class="chip' + (e === emoji ? " on" : "") + '" data-e="' + e +
        '" style="font-size:1.1rem">' + e + '</button>').join("") + '</div>' +
      '<input type="hidden" id="uc-emoji-v" value="' + esc(emoji) + '"></div>';

    h += '<div class="sec"><h2>How it grows</h2></div>';
    h += '<div class="grid2">' +
      '<div><label class="f">Sun (hours)</label><input type="number" id="uc-sun" min="0" max="16" value="' + esc(v("sun",6)) + '"></div>' +
      '<div><label class="f">Water (' + Units.lenUnit() + '/week)</label><input type="number" id="uc-water" step="' + Units.waterStep() +
      '" min="0" max="' + Units.outWater(4) + '" value="' + esc(Units.outWater(num(v("water",1), 1))) + '"></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Spacing (' + Units.lenUnit() + ')</label><input type="number" id="uc-sp" step="' + Units.lenStep() +
      '" min="' + Units.outLen(1) + '" max="' + Units.outLen(96) + '" value="' + esc(Units.outLen(num(v("sp",12), 12))) + '">' +
      '<div class="tiny muted">Also sets how wide it is drawn.</div></div>' +
      '<div><label class="f">Days to maturity</label><input type="number" id="uc-dtm" min="1" max="400" value="' + esc(v("dtm",60)) + '"></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Sow depth (' + Units.lenUnit() + ')</label><input type="number" id="uc-depth" step="' + (Units.metric ? "0.5" : "0.125") +
      '" min="0" max="' + Units.outLen(6) + '" value="' + esc(Units.outLen(num(v("depth",0.25), 0.25))) + '"></div>' +
      '<div><label class="f">Started as</label><select id="uc-from">' +
        ["seed","transplant"].map(x => '<option value="' + x + '"' + (v("from","seed") === x ? " selected" : "") + '>' + x + '</option>').join("") +
      '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Feeding</label><select id="uc-feeder">' +
        ["light","medium","heavy"].map(x => '<option value="' + x + '"' + (v("feeder","medium") === x ? " selected" : "") + '>' + x + '</option>').join("") +
      '</select></div>' +
      '<div><label class="f">Seed life (years)</label><input type="number" id="uc-via" min="0" max="20" value="' + esc(v("via",3)) + '"></div></div>';

    h += '<div class="sec"><h2>When to sow it</h2><span class="tiny muted">weeks from last frost</span></div>';
    h += '<div class="tiny muted" style="margin-bottom:8px">Negative is before the last frost, positive after. Leave blank for any that do not apply — that is how the calendar knows what to offer.</div>';
    h += '<div class="grid2">' +
      '<div><label class="f">Start indoors</label><input type="number" id="uc-si" step="1" min="-16" max="16" value="' + esc(v("start_indoor","")) + '" placeholder="-6"></div>' +
      '<div><label class="f">Transplant out</label><input type="number" id="uc-st" step="1" min="-16" max="16" value="' + esc(v("start_tp","")) + '" placeholder="2"></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Direct sow</label><input type="number" id="uc-sd" step="1" min="-16" max="16" value="' + esc(v("start_direct","")) + '" placeholder="0"></div>' +
      '<div><label class="f">Fall sowing</label><input type="number" id="uc-sf" step="1" min="-20" max="0" value="' + esc(v("start_fall","")) + '" placeholder="-8"></div></div>';

    h += '<div class="sec"><h2>Notes</h2></div>';
    h += '<div class="field"><label class="f">Grows well beside</label>' +
      '<input type="text" id="uc-comp" value="' + esc(v("comp","")) + '" placeholder="tomato, basil, lettuce">' +
      '<div class="tiny muted">Crop ids, comma separated. Anything you type that is not a crop is ignored.</div></div>';
    h += '<div class="field" style="margin-top:10px"><label class="f">Keep away from</label>' +
      '<input type="text" id="uc-foes" value="' + esc(v("foes","")) + '" placeholder="fennel"></div>';
    h += '<div class="field" style="margin-top:10px"><label class="f">Growing notes</label>' +
      '<textarea id="uc-tips" placeholder="What you have learned about it.">' + esc(v("tips","")) + '</textarea></div>';
    h += '<div class="field"><label class="f">Harvesting</label>' +
      '<textarea id="uc-harvest" placeholder="When and how to pick it.">' + esc(v("harvest","")) + '</textarea></div>';

    h += '<div class="note w" style="margin-top:14px">These figures are yours. The app will use them exactly as typed and will label them as your own everywhere they appear — it will never claim an extension service stands behind them.</div>';

    h += '<button class="btn block" style="margin-top:14px" onclick="UserCrops.saveForm(' +
      (id ? "'" + id + "'" : "null") + ')">' + (id ? "Save changes" : "Add this crop") + '</button>';
    if(id) h += '<button class="btn danger block" style="margin-top:8px" onclick="UserCrops.confirmRemove(\'' + id + '\')">Delete this crop</button>';

    openSheet(id ? "Edit " + (row.name || "crop") : "Add your own crop", h);
    $$("#uc-emoji .chip").forEach(b => b.onclick = () => {
      $$("#uc-emoji .chip").forEach(x => x.classList.toggle("on", x === b));
      $("#uc-emoji-v").value = b.dataset.e;
    });
    if(opts && opts.onBack){
      const bk = $("#uc-back");
      if(bk) bk.onclick = () => { UserCrops._opts = null; opts.onBack(); };
    }
    setTimeout(() => { const el = $("#uc-name"); if(el && !id) el.focus(); }, 300);
  },

  saveForm(id){
    const name = ($("#uc-name").value || "").trim();
    if(!name) return toast("Give it a name");
    const opt = el => { const v = ($(el) || {}).value; return v === "" || v === undefined ? null : num(v, 0); };
    const row = {
      name: name,
      emoji: $("#uc-emoji-v").value || "🌱",
      fam: $("#uc-fam").value,
      /* typed in whatever system is on; stored in inches like every other crop */
      sun: num($("#uc-sun").value, 6),
      water: Units.inWater(num($("#uc-water").value, Units.outWater(1))),
      sp: Units.inLen(num($("#uc-sp").value, Units.outLen(12))), dtm: num($("#uc-dtm").value, 60),
      depth: Units.inLen(num($("#uc-depth").value, Units.outLen(0.25))), from: $("#uc-from").value,
      feeder: $("#uc-feeder").value, via: num($("#uc-via").value, 3),
      start_indoor: opt("#uc-si"), start_tp: opt("#uc-st"),
      start_direct: opt("#uc-sd"), start_fall: opt("#uc-sf"),
      comp: ($("#uc-comp").value || "").trim(), foes: ($("#uc-foes").value || "").trim(),
      tips: ($("#uc-tips").value || "").trim(), harvest: ($("#uc-harvest").value || "").trim(),
      ph: "6.0–7.0", npk: "", succ: 0, yield: 0,
      germ_lo: 7, germ_hi: 14, soil_lo: 55, soil_opt: 70, soil_hi: 85
    };
    if(!id) row.slug = UserCrops.slug(name);
    const saved = UserCrops.save(row, id);
    const opts = UserCrops._opts; UserCrops._opts = null;
    closeSheet();
    if(APP.tab === "library") Library.render();
    toast(id ? "Saved" : name + " added to your crops");
    /* she came here from somewhere that wanted a crop — hand it back rather
       than dropping her into the library and losing what she was doing */
    if(opts && opts.onDone){
      const slug = (saved && saved.slug) || row.slug;
      setTimeout(() => opts.onDone(slug), 60);
      return;
    }
    if(!id && saved) setTimeout(() => Library.open(saved.slug), 250);
  },

  confirmRemove(id){
    const row = DB.find("usercrops", id); if(!row) return;
    const u = UserCrops.usage(row.slug);
    const busy = u.plantings + u.seeds + u.harvests;
    confirmSheet("Delete " + (row.name || "this crop") + "?",
      busy
        ? "It is still used by " + [u.plantings && u.plantings + " planting" + (u.plantings > 1 ? "s" : ""),
            u.seeds && u.seeds + " seed packet" + (u.seeds > 1 ? "s" : ""),
            u.harvests && u.harvests + " harvest record" + (u.harvests > 1 ? "s" : "")].filter(Boolean).join(", ") +
          ". Those records stay, but they will show as an unknown crop."
        : "Nothing is using it, so nothing else changes.",
      "Delete", () => {
        UserCrops.remove(id);
        closeSheet();
        if(APP.tab === "library") Library.render();
        toast("Removed");
      }, true);
  }
};

/* ---------- make them appear ---------- */
(function wireUserCrops(){
  /* the vault is not open yet when this file runs, so apply after it loads */
  const origLoad = DB.load;
  DB.load = async function(){
    const r = await origLoad.apply(DB, arguments);
    try{ UserCrops.apply(); }catch(e){ console.warn("user crops", e); }
    return r;
  };
  const origImport = DB.importJSON;
  DB.importJSON = async function(text){
    const r = await origImport.call(DB, text);
    try{ UserCrops.apply(); }catch(e){}
    return r;
  };

  /* the crop page has to be honest about where its numbers came from */
  const origOpen = Library.open;
  Library.open = function(id){
    origOpen.call(Library, id);
    if(!UserCrops.isMine(id)) return;
    const body = $("#sheet-body") || $("#s-library");
    if(!body) return;
    const row = DB.all("usercrops").find(r => r.slug === id);
    body.insertAdjacentHTML("afterbegin",
      '<div class="note w" style="margin-bottom:12px">✎ <b>Your own crop.</b> Every figure on this page is one you typed. ' +
      'No extension service stands behind them — which is exactly why the rest of the app\'s numbers are worth something.' +
      (row ? '<br><button class="btn sm" style="margin-top:8px" onclick="UserCrops.open(\'' + row.id + '\')">Edit these figures</button>' : '') +
      '</div>');
  };

  /* ---- a way in from the crop picker ----
     The library is not where she meets the limit. She meets it halfway through
     adding a seed packet, or standing over a bed, when she searches for the thing
     in her hand and the list comes back empty. Sending her to another screen to
     add it would cost her the packet she was typing, so the door is here, in the
     picker, with what she searched for already in the name field and a way back
     if she changes her mind. */
  const origPicker = Garden.cropPicker;
  Garden.cropPicker = function(title, onPick, bed){
    origPicker.call(Garden, title, onPick, bed);
    const list = $("#cp-list");
    if(!list) return;
    list.insertAdjacentHTML("afterend",
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">' +
      '<button class="btn ghost block" id="cp-own">＋ Not here? Add your own crop</button>' +
      '<div class="tiny muted center" style="margin-top:6px">A regional green, a herb, whatever came back from the seed swap. It behaves like any other crop — the figures are just yours rather than an extension service\'s.</div></div>');
    const btn = $("#cp-own");
    if(!btn) return;
    btn.onclick = () => {
      const q = $("#cp-q");
      UserCrops.open(null, {
        name: q ? String(q.value || "").trim() : "",
        onDone: slug => onPick(slug),
        onBack: () => Garden.cropPicker(title, onPick, bed)
      });
    };
  };

  /* a way in from the crop library */
  const origRender = Library.render;
  Library.render = function(opts){
    origRender.call(Library, opts);
    const box = $("#s-library"); if(!box) return;
    const mine = DB.count("usercrops");
    box.insertAdjacentHTML("beforeend",
      '<button class="btn ghost block" style="margin-top:14px" onclick="UserCrops.open()">＋ Add a crop of your own</button>' +
      '<div class="tiny muted center" style="margin-top:6px">' +
      (mine ? mine + " crop" + (mine > 1 ? "s" : "") + " you added yourself. Open one and it says plainly that the figures are yours."
            : "Anything the app does not know about: a regional green, a herb, a tea, whatever came back from the seed swap.") +
      '</div>');
  };
})();
</script>
