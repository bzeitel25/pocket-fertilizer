<script>
/* ============================================================
   MOVING A GARDEN BETWEEN DEVICES

   The whole-vault backup already existed, and it is the wrong
   tool for this. It carries everything and it REPLACES everything,
   so using it to get last year's beds onto a second phone means
   destroying whatever that phone already had. What was missing was
   a way to take one garden — a plot, its beds, and every plant on
   them — and add it to another copy of the app.

   Four rules hold this together:

   · IT IS JSON, NOT PROSE. A bed is a polygon in inches and a plant
     is a point in it carrying two radii. Markdown can describe that
     only by rounding it into a sentence and parsing the sentence
     back, which is a lossy round trip pretending to be a lossless
     one. The file opens in any text editor and the first key in it
     explains what it is; that is as human-readable as this can get
     without lying about fidelity.

   · IT ADDS, IT NEVER REPLACES. An import cannot touch a row that
     was already on the device. A plot arriving under a name that is
     taken becomes "Back yard (imported)". Duplicates are the
     gardener's to delete; lost work is not hers to recover.

   · IDS ARE REWRITTEN, REFERENCES ARE FOLLOWED. Every row is
     inserted fresh and an old-id -> new-id map is carried through
     the whole pass, so a planting still points at its bed, its seed
     packet and its variety on the far side. Anything whose target
     did not come across resolves to null rather than to a dangling
     id — a planting that quietly kept a seed_id belonging to some
     unrelated packet on the destination would be worse than one
     that admits it has no packet.

   · WHAT IT WILL NOT CARRY: the `maturity` table. Those are the
     gardener's own recorded first-harvest figures, and after three
     of them the app plans with her number instead of the
     catalogue's. Since a file can be imported twice, carrying them
     would let a garden be counted twice in its own average. The
     same reasoning that keeps dates out of a saved bed layout keeps
     maturity records out of this. Harvest records themselves do
     travel when history is ticked; they simply arrive as records
     and do not feed the learning.
   ============================================================ */

const Share = (() => {
  const FORMAT = "pocket-fertilizer/garden";
  const VERSION = 1;
  const ABOUT = "A garden exported from Pocket Fertilizer — plots, beds and the plants " +
    "on them. Open the app on the other device, go to Settings and choose " +
    "\"Bring a garden in from a file\". It is added alongside whatever is already " +
    "there; nothing is replaced.";

  /* Only ever move columns the schema knows about. A cached row can pick up
     working fields (Geom's parsed polygon is the standing example) and those
     must never reach the file. Empty values are dropped and rebuilt as null
     on the way in, which roughly halves the size of a real garden. */
  function pick(t, row){
    const out = {};
    (SCHEMA[t] || []).forEach(c => {
      const v = row[c];
      if(v !== undefined && v !== null && v !== "") out[c] = v;
    });
    return out;
  }
  /* the same, ready to insert: the destination allocates its own id */
  function body(t, row){
    const o = pick(t, row);
    delete o.id; delete o.created;
    return o;
  }

  /* every photo id a micro-climate survey row is holding */
  function siteImages(row){
    const d = Micro.decode(row) || {};
    const out = [];
    (Array.isArray(d.photos) ? d.photos : []).forEach(x => { if(x) out.push(x); });
    (Array.isArray(d.shots) ? d.shots : []).forEach(s => { if(s && s.photoId) out.push(s.photoId); });
    return out;
  }
  /* the survey without its pictures — the horizon and the month arrays are the
     measurement and must survive; the photos are only the evidence for it */
  function siteNoImages(row){
    const d = Micro.decode(row) || {};
    d.photos = [];
    d.shots = (Array.isArray(d.shots) ? d.shots : [])
      .map(s => s ? Object.assign({}, s, { photoId: null }) : s);
    return Micro.encode(d);
  }

  /* ============================================================
     GATHERING
     ============================================================ */

  /* "none" stands for beds and map items that belong to no plot */
  function plotChoices(){
    const out = DB.all("plots").map(p => ({ id: p.id, name: p.name || "Plot" }));
    if(DB.all("beds").some(b => !b.plot_id)) out.push({ id: "none", name: "Beds not in a plot" });
    return out;
  }

  function collect(o){
    o = o || {};
    const want = (o.plots && o.plots.length) ? o.plots : null;   /* null = all of it */
    const inScope = pid => !want || want.indexOf(pid || "none") >= 0;

    const plots = DB.all("plots").filter(p => inScope(p.id));
    const beds  = DB.all("beds").filter(b => inScope(b.plot_id || "none")).map(b => Geom.bed(b));
    const plotIds = plots.map(p => p.id), bedIds = beds.map(b => b.id);
    const plantings = DB.where("plantings", p => bedIds.indexOf(p.bed_id) >= 0 && p.status !== "removed");
    const plantIds = plantings.map(p => p.id);

    /* which crops this export actually speaks about */
    const crops = {};
    plantings.forEach(p => { if(p.crop_id) crops[p.crop_id] = 1; });

    let seeds = [];
    if(o.seeds){
      const linked = {}; plantings.forEach(p => { if(p.seed_id) linked[p.seed_id] = 1; });
      seeds = DB.all("seeds").filter(s => linked[s.id] || crops[s.crop_id]);
      seeds.forEach(s => { if(s.crop_id) crops[s.crop_id] = 1; });
    }

    /* saved varieties: the ones these plants name, plus the rest of her list
       for the same crops — the point of the file is that the far side ends up
       knowing the varieties it did not know */
    const namedVar = {}; plantings.forEach(p => { if(p.variety_id) namedVar[p.variety_id] = 1; });
    const varieties = DB.all("varieties").filter(v => namedVar[v.id] || crops[v.crop_id]);
    const usercrops = DB.all("usercrops").filter(r => crops[r.slug]);

    const mapitems = DB.all("mapitems").filter(m => inScope(m.plot_id || "none"));
    const sitesRaw = DB.all("sites").filter(s =>
      (s.scope === "plot" && plotIds.indexOf(s.ref_id) >= 0) ||
      (s.scope === "bed"  && bedIds.indexOf(s.ref_id) >= 0));

    let journal = [], harvests = [], observations = [], diagnoses = [];
    if(o.history){
      const mine = (b, p) => bedIds.indexOf(b) >= 0 || plantIds.indexOf(p) >= 0;
      journal      = DB.all("journal").filter(x => mine(x.bed_id, x.planting_id));
      harvests     = DB.all("harvests").filter(x => mine(x.bed_id, x.planting_id));
      diagnoses    = DB.all("diagnoses").filter(x => mine(x.bed_id, x.planting_id));
      observations = DB.all("observations").filter(x => bedIds.indexOf(x.bed_id) >= 0);
    }

    /* photos, and only the ones something in this file points at */
    let photos = [];
    const sites = sitesRaw.map(s => o.photos ? pick("sites", s) : pick("sites", siteNoImages(s)));
    if(o.photos){
      const ids = {};
      seeds.forEach(x => { if(x.photo_id) ids[x.photo_id] = 1; });
      journal.forEach(x => { if(x.photo_id) ids[x.photo_id] = 1; });
      diagnoses.forEach(x => { if(x.photo_id) ids[x.photo_id] = 1; });
      sitesRaw.forEach(s => siteImages(s).forEach(id => ids[id] = 1));
      photos = Object.keys(ids).map(id => DB.find("photos", id)).filter(Boolean);
    }

    const bundle = {
      _about: ABOUT,
      format: FORMAT,
      v: VERSION,
      app: BUILD,
      exported: iso(today()),
      from: {
        place: DB.get("locLabel") || null,
        zone: DB.get("zone") || null,
        lastFrost: DB.get("lastFrost") || null,
        firstFrost: DB.get("firstFrost") || null
      },
      includes: { seeds: !!o.seeds, history: !!o.history, photos: !!o.photos },
      summary: [],
      plots: plots.map(r => pick("plots", r)),
      beds: beds.map(r => pick("beds", r)),
      plantings: plantings.map(r => pick("plantings", r)),
      mapitems: mapitems.map(r => pick("mapitems", r)),
      sites: sites,
      varieties: varieties.map(r => pick("varieties", r)),
      usercrops: usercrops.map(r => pick("usercrops", r)),
      seeds: seeds.map(r => pick("seeds", r)),
      journal: journal.map(r => pick("journal", r)),
      harvests: harvests.map(r => pick("harvests", r)),
      observations: observations.map(r => pick("observations", r)),
      diagnoses: diagnoses.map(r => pick("diagnoses", r)),
      photos: photos.map(r => pick("photos", r))
    };
    bundle.summary = lines(bundle);
    return bundle;
  }

  /* what is in here, in words. Sits inside the file so opening it in a text
     editor tells you what you are looking at, and doubles as the readable
     summary the share button offers. */
  function lines(b){
    const out = [];
    (b.plots || []).forEach(p => {
      const beds = (b.beds || []).filter(x => x.plot_id === p.id);
      const n = (b.plantings || []).filter(x => beds.some(y => y.id === x.bed_id)).length;
      out.push(p.name + " — " + beds.length + " bed" + (beds.length === 1 ? "" : "s") +
        ", " + n + " plant" + (n === 1 ? "" : "s"));
    });
    const loose = (b.beds || []).filter(x => !x.plot_id);
    if(loose.length) out.push("Not in a plot — " + loose.length + " bed" + (loose.length === 1 ? "" : "s"));
    const cr = {};
    (b.plantings || []).forEach(p => { if(p.crop_id) cr[p.crop_id] = (cr[p.crop_id] || 0) + 1; });
    const names = Object.keys(cr).sort((x, y) => cr[y] - cr[x]).slice(0, 12).map(id => cropName(id));
    if(names.length) out.push("Crops: " + names.join(", ") + (Object.keys(cr).length > 12 ? "…" : ""));
    if((b.varieties || []).length) out.push((b.varieties || []).length + " saved varieties");
    if((b.usercrops || []).length) out.push((b.usercrops || []).length + " crops added by hand");
    if((b.seeds || []).length) out.push((b.seeds || []).length + " seed packets");
    if((b.harvests || []).length || (b.journal || []).length)
      out.push((b.harvests || []).length + " harvest records, " + (b.journal || []).length + " journal entries");
    if((b.photos || []).length) out.push((b.photos || []).length + " photos");
    return out;
  }

  function text(b){
    return "Pocket Fertilizer — garden export\n" +
      (b.from && b.from.place ? b.from.place + (b.from.zone ? " · zone " + b.from.zone : "") + "\n" : "") +
      b.exported + "\n\n" + (b.summary || []).map(s => "· " + s).join("\n") + "\n";
  }

  function json(b){ return JSON.stringify(b, null, 1); }
  function size(b){
    const n = json(b).length;
    return n > 1048576 ? (Math.round(n / 1048576 * 10) / 10) + " MB"
         : n > 1024 ? Math.round(n / 1024) + " KB" : n + " bytes";
  }

  /* ============================================================
     READING ONE BACK
     ============================================================ */
  function read(t){
    let b;
    try{ b = JSON.parse(t); }catch(e){ throw new Error("unreadable"); }
    if(!b || typeof b !== "object") throw new Error("unreadable");
    /* a whole-app backup is a different file with a different meaning, and
       telling someone "that could not be read" when the answer is "you want
       the other button" is the kind of dead end this app should not have */
    if(b.format !== FORMAT && b.tables) throw new Error("whole-backup");
    if(b.format !== FORMAT) throw new Error("not-ours");
    if(num(b.v, 1) > VERSION) throw new Error("newer");
    return b;
  }

  /* crops this copy of the app has never heard of and cannot be told about —
     a built-in crop from a newer build. Their plants are skipped and counted. */
  function unknownCrops(b){
    const mine = {};
    (b.usercrops || []).forEach(r => { if(r.slug) mine[r.slug] = 1; });
    const out = {};
    (b.plantings || []).forEach(p => {
      if(p.crop_id && !mine[p.crop_id] && !CROP[p.crop_id]) out[p.crop_id] = (out[p.crop_id] || 0) + 1;
    });
    return out;
  }
  function newCrops(b){
    return (b.usercrops || []).filter(r =>
      !DB.all("usercrops").some(x => x.slug === r.slug && (x.name || "") === (r.name || "")));
  }
  function newVarieties(b){
    return (b.varieties || []).filter(v =>
      !Varieties.forCrop(v.crop_id).some(x => (x.name || "").toLowerCase() === String(v.name || "").toLowerCase()));
  }

  function freeName(n){
    const taken = DB.all("plots").map(x => String(x.name || "").toLowerCase());
    n = String(n || "Imported plot").trim() || "Imported plot";
    if(taken.indexOf(n.toLowerCase()) < 0) return n;
    const base = n + " (imported)";
    if(taken.indexOf(base.toLowerCase()) < 0) return base;
    let i = 2;
    while(taken.indexOf((base + " " + i).toLowerCase()) >= 0) i++;
    return base + " " + i;
  }

  function apply(b){
    const map = { crops:{}, varieties:{}, photos:{}, plots:{}, beds:{}, plantings:{}, seeds:{} };
    const r = { plots:0, beds:0, plantings:0, seeds:0, varieties:0, crops:0, photos:0,
                journal:0, harvests:0, sites:0, mapitems:0, skipped:0, renamed:[] };
    const cid = id => map.crops[id] || id;

    /* ---- crops she added herself, first: everything else names them ---- */
    (b.usercrops || []).forEach(row => {
      if(!row.slug) return;
      const here = DB.all("usercrops").find(x => x.slug === row.slug);
      if(here && (here.name || "") === (row.name || "")){ map.crops[row.slug] = row.slug; return; }
      /* the slug is taken by a different crop, or by a built-in one */
      const slug = (here || CROP[row.slug]) ? UserCrops.slug(row.name || "crop") : row.slug;
      map.crops[row.slug] = slug;
      DB.insert("usercrops", Object.assign(body("usercrops", row), { slug: slug }));
      r.crops++;
    });
    if(r.crops) UserCrops.apply();

    /* ---- photos ---- */
    (b.photos || []).forEach(p => {
      const row = DB.insert("photos", body("photos", p));
      map.photos[p.id] = row.id; r.photos++;
    });

    /* ---- varieties: matched by crop and name, never duplicated ---- */
    (b.varieties || []).forEach(v => {
      const c = cid(v.crop_id);
      const ex = Varieties.forCrop(c).find(x => (x.name || "").toLowerCase() === String(v.name || "").toLowerCase());
      if(ex){ map.varieties[v.id] = ex.id; return; }
      const row = DB.insert("varieties", Object.assign(body("varieties", v), { crop_id: c }));
      map.varieties[v.id] = row.id; r.varieties++;
    });
    const vid = (id, cropId) => {
      if(!id) return null;
      if(map.varieties[id]) return map.varieties[id];
      /* a bundled reference variety carries the same id on both devices */
      if(String(id).indexOf("ref:") === 0 && Varieties.forCrop(cropId).some(x => x.id === id)) return id;
      return null;
    };

    /* ---- plots ---- */
    (b.plots || []).forEach(p => {
      const name = freeName(p.name);
      if(name !== (p.name || "")) r.renamed.push(name);
      const row = DB.insert("plots", Object.assign(body("plots", p), { name: name }));
      map.plots[p.id] = row.id; r.plots++;
    });

    /* ---- beds ---- */
    (b.beds || []).forEach(x => {
      const row = DB.insert("beds", Object.assign(body("beds", x), { plot_id: map.plots[x.plot_id] || null }));
      map.beds[x.id] = row.id; r.beds++;
    });

    /* ---- seed packets ---- */
    (b.seeds || []).forEach(s => {
      const row = DB.insert("seeds", Object.assign(body("seeds", s), {
        crop_id: cid(s.crop_id), photo_id: map.photos[s.photo_id] || null }));
      map.seeds[s.id] = row.id; r.seeds++;
    });

    /* ---- the plants ---- */
    (b.plantings || []).forEach(p => {
      const bed = map.beds[p.bed_id];
      const c = cid(p.crop_id);
      if(!bed || !crop(c)){ r.skipped++; return; }
      const row = DB.insert("plantings", Object.assign(body("plantings", p), {
        bed_id: bed, crop_id: c,
        seed_id: map.seeds[p.seed_id] || null,
        variety_id: vid(p.variety_id, c) }));
      map.plantings[p.id] = row.id; r.plantings++;
    });

    /* ---- the garden map ---- */
    (b.mapitems || []).forEach(m => {
      DB.insert("mapitems", Object.assign(body("mapitems", m), { plot_id: map.plots[m.plot_id] || null }));
      r.mapitems++;
    });

    /* ---- micro-climate surveys ---- */
    (b.sites || []).forEach(s => {
      const ref = s.scope === "plot" ? map.plots[s.ref_id] : map.beds[s.ref_id];
      if(!ref) return;
      const d = Micro.decode(Object.assign(body("sites", s), { ref_id: ref }));
      d.photos = (Array.isArray(d.photos) ? d.photos : []).map(id => map.photos[id]).filter(Boolean);
      d.shots = (Array.isArray(d.shots) ? d.shots : [])
        .map(x => x && x.photoId ? Object.assign({}, x, { photoId: map.photos[x.photoId] || null }) : x);
      DB.insert("sites", Micro.encode(d));
      r.sites++;
    });

    /* ---- history, if it came ---- */
    (b.journal || []).forEach(j => {
      DB.insert("journal", Object.assign(body("journal", j), {
        bed_id: map.beds[j.bed_id] || null, planting_id: map.plantings[j.planting_id] || null,
        crop_id: j.crop_id ? cid(j.crop_id) : null, photo_id: map.photos[j.photo_id] || null }));
      r.journal++;
    });
    (b.harvests || []).forEach(h => {
      DB.insert("harvests", Object.assign(body("harvests", h), {
        bed_id: map.beds[h.bed_id] || null, planting_id: map.plantings[h.planting_id] || null,
        crop_id: h.crop_id ? cid(h.crop_id) : null }));
      r.harvests++;
    });
    (b.observations || []).forEach(x => {
      DB.insert("observations", Object.assign(body("observations", x), { bed_id: map.beds[x.bed_id] || null }));
    });
    (b.diagnoses || []).forEach(d => {
      DB.insert("diagnoses", Object.assign(body("diagnoses", d), {
        bed_id: map.beds[d.bed_id] || null, planting_id: map.plantings[d.planting_id] || null,
        crop_id: d.crop_id ? cid(d.crop_id) : null, photo_id: map.photos[d.photo_id] || null }));
    });

    if(Micro.invalidate) Micro.invalidate();
    try{ Cal.rebuild(); }catch(e){ console.warn("calendar rebuild", e); }
    DB.save();
    return r;
  }

  return {
    FORMAT: FORMAT, VERSION: VERSION,
    plotChoices, collect, json, text, size, read, apply,
    unknownCrops, newCrops, newVarieties, lines, freeName
  };
})();

/* ============================================================
   THE SHEETS
   ============================================================ */

Share.opts = { plots: [], seeds: true, history: false, photos: false };

Share.exportSheet = function(){
  const choices = Share.plotChoices();
  if(!choices.length) return toast("Nothing to send yet — make a bed first");
  /* default to whatever plot she is looking at, or all of it */
  if(!Share.opts.plots.length && APP.plotId && choices.some(c => c.id === APP.plotId))
    Share.opts.plots = [APP.plotId];

  openSheet("Copy a garden to another device",
    '<p class="muted sm" style="margin-top:0">Saves one file. Open it on the other device and the ' +
    'beds and plants are rebuilt exactly as they are here — outlines, spacing, varieties and all. ' +
    'It is <b>added</b> to that device, never swapped in over what is already there.</p>' +
    '<div id="sh-body"></div>');
  Share.drawExport();
};

Share.toggle = function(k){ Share.opts[k] = !Share.opts[k]; Share.drawExport(); };
Share.togglePlot = function(id){
  const i = Share.opts.plots.indexOf(id);
  if(i >= 0) Share.opts.plots.splice(i, 1); else Share.opts.plots.push(id);
  Share.drawExport();
};

Share.drawExport = function(){
  const box = $("#sh-body"); if(!box) return;
  const o = Share.opts;
  const choices = Share.plotChoices();
  const b = Share.collect(o);

  let h = '<div class="sec"><h2>What to send</h2></div>';
  h += '<div class="card"><div class="row wrap" style="gap:6px">';
  h += '<button class="chip ' + (!o.plots.length ? "on" : "") + '" onclick="Share.opts.plots=[];Share.drawExport()">Everything</button>';
  choices.forEach(c => h += '<button class="chip ' + (o.plots.indexOf(c.id) >= 0 ? "on" : "") +
    '" onclick="Share.togglePlot(\'' + c.id + '\')">' + esc(c.name) + '</button>');
  h += '</div></div>';

  const tick = (k, label, sub) =>
    '<div class="row between" style="margin-top:12px"><div class="grow"><div class="b">' + label + '</div>' +
    '<div class="tiny muted">' + sub + '</div></div>' +
    '<button class="switch ' + (o[k] ? "on" : "") + '" onclick="Share.toggle(\'' + k + '\')"></button></div>';

  h += '<div class="card" style="margin-top:12px">' +
    '<div class="note g" style="margin-bottom:4px">The beds, their outlines and every plant on them always travel, ' +
    'along with the varieties and any crops you added yourself. That is the point of the file.</div>' +
    tick("seeds", "Seed packets", "The packets for the crops in this export, with their germination rates and dates") +
    tick("history", "Journal and harvests", "Watering, feeding, harvest weights and soil notes for these beds") +
    tick("photos", "Photos", "Packet photos, journal photos and micro-climate shots. This is what makes a file large.") +
    '</div>';

  h += '<div class="card" style="margin-top:12px"><div class="b">' + Share.size(b) + '</div>' +
    '<div class="tiny muted">' + (b.summary.length ? esc(b.summary.join(" · ")) : "Nothing selected") + '</div>' +
    (Share.json(b).length > 4194304
      ? '<div class="note w" style="margin-top:10px">Large files are refused by some mail apps. ' +
        'Turn photos off, or send it over AirDrop, Nearby Share or a cloud drive.</div>' : '') +
    '</div>';

  h += '<div class="note i" style="margin-top:12px">Your own days-to-maturity averages stay on this device. ' +
    'A file can be imported more than once, and counting the same garden twice in its own average would quietly ' +
    'skew every harvest date the app gives you afterwards.</div>';

  h += '<button class="btn block" style="margin-top:14px" onclick="Share.send()">⬆︎ Save the file</button>';
  h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="Share.copyText()">📋 Copy a readable summary</button>';
  box.innerHTML = h;
};

Share.filename = function(){
  return "pocket-fertilizer-garden-" + iso(today()) + ".json";
};

Share.send = function(){
  const b = Share.collect(Share.opts);
  if(!b.beds.length) return toast("Nothing selected to send");
  const blob = new Blob([Share.json(b)], { type: "application/json" });
  const name = Share.filename();
  /* AirDrop and Nearby Share are how a file actually gets between two phones;
     the download is the fallback for a desktop browser. Same path the map uses. */
  try{
    if(navigator.canShare && window.File){
      const file = new File([blob], name, { type: "application/json" });
      if(navigator.canShare({ files: [file] })){
        navigator.share({ files: [file], title: "My garden" })
          .catch(() => download(name, blob));
        closeSheet();
        return toast("Sending…");
      }
    }
  }catch(e){ /* fall through to the download */ }
  download(name, blob);
  closeSheet();
  toast("Saved — open it on the other device");
};

Share.copyText = function(){
  const t = Share.text(Share.collect(Share.opts));
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(() => toast("Summary copied"), () => toast("Could not copy"));
  else toast("Copying is not available here");
};

/* ---------- coming in ---------- */
Share.importPick = function(){
  const inp = $("#filepick-json"); if(!inp) return;
  inp.value = "";
  inp.onchange = () => {
    const f = inp.files[0]; if(!f) return;
    const fr = new FileReader();
    fr.onload = () => Share.preview(fr.result);
    fr.onerror = () => toast("That file could not be read");
    fr.readAsText(f);
  };
  inp.click();
};

Share.EXPLAIN = {
  "unreadable":   "That file is not readable as JSON. It may have been altered on the way over.",
  "not-ours":     "That is not a Pocket Fertilizer garden file.",
  "whole-backup": "That is a full app backup, not a garden file. Restore it with “Restore from a backup” instead — but be warned, that one replaces everything on this device.",
  "newer":        "That file was written by a newer version of the app. Update this device first, then import it."
};

Share.preview = function(txt){
  let b;
  try{ b = Share.read(txt); }
  catch(e){ return openSheet("Cannot import that file",
    '<div class="note d" style="margin-top:0">' + esc(Share.EXPLAIN[e.message] || "That file could not be read.") + '</div>' +
    '<button class="btn ghost block" style="margin-top:14px" onclick="closeSheet()">Close</button>'); }

  Share._pending = b;
  const nc = Share.newCrops(b), nv = Share.newVarieties(b), unk = Share.unknownCrops(b);
  const unkN = Object.keys(unk).reduce((a, k) => a + unk[k], 0);
  const clash = (b.plots || []).filter(p => Share.freeName(p.name) !== (p.name || ""));

  let h = '<p class="muted sm" style="margin-top:0">Nothing has been written yet. This is what is in the file.</p>';

  h += '<div class="card"><div class="grid3">' +
    '<div class="stat"><span class="n">' + (b.beds || []).length + '</span><span class="l">beds</span></div>' +
    '<div class="stat"><span class="n">' + (b.plantings || []).length + '</span><span class="l">plants</span></div>' +
    '<div class="stat"><span class="n">' + (b.plots || []).length + '</span><span class="l">plots</span></div>' +
    '</div>';
  if((b.summary || []).length) h += '<div class="tiny muted" style="margin-top:10px">' +
    b.summary.map(s => esc(s)).join('<br>') + '</div>';
  h += '<div class="tiny muted" style="margin-top:10px">Written ' + esc(b.exported || "?") +
    (b.app ? ' by version ' + esc(b.app) : '') + '</div></div>';

  /* a garden from a different climate will not keep its sowing dates here,
     and saying so beforehand is cheaper than a puzzled gardener afterwards */
  const hereZone = DB.get("zone");
  if(b.from && b.from.zone && hereZone && b.from.zone !== hereZone)
    h += '<div class="note w" style="margin-top:12px">🌡️ This garden was planned in zone <b>' + esc(b.from.zone) + '</b>' +
      (b.from.place ? ' (' + esc(b.from.place) + ')' : '') + ' and this device is set to <b>' + esc(hereZone) + '</b>. ' +
      'The beds and plants come across exactly; sowing and harvest dates will be recalculated from <i>your</i> frost dates, so they will not match the other device.</div>';

  if(nc.length) h += '<div class="note g" style="margin-top:12px">✎ <b>' + nc.length + ' crop' + (nc.length === 1 ? "" : "s") +
    ' this device does not have</b> will be added: ' + esc(nc.map(c => c.name).join(", ")) +
    '. They stay marked as your own figures, not an extension service\'s.</div>';
  if(nv.length) h += '<div class="note g" style="margin-top:8px">🌱 <b>' + nv.length + ' variet' + (nv.length === 1 ? "y" : "ies") +
    '</b> not saved here yet will be added: ' + esc(nv.slice(0, 8).map(v => v.name).join(", ")) +
    (nv.length > 8 ? " and " + (nv.length - 8) + " more" : "") + '.</div>';
  if(unkN) h += '<div class="note d" style="margin-top:8px">⚠️ ' + unkN + ' plant' + (unkN === 1 ? "" : "s") +
    ' use a crop this copy of the app does not know (' + esc(Object.keys(unk).join(", ")) +
    '). They will be skipped. Update this device and import the file again to get them.</div>';
  if(clash.length) h += '<div class="note i" style="margin-top:8px">A plot called “' + esc(clash[0].name) +
    '” is already here, so the arriving one comes in as “' + esc(Share.freeName(clash[0].name)) +
    '”. Nothing you already have is touched.</div>';

  const inc = b.includes || {};
  h += '<div class="tiny muted" style="margin-top:12px">Carries: beds and plants' +
    (inc.seeds ? ", seed packets" : "") + (inc.history ? ", journal and harvests" : "") +
    (inc.photos ? ", photos" : "") + '. Days-to-maturity averages are never carried.</div>';

  h += '<div class="row" style="gap:8px;margin-top:16px">' +
    '<button class="btn ghost grow" onclick="closeSheet()">Cancel</button>' +
    '<button class="btn grow" onclick="Share.confirmImport()">Add to this device</button></div>';
  openSheet("Bring this garden in?", h);
};

Share.confirmImport = function(){
  const b = Share._pending; if(!b) return;
  let r;
  try{ r = Share.apply(b); }
  catch(e){ console.error(e); closeSheet(); return toast("Import failed — nothing was changed"); }
  Share._pending = null;

  const bits = [];
  if(r.plots) bits.push(r.plots + " plot" + (r.plots === 1 ? "" : "s"));
  if(r.beds) bits.push(r.beds + " bed" + (r.beds === 1 ? "" : "s"));
  if(r.plantings) bits.push(r.plantings + " plant" + (r.plantings === 1 ? "" : "s"));
  if(r.seeds) bits.push(r.seeds + " seed packet" + (r.seeds === 1 ? "" : "s"));
  if(r.varieties) bits.push(r.varieties + " variet" + (r.varieties === 1 ? "y" : "ies"));
  if(r.crops) bits.push(r.crops + " crop" + (r.crops === 1 ? "" : "s"));
  if(r.harvests) bits.push(r.harvests + " harvest record" + (r.harvests === 1 ? "" : "s"));
  if(r.photos) bits.push(r.photos + " photo" + (r.photos === 1 ? "" : "s"));

  let h = '<div class="note g" style="margin-top:0">Added ' + esc(bits.join(", ") || "nothing") + '.</div>';
  if(r.renamed.length) h += '<div class="note i" style="margin-top:8px">Came in as “' +
    esc(r.renamed.join("”, “")) + '” — a plot of that name was already here.</div>';
  if(r.skipped) h += '<div class="note w" style="margin-top:8px">' + r.skipped +
    ' plant' + (r.skipped === 1 ? "" : "s") + ' skipped: this copy of the app does not have that crop.</div>';
  h += '<div class="tiny muted" style="margin-top:12px">Your calendar has been rebuilt around the new plantings.</div>';
  h += '<button class="btn block" style="margin-top:14px" onclick="closeSheet();go(\'garden\')">Open the garden</button>';
  openSheet("Garden imported", h);
};

/* ============================================================
   WAYS IN
   ============================================================ */
(function wireShare(){

  /* the bed list, where the plots are */
  const origList = Garden.listView;
  Garden.listView = function(){
    origList.call(Garden);
    const box = $("#s-garden"); if(!box) return;
    if(!DB.count("beds")) return;
    box.insertAdjacentHTML("beforeend",
      '<button class="btn ghost block sm" style="margin-top:10px" onclick="Share.exportSheet()">' +
      '⇄ Copy this garden to another device</button>');
  };

  /* and in settings, beside the backup it is deliberately not */
  const origSettings = Settings.render;
  Settings.render = function(){
    origSettings.call(Settings);
    const box = $("#s-settings"); if(!box) return;
    const restore = box.querySelector('button[onclick*="Settings.importJSON"]');
    if(!restore || !restore.parentNode) return;
    const el = document.createElement("div");
    el.innerHTML =
      '<div class="row between" style="margin-top:16px"><div class="grow">' +
      '<div class="b">Two devices</div>' +
      '<div class="tiny muted">Move a garden to a second phone or tablet without replacing what is on it</div></div>' +
      '<button class="btn sm" onclick="Share.exportSheet()">Send</button></div>' +
      '<button class="btn ghost block sm" style="margin-top:10px" onclick="Share.importPick()">Bring a garden in from a file</button>';
    restore.parentNode.insertBefore(el, restore.nextSibling);
  };
})();
</script>
