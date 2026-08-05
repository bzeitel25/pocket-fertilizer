<script>
/* ============================================================
   GARDEN MAP
   The beds already know their real size in feet. This lays them
   out on one plan of the whole garden, so you can see where
   everything is rather than remembering which bed is which.
   Drag to arrange, add landmarks for orientation, tap to open.
   ============================================================ */
const FEATURES = {
  shed:      { n:"Shed",        e:"🏚️", w:8,  h:6 },
  greenhouse:{ n:"Greenhouse",  e:"🏡", w:8,  h:10 },
  compost:   { n:"Compost",     e:"♻️", w:3,  h:3 },
  water:     { n:"Water tap",   e:"🚰", w:1,  h:1 },
  tree:      { n:"Tree",        e:"🌳", w:6,  h:6 },
  shrub:     { n:"Shrub",       e:"🌿", w:3,  h:3 },
  path:      { n:"Path",        e:"⬜", w:10, h:2 },
  house:     { n:"House",       e:"🏠", w:16, h:10 },
  fence:     { n:"Fence",       e:"🚧", w:16, h:1 },
  gate:      { n:"Gate",        e:"🚪", w:3,  h:1 },
  table:     { n:"Potting bench", e:"🪵", w:4, h:2 },
  chair:     { n:"Seat",        e:"🪑", w:3,  h:3 }
};

const Gmap = {
  arrange: false, sel: null, _ppf: 12,

  /* ---------- geometry ---------- */
  bedFeet(b){
    const ft = num(b.cell_in, 12) / 12;
    const w = num(b.cols, 1) * ft, h = num(b.rows, 1) * ft;
    return num(b.rot) === 90 ? { w: h, h: w } : { w: w, h: h };
  },
  featFeet(m){
    const f = FEATURES[m.kind] || { w:3, h:3 };
    const w = num(m.w, f.w), h = num(m.h, f.h);
    return num(m.rot) === 90 ? { w: h, h: w } : { w: w, h: h };
  },

  /* a position that was never set must stay null — num() would turn it into 0 */
  pos(v){ return (v === null || v === undefined || v === "") ? null
                : (isFinite(parseFloat(v)) ? parseFloat(v) : null); },

  items(plotId){
    const beds = DB.all("beds").filter(b => !plotId || b.plot_id === plotId)
      .map(b => ({ kind:"bed", id:b.id, row:b, x:Gmap.pos(b.mx), y:Gmap.pos(b.my), size:Gmap.bedFeet(b) }));
    const feats = DB.all("mapitems").filter(m => !plotId || m.plot_id === plotId)
      .map(m => ({ kind:"feature", id:m.id, row:m, x:Gmap.pos(m.mx), y:Gmap.pos(m.my), size:Gmap.featFeet(m) }));
    return beds.concat(feats);
  },

  /* anything never placed gets tiled into free space so the map is never empty */
  autoPlace(plotId){
    const items = Gmap.items(plotId);
    const placed = items.filter(i => i.x !== null && i.y !== null);
    const loose = items.filter(i => i.x === null || i.y === null);
    if(!loose.length) return;
    let cx = 1, cy = 1, rowH = 0;
    const maxW = 24;
    placed.forEach(p => { cy = Math.max(cy, p.y + p.size.h + 2); });
    loose.forEach(i => {
      if(cx + i.size.w > maxW){ cx = 1; cy += rowH + 2; rowH = 0; }
      DB.update(i.kind === "bed" ? "beds" : "mapitems", i.id, { mx: cx, my: cy });
      cx += i.size.w + 2; rowH = Math.max(rowH, i.size.h);
    });
  },

  extent(plotId){
    const items = Gmap.items(plotId);
    let w = 12, h = 10;
    items.forEach(i => {
      if(i.x === null || i.y === null) return;
      w = Math.max(w, i.x + i.size.w + 1);
      h = Math.max(h, i.y + i.size.h + 1);
    });
    return { w: Math.ceil(w), h: Math.ceil(h) };
  },

  /* ---------- rendering ---------- */
  render(){
    const box = $("#s-garden");
    const plotId = APP.plotId && DB.find("plots", APP.plotId) ? APP.plotId : null;
    Gmap.autoPlace(plotId);
    const items = Gmap.items(plotId);
    const ext = Gmap.extent(plotId);
    const avail = Math.min(window.innerWidth, 520) - 32;
    const ppf = Gmap._ppf = clamp(avail / ext.w, 6, 40);
    const H = Math.round(ext.h * ppf);

    let h = Garden.viewToggle();

    const plots = DB.all("plots");
    if(plots.length){
      h += '<div class="scroller">' +
        '<button class="chip ' + (!plotId ? "on" : "") + '" onclick="APP.plotId=null;Garden.render()">Whole garden</button>' +
        plots.map(p => '<button class="chip ' + (plotId === p.id ? "on" : "") + '" onclick="APP.plotId=\'' + p.id + '\';Garden.render()">' +
          esc(p.name) + '</button>').join("") + '</div>';
    }

    if(!items.length){
      h += '<div class="card"><div class="empty"><span class="e">🗺️</span><div class="b">Nothing to map yet</div>' +
        '<div class="tiny">Create a bed and it appears here. Then drag things around until the plan matches your garden.</div></div>' +
        '<button class="btn block" onclick="Garden.newBed()">＋ New bed</button></div>';
      box.innerHTML = h; return;
    }

    h += '<div class="row" style="gap:8px;margin:12px 0">' +
      '<button class="btn ' + (Gmap.arrange ? "" : "ghost") + ' grow" onclick="Gmap.toggleArrange()">' +
        (Gmap.arrange ? "✓ Done arranging" : "✋ Arrange") + '</button>' +
      '<button class="btn ghost" onclick="Gmap.addFeature()">＋ Landmark</button>' +
      '<button class="btn ghost" onclick="Gmap.snapshot()">📸</button></div>';

    h += Gmap.arrange
      ? '<div class="note i">Drag anything to move it. Tap once to select, then use the buttons below to rotate or remove it. Positions snap to the foot.</div>'
      : '<div class="tiny muted center" style="margin-bottom:8px">' + ext.w + ' × ' + ext.h + ' ft · tap a bed to open it</div>';

    h += '<div class="mapwrap"><div class="mapplot" id="mapplot" style="height:' + H + 'px">';
    /* one-foot grid so the scale reads clearly */
    h += '<div class="mapgrid" style="background-size:' + ppf + 'px ' + ppf + 'px"></div>';
    h += '<div class="mapnorth">N ↑</div>';

    items.forEach(i => {
      if(i.x === null || i.y === null) return;
      const L = Math.round(i.x * ppf), T = Math.round(i.y * ppf);
      const W = Math.max(22, Math.round(i.size.w * ppf)), Hh = Math.max(22, Math.round(i.size.h * ppf));
      const isSel = Gmap.sel === i.id;
      if(i.kind === "bed"){
        const b = i.row;
        const ps = Garden.live(b.id);
        const crops = {}; ps.forEach(p => crops[p.crop_id] = (crops[p.crop_id] || 0) + 1);
        const emo = Object.keys(crops).slice(0, 6).map(cid => cropEmoji(cid)).join("");
        const full = ps.length, cells = num(b.cols) * num(b.rows);
        h += '<div class="mapbed ' + (isSel ? "sel" : "") + '" data-id="' + i.id + '" data-kind="bed" ' +
          'style="left:' + L + 'px;top:' + T + 'px;width:' + W + 'px;height:' + Hh + 'px">' +
          '<div class="mb-name">' + esc(b.name) + '</div>' +
          (Hh > 44 ? '<div class="mb-emo">' + emo + '</div>' : '') +
          (Hh > 60 ? '<div class="mb-sub">' + full + '/' + cells + ' planted · ' + esc(b.sun_hours || "?") + 'h sun</div>' : '') +
          '</div>';
      } else {
        const f = FEATURES[i.row.kind] || { n:"Item", e:"⬜" };
        h += '<div class="mapfeat ' + (isSel ? "sel" : "") + '" data-id="' + i.id + '" data-kind="feature" ' +
          'style="left:' + L + 'px;top:' + T + 'px;width:' + W + 'px;height:' + Hh + 'px">' +
          '<div class="mf-e">' + f.e + '</div>' +
          (W > 54 ? '<div class="mf-n">' + esc(i.row.label || f.n) + '</div>' : '') +
          '</div>';
      }
    });
    h += '</div></div>';

    if(Gmap.arrange && Gmap.sel){
      const it = items.find(x => x.id === Gmap.sel);
      if(it) h += '<div class="card" style="margin-top:12px"><div class="row between">' +
        '<div class="b">' + esc(it.kind === "bed" ? it.row.name : (it.row.label || (FEATURES[it.row.kind] || {}).n || "Item")) + '</div>' +
        '<div class="row" style="gap:6px">' +
          '<button class="chip" onclick="Gmap.rotate(\'' + it.id + '\')">⟳ Rotate</button>' +
          (it.kind === "feature" ? '<button class="chip bad" onclick="Gmap.removeFeature(\'' + it.id + '\')">Remove</button>' : '') +
        '</div></div>' +
        '<div class="tiny muted" style="margin-top:6px">' +
          Math.round(it.size.w * 10)/10 + ' × ' + Math.round(it.size.h * 10)/10 + ' ft' +
          (it.kind === "bed" ? ' · ' + it.row.cols + '×' + it.row.rows + ' squares' : '') + '</div></div>';
    }

    /* legend */
    const beds = items.filter(i => i.kind === "bed");
    if(beds.length && !Gmap.arrange){
      h += '<div class="sec"><h2>What is where</h2></div><div class="card pad0"><div class="list">';
      beds.forEach(i => {
        const b = i.row, ps = Garden.live(b.id);
        const names = ps.map(p => cropName(p.crop_id)).filter((v, ix, a) => a.indexOf(v) === ix);
        h += '<button class="item" onclick="Garden.open(\'' + b.id + '\')"><div class="av">🪴</div>' +
          '<div class="grow"><div class="b">' + esc(b.name) + '</div>' +
          '<div class="tiny muted">' + Math.round(i.size.w*10)/10 + '×' + Math.round(i.size.h*10)/10 + ' ft · ' +
          (names.length ? esc(names.slice(0, 5).join(", ")) + (names.length > 5 ? " +" + (names.length - 5) : "") : "empty") +
          '</div></div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    box.innerHTML = h;
    Gmap.bind();
  },

  bind(){
    const plot = $("#mapplot"); if(!plot) return;
    $$("#mapplot .mapbed, #mapplot .mapfeat").forEach(el => {
      el.onclick = e => {
        if(el._moved){ el._moved = false; return; }
        const id = el.dataset.id;
        if(!Gmap.arrange){
          if(el.dataset.kind === "bed") Garden.open(id);
          return;
        }
        Gmap.sel = Gmap.sel === id ? null : id;
        Garden.render();
      };
      el.addEventListener("pointerdown", e => Gmap.dragStart(e, el));
    });
  },

  dragStart(ev, el){
    if(!Gmap.arrange) return;
    ev.preventDefault();
    const id = el.dataset.id, kind = el.dataset.kind;
    const table = kind === "bed" ? "beds" : "mapitems";
    const row = DB.find(table, id); if(!row) return;
    const ppf = Gmap._ppf;
    const sx = ev.clientX, sy = ev.clientY;
    const ox = num(row.mx, 0), oy = num(row.my, 0);
    el._moved = false;
    const move = e => {
      const dxf = (e.clientX - sx) / ppf, dyf = (e.clientY - sy) / ppf;
      if(Math.abs(e.clientX - sx) > 4 || Math.abs(e.clientY - sy) > 4) el._moved = true;
      const nx = Math.max(0, Math.round((ox + dxf) * 2) / 2);
      const ny = Math.max(0, Math.round((oy + dyf) * 2) / 2);
      el.style.left = Math.round(nx * ppf) + "px";
      el.style.top = Math.round(ny * ppf) + "px";
      el._nx = nx; el._ny = ny;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if(el._moved && el._nx !== undefined){
        DB.update(table, id, { mx: el._nx, my: el._ny });
        Gmap.sel = id;
        haptic();
        Garden.render();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  },

  toggleArrange(){ Gmap.arrange = !Gmap.arrange; Gmap.sel = null; Garden.render(); },

  rotate(id){
    const bed = DB.find("beds", id);
    if(bed){ DB.update("beds", id, { rot: num(bed.rot) === 90 ? 0 : 90 }); }
    else { const m = DB.find("mapitems", id); if(m) DB.update("mapitems", id, { rot: num(m.rot) === 90 ? 0 : 90 }); }
    Garden.render();
  },

  addFeature(){
    let h = '<p class="muted sm" style="margin-top:0">Landmarks are just for orientation — a shed, a tree, the water tap. They help you read the map at a glance.</p>';
    h += '<div class="grid2">';
    Object.keys(FEATURES).forEach(k => {
      const f = FEATURES[k];
      h += '<button class="card" style="text-align:left" onclick="Gmap.saveFeature(\'' + k + '\')">' +
        '<div style="font-size:1.6rem">' + f.e + '</div><div class="b">' + esc(f.n) + '</div>' +
        '<div class="tiny muted">' + f.w + '×' + f.h + ' ft to start</div></button>';
    });
    h += '</div>';
    openSheet("Add a landmark", h);
  },
  saveFeature(kind){
    const f = FEATURES[kind]; if(!f) return;
    const ext = Gmap.extent(APP.plotId || null);
    DB.insert("mapitems", { plot_id: APP.plotId || null, kind: kind, label: f.n,
      w: f.w, h: f.h, mx: 1, my: Math.max(1, ext.h - f.h - 1), rot: 0 });
    closeSheet();
    Gmap.arrange = true;
    Garden.render();
    toast(f.n + " added — drag it into place");
  },
  removeFeature(id){
    DB.remove("mapitems", id);
    Gmap.sel = null; Garden.render(); toast("Removed");
  },

  /* ---------- shareable plan ---------- */
  snapshot(){
    const plotId = APP.plotId && DB.find("plots", APP.plotId) ? APP.plotId : null;
    const items = Gmap.items(plotId), ext = Gmap.extent(plotId);
    const pad = 60, ppf = Math.max(10, Math.min(1000 / ext.w, 1400 / ext.h));
    const W = Math.round(ext.w * ppf) + pad * 2, H = Math.round(ext.h * ppf) + pad * 2 + 90;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const F = (s, wt) => (wt || "600") + " " + s + "px -apple-system, 'Segoe UI', Roboto, sans-serif";

    x.fillStyle = "#f6f8f5"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#16211c"; x.font = F(34, "800");
    x.fillText((plotId ? DB.find("plots", plotId).name : "My garden"), pad, 52);
    x.fillStyle = "#5c6b62"; x.font = F(20, "500");
    x.fillText(fmtY(today()) + "  ·  " + ext.w + " × " + ext.h + " ft" +
      (DB.get("town") ? "  ·  " + DB.get("town") : ""), pad, 78);

    const oy = 100;
    /* one-foot grid */
    x.strokeStyle = "#e2e7e0"; x.lineWidth = 1;
    for(let i = 0; i <= ext.w; i++){
      x.beginPath(); x.moveTo(pad + i * ppf, oy); x.lineTo(pad + i * ppf, oy + ext.h * ppf); x.stroke(); }
    for(let j = 0; j <= ext.h; j++){
      x.beginPath(); x.moveTo(pad, oy + j * ppf); x.lineTo(pad + ext.w * ppf, oy + j * ppf); x.stroke(); }

    items.forEach(i => {
      if(i.x === null || i.y === null) return;
      const L = pad + i.x * ppf, T = oy + i.y * ppf;
      const w = Math.max(24, i.size.w * ppf), hh = Math.max(24, i.size.h * ppf);
      if(i.kind === "bed"){
        x.fillStyle = "#8a6a4f"; roundRect(x, L, T, w, hh, 8); x.fill();
        x.strokeStyle = "#6b4f38"; x.lineWidth = 2; x.stroke();
        x.fillStyle = "#fff"; x.font = F(Math.max(13, Math.min(20, hh * 0.22)), "700");
        x.fillText(esc0(i.row.name).slice(0, 22), L + 8, T + Math.max(18, hh * 0.28));
        const ps = Garden.live(i.row.id);
        const emo = Object.keys(ps.reduce((a, p) => (a[p.crop_id] = 1, a), {})).slice(0, 8).map(cropEmoji).join(" ");
        if(hh > 46){ x.font = F(Math.max(14, Math.min(22, hh * 0.2)), "500");
          x.fillText(emo, L + 8, T + Math.max(40, hh * 0.58)); }
      } else {
        const f = FEATURES[i.row.kind] || { n:"", e:"⬜" };
        x.fillStyle = "#e6e9e4"; roundRect(x, L, T, w, hh, 8); x.fill();
        x.strokeStyle = "#c9cec6"; x.lineWidth = 2; x.stroke();
        x.fillStyle = "#16211c"; x.font = F(Math.max(16, Math.min(26, Math.min(w, hh) * 0.4)), "600");
        x.textAlign = "center";
        x.fillText(f.e, L + w / 2, T + hh / 2 + 6);
        if(w > 70){ x.font = F(13, "600"); x.fillStyle = "#5c6b62";
          x.fillText(esc0(i.row.label || f.n).slice(0, 16), L + w / 2, T + hh - 6); }
        x.textAlign = "left";
      }
    });

    /* north arrow and scale bar */
    x.fillStyle = "#16211c"; x.font = F(22, "700");
    x.fillText("N ↑", W - pad - 44, oy + 24);
    const barFt = ext.w > 20 ? 5 : 2;
    x.strokeStyle = "#16211c"; x.lineWidth = 3;
    x.beginPath(); x.moveTo(pad, H - 26); x.lineTo(pad + barFt * ppf, H - 26); x.stroke();
    x.font = F(16, "600"); x.fillText(barFt + " ft", pad + barFt * ppf + 10, H - 20);

    cv.toBlob(blob => {
      const file = new File([blob], "garden-map-" + iso(today()) + ".png", { type:"image/png" });
      if(navigator.canShare && navigator.canShare({ files:[file] }))
        navigator.share({ files:[file], title:"Garden map" }).catch(() => download(file.name, blob));
      else download(file.name, blob);
      toast("Map saved 🗺️");
    }, "image/png");
  }
};

/* ---------- the Garden tab now has two views ---------- */
Garden.view = "beds";
Garden.viewToggle = function(){
  return '<div class="seg" style="margin-bottom:12px">' +
    '<button class="' + (Garden.view === "beds" ? "on" : "") + '" onclick="Garden.setView(\'beds\')">🪴 Beds</button>' +
    '<button class="' + (Garden.view === "map" ? "on" : "") + '" onclick="Garden.setView(\'map\')">🗺️ Map</button>' +
    '</div>';
};
Garden.setView = function(v){ Garden.view = v; Gmap.sel = null; Garden.render(); };

(function wrapRender(){
  Garden.render = function(){
    if(APP.bedId) return Garden.bedView();
    if(Garden.view === "map") return Gmap.render();
    return Garden.listView();
  };
})();

/* the bed list gets the same toggle at the top */
(function wrapList(){
  const orig = Garden.listView.bind(Garden);
  Garden.listView = function(){
    orig();
    const box = $("#s-garden");
    box.innerHTML = Garden.viewToggle() + box.innerHTML;
  };
})();
</script>
