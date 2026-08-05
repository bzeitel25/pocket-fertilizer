/* End-to-end check of the camera → AI → form path against a stubbed API.
   Verifies the actual outbound request shape for both providers, then drives
   Seeds.capture()'s file handler exactly as the phone would.
     node verify_camera.mjs dist/index.html                                  */
import { JSDOM } from "/tmp/chk/node_modules/jsdom/lib/api.js";
import fs from "fs";
import { webcrypto } from "crypto";

const html = fs.readFileSync(process.argv[2] || "dist/index.html", "utf8");
const seen = [];
let reply = null;

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://local.test/",
  beforeParse(w){
    Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){} });
    w.scrollTo = () => {};
    w.fetch = async (url, opts) => {
      seen.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null, headers: (opts||{}).headers });
      if(!reply) return { ok:false, status:500, text: async () => "no stub" };
      return { ok:true, status:200, json: async () => reply, text: async () => JSON.stringify(reply) };
    };
    w.HTMLCanvasElement.prototype.getContext = function(){
      return { drawImage(){}, getImageData(){ return { data: new Uint8ClampedArray(4).fill(120) }; },
        fillRect(){}, set fillStyle(v){}, get fillStyle(){ return "#000"; } };
    };
    w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,UEFDS0VU";
    /* jsdom cannot decode images; pretend the decode succeeded */
    class FakeImage {
      set src(v){ this._src = v; this.width = 1200; this.height = 1600; setTimeout(() => this.onload && this.onload(), 0); }
      get src(){ return this._src; }
    }
    w.Image = FakeImage;
  }
});
const w = dom.window;
await new Promise(r => setTimeout(r, 700));
const G = w.eval("({DB,Seeds,Vision,Assist,PROVIDERS,Photos,CROPS,closeSheet})");
/* the first-run onboarding sheet fires on a timer and would replace the form
   mid-test — dismiss it and mark the app as already set up */
G.DB.set("onboarded", 1);
await new Promise(r => setTimeout(r, 900));
G.closeSheet();
await new Promise(r => setTimeout(r, 350));

const results = [];
const t = (name, pass, detail) => results.push([pass ? "PASS" : "FAIL", name, detail || ""]);

const PACKET = { crop:"cucumber", name:"Marketmore 76 Cucumber", variety:"Marketmore 76",
  brand:"Botanical Interests", qty:"about 30 seeds", unit:"Seeds", packed_year:"Packed for 2026",
  exp_date:"09/2027", germ_rate:"80%", notes:"Sow 1/2 inch deep after frost. Thin to 12 inches." };

/* ---------- 1. Gemini request shape ---------- */
G.DB.set("aiProvider", "gemini"); G.DB.set("gemKey", "AIza-verify"); G.DB.set("gemModel", "gemini-3.6-flash");
seen.length = 0;
reply = { candidates:[{ content:{ parts:[{ text: JSON.stringify(PACKET) }] } }] };
let out = await G.Vision.json({ mime:"image/jpeg", data:"UEFDS0VU" }, "read this");
let req = seen[0];
t("Gemini: hits the generateContent endpoint with the key", /generativelanguage.*gemini-3\.6-flash:generateContent\?key=AIza-verify/.test(req.url), req.url.replace(/key=.*/, "key=…"));
t("Gemini: sends the image as inline_data with its mime type",
  req.body.contents[0].parts[0].inline_data.mime_type === "image/jpeg" &&
  req.body.contents[0].parts[0].data === undefined &&
  req.body.contents[0].parts[0].inline_data.data === "UEFDS0VU");
t("Gemini: asks for JSON back", req.body.generationConfig.responseMimeType === "application/json");
t("Gemini: parsed the packet", out.brand === "Botanical Interests");

/* ---------- 2. Claude request shape ---------- */
G.DB.set("aiProvider", "claude"); G.DB.set("aiKey", "sk-ant-verify"); G.DB.set("claudeModel", "claude-sonnet-5");
seen.length = 0;
reply = { content:[{ type:"text", text: JSON.stringify(PACKET) }] };
out = await G.Vision.json({ mime:"image/jpeg", data:"UEFDS0VU" }, "read this");
req = seen[0];
t("Claude: hits the messages endpoint", req.url === "https://api.anthropic.com/v1/messages");
t("Claude: sends the key and the browser-access header",
  req.headers["x-api-key"] === "sk-ant-verify" && req.headers["anthropic-dangerous-direct-browser-access"] === "true");
t("Claude: sends a base64 image block",
  req.body.messages[0].content[0].source.type === "base64" &&
  req.body.messages[0].content[0].source.media_type === "image/jpeg");
t("Claude: parsed the packet", out.variety === "Marketmore 76");

/* ---------- 3. the real capture handler, phone-style ---------- */
G.DB.set("aiProvider", "gemini");
reply = { candidates:[{ content:{ parts:[{ text: "```json\n" + JSON.stringify(PACKET) + "\n```" }] } }] };
seen.length = 0;

G.Seeds.form(null);
const photosBefore = G.DB.count("photos");
const inp = w.document.getElementById("filepick-cam");
const file = new w.File([new Uint8Array([1,2,3])], "packet.jpg", { type:"image/jpeg" });
Object.defineProperty(inp, "files", { value: [file], configurable: true });
G.Seeds.capture(true);            // wires inp.onchange and clicks
await inp.onchange();             // the phone returning from the camera app
await new Promise(r => setTimeout(r, 60));

const v = id => { const e = w.document.getElementById(id); return e ? e.value : null; };
t("capture attaches the photo", G.DB.count("photos") === photosBefore + 1);
t("capture reads it without being asked", seen.length === 1, seen.length + " API call(s)");
t("a fenced ```json reply is still parsed", v("sd-brand") === "Botanical Interests");
t("crop recognised from the packet", v("sd-crop") === "cucumber", v("sd-cropname"));
t("name filled", v("sd-name") === "Marketmore 76 Cucumber");
t("variety filled", v("sd-var") === "Marketmore 76");
t("'about 30 seeds' lands in a number field", v("sd-qty") === "30");
t("'Packed for 2026' lands in a number field", v("sd-packed") === "2026");
t("'09/2027' becomes a real date", v("sd-exp") === "2027-09-30");
t("'80%' lands in a number field", v("sd-germ") === "80");
t("unit dropdown set", v("sd-unit") === "seeds");
t("planting notes carried over", (v("sd-notes") || "").includes("1/2 inch"));
t("fields are flagged for review", w.document.querySelectorAll("#sheet-body .ai-filled").length >= 6);
t("the strip tells her to check them",
  w.document.getElementById("sd-airead").innerHTML.includes("Check each field"));
t("a re-run button is offered anyway",
  w.document.getElementById("sd-airead").innerHTML.includes("Read the photo again"));

/* the stored photo must be the small one, not the high-res copy sent for reading */
const stored = G.DB.all("photos").slice(-1)[0];
t("only the thumbnail is stored in the vault", stored.w <= 900 && stored.h <= 900, stored.w + "x" + stored.h);

/* ---------- 4. she edits, then saves ---------- */
w.document.getElementById("sd-var").value = "Marketmore (her correction)";
G.Seeds.save();
const saved = G.DB.all("seeds").find(s => s.name === "Marketmore 76 Cucumber");
t("her edit is what gets saved", saved && saved.variety === "Marketmore (her correction)");
t("the rest of the read values save with it", saved && saved.crop_id === "cucumber" && String(saved.germ_rate) === "80");

const bad = results.filter(r => r[0] === "FAIL");
results.forEach(r => console.log(r[0] + " " + r[1] + (r[2] ? "  (" + r[2] + ")" : "")));
console.log("\n--- " + (results.length - bad.length) + " passed, " + bad.length + " failed ---");
if(bad.length) process.exitCode = 1;
