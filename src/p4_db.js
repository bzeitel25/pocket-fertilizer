<script>
/* ============================================================
   DB — SQLite (sql.js / WASM) mirrored from an encrypted JSON vault
   Vault JSON is the source of truth on disk (always available,
   always AES-GCM encrypted). SQLite is rebuilt from it at open so
   every table is queryable/exportable as a real .sqlite file.
   ============================================================ */
const SCHEMA = {
  plots:      ["id","name","notes","created"],
  /* A bed is an outline on a canvas measured in inches. cols/rows/cell_in are
     kept because the square-foot grid is still offered as an overlay and as a
     snapping step, and because every bed made before the canvas existed is
     described that way — see Geom.bed, which migrates one lazily on read. */
  /* north_deg is the compass bearing the TOP of the drawing points at. It is
     what turns "who is standing in whose light" from an assumption that the
     gardener drew the bed north-up into an actual answer. 0 is north-up, so
     every bed made before it existed keeps behaving as it did. */
  beds:       ["id","plot_id","name","cols","rows","cell_in","sun_hours","sun_exposure","soil","irrigation","notes","mx","my","rot","created",
               "shape","w_in","h_in","poly","grid_on","snap_in","north_deg"],
  /* px,py are the plant's centre in inches from the bed's top-left. rr is the
     root radius it needs to itself, rc the spread of its mature foliage; the
     two are drawn separately because overlapping leaves are fine and
     overlapping roots are not. rot and sv only exist to stop every plant of a
     crop looking identical. */
  plantings:  ["id","bed_id","x","y","w","h","span_mode","crop_id","variety","variety_id","seed_id","qty","status","sown_on","transplant_on","harvest_from","harvest_to","removed_on","notes","created",
               "px","py","rr","rc","rot","sv"],
  mapitems:   ["id","plot_id","kind","label","w","h","mx","my","rot","notes","created"],
  /* micro-climate survey of one spot. scope is "plot" or "bed"; a bed row
     overrides its plot's row field by field. horizon/photos/shots and the
     computed month arrays are stored as JSON strings so the .sqlite export
     and the SQL console stay honest — see Micro.encode/decode. */
  sites:      ["id","scope","ref_id","horizon","slope_pct","slope_dir","surface","drainage",
               "wind_exposure","shelter","canopy","reflect","frost_pocket","sun_override",
               "method","confidence","photos","shots","rain_obs","frost_obs","notes","updated","created"],
  varieties:  ["id","crop_id","name","dtm","habit","resistance","spacing_in","notes","source","created"],
  maturity:   ["id","crop_id","variety","days","sown_on","harvested_on","planting_id","bed_id","note","created"],
  seeds:      ["id","crop_id","name","variety","brand","lot","qty","unit","packed_year","exp_date","germ_rate","cost","photo_id","source","notes","created"],
  events:     ["id","date","type","title","crop_id","seed_id","bed_id","planting_id","notes","done","auto","created"],
  journal:    ["id","date","type","bed_id","planting_id","crop_id","amount","unit","cost","minutes","product","notes","photo_id","created"],
  harvests:   ["id","date","planting_id","bed_id","crop_id","weight","unit","count","value","notes","created"],
  diagnoses:  ["id","date","planting_id","bed_id","crop_id","photo_id","symptoms","result","confidence","treatment","source","notes","created"],
  observations:["id","date","bed_id","ph","moisture","soil_temp","air_temp","rain_in","notes","created"],
  photos:     ["id","created","mime","w","h","data"],
  /* crops the gardener added herself. Real columns rather than a JSON blob so
     the .sqlite export and the SQL console see them like anything else. */
  usercrops:  ["id","slug","name","emoji","fam","sun","water","sp","depth",
               "germ_lo","germ_hi","soil_lo","soil_opt","soil_hi","dtm","from",
               "via","feeder","ph","comp","foes","tips","harvest","npk",
               "start_indoor","start_tp","start_direct","start_fall","succ","yield","created"],
  settings:   ["key","value"]
};
const SQLJS_VER = "1.10.3";
/* The engine is shipped alongside the app so the SQL console and the .sqlite
   export work offline and inside the store builds, which have no network at
   all on first run. The CDN stays as a fallback for any copy served without
   the sql/ folder beside it. Local first, always. */
const SQLJS_LOCAL = "sql/";
const SQLJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/" + SQLJS_VER + "/";

const DB = (() => {
  const cache = {}; Object.keys(SCHEMA).forEach(t => cache[t] = []);
  let settings = {};
  let sql = null, sdb = null, engine = "memory", saveT = null, dirty = false, loaded = false;

  /* ---- sql.js bootstrap (optional, non-blocking) ---- */
  function loadScript(src){
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = res; s.onerror = () => rej(new Error("cdn"));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error("timeout")), 12000);
    });
  }
  async function initSqlite(){
    for(const base of [SQLJS_LOCAL, SQLJS_CDN]){
      try{
        if(!window.initSqlJs) await loadScript(base + "sql-wasm.js");
        sql = await window.initSqlJs({ locateFile: f => base + f });
        sdb = new sql.Database();
        createSchema();
        engine = "sqlite";
        return true;
      }catch(e){ /* fall through to the next source */ }
    }
    engine = "memory";
    return false;
  }
  function createSchema(){
    Object.keys(SCHEMA).forEach(t => {
      const cols = SCHEMA[t].map(c => '"' + c + '"' + (c === "id" || c === "key" ? " TEXT PRIMARY KEY" : " TEXT")).join(", ");
      sdb.run('CREATE TABLE IF NOT EXISTS "' + t + '" (' + cols + ');');
    });
    sdb.run('CREATE INDEX IF NOT EXISTS ix_plantings_bed ON plantings(bed_id);');
    sdb.run('CREATE INDEX IF NOT EXISTS ix_events_date ON events(date);');
    sdb.run('CREATE INDEX IF NOT EXISTS ix_harvests_crop ON harvests(crop_id);');
    sdb.run('CREATE INDEX IF NOT EXISTS ix_seeds_crop ON seeds(crop_id);');
  }
  function hydrateSqlite(){
    if(engine !== "sqlite") return;
    try{
      sdb.run("BEGIN;");
      Object.keys(SCHEMA).forEach(t => {
        sdb.run('DELETE FROM "' + t + '";');
        const cols = SCHEMA[t];
        const stmt = sdb.prepare('INSERT INTO "' + t + '" VALUES (' + cols.map(() => "?").join(",") + ');');
        cache[t].forEach(r => { stmt.run(cols.map(c => r[c] === undefined || r[c] === null ? null : String(r[c]))); });
        stmt.free();
      });
      const st = sdb.prepare('INSERT INTO settings VALUES (?,?);');
      Object.keys(settings).forEach(k => st.run([k, JSON.stringify(settings[k])]));
      st.free();
      sdb.run("COMMIT;");
    }catch(e){ try{ sdb.run("ROLLBACK;"); }catch(e2){} }
  }
  function sqlWrite(op, table, row, id){
    if(engine !== "sqlite") return;
    try{
      const cols = SCHEMA[table];
      if(op === "insert"){
        const stmt = sdb.prepare('INSERT OR REPLACE INTO "' + table + '" VALUES (' + cols.map(() => "?").join(",") + ');');
        stmt.run(cols.map(c => row[c] === undefined || row[c] === null ? null : String(row[c]))); stmt.free();
      } else if(op === "delete"){
        const key = table === "settings" ? "key" : "id";
        const stmt = sdb.prepare('DELETE FROM "' + table + '" WHERE ' + key + ' = ?;');
        stmt.run([String(id)]); stmt.free();
      }
    }catch(e){ console.warn("sql write", e); }
  }

  /* ---- persistence (encrypted JSON vault) ---- */
  function serialize(){
    return JSON.stringify({ v: 1, saved: Date.now(), settings: settings, tables: cache });
  }
  async function persist(){
    if(!Vault.unlocked) return;
    const bytes = Crypto.enc.encode(serialize());
    const ct = await Vault.encrypt(bytes);
    try{ await Blobs.set("vault", ct); dirty = false; }
    catch(e){ toast("⚠️ Storage full — export a backup"); console.error(e); }
  }
  function save(){ dirty = true; clearTimeout(saveT); saveT = setTimeout(persist, 350); }
  async function flush(){ clearTimeout(saveT); if(dirty) await persist(); }

  async function load(){
    const ct = await Blobs.get("vault");
    if(ct){
      const pt = await Vault.decrypt(ct);            // throws if key is wrong
      const obj = JSON.parse(Crypto.dec.decode(pt));
      settings = obj.settings || {};
      Object.keys(SCHEMA).forEach(t => cache[t] = (obj.tables && obj.tables[t]) || []);
    }
    loaded = true;
  }

  /* ---- repository API ---- */
  const api = {
    get engine(){ return engine; },
    get backend(){ return Blobs.backend; },
    get loaded(){ return loaded; },
    all: t => cache[t] || [],
    find: (t, id) => (cache[t] || []).find(r => r.id === id) || null,
    where: (t, fn) => (cache[t] || []).filter(fn),
    count: t => (cache[t] || []).length,

    insert(t, obj){
      const row = Object.assign({ id: uid(), created: new Date().toISOString() }, obj);
      SCHEMA[t].forEach(c => { if(!(c in row)) row[c] = null; });
      cache[t].push(row); sqlWrite("insert", t, row); save();
      return row;
    },
    update(t, id, patch){
      const row = api.find(t, id); if(!row) return null;
      Object.assign(row, patch); sqlWrite("insert", t, row); save();
      return row;
    },
    remove(t, id){
      const i = cache[t].findIndex(r => r.id === id); if(i < 0) return false;
      cache[t].splice(i, 1); sqlWrite("delete", t, null, id); save();
      return true;
    },
    bulkRemove(t, fn){
      const gone = cache[t].filter(fn);
      gone.forEach(r => api.remove(t, r.id));
      return gone.length;
    },

    /* settings */
    get(k, d){ return (k in settings) ? settings[k] : d; },
    set(k, v){
      settings[k] = v;
      if(engine === "sqlite"){ sqlWrite("delete", "settings", null, k); sqlWrite("insert", "settings", {key:k, value:JSON.stringify(v)}); }
      save(); return v;
    },
    get settings(){ return settings; },

    /* raw SQL (read/write) for the built-in console */
    query(q){
      if(engine !== "sqlite") throw new Error("SQL engine unavailable offline — showing cached data only.");
      const res = sdb.exec(q);
      return res.map(r => ({ cols: r.columns, rows: r.values }));
    },
    exportSqlite(){
      if(engine !== "sqlite") return null;
      hydrateSqlite();
      return sdb.export();
    },
    exportJSON(){ return serialize(); },
    async importJSON(text){
      const obj = JSON.parse(text);
      if(!obj || !obj.tables) throw new Error("Not a Pocket Fertilizer backup");
      settings = obj.settings || {};
      Object.keys(SCHEMA).forEach(t => cache[t] = obj.tables[t] || []);
      hydrateSqlite(); await persist();
    },
    async wipeAll(){
      Object.keys(SCHEMA).forEach(t => cache[t] = []);
      settings = {}; hydrateSqlite(); await persist();
    },
    initSqlite, hydrateSqlite, load, save, flush, persist
  };
  return api;
})();

/* ---------- photos (stored inside the encrypted vault) ---------- */
const Photos = {
  put(dataUrl, w, h){
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
    if(!m) return null;
    return DB.insert("photos", { mime: m[1], data: m[2], w: w || null, h: h || null }).id;
  },
  url(id){
    if(!id) return null;
    const p = DB.find("photos", id);
    return p ? "data:" + p.mime + ";base64," + p.data : null;
  },
  drop(id){ if(id) DB.remove("photos", id); },
  bytes(){ return DB.all("photos").reduce((a, p) => a + (p.data ? p.data.length * 0.75 : 0), 0); }
};

/* ---------- image downscaling (keeps the vault small) ---------- */
function shrinkImage(file, maxPx, quality){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, (maxPx || 900) / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        res({ dataUrl: c.toDataURL("image/jpeg", quality || 0.72), w: w, h: h, canvas: c });
      };
      img.onerror = () => rej(new Error("bad image"));
      img.src = fr.result;
    };
    fr.onerror = () => rej(new Error("read failed"));
    fr.readAsDataURL(file);
  });
}
</script>
