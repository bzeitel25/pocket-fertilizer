<script>
/* ============================================================
   MULTI-CELL PLANTINGS
   A planting occupies a w x h rectangle of squares. It is either
   ONE plant sprawling over that area (a cucumber that ate six
   square feet) or a BLOCK filled with several plants of the same
   crop. Both are real gardening situations and the app tracks
   which is which, because they mean different things for spacing,
   seed counts and yield per square foot.
   ============================================================ */
Object.assign(Garden, {
  _cs: 46, sel: null,

  /* ---------- geometry ---------- */
  W(p){ return clamp(num(p.w, 1) || 1, 1, 24); },
  H(p){ return clamp(num(p.h, 1) || 1, 1, 24); },
  live(bedId){ return DB.where("plantings", p => p.bed_id === bedId && p.status !== "removed"); },

  covers(p, x, y){
    const px = num(p.x), py = num(p.y);
    return x >= px && x < px + Garden.W(p) && y >= py && y < py + Garden.H(p);
  },
  at(bedId, x, y){ return Garden.live(bedId).find(p => Garden.covers(p, x, y)) || null; },

  /* would a w x h rectangle at (x,y) hit anything or run off the bed? */
  blocked(bed, x, y, w, h, ignoreId){
    if(x < 0 || y < 0 || x + w > num(bed.cols) || y + h > num(bed.rows)) return "outside";
    const hit = Garden.live(bed.id).find(p => {
      if(p.id === ignoreId) return false;
      return !(num(p.x) + Garden.W(p) <= x || x + w <= num(p.x) ||
               num(p.y) + Garden.H(p) <= y || y + h <= num(p.y));
    });
    return hit ? hit : null;
  },

  /* ---------- planting maths ---------- */
  sqFt(bed, w, h){ const c = num(bed.cell_in, 12) / 12; return w * h * c * c; },

  /* how many plants fit in this area at proper spacing */
  fitPlants(cropId, bed, w, h){
    const c = crop(cropId); if(!c) return w * h;
    return Math.max(1, Math.round(c.psf * Garden.sqFt(bed, w, h)));
  },

  /* seeds to sow for a target number of plants, allowing for germination */
  seedsNeeded(cropId, plants, seedId){
    let pct = 85;
    const s = seedId ? DB.find("seeds", seedId) : null;
    if(s){
      const v = Seeds.viability(s);
      if(v.pct) pct = v.pct;
      else if(num(s.germ_rate)) pct = num(s.germ_rate);
    }
    pct = clamp(pct, 5, 100);
    return { seeds: Math.ceil(plants / (pct / 100) * 1.15), pct: Math.round(pct) };
  },

  /* what has this crop actually done in this garden before? */
  observedSpread(cropId){
    const list = DB.where("plantings", p => p.crop_id === cropId &&
      p.span_mode === "single" && (Garden.W(p) * Garden.H(p)) > 1);
    if(!list.length) return null;
    let best = list[0];
    list.forEach(p => { if(Garden.W(p) * Garden.H(p) > Garden.W(best) * Garden.H(best)) best = p; });
    const bed = DB.find("beds", best.bed_id);
    return { w: Garden.W(best), h: Garden.H(best), n: list.length,
             sqft: bed ? Math.round(Garden.sqFt(bed, Garden.W(best), Garden.H(best)) * 10) / 10 : null,
             when: best.sown_on || (best.created || "").slice(0, 10) };
  },

  /* ---------- placing ---------- */
  place(bed, x, y, cropId, silent, opts){
    const o = opts || {};
    const w = clamp(num(o.w, 1), 1, num(bed.cols)), h = clamp(num(o.h, 1), 1, num(bed.rows));
    const mode = o.mode || "fill";
    const qty = o.qty !== undefined ? num(o.qty)
      : (mode === "single" ? 1 : Garden.fitPlants(cropId, bed, w, h));
    const p = DB.insert("plantings", {
      bed_id: bed.id, x: x, y: y, w: w, h: h, span_mode: mode,
      crop_id: cropId, qty: qty, status: "planned", sown_on: iso(today())
    });
    if(!silent) toast(cropName(cropId) + " placed");
    Cal.forPlanting(p);
    return p;
  },

  /* ---------- grid rendering with spans ---------- */
  gridHTML(bed, opts){
    const o = opts || {};
    const cols = num(bed.cols, 4), rows = num(bed.rows, 4);
    const cs = o.cs || 46;
    const gap = o.gap === undefined ? 3 : o.gap;
    const ps = Garden.live(bed.id);
    const conflictCells = {};
    if(o.conflicts) o.conflicts.forEach(c => {
      conflictCells[c.a.x + "," + c.a.y] = 1; conflictCells[c.b.x + "," + c.b.y] = 1; });
    const friendCells = {};
    if(o.friends) o.friends.forEach(c => {
      friendCells[c.a.x + "," + c.a.y] = 1; friendCells[c.b.x + "," + c.b.y] = 1; });

    const start = {}; ps.forEach(p => start[num(p.x) + "," + num(p.y)] = p);
    const taken = {};
    ps.forEach(p => { for(let dy = 0; dy < Garden.H(p); dy++) for(let dx = 0; dx < Garden.W(p); dx++)
      taken[(num(p.x) + dx) + "," + (num(p.y) + dy)] = p.id; });

    let h = '<div class="bed" style="grid-template-columns:repeat(' + cols + ',' + cs + 'px);' +
      'grid-auto-rows:' + cs + 'px;gap:' + gap + 'px;--cs:' + cs + 'px">';
    for(let y = 0; y < rows; y++) for(let x = 0; x < cols; x++){
      const k = x + "," + y, p = start[k];
      if(p){
        const w = Garden.W(p), hh = Garden.H(p);
        const pw = w * cs + (w - 1) * gap, ph = hh * cs + (hh - 1) * gap;
        const big = w > 1 || hh > 1;
        const isSel = Garden.sel === p.id;
        h += '<button class="cell filled ' + (isSel ? "sel" : "") + '" ' +
          (o.interactive ? 'onclick="Garden.tapCell(' + x + ',' + y + ')" ' : '') +
          'style="grid-column:' + (x + 1) + '/span ' + w + ';grid-row:' + (y + 1) + '/span ' + hh + ';' +
          'width:' + pw + 'px;height:' + ph + 'px;' +
          'font-size:' + Math.round(Math.min(pw, ph) * (big ? 0.42 : 0.5)) + 'px">' +
          cropEmoji(p.crop_id) +
          (num(p.qty) > 1 ? '<span class="qty">' + p.qty + '</span>' : '') +
          (p.span_mode === "single" && big ? '<span class="one">1 plant</span>' : '') +
          (conflictCells[k] ? '<span class="warnflag">⚠️</span>'
            : (friendCells[k] ? '<span class="loveflag">💚</span>' : '')) +
          (isSel && o.interactive ? '<span class="grip" onpointerdown="Garden.gripStart(event,\'' + p.id + '\')"></span>' : '') +
          '</button>';
      } else if(!taken[k]){
        h += '<button class="cell" ' + (o.interactive ? 'onclick="Garden.tapCell(' + x + ',' + y + ')"' : '') +
          ' style="grid-column:' + (x + 1) + ';grid-row:' + (y + 1) + ';' +
          'width:' + cs + 'px;height:' + cs + 'px"></button>';
      }
    }
    return h + '</div>';
  },

  miniGrid(b){
    const cols = num(b.cols, 4);
    const cs = clamp(Math.floor(260 / cols), 10, 26);
    return '<div class="bedwrap" style="padding:4px">' + Garden.gridHTML(b, { cs: cs, gap: 2 }) + '</div>';
  },

  /* ---------- drag-to-resize ---------- */
  gripStart(ev, id){
    ev.preventDefault(); ev.stopPropagation();
    const p = DB.find("plantings", id); if(!p) return;
    const bed = DB.find("beds", p.bed_id);
    const startX = ev.clientX, startY = ev.clientY;
    const w0 = Garden.W(p), h0 = Garden.H(p);
    const step = Garden._cs + 3;
    let lastW = w0, lastH = h0;
    const move = e => {
      const dw = Math.round((e.clientX - startX) / step), dh = Math.round((e.clientY - startY) / step);
      const w = clamp(w0 + dw, 1, num(bed.cols) - num(p.x));
      const h = clamp(h0 + dh, 1, num(bed.rows) - num(p.y));
      if(w === lastW && h === lastH) return;
      if(Garden.blocked(bed, num(p.x), num(p.y), w, h, p.id)) return;
      lastW = w; lastH = h;
      DB.update("plantings", p.id, { w: w, h: h });
      Garden.syncQty(p.id);
      Garden.render();
      haptic();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const f = DB.find("plantings", id);
      if(f) toast(Garden.W(f) + "×" + Garden.H(f) + " · " + f.qty + " plant" + (num(f.qty) === 1 ? "" : "s"));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  },

  /* keep plant count sensible when the area changes */
  syncQty(id){
    const p = DB.find("plantings", id); if(!p) return;
    const bed = DB.find("beds", p.bed_id);
    if(p.span_mode === "single"){ DB.update("plantings", id, { qty: 1 }); return; }
    DB.update("plantings", id, { qty: Garden.fitPlants(p.crop_id, bed, Garden.W(p), Garden.H(p)) });
  },

  resizeBy(id, dw, dh){
    const p = DB.find("plantings", id); if(!p) return;
    const bed = DB.find("beds", p.bed_id);
    const w = clamp(Garden.W(p) + dw, 1, num(bed.cols) - num(p.x));
    const h = clamp(Garden.H(p) + dh, 1, num(bed.rows) - num(p.y));
    const hit = Garden.blocked(bed, num(p.x), num(p.y), w, h, p.id);
    if(hit === "outside") return toast("That runs off the edge of the bed");
    if(hit) return toast("Blocked by " + cropName(hit.crop_id));
    DB.update("plantings", id, { w: w, h: h });
    Garden.syncQty(id);
    Garden.plantingSheet(DB.find("plantings", id));
    Garden.render();
  },

  setMode(id, mode){
    DB.update("plantings", id, { span_mode: mode });
    Garden.syncQty(id);
    Garden.plantingSheet(DB.find("plantings", id));
    Garden.render();
  },

  /* ---------- tap handling ---------- */
  tapCell(x, y){
    haptic();
    const bed = DB.find("beds", APP.bedId);
    const ex = Garden.at(bed.id, x, y);
    if(Garden.erase){ if(ex){ Garden.removePlanting(ex.id, true); Garden.render(); } return; }
    if(Garden.paint){
      if(ex){ if(ex.crop_id === Garden.paint) return; Garden.removePlanting(ex.id, true); }
      Garden.place(bed, x, y, Garden.paint, true);
      Garden.render(); return;
    }
    if(ex){
      Garden.sel = (Garden.sel === ex.id) ? null : ex.id;
      Garden.render();
      if(Garden.sel) Garden.plantingSheet(ex);
      return;
    }
    Garden.sel = null;
    Garden.pickCrop(x, y);
  },

  removePlanting(id, silent){
    DB.update("plantings", id, { status:"removed", removed_on: iso(today()) });
    DB.bulkRemove("events", e => e.planting_id === id && e.done !== "1");
    if(Garden.sel === id) Garden.sel = null;
    if(!silent){ closeSheet(); Garden.render(); toast("Square cleared"); }
  },

  /* ---------- the planting sheet ---------- */
  plantingSheet(p){
    if(!p) return;
    const c = crop(p.crop_id), bed = DB.find("beds", p.bed_id);
    const w = Garden.W(p), hh = Garden.H(p);
    const area = Garden.sqFt(bed, w, hh);
    const single = p.span_mode === "single";
    const seeds = DB.where("seeds", s => s.crop_id === p.crop_id);
    const fit = Garden.fitPlants(p.crop_id, bed, w, hh);
    const sn = Garden.seedsNeeded(p.crop_id, num(p.qty, 1), p.seed_id);
    const obs = Garden.observedSpread(p.crop_id);

    let h = '<div class="row" style="gap:12px;margin-bottom:12px"><div style="font-size:2.4rem">' + cropEmoji(p.crop_id) + '</div>' +
      '<div class="grow"><div class="b" style="font-size:1.1rem">' + esc(cropName(p.crop_id)) + '</div>' +
      '<div class="tiny muted">Row ' + (num(p.y)+1) + ', column ' + (num(p.x)+1) + ' of ' + esc(bed.name) +
      ' · ' + w + '×' + hh + ' (' + (Math.round(area*10)/10) + ' sq ft)</div></div></div>';

    /* size */
    h += '<div class="card"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Area it covers</div>' +
      '<div class="row between" style="gap:14px">' +
      '<div><div class="tiny muted">Width</div><div class="stepper">' +
        '<button onclick="Garden.resizeBy(\'' + p.id + '\',-1,0)">−</button><span class="v">' + w + '</span>' +
        '<button onclick="Garden.resizeBy(\'' + p.id + '\',1,0)">＋</button></div></div>' +
      '<div><div class="tiny muted">Height</div><div class="stepper">' +
        '<button onclick="Garden.resizeBy(\'' + p.id + '\',0,-1)">−</button><span class="v">' + hh + '</span>' +
        '<button onclick="Garden.resizeBy(\'' + p.id + '\',0,1)">＋</button></div></div>' +
      '</div>' +
      '<div class="tiny muted" style="margin-top:8px">Tap the square on the grid to select it, then drag the corner handle to stretch it.</div></div>';

    /* mode */
    h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">What is in this area</div>' +
      '<div class="seg">' +
      '<button class="' + (single ? "on" : "") + '" onclick="Garden.setMode(\'' + p.id + '\',\'single\')">One plant, sprawling</button>' +
      '<button class="' + (!single ? "on" : "") + '" onclick="Garden.setMode(\'' + p.id + '\',\'fill\')">Filled with plants</button>' +
      '</div>';
    h += single
      ? '<div class="note i" style="margin-top:10px">One ' + esc(cropName(p.crop_id)) + ' claiming ' + (Math.round(area*10)/10) +
        ' sq ft. This is how you record a plant that grew far bigger than the book says — and the app remembers it for next season.</div>'
      : '<div class="note g" style="margin-top:10px">At ' + esc(c ? c.sp + '" spacing' : 'normal spacing') + ', ' +
        (Math.round(area*10)/10) + ' sq ft holds about <b>' + fit + ' plant' + (fit === 1 ? "" : "s") + '</b>.</div>';
    h += '<div class="field" style="margin-top:12px"><label class="f">Plants here</label>' +
      '<input type="number" id="pl-qty" min="1" value="' + esc(p.qty || 1) + '"></div>';
    const vv = p.variety ? Varieties.find(p.crop_id, p.variety) : null;
    h += '<div class="field"><label class="f">Variety</label>' +
      '<button class="item" style="border:1px solid var(--line);border-radius:12px;width:100%" onclick="Garden.pickVariety(\'' + p.id + '\')">' +
        '<div class="av">' + (p.variety ? "🏷️" : "＋") + '</div>' +
        '<div class="grow"><div class="b">' + (p.variety ? esc(p.variety) : "Choose a variety") + '</div>' +
        '<div class="tiny muted">' + (vv
            ? ((vv.dtm ? vv.dtm + " days · " : "") + esc(vv.habit || "") + (vv.resistance ? " · " + esc(vv.resistance) : ""))
            : (p.variety ? "Tap to change" : "Pick from the list, or look one up")) + '</div></div>' +
        '<span class="go">›</span></button>' +
      '<input type="hidden" id="pl-var" value="' + esc(p.variety || "") + '"></div>';
    if(vv && vv.notes) h += '<div class="note i" style="margin-top:8px">🏷️ <b>' + esc(vv.name) + '.</b> ' + esc(vv.notes) + '</div>';
    if(!single && num(p.qty) !== fit)
      h += '<button class="btn ghost block sm" style="margin-top:8px" onclick="Garden.syncQty(\'' + p.id + '\');Garden.plantingSheet(DB.find(\'plantings\',\'' + p.id + '\'));Garden.render()">Reset to recommended (' + fit + ')</button>';
    h += '</div>';

    /* seeds */
    h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Seeds to sow</div>' +
      '<div class="row between"><div><div class="b" style="font-size:1.3rem">' + sn.seeds + ' seeds</div>' +
      '<div class="tiny muted">for ' + num(p.qty, 1) + ' plant' + (num(p.qty,1) === 1 ? "" : "s") + ' at ~' + sn.pct + '% germination, plus a little spare</div></div>' +
      '<div style="font-size:1.8rem">🌰</div></div>';
    if(seeds.length) h += '<div class="field" style="margin-top:10px"><label class="f">From packet</label><select id="pl-seed"><option value="">— none —</option>' +
      seeds.map(s => '<option value="' + s.id + '"' + (p.seed_id === s.id ? " selected" : "") + '>' +
        esc(s.name + (s.variety ? " · " + s.variety : "")) + '</option>').join("") + '</select></div>';
    else h += '<input type="hidden" id="pl-seed" value="">';
    h += '</div>';

    /* what she has seen before */
    if(obs) h += '<div class="note w" style="margin-top:12px">📐 <b>From your own garden.</b> You recorded ' + esc(cropName(p.crop_id)) +
      ' covering ' + obs.w + '×' + obs.h + (obs.sqft ? ' (' + obs.sqft + ' sq ft)' : '') + ' as a single plant' +
      (obs.when ? ', ' + fmtY(obs.when) : '') + '. Worth allowing that much room again.</div>';

    /* status & dates */
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div><label class="f">Status</label><select id="pl-status">' +
        ["planned","seeded","growing","harvesting","done"].map(s => '<option value="' + s + '"' + (p.status === s ? " selected" : "") + '>' + s + '</option>').join("") +
      '</select></div>' +
      '<div><label class="f">Sown / planted</label><input type="date" id="pl-sown" value="' + esc(p.sown_on || "") + '"></div></div>';
    h += '<div class="field"><label class="f">Notes</label><textarea id="pl-notes" placeholder="How big it actually got, flavour, what you would change">' + esc(p.notes || "") + '</textarea></div>';

    if(c){
      const mx = Maturity.expected(p.crop_id, p.variety);
      const mine = Maturity.mine(p.crop_id, p.variety);
      const rec = DB.where("maturity", m => m.planting_id === p.id)[0];
      const harv = p.sown_on ? Season.harvestFrom(p.crop_id, p.sown_on, "seed", p.variety) : null;
      h += '<div class="card" style="margin-top:12px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Days to maturity</div>';
      if(mx) h += '<div class="row between"><div><div class="b" style="font-size:1.2rem">' + mx.lo + '–' + mx.hi + ' days</div>' +
        '<div class="tiny muted">' + esc({ yours:"your own average, from " + mx.n + " past planting" + (mx.n === 1 ? "" : "s"),
          blend:"your results blended with the catalogue figure", variety:"typical for this variety",
          crop:"typical for the crop — varies a lot by variety" }[mx.source]) + '</div></div>' +
        '<div style="font-size:1.6rem">📈</div></div>';
      if(mine) h += '<div class="note g" style="margin-top:8px">🌱 <b>In your garden.</b> ' + esc(cropName(p.crop_id)) +
        (mine.varietySpecific && p.variety ? ' (' + esc(p.variety) + ')' : '') + ' has averaged <b>' + mine.avg + ' days</b> over ' +
        mine.n + ' planting' + (mine.n === 1 ? "" : "s") + (mine.n > 1 ? ', ranging ' + mine.lo + '–' + mine.hi : '') + '.' +
        (mx && mx.pub && Math.abs(mine.avg - mx.pub.mid) >= 5
          ? ' That is ' + Math.abs(mine.avg - mx.pub.mid) + ' days ' + (mine.avg > mx.pub.mid ? 'slower' : 'faster') + ' than published.' : '') + '</div>';
      if(harv) h += '<div class="note i" style="margin-top:8px">🗓️ First harvest around <b>' + fmtY(harv) + '</b>' +
        (Season.firstFrost() && harv > Season.firstFrost() ? '. That lands after your first frost, so this planting may not finish outdoors.' : '.') + '</div>';
      h += '<button class="btn ' + (rec ? "ghost" : "") + ' block" style="margin-top:10px" onclick="Maturity.sheet(\'' + p.id + '\')">' +
        (rec ? '📈 First harvest recorded — ' + rec.days + ' days' : '📈 Record the first harvest') + '</button>' +
        '<div class="tiny muted" style="margin-top:6px">Every one you record makes the app\'s timing more like your garden and less like a seed catalogue.</div></div>';
      const occ = Garden.live(bed.id).filter(x => x.id !== p.id);
      const bad = [], good = [];
      occ.forEach(o => { const r = pairRating(p.crop_id, o.crop_id);
        if(r.score <= -2) bad.push(cropName(o.crop_id)); else if(r.score >= 1) good.push(cropName(o.crop_id)); });
      if(good.length) h += '<div class="note g" style="margin-top:8px">💚 Happy neighbours: ' + esc(good.filter((v,i,a)=>a.indexOf(v)===i).join(", ")) + '</div>';
      if(bad.length) h += '<div class="note d" style="margin-top:8px">⚠️ Poor neighbours: ' + esc(bad.filter((v,i,a)=>a.indexOf(v)===i).join(", ")) + '</div>';
    }

    h += '<div class="row" style="gap:8px;margin-top:16px">' +
      '<button class="btn ghost" onclick="Garden.removePlanting(\'' + p.id + '\')">Clear</button>' +
      '<button class="btn grow" onclick="Garden.savePlanting(\'' + p.id + '\')">Save</button></div>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Library.open(\'' + p.crop_id + '\')},250)">Full growing guide →</button>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();setTimeout(function(){Journal.quick(\'harvest\',\'' + bed.id + '\',\'' + p.id + '\')},250)">🧺 Log a harvest from this plant</button>';

    openSheet("Planting", h);
  },

  savePlanting(id){
    const p = DB.find("plantings", id); if(!p) return;
    DB.update("plantings", id, {
      variety: $("#pl-var") ? $("#pl-var").value.trim() : p.variety,
      qty: $("#pl-qty") ? Math.max(1, num($("#pl-qty").value, 1)) : p.qty,
      status: $("#pl-status") ? $("#pl-status").value : p.status,
      sown_on: $("#pl-sown") ? $("#pl-sown").value : p.sown_on,
      seed_id: ($("#pl-seed") && $("#pl-seed").value) || null,
      notes: $("#pl-notes") ? $("#pl-notes").value.trim() : p.notes
    });
    Cal.forPlanting(DB.find("plantings", id));
    closeSheet(); Garden.render(); toast("Saved");
  },

  /* placing into a chosen square, then straight into sizing */
  pickCrop(x, y){
    const bed = DB.find("beds", APP.bedId);
    Garden.cropPicker("Plant row " + (y+1) + ", column " + (x+1), id => {
      closeSheet();
      const obs = Garden.observedSpread(id);
      const p = Garden.place(bed, x, y, id, true,
        obs ? { w: Math.min(obs.w, num(bed.cols) - x), h: Math.min(obs.h, num(bed.rows) - y), mode:"single", qty:1 } : {});
      Garden.sel = p.id;
      Garden.render();
      if(obs) toast("Sized to the " + obs.w + "×" + obs.h + " you recorded before");
      setTimeout(() => Garden.plantingSheet(DB.find("plantings", p.id)), 250);
    }, bed);
  }
});

/* conflicts now measure rectangle-to-rectangle distance, not corner-to-corner */
Recommend.conflicts = function(bedId){
  const ps = Garden.live(bedId), out = [];
  const gap = (a, b) => {
    const ax2 = num(a.x) + Garden.W(a) - 1, ay2 = num(a.y) + Garden.H(a) - 1;
    const bx2 = num(b.x) + Garden.W(b) - 1, by2 = num(b.y) + Garden.H(b) - 1;
    const dx = Math.max(0, Math.max(num(a.x) - bx2, num(b.x) - ax2));
    const dy = Math.max(0, Math.max(num(a.y) - by2, num(b.y) - ay2));
    return dx + dy;
  };
  for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
    if(ps[i].crop_id === ps[j].crop_id) continue;
    const r = pairRating(ps[i].crop_id, ps[j].crop_id);
    if(r.score <= -2 && gap(ps[i], ps[j]) <= 2) out.push({ a: ps[i], b: ps[j], why: r.why, dist: gap(ps[i], ps[j]) });
  }
  return out;
};

/* the encouraging mirror of conflicts: pairings worth pointing out */
Recommend.friends = function(bedId){
  const ps = Garden.live(bedId), out = [];
  const gap = (a, b) => {
    const ax2 = num(a.x) + Garden.W(a) - 1, ay2 = num(a.y) + Garden.H(a) - 1;
    const bx2 = num(b.x) + Garden.W(b) - 1, by2 = num(b.y) + Garden.H(b) - 1;
    const dx = Math.max(0, Math.max(num(a.x) - bx2, num(b.x) - ax2));
    const dy = Math.max(0, Math.max(num(a.y) - by2, num(b.y) - ay2));
    return dx + dy;
  };
  for(let i = 0; i < ps.length; i++) for(let j = i + 1; j < ps.length; j++){
    if(ps[i].crop_id === ps[j].crop_id) continue;
    const r = pairRating(ps[i].crop_id, ps[j].crop_id);
    if(r.score >= 1 && gap(ps[i], ps[j]) <= 2) out.push({ a: ps[i], b: ps[j], why: r.why, score: r.score });
  }
  /* a genuinely great pairing outranks a merely good one */
  return out.sort((a, b) => b.score - a.score);
};

/* resizing a bed must not orphan the far edge of a span */
Garden.resize = function(dc, dr){
  const b = DB.find("beds", APP.bedId);
  const cols = clamp(num(b.cols) + dc, 1, 24), rows = clamp(num(b.rows) + dr, 1, 24);
  const orphan = Garden.live(b.id).filter(p =>
    num(p.x) + Garden.W(p) > cols || num(p.y) + Garden.H(p) > rows);
  const apply = () => {
    orphan.forEach(p => {
      const w = Math.min(Garden.W(p), cols - num(p.x)), h = Math.min(Garden.H(p), rows - num(p.y));
      if(w >= 1 && h >= 1){ DB.update("plantings", p.id, { w: w, h: h }); Garden.syncQty(p.id); }
      else DB.update("plantings", p.id, { status:"removed", removed_on: iso(today()) });
    });
    DB.update("beds", b.id, { cols: cols, rows: rows });
    Garden.render();
  };
  if(orphan.length) confirmSheet("Shrink the bed?",
    orphan.length + " planting" + (orphan.length > 1 ? "s" : "") + " will be trimmed or cleared to fit the new size.",
    "Shrink anyway", apply, true);
  else apply();
};
</script>
