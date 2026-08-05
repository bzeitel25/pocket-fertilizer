<script>
/* ============================================================
   MICRO-CLIMATE — the survey

   Two ways in, and the second never depends on the first:

   1. Guided photo survey. Stand in the spot, shoot the four
      directions. Each shot is followed by the questions that make
      the picture readable — which way you were facing, what time
      it is, whether that ground is flat — and the answers plus the
      garden's latitude let the app work out where the sun was at
      the moment of the shot. A photo taken at a known time from a
      known bearing is not a picture, it is a measurement: if the
      sun was 40° up in the south-east and this spot was in shade,
      something 40° high stands to the south-east. That single
      geometric fact is worth more than any amount of guessing.

   2. The same form, filled in by hand. Everything the camera path
      produces is an editable estimate in that form. No API key,
      no camera, no network.
   ============================================================ */

const MicroUI = {
  cap: null, stream: null,

  DIRS: [["N",0,"north"],["E",90,"east"],["S",180,"south"],["W",270,"west"]],
  SLOPES: [["flat",0,"Flat"],["slight",5,"Slight"],["moderate",12,"Moderate"],["steep",25,"Steep"]],

  /* ---------- entry point ---------- */
  open(scope, refId){
    Micro.invalidate();
    const isPlot = scope === "plot";
    const name = isPlot ? (DB.find("plots", refId) || {}).name : (DB.find("beds", refId) || {}).name;
    if(!name) return toast("That is gone");
    const site = Micro.row(scope, refId);
    const d = site ? Micro.derive(Object.assign({}, Micro.DEFAULTS, site)) : null;

    let h = '<p class="muted sm" style="margin-top:0">' +
      (isPlot ? 'Everything in <b>' + esc(name) + '</b> inherits this. A single bed can still override it.'
              : 'This overrides the plot profile for <b>' + esc(name) + '</b> only.') + '</p>';

    if(!site){
      h += '<div class="note i"><b>Why this is worth five minutes.</b> Your zone describes a whole county. It cannot know that the strip in front of the house bakes against a wall and never sees rain under the eaves, while the bed out back loses the afternoon to a maple and frosts a week early. That is the difference between a crop and a shrug.</div>';
    } else {
      h += MicroUI.summary(d);
    }

    h += '<div class="row" style="gap:8px;margin-top:14px">' +
      '<button class="btn grow" onclick="MicroUI.capture(\'' + scope + '\',\'' + refId + '\')">📷 Survey with photos</button>' +
      '<button class="btn ghost grow" onclick="MicroUI.form(\'' + scope + '\',\'' + refId + '\')">✏️ ' + (site ? "Edit by hand" : "Enter by hand") + '</button></div>';
    if(!Vision.ready()) h += '<div class="tiny muted" style="margin-top:8px">No AI key connected, so the photo survey will measure light and shadow on-device and ask you the rest. It still works.</div>';
    if(site) h += '<button class="btn ghost block" style="margin-top:8px" onclick="MicroUI.remove(\'' + scope + '\',\'' + refId + '\')">Delete this profile</button>';

    openSheet("Micro-climate · " + name, h);
  },

  remove(scope, refId){
    confirmSheet("Delete the profile?", "The survey for this " + scope + " is removed and it falls back to the garden's general figures.",
      "Delete", () => { Micro.clear(scope, refId); Garden.render(); toast("Profile deleted"); }, true);
  },

  /* ---------- the derived picture, in plain language ---------- */
  summary(d){
    if(!d) return "";
    let h = '<div class="card" style="margin-top:12px">';
    h += '<div class="grid3">' +
      '<div class="stat"><span class="n">' + (d.sunKnown ? d.sunGrowing + "h" : "—") + '</span><span class="l">sun in season</span></div>' +
      '<div class="stat"><span class="n">' + (d.waterFactor > 1 ? "+" : "") + Math.round((d.waterFactor - 1) * 100) + '%</span><span class="l">water</span></div>' +
      '<div class="stat"><span class="n">' + (d.seasonShift > 0 ? "+" : "") + d.seasonShift + 'd</span><span class="l">season</span></div>' +
      '</div>';
    if(d.sunKnown){
      h += '<div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Direct sun by month</div>';
      h += MicroUI.sunChart(d);
      h += '<div class="tiny muted" style="margin-top:6px">' +
        (d.band ? '<b>' + esc(d.band) + '</b> through the growing season' : '') +
        (d.aspect ? ' · ' + esc(d.aspect) : '') + '</div>';
    }
    if(d.lastFrost || d.firstFrost){
      h += '<div class="note ' + (d.seasonShift < 0 ? "w" : d.seasonShift > 0 ? "g" : "i") + '" style="margin-top:12px">🌡️ <b>This spot\'s own frost dates.</b> Last ' +
        fmt(d.lastFrost) + ', first ' + fmt(d.firstFrost) +
        (d.seasonShift ? ' — ' + Math.abs(d.seasonShift) + ' days ' + (d.seasonShift > 0 ? "longer" : "shorter") + ' than the garden average.' : ' — the same as the garden average.') +
        '</div>';
    }
    d.why.forEach(w => h += '<div class="note ' + w.k + '" style="margin-top:8px"><b>' + esc(w.t) + '</b><br>' + esc(w.m) + '</div>');
    h += '<div class="tiny muted" style="margin-top:10px">Sun hours are real solar geometry for latitude ' +
      (d.lat === null || d.lat === undefined ? "—" : (Math.round(num(d.lat) * 100) / 100)) +
      '°, blocked by the skyline you recorded. Water, wind and frost figures are estimates from that skyline and your answers — edit any of them.</div>';
    h += '</div>';
    return h;
  },

  sunChart(d){
    const max = Math.max(1, Math.ceil(Math.max.apply(null, d.sunByMonth)));
    const grow = Micro.growMonths();
    let h = '<div class="row" style="gap:3px;align-items:flex-end;height:64px">';
    d.sunByMonth.forEach((v, m) => {
      const pct = Math.round(v / max * 100);
      const on = grow.indexOf(m) >= 0;
      h += '<div class="grow" style="text-align:center" title="' + esc(MONF[m]) + ': ' + v + 'h">' +
        '<div style="height:' + Math.max(2, Math.round(pct * 0.46)) + 'px;border-radius:4px 4px 0 0;background:' +
        (on ? "var(--green-600)" : "var(--line)") + '"></div>' +
        '<div class="tiny muted" style="font-size:.55rem;margin-top:3px">' + MON[m][0] + '</div></div>';
    });
    h += '</div>';
    return h;
  },

  /* ============================================================
     THE PHOTO SURVEY
     ============================================================ */
  capture(scope, refId){
    MicroUI.cap = { scope: scope, refId: refId, shots: [], i: 0 };
    MicroUI.shotStep();
  },

  shotStep(){
    const c = MicroUI.cap; if(!c) return;
    if(c.i >= MicroUI.DIRS.length) return MicroUI.finish();
    const d = MicroUI.DIRS[c.i];
    const done = c.shots.filter(s => s.photo).length;
    let h = '<div class="row between" style="margin-bottom:10px"><div>' +
      '<div class="b">Face ' + esc(d[2]) + ' and shoot</div>' +
      '<div class="tiny muted">Stand in the middle of the space. Hold the phone level, take in the whole skyline.</div></div>' +
      '<div style="font-size:2rem">🧭</div></div>';
    h += '<div class="row" style="gap:6px;margin-bottom:10px">' +
      MicroUI.DIRS.map((x, i) => '<span class="chip ' + (i === c.i ? "on" : (c.shots[i] && c.shots[i].photo ? "good" : "")) + '" style="flex:1;text-align:center;justify-content:center">' +
        x[0] + '</span>').join("") + '</div>';
    h += '<div id="mc-cam"></div>';
    h += '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button class="btn grow" onclick="MicroUI.camStart()">📷 Open camera</button>' +
      '<button class="btn ghost grow" onclick="MicroUI.pick(true)">Snapshot</button>' +
      '<button class="btn ghost" onclick="MicroUI.pick(false)">🖼️</button></div>';
    h += '<button class="btn outline block" style="margin-top:8px" onclick="MicroUI.skipShot()">Skip ' + esc(d[2]) + ' →</button>';
    if(done) h += '<button class="btn ghost block sm" style="margin-top:6px" onclick="MicroUI.finish()">Done — use the ' + done + ' shot' + (done > 1 ? "s" : "") + ' I have</button>';
    h += '<div class="note i" style="margin-top:12px">Photos are read at full size and thrown away; only a small thumbnail is kept, inside your encrypted vault.</div>';
    openSheet("Survey · " + (c.i + 1) + " of 4", h, () => MicroUI.camStop());
  },

  async camStart(){
    const wrap = $("#mc-cam"); if(!wrap) return;
    if(!Cam.supported()){ toast("Live camera needs https — using your camera app"); return MicroUI.pick(true); }
    try{
      MicroUI.camStop();
      MicroUI.stream = await Cam.rear();
      wrap.innerHTML = '<video id="mcfeed" playsinline autoplay muted></video>' +
        '<button class="btn block" style="margin-top:8px" onclick="MicroUI.snap()">◉ Capture</button>';
      const v = $("#mcfeed"); v.srcObject = MicroUI.stream; await v.play();
    }catch(e){ toast("Camera blocked — using your photo library"); MicroUI.pick(true); }
  },
  camStop(){ Cam.stop(MicroUI.stream); MicroUI.stream = null; },

  snap(){
    const v = $("#mcfeed"); if(!v) return;
    const s = Math.min(1, 1400 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    MicroUI.camStop();
    MicroUI.got(c.toDataURL("image/jpeg", 0.8), c);
  },
  pick(useCamera){
    const inp = useCamera ? $("#filepick-cam") : $("#filepick");
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files[0]; if(!f) return;
      try{ const r = await shrinkImage(f, 1400, 0.8); MicroUI.got(r.dataUrl, r.canvas); }
      catch(e){ toast("Could not read that image"); }
    };
    inp.click();
  },

  skipShot(){ const c = MicroUI.cap; c.shots[c.i] = null; c.i++; MicroUI.shotStep(); },

  /* the reading copy is never stored — same rule as the seed packet reader */
  async got(dataUrl, canvas){
    const c = MicroUI.cap; if(!c) return;
    const thumb = await MicroUI.thumb(canvas);
    c.pending = {
      dir: MicroUI.DIRS[c.i][0],
      bearing: MicroUI.DIRS[c.i][1],
      reading: Vision.fromDataUrl(dataUrl),
      light: MicroUI.light(canvas),
      photoId: thumb,
      at: new Date()
    };
    MicroUI.questions();
    /* the compass is a nicety — it must never hold up the form */
    MicroUI.heading().then(deg => {
      if(deg === null || !MicroUI.cap || !MicroUI.cap.pending) return;
      MicroUI.cap.pending.compass = deg;
      const el = $("#mq-compass");
      if(el){
        el.innerHTML = '🧭 Compass says <b>' + Math.round(deg) + '° (' + MicroUI.nearest(deg) + ')</b> — tap to use it';
        el.style.display = "";
        el.onclick = () => { MicroUI.setBearing(deg); toast("Using the compass reading"); };
      }
    });
  },

  thumb(canvas){
    return new Promise(res => {
      const s = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
      const c = document.createElement("canvas");
      c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
      c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
      res(Photos.put(c.toDataURL("image/jpeg", 0.7), c.width, c.height));
    });
  },

  nearest(deg){
    const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
    return Micro.SECTORS[i];
  },
  setBearing(deg){
    if(!MicroUI.cap || !MicroUI.cap.pending) return;
    MicroUI.cap.pending.bearing = Math.round(((deg % 360) + 360) % 360);
    const sel = $("#mq-dir"); if(sel) sel.value = String(Math.round(MicroUI.cap.pending.bearing / 45) * 45 % 360);
  },

  /* ---------- the questions that make a photo readable ---------- */
  questions(){
    const p = MicroUI.cap.pending;
    const nowStr = String(p.at.getHours()).padStart(2, "0") + ":" + String(p.at.getMinutes()).padStart(2, "0");
    const lat = DB.get("lat", null), lon = DB.get("lon", null);
    const sun = (lat !== null && lon !== null) ? Solar.now(num(lat), num(lon), p.at) : null;

    let h = '<div class="row" style="gap:10px;margin-bottom:12px">' +
      '<img src="' + esc(Photos.url(p.photoId) || "") + '" style="width:88px;height:88px;object-fit:cover;border-radius:12px">' +
      '<div class="grow"><div class="b">A few questions</div>' +
      '<div class="tiny muted">These turn the photo into a measurement rather than a guess.</div></div></div>';

    h += '<div class="field"><label class="f">Which way were you facing?</label><select id="mq-dir">' +
      Micro.SECTOR_AZ.map((az, i) => '<option value="' + az + '"' + (az === p.bearing ? " selected" : "") + '>' +
        Micro.SECTORS[i] + ' — ' + az + '°</option>').join("") +
      '<option value="">Not sure</option></select></div>';
    h += '<div class="note i tiny" id="mq-compass" style="margin-top:6px;display:none;cursor:pointer"></div>';

    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Time of this photo</label><input type="time" id="mq-time" value="' + nowStr + '"></div>' +
      '<div><label class="f">Ground here</label><select id="mq-slope">' +
        MicroUI.SLOPES.map(s => '<option value="' + s[1] + '">' + s[2] + (s[1] ? ' (~' + s[1] + '%)' : '') + '</option>').join("") +
      '</select></div></div>';

    h += '<div class="field" style="margin-top:12px"><label class="f">If it slopes, which way is downhill?</label><select id="mq-down">' +
      '<option value="">Level / not sure</option>' +
      Micro.SECTOR_AZ.map((az, i) => '<option value="' + az + '">' + Micro.SECTORS[i] + '</option>').join("") +
      '</select></div>';

    h += '<div class="field" style="margin-top:12px"><label class="f">Is this spot in direct sun right now?</label>' +
      '<div class="seg" id="mq-sunlit">' +
        '<button data-v="yes">☀️ In sun</button><button data-v="no">🌥️ In shade</button><button data-v="" class="on">Not sure</button>' +
      '</div></div>';

    if(sun && sun.alt > 0){
      h += '<div class="note g tiny" style="margin-top:8px">At ' + nowStr + ' the sun is <b>' + Math.round(sun.alt) +
        '° up, bearing ' + Math.round(sun.az) + '° (' + MicroUI.nearest(sun.az) + ')</b>. ' +
        'Answering the question above pins the skyline in that direction to within a few degrees — it is the single most useful thing you can tell the app.</div>';
    } else if(sun){
      h += '<div class="note i tiny" style="margin-top:8px">The sun is below the horizon at ' + nowStr + ', so the shadow check is skipped for this shot.</div>';
    }

    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost" onclick="MicroUI.dropShot()">Retake</button>' +
      '<button class="btn grow" id="mq-go" onclick="MicroUI.acceptShot()">' +
        (Vision.ready() ? "Read this photo →" : "Save and continue →") + '</button></div>';

    openSheet("Shot " + (MicroUI.cap.i + 1) + " · " + MicroUI.DIRS[MicroUI.cap.i][2], h);
    $$("#mq-sunlit button").forEach(b => b.onclick = () => {
      $$("#mq-sunlit button").forEach(x => x.classList.toggle("on", x === b));
    });
  },

  dropShot(){
    const p = MicroUI.cap.pending;
    if(p && p.photoId) Photos.drop(p.photoId);
    MicroUI.cap.pending = null;
    MicroUI.shotStep();
  },

  async acceptShot(){
    const c = MicroUI.cap, p = c.pending; if(!p) return;
    const dirV = $("#mq-dir").value;
    p.bearing = dirV === "" ? null : num(dirV, 0);
    p.slopePct = num($("#mq-slope").value, 0);
    const dv = $("#mq-down").value;
    p.slopeDir = dv === "" ? null : num(dv, 180);
    const sel = $("#mq-sunlit button.on");
    const sv = sel ? sel.dataset.v : "";
    p.sunlit = sv === "yes" ? true : sv === "no" ? false : null;

    const t = ($("#mq-time").value || "").split(":");
    if(t.length === 2){ const d = new Date(p.at); d.setHours(num(t[0], 12), num(t[1], 0), 0, 0); p.at = d; }
    const lat = DB.get("lat", null), lon = DB.get("lon", null);
    p.sun = (lat !== null && lon !== null) ? Solar.now(num(lat), num(lon), p.at) : null;

    const btn = $("#mq-go");
    if(Vision.ready()){
      if(btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Reading the photo…'; }
      try{ p.ai = await MicroUI.read(p); }
      catch(e){ toast(Vision.explain(e)); p.aiError = Vision.explain(e); }
    }
    delete p.reading;                      /* the full-size copy is never kept */
    c.shots[c.i] = p; c.pending = null; c.i++;
    MicroUI.shotStep();
  },

  /* ---------- the vision call ---------- */
  read(p){
    const dirName = p.bearing === null ? "an unknown direction" : MicroUI.nearest(p.bearing) + " (" + p.bearing + "°)";
    const sunLine = p.sun && p.sun.alt > 0
      ? "At the moment this photo was taken the sun was " + Math.round(p.sun.alt) + " degrees above the horizon at a compass bearing of " +
        Math.round(p.sun.az) + " degrees. Use the direction and length of any shadows to check this and to judge how high the things casting them are."
      : "The sun was below the horizon when this was taken, so ignore shadow direction.";

    const prompt =
      "You are surveying a vegetable garden site for its micro-climate. This photo was taken from the middle of the growing " +
      "space, by someone standing in it, facing " + dirName + ". " + sunLine + "\n\n" +
      "Estimate what is around this spot. Angles are elevation above the horizontal measured from where the photographer stands: " +
      "a fence a few metres away might be 15 degrees, a two-storey house close by 40 degrees, a tall tree overhead 60 or more. " +
      "Open sky is 0.\n\n" +
      "Reply with ONLY a JSON object, no prose:\n" +
      "{\n" +
      '  "horizon_angle_deg": number,          // representative obstruction elevation across the centre of the frame\n' +
      '  "obstructions": [ { "what": string, "bearing_offset_deg": number, "height_angle_deg": number, "distance_ft": number, "solid": boolean } ],\n' +
      '  "open_sky_fraction": number,          // 0..1 of the frame that is clear sky\n' +
      '  "shadow": { "present": boolean, "covers_fraction": number, "hardness": "hard"|"soft"|"none" },\n' +
      '  "spot_in_direct_sun": true|false|null,\n' +
      '  "ground_slope_percent": number,       // 0 if it looks level\n' +
      '  "slope_downhill": "N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"|null,\n' +
      '  "surface": "soil"|"lawn"|"mulch"|"gravel"|"paving"|"deck",\n' +
      '  "canopy_overhead": "open"|"partial"|"tree"|"eaves",\n' +
      '  "reflected_heat": "none"|"some"|"strong",   // light walls, paving or glass that would bounce heat onto the beds\n' +
      '  "wind_exposure": "sheltered"|"normal"|"breezy"|"exposed",\n' +
      '  "drainage_signs": "fast"|"normal"|"slow"|"boggy",\n' +
      '  "low_spot": true|false,               // does the ground dip here, so cold air would settle\n' +
      '  "notes": string                       // one short sentence a gardener would care about\n' +
      "}\n\n" +
      "bearing_offset_deg is relative to the direction the camera faces: negative left, positive right, roughly -40 to +40 for a phone frame. " +
      "Where you are unsure, say so with a conservative number rather than omitting the field. Do not describe plants or give growing advice.";

    return Vision.json(p.reading, prompt);
  },

  /* ---------- on-device light reading, so this works with no key ---------- */
  light(canvas){
    const W = 160, H = Math.max(1, Math.round(canvas.height / canvas.width * W));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); ctx.drawImage(canvas, 0, 0, W, H);
    let d; try{ d = ctx.getImageData(0, 0, W, H).data; }catch(e){ return null; }
    let sky = 0, upper = 0, sum = 0, sum2 = 0, n = 0, dark = 0, lower = 0;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = (y * W + x) * 4, r = d[i], g = d[i+1], b = d[i+2];
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
      const isSky = v > 0.62 && (b >= r - 6) && sat < 0.45;
      if(y < H * 0.55){ upper++; if(isSky) sky++; }
      else { lower++; sum += v; sum2 += v * v; n++; if(v < 0.32) dark++; }
    }
    const mean = n ? sum / n : 0;
    const varr = n ? Math.max(0, sum2 / n - mean * mean) : 0;
    return {
      skyFraction: upper ? Math.round(sky / upper * 100) / 100 : 0,
      groundBrightness: Math.round(mean * 100) / 100,
      contrast: Math.round(Math.sqrt(varr) * 100) / 100,
      shadowFraction: lower ? Math.round(dark / lower * 100) / 100 : 0
    };
  },
  /* a crude skyline angle when there is no model to ask — clearly labelled as such */
  estimate(light){
    if(!light) return null;
    return Math.round(clamp((1 - light.skyFraction) * 55, 0, 70));
  },

  /* ---------- compass ---------- */
  heading(){
    return new Promise(res => {
      let done = false;
      const finish = v => { if(done) return; done = true; clearTimeout(t); off(); res(v); };
      function off(){
        try{ window.removeEventListener("deviceorientationabsolute", on); window.removeEventListener("deviceorientation", on); }catch(e){}
      }
      function on(e){
        let deg = null;
        if(typeof e.webkitCompassHeading === "number" && isFinite(e.webkitCompassHeading)) deg = e.webkitCompassHeading;
        else if(e.absolute && typeof e.alpha === "number" && isFinite(e.alpha)) deg = (360 - e.alpha) % 360;
        if(deg !== null) finish(deg);
      }
      const t = setTimeout(() => finish(null), 2000);
      try{
        const DOE = window.DeviceOrientationEvent;
        if(DOE && typeof DOE.requestPermission === "function"){
          DOE.requestPermission()
            .then(p => { if(p === "granted") window.addEventListener("deviceorientation", on); else finish(null); })
            .catch(() => finish(null));
        } else if(DOE){
          window.addEventListener("deviceorientationabsolute", on);
          window.addEventListener("deviceorientation", on);
        } else finish(null);
      }catch(e){ finish(null); }
    });
  },

  /* ============================================================
     MERGING THE SHOTS INTO ONE SKYLINE
     ============================================================ */
  mergeHorizon(shots){
    const acc = Micro.SECTOR_AZ.map(() => ({ s: 0, w: 0 }));
    (shots || []).forEach(s => {
      if(!s || s.bearing === null || s.bearing === undefined) return;
      const items = [];
      if(s.ai && Array.isArray(s.ai.obstructions)) s.ai.obstructions.forEach(o => {
        const hgt = clamp(num(o.height_angle_deg, 0), 0, 89);
        if(!hgt) return;
        items.push({ az: s.bearing + clamp(num(o.bearing_offset_deg, 0), -60, 60), h: hgt, w: 1 });
      });
      let centre = null;
      if(s.ai && s.ai.horizon_angle_deg !== undefined && s.ai.horizon_angle_deg !== null) centre = clamp(num(s.ai.horizon_angle_deg, 0), 0, 89);
      else centre = MicroUI.estimate(s.light);
      if(centre !== null) items.push({ az: s.bearing, h: centre, w: 0.85 });
      items.forEach(it => {
        Micro.SECTOR_AZ.forEach((az, i) => {
          const dd = Math.abs(((it.az - az + 540) % 360) - 180);
          if(dd > 55) return;
          const w = it.w * (1 - dd / 55);
          acc[i].s += it.h * w; acc[i].w += w;
        });
      });
    });
    return acc.map(a => a.w > 0 ? Math.round(a.s / a.w) : 0);
  },

  /* A photo of a known bearing at a known time is a geometric constraint.
     If the sun was 40° up in the south-east and the gardener says this spot
     was in shade, then something at least 40° high stands to the south-east —
     no estimate required. This is the most reliable number in the whole survey. */
  applySunChecks(hz, shots){
    const out = hz.slice();
    (shots || []).forEach(s => {
      if(!s || !s.sun || s.sun.alt <= 4) return;
      let lit = s.sunlit;
      if(lit === null || lit === undefined){
        if(s.ai && (s.ai.spot_in_direct_sun === true || s.ai.spot_in_direct_sun === false)) lit = s.ai.spot_in_direct_sun;
      }
      if(lit === null || lit === undefined) return;
      const az = s.sun.az, alt = s.sun.alt;
      const i = Math.round((((az % 360) + 360) % 360) / 45) % 8;
      const cur = num(out[i], 0);
      if(lit === false && cur < alt) out[i] = Math.min(85, Math.ceil(alt) + 2);
      else if(lit === true && cur >= alt) out[i] = Math.max(0, Math.floor(alt) - 2);
      s.constrained = true;
    });
    return out;
  },

  /* pick the value most shots agree on */
  vote(shots, key, fallback){
    const tally = {};
    (shots || []).forEach(s => {
      const v = s && s.ai ? s.ai[key] : null;
      if(v === null || v === undefined || v === "") return;
      tally[v] = (tally[v] || 0) + 1;
    });
    const keys = Object.keys(tally);
    if(!keys.length) return fallback;
    return keys.sort((a, b) => tally[b] - tally[a])[0];
  },

  finish(){
    const c = MicroUI.cap; if(!c) return;
    MicroUI.camStop();
    const shots = c.shots.filter(Boolean);
    if(!shots.length){ toast("No shots taken"); return MicroUI.open(c.scope, c.refId); }

    let hz = MicroUI.mergeHorizon(shots);
    hz = MicroUI.applySunChecks(hz, shots);

    /* slope: the gardener's own answer wins over the model's */
    let slope = 0, slopeDir = null;
    shots.forEach(s => {
      if(num(s.slopePct, 0) > slope){ slope = num(s.slopePct, 0); slopeDir = s.slopeDir; }
    });
    if(!slope){
      const aiSlope = shots.map(s => s.ai ? num(s.ai.ground_slope_percent, 0) : 0).sort((a, b) => b - a)[0] || 0;
      if(aiSlope >= 3){
        slope = Math.round(aiSlope);
        const dir = MicroUI.vote(shots, "slope_downhill", null);
        const idx = dir ? Micro.SECTORS.indexOf(dir) : -1;
        slopeDir = idx >= 0 ? Micro.SECTOR_AZ[idx] : null;
      }
    }

    const lowSpot = shots.filter(s => s.ai && s.ai.low_spot === true).length;
    const withAI = shots.filter(s => s.ai).length;

    const prefill = {
      horizon: hz,
      slope_pct: slope,
      slope_dir: slopeDir,
      canopy: MicroUI.vote(shots, "canopy_overhead", "open"),
      reflect: MicroUI.vote(shots, "reflected_heat", "none"),
      wind_exposure: MicroUI.vote(shots, "wind_exposure", "normal"),
      drainage: MicroUI.vote(shots, "drainage_signs", "normal"),
      surface: MicroUI.vote(shots, "surface", "soil"),
      frost_pocket: lowSpot >= 2 ? "pocket" : lowSpot === 1 ? "slight" : "none",
      method: withAI ? "photo survey (" + shots.length + " shots, " + Vision.who() + ")" : "photo survey (" + shots.length + " shots, on-device)",
      confidence: withAI && shots.some(s => s.constrained) ? "high" : withAI ? "medium" : "low",
      photos: shots.map(s => s.photoId).filter(Boolean),
      shots: shots.map(s => ({
        dir: s.dir, bearing: s.bearing, at: s.at ? s.at.toISOString() : null,
        sun: s.sun ? { alt: Math.round(s.sun.alt), az: Math.round(s.sun.az) } : null,
        sunlit: s.sunlit, constrained: !!s.constrained,
        notes: s.ai ? s.ai.notes : null, error: s.aiError || null
      })),
      notes: shots.map(s => s.ai && s.ai.notes ? s.dir + ": " + s.ai.notes : null).filter(Boolean).join(" ")
    };

    MicroUI.cap = null;
    MicroUI.form(c.scope, c.refId, prefill);
  },

  /* ============================================================
     THE FORM — everything above lands here as an editable estimate
     ============================================================ */
  form(scope, refId, prefill){
    const site = Micro.row(scope, refId);
    const v = Object.assign({}, Micro.DEFAULTS, site || {}, prefill || {});
    const ai = k => prefill && prefill[k] !== undefined && prefill[k] !== null ? " ai-filled" : "";
    const hz = Array.isArray(v.horizon) ? v.horizon : Micro.DEFAULTS.horizon;
    const opts = (id, map, cur) => Object.keys(map).map(k =>
      '<option value="' + k + '"' + (String(cur) === k ? " selected" : "") + '>' + esc(map[k]) + '</option>').join("");

    let h = "";
    if(prefill){
      const shots = prefill.shots || [];
      const pinned = shots.filter(s => s.constrained).length;
      h += '<div class="note g" style="margin-top:0"><b>Read from ' + shots.length + ' photo' + (shots.length > 1 ? "s" : "") + '.</b> ' +
        (pinned ? pinned + ' of them caught the sun at a known angle, which pins the skyline in ' + (pinned > 1 ? "those directions" : "that direction") + ' to within a few degrees. ' : '') +
        'Green fields were filled by the app — change anything that looks wrong. It is your garden; you can see it and the camera cannot.</div>';
      if(shots.some(s => s.error)) h += '<div class="note w" style="margin-top:8px">Some shots could not be read: ' +
        esc(shots.filter(s => s.error).map(s => s.dir + " — " + s.error).join("; ")) + '</div>';
    }

    h += '<div class="sec"><h2>Skyline</h2><span class="tiny muted">degrees above the horizon</span></div>';
    h += '<div class="note i tiny">How high the tallest thing in each direction rises, seen from the middle of the space. A low fence is about 10°, a nearby house 35–45°, a big tree overhead 60°+. Open sky is 0. This is what decides the sun hours.</div>';
    h += '<div class="grid2" style="margin-top:10px">';
    Micro.SECTORS.forEach((s, i) => {
      h += '<div style="margin-bottom:6px"><label class="f">' + s + ' <span class="muted" id="hzl-' + i + '">' + num(hz[i], 0) + '°</span></label>' +
        '<input type="range" id="hz-' + i + '" min="0" max="85" step="1" value="' + num(hz[i], 0) + '"' +
        ' class="' + (prefill && num(hz[i], 0) > 0 ? "ai-filled" : "") + '"' +
        ' oninput="document.getElementById(\'hzl-' + i + '\').textContent=this.value+String.fromCharCode(176)"></div>';
    });
    h += '</div>';

    h += '<div class="sec"><h2>The ground</h2></div>';
    h += '<div class="grid2">' +
      '<div><label class="f">Slope</label><input type="number" id="mf-slope" min="0" max="60" value="' + num(v.slope_pct, 0) + '" class="' + ai("slope_pct") + '"><div class="tiny muted">percent</div></div>' +
      '<div><label class="f">Downhill toward</label><select id="mf-slopedir" class="' + ai("slope_dir") + '">' +
        '<option value="">Level / not sure</option>' +
        Micro.SECTOR_AZ.map((az, i) => '<option value="' + az + '"' + (num(v.slope_dir, -1) === az ? " selected" : "") + '>' + Micro.SECTORS[i] + '</option>').join("") +
      '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Surface</label><select id="mf-surface" class="' + ai("surface") + '">' + opts("surface", Micro.LABELS.surface, v.surface) + '</select></div>' +
      '<div><label class="f">Drainage</label><select id="mf-drain" class="' + ai("drainage") + '">' + opts("drainage", Micro.LABELS.drainage, v.drainage) + '</select></div></div>';

    h += '<div class="sec"><h2>Air and shelter</h2></div>';
    h += '<div class="grid2">' +
      '<div><label class="f">Wind</label><select id="mf-wind" class="' + ai("wind_exposure") + '">' + opts("wind_exposure", Micro.LABELS.wind_exposure, v.wind_exposure) + '</select></div>' +
      '<div><label class="f">Overhead</label><select id="mf-canopy" class="' + ai("canopy") + '">' + opts("canopy", Micro.LABELS.canopy, v.canopy) + '</select></div></div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Reflected heat</label><select id="mf-reflect" class="' + ai("reflect") + '">' + opts("reflect", Micro.LABELS.reflect, v.reflect) + '</select></div>' +
      '<div><label class="f">Cold air</label><select id="mf-frost" class="' + ai("frost_pocket") + '">' + opts("frost_pocket", Micro.LABELS.frost_pocket, v.frost_pocket) + '</select></div></div>';
    h += '<div class="note i tiny" style="margin-top:10px">Cold air behaves like water: it runs downhill and pools against walls, hedges and fences. A spot that collects it frosts first in autumn and last in spring. A wall that catches the sun does the opposite — it stores heat all day and gives it back at night.</div>';

    h += '<div class="field" style="margin-top:14px"><label class="f">Notes</label><textarea id="mf-notes" class="' + ai("notes") + '" placeholder="Anything you know that a photo cannot show — where the frost sits, which corner floods, what the wind does in March.">' + esc(v.notes || "") + '</textarea></div>';

    h += '<div class="row between" style="margin-top:14px"><div><div class="b sm">Keep my own sun hours</div>' +
      '<div class="tiny muted">Ignore the calculated figure and use the number on each bed.</div></div>' +
      '<button class="switch ' + (v.sun_override ? "on" : "") + '" id="mf-override"></button></div>';

    h += '<div id="mf-preview"></div>';
    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost" onclick="MicroUI.preview(\'' + scope + '\',\'' + refId + '\')">Preview</button>' +
      '<button class="btn grow" onclick="MicroUI.save(\'' + scope + '\',\'' + refId + '\')">Save profile</button></div>';

    openSheet("Micro-climate details", h);
    const sw = $("#mf-override"); if(sw) sw.onclick = () => sw.classList.toggle("on");
    MicroUI._pending = prefill || null;
  },

  collect(){
    const hz = Micro.SECTORS.map((s, i) => num(($("#hz-" + i) || {}).value, 0));
    const sd = $("#mf-slopedir").value;
    const p = MicroUI._pending || {};
    return {
      horizon: hz,
      slope_pct: clamp(num($("#mf-slope").value, 0), 0, 60),
      slope_dir: sd === "" ? null : num(sd, 180),
      surface: $("#mf-surface").value,
      drainage: $("#mf-drain").value,
      wind_exposure: $("#mf-wind").value,
      canopy: $("#mf-canopy").value,
      reflect: $("#mf-reflect").value,
      frost_pocket: $("#mf-frost").value,
      notes: $("#mf-notes").value.trim(),
      sun_override: $("#mf-override").classList.contains("on") ? 1 : 0,
      method: p.method || "entered by hand",
      confidence: p.confidence || "gardener",
      photos: p.photos || null,
      shots: p.shots || null
    };
  },

  preview(scope, refId){
    const d = Micro.derive(Object.assign({}, Micro.DEFAULTS, MicroUI.collect()));
    const box = $("#mf-preview");
    box.innerHTML = '<div class="sec"><h2>What this changes</h2></div>' + MicroUI.summary(d);
    if(box.scrollIntoView) try{ box.scrollIntoView({ behavior:"smooth", block:"nearest" }); }catch(e){}
  },

  save(scope, refId){
    Micro.save(scope, refId, MicroUI.collect());
    Micro.invalidate();
    MicroUI._pending = null;
    closeSheet();
    Garden.render();
    if(APP.tab === "weather") Weather.render();
    toast("Micro-climate saved 🌤️");
  }
};

/* ============================================================
   HOOKS — the profile has to be visible where the gardener works
   ============================================================ */
(function wireGarden(){

  /* the plot list gets a micro-climate card for whichever plot is selected */
  const origList = Garden.listView;
  Garden.listView = function(){
    Micro.invalidate();
    origList.call(Garden);
    const box = $("#s-garden");
    const sc = box.querySelector(".scroller");
    if(!sc) return;
    const plotId = APP.plotId && DB.find("plots", APP.plotId) ? APP.plotId : null;
    if(!plotId){
      if(DB.count("plots")) sc.insertAdjacentHTML("afterend",
        '<div class="note i" style="margin-top:10px">Pick a plot above to give it a micro-climate — the sun, wind, slope and frost of that particular corner. Front of the house and back of the house are rarely the same garden.</div>');
      return;
    }
    const d = Micro.forPlot(plotId);
    const p = DB.find("plots", plotId);
    let h = '<div class="card" style="margin-top:10px"><div class="row between">' +
      '<div class="grow"><div class="b">🌤️ Micro-climate · ' + esc(p.name) + '</div>' +
      '<div class="tiny muted">' + (d
        ? (d.sunKnown ? d.sunGrowing + 'h sun in season' : 'skyline recorded') +
          ' · ' + (d.waterFactor > 1 ? "+" : "") + Math.round((d.waterFactor - 1) * 100) + '% water' +
          (d.seasonShift ? ' · ' + (d.seasonShift > 0 ? "+" : "") + d.seasonShift + 'd season' : '') +
          (d.site.method ? ' · ' + esc(d.site.method) : '')
        : 'Not surveyed — the app is using county-wide figures for this plot') + '</div></div>' +
      '<button class="btn sm" onclick="MicroUI.open(\'plot\',\'' + plotId + '\')">' + (d ? "Open" : "Survey") + '</button></div>';
    if(d && d.why.length) h += '<div class="note ' + d.why[0].k + '" style="margin-top:10px"><b>' + esc(d.why[0].t) + '</b><br>' + esc(d.why[0].m) + '</div>';
    h += '</div>';
    sc.insertAdjacentHTML("afterend", h);
  };

  /* the bed view gets the resolved picture, plus why the watering call moved */
  const origBed = Garden.bedView;
  Garden.bedView = function(){
    Micro.invalidate();
    origBed.call(Garden);
    const b = DB.find("beds", APP.bedId); if(!b) return;
    const box = $("#s-garden");
    const first = box.querySelector(".card"); if(!first) return;
    const d = Micro.forBed(b.id);

    let h = '<div class="card" style="margin-top:12px"><div class="row between">' +
      '<div class="grow"><div class="b">🌤️ Micro-climate</div>' +
      '<div class="tiny muted">' + (d
        ? esc(Micro.chip(b.id) || "") + ' · from the ' + esc(d.site._from)
        : 'Not surveyed. Sun hours come from the number you typed.') + '</div></div>' +
      '<button class="btn sm ghost" onclick="MicroUI.open(\'' + (d && d.site._from === "plot" && d.site._plotId ? "plot','" + d.site._plotId : "bed','" + b.id) + '\')">' +
        (d ? "Open" : "Survey") + '</button></div>';

    if(d){
      if(d.sunKnown && Math.abs(d.sunGrowing - num(b.sun_hours, 8)) >= 1)
        h += '<div class="note w" style="margin-top:10px">☀️ The survey puts this bed at <b>' + d.sunGrowing +
          'h</b> of direct sun in season; the bed is set to ' + esc(b.sun_hours) + 'h. Recommendations use the surveyed figure.</div>';
      const w = Recommend.water(b.id, APP.weather);
      if(w && w.micro && w.micro.why.length)
        w.micro.why.forEach(x => h += '<div class="note i" style="margin-top:8px">💧 ' + esc(x) + '</div>');
      if(d.frostShiftFirst) h += '<div class="note ' + (d.frostShiftFirst < 0 ? "d" : "g") + '" style="margin-top:8px">🌡️ First frost here is around <b>' +
        fmt(d.firstFrost) + '</b> — ' + Math.abs(d.frostShiftFirst) + ' days ' + (d.frostShiftFirst < 0 ? "earlier" : "later") + ' than the garden average.</div>';
      if(d.site._from === "plot") h += '<button class="btn ghost block sm" style="margin-top:10px" onclick="MicroUI.open(\'bed\',\'' + b.id + '\')">This bed differs from the rest of the plot →</button>';
    }
    h += '</div>';
    first.insertAdjacentHTML("afterend", h);
  };

  /* and a way in from bed settings */
  const origMenu = Garden.bedMenu;
  Garden.bedMenu = function(){
    origMenu.call(Garden);
    const body = $("#sheet-body"); if(!body) return;
    const b = DB.find("beds", APP.bedId); if(!b) return;
    body.insertAdjacentHTML("beforeend",
      '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){MicroUI.open(\'bed\',\'' + b.id + '\')},250)">🌤️ Micro-climate for this bed</button>');
  };

  /* a new plot is worth surveying straight away */
  const origSavePlot = Garden.savePlot;
  Garden.savePlot = function(){
    const before = DB.count("plots");
    origSavePlot.call(Garden);
    if(DB.count("plots") > before){
      const p = DB.all("plots")[DB.count("plots") - 1];
      setTimeout(() => {
        if($("#sheet").classList.contains("on")) return;
        confirmSheet("Survey " + p.name + "?",
          "A two-minute photo survey of this spot — sun, slope, wind, shelter — is what turns a county-wide zone into advice for this particular corner of the garden.",
          "Survey it now", () => MicroUI.open("plot", p.id));
      }, 400);
    }
  };
})();
</script>
