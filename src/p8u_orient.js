<script>
/* ============================================================
   WHICH WAY THE BED FACES

   The micro-climate survey does ask which direction you are facing
   when you take each photo, and that bearing is doing real work —
   it is what turns a photograph into a measurement of the skyline
   and feeds the eight-sector horizon that Solar reads. But it
   describes THE SITE. It never learned which way the drawing points.

   That gap is why the shade check was quietly guessing. It decided
   who stood in whose light with:

       const north = Geom.PY(low) < Geom.PY(tall);

   — the top of the canvas is north — which is true only if you
   happened to draw the bed that way, and is the wrong answer by 90°
   for anyone who drew it to match how the bed looks from the path.
   Worse, `north` was computed and then never used, so the check
   flagged a tomato as shading a lettuce standing on the SUNNY side
   of it, which is the one place the lettuce is fine.

   So a bed now carries `north_deg`: the compass bearing that "up" on
   its drawing points to. Zero, the default, means north-up and the
   app behaves exactly as it did. You can set it with the dial, or
   stand at the bottom edge of the bed, point the phone up along it
   and let the compass read it — the same reader the survey uses.

   The sun is in the south at midday in the northern hemisphere and
   in the north in the southern, so shade falls on the far side from
   it. That is the whole calculation, and the latitude the gardener
   already gave decides which hemisphere she is in.
   ============================================================ */

const Orient = {
  /* bearing that the top edge of the drawing points at, 0 = north */
  of(bed){ return ((num((bed || {}).north_deg, 0) % 360) + 360) % 360; },

  /* Which way is the sun at midday, as a compass bearing. The gardener's
     latitude is already stored — the solar maths reads the same setting —
     and it is the only thing that decides this. Nothing here is hardcoded
     to the northern hemisphere. */
  sunAz(){
    const lat = DB.get("lat", null);
    if(lat === null || lat === undefined) return 180;
    return num(lat, 40) >= 0 ? 180 : 0;
  },

  /* Convert a vector on the drawing into a compass bearing.
     On the canvas y grows DOWNWARD, so a plant with a smaller y is further
     "up" the drawing, which is `north_deg`. */
  bearing(bed, dx, dy){
    const a = Math.atan2(dx, -dy) * 180 / Math.PI;   /* 0 = up the drawing */
    return (((a + Orient.of(bed)) % 360) + 360) % 360;
  },

  /* smallest angle between two bearings */
  delta(a, b){
    let d = Math.abs((((a - b) % 360) + 360) % 360);
    return d > 180 ? 360 - d : d;
  },

  /* Does `low` actually stand in `tall`'s shadow?
     True when it sits on the far side from the midday sun — within a wide
     arc, because the sun moves and a tall crop throws shade east in the
     morning and west in the evening too. */
  shaded(bed, tall, low){
    const dx = Geom.PX(low) - Geom.PX(tall), dy = Geom.PY(low) - Geom.PY(tall);
    if(Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return true;
    const away = (Orient.sunAz() + 180) % 360;       /* the shadow points this way */
    return Orient.delta(Orient.bearing(bed, dx, dy), away) <= 75;
  },

  name(deg){
    const dirs = ["north","north-east","east","south-east","south","south-west","west","north-west"];
    return dirs[Math.round((((num(deg,0) % 360) + 360) % 360) / 45) % 8];
  },

  /* ---------- the control ---------- */
  sheet(bedId){
    const bed = Geom.bed(DB.find("beds", bedId || APP.bedId)); if(!bed) return;
    const d = Orient.of(bed);
    let h = '<p class="muted sm" style="margin-top:0">Which way does the <b>top of the drawing</b> point? ' +
      'The app needs this to know which plants stand in the shade of the tall ones, rather than assuming you drew the bed with north at the top.</p>';
    h += '<div class="center" style="margin:14px 0">' + Orient.dial(d) + '</div>';
    h += '<div class="field"><label class="f">Top of the bed points <b id="or-name">' + esc(Orient.name(d)) + '</b> · <b id="or-deg">' + Math.round(d) + '°</b></label>' +
      '<input type="range" id="or-range" min="0" max="355" step="5" value="' + Math.round(d/5)*5 + '" oninput="Orient.live(this.value)"></div>';
    h += '<div class="row wrap" style="gap:6px;margin-top:8px">' +
      [["N",0],["E",90],["S",180],["W",270]].map(x =>
        '<button class="chip" onclick="Orient.live(' + x[1] + ',1)">' + x[0] + '</button>').join("") + '</div>';
    h += '<button class="btn ghost block" style="margin-top:12px" onclick="Orient.readCompass()">🧭 Read it from the phone</button>';
    h += '<div class="tiny muted" style="margin-top:6px">Stand at the bottom edge of the bed, point the top of the phone up along it, and tap. ' +
      'Same compass the micro-climate survey uses.</div>';
    h += '<div class="note i" style="margin-top:12px">The midday sun is in the ' +
      esc(Orient.name(Orient.sunAz())) + ' where you are, so shade falls to the ' +
      esc(Orient.name((Orient.sunAz() + 180) % 360)) + ' of anything tall.</div>';
    h += '<button class="btn block" style="margin-top:14px" onclick="Orient.save(\'' + bed.id + '\')">Save</button>';
    openSheet("Which way the bed faces", h);
  },

  dial(deg){
    const r = 46, cx = 60, cy = 60;
    const a = (num(deg, 0) - 90) * Math.PI / 180;
    return '<svg id="or-dial" width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="2"/>' +
      ["N","E","S","W"].map((t, i) => {
        const th = (i * 90 - 90) * Math.PI / 180;
        return '<text x="' + (cx + Math.cos(th) * (r - 11)) + '" y="' + (cy + Math.sin(th) * (r - 11) + 4) +
          '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)">' + t + '</text>';
      }).join("") +
      '<line id="or-needle" x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * (r - 18)) +
      '" y2="' + (cy + Math.sin(a) * (r - 18)) + '" stroke="var(--green-600)" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="var(--green-600)"/></svg>';
  },

  live(v, setSlider){
    const d = ((num(v, 0) % 360) + 360) % 360;
    const s = $("#or-range"); if(s && setSlider) s.value = Math.round(d/5)*5;
    const n = $("#or-name"); if(n) n.textContent = Orient.name(d);
    const g = $("#or-deg"); if(g) g.textContent = Math.round(d) + "°";
    const nd = $("#or-needle");
    if(nd){
      const a = (d - 90) * Math.PI / 180;
      nd.setAttribute("x2", 60 + Math.cos(a) * 28);
      nd.setAttribute("y2", 60 + Math.sin(a) * 28);
    }
  },

  readCompass(){
    if(typeof MicroUI === "undefined" || !MicroUI.heading) return toast("No compass on this device");
    toast("Hold still…");
    MicroUI.heading().then(deg => {
      if(deg === null || deg === undefined) return toast("No compass reading — set it by hand");
      Orient.live(Math.round(deg), 1);
      haptic();
      toast("Top of the bed points " + Orient.name(deg));
    });
  },

  save(bedId){
    const s = $("#or-range");
    const d = ((num(s ? s.value : 0, 0) % 360) + 360) % 360;
    DB.update("beds", bedId, { north_deg: Math.round(d) });
    closeSheet(); Garden.render();
    toast("Top of the bed points " + Orient.name(d));
  }
};

/* ---------- teach the shade check about it ----------
   Additive: a bed with no orientation set behaves exactly as before, because
   north_deg defaults to 0 and the old code assumed north-up anyway. What
   changes for everyone is that a plant standing on the SUNNY side of a tall
   crop is no longer reported as being shaded by it. */
(function(){
  const orig = Recommend.shading;
  Recommend.shading = function(bedId, when){
    const rows = orig.call(Recommend, bedId, when);
    const bed = Geom.bed(DB.find("beds", bedId));
    if(!bed) return rows;
    return rows.filter(r => Orient.shaded(bed, r.tall, r.low)).map(r => {
      const dx = Geom.PX(r.low) - Geom.PX(r.tall), dy = Geom.PY(r.low) - Geom.PY(r.tall);
      r.side = Orient.name(Orient.bearing(bed, dx, dy));
      return r;
    });
  };
})();
</script>
