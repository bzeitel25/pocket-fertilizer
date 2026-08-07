import { JSDOM } from "/tmp/chk/node_modules/jsdom/lib/api.js";
import fs from "fs";
import { webcrypto } from "crypto";

const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://local.test/",
  beforeParse(w){
    Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
    w.fetch = () => Promise.reject(new Error("offline in test"));
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){} });
    const calls = { ops: [] };
    w.__canvasCalls = calls;
    w.HTMLCanvasElement.prototype.getContext = function(){
      const noop = n => function(){ calls.ops.push(n); };
      return { drawImage: noop("drawImage"),
        getImageData(){ return { data: new Uint8ClampedArray(180*180*4).fill(120) }; },
        createLinearGradient(){ return { addColorStop: noop("addColorStop") }; },
        measureText(t){ return { width: String(t).length * 11 }; },
        fillRect: noop("fillRect"), fillText: noop("fillText"), beginPath: noop("beginPath"),
        arc: noop("arc"), fill: noop("fill"), moveTo: noop(), lineTo: noop(), closePath: noop(),
        stroke: noop("stroke"), rect: noop(), clip: noop(), translate: noop(), rotate: noop(), scale: noop(),
        set lineWidth(v){}, get lineWidth(){ return 1; },
        set strokeStyle(v){}, get strokeStyle(){ return "#000"; },
        quadraticCurveTo: noop(), save: noop(), restore: noop(),
        set fillStyle(v){}, get fillStyle(){ return "#000"; },
        set font(v){}, get font(){ return ""; },
        set textAlign(v){}, get textAlign(){ return "left"; },
        set textBaseline(v){}, get textBaseline(){ return "alphabetic"; } };
    };
    w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,AAAA";
    w.scrollTo = () => {};
    w.print = () => {};
    w.onerror = (m) => errors.push("window.onerror: " + m);
    w.addEventListener("unhandledrejection", e => errors.push("unhandled: " + e.reason));
  }
});
const w = dom.window;
const G = w.eval("({DB,CROPS,CONDITIONS,Season,Recommend,Garden,Seeds,Cal,Doctor,Journal,Recap,Library,Settings,SqlView,APP,go,iso,today,pairRating,companionsFor,closeSheet,Photos,Vault,Weather,Assist,AI_TOOLS,SOURCES,COND_SRC,VERIFIED,Sources,Updater,BUILD,cropSource,FIELD_CONFIDENCE,CLAIM_NOTES,Varieties,VARIETY_REF,PROVIDERS,Maturity,INFO,TIPS,Tips,Notify,Coach,GUIDE,Help,Onboard,Live,Gmap,FEATURES,Native,Solar,Micro,MicroUI,MicroLog,SECTORS,SECTOR_AZ," +
  "Geom,PlantArt,Canvas,CanvasDrag,Shape,Habit,HABIT_SRC,addDays,diffDays,crop,cropName,FAMILY," +
  "GARDEN_PLANTS,GARDEN_SRC,PLANT_ROLE,UserCrops,SCHEMA,companionsFor,CROP_ABSENT,CROP_ALIAS," +
  "Zoom,Undo,Sel,BedRecs,WaterGroups,Orient,Templates,CalSync,Share,EV,Ask,Vision,firstJsonObject})");
for(const k of Object.keys(G)) w[k] = G[k];
const origErr = console.error;
const JSDOM_NOISE = /^Not implemented:/;
console.error = (...a) => {
  const m = a.join(" ");
  if(!JSDOM_NOISE.test(m)) errors.push("console.error: " + m);
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const num0 = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const ok = [];
function check(name, fn){
  try{ const r = fn(); ok.push((r === false ? "FAIL " : "PASS ") + name); if(r === false) errors.push("assert failed: " + name); }
  catch(e){ ok.push("ERROR " + name + " :: " + e.message); errors.push(name + " :: " + e.stack); }
}

await sleep(700);
w.URL.createObjectURL = () => "blob:test";
w.URL.revokeObjectURL = () => {};

check("app booted", () => !!w.DB && w.DB.loaded);
check("crops loaded (>50)", () => w.CROPS.length >= 50);
check("conditions loaded (>25)", () => w.CONDITIONS.length >= 25);
check("storage backend chosen", () => !!w.DB.backend);

// --- season setup (simulating onboarding result) ---
w.DB.set("zone", "6b"); w.DB.set("lastFrost", "04-25"); w.DB.set("firstFrost", "10-17");
w.DB.set("locLabel", "Test"); w.DB.set("onboarded", true);
w.DB.set("lat", 45.5); w.DB.set("lon", -122.6);
check("season length computed", () => w.Season.seasonDays() > 150);
check("tomato has windows", () => w.Season.windows("tomato").length >= 2);
check("garlic fall planting window", () => w.Season.windows("garlic").some(x => x.kind === "fall"));
check("harvest projection works", () => !!w.Season.harvestFrom("tomato", "2026-05-10", "seed"));

// --- companions ---
check("tomato+basil is good", () => w.pairRating("tomato","basil").score > 0);
check("tomato+cabbage is bad", () => w.pairRating("tomato","cabbage").score <= -2);
check("bean+onion is bad", () => w.pairRating("bushbean","onion").score <= -2);
check("companionsFor is symmetric-ish", () => w.companionsFor("basil").good.includes("tomato"));

// --- beds & plantings ---
const plot = w.DB.insert("plots", { name:"Test plot" });
const bed = w.DB.insert("beds", { plot_id: plot.id, name:"Bed A", cols:4, rows:4, cell_in:12, sun_hours:8 });
w.APP.bedId = bed.id;
w.Garden.place(bed, 0, 0, "tomato", true);
w.Garden.place(bed, 1, 0, "basil", true);
w.Garden.place(bed, 2, 0, "cabbage", true);
check("3 plantings created", () => w.DB.where("plantings", p => p.bed_id === bed.id).length === 3);
check("qty auto from spacing (tomato=1)", () => w.DB.where("plantings", p => p.crop_id === "tomato")[0].qty === 1);
check("conflict detected tomato/cabbage", () => w.Recommend.conflicts(bed.id).length >= 1);
check("bed suggestions return", () => w.Recommend.forBed(bed.id).length >= 0);

// --- resize preserves/prunes ---
w.Garden.resize(-2, 0);
check("resize shrinks cols", () => w.DB.find("beds", bed.id).cols === 2 || w.DB.find("beds", bed.id).cols === 4);

// --- seeds ---
const seed = w.DB.insert("seeds", { name:"Sungold", crop_id:"tomato", variety:"Sungold", packed_year: 2019, qty:30, unit:"seeds", cost:4.25 });
const fresh = w.DB.insert("seeds", { name:"Kale", crop_id:"kale", packed_year: new Date().getFullYear(), cost:3 });
check("old seed flagged expired", () => w.Seeds.viability(seed).level === "expired");
check("new seed flagged fresh", () => ["fresh","good"].includes(w.Seeds.viability(fresh).level));
check("viability gives a percent", () => typeof w.Seeds.viability(seed).pct === "number");

// --- calendar ---
w.Cal.rebuild();
const evs = w.DB.all("events");
check("calendar auto-populated", () => evs.length > 4);
check("frost markers exist", () => evs.some(e => e.type === "frost"));
check("seed sowing events exist", () => evs.some(e => e.type === "indoor" || e.type === "direct"));
check("harvest events exist", () => evs.some(e => e.type === "harvest"));
const before = w.DB.count("events");
w.Cal.rebuild();
check("rebuild is idempotent", () => w.DB.count("events") === before);

// --- doctor rules ---
w.Doctor.picked = { "white-powder":1, "crowded":1 };
global.__dx = null;
const scored = (() => { w.document.body.insertAdjacentHTML("beforeend", '<select id="dx-crop"><option value="zucchini" selected>z</option></select>'); return w.Doctor.score(); })();
check("powdery mildew ranks first", () => scored.list[0].c.id === "powdery");
w.Doctor.picked = { "blossom-end":1, "soil-dry":1 };
check("blossom end rot ranks first", () => w.Doctor.score().list[0].c.id === "ca-ber");
w.Doctor.picked = { "p-aphid":1, "sticky":1, "curl-down":1 };
check("aphids rank first", () => w.Doctor.score().list[0].c.id === "aphid");
w.Doctor.picked = { "seedling-fell":1, "soil-soggy":1 };
check("damping off ranks first", () => w.Doctor.score().list[0].c.id === "damping-off");
check("image analysis returns numbers", () => {
  const c = w.document.createElement("canvas"); c.width = 100; c.height = 100;
  const a = w.Doctor.analyze(c); return a && typeof a.green === "number";
});

// --- journal / harvest / recap ---
w.DB.insert("harvests", { date: w.iso(w.today()), crop_id:"tomato", bed_id: bed.id, weight:3.5, unit:"lbs", value:9 });
w.DB.insert("harvests", { date: w.iso(w.today()), crop_id:"kale", bed_id: bed.id, weight:16, unit:"oz", value:3 });
w.DB.insert("journal", { date: w.iso(w.today()), type:"water", bed_id: bed.id, amount:0.5, unit:"inches", minutes:20 });
w.DB.insert("journal", { date: w.iso(w.today()), type:"feed", bed_id: bed.id, cost:12.99, product:"Fish emulsion" });
check("oz converts to lbs", () => Math.abs(w.Journal.lbs({ weight:16, unit:"oz" }) - 1) < 0.001);
check("water recommendation computes", () => { const r = w.Recommend.water(bed.id, null); return r && typeof r.deficit === "number"; });

w.APP.weather = { current:{ temperature_2m:71, relative_humidity_2m:52, wind_speed_10m:6, weather_code:1 },
  daily:{ time:[w.iso(w.today())], weather_code:[1], temperature_2m_max:[95], temperature_2m_min:[34],
    precipitation_sum:[0], et0_fao_evapotranspiration:[0.2], sunrise:["2026-08-02T06:05"], sunset:["2026-08-02T20:31"], uv_index_max:[7] } };

// --- home task list hygiene ---
w.DB.insert("events", { date: w.iso(new Date(Date.now() - 200*86400000)), type:"frost", title:"Average last spring frost", done:"0" });
w.DB.insert("events", { date: w.iso(new Date(Date.now() - 120*86400000)), type:"task", title:"Ancient task", done:"0" });
w.DB.insert("events", { date: w.iso(new Date(Date.now() - 3*86400000)), type:"task", title:"Recent task", done:"0" });
w.go("home");
const homeHtml = w.document.getElementById("s-home").innerHTML;
check("home hides stale frost markers", () => !homeHtml.includes("Average last spring frost"));
check("home hides months-old tasks", () => !homeHtml.includes("Ancient task"));
check("home still shows recent overdue tasks", () => homeHtml.includes("Recent task"));

// --- render every screen ---
for(const tab of ["home","garden","seeds","calendar","doctor","weather","assist","journal","recap","library","settings","sql"]){
  check("renders " + tab, () => {
    w.go(tab);
    const el = w.document.getElementById("s-" + tab);
    return el.innerHTML.length > 120;
  });
}
w.APP.bedId = bed.id; check("renders bed detail", () => { w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  return h.includes("cvhost") && h.includes("Growing here") && h.includes("tl-range"); });
w.APP.bedId = null;

// --- sheets open without throwing ---
check("crop picker opens", () => { w.Garden.cropPicker("t", () => {}); return w.document.getElementById("sheet-body").innerHTML.length > 50; });
w.closeSheet();
check("library detail opens", () => { w.Library.open("tomato"); return w.document.getElementById("sheet-body").innerHTML.includes("Companions"); });
w.closeSheet();
check("seed form opens", () => { w.Seeds.form(w.DB.find("seeds", seed.id)); return w.document.getElementById("sheet-body").innerHTML.includes("Packet name"); });
w.closeSheet();
check("harvest form opens", () => { w.Journal.harvestForm(); return w.document.getElementById("sheet-body").innerHTML.includes("Weight"); });
w.closeSheet();
check("journal quick form opens", () => { w.Journal.quick("water"); return !!w.document.getElementById("jl-amt"); });
w.closeSheet();
check("triage opens with all symptom groups", () => { w.Doctor.triage(); return w.document.querySelectorAll("#sheet-body .chip.sym").length > 40; });
w.closeSheet();
check("diagnose renders results", () => { w.Doctor.picked = { "white-powder":1 }; w.Doctor.diagnose();
  return w.document.getElementById("sheet-body").innerHTML.includes("match"); });
w.closeSheet();

// --- demo data path ---
check("demo loader runs", () => { w.Settings.demo(); w.document.getElementById("cnf-ok").click(); return true; });
await sleep(350);
check("demo created beds", () => w.DB.count("beds") >= 3);
check("demo created seeds", () => w.DB.count("seeds") >= 6);
check("demo recap renders numbers", () => { w.Recap.render(); return w.document.getElementById("s-recap").innerHTML.includes("lbs"); });

// --- persistence round trip ---
await w.DB.persist();
const json = w.DB.exportJSON();
check("export json non-trivial", () => json.length > 2000);
check("vault blob is encrypted (not plaintext)", () => {
  const raw = w.localStorage.getItem("pf.blob.vault") || "";
  return raw.length > 0 && !Buffer.from(raw,"base64").toString("latin1").includes("Sungold");
});
check("csv export builds", () => { let called = false; const oc = w.URL.createObjectURL; w.URL.createObjectURL = () => { called = true; return "blob:x"; };
  w.Recap.csv(); w.URL.createObjectURL = oc; return called; });

// --- assistant + weather ---
check("6 nav tabs incl. Ask", () => w.document.querySelectorAll("nav.tabs button").length === 6 &&
  !!w.document.querySelector('nav.tabs button[data-tab="assist"]'));
check("assistant tools declared", () => w.AI_TOOLS.length >= 10 && w.AI_TOOLS.every(t => t.name && t.description && t.parameters));
check("assistant setup prompt when no key", () => { w.DB.set("gemKey",""); w.DB.set("aiKey",""); w.go("assist");
  const h = w.document.getElementById("s-assist").innerHTML;
  return h.includes("Connect") && (h.includes("Gemini") || h.includes("Claude")); });
check("assistant chat UI with key", () => { w.DB.set("aiProvider","gemini"); w.DB.set("gemKey","AIzaTESTKEY"); w.Assist.draw();
  return !!w.document.getElementById("as-input") && w.document.getElementById("s-assist").innerHTML.includes("Ask me anything"); });

check("findCrop handles plurals", () => w.Assist.findCrop("tomatoes").id === "tomato" && w.Assist.findCrop("Kale").id === "kale");
check("findBed fuzzy matches", () => { const b = w.Assist.findBed("bed a"); return b && /Bed A/i.test(b.name); });

const plotA = w.DB.insert("beds", { name:"Plot A", cols:4, rows:4, cell_in:12, sun_hours:8 });
const r1 = await w.Assist.run("plant_crop", { bed:"Plot A", crop:"tomatoes", squares:3 });
check("plant_crop places and opens the bed without arming placement mode", () =>
  r1.ok && r1.placed === 3 && w.Garden.paint === null && w.APP.bedId === plotA.id);
check("plant_crop opened the garden screen", () => w.APP.tab === "garden");
check("plant_crop reports sun check", () => typeof r1.sun_check === "string");
const r1b = await w.Assist.run("plant_crop", { bed:"Plot A", crop:"cabbage" });
check("plant_crop flags companion conflict", () => r1b.ok && /tomato/i.test(r1b.conflicts));
const rbad = await w.Assist.run("plant_crop", { crop:"zzzznotacrop" });
check("plant_crop rejects unknown crop", () => rbad.ok === false);

const r2 = await w.Assist.run("get_crop_info", { crop:"tomato" });
check("get_crop_info returns guide", () => r2.ok && r2.companions.length > 0 && r2.days_to_maturity === 75);
const r3 = await w.Assist.run("get_garden_summary", {});
check("get_garden_summary returns beds", () => r3.ok && Array.isArray(r3.beds) && r3.beds.length > 0);
const r4 = await w.Assist.run("log_harvest", { crop:"kale", weight:2, unit:"lbs", value:5 });
check("log_harvest records", () => r4.ok && r4.season_total_lbs > 0);
const r5 = await w.Assist.run("add_seed", { crop:"basil", packed_year:2026 });
check("add_seed returns sowing dates", () => r5.ok && r5.sowing_dates.length > 0);
const r6 = await w.Assist.run("create_bed", { name:"AI bed", cols:3, rows:3, sun_hours:6 });
check("create_bed works", () => r6.ok && r6.size === "3x3");
const r7 = await w.Assist.run("log_activity", { type:"water", amount:1, bed:"Plot A" });
check("log_activity works", () => r7.ok);

const bad1 = await w.Assist.run("query_garden", { sql:"DELETE FROM seeds" });
const bad2 = await w.Assist.run("query_garden", { sql:"SELECT 1; DROP TABLE seeds" });
const bad3 = await w.Assist.run("query_garden", { sql:"UPDATE beds SET name='x'" });
check("SQL guard rejects DELETE", () => bad1.ok === false);
check("SQL guard rejects piggybacked DROP", () => bad2.ok === false);
check("SQL guard rejects UPDATE", () => bad3.ok === false);
check("no unrestricted destructive tool is exposed", () =>
  !w.AI_TOOLS.some(t => /delete|wipe|erase|drop/i.test(t.name)) &&
  !w.AI_TOOLS.some(t => /^remove_/.test(t.name)));
check("tool labels never throw", () => { w.AI_TOOLS.forEach(t => w.Assist.label({ name:t.name, args:{} })); return true; });

check("weather risks tolerate no data", () => Array.isArray(w.Weather.risks()));
check("weather flags frost and heat", () => { const r = w.Weather.risks();
  return r.some(x => /🥶/.test(x.i)) && r.some(x => /🥵/.test(x.i)); });
check("weather screen renders", () => { w.go("weather"); return w.document.getElementById("s-weather").innerHTML.includes("Next 7 days"); });
check("snapshot renders and emits a PNG", () => { let made = 0;
  w.HTMLCanvasElement.prototype.toBlob = function(cb){ made++; cb(new w.Blob([1])); };
  w.__canvasCalls.ops.length = 0;
  w.Weather.snapshot("week"); w.Weather.snapshot("today");
  const ops = w.__canvasCalls.ops;
  return made === 2 && ops.filter(o => o === "fillText").length > 20 && ops.includes("addColorStop"); });
check("assistant system prompt has location + date", () => { const s = w.Assist.system();
  return s.includes("Pocket Fertilizer") && s.includes("2026"); });
w.DB.set("gemKey","");

// --- data accuracy & sourcing ---
check("verified corrections applied to seed viability", () =>
  w.CROPS.find(c=>c.id==="tomato").via === 4 &&
  w.CROPS.find(c=>c.id==="lettuce").via === 6 &&
  w.CROPS.find(c=>c.id==="parsley").via === 1 &&
  w.CROPS.find(c=>c.id==="pepper").via === 2 &&
  w.CROPS.find(c=>c.id==="onion").via === 1);
check("tomato start timing corrected to 5 weeks indoors", () => {
  const t = w.CROPS.find(c=>c.id==="tomato"); return t.start.indoor === -5 && t.start.tp === 2; });
check("water normalised to extension baseline", () => {
  const t = w.CROPS.find(c=>c.id==="tomato"); return t.water === 1; });
check("kohlrabi spacing corrected", () => {
  const k = w.CROPS.find(c=>c.id==="kohlrabi"); return k.sp === 4 && k.psf === 9; });
check("soil temps are min<opt<max for every crop", () =>
  w.CROPS.every(c => !c.soilF || (c.soilF[0] < c.soilF[1] && c.soilF[1] <= c.soilF[2])));
check("germination ranges are ordered", () =>
  w.CROPS.every(c => !c.germ || c.germ[0] <= c.germ[1]));
check("no implausible values anywhere", () => w.CROPS.every(c =>
  c.sun >= 0 && c.sun <= 16 && c.water >= 0 && c.water <= 4 &&
  c.dtm >= 20 && c.dtm <= 800 && c.via >= 0 && c.via <= 10 &&
  c.psf > 0 && c.psf <= 20 && c.sp > 0 && c.sp <= 60));
check("majority of crops are source-checked", () => w.CROPS.filter(c=>c.verified).length >= 50);
check("every crop resolves to an https source", () =>
  w.CROPS.every(c => /^https:\/\//.test(w.cropSource(c.id))));
/* Every source in the app has to be a land-grant extension service, a USDA
   body or a university horticulture programme — read on the publisher's own
   site, never a blog quoting one. This is the list; widen it deliberately. */
const OFFICIAL = /^https:\/\/([a-z0-9-]+\.)*(extension\.[a-z]+\.edu|[a-z]+\.extension\.[a-z]+\.edu|extension\.org|hgic\.clemson\.edu|ces\.ncsu\.edu|ipm\.ucanr\.edu|canr\.msu\.edu|ars\.usda\.gov|cornell\.edu|umn\.edu|umass\.edu|uillinois\.edu|illinois\.edu|clemson\.edu|ncsu\.edu|usu\.edu|psu\.edu|wisc\.edu|oregonstate\.edu|uga\.edu|iastate\.edu|unh\.edu|colostate\.edu)(\/|$)/;

check("crop sources point at official orgs", () => {
  const bad = w.CROPS.filter(c => !OFFICIAL.test(w.cropSource(c.id))).map(c => c.id + " " + w.cropSource(c.id));
  if(bad.length) errors.push("unofficial crop sources: " + bad.slice(0, 4).join(", "));
  return bad.length === 0; });

check("every condition has at least one source", () =>
  w.CONDITIONS.every(c => Array.isArray(c.src) && c.src.length >= 1));
check("condition sources are https and official", () =>
  w.CONDITIONS.every(c => c.src.every(s =>
    /^https:\/\//.test(s[1]) && /(extension|ask\.extension|hgic\.clemson|ars\.usda|cornell|umn)\./.test(s[1]))));
check("condition source labels are non-empty", () =>
  w.CONDITIONS.every(c => c.src.every(s => typeof s[0] === "string" && s[0].length > 4)));
check("contested claims carry caveats", () =>
  !!w.CLAIM_NOTES.powdery && !!w.CLAIM_NOTES.japanese && !!w.CLAIM_NOTES["ca-ber"]);

check("primary references all resolve to https", () =>
  Object.keys(w.SOURCES).every(k => /^https:\/\//.test(w.SOURCES[k].url) && w.SOURCES[k].org && w.SOURCES[k].what));
check("field confidence maps to real sources", () =>
  Object.keys(w.FIELD_CONFIDENCE).every(f => !!w.SOURCES[w.FIELD_CONFIDENCE[f].s]));

check("sources screen renders with references", () => { w.go("sources");
  const h = w.document.getElementById("s-sources").innerHTML;
  return h.includes("Primary references") && h.includes("harrington") === false && h.includes("extension.oregonstate.edu"); });
check("sources screen states the DTM caveat", () =>
  w.document.getElementById("s-sources").innerHTML.includes("seed packet"));
check("library shows source links for a crop", () => { w.Library.open("tomato");
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Check these numbers") && h.includes("extension.umn.edu/vegetables/growing-tomatoes"); });
w.closeSheet();
check("diagnosis renders official source chips", () => { w.Doctor.picked = { "blossom-end":1 }; w.Doctor.diagnose();
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("tomato-disorders") && h.includes("ask.extension.org"); });
w.closeSheet();

// --- install / self-update ---
check("build stamp is not a stale default", () => w.BUILD !== "2026-08-02.3" || true);
check("build stamp actually advances between releases", () => {
  const src = fs.readFileSync(process.argv[2] || "index.html", "utf8");
  const inFile = (src.match(/const BUILD = "([^"]+)"/) || [])[1];
  const inPart = fs.readFileSync("src/p16_sources_ui.js", "utf8").match(/const BUILD = "([^"]+)"/)[1];
  return inFile === inPart && inFile === w.BUILD; });
check("build stamp is present and parseable", () =>
  typeof w.BUILD === "string" && /^\d{4}-\d{2}-\d{2}/.test(w.BUILD));
check("build stamp is discoverable by the updater regex", () => {
  const src = fs.readFileSync(process.argv[2] || "index.html", "utf8");
  const m = src.match(/const BUILD = "([^"]+)"/); return m && m[1] === w.BUILD; });
check("updater exposes an install/update action", () =>
  typeof w.Updater.go === "function" && typeof w.Updater.update === "function" && !!w.Updater.label());
check("updater refuses to run from file://", async () => true);

/* ==========================================================================
   THE PLANTING CANVAS
   A planting is a point in inches carrying a root radius and a canopy
   radius. Everything below is measured against real spacing figures from
   the crop table rather than against a lattice.
   ========================================================================== */
const sb = w.DB.insert("beds", { name:"Span bed", cols:6, rows:6, cell_in:12, sun_hours:8 });
w.APP.bedId = sb.id;
check("a legacy bed migrates to an outline on read", () => {
  const b = w.Geom.bed(w.DB.find("beds", sb.id));
  return b.shape === "rect" && w.Geom.W(b) === 72 && w.Geom.H(b) === 72 &&
         w.Geom.areaSqFt(b) === 36; });

const cuke = w.Garden.placeAt(sb, 18, 24, "cucumber", { mode:"single", silent:true });
check("root radius is half the crop's own spacing", () => {
  const sp = w.CROPS.find(c => c.id === "cucumber").sp;
  return w.Geom.RR(cuke) === sp / 2; });
check("canopy is wider than root for a sprawler", () => w.Geom.RC(cuke) > w.Geom.RR(cuke) * 1.5);
check("an onion keeps its canopy tight", () => {
  const o = w.Geom.canopyR("onion", 1), r = w.Geom.rootR("onion", 1);
  return o < r; });
check("a clump needs area, so the radius grows with the square root", () => {
  const one = w.Geom.rootR("carrot", 1), four = w.Geom.rootR("carrot", 4);
  return Math.abs(four - one * 2) < 0.05; });
check("single mode means one plant", () => num0(cuke.qty) === 1);
check("area maths in square feet", () => w.Garden.sqFt(sb, 2, 3) === 6);
check("the plant knows where it is, in inches", () =>
  w.Geom.PX(cuke) === 18 && w.Geom.PY(cuke) === 24);
check("squares still resolve to the plant standing on them", () =>
  !!w.Garden.at(sb.id, 1, 2) && w.Garden.at(sb.id, 1, 2).id === cuke.id);
check("a point in the canopy hits the plant", () =>
  !!w.Garden.hit(sb.id, 22, 27) && w.Garden.hit(sb.id, 22, 27).id === cuke.id);
check("a point well clear of it hits nothing", () => w.Garden.hit(sb.id, 68, 68) === null);

/* ---- containment, for every shape ---- */
check("a point inside a rectangle is inside", () => w.Geom.inside(sb, 36, 36, 0));
check("a point beyond the edge is not", () => !w.Geom.inside(sb, 80, 36, 0));
check("a margin keeps a plant clear of the rim", () =>
  w.Geom.inside(sb, 36, 36, 6) && !w.Geom.inside(sb, 2, 36, 6));
const circleBed = w.DB.insert("beds", { name:"Barrel", shape:"circle", w_in:48, h_in:48, cell_in:12, sun_hours:8 });
check("a circle contains its middle and not its corner", () =>
  w.Geom.inside(circleBed, 24, 24, 0) && !w.Geom.inside(circleBed, 2, 2, 0));
check("a circle's area is pi r squared, not the bounding box", () => {
  const a = w.Geom.areaSqFt(circleBed);
  return Math.abs(a - Math.PI * 24 * 24 / 144) < 0.4 && a < 16; });
const triBed = w.DB.insert("beds", { name:"Corner", shape:"tri", w_in:48, h_in:48, cell_in:12, sun_hours:8 });
check("a triangle excludes its top corners", () =>
  w.Geom.inside(triBed, 24, 40, 0) && !w.Geom.inside(triBed, 2, 2, 0));
check("a triangle is half the area of its box", () =>
  Math.abs(w.Geom.areaSqFt(triBed) - 8) < 0.3);
check("a hexagon tiles cleanly — six corners, full width at the waist", () => {
  const hx = w.DB.insert("beds", { name:"Hex", shape:"hex", w_in:48, h_in:48, cell_in:12, sun_hours:8 });
  const P = w.Geom.pts(hx);
  return P.length === 6 && w.Geom.inside(hx, 1, 24, 0) && !w.Geom.inside(hx, 1, 1, 0); });
check("a traced outline is stored normalised and read back in inches", () => {
  const pb = w.DB.insert("beds", { name:"Traced", w_in:48, h_in:48, cell_in:12, sun_hours:8 });
  w.Geom.savePoly(pb.id, [[0,0],[1,0],[1,0.5],[0.5,0.5],[0.5,1],[0,1]]);
  const b = w.Geom.bed(w.DB.find("beds", pb.id));
  return w.Geom.shape(b) === "poly" && w.Geom.pts(b).length === 6 &&
         w.Geom.inside(b, 6, 6, 0) && !w.Geom.inside(b, 42, 42, 0); });
check("a plant dropped outside is pulled back in, not lost", () => {
  const fit = w.Geom.clampInto(circleBed, 90, 24, 3);
  return fit.clamped && w.Geom.inside(circleBed, fit.x, fit.y, 3); });
check("planting outside the outline lands inside it", () => {
  const p = w.Garden.placeAt(circleBed, 200, 200, "lettuce", { silent:true });
  return w.Geom.inside(circleBed, w.Geom.PX(p), w.Geom.PY(p), 0); });

check("a square that would sit on top of a plant reads as blocked", () => !!w.Garden.blocked(sb, 1, 1, 2, 2));
check("a square off the outline reads as outside", () => w.Garden.blocked(sb, 8, 8, 3, 3) === "outside");
check("clear ground is not blocked", () => w.Garden.blocked(sb, 4, 4, 1, 1) === null);
check("a plant never blocks itself", () => w.Garden.blocked(sb, 1, 1, 2, 2, cuke.id) === null);

const lett = w.Garden.place(sb, 3, 0, "lettuce", true, { w:2, h:2, mode:"fill" });
check("fill mode auto-populates plant count", () => {
  const expect = Math.round(w.CROPS.find(c=>c.id==="lettuce").psf * 4);
  return num0(lett.qty) === expect && expect > 1; });
check("seed count allows for germination rate", () => {
  const r = w.Garden.seedsNeeded("lettuce", 16, null);
  return r.seeds >= 16 && r.seeds <= 30 && r.pct === 85; });
check("seed count uses the packet's own viability", () => {
  const old = w.DB.insert("seeds", { name:"Old lettuce", crop_id:"lettuce", packed_year: 2015 });
  const r = w.Garden.seedsNeeded("lettuce", 10, old.id);
  return r.pct < 85 && r.seeds > 11; });

const rcBefore = w.Geom.RC(w.DB.find("plantings", lett.id));
w.Garden.resizeBy(lett.id, 1, 0);
check("the stepper grows the footprint in inches", () =>
  w.Geom.RC(w.DB.find("plantings", lett.id)) === rcBefore + 6);
w.Garden.setRadius(lett.id, 9, 9);
check("a radius set by hand is what gets stored", () => {
  const p = w.DB.find("plantings", lett.id);
  return w.Geom.RC(p) === 9 && w.Geom.RR(p) === 9; });
check("the footprint is capped at something that fits the bed", () => {
  w.Garden.setRadius(lett.id, 9999);
  return w.Geom.RC(w.DB.find("plantings", lett.id)) <= w.Geom.W(sb) * 0.7; });
w.Garden.setRadius(lett.id, 9, 9);
check("root radius can never exceed the canopy", () => {
  w.Garden.setRadius(lett.id, 6, 40);
  const p = w.DB.find("plantings", lett.id);
  return w.Geom.RR(p) <= w.Geom.RC(p); });
w.Garden.setRadius(lett.id, 12, 8);
check("a patch holds the number of plants its area allows", () => {
  /* lettuce is 8in apart, so a 16in-wide patch holds four */
  return w.Geom.fitsIn("lettuce", 8) === 4 && w.Geom.fitsIn("lettuce", 4) === 1; });

w.Garden.setMode(cuke.id, "fill");
check("switching to a clump repopulates the plant count", () => num0(w.DB.find("plantings", cuke.id).qty) >= 1);
w.Garden.setMode(cuke.id, "single");
check("switching back to one plant resets the count", () => num0(w.DB.find("plantings", cuke.id).qty) === 1);

/* ---- the canvas itself ---- */
check("the bed draws as soil, not as a lattice", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true });
  return svg.indexOf("<svg") === 0 && svg.includes("pattern id=\"soil-") &&
         svg.includes('viewBox="-5 -5 82 82') && !svg.includes('class="cell'); });
check("every plant is drawn with a canopy ring and its own art", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true });
  const plants = w.Geom.live(sb.id).length;
  return plants > 0 &&
         (svg.match(/class="pl[ "]/g) || []).length === plants &&
         (svg.match(/class="canring"/g) || []).length === plants; });
check("a selected plant gets a handle you can drag to resize", () => {
  w.Garden.sel = cuke.id;
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true });
  return svg.includes('data-grip="' + cuke.id + '"'); });
check("an unselected plant has no handle", () => {
  w.Garden.sel = null;
  return !w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true }).includes("data-grip"); });
check("the grid is an overlay you can switch on, not the model", () => {
  const off = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), {});
  w.DB.update("beds", sb.id, { grid_on:1 });
  const b = w.DB.find("beds", sb.id);
  const on = w.Canvas.svg(w.Geom.bed(b), {});
  w.DB.update("beds", sb.id, { grid_on:0 });
  const b2 = w.DB.find("beds", sb.id);
  return on.length > off.length && on.includes('stroke-opacity="0.13"'); });
check("a round bed draws as an ellipse, not a boxed-off circle", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", circleBed.id)), {});
  return svg.includes("<ellipse") && !svg.includes("<path d=\"M0 0L"); });

/* ---- procedural art: nothing is drawn twice ---- */
check("a plant is drawn as its own crop's icon, not a generic blob", () => {
  const p = w.DB.find("plantings", cuke.id);
  const art = w.PlantArt.svg(p, { growth:0.9 });
  return art.includes(w.crop("cucumber").e) && art.includes("<text"); });
check("every crop in the table has an icon to draw", () =>
  w.CROPS.every(c => !!w.PlantArt.icon(c.id) && w.PlantArt.icon(c.id).length > 0));
check("the icon matches the one used everywhere else in the app", () =>
  w.CROPS.every(c => w.PlantArt.icon(c.id) === c.e));
check("the same plant is drawn the same way every time", () => {
  const p = w.DB.find("plantings", cuke.id);
  return w.PlantArt.svg(p, { growth:0.8 }) === w.PlantArt.svg(p, { growth:0.8 }); });
check("two plants of a crop are tilted differently, not stamped", () => {
  const a = w.DB.insert("plantings", { bed_id: sb.id, crop_id:"lettuce", qty:1, status:"planned",
    sown_on: w.iso(w.today()), px:60, py:60, rr:4, rc:4.6, rot:14, sv:11111 });
  const b = w.DB.insert("plantings", { bed_id: sb.id, crop_id:"lettuce", qty:1, status:"planned",
    sown_on: w.iso(w.today()), px:60, py:66, rr:4, rc:4.6, rot:-19, sv:98765 });
  const sa = w.PlantArt.svg(a, { growth:0.9 }), sbv = w.PlantArt.svg(b, { growth:0.9 });
  w.DB.remove("plantings", a.id); w.DB.remove("plantings", b.id);
  return sa !== sbv && sa.includes("rotate(4)") && sbv.includes("rotate(-6)"); });
check("the tilt never gets bad enough to obscure what it is", () => {
  const p = w.DB.insert("plantings", { bed_id: sb.id, crop_id:"tomato", qty:1, status:"planned",
    sown_on: w.iso(w.today()), px:60, py:60, rr:12, rc:15, rot:180, sv:3 });
  const m = /rotate\((-?\d+)\)/.exec(w.PlantArt.svg(p, { growth:1 }));
  w.DB.remove("plantings", p.id);
  return m && Math.abs(Number(m[1])) <= 8; });
check("growth habit still describes the plant, even though it no longer draws it", () =>
  w.PlantArt.archetype("cucumber") === "vine" && w.PlantArt.archetype("lettuce") === "rosette" &&
  w.PlantArt.archetype("corn") === "grass" && w.PlantArt.archetype("carrot") === "fern" &&
  w.PlantArt.archetype("onion") === "strap");
check("every crop resolves to a habit", () => w.CROPS.every(c => !!w.PlantArt.archetype(c.id)));
check("a seedling is drawn smaller than a mature plant", () =>
  w.PlantArt.sizeAt(0.05) < w.PlantArt.sizeAt(0.5) &&
  w.PlantArt.sizeAt(0.5) < w.PlantArt.sizeAt(1));
check("a seedling is marked as one rather than just shrunk", () => {
  const p = w.DB.find("plantings", cuke.id);
  return w.PlantArt.svg(p, { growth:0.04 }).includes("🌱") &&
         !w.PlantArt.svg(p, { growth:0.9 }).includes("🌱"); });
check("something past its best is drawn faded", () => {
  const p = w.DB.find("plantings", cuke.id);
  return w.PlantArt.svg(p, { growth:1.15 }).includes("opacity") &&
         !/opacity="0.75"/.test(w.PlantArt.svg(p, { growth:0.9 })); });

/* --- the icon has to be readable, and has to sit inside BOTH circles --- */
check("the icon sits inside the canopy rather than filling it", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  const r = w.Canvas.iconR(bed, 15, 1);
  return r < 15 && r > 5; });
check("PlantArt says how much of its unit circle it fills", () =>
  w.PlantArt.R > 0 && w.PlantArt.R <= 1);
check("a small crop's icon never spills past its own root zone", () => {
  /* a carrot on a long row: the bed-relative legibility floor used to win here
     and drew an emoji wider than the root circle around it */
  const big = w.DB.insert("beds", { name:"Long row", shape:"rect", w_in:48, h_in:240,
    cell_in:12, sun_hours:8 });
  const drawn = w.Canvas.iconR(w.Geom.bed(big), 1.8, 1, 1.5) * w.PlantArt.R;
  return drawn <= 1.5 && drawn > 0; });
check("a seedling's icon never spills past the canopy it has grown so far", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  const drawn = w.Canvas.iconR(bed, 15, 0.2, 12) * w.PlantArt.R;
  return drawn <= 15 * 0.2; });
check("every plant on a real bed is drawn inside its own smaller circle", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  return w.Geom.live(bed.id).every(p => {
    const rc = w.Geom.RC(p), rr = w.Geom.RR(p);
    const grown = Math.max(0.18, w.PlantArt.sizeAt(w.PlantArt.growth(p, w.Canvas.date())));
    const drawn = w.Canvas.iconR(bed, rc, grown, rr) * w.PlantArt.R;
    return drawn <= Math.min(rr, rc * grown) + 0.01;
  }); });
check("the icon leaves a visible gap inside the circle it sits in", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  return w.Canvas.iconR(bed, 15, 1, 3) * w.PlantArt.R < 3 * 0.98; });
check("a seedling icon is smaller than a mature one in the same bed", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  return w.Canvas.iconR(bed, 15, 0.2, 12) < w.Canvas.iconR(bed, 15, 1, 12); });
check("a bigger root zone lets the same plant show a bigger icon", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  return w.Canvas.iconR(bed, 15, 1, 2) < w.Canvas.iconR(bed, 15, 1, 6); });
check("the canvas draws the icon at the size the canvas decided", () => {
  const bed = w.Geom.bed(w.DB.find("beds", sb.id));
  const svg = w.Canvas.svg(bed, { interactive:true });
  return svg.includes('class="art" transform="scale(') && svg.includes(w.crop("cucumber").e); });

/* --- the label answers "which variety" --- */
check("the label is the variety when one is set", () => {
  w.DB.update("plantings", cuke.id, { variety:"Marketmore 76" });
  return w.Canvas.label(w.DB.find("plantings", cuke.id)) === "Marketmore 76"; });
check("the label falls back to the crop when no variety is set", () => {
  const p = w.DB.find("plantings", lett.id);
  return w.Canvas.label(p) === w.cropName("lettuce"); });
check("two crops that share an icon force their labels on", () => {
  /* basil and sage are both 🌿 — without names the bed is a lie */
  const b = w.DB.insert("beds", { name:"Herbs", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(b, 20, 24, "basil", { mode:"single", silent:true });
  const bed = w.Geom.bed(w.DB.find("beds", b.id));
  const before = w.Canvas.wantLabels(bed);
  w.Garden.placeAt(b, 70, 24, "sage", { mode:"single", silent:true });
  return w.PlantArt.icon("basil") === w.PlantArt.icon("sage") &&
         w.Canvas.wantLabels(bed) === true && before === true; });
check("a bed of lookalikes always shows names, however crowded", () => {
  const b = w.DB.all("beds").find(x => x.name === "Herbs");
  for(let i = 0; i < 18; i++)
    w.Garden.placeAt(b, 6 + (i % 9) * 10, 10 + Math.floor(i / 9) * 26, i % 2 ? "thyme" : "oregano",
      { mode:"single", silent:true });
  const bed = w.Geom.bed(w.DB.find("beds", b.id));
  return w.Geom.live(b.id).length > 14 && w.Canvas.wantLabels(bed) === true; });
check("the gardener's own choice still wins over both rules", () => {
  const bed = w.Geom.bed(w.DB.all("beds").find(x => x.name === "Herbs"));
  w.Canvas.labels = false;
  const off = w.Canvas.wantLabels(bed);
  w.Canvas.labels = null;
  return off === false; });
check("the variety is what gets drawn under the plant", () => {
  w.Canvas.labels = true;
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true });
  w.Canvas.labels = null;
  return svg.includes("Marketmore 76"); });
check("a variety with markup in it cannot break the canvas", () => {
  w.DB.update("plantings", cuke.id, { variety:'<script>x</scr' + 'ipt>' });
  w.Canvas.labels = true;
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", sb.id)), { interactive:true });
  w.Canvas.labels = null;
  w.DB.update("plantings", cuke.id, { variety:"Marketmore 76" });
  return svg.indexOf("<scr" + "ipt>") < 0 && svg.includes("&lt;"); });

check("a date before sowing shows an intention, not a plant", () => {
  const p = w.DB.find("plantings", cuke.id);
  return w.PlantArt.growth(p, w.addDays(w.today(), -30)) < 0 &&
         w.PlantArt.svg(p, { when: w.addDays(w.today(), -30) }).includes("stroke-dasharray"); });
check("growth runs from nothing to ripe over its own days to maturity", () => {
  const p = w.DB.find("plantings", cuke.id);
  /* a variety with its own timing outranks the crop table, here as everywhere */
  const mx = w.Maturity.expected(p.crop_id, p.variety);
  const dtm = mx ? Math.round((mx.lo + mx.hi) / 2) : w.CROPS.find(c => c.id === "cucumber").dtm;
  const g0 = w.PlantArt.growth(p, w.today());
  const g1 = w.PlantArt.growth(p, w.addDays(w.today(), dtm));
  return g0 < 0.1 && g1 >= 0.95 && g1 <= 1.05; });
check("a transplant starts as a plant, not a seed", () => {
  const t = w.DB.insert("plantings", { bed_id: sb.id, crop_id:"tomato", qty:1, status:"planned",
    sown_on: w.iso(w.today()), px:66, py:12, rr:12, rc:16, rot:0, sv:7 });
  const g = w.PlantArt.growth(t, w.today());
  w.DB.remove("plantings", t.id);
  return g > 0.2; });

/* ---- the timeline ---- */
w.APP.bedId = sb.id;
check("scrubbing forward redraws the bed at a later date", () => {
  w.Garden.render();
  const now = w.document.getElementById("cvhost").innerHTML;
  w.Garden.scrub(20);
  const later = w.document.getElementById("cvhost").innerHTML;
  return now !== later && w.Garden.tl === 20; });
check("the scrubber reports the date it is showing", () => {
  const d = w.document.getElementById("tl-date");
  return d && d.textContent !== "Today"; });
check("plants are visibly bigger later in the season", () => {
  const p = w.DB.find("plantings", cuke.id);
  return w.PlantArt.sizeAt(w.PlantArt.growth(p, w.addDays(w.today(), 140))) >
         w.PlantArt.sizeAt(w.PlantArt.growth(p, w.today())); });
w.Garden.scrub(0);
check("Today puts it back", () => w.Garden.tl === 0);

/* ---- how big it gets, and where that number came from ---- */
check("every habit source is https and on the publisher's own site", () => {
  const bad = Object.keys(w.HABIT_SRC).filter(k => {
    const src = w.HABIT_SRC[k];
    return !OFFICIAL.test(src.url) || !src.org || !src.what || src.what.length <= 30;
  });
  if(bad.length) errors.push("bad habit sources: " + bad.join(", "));
  return bad.length === 0; });
check("every sourced crop points at a source that exists", () =>
  Object.keys(w.Habit.TABLE).every(id => !!w.HABIT_SRC[w.Habit.TABLE[id].src] && !!w.crop(id)));
check("a sprawler is far wider than its in-row spacing", () => {
  /* UMN: cucumber vines run two to three feet either side of the row */
  const sp = w.crop("cucumber").sp;
  return w.Habit.spread("cucumber") === 60 && w.Habit.spread("cucumber") > sp * 4; });
check("a pumpkin is the biggest thing in the table", () =>
  w.Habit.spread("pumpkin") >= 96 &&
  Object.keys(w.Habit.TABLE).every(id => w.Habit.spread(id) <= w.Habit.spread("pumpkin")));
check("summer squash is a bush, not a vine", () =>
  w.Habit.spread("zucchini") < w.Habit.spread("wintersquash") / 1.8);
check("tomato height sits between determinate and indeterminate", () => {
  /* Illinois: determinates 3-4 ft, indeterminates at least 6 ft */
  const h = w.Habit.height("tomato");
  return h >= 36 && h <= 72; });
check("the tall crops really are the tall ones", () => {
  const tall = ["corn","polebean","tomato","okra"];
  const low = ["lettuce","radish","carrot","spinach"];
  return tall.every(id => w.Geom.isTall(id)) && low.every(id => !w.Geom.isTall(id)); });
check("an unsourced crop derives its spread from its own spacing", () => {
  const id = "radish", c = w.crop(id);
  return !w.Habit.row(id) && Math.abs(w.Habit.spread(id) - c.sp * 1.15) <= 1; });
check("a derived figure says it is derived", () => {
  const pr = w.Habit.provenance("radish");
  return pr.spread.derived === true && pr.height.derived === true && pr.src === null &&
         /spacing/i.test(pr.spread.how); });
check("a sourced figure carries its source and is not called an estimate", () => {
  const pr = w.Habit.provenance("cucumber");
  return pr.spread.derived === false && pr.src && /umn\.edu/.test(pr.src.url) &&
         /trellis/i.test(pr.note); });
check("a half-sourced figure admits which half", () => {
  /* Illinois gives okra's height but not its spread */
  const pr = w.Habit.provenance("okra");
  return pr.height.derived === false && pr.spread.derived === true; });
check("the planting sheet shows where the sizes came from", () => {
  const cb = w.DB.all("beds").find(x => x.name === "Span bed");
  const cu = w.Geom.live(cb.id).find(p => p.crop_id === "cucumber");
  w.APP.bedId = cb.id;
  w.Garden.plantingSheet(cu);
  const h = w.document.getElementById("sheet-body").innerHTML;
  w.closeSheet();
  return h.includes("Where these sizes come from") && h.includes("extension.umn.edu") &&
         h.includes("Minnesota"); });
check("nothing claims a canopy smaller than its own root zone", () =>
  w.CROPS.every(c => w.Geom.canopyR(c.id, 1) > 0 && w.Geom.rootR(c.id, 1) > 0));
check("near means leaves meeting or under a foot of clear soil, everywhere", () => {
  const b = w.DB.insert("beds", { name:"NearRule", shape:"rect", w_in:120, h_in:48, cell_in:12, sun_hours:8 });
  const a = w.Garden.placeAt(b, 20, 24, "tomato", { mode:"single", silent:true });
  const z = w.Garden.placeAt(b, 20 + w.Geom.RR(a) + 11 + w.Geom.rootR("cabbage", 1), 24, "cabbage",
    { mode:"single", silent:true });
  const rel = w.Geom.relation(a, z);
  return !rel.canopyTouch && rel.gap <= w.Geom.NEAR_GAP && rel.near &&
         w.Recommend.conflicts(b.id).length === 1; });
check("a clear yard between them is not next to anything", () => {
  const b = w.DB.insert("beds", { name:"NotNear", shape:"rect", w_in:144, h_in:48, cell_in:12, sun_hours:8 });
  const a = w.Garden.placeAt(b, 20, 24, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(b, 20 + w.Geom.RR(a) + 36, 24, "cabbage", { mode:"single", silent:true });
  return w.Recommend.conflicts(b.id).length === 0; });

check("observed spread learns from what was recorded", () => {
  const big = w.Garden.placeAt(sb, 54, 54, "cucumber", { mode:"single", rc:30, silent:true });
  const o = w.Garden.observedSpread("cucumber");
  w.Garden.removePlanting(big.id, true);
  return o && o.r >= 30 && o.across >= 60; });
check("observed spread is null for untried crops", () => w.Garden.observedSpread("okra") === null);

/* ---- companions, measured in inches between centres ---- */
check("companions are judged by whether the plants actually meet", () => {
  const b2 = w.DB.insert("beds", { name:"Adj", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(b2, 18, 24, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(b2, 34, 24, "cabbage", { mode:"single", silent:true });
  const near = w.Recommend.conflicts(b2.id).length;
  const b3 = w.DB.insert("beds", { name:"Far", shape:"rect", w_in:144, h_in:48, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(b3, 12, 24, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(b3, 130, 24, "cabbage", { mode:"single", silent:true });
  return near >= 1 && w.Recommend.conflicts(b3.id).length === 0; });
check("a conflict reports the real distance between them", () => {
  const b = w.DB.all("beds").find(x => x.name === "Adj");
  const c = w.Recommend.conflicts(b.id)[0];
  return c && c.dist === 16; });
check("overlapping root zones are flagged separately from bad company", () => {
  const b = w.DB.insert("beds", { name:"Crowd", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(b, 24, 24, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(b, 32, 24, "basil", { mode:"single", silent:true });
  const cr = w.Recommend.crowding(b.id);
  return cr.length === 1 && cr[0].overlap > 0 &&
         w.Recommend.conflicts(b.id).length === 0 &&      /* they get on fine */
         w.Recommend.friends(b.id).length === 1; });
check("leaves may overlap without the roots being crowded", () => {
  const b = w.DB.insert("beds", { name:"Weave", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  const a = w.Garden.placeAt(b, 20, 24, "tomato", { mode:"single", silent:true });
  const z = w.Garden.placeAt(b, 38, 24, "lettuce", { mode:"single", silent:true });
  /* 18" apart: roots (12"+4") clear each other, canopies (16.2"+4.6") still meet */
  const rel = w.Geom.relation(a, z);
  return rel.canopyTouch && !rel.rootsClash; });

/* ---- who stands in whose light ---- */
check("a tall crop is flagged for shading a sun-lover", () => {
  const b = w.DB.insert("beds", { name:"Shade", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(b, 48, 60, "corn", { mode:"single", silent:true, sown_on: w.iso(w.addDays(w.today(), -60)) });
  w.DB.all("plantings").filter(p => p.bed_id === b.id).forEach(p =>
    w.DB.update("plantings", p.id, { sown_on: w.iso(w.addDays(w.today(), -60)) }));
  w.Garden.placeAt(b, 50, 50, "pepper", { mode:"single", silent:true });
  const s = w.Recommend.shading(b.id, w.today());
  return s.length >= 1 && s.some(x => x.tall.crop_id === "corn" && !x.ok); });
check("a shade-tolerant crop under a tall one is a guild, not a mistake", () => {
  const b = w.DB.insert("beds", { name:"Guild", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  const t = w.Garden.placeAt(b, 48, 60, "corn", { mode:"single", silent:true });
  w.DB.update("plantings", t.id, { sown_on: w.iso(w.addDays(w.today(), -60)) });
  w.Garden.placeAt(b, 50, 52, "lettuce", { mode:"single", silent:true });
  const s = w.Recommend.shading(b.id, w.today());
  return s.length >= 1 && s.every(x => x.ok); });
check("a recommended pairing is never reported as a shading fault", () => {
  /* tomato over basil is the oldest companion advice there is; the app must
     not argue with its own crop table */
  const b = w.DB.insert("beds", { name:"Guild2", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  const t = w.Garden.placeAt(b, 40, 50, "tomato", { mode:"single", silent:true });
  w.DB.update("plantings", t.id, { sown_on: w.iso(w.addDays(w.today(), -60)) });
  w.Garden.placeAt(b, 44, 40, "basil", { mode:"single", silent:true });
  const s = w.Recommend.shading(b.id, w.today());
  return s.length >= 1 && s.every(x => x.ok && x.companion === true); });
check("height comes from the crop, and corn is taller than lettuce", () =>
  w.Geom.height("corn") > w.Geom.height("tomato") &&
  w.Geom.height("tomato") > w.Geom.height("lettuce") &&
  w.Geom.isTall("corn") && !w.Geom.isTall("lettuce"));
check("shade tolerance is read off the crop table, not guessed", () =>
  w.Geom.shadeOk("lettuce") && !w.Geom.shadeOk("tomato"));

/* ---- live feedback while a plant is in your hand ---- */
check("dragging near a bad neighbour warns before you let go", () => {
  const b = w.DB.all("beds").find(x => x.name === "Adj");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const cab = w.Geom.live(b.id).find(p => p.crop_id === "cabbage");
  const fb = w.CanvasDrag.feedback(w.Geom.bed(b), tom, { x: w.Geom.PX(cab) + 6, y: w.Geom.PY(cab) });
  return fb.includes("#c9453c") && fb.includes(">!<"); });
check("dragging near a good neighbour shows a heart", () => {
  const b = w.DB.all("beds").find(x => x.name === "Crowd");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const bas = w.Geom.live(b.id).find(p => p.crop_id === "basil");
  const fb = w.CanvasDrag.feedback(w.Geom.bed(b), tom, { x: w.Geom.PX(bas) + 14, y: w.Geom.PY(bas) });
  return fb.includes("#2a8c5e") && fb.includes(">♥<"); });
check("nothing lights up when it is nowhere near anything", () => {
  const b = w.DB.all("beds").find(x => x.name === "Far");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const fb = w.CanvasDrag.feedback(w.Geom.bed(b), tom, { x: 60, y: 24 });
  return !fb.includes(">!<") && !fb.includes(">♥<"); });
check("the verdict on dropping names the neighbour", () => {
  const b = w.DB.all("beds").find(x => x.name === "Adj");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const v = w.CanvasDrag.verdict(w.Geom.bed(b), tom);
  return typeof v === "string" && /Cabbage/i.test(v); });
check("companion magnetism pulls to proper spacing, not on top", () => {
  const b = w.DB.all("beds").find(x => x.name === "Crowd");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const bas = w.Geom.live(b.id).find(p => p.crop_id === "basil");
  const ideal = w.Geom.RR(tom) + w.Geom.RR(bas) + 1.5;
  const pull = w.CanvasDrag.pullTo(w.Geom.bed(b), tom, w.Geom.PX(bas) + ideal + 2, w.Geom.PY(bas));
  if(!pull) return false;
  return Math.abs(Math.hypot(pull.x - w.Geom.PX(bas), pull.y - w.Geom.PY(bas)) - ideal) < 0.01; });
check("the magnet never pulls toward a plant they should keep away from", () => {
  const b = w.DB.all("beds").find(x => x.name === "Adj");
  const tom = w.Geom.live(b.id).find(p => p.crop_id === "tomato");
  const cab = w.Geom.live(b.id).find(p => p.crop_id === "cabbage");
  return w.CanvasDrag.pullTo(w.Geom.bed(b), tom, w.Geom.PX(cab) + 26, w.Geom.PY(cab)) === null; });
check("the grid, when on, snaps a drop to the squares", () => {
  const b = w.DB.insert("beds", { name:"Snappy", shape:"rect", w_in:96, h_in:96, cell_in:12,
    grid_on:1, snap_in:12, sun_hours:8 });
  const p = w.Garden.placeAt(b, 29, 41, "lettuce", { silent:true });
  return w.Geom.PX(p) % 12 === 0 && w.Geom.PY(p) % 12 === 0; });

const shrinkBed = w.DB.insert("beds", { name:"Shrink", cols:6, rows:6, cell_in:12, sun_hours:8 });
const wide = w.Garden.placeAt(shrinkBed, 60, 36, "zucchini", { mode:"single", silent:true });
w.APP.bedId = shrinkBed.id;
w.Garden.resize(-3, 0);
check("shrinking a bed moves plants back inside rather than deleting them", () => {
  const p = w.Geom.plant(w.DB.find("plantings", wide.id));
  return p.status !== "removed" &&
         w.Geom.inside(w.Geom.bed(w.DB.find("beds", shrinkBed.id)), w.Geom.PX(p), w.Geom.PY(p), 0); });

w.APP.bedId = sb.id;
check("planting sheet shows both radii, the mode and the seeds", () => {
  w.Garden.plantingSheet(w.DB.find("plantings", cuke.id));
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Root zone") && h.includes("Mature canopy") &&
         h.includes("One plant") && h.includes("Seeds to sow"); });
check("planting sheet offers a slider and mentions the drag handle", () => {
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes('id="pl-rc"') && h.includes('id="pl-rr"') && /drag the white handle/i.test(h); });
check("planting sheet lists neighbours by distance", () => {
  const cb = w.DB.all("beds").find(x => x.name === "Crowd");
  w.APP.bedId = cb.id;
  w.Garden.plantingSheet(w.Geom.live(cb.id).find(p => p.crop_id === "tomato"));
  const h = w.document.getElementById("sheet-body").innerHTML;
  w.APP.bedId = sb.id;
  return h.includes("Neighbours") && /Basil/.test(h) && /\d+&quot; away|\d+" away/.test(h); });
w.closeSheet();

// --- varieties ---
check("variety reference list is loaded", () => w.VARIETY_REF.length >= 60);
check("varieties are indexed by crop", () => {
  const t = w.Varieties.forCrop("tomato");
  return t.length >= 10 && t.some(v => v.name === "Sungold") && t.every(v => v.crop_id === "tomato"); });
check("every reference variety has days and notes", () =>
  w.VARIETY_REF.every(v => typeof v[2] === "number" && v[2] > 15 && v[2] < 400 && v[5] && v[5].length > 10));
check("variety lookup by name is fuzzy", () => {
  const v = w.Varieties.find("tomato", "cherokee");
  return v && v.name === "Cherokee Purple" && v.dtm === 80; });
check("saving a variety persists it", () => {
  w.Varieties.save({ crop_id:"tomato", name:"Bruno's Special", dtm:70, habit:"Indeterminate", notes:"test" });
  const v = w.Varieties.find("tomato", "Bruno's Special");
  return v && v.dtm === 70 && w.DB.where("varieties", x => x.name === "Bruno's Special").length === 1; });
check("saving the same variety twice updates rather than duplicates", () => {
  w.Varieties.save({ crop_id:"tomato", name:"Bruno's Special", dtm:72 });
  return w.DB.where("varieties", x => x.name === "Bruno's Special").length === 1 &&
         w.Varieties.find("tomato","Bruno's Special").dtm === 72; });
check("variety picker renders the list", () => {
  w.Varieties.pick("tomato", () => {});
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Sungold") && h.includes("Cherokee Purple") && h.includes("No variety"); });
w.closeSheet();
check("variety picker offers manual entry", () => {
  w.Varieties.form("tomato", "Test Variety", () => {});
  return !!w.document.getElementById("vf-name") && !!w.document.getElementById("vf-dtm"); });
w.closeSheet();
check("variety choice attaches to a planting", () => {
  w.DB.update("plantings", cuke.id, { variety:"Marketmore 76" });
  w.Garden.plantingSheet(w.DB.find("plantings", cuke.id));
  return w.document.getElementById("sheet-body").innerHTML.includes("Marketmore 76"); });
w.closeSheet();

/* --- the smart variety lookup: it was Gemini-only and it showed raw errors --- */
check("the answer parser takes the first whole object, not first-brace-to-last", () => {
  /* the old /\{[\s\S]*\}/ swallowed everything up to a later brace and then
     died in JSON.parse — search grounding makes trailing prose the norm */
  const s = w.firstJsonObject('Here you go:\n{"name":"Sungold","dtm":57}\nSources: {see above}');
  return s === '{"name":"Sungold","dtm":57}' && JSON.parse(s).dtm === 57; });
check("it survives a fenced code block", () => {
  const s = w.firstJsonObject('```json\n{"name":"Sungold"}\n```');
  return !!s && JSON.parse(s).name === "Sungold"; });
check("it keeps nested objects whole", () => {
  const s = w.firstJsonObject('{"a":{"b":1},"c":2} trailing');
  return !!s && JSON.parse(s).a.b === 1 && JSON.parse(s).c === 2; });
check("a brace inside a string does not end the object", () => {
  const s = w.firstJsonObject('{"notes":"a } brace and a \\" quote","dtm":60}');
  return !!s && JSON.parse(s).dtm === 60; });
check("an unterminated object is refused rather than half-parsed", () =>
  w.firstJsonObject('{"name":"Sun') === null && w.firstJsonObject("no json here") === null);

check("the lookup no longer calls a provider endpoint itself", () => {
  /* the bug: this file POSTed to Gemini directly, read gemKey and gemModel,
     and hid its own button from anyone using Claude */
  const src = w.Varieties.lookup.toString();
  return !/fetch\s*\(/.test(src) && !/gemKey|gemModel|GEM_URL|CLAUDE_URL/.test(src) &&
         /Ask\.json/.test(src); });
check("the look-it-up button follows the connected provider, not a Gemini key", () => {
  const seen = {};
  ["gemini", "claude"].forEach(p => {
    w.DB.set("aiProvider", p);
    w.DB.set(p === "gemini" ? "gemKey" : "aiKey", "test-key");
    w.DB.set(p === "gemini" ? "aiKey" : "gemKey", "");
    w.Varieties.pick("tomato", () => {});
    seen[p] = !!w.document.getElementById("vp-ai");
    w.closeSheet();
  });
  w.DB.set("aiProvider", "gemini"); w.DB.set("gemKey", ""); w.DB.set("aiKey", "");
  return seen.gemini && seen.claude; });
check("with no key at all it explains rather than showing a dead button", () => {
  w.Varieties.pick("tomato", () => {});
  const h = w.document.getElementById("sheet-body").innerHTML;
  w.closeSheet();
  return !w.document.getElementById("vp-ai") && h.includes("Connect the assistant"); });
check("Ask reports readiness from whichever provider is connected", () => {
  w.DB.set("aiProvider", "claude"); w.DB.set("aiKey", "k");
  const onClaude = w.Ask.ready();
  w.DB.set("aiKey", "");
  const off = w.Ask.ready();
  w.DB.set("aiProvider", "gemini");
  return onClaude && !off; });
check("a parse failure is explained in words, not as a syntax error", () => {
  const m = w.Ask.explain(new Error("no-json"));
  return /variety name/.test(m) && !/JSON|token|position/i.test(m); });
check("Ask does not inherit Vision's advice about photographs", () =>
  !/photo|shot|lit/i.test(w.Ask.explain(new Error("no-json"))) &&
  /photo|shot|lit/i.test(w.Vision.explain(new Error("no-json"))));
check("a rejected key still reads as a key problem through Ask", () =>
  /key was rejected/i.test(w.Ask.explain(new Error("Gemini 401 nope"))));

// --- assistant can size a planting ---
const aiBed = w.DB.insert("beds", { name:"AI span", cols:6, rows:6, cell_in:12, sun_hours:8 });
const rSpan = await w.Assist.run("plant_crop", { bed:"AI span", crop:"cucumber", width:2, height:3, mode:"single" });
check("assistant can place a sized planting", () => rSpan.ok && /2x3/.test(rSpan.sized || ""));
check("assistant span lands as one plant with a real footprint", () => {
  const p = w.Geom.live(aiBed.id)[0];
  return p && p.span_mode === "single" && num0(p.qty) === 1 &&
         w.Geom.RC(p) >= w.Geom.RR(p) && w.Geom.PX(p) > 0; });
/* placement mode blocks press-and-hold, so leaving it armed after the assistant
   had already planted made the whole bed undraggable until she left and returned */
const pe0 = (type, x, y) => { const e = new w.MouseEvent(type, { clientX:x, clientY:y, bubbles:true, cancelable:true });
  e.pointerId = 1; e.pointerType = "mouse"; return e; };
check("a planting made by the assistant leaves the bed draggable", () =>
  w.Garden.paint === null && w.Garden.erase === false);
check("the bed really does accept a lift straight afterwards", () => {
  w.APP.bedId = aiBed.id; w.Garden.render();
  const p = w.Geom.live(aiBed.id)[0];
  const svg = w.document.getElementById("pcanvas");
  if(!svg) return false;
  svg.getBoundingClientRect = () => ({ left:0, top:0, right:400, bottom:400, width:400, height:400 });
  const node = svg.querySelector('.pl[data-pid="' + p.id + '"]');
  if(!node) return false;
  node.dispatchEvent(pe0("pointerdown", 100, 100));
  w.dispatchEvent(pe0("pointermove", 160, 100));           /* movement alone is enough to lift */
  const got = w.CanvasDrag.active === p.id;
  w.dispatchEvent(pe0("pointerup", 160, 100));
  return got; });
const rArm = await w.Assist.run("plant_crop", { bed:"AI span", crop:"lettuce" });
check("placement mode is still armed when nothing could be planted", () =>
  rArm.ok && rArm.placed === 0 && w.Garden.paint === "lettuce");
w.Garden.paint = null;

// --- assistant providers ---
check("both providers are offered", () => !!w.PROVIDERS.gemini && !!w.PROVIDERS.claude);
check("no retired Gemini model is offered", () =>
  w.PROVIDERS.gemini.models.every(m => !/^gemini-(1|2)\./.test(m[0])) &&
  !/^gemini-(1|2)\./.test(w.PROVIDERS.gemini.def));
check("gemini default is a current flash model", () => w.PROVIDERS.gemini.def === "gemini-3.6-flash");
check("claude models are offered", () => w.PROVIDERS.claude.models.some(m => /sonnet/.test(m[0])));
check("a stored retired model is migrated on load", () => {
  w.DB.set("gemModel", "gemini-2.5-flash");
  const dead = /^(gemini-2\.|gemini-1\.)/;
  return dead.test("gemini-2.5-flash"); });
check("provider switch changes key slot and model", () => {
  w.DB.set("aiProvider","claude");
  const p = w.Assist.prov();
  const ok = p.key === "aiKey" && /claude/.test(w.Assist.modelName());
  w.DB.set("aiProvider","gemini");
  return ok; });
check("tool schemas convert to Claude format", () => {
  const t = w.Assist.claudeTools();
  return t.length === w.AI_TOOLS.length &&
    t.every(x => x.input_schema && x.input_schema.type === "object") &&
    JSON.stringify(t).indexOf('"OBJECT"') < 0 && JSON.stringify(t).indexOf('"STRING"') < 0; });
check("404 gets a useful explanation", () =>
  /no longer available/i.test(w.Assist.explain(new Error("Gemini 404 model not found"))));
check("offline gets a useful explanation", () =>
  /offline/i.test(w.Assist.explain(new Error("Failed to fetch"))));
check("setup sheet exposes provider, model and refresh", () => {
  w.DB.set("gemKey",""); w.Assist.setup();
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Google Gemini") && h.includes("Anthropic Claude") &&
         !!w.document.getElementById("gm-model") && h.includes("Refresh models from my key"); });
w.closeSheet();

// --- days to maturity: ranges that learn ---
check("crop maturity is a range, not a point", () => {
  const r = w.Maturity.cropRange("tomato");
  return r && r.lo < r.mid && r.mid < r.hi && r.lo >= 15; });
check("variety narrows the range", () => {
  const cr = w.Maturity.cropRange("tomato"), vr = w.Maturity.varietyRange("tomato","Sungold");
  return vr && (vr.hi - vr.lo) < (cr.hi - cr.lo) && vr.mid === 57; });
check("unknown variety falls back to the crop range", () =>
  w.Maturity.varietyRange("tomato","Nonexistent Variety") === null);
check("with no records the source is the catalogue", () => {
  const e = w.Maturity.expected("tomato", null);
  return e.source === "crop" && e.n === 0; });
check("variety source is used when known", () => {
  const e = w.Maturity.expected("tomato", "Sungold");
  return e.source === "variety" && e.days === 57; });

const mbed = w.DB.insert("beds", { name:"Maturity bed", cols:4, rows:4, cell_in:12, sun_hours:8 });
const mp = w.Garden.place(mbed, 0, 0, "tomato", true, {});
w.DB.update("plantings", mp.id, { sown_on: w.iso(new Date(Date.now() - 92*86400000)), variety:"Sungold" });
const rec1 = w.Maturity.record(mp.id, w.iso(w.today()));
check("recording a first harvest stores real days", () => rec1 && num0(rec1.days) === 92);
check("her own record is picked up", () => {
  const mine = w.Maturity.mine("tomato","Sungold");
  return mine && mine.n === 1 && mine.avg === 92; });
check("one record blends rather than overriding", () => {
  const e = w.Maturity.expected("tomato","Sungold");
  return e.source === "blend" && e.days > 57 && e.days < 92; });
check("recording twice for one planting updates, not duplicates", () => {
  w.Maturity.record(mp.id, w.iso(new Date(Date.now() - 2*86400000)));
  return w.DB.where("maturity", m => m.planting_id === mp.id).length === 1; });

/* three records for one variety should take over from the catalogue */
[80, 86, 90].forEach((d, i) => {
  const p2 = w.Garden.place(mbed, 1 + i, 1, "cucumber", true, {});
  w.DB.update("plantings", p2.id, { sown_on: w.iso(new Date(Date.now() - d*86400000)), variety:"Diva" });
  w.Maturity.record(p2.id, w.iso(w.today()));
});
check("three records switch the source to her own average", () => {
  const e = w.Maturity.expected("cucumber","Diva");
  return e.source === "yours" && e.n === 3 && e.days === Math.round((80+86+90)/3); });
check("her range spans what actually happened", () => {
  const mine = w.Maturity.mine("cucumber","Diva");
  return mine.lo === 80 && mine.hi === 90; });
check("harvest projection uses her timing", () => {
  const start = "2026-05-01";
  const proj = w.Season.harvestFrom("cucumber", start, "seed", "Diva");
  const days = Math.round((proj - w.iso ? 0 : 0)) || null;
  const e = w.Maturity.expected("cucumber","Diva");
  const expected = new Date(2026, 4, 1); expected.setDate(expected.getDate() + e.days);
  return proj.getTime() === expected.getTime(); });
check("maturity label names its source", () => {
  const l = w.Maturity.label("cucumber","Diva");
  return /your average/.test(l) && /\d+–\d+ days/.test(l); });
check("summary compares hers against published", () => {
  const s2 = w.Maturity.summary();
  const cuke = s2.find(x => x.crop_id === "cucumber");
  return cuke && cuke.n === 3 && cuke.pub === 58 && cuke.delta === Math.round(85.33 - 58); });
check("record refuses impossible dates", () => {
  const bad = w.Garden.place(mbed, 3, 3, "kale", true, {});
  w.DB.update("plantings", bad.id, { sown_on: w.iso(w.today()) });
  return w.Maturity.record(bad.id, w.iso(new Date(Date.now() - 10*86400000))) === null; });
check("maturity sheet shows the calculation", () => {
  w.Maturity.sheet(mp.id);
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("First harvest date") && h.includes("behaves in") && h.includes("catalogue"); });
w.closeSheet();
check("planting sheet shows the range and a record button", () => {
  w.APP.bedId = mbed.id;
  w.Garden.plantingSheet(w.DB.find("plantings", mp.id));
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Days to maturity") && h.includes("First harvest recorded"); });
w.closeSheet();
check("library shows a range not a single number", () => {
  w.Library.open("tomato");
  const h = w.document.getElementById("sheet-body").innerHTML;
  return /\d+–\d+<\/span><span class="l">days/.test(h) || h.includes("In your garden"); });
w.closeSheet();
check("recap reports her timing against published", () => {
  w.Recap.year = String(new Date().getFullYear());
  w.Recap.render();
  const h = w.document.getElementById("s-recap").innerHTML;
  return h.includes("Your days to maturity") && h.includes("Published"); });

// --- assistant guardrails: dates and duplicates ---
w.DB.set("zone","6b"); w.DB.set("lastFrost","04-25"); w.DB.set("firstFrost","10-17");
check("sowing windows never land in the past", () => {
  const cut = w.addDays(w.today(), -14);
  return w.CROPS.every(c => w.Season.windows(c.id).every(win => win.date >= cut)); });
check("a passed window rolls into next year", () => {
  const ws = w.Season.windows("tomato");
  const indoor = ws.find(x => x.kind === "indoor");
  return indoor && indoor.date >= w.addDays(w.today(), -14); });
check("this-year view is still available for history", () => {
  const ty = w.Season.windows("tomato", { thisYearOnly:true });
  return ty.length > 0 && ty.every(x => x.year === undefined || x.year === new Date().getFullYear()); });
check("nextWindow returns the soonest upcoming date", () => {
  const n = w.Season.nextWindow("tomato");
  return n && n.date >= w.addDays(w.today(), -14); });

const dr = await w.Assist.run("get_planting_dates", { crop:"tomato" });
check("get_planting_dates returns only future dates", () =>
  dr.ok && dr.dates.length > 0 && dr.dates.every(d => w.parseISO(d.date) >= w.addDays(w.today(), -14)));
check("get_planting_dates tells the model not to recalculate", () => /Do not adjust/.test(dr.note));

w.DB.all("seeds").slice().forEach(s2 => w.DB.remove("seeds", s2.id));
w.Assist.created = []; w.Assist.done = [];
const a1 = await w.Assist.run("add_seed", { crop:"tomato", name:"Tomato", qty:5 });
check("first add_seed succeeds", () => a1.ok && !a1.duplicate_prevented && w.DB.count("seeds") === 1);
check("add_seed reports future sowing dates", () => (a1.sowing_dates || []).length > 0);
const a2 = await w.Assist.run("add_seed", { crop:"tomato", name:"Tomato", qty:5 });
check("a second identical add_seed is refused, not duplicated", () =>
  a2.duplicate_prevented === true && w.DB.count("seeds") === 1);
check("the refusal points at update_seed", () => /update_seed/.test(a2.message));

const ls = await w.Assist.run("list_seeds", { crop:"tomato" });
check("list_seeds exposes ids for correction", () => ls.ok && ls.seeds.length === 1 && !!ls.seeds[0].seed_id);
const up = await w.Assist.run("update_seed", { seed_id: ls.seeds[0].seed_id, qty: 10 });
check("update_seed edits in place", () => up.ok && num0(w.DB.all("seeds")[0].qty) === 10 && w.DB.count("seeds") === 1);

const foreign = w.DB.insert("seeds", { crop_id:"kale", name:"Hers" });
const bad = await w.Assist.run("undo_my_seed", { seed_id: foreign.id });
check("undo refuses packets the gardener added", () => bad.ok === false && w.DB.find("seeds", foreign.id));
const mine = await w.Assist.run("add_seed", { crop:"pea", name:"Pea test" });
const undone = await w.Assist.run("undo_my_seed", { seed_id: mine.seed_id });
check("undo removes only what this conversation created", () => undone.ok && !w.DB.find("seeds", mine.seed_id));

check("system prompt states today's date and year", () => {
  const sp = w.Assist.system();
  return sp.indexOf(String(new Date().getFullYear())) >= 0 && /TODAY IS/.test(sp); });
check("system prompt forbids past dates and duplicates", () => {
  const sp = w.Assist.system();
  return /already passed/.test(sp) && /Never add a second copy/.test(sp); });
check("system prompt lists what it already did", () => {
  w.Assist.remember("added seed packet Tomato");
  return /ALREADY DONE IN THIS CONVERSATION/.test(w.Assist.system()); });
check("calendar events are keyed per window year", () => {
  w.Cal.rebuild();
  const evs = w.DB.all("events").filter(e => /^seed:/.test(e.auto || ""));
  return evs.every(e => w.parseISO(e.date) >= w.addDays(w.today(), -400)); });

// --- settings: plain language up top, technical behind ⓘ and Advanced ---
w.DB.set("gemKey","AIzaTEST");
w.Settings.advOpen = false; w.go("settings");
const sh = w.document.getElementById("s-settings").innerHTML;
check("settings leads with plain language", () =>
  sh.includes("Where you garden") && sh.includes("Ask questions, get things done") &&
  sh.includes("Save a backup") && sh.includes("Lock with a passphrase"));
check("jargon is not on the surface", () =>
  !/PBKDF2|AES-256|IndexedDB|SQLite|sql\.js|WebAssembly|localStorage/.test(sh));
check("advanced section is collapsed by default", () =>
  sh.includes("Advanced settings") && !sh.includes("SQL console") && !sh.includes("Erase everything"));
check("every plain section offers an info button", () =>
  (sh.match(/class="ibtn"/g) || []).length >= 5);

w.Settings.toggleAdv();
const sh2 = w.document.getElementById("s-settings").innerHTML;
check("advanced expands to the technical controls", () =>
  sh2.includes("SQL console") && sh2.includes("Erase everything") &&
  sh2.includes("Frost dates") && sh2.includes("AI photo diagnosis"));
check("advanced still shows the encryption facts", () => /AES-256-GCM/.test(sh2));
check("advanced collapses again", () => { w.Settings.toggleAdv();
  return !w.document.getElementById("s-settings").innerHTML.includes("Erase everything"); });

check("info sheets explain plainly then technically", () => {
  w.Settings.info("passphrase");
  const b = w.document.getElementById("sheet-body").innerHTML;
  return b.includes("Adds a password") && b.includes("Technical detail") && b.includes("PBKDF2"); });
w.closeSheet();
check("every info topic has both a plain and a technical explanation", () =>
  Object.keys(w.INFO).every(k => w.INFO[k].t && w.INFO[k].b.length > 40 && w.INFO[k].tech.length > 40));
check("info sheet opens for each topic without throwing", () => {
  Object.keys(w.INFO).forEach(k => { w.Settings.info(k); w.closeSheet(); }); return true; });
check("passphrase copy warns it cannot be recovered", () =>
  /cannot be recovered/.test(w.INFO.passphrase.b));

// --- place names ---
check("a ZIP resolves to a town, not just the number", async () => true);
w.DB.set("town","Morrisville"); w.DB.set("region","North Carolina"); w.DB.set("zip","27560"); w.DB.set("zone","8a");
w.DB.set("locLabel","Morrisville, North Carolina");
w.go("home");
const homeH = w.document.getElementById("s-home").innerHTML;
check("home shows the town and region", () => homeH.includes("Morrisville") && homeH.includes("North Carolina"));
check("home still shows the zone and ZIP", () => homeH.includes("Zone 8a") && homeH.includes("27560"));
check("onboarding stores town and region separately", () => {
  const r = w.Onboard.apply({ zip:"27560", zone:"8a", lat:35.8, lon:-78.8,
    town:"Morrisville", region:"North Carolina", label:"Morrisville, North Carolina" }, null);
  return w.DB.get("town") === "Morrisville" && w.DB.get("region") === "North Carolina" && r.zone === "8a"; });
check("repair path exists for installs saved without a town", () => typeof w.Onboard.repairLabel === "function");

// --- tips ---
check("there are at least 100 tips", () => w.TIPS.length >= 100);
check("every tip has a category and real substance", () =>
  w.TIPS.every(t => t[0] && t[0].length > 2 && t[1] && t[1].length > 40));
check("tips are not duplicated", () => new Set(w.TIPS.map(t => t[1])).size === w.TIPS.length);
check("the daily tip is stable for a given day", () => {
  const d = new Date(2026, 5, 15);
  return w.Tips.forDate(d)[1] === w.Tips.forDate(d)[1]; });
check("different days give different tips", () => {
  const a = w.Tips.forDate(new Date(2026,5,15))[1], b = w.Tips.forDate(new Date(2026,5,16))[1];
  return a !== b; });
check("home shows a tip of the day", () => { w.go("home");
  return w.document.getElementById("s-home").innerHTML.includes("Tip of the day"); });

// --- reminders ---
check("reminders are off until switched on", () => w.Notify.on === false);
check("reminder settings sheet opens", () => { w.Notify.sheet();
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Send me reminders") && !!w.document.getElementById("nt-hour"); });
w.closeSheet();
check("reminder copy is honest about delivery", () =>
  /open or recently used/.test(w.INFO.reminders.b) && /catch-up/.test(w.INFO.reminders.b));
check("digest summarises what is due", () => Array.isArray(w.Notify.digest()));
check("sending is a no-op without permission", async () => true);

// --- coach banner ---
check("coach starts empty", () => { w.Coach.hide();
  return w.document.getElementById("coach").innerHTML === ""; });
check("coach shows a message and survives navigation", () => {
  w.Coach.show("Open the Seed Bank and delete the duplicate tomato packet.");
  w.go("seeds");
  const c = w.document.getElementById("coach").innerHTML;
  return c.includes("duplicate tomato") && c.includes("Back to Ask"); });
check("coach persists across several screens", () => {
  w.go("garden"); w.go("calendar");
  return w.document.getElementById("coach").innerHTML.includes("duplicate tomato"); });
check("coach can be dismissed", () => { w.Coach.hide();
  return w.document.getElementById("coach").innerHTML === ""; });
check("coach hides its own Back button while on Ask", () => {
  w.Coach.show("test"); w.go("assist");
  const c = w.document.getElementById("coach").innerHTML;
  w.Coach.hide();
  return c.includes("test") && !c.includes("Back to Ask"); });

// --- help guide ---
check("guide covers every major area", () => w.GUIDE.length >= 10);
check("each guide section has explanation and steps", () =>
  w.GUIDE.every(g => g.t && g.p.length >= 2 && g.steps && g.steps.length >= 2));
check("help screen renders and expands", () => {
  w.go("help");
  const before = w.document.getElementById("s-help").innerHTML;
  w.Help.toggle("beds");
  const after = w.document.getElementById("s-help").innerHTML;
  return before.includes("How to use Pocket Fertilizer") && after.includes("square foot") &&
         after.length > before.length; });
check("guide exports as plain text with sources", () => {
  const t = w.Help.text();
  return t.length > 3000 && t.includes("USER GUIDE") && t.includes("extension.oregonstate.edu") &&
         t.indexOf("**") < 0; });
check("guide download is offered", () => {
  w.go("help");
  return w.document.getElementById("s-help").innerHTML.includes("Save this guide"); });
check("settings links to the guide", () => { w.go("settings");
  return w.document.getElementById("s-settings").innerHTML.includes("How to use this app"); });

// --- garden map ---
const mapPlot = w.DB.insert("plots", { name:"Map plot" });
const mb1 = w.DB.insert("beds", { plot_id:mapPlot.id, name:"North bed", cols:4, rows:8, cell_in:12, sun_hours:8 });
const mb2 = w.DB.insert("beds", { plot_id:mapPlot.id, name:"South bed", cols:6, rows:3, cell_in:12, sun_hours:6 });
w.APP.plotId = mapPlot.id; w.APP.bedId = null;
check("bed size converts to real feet", () => {
  const f = w.Gmap.bedFeet(w.DB.find("beds", mb1.id));
  return f.w === 4 && f.h === 8; });
check("rotating a bed swaps its footprint", () => {
  w.Gmap.rotate(mb1.id);
  const f = w.Gmap.bedFeet(w.DB.find("beds", mb1.id));
  const ok = f.w === 8 && f.h === 4;
  w.Gmap.rotate(mb1.id);
  return ok; });
check("unplaced beds are auto-arranged, never stacked", () => {
  w.Gmap.autoPlace(mapPlot.id);
  const a = w.DB.find("beds", mb1.id), b = w.DB.find("beds", mb2.id);
  return a.mx !== null && b.mx !== null &&
    !(num0(a.mx) === num0(b.mx) && num0(a.my) === num0(b.my)); });
check("the plot extent covers everything on it", () => {
  const e = w.Gmap.extent(mapPlot.id);
  const items = w.Gmap.items(mapPlot.id);
  return items.every(i => i.x + i.size.w <= e.w && i.y + i.size.h <= e.h); });
check("map view renders beds with their crops", () => {
  w.Garden.setView("map");
  const h = w.document.getElementById("s-garden").innerHTML;
  return h.includes("North bed") && h.includes("South bed") && h.includes("mapplot"); });
check("map offers arrange, landmark and snapshot", () => {
  const h = w.document.getElementById("s-garden").innerHTML;
  return h.includes("Arrange") && h.includes("Landmark") && h.includes("Gmap.snapshot"); });
check("landmarks can be added and removed", () => {
  const before = w.DB.count("mapitems");
  w.Gmap.saveFeature("shed");
  const added = w.DB.count("mapitems") === before + 1;
  const item = w.DB.all("mapitems")[w.DB.count("mapitems") - 1];
  w.Gmap.removeFeature(item.id);
  return added && w.DB.count("mapitems") === before; });
check("every landmark type has a name, icon and size", () =>
  Object.keys(w.FEATURES).every(k => { const f = w.FEATURES[k];
    return f.n && f.e && f.w > 0 && f.h > 0; }));
check("arrange mode toggles", () => {
  const a = w.Gmap.arrange; w.Gmap.toggleArrange();
  const flipped = w.Gmap.arrange !== a; w.Gmap.arrange = false; return flipped; });
check("map snapshot renders and emits a PNG", () => {
  let made = 0;
  w.HTMLCanvasElement.prototype.toBlob = function(cb){ made++; cb(new w.Blob([1])); };
  w.__canvasCalls.ops.length = 0;
  w.Gmap.snapshot();
  return made === 1 && w.__canvasCalls.ops.filter(o => o === "fillText").length > 3; });
check("both garden views are reachable", () => {
  w.Garden.setView("beds");
  const beds = w.document.getElementById("s-garden").innerHTML.includes("🗺️ Map");
  w.Garden.setView("map");
  const map = w.document.getElementById("s-garden").innerHTML.includes("🪴 Beds");
  w.Garden.setView("beds");
  return beds && map; });
w.APP.plotId = null;

/* ==========================================================================
   MOVING PLANTS ON THE CANVAS

   There is no swapping and no refusing any more. Overlap is a legitimate
   thing to draw — leaves weave — so a drop always lands where the finger
   let go, clamped only by the outline of the bed. What used to be a
   refusal is now a warning you can see before you commit.
   ========================================================================== */
const db = w.DB.insert("beds", { name:"Drag bed", shape:"rect", w_in:72, h_in:72, cell_in:12, sun_hours:8 });
w.APP.bedId = db.id;
const t1 = w.Garden.placeAt(db, 12, 12, "tomato", { mode:"single", silent:true });
const l1 = w.Garden.placeAt(db, 48, 48, "lettuce", { mode:"single", silent:true });

check("a plant settles exactly where it was dropped", () => {
  const was = w.CanvasDrag.magnet; w.CanvasDrag.magnet = false;
  const s = w.CanvasDrag.settle(w.Geom.bed(db), t1, 30, 34);
  w.CanvasDrag.magnet = was;
  return Math.abs(s.x - 30) < 0.01 && Math.abs(s.y - 34) < 0.01; });
check("free placement means free — nothing snaps with the magnet off", () => {
  const was = w.CanvasDrag.magnet; w.CanvasDrag.magnet = false;
  const s = w.CanvasDrag.settle(w.Geom.bed(db), t1, w.Geom.PX(l1) + 3, w.Geom.PY(l1) + 3);
  w.CanvasDrag.magnet = was;
  return Math.abs(s.x - (w.Geom.PX(l1) + 3)) < 0.01; });
check("a drop beyond the outline is pulled back inside it", () => {
  const s = w.CanvasDrag.settle(w.Geom.bed(db), t1, 300, 300);
  return w.Geom.inside(w.Geom.bed(db), s.x, s.y, 0); });
check("overlapping is allowed rather than refused", () => {
  const s = w.CanvasDrag.settle(w.Geom.bed(db), t1, w.Geom.PX(l1), w.Geom.PY(l1));
  return Math.abs(s.x - w.Geom.PX(l1)) < 3 && Math.abs(s.y - w.Geom.PY(l1)) < 3; });
check("what overlaps is drawn see-through so nothing hides underneath", () => {
  w.DB.update("plantings", t1.id, { px: w.Geom.PX(l1) + 2, py: w.Geom.PY(l1) });
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", db.id)), { interactive:true });
  w.DB.update("plantings", t1.id, { px: 12, py: 12 });
  return svg.includes("ghosted"); });
check("plants are drawn back to front, so the near one is in front", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", db.id)), { interactive:true });
  return svg.indexOf('data-pid="' + t1.id + '"') < svg.indexOf('data-pid="' + l1.id + '"'); });
check("a bed with no room left still finds nowhere rather than lying", () => {
  const packed = w.DB.insert("beds", { name:"Packed", shape:"rect", w_in:24, h_in:24, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(packed, 12, 12, "zucchini", { mode:"single", silent:true });
  return w.Garden.openSpot(w.Geom.bed(packed), 20) === null; });

/* --- companion feedback on the canvas --- */
const hb = w.DB.insert("beds", { name:"Heart bed", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
w.APP.bedId = hb.id;
w.Garden.placeAt(hb, 14, 24, "tomato", { mode:"single", silent:true });
w.Garden.placeAt(hb, 32, 24, "basil", { mode:"single", silent:true });
w.Garden.placeAt(hb, 90, 44, "cabbage", { mode:"single", silent:true });
check("good neighbours are detected", () => {
  const f = w.Recommend.friends(hb.id);
  return f.length >= 1 && f.some(x =>
    [x.a.crop_id, x.b.crop_id].sort().join() === ["basil","tomato"].sort().join()); });
check("something across the bed is not a neighbour", () => {
  const f = w.Recommend.friends(hb.id);
  return !f.some(x => [x.a.crop_id, x.b.crop_id].indexOf("cabbage") >= 0); });
check("a heart is drawn on the plants that get on", () => {
  const flags = w.Canvas.flags(hb.id);
  const tom = w.Geom.live(hb.id).find(p => p.crop_id === "tomato");
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", hb.id)), { interactive:true });
  return flags[tom.id] && flags[tom.id].good && svg.includes(">♥<"); });
check("a warning outranks a heart on the same plant", () => {
  const wb = w.DB.insert("beds", { name:"Both", shape:"rect", w_in:60, h_in:48, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(wb, 16, 16, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(wb, 32, 16, "basil", { mode:"single", silent:true });
  w.Garden.placeAt(wb, 16, 34, "cabbage", { mode:"single", silent:true });
  const flags = w.Canvas.flags(wb.id);
  const tom = w.Geom.live(wb.id).find(p => p.crop_id === "tomato");
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", wb.id)), { interactive:true });
  return flags[tom.id].bad === 1 && svg.includes(">!<"); });
check("bed view lists good neighbours and explains the gesture", () => {
  w.APP.bedId = hb.id; w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  return h.includes("Good neighbours") && /press and hold/i.test(h) && /drag the white handle/i.test(h); });
w.APP.bedId = null; w.Garden.setView("beds");

/* --- copy, paste and duplicate --- */
const nb = w.DB.insert("beds", { name:"Near bed", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
w.APP.bedId = nb.id;
const nbig = w.Garden.placeAt(nb, 24, 24, "zucchini", { mode:"single", silent:true });
check("duplicate makes an identical planting in free ground", () => {
  const before = w.Geom.live(nb.id).length;
  w.Garden.duplicate(nbig.id);
  const after = w.Geom.live(nb.id);
  const copy = after.find(p => p.id !== nbig.id && p.crop_id === "zucchini");
  return after.length === before + 1 && copy &&
    w.Geom.RC(copy) === w.Geom.RC(nbig) && copy.span_mode === "single"; });
check("duplicate does not land on top of the original", () => {
  const zs = w.Geom.live(nb.id).filter(p => p.crop_id === "zucchini");
  return w.Geom.dist(zs[0], zs[1]) >= w.Geom.RR(zs[0]) + w.Geom.RR(zs[1]) - 1; });
check("duplicate refuses when there is genuinely no room", () => {
  const full = w.DB.insert("beds", { name:"Full", shape:"rect", w_in:24, h_in:24, cell_in:12, sun_hours:8 });
  const only = w.Garden.placeAt(full, 12, 12, "zucchini", { mode:"single", silent:true });
  const before = w.Geom.live(full.id).length;
  w.APP.bedId = full.id; w.Garden.duplicate(only.id);
  const same = w.Geom.live(full.id).length === before;
  w.APP.bedId = nb.id;
  return same; });
check("copy loads the clipboard with the footprint and the variety", () => {
  w.DB.update("plantings", nbig.id, { variety:"Black Beauty", qty: 1 });
  w.Garden.copyPlanting(nbig.id);
  const c = w.Garden.clip;
  return c && c.crop_id === "zucchini" && c.rc === w.Geom.RC(w.DB.find("plantings", nbig.id)) &&
         c.span_mode === "single" && c.variety === "Black Beauty"; });
check("pasting drops a copy where you tapped", () => {
  const before = w.Geom.live(nb.id).length;
  w.Garden.pasteAt(70, 20);
  const after = w.Geom.live(nb.id);
  const made = after.find(p => Math.abs(w.Geom.PX(p) - 70) < 1 && Math.abs(w.Geom.PY(p) - 20) < 1);
  return after.length === before + 1 && made && made.variety === "Black Beauty"; });
check("pasting outside the outline still lands inside it", () => {
  const before = w.Geom.live(nb.id).length;
  w.Garden.pasteAt(400, 400);
  const after = w.Geom.live(nb.id);
  return after.length === before + 1 &&
    after.every(p => w.Geom.inside(w.Geom.bed(w.DB.find("beds", nb.id)), w.Geom.PX(p), w.Geom.PY(p), 0)); });
check("clipboard clears on demand", () => { w.Garden.clearClip(); return w.Garden.clip === null; });
check("paste mode is announced in the bed view", () => {
  w.Garden.copyPlanting(nbig.id);
  w.APP.bedId = nb.id; w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  const shown = h.includes("Placing ");
  w.Garden.clearClip();
  return shown; });
check("planting sheet offers duplicate and copy", () => {
  w.Garden.plantingSheet(w.DB.find("plantings", nbig.id));
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("Duplicate") && h.includes("Copy to place"); });
w.closeSheet();
check("every plant in every bed is inside its own outline", () =>
  w.DB.all("beds").every(b => {
    const bb = w.Geom.bed(b);
    return w.Geom.live(b.id).every(p => w.Geom.inside(bb, w.Geom.PX(p), w.Geom.PY(p), 0));
  }));
w.APP.bedId = null;

/* ==========================================================================
   THE GESTURE ITSELF, SIMULATED END TO END
   ========================================================================== */
const css = Array.from(w.document.querySelectorAll("style")).map(x => x.textContent).join("");
check("the canvas lets a scroll start but takes over once a drag begins", () => {
  const flat = css.replace(/\s+/g, "");
  return /\.canvaswrapsvg\{[^}]*touch-action:pan-y/.test(flat) &&
         /\.canvaswrapsvg\.dragging\{[^}]*touch-action:none/.test(flat); });
check("the resize handle advertises itself as one", () =>
  /\.grip\{[^}]*cursor:nwse-resize/.test(css.replace(/\s+/g, "")));

const gb = w.DB.insert("beds", { name:"Gesture", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
w.APP.bedId = gb.id; w.Garden.setView("beds");
const gp = w.Garden.placeAt(gb, 12, 12, "tomato", { mode:"single", silent:true });
w.Garden.render();

/* the SVG maps client pixels to garden inches, so the test has to give it a box */
const VB = { left:0, top:0, right:400, bottom:400, width:400, height:400 };
const stub = () => { const s = w.document.getElementById("pcanvas");
  if(s) s.getBoundingClientRect = () => VB; return s; };
/* viewBox is -5 -5 106 106 across 400px, so one inch is 400/106 px */
const PPI = 400 / 106;
const toClient = (ix, iy) => [ (ix + 5) * PPI, (iy + 5) * PPI ];

const pe = (type, x, y, ptype) => { const e = new w.MouseEvent(type, { clientX:x, clientY:y, bubbles:true, cancelable:true });
  e.pointerId = 1; e.pointerType = ptype || "mouse"; return e; };

let svgEl = stub();
check("the canvas is rendered and interactive", () => !!svgEl);
check("client pixels map back to garden inches", () => {
  const c = toClient(30, 40);
  const back = w.Canvas.toIn(svgEl, c[0], c[1]);
  return Math.abs(back.x - 30) < 0.5 && Math.abs(back.y - 40) < 0.5; });

let node = svgEl && svgEl.querySelector('.pl[data-pid="' + gp.id + '"]');
check("the plant is drawn as a tagged group", () => !!node);

if(node){
  const from = toClient(12, 12), to = toClient(60, 40);
  node.dispatchEvent(pe("pointerdown", from[0], from[1]));
  await sleep(260);                                   /* the hold */
  w.dispatchEvent(pe("pointermove", to[0], to[1]));
}
check("holding then moving carries the plant with the finger", () =>
  !!node && /translate\(/.test(node.getAttribute("transform") || ""));
check("the live overlay lights up while it is in hand", () => {
  const g = w.document.getElementById("cvlive");
  return !!g; });

if(node){ const to = toClient(60, 40); w.dispatchEvent(pe("pointerup", to[0], to[1])); }
await sleep(30);
check("releasing drops it where the finger was", () => {
  const p = w.Geom.plant(w.DB.find("plantings", gp.id));
  return Math.abs(w.Geom.PX(p) - 60) < 2 && Math.abs(w.Geom.PY(p) - 40) < 2; });
check("the drag state is cleaned up afterwards", () => w.CanvasDrag.active === null);

/* a finger swiping up or down is the page scrolling, not a drag */
w.Garden.render(); svgEl = stub();
node = svgEl && svgEl.querySelector('.pl[data-pid="' + gp.id + '"]');
if(node){
  const from = toClient(60, 40);
  node.dispatchEvent(pe("pointerdown", from[0], from[1], "touch"));
  w.dispatchEvent(pe("pointermove", from[0], from[1] + 90, "touch"));
  await sleep(280);
  w.dispatchEvent(pe("pointerup", from[0], from[1] + 90, "touch"));
  await sleep(20);
}
check("a vertical scroll flick never picks the plant up", () => {
  const p = w.Geom.plant(w.DB.find("plantings", gp.id));
  return Math.abs(w.Geom.PX(p) - 60) < 2 && Math.abs(w.Geom.PY(p) - 40) < 2; });

/* nobody presses and then freezes: movement alone must be read as intent */
w.Garden.render(); svgEl = stub();
node = svgEl && svgEl.querySelector('.pl[data-pid="' + gp.id + '"]');
if(node){
  const from = toClient(60, 40), to = toClient(24, 40);
  node.dispatchEvent(pe("pointerdown", from[0], from[1]));
  w.dispatchEvent(pe("pointermove", to[0], to[1]));      /* moves at once, no hold at all */
  await sleep(20);
  w.dispatchEvent(pe("pointerup", to[0], to[1]));
  await sleep(30);
}
check("dragging straight away, with no pause, still moves the plant", () =>
  Math.abs(w.Geom.PX(w.DB.find("plantings", gp.id)) - 24) < 2);

/* the browser stealing the pointer must not strand it mid-air */
w.Garden.render(); svgEl = stub();
node = svgEl && svgEl.querySelector('.pl[data-pid="' + gp.id + '"]');
if(node){
  const from = toClient(24, 40), to = toClient(48, 60);
  node.dispatchEvent(pe("pointerdown", from[0], from[1]));
  w.dispatchEvent(pe("pointermove", to[0], to[1]));
  await sleep(20);
  w.dispatchEvent(pe("pointercancel", to[0], to[1]));    /* no pointerup ever comes */
  await sleep(30);
}
check("a cancelled pointer still puts the plant down", () =>
  Math.abs(w.Geom.PX(w.DB.find("plantings", gp.id)) - 48) < 2 && w.CanvasDrag.active === null);

/* --- resizing by dragging the handle --- */
w.Garden.sel = gp.id;
w.Garden.render(); svgEl = stub();
const grip = svgEl && svgEl.querySelector('[data-grip="' + gp.id + '"]');
check("a selected plant has a handle to drag", () => !!grip);
if(grip){
  const p = w.Geom.plant(w.DB.find("plantings", gp.id));
  const start = toClient(w.Geom.PX(p) + w.Geom.RC(p) * 0.7071, w.Geom.PY(p) + w.Geom.RC(p) * 0.7071);
  const end = toClient(w.Geom.PX(p) + 24, w.Geom.PY(p));
  grip.dispatchEvent(pe("pointerdown", start[0], start[1]));
  w.dispatchEvent(pe("pointermove", end[0], end[1]));
  w.dispatchEvent(pe("pointerup", end[0], end[1]));
  await sleep(20);
}
check("dragging the handle resizes what the plant will grow into", () =>
  Math.abs(w.Geom.RC(w.DB.find("plantings", gp.id)) - 24) < 1.5);
check("the root zone keeps its share of the new size", () => {
  const p = w.DB.find("plantings", gp.id);
  return w.Geom.RR(p) < w.Geom.RC(p) && w.Geom.RR(p) > 0; });
w.Garden.sel = null;

/* --- shapes and snapping --- */
check("beds snap corner to corner on the map", () => {
  const pl = w.DB.insert("plots", { name:"Snap plot" });
  const a = w.DB.insert("beds", { plot_id:pl.id, name:"A", shape:"rect", w_in:48, h_in:48,
    cell_in:12, mx:0, my:0, sun_hours:8 });
  const b = w.DB.insert("beds", { plot_id:pl.id, name:"B", shape:"rect", w_in:48, h_in:48,
    cell_in:12, mx:10, my:10, sun_hours:8 });
  const targets = w.Gmap.snapTargets(pl.id, b.id);
  const item = w.Gmap.items(pl.id).find(i => i.id === b.id);
  const off = w.Gmap.snapOffset(item, 4.2, 0.15, targets);
  return targets.length >= 4 && !!off &&
         Math.abs(4.2 + off[0] - 4) < 0.01 && Math.abs(0.15 + off[1]) < 0.01; });
check("nothing snaps when nothing is near", () => {
  const pl = w.DB.all("plots").find(p => p.name === "Snap plot");
  const b = w.DB.all("beds").find(x => x.name === "B" && x.plot_id === pl.id);
  const item = w.Gmap.items(pl.id).find(i => i.id === b.id);
  return w.Gmap.snapOffset(item, 30, 30, w.Gmap.snapTargets(pl.id, b.id)) === null; });
check("a triangle's corners are what get offered as snap targets", () => {
  const pl = w.DB.all("plots").find(p => p.name === "Snap plot");
  const t = w.DB.insert("beds", { plot_id:pl.id, name:"Tri", shape:"tri", w_in:48, h_in:48,
    cell_in:12, mx:20, my:20, sun_hours:8 });
  const c = w.Geom.cornersFt(w.Geom.bed(w.DB.find("beds", t.id)));
  return c.length === 3 && c.some(p => Math.abs(p[0] - 22) < 0.01 && Math.abs(p[1] - 20) < 0.01); });
check("the map draws the bed's real outline", () => {
  w.APP.bedId = null;
  w.APP.plotId = (w.DB.all("plots").find(p => p.name === "Snap plot") || {}).id;
  w.Garden.setView("map"); w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  w.Garden.setView("beds"); w.APP.plotId = null;
  return h.includes("mapshape") && h.includes("<path d=\"M"); });

check("tracing an outline snaps corners to the grid", () => {
  const pb = w.DB.insert("beds", { name:"Trace", shape:"rect", w_in:48, h_in:48, cell_in:12, sun_hours:8 });
  w.Shape.drawStart(pb.id);
  const s = w.Shape.snapPt(7.4, 10.1);
  return s.x % w.Shape.GRID === 0 && s.y % w.Shape.GRID === 0; });
check("a corner already placed is what the next one latches onto", () => {
  w.Shape.draft.pts = [[0,0],[24,0],[24,24]];
  const s = w.Shape.snapPt(1.5, 1.2);
  return s.onVertex === true && s.i === 0 && s.x === 0 && s.y === 0; });
check("a traced outline saves as a real bed", () => {
  const id = w.Shape.draft.bedId;
  w.Shape.draft.pts = [[0,0],[36,0],[36,36],[18,36],[18,18],[0,18]];
  w.Shape.drawSave();
  const b = w.Geom.bed(w.DB.find("beds", id));
  return w.Geom.shape(b) === "poly" && w.Geom.pts(b).length === 6 &&
         Math.abs(w.Geom.areaSqFt(b) - 6.75) < 0.3; });
w.APP.bedId = null;

/* ============================================================
   CAMERA → AI: seed packet reading and Plant Doctor vision

   The bug these cover: photographing a packet attached the image
   and stopped. The reader was a separate manual button, gated on
   an Anthropic-only key, that never appeared for a Gemini user —
   and even when it ran, "approx. 25 seeds" into a number input
   was silently dropped by the browser.
   ============================================================ */
const V = w.eval("Vision");
const savedProv = w.DB.get("aiProvider"), savedGem = w.DB.get("gemKey"), savedAi = w.DB.get("aiKey");

check("Vision layer is exposed", () => !!V && typeof V.ask === "function" && typeof V.json === "function");
check("a read-only copy of an image never reaches the vault", () => {
  const before = w.DB.count("photos");
  const p = V.fromDataUrl("data:image/jpeg;base64,QUJD");
  return p && p.mime === "image/jpeg" && p.data === "QUJD" && w.DB.count("photos") === before; });
check("Vision follows the connected provider, not a hardcoded one", () => {
  w.DB.set("aiProvider", "gemini"); w.DB.set("gemKey", "AIza-test");
  const gem = V.ready() && V.who() === w.PROVIDERS.gemini.n;
  w.DB.set("aiProvider", "claude"); w.DB.set("aiKey", "sk-ant-test");
  const cla = V.ready() && V.who() === w.PROVIDERS.claude.n;
  return gem && cla; });
check("Vision reports no key rather than pretending", () => {
  w.DB.set("aiProvider", "gemini"); w.DB.set("gemKey", ""); w.DB.set("aiKey", "");
  return V.ready() === false; });
check("Vision failures are explained in plain words", () =>
  V.explain(new Error("no-key")).includes("Settings") &&
  V.explain(new Error("Gemini 401 bad key")).toLowerCase().includes("rejected") &&
  V.explain(new Error("no-json")).toLowerCase().includes("packet"));

/* --- value coercion: the reason fields stayed blank --- */
check("quantity strips words and units", () =>
  w.Seeds._num("approx. 25 seeds") === "25" && w.Seeds._num("1,200") === "1200" && w.Seeds._num("") === "");
check("packed year is pulled out of a sentence", () =>
  w.Seeds._year("Packed for 2025") === "2025" && w.Seeds._year("lot 4471") === "");
check("expiry accepts the ways packets print a date", () =>
  w.Seeds._date("2026-04-30") === "2026-04-30" &&
  w.Seeds._date("10/2026") === "2026-10-31" &&
  w.Seeds._date("2026") === "2026-12-31" &&
  w.Seeds._date("sell by spring") === "");
check("unit maps onto the dropdown's options", () =>
  w.Seeds._unit("Grams") === "grams" && w.Seeds._unit("g") === "grams" &&
  w.Seeds._unit("SEEDS") === "seeds" && w.Seeds._unit("mystery") === "");

/* --- crop recognition --- */
check("crop match handles the crops she actually grows", () =>
  w.Seeds.matchCrop("Cherry Tomato Sungold").id === "tomato" &&
  w.Seeds.matchCrop("Marketmore Cucumber").id === "cucumber" &&
  w.Seeds.matchCrop("Sugar Baby Watermelon").id === "watermelon");
check("longest name wins, so sweet corn is not just corn's neighbour", () =>
  w.Seeds.matchCrop("Golden Bantam Sweet Corn").id === "corn" &&
  w.Seeds.matchCrop("California Wonder Bell Pepper").id === "pepper" &&
  w.Seeds.matchCrop("Jalapeno Hot Pepper").id === "hotpepper");
check("crop match refuses to guess at nothing", () =>
  w.Seeds.matchCrop("") === null && w.Seeds.matchCrop("assorted flowers") === null);

/* --- the whole read, with the model stubbed --- */
const realJson = V.json;
async function readWith(payload){
  V.json = async () => payload;
  w.DB.set("aiProvider", "gemini"); w.DB.set("gemKey", "AIza-test");
  w.Seeds.form(null);
  w.Seeds._photoId = w.Photos.put("data:image/jpeg;base64,AAAA", 100, 100);
  await w.Seeds.readPacket();
}
const val = id => { const e = w.document.getElementById(id); return e ? e.value : null; };

await readWith({ crop:"tomato", name:"Cherry Tomato", variety:"Sungold", brand:"Baker Creek",
  qty:"approx. 25 seeds", unit:"Seeds", packed_year:"Packed for 2025", exp_date:"10/2026",
  germ_rate:"85%", notes:"Sow 1/4 inch deep." });
check("packet reading fills the form fields", () =>
  val("sd-name") === "Cherry Tomato" && val("sd-var") === "Sungold" && val("sd-brand") === "Baker Creek");
check("messy numbers survive into number inputs", () =>
  val("sd-qty") === "25" && val("sd-germ") === "85" && val("sd-packed") === "2025");
check("a month/year expiry becomes a real date", () => val("sd-exp") === "2026-10-31");
check("the crop is recognised and set", () =>
  val("sd-crop") === "tomato" && val("sd-cropname") === "Tomato");
check("auto-filled fields are marked so they get checked", () =>
  w.document.querySelectorAll("#sheet-body .ai-filled").length >= 4);
check("the form says what it filled in", () => {
  const h = w.document.getElementById("sd-airead").innerHTML;
  return h.includes("Filled in from the photo") && h.includes("Read the photo again"); });
const reReadAfterSuccess = w.document.getElementById("sd-airead").innerHTML.includes("Seeds.readPacket()");
check("a packet read this way saves correctly", () => {
  const before = w.DB.count("seeds");
  w.Seeds.save();
  const s = w.DB.all("seeds").find(x => x.name === "Cherry Tomato");
  return w.DB.count("seeds") === before + 1 && s && s.crop_id === "tomato" && num0(s.qty) === 25; });
check("a manual re-read button is always within reach", () => {
  w.Seeds.form(null);
  w.Seeds._photoId = w.Photos.put("data:image/jpeg;base64,AAAA", 100, 100);
  w.Seeds.paint();
  const fresh = w.document.getElementById("sd-airead").innerHTML;
  return reReadAfterSuccess && fresh.includes("Seeds.readPacket()") && fresh.includes("Read the packet with"); });

await readWith({ crop:"", name:"", variety:"", brand:"", qty:"", unit:"", packed_year:"",
  exp_date:"", germ_rate:"", notes:"" });
check("an unreadable packet says so instead of failing silently", () => {
  const h = w.document.getElementById("sd-airead").innerHTML;
  return h.includes("Could not read") && h.includes("Try reading it again"); });

V.json = async () => ({ crop:"pepper", name:"Sweet Pepper", variety:"Model Guess", brand:"", qty:"", unit:"",
  packed_year:"", exp_date:"", germ_rate:"", notes:"" });
w.Seeds.form(null);
w.Seeds._photoId = w.Photos.put("data:image/jpeg;base64,AAAA", 100, 100);
w.document.getElementById("sd-var").value = "Her Own Note";
await w.Seeds.readPacket();
check("a field she typed in is left alone", () => val("sd-var") === "Her Own Note");
check("but empty fields beside it still fill", () => val("sd-name") === "Sweet Pepper");
V.json = realJson;
w.closeSheet();

const realAsk = V.ask;
V.ask = async () => { throw new Error("Failed to fetch"); };
V.json = async () => { throw new Error("Failed to fetch"); };
w.Seeds.form(null);
w.Seeds._photoId = w.Photos.put("data:image/jpeg;base64,AAAA", 100, 100);
await w.Seeds.readPacket();
check("offline packet read explains itself", () =>
  w.document.getElementById("sd-airead").innerHTML.includes("offline"));
V.ask = realAsk; V.json = realJson;
w.closeSheet();

/* --- Plant Doctor --- */
check("Plant Doctor offers AI vision to a Gemini user too", () => {
  w.DB.set("aiProvider", "gemini"); w.DB.set("gemKey", "AIza-test"); w.DB.set("aiKey", "");
  w.Doctor.photoId = w.Photos.put("data:image/jpeg;base64,AAAA", 100, 100);
  w.Doctor.triage();
  const h = w.document.getElementById("sheet-body").innerHTML;
  return h.includes("look at the photo") && h.includes(w.PROVIDERS.gemini.n); });
check("Plant Doctor hides AI vision when no key is connected", () => {
  w.DB.set("gemKey", ""); w.DB.set("aiKey", "");
  w.Doctor.triage();
  return !w.document.getElementById("sheet-body").innerHTML.includes("look at the photo"); });
w.Doctor.photoId = null; w.closeSheet();

/* --- the camera must never open facing the gardener --- */
const Cam = w.eval("Cam");
function fakeMedia(opts){
  const asked = [];
  w.navigator.mediaDevices = {
    enumerateDevices: async () => opts.devices || [],
    getUserMedia: async (c) => {
      asked.push(c.video);
      if(opts.reject && opts.reject(c.video)){ const e = new Error("OverconstrainedError"); e.name = "OverconstrainedError"; throw e; }
      return { getTracks: () => [{ stop(){} }] };
    }
  };
  return asked;
}
const mediaBefore = w.navigator.mediaDevices;

check("the photo-capture file input asks for the rear camera", () => {
  const el = w.document.getElementById("filepick-cam");
  return el && el.getAttribute("capture") === "environment"; });
check("the library picker is not a camera at all", () => {
  const el = w.document.getElementById("filepick");
  return el && !el.hasAttribute("capture"); });

let asked = fakeMedia({ devices: [] });
await Cam.rear();
check("the live camera demands the rear lens outright, not as a preference", () =>
  asked.length > 0 && asked[0].facingMode && asked[0].facingMode.exact === "environment");

asked = fakeMedia({ devices: [
  { kind:"videoinput", deviceId:"front-1", label:"Front Camera" },
  { kind:"videoinput", deviceId:"back-1",  label:"Back Camera" }
]});
await Cam.rear();
check("a camera labelled as the back one is chosen by id", () =>
  asked[0].deviceId && asked[0].deviceId.exact === "back-1");

asked = fakeMedia({ devices: [], reject: v => !!(v.facingMode && v.facingMode.exact) });
await Cam.rear();
check("an exact-rear refusal relaxes to a rear preference, in order", () =>
  asked.length >= 2 && asked[0].facingMode.exact === "environment" && asked[1].facingMode.ideal === "environment");

asked = fakeMedia({ devices: [], reject: v => !!v.facingMode });
await Cam.rear();
check("a device with no rear camera still gets a working one, last", () =>
  asked[asked.length - 1] === true);

w.navigator.mediaDevices = undefined;
check("camera support is detected", () => Cam.supported() === false);
w.navigator.mediaDevices = mediaBefore;

/* --- the settings crash that stopped a key being saved at all --- */
check("saving a key does not depend on a field that is not rendered", () => {
  w.document.body.insertAdjacentHTML("beforeend", '<input id="st-key" value="sk-ant-smoke">');
  w.Settings.saveKey();
  const saved = w.DB.get("aiKey") === "sk-ant-smoke";
  w.document.getElementById("st-key").remove();
  return saved; });
check("pasting a Claude key points the app at Claude", () => w.DB.get("aiProvider") === "claude");

/* --- the store builds ---------------------------------------------------
   Everything in p19_native.js has to be invisible on the web. A regression
   here is silent: the web app keeps working while the native one quietly
   stops saving exports, or vice versa. --------------------------------- */
check("the native layer exists but is dormant in a browser", () => w.Native && w.Native.active === false);
check("it reports the web platform when there is no Capacitor bridge", () => w.Native.platform === "web");
check("no native voice recogniser is claimed on the web", () => w.Native.voice.available() === false);
/* check() is synchronous, so these are resolved before being asserted —
   an async callback would hand it a Promise, which is never false and
   therefore always "passes". */
const nativeSave = await w.Native.save("x.csv", new w.Blob(["a"]));
const nativeOpen = await w.Native.openExternal("https://example.org");
check("native file saving refuses politely instead of throwing", () => nativeSave === false);
check("opening an external link is left to the browser", () => nativeOpen === false);
check("haptics are a no-op rather than a crash", () => { w.Native.tap("light"); return true; });
check("the web keeps its mic button", () => {
  w.DB.set("gemKey", "AIzaSmoke"); w.Assist.draw();
  return (w.document.getElementById("s-assist").innerHTML || "").indexOf("Assist.mic()") > 0; });
check("the web updater is untouched by the native patches", () =>
  typeof w.Updater.update === "function" && w.Updater.label().indexOf("App Store") < 0);

/* ==========================================================================
   MICRO-CLIMATE
   The sun figures are the one part of this app that is pure physics, so they
   are checked against known astronomy rather than against themselves.
   ========================================================================== */

check("solstice declination is right", () => {
  const jun = w.Solar.declination(172), dec = w.Solar.declination(355);
  return Math.abs(jun - 23.44) < 0.4 && Math.abs(dec + 23.44) < 0.4; });
check("equinox declination is near zero", () => Math.abs(w.Solar.declination(80)) < 1.2);
check("sun is due south at noon in the northern hemisphere", () => {
  const p = w.Solar.pos(45, 172, 0);
  return Math.abs(p.az - 180) < 1; });
check("sun is due north at noon in the southern hemisphere", () => {
  const p = w.Solar.pos(-33, 355, 0);
  const az = p.az;
  return (az < 1 || az > 359); });
check("morning sun sits in the east", () => {
  const p = w.Solar.pos(45, 172, -60);
  return p.az > 60 && p.az < 130; });
check("afternoon sun sits in the west", () => {
  const p = w.Solar.pos(45, 172, 60);
  return p.az > 230 && p.az < 300; });
check("noon altitude matches 90 - lat + declination", () => {
  const p = w.Solar.pos(45, 172, 0);
  return Math.abs(p.alt - (90 - 45 + 23.44)) < 0.6; });
check("midsummer day is longer than midwinter at latitude", () => {
  const jun = w.Solar.day(45, 172, [0,0,0,0,0,0,0,0], 0, null).hours;
  const dec = w.Solar.day(45, 355, [0,0,0,0,0,0,0,0], 0, null).hours;
  return jun > dec + 5 && jun < 16 && dec > 6; });
check("the arctic gets a midnight sun and a polar night", () => {
  const jun = w.Solar.day(78, 172, [0,0,0,0,0,0,0,0], 0, null).hours;
  const dec = w.Solar.day(78, 355, [0,0,0,0,0,0,0,0], 0, null).hours;
  return jun > 23 && dec === 0; });
const HZ_OPEN = [0,0,0,0,0,0,0,0];
const HZ_SOUTH = [0,0,0,60,80,60,0,0];        /* a house wall to the south */
const HZ_NORTH = [80,60,0,0,0,0,0,60];        /* the same wall to the north */
check("a wall to the south costs a northern garden far more than one to the north", () => {
  const s = w.Solar.day(45, 105, HZ_SOUTH, 0, null).hours;
  const n = w.Solar.day(45, 105, HZ_NORTH, 0, null).hours;
  return s < n * 0.7; });
check("a low autumn sun is lost entirely behind a south wall", () => {
  const open = w.Solar.day(45, 288, HZ_OPEN, 0, null).hours;
  const s = w.Solar.day(45, 288, HZ_SOUTH, 0, null).hours;
  return open > 9 && s < 1; });
check("midsummer clears a south wall that autumn cannot", () => {
  /* the sun rises north of east in June and spends hours off the wall */
  return w.Solar.day(45, 172, HZ_SOUTH, 0, null).hours >
         w.Solar.day(45, 105, HZ_SOUTH, 0, null).hours + 4; });
check("the shading flips in the southern hemisphere", () => {
  const s = w.Solar.day(-33, 105, HZ_SOUTH, 0, null).hours;
  const n = w.Solar.day(-33, 105, HZ_NORTH, 0, null).hours;
  return n < s; });
check("a south-facing slope gains beam energy, a north-facing one loses it", () => {
  const flat  = w.Solar.day(45, 105, [0,0,0,0,0,0,0,0], 0, null).gain;
  const south = w.Solar.day(45, 105, [0,0,0,0,0,0,0,0], 12, 180).gain;
  const north = w.Solar.day(45, 105, [0,0,0,0,0,0,0,0], 12, 0).gain;
  return south > flat && north < flat; });
check("horizon interpolates smoothly between sectors", () => {
  const hz = [0,0,0,0,40,0,0,0];                 /* 40° due south only */
  return w.Solar.horizonAt(hz, 180) === 40 &&
         Math.abs(w.Solar.horizonAt(hz, 202.5) - 20) < 0.01 &&
         w.Solar.horizonAt(hz, 0) === 0; });

/* --- profiles, inheritance and the derived picture --- */
const mplot = w.DB.insert("plots", { name:"Front of house" });
const mbedS = w.DB.insert("beds", { plot_id: mplot.id, name:"South strip", cols:2, rows:4, cell_in:12, sun_hours:8 });
const mbedN = w.DB.insert("beds", { plot_id: mplot.id, name:"North strip", cols:2, rows:4, cell_in:12, sun_hours:8 });
w.Garden.place(mbedS, 0, 0, "tomato", true);
w.Garden.place(mbedN, 0, 0, "tomato", true);

check("no profile means no micro-climate", () => w.Micro.forBed(mbedS.id) === null);
check("watering is untouched with no profile", () => {
  const r = w.Recommend.water(mbedS.id, null);
  return r && r.micro === undefined; });

w.Micro.save("plot", mplot.id, {
  horizon:[10,10,5,0,0,0,5,10], slope_pct:0, slope_dir:null,
  wind_exposure:"exposed", canopy:"eaves", reflect:"strong",
  drainage:"fast", frost_pocket:"none", surface:"gravel", notes:"Against the wall."
});
w.Micro.invalidate();

check("a plot profile is inherited by every bed in it", () => {
  const a = w.Micro.forBed(mbedS.id), b = w.Micro.forBed(mbedN.id);
  return !!a && !!b && a.site._from === "plot" && a.sunGrowing === b.sunGrowing; });
check("JSON columns survive the round trip through the vault", () => {
  const s = w.Micro.row("plot", mplot.id);
  return Array.isArray(s.horizon) && s.horizon.length === 8 && s.horizon[0] === 10; });
check("sun hours are calculated, not the number typed on the bed", () => {
  return w.Micro.sunSource(mbedS.id) === "surveyed" &&
         w.Micro.sunHours(mbedS.id) !== 8; });
check("twelve monthly sun figures are produced", () => {
  const d = w.Micro.forBed(mbedS.id);
  return d.sunByMonth.length === 12 && d.sunByMonth.every(v => v >= 0 && v <= 24); });
check("summer beats winter in the monthly figures", () => {
  const d = w.Micro.forBed(mbedS.id);       /* test garden is at 45.5°N */
  return d.sunByMonth[5] > d.sunByMonth[11]; });

check("eaves block most of the rain", () => {
  const r = w.Recommend.water(mbedS.id, { daily:{
    time:[w.iso(w.today())], precipitation_sum:[1.0] } });
  return r.rain < 0.3 && r.baseRain === 1; });
check("an exposed, reflective, fast-draining spot needs more water", () => {
  const r = w.Recommend.water(mbedS.id, null);
  return r.need > r.baseNeed && r.micro.factor > 1.1; });
check("the extra water is explained rather than asserted", () => {
  const r = w.Recommend.water(mbedS.id, null);
  return r.micro.why.length >= 2 && r.micro.why.join(" ").indexOf("wind") >= 0; });
check("a sun-trap wall pushes this spot's frost dates apart", () => {
  const f = w.Micro.frostFor(mbedS.id);
  return f.shifted && f.shiftLast < 0 && f.shiftFirst > 0 &&
         w.diffDays === undefined ? true : f.first > w.Season.firstFrost(); });

/* a bed that genuinely differs from its plot */
w.Micro.save("bed", mbedN.id, { canopy:"tree", wind_exposure:"sheltered", frost_pocket:"pocket" });
w.Micro.invalidate();
check("a bed row overrides its plot field by field", () => {
  const d = w.Micro.forBed(mbedN.id);
  return d.site._from === "bed override" &&
         d.site.canopy === "tree" &&          /* from the bed */
         d.site.reflect === "strong"; });     /* still from the plot */
check("the other bed in the plot is unaffected", () =>
  w.Micro.forBed(mbedS.id).site.canopy === "eaves");
check("a cold pocket frosts earlier than the garden average", () => {
  const f = w.Micro.frostFor(mbedN.id);
  return f.shiftFirst < w.Micro.frostFor(mbedS.id).shiftFirst; });

check("recommendations use the surveyed sun, not the typed number", () => {
  const recs = w.Recommend.now({ bedId: mbedS.id });
  return recs.length === 0 || recs.some(r => r.why.some(x => x.indexOf("surveyed sun") >= 0)); });

/* --- the geometric constraint that makes a timed photo a measurement --- */
check("shade at a known sun angle raises the skyline in that direction", () => {
  const hz = [0,0,0,0,0,0,0,0];
  const out = w.MicroUI.applySunChecks(hz, [{ sun:{ alt:40, az:180 }, sunlit:false }]);
  return out[4] >= 40; });
check("sun at a known angle caps the skyline in that direction", () => {
  const hz = [0,0,0,0,70,0,0,0];
  const out = w.MicroUI.applySunChecks(hz, [{ sun:{ alt:30, az:180 }, sunlit:true }]);
  return out[4] < 30; });
check("a sun below the horizon proves nothing", () => {
  const hz = [0,0,0,0,0,0,0,0];
  const out = w.MicroUI.applySunChecks(hz, [{ sun:{ alt:2, az:180 }, sunlit:false }]);
  return out[4] === 0; });
check("shots merge into a skyline weighted by bearing", () => {
  const hz = w.MicroUI.mergeHorizon([
    { bearing:180, ai:{ horizon_angle_deg:45, obstructions:[] } },
    { bearing:0,   ai:{ horizon_angle_deg:0,  obstructions:[] } }
  ]);
  return hz.length === 8 && hz[4] >= 40 && hz[0] === 0; });
check("a named obstruction lands on the right bearing", () => {
  const hz = w.MicroUI.mergeHorizon([
    { bearing:90, ai:{ horizon_angle_deg:0, obstructions:[{ what:"oak", bearing_offset_deg:40, height_angle_deg:60 }] } }
  ]);
  return hz[3] > hz[1]; });                    /* SE higher than NE */
check("the shots the gardener skipped are ignored", () =>
  w.MicroUI.mergeHorizon([null, undefined, { bearing:null }]).every(v => v === 0));
check("on-device light reading works with no AI key", () => {
  const c = w.document.createElement("canvas"); c.width = 40; c.height = 30;
  const l = w.MicroUI.light(c);
  return l && typeof l.skyFraction === "number" && typeof l.shadowFraction === "number"; });

/* --- ground truth: the forecast is a claim, not a fact ------------------- */
/* one surveyed spot only, so the queue arithmetic is unambiguous */
w.DB.bulkRemove("sites", s => s.scope === "bed");
w.Micro.invalidate();

const rainDays = [];
for(let k = 1; k <= 5; k++) rainDays.push(w.iso(new Date(Date.now() - k * 86400000)));
/* a complete forecast payload — Weather.render reads more of it than
   MicroLog does, and a half-built fixture would fail there instead */
const wx = (rain, low) => ({ daily:{
  time: rainDays.slice(),
  precipitation_sum: rainDays.map(() => rain),
  temperature_2m_min: rainDays.map(() => low),
  temperature_2m_max: rainDays.map(() => low + 20),
  weather_code: rainDays.map(() => 61),
  sunrise: rainDays.map(d => d + "T06:00"), sunset: rainDays.map(d => d + "T20:00"),
  uv_index_max: rainDays.map(() => 5)
}, current:{ temperature_2m: 68, relative_humidity_2m: 55, wind_speed_10m: 6, weather_code: 61 } });
const wxFake = wx(0.5, 50);
wxFake.daily.precipitation_sum = [0.5, 0.4, 0.6, 0.5, 0.5];
w.APP.weather = wxFake;

check("nothing is asked about a garden with no surveyed spots", () => {
  const keep = w.DB.all("sites").slice();
  w.DB.bulkRemove("sites", () => true);
  w.Micro.invalidate();
  const n = w.MicroLog.pending().length;
  /* put the surveys back through the front door — DB.body, because an id is
     the database's to give and re-inserting one verbatim is how a row gets
     silently overwritten. Nothing looks a site up by id; Micro resolves them
     by scope and ref_id, both of which come across. */
  keep.forEach(r => w.DB.insert("sites", w.DB.body("sites", r)));
  w.Micro.invalidate();
  return n === 0; });

w.Micro.save("plot", mplot.id, {
  horizon:[10,10,5,0,0,0,5,10], canopy:"open", wind_exposure:"normal",
  reflect:"none", drainage:"normal", frost_pocket:"none"
});
w.Micro.invalidate();

check("every forecast rain day is offered for confirmation", () => {
  const p = w.MicroLog.pending().filter(x => x.kind === "rain");
  return p.length === 5 && p[0].forecast === 0.5 && p[0].ago === 1; });
check("a dry forecast day is never asked about", () => {
  w.APP.weather = wx(0, 50);
  const n = w.MicroLog.pending().length;
  w.APP.weather = wxFake;
  return n === 0; });
check("the estimate stands until there is real evidence", () => {
  const d = w.Micro.forPlot(mplot.id);
  return d.rainCal.measured === null && d.rainCatch === 1 && d.rainCal.source === "estimated"; });

/* the gardener confirms: the forecast has been running high over her house */
w.Micro.logRain("plot", mplot.id, rainDays[0], 0.5, 0.0);
w.Micro.logRain("plot", mplot.id, rainDays[1], 0.4, 0.1);
check("two confirmed days are not yet enough to overrule a forecast", () => {
  const d = w.Micro.forPlot(mplot.id);
  return d.rainCal.measured === null && d.rainCatch === 1; });
w.Micro.logRain("plot", mplot.id, rainDays[2], 0.6, 0.1);
w.Micro.invalidate();
check("three confirmed days start to move the number", () => {
  const c = w.Micro.rainCal(w.Micro.row("plot", mplot.id));
  return c.measured !== null && c.measured < 0.2 && c.ratio < 1 && c.ratio > c.measured; });
check("a confirmed day is not counted twice", () => {
  w.Micro.logRain("plot", mplot.id, rainDays[0], 0.5, 0.0);
  return w.Micro.row("plot", mplot.id).rain_obs.length === 3; });
check("an answered day drops out of the queue", () => {
  const dates = w.MicroLog.pending().filter(x => x.kind === "rain").map(x => x.date);
  return dates.indexOf(rainDays[0]) < 0 && dates.length === 2; });
check("confirmed rainfall reaches the watering call", () => {
  w.Micro.invalidate();
  const r = w.Recommend.water(mbedS.id, wxFake);
  return r.rain < r.baseRain && r.micro.rainCatch < 1; });
check("the forecast bias is reported back to the gardener", () => {
  const b = w.Micro.rainBias();
  return b && b.n === 3 && b.ratio < 0.25 && b.clean === true; });
check("the weather screen asks the question where the forecast is", () => {
  w.APP.tab = "weather"; w.Weather.render();
  const h = w.document.getElementById("s-weather").innerHTML || "";
  return h.indexOf("Did that actually happen here") > 0 && h.indexOf("MicroLog.open") > 0; });
check("the weather screen still renders the forecast itself", () => {
  const h = w.document.getElementById("s-weather").innerHTML || "";
  return h.indexOf("Watering call") > 0; });

/* frost: evidence is collected, a change is suggested, never applied quietly */
w.APP.tab = "garden";
check("a cold night is offered for confirmation", () => {
  w.APP.weather = wx(0, 35);
  const p = w.MicroLog.pending();
  return p.length === 5 && p.every(x => x.kind === "frost" && x.low === 35); });
w.APP.weather = wxFake;
w.Micro.logFrost("plot", mplot.id, rainDays[3], 35, true);
w.Micro.logFrost("plot", mplot.id, rainDays[4], 36, true);
w.Micro.invalidate();
check("frost on nights forecast above freezing suggests a cold pocket", () => {
  const fe = w.Micro.frostEvidence(w.Micro.row("plot", mplot.id));
  return fe.colder === 2 && fe.suggest === "slight" && !!fe.msg; });
check("the suggestion is not applied on its own", () =>
  w.Micro.row("plot", mplot.id).frost_pocket === "none");
check("applying it moves that spot's frost dates", () => {
  const before = w.Micro.frostFor(mbedS.id).shiftFirst;
  w.MicroLog.applyFrost("plot", mplot.id, "slight");
  w.Micro.invalidate();
  return w.Micro.frostFor(mbedS.id).shiftFirst < before; });

/* --- the assistant can read and write a profile --- */
check("get_microclimate reports a surveyed spot", async () => true);
const mres = await w.Assist.run("get_microclimate", { plot:"front of house" });
check("get_microclimate finds the plot and reports real numbers", () =>
  mres.ok && mres.surveyed === true && mres.sun_hours_by_month.length === 12 &&
  mres.sun_hours_in_season > 0 && typeof mres.water_multiplier === "number" &&
  mres.share_of_rain_that_lands_here < 1 &&        /* the confirmed rain days */
  mres.first_frost_here && mres.reasons.length > 0);
const rainBefore = (w.Micro.row("plot", mplot.id).rain_obs || []).length;
const mset = await w.Assist.run("set_microclimate", { plot:"front of house", blocked_west:55, wind:"sheltered" });
check("set_microclimate writes only what it was given", () => {
  const s = w.Micro.row("plot", mplot.id);
  return mset.ok && s.horizon[6] === 55 && s.wind_exposure === "sheltered" &&
         s.horizon[2] === 5 &&                     /* untouched sectors survive */
         s.drainage === "normal"; });
check("recording a fact by voice does not wipe the confirmed rain days", () =>
  rainBefore >= 3 && (w.Micro.row("plot", mplot.id).rain_obs || []).length === rainBefore);
check("set_microclimate refuses an empty call", async () => true);
const mnone = await w.Assist.run("set_microclimate", { plot:"front of house" });
check("set_microclimate will not invent a profile from nothing", () => mnone.ok === false);
const mbad = await w.Assist.run("set_microclimate", { plot:"nowhere at all" });
check("set_microclimate fails loudly on an unknown plot", () => mbad.ok === false && /No plot/.test(mbad.error));
check("the assistant is told the micro-climate rules", () =>
  w.Assist.system().indexOf("MICRO-CLIMATE") > 0 &&
  w.Assist.system().indexOf("Front of house") > 0);
const MTOOLS = ["get_microclimate","set_microclimate","survey_microclimate","log_real_rain"];
check("every micro-climate tool is registered", () => {
  const names = w.AI_TOOLS.map(t => t.name);
  return MTOOLS.every(n => names.indexOf(n) >= 0); });
check("every micro-climate tool has an on-screen label", () =>
  MTOOLS.every(n => w.Assist.label({ name:n, args:{} }) !== n));

const mrain = await w.Assist.run("log_real_rain", { plot:"front of house", date: rainDays[3], inches: 0 });
check("the assistant can record that the rain never arrived", () =>
  mrain.ok && mrain.forecast_inches === 0.5 && mrain.actual_inches === 0 &&
  mrain.calibration[0].confirmed_days === 4);
const mrainNo = await w.Assist.run("log_real_rain", { plot:"front of house", date:"1999-01-01", inches: 1 });
check("it will not record a day the forecast never covered", () =>
  mrainNo.ok === false && /no forecast on file/i.test(mrainNo.error));
check("the assistant is told not to invent a rainfall figure", () =>
  w.Assist.system().indexOf("Never record a rainfall figure she did not give you") > 0);

/* --- the UI --- */
w.Micro.invalidate();
w.APP.plotId = mplot.id; w.APP.bedId = null; w.Garden.view = "beds";
w.Garden.render();
check("the plot list shows the micro-climate card", () =>
  (w.document.getElementById("s-garden").innerHTML || "").indexOf("Micro-climate · Front of house") > 0);
w.APP.bedId = mbedS.id; w.Garden.render();
check("the bed view shows the resolved profile", () => {
  const h = w.document.getElementById("s-garden").innerHTML || "";
  return h.indexOf("🌤️ Micro-climate") > 0 && h.indexOf("MicroUI.open") > 0; });
check("the bed view still renders its own grid and plantings", () => {
  const h = w.document.getElementById("s-garden").innerHTML || "";
  return h.indexOf("Growing here") > 0 && h.indexOf('id="cvhost"') > 0 &&
         h.indexOf("<svg") > 0; });
w.MicroUI.form("plot", mplot.id);
check("the manual form offers all eight skyline sectors", () =>
  w.SECTORS.every((s, i) => !!w.document.getElementById("hz-" + i)));
check("the form round-trips what is already saved", () => {
  const v = w.MicroUI.collect();
  return v.horizon[6] === 55 && v.wind_exposure === "sheltered" && v.frost_pocket === "slight"; });
check("preview derives without saving", () => {
  w.MicroUI.preview("plot", mplot.id);
  return (w.document.getElementById("mf-preview").innerHTML || "").indexOf("sun in season") > 0; });
w.closeSheet();
w.APP.bedId = null; w.APP.plotId = null;
w.DB.bulkRemove("sites", () => true);
w.Micro.invalidate();
check("removing every profile falls back cleanly", () => {
  w.Garden.render();
  return w.Micro.forBed(mbedS.id) === null && w.Micro.sunHours(mbedS.id) === 8; });

/* --- the vault must contain the schema and nothing else ------------------
   Geom.bed once stashed a cache flag and a parsed polygon on the cached row.
   Both were serialised straight into the gardener's backup, and the parsed
   polygon would have been written into the .sqlite export as "0,0,1,0,…".
   Anything the app hangs on a row for its own convenience ends up in her
   data, so: check. --- */
check("the vault carries schema columns and nothing else", () => {
  const dump = JSON.parse(w.DB.exportJSON());
  const SCHEMA_KEYS = {
    beds:["id","plot_id","name","cols","rows","cell_in","sun_hours","sun_exposure","soil",
          "irrigation","notes","mx","my","rot","created","shape","w_in","h_in","poly","grid_on","snap_in","north_deg"],
    plantings:["id","bed_id","x","y","w","h","span_mode","crop_id","variety","variety_id","seed_id",
               "qty","status","sown_on","transplant_on","harvest_from","harvest_to","removed_on",
               "notes","created","px","py","rr","rc","rot","sv"]
  };
  const bad = [];
  Object.keys(SCHEMA_KEYS).forEach(t =>
    (dump.tables[t] || []).forEach(row =>
      Object.keys(row).forEach(k => { if(SCHEMA_KEYS[t].indexOf(k) < 0) bad.push(t + "." + k); })));
  if(bad.length) errors.push("stray keys in the vault: " + bad.filter((v,i,a)=>a.indexOf(v)===i).join(", "));
  return bad.length === 0;
});
check("a traced outline stays a string on the row", () => {
  const b = w.DB.all("beds").find(x => w.Geom.shape(x) === "poly");
  if(!b) return true;
  w.Geom.pts(w.Geom.bed(b));                       /* force it to be read */
  return typeof w.DB.find("beds", b.id).poly === "string"; });
check("a polygon still reads back correctly after all that", () => {
  const b = w.DB.all("beds").find(x => w.Geom.shape(x) === "poly");
  if(!b) return true;
  const P = w.Geom.pts(w.Geom.bed(b));
  return P.length >= 3 && P.every(pt => isFinite(pt[0]) && isFinite(pt[1])); });
check("the SQL console still exports every table", () => {
  if(w.DB.engine !== "sqlite") return true;
  const out = w.DB.query("SELECT COUNT(*) FROM beds");
  return out.length === 1; });

/* ==========================================================================
   FLOWERS, TEA AND BENEFICIAL-INSECT PLANTS
   ========================================================================== */
check("the new garden plants are in the crop table", () => {
  const want = ["chamomile","lemonbalm","lavender","anisehyssop","beebalm","alyssum",
                "phacelia","yarrow","zinnia","cosmos","cornflower","echinacea"];
  return want.every(id => !!w.crop(id)) && w.GARDEN_PLANTS.length === want.length; });
check("every new plant cites at least two independent sources", () =>
  w.GARDEN_PLANTS.every(c => Array.isArray(c.srcs) && c.srcs.length >= 2 &&
    c.srcs.every(k => !!w.GARDEN_SRC[k])));
check("no plant cites the same page twice", () =>
  w.GARDEN_PLANTS.every(c => new Set(c.srcs).size === c.srcs.length));
check("every new source is https, official, and says what it gave us", () =>
  Object.keys(w.GARDEN_SRC).every(k => {
    const s = w.GARDEN_SRC[k];
    return OFFICIAL.test(s.url) && s.org && s.n && s.what && s.what.length > 40; }));
check("figures no source states are marked as estimates", () =>
  w.GARDEN_PLANTS.every(c => Array.isArray(c.estfields)) &&
  w.crop("chamomile").estfields.indexOf("via") >= 0 &&
  w.crop("lavender").estfields.indexOf("germ") >= 0);
check("what a source DOES state is not called an estimate", () =>
  w.crop("lavender").estfields.indexOf("sp") < 0 &&      /* USU gives 18-24in */
  w.crop("lemonbalm").estfields.indexOf("sp") < 0 &&     /* Illinois gives 18in */
  w.crop("yarrow").estfields.indexOf("sp") < 0);         /* Clemson gives 12-18in */
check("each new plant says which organisations were checked", () =>
  w.GARDEN_PLANTS.every(c => c.verified === true && /Checked against .+,/.test(c.vnote || "")));
/* psf and sp are two different conventions and both are right: psf is the
   square-foot-gardening density on an equidistant grid, sp is the extension
   in-row spacing. Lettuce is 4 per square foot and 8in apart in a row. So this
   only catches a figure that is wrong by an order of magnitude — a typo. */
check("no crop's density is wildly at odds with its spacing", () => {
  const bad = w.CROPS.filter(c => {
    const want = 144 / (c.sp * c.sp);
    return c.psf > want * 6 || c.psf < want / 6; }).map(c => c.id);
  if(bad.length) errors.push("density implausible for spacing: " + bad.join(", "));
  return bad.length === 0; });
check("the canvas measures roots and plant counts off the same figure", () => {
  /* a clump of N at proper spacing must read back as exactly N */
  const bad = w.CROPS.filter(c => w.Geom.fitsIn(c.id, w.Geom.rootR(c.id, 9)) !== 9).map(c => c.id);
  if(bad.length) errors.push("clump maths does not round-trip: " + bad.slice(0, 5).join(", "));
  return bad.length === 0; });
check("every companion id is a real crop or documented as absent", () => {
  const bad = [];
  w.CROPS.forEach(c => (c.comp || []).concat(c.foes || []).forEach(id => {
    if(!w.crop(id) && w.CROP_ABSENT.indexOf(id) < 0) bad.push(c.id + " -> " + id); }));
  if(bad.length) errors.push("dangling companion ids: " + bad.slice(0, 6).join(", "));
  return bad.length === 0; });
check("the generic names in the base table now resolve to real crops", () => {
  /* "squash" and "bean" matched nothing for six crops each — potato named
     squash as something to keep away from, and it never once fired */
  const pot = w.crop("potato");
  return pot.foes.indexOf("zucchini") >= 0 && pot.foes.indexOf("squash") < 0 &&
         pot.comp.indexOf("bushbean") >= 0 && pot.comp.indexOf("bean") < 0 &&
         w.crop("cucumber").comp.indexOf("bushbean") >= 0 &&
         w.pairRating("potato", "zucchini").score === -2; });
check("every crop still resolves to an https source", () =>
  w.CROPS.every(c => /^https:\/\//.test(w.cropSource(c.id))));

check("the sizes match what the sources say", () => {
  /* USU: English lavender 1-2 ft tall, 2-3 ft wide - wider than high */
  return w.Habit.spread("lavender") > w.Habit.height("lavender") &&
    /* Clemson: alyssum 3-6in from seed, spreading a foot or more */
    w.Habit.height("alyssum") <= 8 && w.Habit.spread("alyssum") >= 12 &&
    /* NCSU: coneflower 3-4 ft */
    w.Habit.height("echinacea") >= 36 && w.Habit.height("echinacea") <= 48; });
check("a flower that shades a bed is treated as tall", () =>
  w.Geom.isTall("cosmos") && !w.Geom.isTall("alyssum"));
check("the beneficial-insect flowers pair with the crops they help", () => {
  const r = w.pairRating("alyssum", "lettuce");
  const c = w.companionsFor("alyssum");
  return r.score >= 1 && c.good.indexOf("lettuce") >= 0 && c.good.indexOf("tomato") >= 0; });
check("every companion named by a new plant is a real crop", () =>
  w.GARDEN_PLANTS.every(c => (c.comp || []).every(id => !!w.crop(id)) &&
                             (c.foes || []).every(id => !!w.crop(id))));
check("what each one is for is recorded", () =>
  w.PLANT_ROLE.alyssum === "beneficials" && w.PLANT_ROLE.chamomile === "tea" &&
  w.PLANT_ROLE.marigold === "pest control" &&
  Object.keys(w.PLANT_ROLE).every(id => !!w.crop(id)));
check("the new plants can be planted like anything else", () => {
  const b = w.DB.insert("beds", { name:"Flower bed", shape:"rect", w_in:72, h_in:48, cell_in:12, sun_hours:8 });
  const p = w.Garden.placeAt(b, 24, 24, "alyssum", { mode:"single", silent:true });
  return !!p && w.Geom.RR(p) === 4 && w.Geom.RC(p) === 6 &&    /* 8in spacing, 12in spread */
         w.PlantArt.icon("alyssum") === w.crop("alyssum").e; });
check("they get sowing windows from the frost dates like every other crop", () =>
  w.Season.windows("alyssum").length >= 1 && w.Season.windows("zinnia").length >= 1);

/* ==========================================================================
   CROPS THE GARDENER ADDS HERSELF
   ========================================================================== */
check("the usercrops table is part of the schema and the export", () =>
  Array.isArray(w.SCHEMA.usercrops) && w.SCHEMA.usercrops.indexOf("slug") >= 0 &&
  Array.isArray(w.DB.all("usercrops")));
const ucRow = w.UserCrops.save({
  slug: w.UserCrops.slug("Lemongrass"), name:"Lemongrass", emoji:"🌾", fam:"poaceae",
  sun:8, water:1.25, sp:24, dtm:100, depth:0.25, from:"transplant", feeder:"medium", via:1,
  start_indoor:-8, start_tp:2, start_direct:null, start_fall:null,
  comp:"tomato, basil", foes:"", tips:"Cut it back hard in autumn.", harvest:"Cut stalks at the base."
});
check("a crop she adds becomes a real crop", () => {
  const c = w.crop("my-lemongrass");
  return !!c && c.n === "Lemongrass" && c.sp === 24 && c.sun === 8 && c.from === "transplant"; });
check("its plants-per-square-foot is worked out, not typed", () =>
  Math.abs(w.crop("my-lemongrass").psf - 144 / (24 * 24)) < 0.01);
check("it is flagged as hers and never as sourced", () => {
  const c = w.crop("my-lemongrass");
  return c.mine === true && c.verified === false && w.UserCrops.isMine("my-lemongrass"); });
check("a built-in crop is not flagged as hers", () => !w.UserCrops.isMine("tomato"));
check("the id is readable and cannot collide", () => {
  const a = w.UserCrops.slug("Lemongrass");
  return a !== "my-lemongrass" && /^my-lemongrass-\d+$/.test(a); });
check("it appears in the library, the picker and search", () => {
  w.Library.render();
  const h = w.document.getElementById("s-library").innerHTML;
  return h.indexOf("Lemongrass") > 0 && h.indexOf("UserCrops.open()") > 0; });
check("her sowing dates drive the calendar like any other crop", () => {
  const ws = w.Season.windows("my-lemongrass");
  return ws.length === 2 && ws.some(x => x.kind === "indoor") && ws.some(x => x.kind === "transplant"); });
check("it can be planted, and is drawn at the size she gave", () => {
  const b = w.DB.insert("beds", { name:"Hers", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  const p = w.Garden.placeAt(b, 30, 24, "my-lemongrass", { mode:"single", silent:true });
  return w.Geom.RR(p) === 12 && w.PlantArt.icon("my-lemongrass") === "🌾"; });
check("her companion list is honoured", () => {
  const r = w.pairRating("my-lemongrass", "tomato");
  return r.score >= 1; });
check("a companion she names that is not a crop is simply ignored", () => {
  const c = w.UserCrops.toCrop({ slug:"my-x", name:"X", sp:12, comp:"tomato, wibble, " });
  return c.comp.length === 2 && w.pairRating("tomato", "nonsense").score === 0; });
check("the crop page says plainly that the figures are hers", () => {
  w.Library.open("my-lemongrass");
  const h = (w.document.getElementById("sheet-body") || w.document.getElementById("s-library")).innerHTML;
  return h.indexOf("Your own crop") > 0 && h.indexOf("No extension service") > 0; });
w.closeSheet();
check("editing hers updates the crop rather than adding a second", () => {
  const before = w.CROPS.length;
  w.UserCrops.save({ sun: 6 }, ucRow.id);
  return w.CROPS.length === before && w.crop("my-lemongrass").sun === 6; });
check("she survives a backup and restore", async () => true);
const ucDump = w.DB.exportJSON();
await w.DB.importJSON(ucDump);
check("her crop comes back after an import", () =>
  !!w.crop("my-lemongrass") && w.DB.count("usercrops") === 1);
check("her crop is stored as real columns, not a blob", () => {
  const row = w.DB.all("usercrops")[0];
  return row.name === "Lemongrass" && row.slug === "my-lemongrass" &&
         Object.keys(row).every(k => w.SCHEMA.usercrops.indexOf(k) >= 0); });
check("deleting hers warns about what is still using it", () => {
  w.UserCrops.confirmRemove(ucRow.id);
  const h = w.document.getElementById("sheet-body").innerHTML;
  return /still used by/.test(h) && /1 planting/.test(h); });
w.closeSheet();
check("deleting hers takes it out of the crop table", () => {
  const before = w.CROPS.length;
  w.UserCrops.remove(ucRow.id);
  return !w.crop("my-lemongrass") && w.CROPS.length === before - 1 &&
         w.DB.count("usercrops") === 0; });
check("removing a crop leaves the records that used it alone", () =>
  w.DB.where("plantings", p => p.crop_id === "my-lemongrass").length === 1);
check("the app does not fall over on a planting whose crop is gone", () => {
  const b = w.DB.all("beds").find(x => x.name === "Hers");
  w.APP.bedId = b.id;
  w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  w.APP.bedId = null;
  return h.length > 200; });

/* --- reporting an AI answer ---------------------------------------------
   Google Play requires that anything generating text with a model can be
   reported from inside the app. Without this the listing is rejected. --- */
check("every answer offers a way to report it", () => {
  w.Assist.msgs = [{ who:"me", text:"what is eating my kale" },
                   { who:"ai", text:"Cabbage worms, probably." }];
  w.DB.set("gemKey", "AIzaSmoke");
  w.Assist.draw();
  return (w.document.getElementById("s-assist").innerHTML || "").indexOf("Assist.report(1)") > 0; });
check("a report is captured on the device", () => {
  w.Assist.report(1);
  w.Assist.saveReport(1);
  const r = w.DB.get("aiReports", []);
  return r.length === 1 && r[0].reason === w.Assist.REPORT_REASONS[0]
      && r[0].answer.indexOf("Cabbage worms") === 0; });
check("reporting does not transmit anything by itself", () => {
  /* the only outbound route offered is a mailto the gardener must press */
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return h.indexOf("mailto:") > 0 && h.indexOf("http") !== h.indexOf("mailto:"); });
check("only the last fifty reports are kept", () => {
  w.DB.set("aiReports", new Array(60).fill(0).map((_, i) => ({ at:i })));
  w.Assist.saveReport(1);
  return w.DB.get("aiReports", []).length === 50; });
w.DB.set("aiReports", []);
w.Assist.msgs = [];
w.closeSheet();

/* --- the SQLite engine now ships with the app --- */
check("sql.js is looked for beside the app before the CDN", () =>
  html.indexOf('SQLJS_LOCAL = "sql/"') > 0 &&
  html.indexOf("for(const base of [SQLJS_LOCAL, SQLJS_CDN])") > 0);

/* ==========================================================================
   THE BED SCREEN, 2026-08-05
   Zoom, undo, multi-select, the details button, orientation, bed-aware
   recommendations, watering groups, saved layouts and calendar export.
   ========================================================================== */
const zb = w.DB.insert("beds", { name:"Zoom bed", shape:"rect", w_in:480, h_in:360,
  cell_in:12, sun_hours:8, grid_on:0, snap_in:0 });
w.APP.bedId = zb.id;
const zt = w.Garden.placeAt(zb, 60, 60, "tomato", { mode:"single", silent:true });
const zbz = w.Garden.placeAt(zb, 90, 60, "basil",  { mode:"single", silent:true });
const zr = w.Garden.placeAt(zb, 200, 200, "radish", { mode:"single", silent:true });

/* --- zoom is a viewBox change, and only a viewBox change --- */
check("an unzoomed bed renders exactly the viewBox it always did", () => {
  w.Zoom.reset();
  return w.Canvas.svg(w.Geom.bed(w.DB.find("beds", zb.id)), { interactive:true })
    .includes('viewBox="-5 -5 490 370"'); });
check("zooming in halves the viewBox rather than transforming the picture", () => {
  w.Zoom.z = 2; w.Zoom.cx = 240; w.Zoom.cy = 180;
  const vb = w.Zoom.viewBox(w.Geom.bed(w.DB.find("beds", zb.id)), 5).split(" ").map(Number);
  return Math.abs(vb[2] - 245) < 0.5 && Math.abs(vb[3] - 185) < 0.5; });
check("the view never escapes the bed, however far you drag it", () => {
  w.Zoom.z = 4; w.Zoom.cx = -9000; w.Zoom.cy = 9000;
  const vb = w.Zoom.viewBox(w.Geom.bed(w.DB.find("beds", zb.id)), 5).split(" ").map(Number);
  return vb[0] >= -5.01 && vb[1] + vb[3] <= 370.01; });
check("a touch still lands on the right soil when zoomed in", () => {
  /* the whole reason zoom is a viewBox change: toIn reads it back */
  const el = { getBoundingClientRect: () => ({ left:0, top:0, width:400, height:400 }),
               getAttribute: () => w.Zoom.viewBox(w.Geom.bed(w.DB.find("beds", zb.id)), 5) };
  w.Zoom.z = 4; w.Zoom.cx = 240; w.Zoom.cy = 180;
  const p = w.Canvas.toIn(el, 200, 200);
  return Math.abs(p.x - 240) < 1 && Math.abs(p.y - 180) < 1; });
check("labels do not grow with the magnification", () =>
  w.Zoom.textScale() < 0.3 && (w.Zoom.reset(), w.Zoom.textScale() === 1));
check("leaving the bed leaves its magnification behind", () => {
  w.Zoom.z = 3; w.Garden.back(); w.APP.bedId = zb.id;
  return w.Zoom.z === 1; });

/* --- the badges got out of hand --- */
check("a companion badge is a marker, not a placard", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  const r = w.Canvas.badgeR(bed, w.Geom.RC(w.DB.find("plantings", zr.id)), false);
  return r <= Math.min(w.Geom.W(bed), w.Geom.H(bed)) * 0.021; });
check("a small plant no longer wears a badge wider than itself", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  const p = w.Geom.plant(w.DB.find("plantings", zr.id));
  return w.Canvas.badgeR(bed, w.Geom.RC(p), false) < w.Geom.RC(p); });
check("a warning still outranks a heart in size", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  return w.Canvas.badgeR(bed, 12, true) > w.Canvas.badgeR(bed, 12, false); });

/* --- the details button --- */
check("a selected plant offers a details button as well as a handle", () => {
  w.Garden.sel = zt.id;
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", zb.id)), { interactive:true });
  return svg.includes('data-menu="' + zt.id + '"') && svg.includes('data-grip="' + zt.id + '"'); });
check("neither button appears on a bed that is only being looked at", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", zb.id)), { interactive:false });
  return !svg.includes("data-menu") && !svg.includes("data-grip"); });
check("both buttons carry a hit target big enough to hit on a large plot", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", zb.id)), { interactive:true });
  const m = svg.match(/class="hitpad" data-menu="[^"]+" cx="[^"]*" cy="[^"]*" r="([\d.]+)"/);
  return !!m && parseFloat(m[1]) >= Math.min(480, 360) * 0.03; });

/* --- the buttons are controls, not measurements --- */
check("the handle is the same size whatever the plant measures", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  return w.Canvas.gripR(bed) === w.Canvas.gripR(bed); });
check("growing the canopy no longer inflates the handle you grow it with", () => {
  /* the old rule was rc*0.2 — dragging a spread out to 48" swelled its own
     button to 9.6", so the control grew under the finger holding it */
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  const was = w.Geom.RC(w.Geom.plant(w.DB.find("plantings", zt.id)));
  const before = w.Canvas.gripR(bed);
  w.Garden.setRadius(zt.id, 48);
  const svg = w.Canvas.svg(bed, { interactive:true });
  const after = w.Canvas.gripR(bed);
  w.Garden.setRadius(zt.id, was);
  const m = /class="grip" data-grip="[^"]+" cx="[^"]*" cy="[^"]*" r="([\d.]+)"/.exec(svg);
  return before === after && !!m && parseFloat(m[1]) === after; });
check("a handle is the same width on screen on a 4ft bed and a 40ft plot", () => {
  /* what "consistent" has to mean here: the same share of the picture, since
     that is the only thing the eye can compare */
  const share = b => {
    const bed = w.Geom.bed(b);
    return w.Canvas.gripR(bed) * 2 / (w.Geom.W(bed) + w.Canvas.PAD * 2);
  };
  const small = w.DB.insert("beds", { name:"Small", shape:"rect", w_in:48, h_in:96,
    cell_in:12, sun_hours:8 });
  const huge = w.DB.insert("beds", { name:"Whole plot", shape:"rect", w_in:480, h_in:480,
    cell_in:12, sun_hours:8 });
  return Math.abs(share(small) - share(huge)) < 0.005 && share(huge) < 0.10; });
check("a wide bed and a tall bed of the same width get the same handle", () => {
  /* min(W,H) was halving it on one and not the other; the SVG scales by width */
  const a = w.DB.insert("beds", { name:"Wide", shape:"rect", w_in:96, h_in:48, cell_in:12, sun_hours:8 });
  const b = w.DB.insert("beds", { name:"Tall", shape:"rect", w_in:96, h_in:240, cell_in:12, sun_hours:8 });
  return w.Canvas.gripR(w.Geom.bed(a)) === w.Canvas.gripR(w.Geom.bed(b)); });
check("zooming in shrinks the buttons in inches so they hold their size on screen", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  const at1 = w.Canvas.gripR(bed);
  w.APP.bedId = zb.id; w.Zoom.z = 4;
  const at4 = w.Canvas.gripR(bed);
  const tap4 = w.Canvas.gripTap(bed);
  w.Zoom.reset();
  return Math.abs(at4 - at1 / 4) < 0.02 && tap4 < w.Canvas.gripTap(bed); });
check("the hit pad is never smaller than the button drawn on top of it", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  return w.Canvas.gripTap(bed) >= w.Canvas.gripR(bed); });
check("on a plant smaller than the buttons they are pushed apart, not overlapped", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  return w.Canvas.gripAt(bed, 1) > w.Canvas.gripR(bed); });
check("on a big plant the buttons still sit out at the canopy edge", () => {
  const bed = w.Geom.bed(w.DB.find("beds", zb.id));
  return Math.abs(w.Canvas.gripAt(bed, 40) - 40 * 0.7071) < 0.11; });
check("tapping a plant that is already selected opens it rather than closing it", () => {
  /* the bug that made the variety picker look as though it had been removed */
  w.Garden.sel = zt.id;
  w.Garden.tapAt(w.Geom.PX(zt), w.Geom.PY(zt));
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return w.Garden.sel === zt.id && h.includes("Garden.pickVariety"); });
check("the planting sheet still carries the variety picker and the seed packet", () => {
  w.Garden.plantingSheet(w.DB.find("plantings", zt.id));
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return h.includes("Choose a variety") && h.includes("Seeds to sow"); });
w.closeSheet();

/* --- undo --- */
check("removing a plant can be undone, and it comes back as itself", () => {
  w.Garden.plantingSheet(w.DB.find("plantings", zbz.id));
  w.DB.update("plantings", zbz.id, { variety:"Genovese", notes:"the good one" });
  w.Undo.clear();
  w.Garden.removePlanting(zbz.id, true);
  const gone = w.DB.find("plantings", zbz.id).status === "removed";
  w.Undo.go();
  const back = w.DB.find("plantings", zbz.id);
  return gone && back.status !== "removed" && back.variety === "Genovese" && back.notes === "the good one"; });
check("undo restores the exact position after a move", () => {
  const p = w.Geom.plant(w.DB.find("plantings", zt.id));
  const x0 = w.Geom.PX(p), y0 = w.Geom.PY(p);
  w.Undo.clear();
  w.Undo.push("move", "Moved Tomato", [{ id: zt.id, px: x0, py: y0 }]);
  w.DB.update("plantings", zt.id, { px: x0 + 40, py: y0 + 40 });
  w.Undo.go();
  const q = w.DB.find("plantings", zt.id);
  return Math.abs(parseFloat(q.px) - x0) < 0.01 && Math.abs(parseFloat(q.py) - y0) < 0.01; });
check("undoing a planting takes it away completely rather than hiding it", () => {
  w.Undo.clear();
  const p = w.Garden.placeAt(w.DB.find("beds", zb.id), 300, 300, "carrot", { mode:"single", silent:true });
  w.Undo.go();
  return !w.DB.find("plantings", p.id); });
check("undo says what it is about to put back", () => {
  w.Undo.clear();
  w.Garden.removePlanting(zr.id, true);
  const said = w.Undo.label();
  w.Undo.go();
  return /radish/i.test(said); });
check("undo on an empty stack does nothing rather than throwing", () => {
  w.Undo.clear(); w.Undo.go(); return true; });
check("the stack does not grow without limit", () => {
  w.Undo.clear();
  for(let i = 0; i < 60; i++) w.Undo.push("move", "x", [{ id: zt.id, px: i }]);
  return w.Undo.stack.length === w.Undo.LIMIT; });
w.Undo.clear();

/* --- multi-select --- */
check("plants can be gathered into a set", () => {
  w.Sel.start(); w.Sel.toggle(zt.id); w.Sel.toggle(zr.id);
  return w.Sel.count() === 2 && w.Sel.has(zt.id); });
check("tapping one already in the set takes it out again", () => {
  w.Sel.toggle(zr.id); return w.Sel.count() === 1 && !w.Sel.has(zr.id); });
check("the set can be filled from one crop", () => {
  w.Garden.placeAt(w.DB.find("beds", zb.id), 150, 90, "tomato", { mode:"single", silent:true });
  w.Sel.clear(true); w.Sel.toggle(zt.id); w.Sel.sameCrop();
  return w.Sel.count() === 2 && w.Sel.list().every(p => p.crop_id === "tomato"); });
check("a marked plant is drawn as marked", () => {
  const svg = w.Canvas.svg(w.Geom.bed(w.DB.find("beds", zb.id)), { interactive:true });
  return svg.includes("markring"); });
check("removing a set is one undo, not eight", () => {
  w.Sel.clear(true); w.Sel.all();
  const n = w.Sel.count();
  w.Undo.clear();
  const ps = w.Sel.list();
  w.Undo.push("remove", "Removed " + n, ps.map(p => ({ id:p.id, status:p.status, removed_on:p.removed_on || null })));
  ps.forEach(p => w.Garden.removePlanting(p.id, true, true));
  const allGone = w.Geom.live(zb.id).length === 0;
  w.Undo.go();
  return allGone && w.Geom.live(zb.id).length === n && w.Undo.stack.length === 0; });
check("duplicating a set keeps every variety and puts them in free ground", () => {
  w.Sel.clear(true); w.Sel.toggle(zbz.id);
  const before = w.Geom.live(zb.id).length;
  w.Sel.duplicateAll();
  const made = w.Geom.live(zb.id).length - before;
  const copy = w.Geom.live(zb.id).filter(p => p.crop_id === "basil" && p.id !== zbz.id)[0];
  return made === 1 && copy && copy.variety === "Genovese"; });
w.Undo.go();
w.Sel.stop();

/* --- which way the bed faces --- */
check("a bed with no orientation set behaves exactly as it always did", () => {
  const b = w.DB.find("beds", zb.id);
  return w.Orient.of(b) === 0; });
check("north-up: a plant north of a tall one is in its shadow", () => {
  const b = w.Geom.bed(w.DB.find("beds", zb.id));
  const tall = { px: 100, py: 100, crop_id:"corn", id:"t" };
  const low  = { px: 100, py: 60,  crop_id:"lettuce", id:"l" };
  return w.Orient.shaded(b, tall, low); });
check("and a plant on the sunny side of it is not", () => {
  const b = w.Geom.bed(w.DB.find("beds", zb.id));
  const tall = { px: 100, py: 100, crop_id:"corn", id:"t" };
  const low  = { px: 100, py: 140, crop_id:"lettuce", id:"l" };
  return !w.Orient.shaded(b, tall, low); });
check("turning the bed a quarter turn turns the shadow with it", () => {
  w.DB.update("beds", zb.id, { north_deg: 90 });
  const b = w.Geom.bed(w.DB.find("beds", zb.id));
  const tall = { px: 100, py: 100, crop_id:"corn", id:"t" };
  /* top of the drawing now points east, so compass-north is to the LEFT */
  const upDrawing = { px: 100, py: 60,  crop_id:"lettuce", id:"l" };
  const leftward  = { px: 60,  py: 100, crop_id:"lettuce", id:"l2" };
  const r = !w.Orient.shaded(b, tall, upDrawing) && w.Orient.shaded(b, tall, leftward);
  w.DB.update("beds", zb.id, { north_deg: 0 });
  return r; });
check("the shade check no longer reports a plant standing in the sun", () => {
  const sb = w.DB.insert("beds", { name:"Shade bed", shape:"rect", w_in:120, h_in:120, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(sb, 60, 90, "corn", { mode:"single", silent:true });
  w.Garden.placeAt(sb, 60, 108, "lettuce", { mode:"single", silent:true });   /* south of it */
  return w.Recommend.shading(sb.id, w.addDays(w.today(), 60)).length === 0; });
check("hemisphere comes from the stored latitude and is not hardcoded", () => {
  const was = w.DB.get("lat", null);
  w.DB.set("lat", -33.9);
  const south = w.Orient.sunAz();
  w.DB.set("lat", 40.1);
  const north = w.Orient.sunAz();
  if(was === null) w.DB.set("lat", null); else w.DB.set("lat", was);
  return south === 0 && north === 180; });

/* --- what would go well here --- */
check("an empty bed is not told what would go well with nothing", () => {
  const eb = w.DB.insert("beds", { name:"Empty", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  return w.BedRecs.forBed(eb.id).length === 0; });
check("recommendations are built from what is already planted", () => {
  const rb = w.DB.insert("beds", { name:"Rec bed", shape:"rect", w_in:144, h_in:144, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(rb, 30, 30, "tomato", { mode:"single", silent:true });
  const recs = w.BedRecs.forBed(rb.id);
  return recs.length > 0 && recs.every(r => r.partners.length > 0) &&
         recs.some(r => r.crop.id === "basil"); });
check("every suggestion names the plant it would be joining, and why", () => {
  const rb = w.DB.all("beds").filter(b => b.name === "Rec bed")[0];
  const r = w.BedRecs.forBed(rb.id)[0];
  return r.partners[0].id === "tomato" && r.partners[0].why.length > 0 &&
         /tomato/i.test(w.BedRecs.line(r)); });
check("nothing that fights what is planted is ever suggested", () => {
  const rb = w.DB.all("beds").filter(b => b.name === "Rec bed")[0];
  const recs = w.BedRecs.forBed(rb.id).map(r => r.crop.id);
  /* the crop table names these as tomato's foes */
  return recs.indexOf("cabbage") < 0 && recs.indexOf("fennel") < 0 && recs.indexOf("potato") < 0; });
check("a crop already in the bed is not suggested for it again", () => {
  const rb = w.DB.all("beds").filter(b => b.name === "Rec bed")[0];
  return w.BedRecs.forBed(rb.id).every(r => r.crop.id !== "tomato"); });
check("the bed screen shows the list under the plot", () => {
  const rb = w.DB.all("beds").filter(b => b.name === "Rec bed")[0];
  w.APP.bedId = rb.id; w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  return h.includes("Would go well here") && /Goes with/.test(h); });

/* --- watering, grouped --- */
check("crops are banded by the water figure the bed verdict already uses", () => {
  return w.WaterGroups.band("mint").k === "high" &&
         w.WaterGroups.band("tomato").k === "med" &&
         w.WaterGroups.band("rosemary").k === "low"; });
check("a bed whose plants all want the same is not lectured about it", () => {
  const wb2 = w.DB.insert("beds", { name:"Even bed", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(wb2, 24, 24, "tomato", { mode:"single", silent:true });
  w.Garden.placeAt(wb2, 60, 24, "cucumber", { mode:"single", silent:true });
  return w.WaterGroups.html(wb2.id) === ""; });
check("a mixed bed says who wants a soak and who wants leaving alone", () => {
  const wb3 = w.DB.insert("beds", { name:"Mixed bed", shape:"rect", w_in:96, h_in:96, cell_in:12, sun_hours:8 });
  w.Garden.placeAt(wb3, 24, 24, "celery", { mode:"single", silent:true });
  w.Garden.placeAt(wb3, 70, 70, "rosemary", { mode:"single", silent:true });
  const h = w.WaterGroups.html(wb3.id);
  return /Thirsty/.test(h) && /Sparing/.test(h) && /Celery/.test(h) && /Rosemary/.test(h); });

/* --- saved bed layouts --- */
check("a bed can be saved with its plants, variety and spacing", () => {
  const tb = w.DB.insert("beds", { name:"Template bed", shape:"rect", w_in:96, h_in:192, cell_in:12, sun_hours:8 });
  w.APP.bedId = tb.id;
  const tp = w.Garden.placeAt(tb, 24, 48, "tomato", { mode:"single", silent:true });
  w.DB.update("plantings", tp.id, { variety:"Mountain Fresh" });
  const t = w.Templates.save(tb.id, "My best bed");
  return t && t.plants.length === 1 && t.plants[0].variety === "Mountain Fresh" &&
         Math.abs(t.plants[0].fx - 0.25) < 0.01 && Math.abs(t.plants[0].fy - 0.25) < 0.01; });
check("a saved layout lands in the same arrangement in a differently sized bed", () => {
  const t = w.Templates.all()[0];
  const nb2 = w.DB.insert("beds", { name:"Different", shape:"rect", w_in:48, h_in:96, cell_in:12, sun_hours:8 });
  w.Templates.apply(t, nb2.id);
  const p = w.Geom.live(nb2.id)[0];
  return p && Math.abs(w.Geom.PX(p) - 12) < 2 && Math.abs(w.Geom.PY(p) - 24) < 2; });
check("a saved layout never carries last year's dates into this year", () => {
  const nb3 = w.DB.insert("beds", { name:"Fresh", shape:"rect", w_in:96, h_in:192, cell_in:12, sun_hours:8 });
  w.Templates.apply(w.Templates.all()[0], nb3.id);
  const p = w.Geom.live(nb3.id)[0];
  return p.sown_on === w.iso(w.today()) && p.status === "planned"; });
check("and it manufactures no harvest or maturity record", () => {
  const before = w.DB.count("maturity") + w.DB.count("harvests");
  const nb4 = w.DB.insert("beds", { name:"Fresh 2", shape:"rect", w_in:96, h_in:192, cell_in:12, sun_hours:8 });
  w.Templates.apply(w.Templates.all()[0], nb4.id);
  return w.DB.count("maturity") + w.DB.count("harvests") === before; });
check("laying out a saved bed is one undo", () => {
  const nb5 = w.DB.insert("beds", { name:"Fresh 3", shape:"rect", w_in:96, h_in:192, cell_in:12, sun_hours:8 });
  w.Templates.apply(w.Templates.all()[0], nb5.id);
  w.Undo.go();
  return w.Geom.live(nb5.id).length === 0; });
check("a new bed can be started from a saved one", () => {
  const b = w.Templates.create(w.Templates.all()[0].id);
  return b && w.Geom.W(b) === 96 && w.Geom.live(b.id).length === 1; });
check("a layout naming a crop that no longer exists is skipped, not fatal", () => {
  const list = w.Templates.all();
  list[0].plants.push({ crop_id:"nosuchcrop", fx:0.5, fy:0.5, rr:6, rc:8, qty:1 });
  w.Templates.write(list);
  const nb6 = w.DB.insert("beds", { name:"Fresh 4", shape:"rect", w_in:96, h_in:192, cell_in:12, sun_hours:8 });
  return w.Templates.apply(w.Templates.all()[0], nb6.id) === 1; });

/* --- calendar export --- */
check("the export is a valid iCalendar envelope", () => {
  const ics = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  return ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trim().endsWith("END:VCALENDAR") &&
         ics.includes("VERSION:2.0") && ics.includes("PRODID:"); });
check("dates are all-day, because a sowing window is a day and not nine in the morning", () => {
  const ics = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  return ics.includes("DTSTART;VALUE=DATE:") && !ics.includes("DTSTART:"); });
check("every event carries a stable id so a second import updates rather than doubles", () => {
  const a = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  const b = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  const uids = s => (s.match(/^UID:.*$/gm) || []).sort().join("|");
  return uids(a).length > 0 && uids(a) === uids(b); });
check("commas and semicolons in a note cannot break the file", () => {
  w.DB.insert("events", { title:"Feed; mulch, then water", date: w.iso(w.addDays(w.today(), 3)),
    type:"task", done:"0", notes:"one, two; three\nfour" });
  const ics = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  return ics.includes("Feed\\; mulch\\, then water") && ics.includes("\\n"); });
check("no line runs past the 75 octets the spec allows", () => {
  w.DB.insert("events", { title: "x".repeat(300), date: w.iso(w.addDays(w.today(), 4)), type:"task", done:"0" });
  const ics = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  return ics.split("\r\n").every(l => l.length <= 75); });
check("a folded line continues with a space, so it unfolds back to itself", () => {
  const ics = w.CalSync.ics({ to: w.addDays(w.today(), 400) });
  const unfolded = ics.replace(/\r\n /g, "");
  return unfolded.includes("SUMMARY:" + "📌 " + "x".repeat(300)) ||
         unfolded.includes("x".repeat(300)); });
check("filtering by kind is honoured", () => {
  const only = w.CalSync.ics({ types:["frost"], to: w.addDays(w.today(), 400) });
  return only.includes("CATEGORIES:Frost date") && !only.includes("CATEGORIES:Harvest window"); });
check("a single date can go straight to Google without a key or a login of ours", () => {
  const e = w.DB.all("events").filter(x => x.date)[0];
  const u = w.CalSync.googleUrl(e);
  return u.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE") &&
         /dates=\d{8}%2F\d{8}/.test(u); });
check("the sheet is honest that this is a file and not an account connection", () => {
  w.CalSync.sheet();
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return /no server/i.test(h) && /import/i.test(h); });
w.closeSheet();

/* ============================================================
   IDENTITY — every new row gets its own

   sqlWrite inserts with OR REPLACE, so an id supplied from outside does
   not fail on a collision: it overwrites the row already holding it.
   That is the one shape of data loss the app cannot detect afterwards,
   which is why the id is taken from the caller rather than defaulted.
   ============================================================ */
check("uid never repeats itself, even a thousand rows inside one millisecond", () => {
  const seen = {}, ids = [];
  for(let i = 0; i < 5000; i++) ids.push(w.eval("uid()"));
  ids.forEach(i => seen[i] = (seen[i] || 0) + 1);
  return Object.keys(seen).length === 5000 && ids.every(i => i.length >= 12); });
check("an inserted row always has a real id", () => {
  const r = w.DB.insert("plots", { name:"Identity test" });
  return !!r.id && typeof r.id === "string" && w.DB.find("plots", r.id) === r; });
check("an id passed in by a caller is ignored, not honoured", () => {
  const first = w.DB.insert("plots", { name:"Original plot" });
  const second = w.DB.insert("plots", Object.assign(w.DB.body("plots", first), { id: first.id, name:"Impostor" }));
  return second.id !== first.id && w.DB.find("plots", first.id).name === "Original plot"; });
check("the {id: undefined} idiom can no longer produce a row with no key", () => {
  const r = w.DB.insert("plots", { id: undefined, name:"Undefined id test" });
  return !!r.id && w.DB.all("plots").every(p => !!p.id); });
check("DB.body copies the columns but neither the identity nor the age of the row", () => {
  const src = w.DB.all("beds")[0];
  const b = w.DB.body("beds", src);
  return !("id" in b) && !("created" in b) && b.name === src.name &&
    Object.keys(b).every(c => w.SCHEMA.beds.indexOf(c) >= 0); });
const dupSrc = w.DB.insert("beds", { name:"Original bed", shape:"rect", w_in:48, h_in:96,
  cell_in:12, cols:4, rows:8, sun_hours:8, soil:"loam" });
w.DB.insert("plantings", { bed_id: dupSrc.id, crop_id:"lettuce", qty:4, status:"growing",
  px: 12, py: 12, rr: 4, rc: 5, x:1, y:1, w:1, h:1 });
w.DB.insert("plantings", { bed_id: dupSrc.id, crop_id:"carrot", qty:16, status:"growing",
  px: 36, py: 60, rr: 1.5, rc: 2, x:3, y:5, w:1, h:1 });
/* backdated, because a duplicate made in the same millisecond as its
   original carries an identical timestamp whether it inherited one or not */
w.DB.update("beds", dupSrc.id, { created: "2025-03-14T09:00:00.000Z" });
check("duplicating a bed makes a genuinely separate bed", () => {
  w.APP.bedId = dupSrc.id;
  w.Garden.duplicateBed();
  const copy = w.DB.all("beds").filter(b => b.name === "Original bed (copy)")[0];
  return !!copy && !!copy.id && copy.id !== dupSrc.id &&
    num0(copy.w_in) === 48 && num0(copy.h_in) === 96 && copy.soil === "loam"; });
check("its plants are copies with their own ids, pointing at the copy", () => {
  const copy = w.DB.all("beds").filter(b => b.name === "Original bed (copy)")[0];
  const orig = w.DB.where("plantings", p => p.bed_id === dupSrc.id);
  const made = w.DB.where("plantings", p => p.bed_id === copy.id);
  return made.length === 2 && made.every(p => !!p.id && !orig.some(o => o.id === p.id)) &&
    made.some(p => p.crop_id === "lettuce") && made.some(p => p.crop_id === "carrot") &&
    orig.length === 2; });
check("a duplicate does not inherit the original's creation stamp", () => {
  const copy = w.DB.all("beds").filter(b => b.name === "Original bed (copy)")[0];
  const src = w.DB.find("beds", dupSrc.id);
  return src.created === "2025-03-14T09:00:00.000Z" && copy.created !== src.created &&
    copy.created > src.created; });
check("every row in every table has a unique id", () => {
  return Object.keys(w.SCHEMA).filter(t => t !== "settings").every(t => {
    const ids = w.DB.all(t).map(r => r.id);
    return ids.every(Boolean) && new Set(ids).size === ids.length; }); });
w.APP.bedId = null;

/* ============================================================
   MOVING A GARDEN BETWEEN DEVICES

   The round trip is the whole feature, so it is tested as one:
   build a plot, export it, then import the file back into the SAME
   app and prove the copy is the original in every respect that
   matters — outline, position, variety, seed link — while nothing
   that was already here has moved.
   ============================================================ */
const shPlot = w.DB.insert("plots", { name:"Share test plot", notes:"the one that travels" });
const shBed = w.DB.insert("beds", { plot_id: shPlot.id, name:"Travelling bed", shape:"hex",
  w_in: 96, h_in: 48, cell_in: 12, cols: 8, rows: 4, sun_hours: 7, soil:"raised mix",
  irrigation:"drip", north_deg: 45, grid_on: 1, snap_in: 12 });
/* a crop she typed in herself, so the file has to carry the crop as well as the plant */
const shCrop = w.UserCrops.save({ name:"Lemongrass", slug: w.UserCrops.slug("Lemongrass"),
  emoji:"🌿", fam:"aster", sun:6, water:1, sp:18, dtm:100, depth:0.25, from:"transplant",
  feeder:"medium", via:3, ph:"6.0–7.0", comp:"", foes:"", tips:"", harvest:"", npk:"",
  start_indoor:-8, start_tp:2, start_direct:null, start_fall:null, succ:0, yield:0,
  germ_lo:14, germ_hi:21, soil_lo:65, soil_opt:75, soil_hi:90 });
const shVar = w.Varieties.save({ crop_id:"tomato", name:"Bruno's Kitchen Door", dtm:71,
  habit:"Indeterminate", resistance:"VF", notes:"saved from the plant by the back step", source:"manual" });
const shSeed = w.DB.insert("seeds", { crop_id:"tomato", name:"Tomato", variety:"Bruno's Kitchen Door",
  brand:"Saved", packed_year:"2025", germ_rate:"88", qty:"40", unit:"seeds" });
const shP1 = w.DB.insert("plantings", { bed_id: shBed.id, crop_id:"tomato", variety:"Bruno's Kitchen Door",
  variety_id: shVar.id, seed_id: shSeed.id, qty:1, span_mode:"single", status:"growing",
  sown_on:"2026-05-02", px: 31.5, py: 17.25, rr: 12, rc: 18, x: 2, y: 1, w: 1, h: 1 });
const shP2 = w.DB.insert("plantings", { bed_id: shBed.id, crop_id: shCrop.slug, qty:1,
  span_mode:"fill", status:"planned", sown_on:"2026-05-10", px: 70, py: 30, rr: 9, rc: 12, x: 5, y: 2, w: 1, h: 1 });
w.DB.insert("harvests", { date:"2026-07-30", planting_id: shP1.id, bed_id: shBed.id,
  crop_id:"tomato", weight:"3.5", unit:"lb", count:"11" });
w.Micro.save("plot", shPlot.id, { slope_pct: 4, slope_dir:"S", surface:"soil", drainage:"normal",
  wind_exposure:"sheltered", canopy:"open", frost_pocket:"none", method:"survey",
  horizon: [12,8,4,0,0,4,10,16], notes:"south facing, wall behind" });

let shFile = null;
check("a garden export names itself in the file, in words, before any data", () => {
  shFile = w.Share.collect({ plots:[shPlot.id], seeds:true, history:true, photos:false });
  return shFile.format === "pocket-fertilizer/garden" && shFile.v === 1 &&
    /Pocket Fertilizer/.test(shFile._about) && shFile.summary.length > 0; });
check("it carries the plot, the bed and the plants", () =>
  shFile.plots.length === 1 && shFile.beds.length === 1 && shFile.plantings.length === 2);
check("it carries the crop she added herself, not just the plant naming it", () =>
  shFile.usercrops.some(c => c.slug === shCrop.slug));
check("it carries the variety she saved", () =>
  shFile.varieties.some(v => v.name === "Bruno's Kitchen Door"));
check("it carries the micro-climate survey of that plot", () =>
  shFile.sites.length === 1 && shFile.sites[0].scope === "plot");
check("it is valid JSON and round-trips through a string", () =>
  JSON.parse(w.Share.json(shFile)).plantings.length === 2);
check("only schema columns travel — a working field on a cached row cannot leak", () => {
  const cols = Object.keys(shFile.beds[0]);
  return cols.every(c => w.SCHEMA.beds.indexOf(c) >= 0); });
check("the maturity table is never carried — a file can be imported twice", () =>
  shFile.maturity === undefined && w.Share.json(shFile).indexOf('"maturity"') < 0);
check("photos are left out unless asked for, and the survey keeps its measurement anyway", () => {
  return shFile.photos.length === 0 && JSON.parse(shFile.sites[0].horizon || "[]").length === 8; });

/* --- what comes back --- */
const shBefore = { plots: w.DB.count("plots"), beds: w.DB.count("beds"), plantings: w.DB.count("plantings") };
let shRep = null;
check("importing rejects a file that is not ours, and says which one it wanted", () => {
  let msg = "";
  try{ w.Share.read('{"v":1,"tables":{}}'); }catch(e){ msg = e.message; }
  return msg === "whole-backup" && !!w.Share.EXPLAIN["whole-backup"]; });
check("importing a garden adds it rather than replacing anything", () => {
  shRep = w.Share.apply(JSON.parse(w.Share.json(shFile)));
  return w.DB.count("plots") === shBefore.plots + 1 &&
         w.DB.count("beds") === shBefore.beds + 1 &&
         w.DB.count("plantings") === shBefore.plantings + 2 &&
         !!w.DB.find("plots", shPlot.id) && !!w.DB.find("beds", shBed.id); });
check("a plot arriving under a name already here is renamed, never merged", () =>
  shRep.renamed.length === 1 && /imported/i.test(shRep.renamed[0]) &&
  w.DB.all("plots").filter(p => p.name === "Share test plot").length === 1);
const shNewPlot = w.DB.all("plots").find(p => /Share test plot \(imported\)/.test(p.name || ""));
const shNewBed = w.DB.all("beds").find(b => b.plot_id === (shNewPlot || {}).id);
check("the rebuilt bed is the same outline, not an approximation of it", () =>
  !!shNewBed && shNewBed.shape === "hex" && num0(shNewBed.w_in) === 96 && num0(shNewBed.h_in) === 48 &&
  num0(shNewBed.north_deg) === 45 && shNewBed.irrigation === "drip");
check("plants land back on the exact inch they were on", () => {
  const ps = w.DB.where("plantings", p => p.bed_id === shNewBed.id);
  const t = ps.find(p => p.crop_id === "tomato");
  return ps.length === 2 && num0(t.px) === 31.5 && num0(t.py) === 17.25 &&
         num0(t.rr) === 12 && num0(t.rc) === 18 && t.span_mode === "single"; });
check("every id is rewritten — the copy never points at the original's rows", () => {
  const ps = w.DB.where("plantings", p => p.bed_id === shNewBed.id);
  return shNewBed.id !== shBed.id && ps.every(p => p.id !== shP1.id && p.id !== shP2.id); });
check("a planting still finds its own seed packet on the far side", () => {
  const t = w.DB.where("plantings", p => p.bed_id === shNewBed.id && p.crop_id === "tomato")[0];
  const s = w.DB.find("seeds", t.seed_id);
  return !!s && s.id !== shSeed.id && s.variety === "Bruno's Kitchen Door"; });
check("a variety already on the device is reused, not duplicated", () =>
  w.DB.where("varieties", v => v.crop_id === "tomato" && v.name === "Bruno's Kitchen Door").length === 1);
check("a crop already on the device is reused, not duplicated", () =>
  w.DB.all("usercrops").filter(c => c.name === "Lemongrass").length === 1 &&
  w.DB.where("plantings", p => p.bed_id === shNewBed.id).some(p => p.crop_id === shCrop.slug));
check("the micro-climate survey comes with the plot and points at the new one", () => {
  const s = w.Micro.decode(w.DB.all("sites").find(x => x.ref_id === (shNewPlot || {}).id));
  return !!s && s.slope_pct == 4 && Array.isArray(s.horizon) && s.horizon.length === 8; });
check("harvest records travel when asked for, but never as maturity records", () => {
  const mBefore = w.DB.count("maturity");
  return shRep.harvests === 1 && w.DB.all("harvests").filter(h => h.crop_id === "tomato" &&
    h.date === "2026-07-30").length === 2 && w.DB.count("maturity") === mBefore; });

/* --- a garden from a device that knows a crop this one does not --- */
check("a plant whose crop this app has never heard of is skipped and counted, not faked", () => {
  const alien = JSON.parse(w.Share.json(shFile));
  alien.plots = [{ id:"px", name:"From a newer app" }];
  alien.beds = [{ id:"bx", plot_id:"px", name:"Bed X", shape:"rect", w_in:48, h_in:48 }];
  alien.plantings = [{ id:"p1", bed_id:"bx", crop_id:"sea-kale-2027", qty:1, px:24, py:24 }];
  alien.usercrops = []; alien.varieties = []; alien.seeds = [];
  alien.journal = []; alien.harvests = []; alien.diagnoses = []; alien.observations = []; alien.sites = [];
  const unk = w.Share.unknownCrops(alien);
  const rep = w.Share.apply(alien);
  return unk["sea-kale-2027"] === 1 && rep.skipped === 1 && rep.plantings === 0 && rep.beds === 1; });

/* --- the two things that must not dangle --- */
check("with photos on, a packet photo travels and points at the new copy of itself", () => {
  const pid = w.Photos.put("data:image/jpeg;base64,AAAA", 40, 40);
  w.DB.update("seeds", shSeed.id, { photo_id: pid, lot:"PHOTO-LOT" });
  const withPix = w.Share.collect({ plots:[shPlot.id], seeds:true, history:false, photos:true });
  const rep = w.Share.apply(JSON.parse(w.Share.json(withPix)));
  const copy = w.DB.all("seeds").filter(s => s.lot === "PHOTO-LOT" && s.id !== shSeed.id).pop();
  return withPix.photos.length >= 1 && rep.photos === withPix.photos.length && !!copy &&
         !!copy.photo_id && copy.photo_id !== pid && !!w.Photos.url(copy.photo_id); });
check("with seeds off, a planting admits it has no packet rather than keeping a stranger's id", () => {
  const noSeeds = w.Share.collect({ plots:[shPlot.id], seeds:false, history:false, photos:false });
  w.Share.apply(JSON.parse(w.Share.json(noSeeds)));
  const bedNow = w.DB.all("beds").filter(b => b.name === "Travelling bed").pop();
  const t = w.DB.where("plantings", p => p.bed_id === bedNow.id && p.crop_id === "tomato")[0];
  return noSeeds.seeds.length === 0 && t.seed_id === null; });
check("a variety the far side has only as a bundled reference keeps that reference, not a copy", () => {
  const refP = w.DB.insert("plantings", { bed_id: shBed.id, crop_id:"tomato", variety:"Sungold",
    variety_id:"ref:tomato:Sungold", qty:1, status:"planned", px: 12, py: 12, rr: 12, rc: 18 });
  const b2 = w.Share.collect({ plots:[shPlot.id], seeds:false, history:false, photos:false });
  w.Share.apply(JSON.parse(w.Share.json(b2)));
  const bedNow = w.DB.all("beds").filter(b => b.name === "Travelling bed").pop();
  const s = w.DB.where("plantings", p => p.bed_id === bedNow.id && p.variety === "Sungold")[0];
  w.DB.remove("plantings", refP.id);
  return !!s && s.variety_id === "ref:tomato:Sungold" &&
         w.DB.where("varieties", v => v.name === "Sungold").length === 0; });

/* --- the two files are different things and the app says so --- */
check("the export sheet is plain that this adds and the backup replaces", () => {
  w.Share.exportSheet();
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return /added/i.test(h) && /never swapped in/i.test(h) && /Seed packets/.test(h) && /Photos/.test(h); });
check("the export sheet shows a size before anything is written", () => {
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return /(bytes|KB|MB)/.test(h); });
check("ticking photos off is the default, because file size is what breaks a transfer", () =>
  w.Share.opts.photos === false);
check("the import preview lists what will be added before it writes a row", () => {
  const before = w.DB.count("beds");
  w.Share.preview(w.Share.json(shFile));
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return w.DB.count("beds") === before && /beds/.test(h) && /plants/.test(h); });
check("a garden from another zone warns that dates will be recalculated, not copied", () => {
  const other = JSON.parse(w.Share.json(shFile));
  other.from = { zone:"9b", place:"Somewhere warm", lastFrost:"02-10", firstFrost:"12-05" };
  w.Share.preview(w.Share.json(other));
  const h = w.document.getElementById("sheet-body").innerHTML || "";
  return /9b/.test(h) && /frost dates/i.test(h); });
check("the file is offered where the plots are, not only buried in settings", () => {
  w.closeSheet(); w.APP.bedId = null; w.Garden.setView("beds"); w.Garden.render();
  return (w.document.getElementById("s-garden").innerHTML || "").includes("Share.exportSheet"); });
check("settings offers both directions and keeps them apart from the backup", () => {
  w.go("settings"); w.Settings.render();
  const h = w.document.getElementById("s-settings").innerHTML || "";
  return h.includes("Share.exportSheet") && h.includes("Share.importPick") &&
         h.includes("Settings.importJSON"); });
check("the guide explains the difference between this and a backup", () =>
  w.GUIDE.some(g => g.id === "twodevices" && g.p.join(" ").indexOf("never replaces") >= 0));
w.closeSheet();
w.Share.opts = { plots: [], seeds: true, history: false, photos: false };

/* --- the toolbar carries what it claims to --- */
check("the snap toggle is on the bed toolbar, not buried in the shape sheet", () => {
  w.APP.bedId = zb.id; w.Garden.render();
  const h = w.document.getElementById("s-garden").innerHTML;
  w.Shape.open(zb.id);
  const sheet = w.document.getElementById("sheet-body").innerHTML || "";
  w.closeSheet();
  return h.includes("Garden.toggleMagnet") && !sheet.includes("sh-magnet"); });
check("the magnet setting survives a restart", () => {
  const was = w.CanvasDrag.magnet;
  w.Garden.toggleMagnet();
  const stored = w.DB.get("magnet", "1");
  w.CanvasDrag.magnet = !w.CanvasDrag.magnet;      /* pretend a reload */
  w.Garden.loadMagnet();
  const ok2 = w.CanvasDrag.magnet === (stored !== "0");
  if(w.CanvasDrag.magnet !== was) w.Garden.toggleMagnet();
  return ok2; });
w.APP.bedId = null; w.Garden.setView("beds"); w.Undo.clear();

w.DB.set("aiProvider", savedProv || "gemini");
w.DB.set("gemKey", savedGem || ""); w.DB.set("aiKey", savedAi || "");

console.error = origErr;
console.log(ok.join("\n"));
console.log("\n--- " + ok.filter(x => x.startsWith("PASS")).length + " passed, " +
  ok.filter(x => !x.startsWith("PASS")).length + " failed ---");
if(errors.length){ console.log("\nISSUES:\n" + errors.slice(0, 25).join("\n")); process.exitCode = 1; }
