/* Applies the camera/AI fixes to src/. Idempotent — safe to re-run if a
   OneDrive sync ever rolls the sources back.
     node apply_camera_fix.mjs && node build.mjs && node src/smoke.mjs dist/index.html
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

let changed = 0, already = 0;
/* `tag` doubles as the idempotency marker: a string that appears in the new
   text and nowhere in the old. Deriving the marker from the start of `to`
   does not work — most replacements begin with unchanged context. */
function sub(file, from, to, marker){
  const p = path.join(src, file);
  let s = fs.readFileSync(p, "utf8");
  if(!to.includes(marker)) throw new Error(`[${file}] marker "${marker}" is not in the replacement text`);
  if(s.includes(marker)){ already++; return; }
  if(!s.includes(from)) throw new Error(`[${file}] anchor not found for "${marker}":\n${from.slice(0,160)}`);
  fs.writeFileSync(p, s.replace(from, to));
  changed++;
}

/* ============================================================
   1. p3_core.js — a shared rear-facing camera helper
   ============================================================ */
sub("p3_core.js",
`  return { get, set, del, get backend(){ return idb ? "IndexedDB" : "localStorage"; } };
})();`,
`  return { get, set, del, get backend(){ return idb ? "IndexedDB" : "localStorage"; } };
})();

/* ---------- camera ----------
   This app photographs plants and seed packets. It should never open
   pointing at the gardener's face.

   facingMode:{ideal:"environment"} is only a preference — a browser is free
   to hand back the front camera and report success, which is what some
   Android builds do. So: demand the rear camera outright, and only relax
   the constraint if the device genuinely has no rear camera.            */
const Cam = {
  supported(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },

  async rear(extra){
    if(!Cam.supported()) throw new Error("no-camera");
    const base = Object.assign({ width:{ ideal:1280 }, height:{ ideal:1280 } }, extra || {});
    const tries = [
      Object.assign({ facingMode:{ exact:"environment" } }, base),
      Object.assign({ facingMode:{ ideal:"environment" } }, base)
    ];

    /* if the device lists its cameras, name the rear one explicitly —
       the most reliable route on Android, where labels are consistent */
    try{
      if(navigator.mediaDevices.enumerateDevices){
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === "videoinput");
        const back = cams.find(d => /back|rear|environment/i.test(d.label || ""));
        if(back) tries.unshift(Object.assign({ deviceId:{ exact: back.deviceId } }, base));
      }
    }catch(e){ /* labels need permission first; the facingMode attempts cover it */ }

    let last = null;
    for(const video of tries){
      try{ return await navigator.mediaDevices.getUserMedia({ video: video, audio:false }); }
      catch(e){ last = e; }
    }
    /* genuinely no rear camera — a laptop, say. Better a front camera than none. */
    try{ return await navigator.mediaDevices.getUserMedia({ video:true, audio:false }); }
    catch(e){ throw last || e; }
  },

  stop(stream){ if(stream) try{ stream.getTracks().forEach(t => t.stop()); }catch(e){} }
};`, "const Cam = {");

/* ============================================================
   2. p1_head.html — a visual cue for fields the app filled in
   ============================================================ */
sub("p1_head.html",
`@keyframes spin{to{transform:rotate(360deg)}}`,
`@keyframes spin{to{transform:rotate(360deg)}}
/* a field the app filled in from a photo — visibly the app's guess, still fully editable */
input.ai-filled,textarea.ai-filled,select.ai-filled{border-color:var(--green-500);background:var(--green-100);animation:aifill .5s ease-out}
@keyframes aifill{from{background:var(--green-300)}to{background:var(--green-100)}}`, "input.ai-filled");

/* ============================================================
   3. p15b_providers.js — one provider-agnostic vision path
   ============================================================ */
sub("p15b_providers.js",
`/* the empty-state copy should name whichever provider is selected */
Assist.providerName = () => Assist.prov().n;`,
`/* the empty-state copy should name whichever provider is selected */
Assist.providerName = () => Assist.prov().n;

/* ============================================================
   VISION — one image-reading path shared by the seed packet
   reader and the Plant Doctor.

   Both used to call the Anthropic endpoint directly and were
   gated on DB.get("aiKey"). The app defaults to Gemini, so a
   gardener who connected Gemini saw no camera reading at all —
   the buttons never rendered. Everything now goes through here
   and follows whichever provider is actually connected.
   ============================================================ */
const Vision = {
  ready(){ return !!Assist.apiKey(); },
  who(){ return Assist.prov().n; },

  /* photo: a row from the photos table ({mime, data}) or a photo id */
  photo(p){
    if(!p) return null;
    if(typeof p === "string") p = DB.find("photos", p);
    return p && p.data ? p : null;
  },

  /* an image to read but not to keep — never touches the vault */
  fromDataUrl(dataUrl){
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
    return m ? { mime: m[1], data: m[2] } : null;
  },

  /* returns the model's plain-text answer */
  async ask(photo, prompt, opts){
    opts = opts || {};
    const ph = Vision.photo(photo);
    if(!ph) throw new Error("no-photo");
    if(!Assist.apiKey()) throw new Error("no-key");
    const mime = ph.mime || "image/jpeg";
    const max = opts.maxTokens || 900;

    if(DB.get("aiProvider") === "claude"){
      const r = await fetch(CLAUDE_URL, {
        method:"POST",
        headers:{ "content-type":"application/json", "x-api-key": Assist.apiKey(),
                  "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({
          model: Assist.modelName(), max_tokens: max,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type: mime, data: ph.data } },
            { type:"text", text: prompt }
          ]}]
        })
      });
      if(!r.ok){ const b = await r.text().catch(() => ""); throw new Error("Claude " + r.status + " " + b.slice(0, 160)); }
      const j = await r.json();
      return (j.content || []).map(c => c.text || "").join("").trim();
    }

    const gen = { temperature: 0.1, maxOutputTokens: max };
    if(opts.json) gen.responseMimeType = "application/json";
    const r = await fetch(GEM_URL + Assist.modelName() + ":generateContent?key=" + encodeURIComponent(Assist.apiKey()), {
      method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({
        contents:[{ role:"user", parts:[
          { inline_data:{ mime_type: mime, data: ph.data } },
          { text: prompt }
        ]}],
        generationConfig: gen
      })
    });
    if(!r.ok){ const b = await r.text().catch(() => ""); throw new Error("Gemini " + r.status + " " + b.slice(0, 160)); }
    const j = await r.json();
    const cand = (j.candidates || [])[0];
    if(!cand){
      const blocked = ((j.promptFeedback || {}).blockReason) || "";
      throw new Error(blocked ? "The service refused that image (" + blocked + ")." : "The service returned nothing.");
    }
    return (((cand.content || {}).parts) || []).map(p => p.text || "").join("").trim();
  },

  /* same, but insists on a JSON object and hands it back parsed */
  async json(photo, prompt){
    const txt = await Vision.ask(photo, prompt, { json:true, maxTokens: 900 });
    const m = txt.match(/\\{[\\s\\S]*\\}/);
    if(!m) throw new Error("no-json");
    return JSON.parse(m[0]);
  },

  /* plain-language failures — a gardener should never see a status code alone */
  explain(e){
    const m = String(e && e.message || e || "");
    if(m === "no-key")   return "No AI key connected yet. Settings → The assistant → Connect.";
    if(m === "no-photo") return "Take or choose a photo first.";
    if(m === "no-json")  return "Could not make sense of the packet. Try a straighter, better-lit shot of the front.";
    if(/40[13]/.test(m)) return "The API key was rejected. Check it in Settings.";
    if(/404/.test(m))    return "That model is not available on your key. Settings → The assistant → Refresh models from my key.";
    if(/429/.test(m))    return "Rate limited — wait a moment and try again.";
    if(/Failed to fetch|NetworkError/i.test(m)) return "Could not reach " + Vision.who() + " — you may be offline. Everything else still works.";
    if(/^(Gemini|Claude) /.test(m)) return m.replace(/^(Gemini|Claude) /, Vision.who() + " error ");
    return m || "Something went wrong.";
  }
};`, "const Vision = {");

/* ============================================================
   4. p9_seeds.js — auto-read the packet
   ============================================================ */
sub("p9_seeds.js",
`    const cur = Object.assign({}, s || {}, prefill || {});
    const yr = today().getFullYear();
    let h = '';`,
`    const cur = Object.assign({}, s || {}, prefill || {});
    const yr = today().getFullYear();
    Seeds._readState = null;
    Seeds._aiFields = {};
    Seeds._readSrc = null;
    /* "Packed for year" is pre-filled with this year as a convenience. That is a
       default, not something she typed, so the packet reader may replace it. */
    Seeds._defaults = { "#sd-packed": cur.packed_year ? "" : String(yr) };
    let h = '';`, "Seeds._readSrc = null;");

sub("p9_seeds.js",
`    if(DB.get("aiKey")) h += '<button class="btn outline block sm" style="margin-bottom:12px" onclick="Seeds.readPacket()">✨ Read the packet with AI</button>';`,
`    h += '<div id="sd-airead" style="margin-bottom:12px">' + Seeds.readBlock() + '</div>';`, "sd-airead");

sub("p9_seeds.js",
`  capture(useCamera){
    const inp = useCamera ? $("#filepick-cam") : $("#filepick");
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files[0]; if(!f) return;
      try{
        const r = await shrinkImage(f, 900, 0.72);
        if(Seeds._photoId) Photos.drop(Seeds._photoId);
        Seeds._photoId = Photos.put(r.dataUrl, r.w, r.h);
        $("#sd-photo").innerHTML = Seeds.photoBlock(Seeds._photoId);
        toast("Photo attached");
      }catch(e){ toast("Could not read that image"); }
    };
    inp.click();
  },`,
`  capture(useCamera){
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
  paint(){ const b = $("#sd-airead"); if(b) b.innerHTML = Seeds.readBlock(); },`, "readBlock(state)");

const oldRead = fs.readFileSync(path.join(src, "p9_seeds.js"), "utf8")
  .match(/  \/\* ---------- optional AI packet reader ---------- \*\/[\s\S]*?\n  \}\n\};/);
if(oldRead){
  const NEW_READ = `  /* ---------- reading the packet photo ----------
     Models are cheerful about returning "approx. 25 seeds", "Packed for 2025"
     or "10/2026" in fields that are <input type="number"> and <input type="date">.
     A browser silently rejects a value it cannot parse, which is exactly what
     "the picture appears but nothing fills in" looks like. So every value is
     coerced to the shape its input accepts before it is written.            */
  PACKET_PROMPT:
    "This is a photograph of a garden seed packet. Read the printed text and return ONLY a JSON " +
    "object — no prose, no markdown fence — with exactly these keys:\\n" +
    '{"crop":"","name":"","variety":"","brand":"","qty":"","unit":"","packed_year":"","exp_date":"",' +
    '"germ_rate":"","notes":""}\\n' +
    "crop = the plain common vegetable/herb/flower name only, e.g. \\"tomato\\", \\"cucumber\\", \\"sweet pepper\\".\\n" +
    "name = what the packet calls itself, e.g. \\"Cherry Tomato\\".\\n" +
    "variety = the cultivar only, e.g. \\"Sungold\\" — not the crop name.\\n" +
    "brand = the seed company.\\n" +
    "qty = a bare number only (no words or units). unit = one of: seeds, grams, oz, packets, cloves, slips.\\n" +
    "packed_year = a 4-digit year. exp_date = YYYY-MM-DD. germ_rate = a bare number 0-100.\\n" +
    "notes = the planting instructions printed on the packet, condensed to two or three short sentences.\\n" +
    "Use an empty string for anything not printed on the packet or not legible. Never guess or invent a value.",

  /* value coercion */
  _num(v){ const m = String(v == null ? "" : v).replace(/,/g, "").match(/-?\\d+(?:\\.\\d+)?/); return m ? m[0] : ""; },
  _year(v){ const m = String(v == null ? "" : v).match(/\\b(19|20)\\d{2}\\b/); return m ? m[0] : ""; },
  _date(v){
    const s = String(v == null ? "" : v).trim();
    if(!s) return "";
    let m = s.match(/\\b(\\d{4})-(\\d{2})-(\\d{2})\\b/); if(m) return m[0];
    /* a packet usually prints a month and year — treat that as the end of that month */
    m = s.match(/\\b(\\d{1,2})\\s*[\\/.-]\\s*((?:19|20)\\d{2})\\b/);
    if(m){ const mo = clamp(num(m[1], 1), 1, 12), yr = num(m[2]);
      return iso(new Date(yr, mo, 0)); }
    m = s.match(/\\b((?:19|20)\\d{2})\\s*[\\/.-]\\s*(\\d{1,2})\\b/);
    if(m){ const yr = num(m[1]), mo = clamp(num(m[2], 1), 1, 12);
      return iso(new Date(yr, mo, 0)); }
    m = s.match(/\\b((?:19|20)\\d{2})\\b/);
    if(m) return m[1] + "-12-31";
    return "";
  },
  _unit(v){
    const s = String(v == null ? "" : v).trim().toLowerCase();
    const opts = ["seeds","grams","oz","packets","cloves","slips"];
    if(opts.indexOf(s) >= 0) return s;
    if(/^(g|gram|gm|gms)\\b/.test(s)) return "grams";
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
};`;
  const p = path.join(src, "p9_seeds.js");
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(oldRead[0], NEW_READ));
  changed++;
} else already++;

/* ============================================================
   5. p10_doctor.js — rear camera + provider-agnostic vision
   ============================================================ */
sub("p10_doctor.js",
`    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      toast("Live camera needs https — using your camera app instead"); return Doctor.pick(true);
    }
    try{
      Doctor.stopCamera();
      Doctor.stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 } }, audio:false });`,
`    if(!Cam.supported()){
      toast("Live camera needs https — using your camera app instead"); return Doctor.pick(true);
    }
    try{
      Doctor.stopCamera();
      Doctor.stream = await Cam.rear();`, "Cam.rear()");

sub("p10_doctor.js",
`  stopCamera(){ if(Doctor.stream){ Doctor.stream.getTracks().forEach(t => t.stop()); Doctor.stream = null; } },`,
`  stopCamera(){ Cam.stop(Doctor.stream); Doctor.stream = null; },`, "Cam.stop(Doctor.stream)");

sub("p10_doctor.js",
`    if(DB.get("aiKey")) h += '<button class="btn outline block" style="margin-top:8px" onclick="Doctor.aiDiagnose()">✨ Also ask Claude to look at the photo</button>';`,
`    if(Vision.ready() && Doctor.photoId)
      h += '<button class="btn outline block" style="margin-top:8px" onclick="Doctor.aiDiagnose()">✨ Also ask ' + esc(Vision.who()) + ' to look at the photo</button>';
    h += '<div id="dx-aistatus" style="margin-top:8px"></div>';`, "dx-aistatus");

sub("p10_doctor.js",
`  async aiDiagnose(){
    const key = DB.get("aiKey"); if(!key) return toast("Add a Claude API key in Settings");
    if(!Doctor.photoId) return toast("Take a photo first");
    const p = DB.find("photos", Doctor.photoId);
    const cropId = $("#dx-crop") ? $("#dx-crop").value : "";
    const syms = Object.keys(Doctor.picked).join(", ");
    toast("Asking Claude…");
    try{
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "content-type":"application/json", "x-api-key": key,
                  "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({
          model: DB.get("claudeModel", "claude-sonnet-5"), max_tokens: 900,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type: p.mime, data: p.data } },
            { type:"text", text:
              "You are a plant pathologist helping a home gardener." +
              (cropId ? " The crop is " + cropName(cropId) + "." : "") +
              (syms ? " They report: " + syms + "." : "") +
              " Give: 1) the most likely diagnosis with a confidence percentage, 2) two alternatives worth ruling out and how to tell them apart, " +
              "3) what to do in the next 48 hours, 4) prevention. Be concrete and brief. If the photo is too unclear to judge, say so plainly." }
          ]}]
        })
      });
      if(!r.ok) throw new Error("API " + r.status);
      const j = await r.json();
      const txt = (j.content || []).map(c => c.text || "").join("").trim();
      const html = esc(txt).replace(/\\n\\n/g, "</p><p>").replace(/\\n/g, "<br>");`,
`  async aiDiagnose(){
    if(!Vision.ready()) return Assist.setup();
    if(!Doctor.photoId) return toast("Take a photo first");
    const cropId = $("#dx-crop") ? $("#dx-crop").value : "";
    const syms = Object.keys(Doctor.picked).join(", ");
    const status = $("#dx-aistatus");
    if(status) status.innerHTML = '<div class="note i sm"><span class="spinner"></span> Asking ' + esc(Vision.who()) + ' to look at the photo…</div>';
    try{
      const txt = await Vision.ask(Doctor.photoId,
        "You are a plant pathologist helping a home gardener." +
        (cropId ? " The crop is " + cropName(cropId) + "." : "") +
        (syms ? " They report: " + syms + "." : "") +
        " Give: 1) the most likely diagnosis with a confidence percentage, 2) two alternatives worth ruling out and how to tell them apart, " +
        "3) what to do in the next 48 hours, 4) prevention. Be concrete and brief. If the photo is too unclear to judge, say so plainly.",
        { maxTokens: 900 });
      if(!txt) throw new Error("empty");
      const html = esc(txt).replace(/\\n\\n/g, "</p><p>").replace(/\\n/g, "<br>");`, "await Vision.ask(Doctor.photoId");

sub("p10_doctor.js",
`    }catch(e){ toast("AI request failed: " + (e.message || "error")); }
  }
};`,
`    }catch(e){
      const msg = Vision.explain(e);
      const st = $("#dx-aistatus");
      if(st) st.innerHTML = '<div class="note d sm"><b>Could not get an AI opinion.</b><br>' + esc(msg) +
        '</div><div class="tiny muted" style="margin-top:6px">The symptom-based diagnosis above works without it.</div>';
      else toast(msg);
    }
  }
};`, "Could not get an AI opinion");

/* ============================================================
   6. p12_library.js — the crash that stopped a key being saved
   ============================================================ */
sub("p12_library.js",
`  saveKey(){
    const k = $("#st-key").value.trim();
    DB.set("aiKey", k); DB.set("aiModel", $("#st-model").value.trim() || "claude-sonnet-5");
    toast(k ? "AI features enabled" : "Key removed"); Settings.render();
  },`,
`  saveKey(){
    /* The live settings screen (p12b) renders only #st-key. Reading #st-model
       unguarded threw on null, so the key was never saved and every AI button
       stayed hidden — with no error the gardener could see. */
    const keyEl = $("#st-key"); if(!keyEl) return;
    const k = keyEl.value.trim();
    DB.set("aiKey", k);
    const modelEl = $("#st-model");
    const m = modelEl ? modelEl.value.trim() : "";
    if(m){ DB.set("aiModel", m); DB.set("claudeModel", m); }
    else if(!DB.get("claudeModel")) DB.set("claudeModel", PROVIDERS.claude.def);
    /* a key pasted here is an Anthropic key — point the app at that provider
       so the packet reader and Plant Doctor actually use it */
    if(k) DB.set("aiProvider", "claude");
    toast(k ? "AI features enabled" : "Key removed"); Settings.render();
  },`, "const keyEl = $(\"#st-key\")");

/* ============================================================
   7. p12b_settings.js — settings copy matches reality
   ============================================================ */
sub("p12b_settings.js",
`  doctorAI: { t:"Photo diagnosis by AI",
    b:"Optional. Adds a second opinion on plant problems from a photo, and can read a seed packet picture to fill in the details for you. Everything in the Plant Doctor works without it.",
    tech:"Uses the Anthropic API with a vision model. Sends only the photo you capture plus the symptoms you ticked. The rules-based diagnosis runs entirely on-device and is unaffected." },`,
`  doctorAI: { t:"Reading photos with AI",
    b:"Optional. Photograph a seed packet and the app reads it and fills in the crop, variety, brand, dates and planting notes for you — you check them and correct anything before saving. It also adds a second opinion on plant problems from a photo. Everything in the Plant Doctor works without it.",
    tech:"Uses whichever provider the assistant is connected to — Google Gemini or Anthropic Claude — with a vision model. Sends only the photo you capture plus, for a diagnosis, the symptoms you ticked. Packet reading asks for strict JSON and every value is coerced and range-checked before it reaches a field, so an unreadable value leaves the field blank rather than silently failing. The rules-based diagnosis runs entirely on-device and is unaffected." },`, "Reading photos with AI\",");

sub("p12b_settings.js",
`    h += '<div class="card" style="margin-top:12px">' +
      '<div class="row" style="gap:6px"><div class="b">AI photo diagnosis</div>' + infoBtn("doctorAI") + '</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">Optional. ' + (DB.get("aiKey") ? "Connected." : "Not connected — the Plant Doctor works without it.") + '</div>' +
      '<div class="field"><label class="f">Claude API key</label><input type="password" id="st-key" value="' + esc(DB.get("aiKey") || "") + '" placeholder="sk-ant-…"></div>' +
      '<button class="btn ghost block sm" style="margin-top:10px" onclick="Settings.saveKey()">Save key</button></div>';`,
`    h += '<div class="card" style="margin-top:12px">' +
      '<div class="row" style="gap:6px"><div class="b">Reading photos with AI</div>' + infoBtn("doctorAI") + '</div>' +
      '<div class="tiny muted" style="margin-bottom:10px">' + (Vision.ready()
        ? "On — using " + esc(Vision.who()) + ". Seed packets fill themselves in from a photo, and the Plant Doctor can give a second opinion."
        : "Off. Photographing a seed packet will not fill in the fields until an assistant key is connected. Everything else works without it.") + '</div>' +
      '<button class="btn ' + (Vision.ready() ? "ghost " : "") + 'block sm" onclick="Assist.setup()">' +
        (Vision.ready() ? "Change provider or key" : "Connect an AI key") + '</button>' +
      '<div class="tiny muted" style="margin-top:8px">This uses the same key as the ✨ Ask tab — Gemini or Claude, whichever you connected.</div></div>';`, "Change provider or key");

/* ============================================================
   8. p16_sources_ui.js — bump the build stamp
   ============================================================ */
/* A parallel session shipped its own build under .13, so .13 was already live
   without these fixes. The in-app updater compares this constant and tells the
   user they are current if it has not moved — so the stamp must go past it. */
const WANT_BUILD = "2026-08-02.14";
{
  const p = path.join(src, "p16_sources_ui.js");
  let s = fs.readFileSync(p, "utf8");
  const cur = (s.match(/const BUILD = "([^"]+)"/) || [])[1];
  if(cur && cur !== WANT_BUILD && cur < WANT_BUILD){
    fs.writeFileSync(p, s.replace(/const BUILD = "[^"]+"/, `const BUILD = "${WANT_BUILD}"`));
    changed++;
  } else already++;
}

/* ============================================================
   9. smoke.mjs — repair a stale path
   ============================================================ */
{
  const p = path.join(src, "smoke.mjs");
  let s = fs.readFileSync(p, "utf8");
  if(s.includes('"_build/p16_sources_ui.js"')){
    fs.writeFileSync(p, s.replace('"_build/p16_sources_ui.js"', '"src/p16_sources_ui.js"'));
    changed++;
  } else already++;
}

/* ============================================================
   10. smoke.mjs — ignore jsdom's own unimplemented-feature noise.
   "Not implemented: navigation" fires when a rendered <a target=_blank>
   is followed; it is jsdom missing a feature, not the app failing, and
   it was drowning real console errors depending on await timing.
   ============================================================ */
sub("smoke.mjs",
`console.error = (...a) => { errors.push("console.error: " + a.join(" ")); };`,
`const JSDOM_NOISE = /^Not implemented:/;
console.error = (...a) => {
  const m = a.join(" ");
  if(!JSDOM_NOISE.test(m)) errors.push("console.error: " + m);
};`, "JSDOM_NOISE");

/* ============================================================
   11. smoke.mjs — checks covering everything above
   ============================================================ */
sub("smoke.mjs",
`console.error = origErr;
console.log(ok.join("\\n"));`,
String.raw`/* ============================================================
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

w.DB.set("aiProvider", savedProv || "gemini");
w.DB.set("gemKey", savedGem || ""); w.DB.set("aiKey", savedAi || "");

console.error = origErr;
console.log(ok.join("\n"));`, "CAMERA → AI: seed packet reading");

console.log(`Applied ${changed} change(s); ${already} already in place.`);
