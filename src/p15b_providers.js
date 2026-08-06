<script>
/* ============================================================
   ASSISTANT PROVIDERS — Google Gemini or Anthropic Claude
   Model names move. Rather than hardcode one and break later,
   the app ships current defaults AND can ask the API which
   models the key can actually use.
   ============================================================ */
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

const PROVIDERS = {
  gemini: {
    n:"Google Gemini", key:"gemKey", model:"gemModel",
    def:"gemini-3.6-flash",
    models:[
      ["gemini-3.6-flash","Fast, cheap, handles everything here"],
      ["gemini-3.5-flash","Previous Flash generation"],
      ["gemini-3.5-flash-lite","Cheapest, lowest latency"],
      ["gemini-3.1-pro","Slower and stronger"]
    ],
    getKey:"https://aistudio.google.com/apikey",
    hint:"Free tier is generous. No card required."
  },
  claude: {
    n:"Anthropic Claude", key:"aiKey", model:"claudeModel",
    def:"claude-sonnet-5",
    models:[
      ["claude-sonnet-5","Balanced — the default"],
      ["claude-opus-5","Most capable, slower and dearer"],
      ["claude-haiku-4-5-20251001","Fastest and cheapest"]
    ],
    getKey:"https://console.anthropic.com/settings/keys",
    hint:"Pay as you go. Set a spend cap in the console."
  }
};

/* retire model names that Google has since withdrawn */
(function migrateModels(){
  const dead = /^(gemini-2\.|gemini-1\.|models\/gemini-2\.)/;
  const m = DB.get("gemModel", "");
  if(m && dead.test(m)) DB.set("gemModel", PROVIDERS.gemini.def);
  if(!DB.get("aiProvider")) DB.set("aiProvider", "gemini");
})();

Object.assign(Assist, {
  prov(){ return PROVIDERS[DB.get("aiProvider", "gemini")] || PROVIDERS.gemini; },
  apiKey(){ return DB.get(Assist.prov().key, ""); },
  modelName(){ const p = Assist.prov(); return DB.get(p.model, p.def) || p.def; },
  ready(){ return !!Assist.apiKey(); },

  /* ---- ask the API which models this key can use ---- */
  async fetchModels(){
    const p = Assist.prov(), key = Assist.apiKey();
    if(!key) throw new Error("Add a key first");
    if(DB.get("aiProvider") === "gemini"){
      const r = await fetch(GEM_URL.replace(/models\/$/, "models") + "?key=" + encodeURIComponent(key));
      if(!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return (j.models || [])
        .filter(m => (m.supportedGenerationMethods || []).indexOf("generateContent") >= 0)
        .map(m => String(m.name || "").replace(/^models\//, ""))
        .filter(n => n && n.indexOf("embedding") < 0)
        .sort();
    }
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers:{ "x-api-key": key, "anthropic-version":"2023-06-01",
                "anthropic-dangerous-direct-browser-access":"true" }
    });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return (j.data || []).map(m => m.id).filter(Boolean);
  },

  /* ---- tool schema conversion ---- */
  claudeTools(){
    const lower = o => {
      if(!o || typeof o !== "object") return o;
      const out = Array.isArray(o) ? [] : {};
      Object.keys(o).forEach(k => {
        let v = o[k];
        if(k === "type" && typeof v === "string") v = v.toLowerCase();
        else v = lower(v);
        out[k] = v;
      });
      return out;
    };
    return AI_TOOLS.map(t => ({
      name: t.name, description: t.description,
      input_schema: Object.assign({ type:"object", properties:{} }, lower(t.parameters))
    }));
  },

  /* ---- one turn against whichever provider is selected ---- */
  async send(text){
    if(Assist.busy) return;
    if(!Assist.ready()){ Assist.setup(); return; }
    text = String(text || "").trim(); if(!text) return;

    Assist.msgs.push({ who:"me", text: text });
    Assist.busy = true; Assist.draw(true);
    try{
      if(DB.get("aiProvider") === "claude") await Assist.turnClaude(text);
      else await Assist.turnGemini(text);
    }catch(e){
      Assist.msgs.push({ who:"err", text: Assist.explain(e) });
    }
    Assist.busy = false; Assist.draw(true);
  },

  explain(e){
    const m = String(e && e.message || e || "");
    if(/404/.test(m)) return "That model is no longer available on your key. Open Settings → Gardening assistant and tap “Refresh models from my key” to pick a current one.";
    if(/401|403/.test(m)) return "The API key was rejected. Check it in Settings.";
    if(/429/.test(m)) return "Rate limited. Wait a moment and try again.";
    if(/Failed to fetch|NetworkError/i.test(m)) return "Could not reach the service — you may be offline. Everything else in the app still works.";
    return m || "Something went wrong.";
  },

  async turnGemini(text){
    Assist.history.push({ role:"user", parts:[{ text: text }] });
    let hops = 0;
    while(hops++ < 5){
      const r = await fetch(GEM_URL + Assist.modelName() + ":generateContent?key=" + encodeURIComponent(Assist.apiKey()), {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          systemInstruction:{ parts:[{ text: Assist.system() }] },
          contents: Assist.history,
          tools:[{ functionDeclarations: AI_TOOLS }],
          generationConfig:{ temperature:0.3, maxOutputTokens:1200 }
        })
      });
      if(!r.ok){ const b = await r.text().catch(() => ""); throw new Error("Gemini " + r.status + " " + b.slice(0, 160)); }
      const j = await r.json();
      const cand = (j.candidates || [])[0];
      if(!cand) throw new Error("Gemini returned nothing.");
      const parts = (cand.content || {}).parts || [];
      Assist.history.push({ role:"model", parts: parts });
      const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);
      const say = parts.map(p => p.text || "").join("").trim();
      if(calls.length){
        if(say) Assist.msgs.push({ who:"ai", text: say });
        const responses = [];
        for(const call of calls){
          Assist.msgs.push({ who:"act", text: Assist.label(call) });
          Assist.draw(true);
          responses.push({ functionResponse:{ name: call.name, response: await Assist.run(call.name, call.args) } });
        }
        Assist.history.push({ role:"user", parts: responses });
        continue;
      }
      Assist.msgs.push({ who:"ai", text: say || "…" });
      if(DB.get("gemSpeak")) Assist.speak(say);
      return;
    }
  },

  async turnClaude(text){
    Assist.history.push({ role:"user", content:[{ type:"text", text: text }] });
    let hops = 0, allowSearch = true;
    while(hops++ < 5){
      const body = {
        model: Assist.modelName(), max_tokens: 1500,
        system: Assist.system(),
        messages: Assist.history,
        tools: Assist.claudeTools()
      };
      if(allowSearch) body.tools = body.tools.concat([{ type:"web_search_20250305", name:"web_search", max_uses: 3 }]);
      const r = await fetch(CLAUDE_URL, {
        method:"POST",
        headers:{ "content-type":"application/json", "x-api-key": Assist.apiKey(),
                  "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify(body)
      });
      if(!r.ok){
        const b = await r.text().catch(() => "");
        /* older keys or models may not have the server-side search tool — drop it and retry once */
        if(allowSearch && r.status === 400 && /web_search/.test(b)){ allowSearch = false; hops--; continue; }
        throw new Error("Claude " + r.status + " " + b.slice(0, 160));
      }
      const j = await r.json();
      const content = j.content || [];
      Assist.history.push({ role:"assistant", content: content });
      const calls = content.filter(c => c.type === "tool_use");
      const say = content.filter(c => c.type === "text").map(c => c.text).join("").trim();
      if(calls.length){
        if(say) Assist.msgs.push({ who:"ai", text: say });
        const results = [];
        for(const call of calls){
          Assist.msgs.push({ who:"act", text: Assist.label({ name: call.name, args: call.input }) });
          Assist.draw(true);
          const out = await Assist.run(call.name, call.input);
          results.push({ type:"tool_result", tool_use_id: call.id, content: JSON.stringify(out) });
        }
        Assist.history.push({ role:"user", content: results });
        continue;
      }
      Assist.msgs.push({ who:"ai", text: say || "…" });
      if(DB.get("gemSpeak")) Assist.speak(say);
      return;
    }
  },

  /* ---- setup sheet ---- */
  setup(){
    const pk = DB.get("aiProvider", "gemini"), p = PROVIDERS[pk];
    const cur = Assist.modelName();
    const custom = DB.get(p.model + "List", null);
    const list = custom && custom.length ? custom.map(m => [m, ""]) : p.models;
    const has = list.some(m => m[0] === cur);

    openSheet("Gardening assistant",
      '<div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Provider</div>' +
      '<div class="seg">' +
        Object.keys(PROVIDERS).map(k => '<button class="' + (k === pk ? "on" : "") + '" onclick="Assist.setProvider(\'' + k + '\')">' +
          esc(PROVIDERS[k].n) + '</button>').join("") +
      '</div>' +
      '<p class="muted sm" style="margin-top:12px">Runs on your own account, so usage bills to you. ' + esc(p.hint) + '</p>' +
      '<div class="note g"><b>Getting a key</b><br>Open <a href="' + esc(p.getKey) + '" target="_blank" rel="noopener noreferrer">' +
        esc(p.getKey.replace("https://", "")) + ' ↗</a>, create a key, and paste it below.</div>' +
      '<div class="field" style="margin-top:12px"><label class="f">' + esc(p.n) + ' API key</label>' +
        '<input type="password" id="gm-key" placeholder="' + (pk === "gemini" ? "AIza…" : "sk-ant-…") + '" value="' + esc(DB.get(p.key, "")) + '"></div>' +
      '<div class="field"><label class="f">Model</label><select id="gm-model">' +
        list.map(m => '<option value="' + esc(m[0]) + '"' + (m[0] === cur ? " selected" : "") + '>' +
          esc(m[0]) + (m[1] ? " — " + m[1] : "") + '</option>').join("") +
        (has ? "" : '<option value="' + esc(cur) + '" selected>' + esc(cur) + ' (saved)</option>') +
      '</select></div>' +
      '<button class="btn ghost block sm" style="margin-top:8px" onclick="Assist.refreshModels()">↻ Refresh models from my key</button>' +
      '<div id="gm-models" class="tiny muted" style="margin-top:6px">Model names change over time. This asks the API what your key can actually use right now.</div>' +
      '<div class="row between" style="margin-top:14px"><div class="b sm">Read answers aloud</div>' +
        '<button class="switch ' + (DB.get("gemSpeak") ? "on" : "") + '" id="gm-speak"></button></div>' +
      '<div class="note w" style="margin-top:14px">The key is stored inside your encrypted vault on this device. It is still a browser-held key, so give it a spend cap and remove it here when you stop using it.</div>' +
      '<button class="btn block" style="margin-top:12px" onclick="Assist.saveKey()">Save and start</button>' +
      (DB.get(p.key) ? '<button class="btn ghost block" style="margin-top:8px" onclick="DB.set(\'' + p.key + '\',\'\');closeSheet();Assist.draw();toast(\'Disconnected\')">Disconnect</button>' : ''));
    const sw = $("#gm-speak"); if(sw) sw.onclick = () => sw.classList.toggle("on");
  },

  setProvider(k){
    const keep = $("#gm-key") ? $("#gm-key").value.trim() : null;
    if(keep !== null) DB.set(Assist.prov().key, keep);
    DB.set("aiProvider", k);
    Assist.setup();
  },

  async refreshModels(){
    const out = $("#gm-models");
    const p = Assist.prov();
    const typed = $("#gm-key") ? $("#gm-key").value.trim() : "";
    if(typed) DB.set(p.key, typed);
    out.innerHTML = '<span class="spinner"></span> Asking the API…';
    try{
      const models = await Assist.fetchModels();
      if(!models.length) throw new Error("none returned");
      DB.set(p.model + "List", models);
      const sel = $("#gm-model"), cur = sel.value;
      sel.innerHTML = models.map(m => '<option value="' + esc(m) + '"' + (m === cur ? " selected" : "") + '>' + esc(m) + '</option>').join("");
      if(models.indexOf(cur) < 0){
        const pick = models.find(m => /flash/.test(m) && !/lite|embedding/.test(m)) ||
                     models.find(m => /sonnet/.test(m)) || models[0];
        sel.value = pick;
      }
      out.innerHTML = '<span style="color:var(--green-600)">✅ ' + models.length + ' models available on your key.</span>';
    }catch(e){
      out.innerHTML = '<span style="color:var(--danger)">Could not list models: ' + esc(Assist.explain(e)) + '</span>';
    }
  },

  saveKey(){
    const p = Assist.prov();
    const k = $("#gm-key").value.trim();
    DB.set(p.key, k);
    DB.set(p.model, $("#gm-model").value || p.def);
    DB.set("gemSpeak", $("#gm-speak").classList.contains("on"));
    closeSheet(); Assist.draw();
    toast(k ? "Assistant ready ✨" : "Key cleared");
  }
});

/* the empty-state copy should name whichever provider is selected */
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
    const m = txt.match(/\{[\s\S]*\}/);
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
};

/* ============================================================
   ASK — the same idea as Vision, for a question with no picture.

   The variety lookup used to POST to the Gemini endpoint itself,
   read DB.get("gemKey") and DB.get("gemModel") directly, and hide
   its own button unless a Gemini key was set. So a gardener on
   Claude had a working assistant and no "Look it up" button at
   all, and one on Gemini got a raw "HTTP 400" or a JSON.parse
   syntax error in the sheet. That is the identical mistake the
   packet reader made before Vision existed, which is why this is
   a shared path and not another local fetch.

   Web search is on by default, because a variety name is exactly
   the kind of thing a model should look up rather than recall.
   ============================================================ */

/* Pull the FIRST COMPLETE object out of a model's answer.

   The old code used /\{[\s\S]*\}/ — first brace to LAST brace. Greedy,
   so any prose containing a closing brace after the object got swallowed
   into the match, and JSON.parse then threw a syntax error that went
   straight to the screen. Search grounding makes that likely rather than
   rare: the model narrates around the JSON and cites as it goes. This
   walks the braces instead, honouring strings and escapes. */
function firstJsonObject(txt){
  const s = String(txt || "").replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if(start < 0) return null;
  let depth = 0, inStr = false, escaped = false;
  for(let i = start; i < s.length; i++){
    const c = s[i];
    if(inStr){
      if(escaped) escaped = false;
      else if(c === "\\") escaped = true;
      else if(c === '"') inStr = false;
      continue;
    }
    if(c === '"') inStr = true;
    else if(c === "{") depth++;
    else if(c === "}"){ if(!--depth) return s.slice(start, i + 1); }
  }
  return null;                      /* unterminated — usually a truncated answer */
}

const Ask = {
  ready(){ return !!Assist.apiKey(); },
  who(){ return Assist.prov().n; },

  /* Vision's wording assumes a photo — "try a better-lit shot of the front"
     is nonsense advice for a question that was only ever text. The two
     answers that differ are answered here and the rest defers. */
  explain(e){
    const m = String(e && e.message || e || "");
    if(m === "no-json") return "Could not make sense of the answer. Try the full variety name as it appears on the packet.";
    if(m === "no-key")  return "No AI key connected yet. Settings → The assistant → Connect.";
    return Vision.explain(e);
  },

  /* returns { text, sources:[title…] } */
  async text(prompt, opts){
    opts = opts || {};
    if(!Assist.apiKey()) throw new Error("no-key");
    const max = opts.maxTokens || 800;
    let search = opts.search !== false;

    if(DB.get("aiProvider") === "claude"){
      /* two passes at most: the second only happens if the server-side
         search tool is rejected, which older keys and models do */
      for(let attempt = 0; attempt < 2; attempt++){
        const body = { model: Assist.modelName(), max_tokens: max,
                       messages:[{ role:"user", content: prompt }] };
        if(search) body.tools = [{ type:"web_search_20250305", name:"web_search", max_uses: 3 }];
        const r = await fetch(CLAUDE_URL, {
          method:"POST",
          headers:{ "content-type":"application/json", "x-api-key": Assist.apiKey(),
                    "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
          body: JSON.stringify(body)
        });
        if(!r.ok){
          const b = await r.text().catch(() => "");
          if(search && r.status === 400 && /web_search|tool/.test(b)){ search = false; continue; }
          throw new Error("Claude " + r.status + " " + b.slice(0, 160));
        }
        const j = await r.json();
        const content = j.content || [];
        const srcs = [];
        content.forEach(c => {
          if(c.type === "web_search_tool_result")
            (c.content || []).forEach(w => { if(w.title) srcs.push(w.title); });
        });
        return { text: content.filter(c => c.type === "text").map(c => c.text || "").join("").trim(),
                 sources: srcs.slice(0, 3) };
      }
    }

    const body = { contents:[{ role:"user", parts:[{ text: prompt }] }],
                   generationConfig:{ temperature: 0.1, maxOutputTokens: max } };
    /* google_search and responseMimeType:"application/json" are mutually
       exclusive on Gemini — asking for both is a 400. Search wins, and the
       object gets dug out of the prose by firstJsonObject. */
    if(search) body.tools = [{ google_search:{} }];
    else if(opts.json) body.generationConfig.responseMimeType = "application/json";
    const r = await fetch(GEM_URL + Assist.modelName() + ":generateContent?key=" + encodeURIComponent(Assist.apiKey()), {
      method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(body)
    });
    /* the body carries Google's actual complaint; throwing "HTTP 400" alone
       is what made this feature impossible to diagnose from a phone */
    if(!r.ok){ const b = await r.text().catch(() => ""); throw new Error("Gemini " + r.status + " " + b.slice(0, 160)); }
    const j = await r.json();
    const cand = (j.candidates || [])[0];
    if(!cand){
      const blocked = ((j.promptFeedback || {}).blockReason) || "";
      throw new Error(blocked ? "The service refused that question (" + blocked + ")." : "The service returned nothing.");
    }
    const gm = cand.groundingMetadata || {};
    return { text: (((cand.content || {}).parts) || []).map(p => p.text || "").join("").trim(),
             sources: (gm.groundingChunks || []).map(g => (g.web || {}).title).filter(Boolean).slice(0, 3) };
  },

  /* same, but insists on an object and hands it back parsed */
  async json(prompt, opts){
    const a = await Ask.text(prompt, Object.assign({ json:true }, opts || {}));
    const raw = firstJsonObject(a.text);
    if(!raw) throw new Error("no-json");
    let data;
    try{ data = JSON.parse(raw); }
    catch(err){ throw new Error("no-json"); }
    return { data: data, sources: a.sources };
  }
};
</script>
