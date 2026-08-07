<script>
/* ============================================================
   WEATHER — daily & weekly detail + shareable PNG snapshots
   ============================================================ */
const Weather = {
  mode: "week", _failed: false, _loading: false,

  risks(){
    const w = APP.weather; if(!w || !w.daily) return [];
    const d = w.daily, out = [];
    let frost = null, hot = null, rain7 = 0, rainPast = 0, dry = 0;
    d.time.forEach((t, i) => {
      const dd = diffDays(today(), parseISO(t));
      const lo = num(d.temperature_2m_min[i], 99), hi = num(d.temperature_2m_max[i], 0), pr = num(d.precipitation_sum[i]);
      if(dd >= 0 && dd <= 6){
        if(lo <= 36 && !frost) frost = { d: t, t: lo };
        if(hi >= 90 && !hot) hot = { d: t, t: hi };
        rain7 += pr;
        if(pr < 0.02) dry++;
      }
      if(dd < 0 && dd >= -7) rainPast += pr;
    });
    if(frost) out.push({ k:"d", i:"🥶", t: Units.temp(frost.t) + " on " + fmt(frost.d),
      m:"Cover tender crops — tomato, pepper, basil, squash, beans — or bring containers in. Water the soil beforehand; moist soil holds heat overnight." });
    if(hot) out.push({ k:"w", i:"🥵", t: Units.temp(hot.t) + " on " + fmt(hot.d),
      m:"Tomato and pepper pollen goes sterile above about " + Units.temp(90) + ", so expect blossom drop. Shade cloth over the hottest hours, water deeply in the morning, and do not let anything wilt." });
    if(rain7 >= 0.5) out.push({ k:"i", i:"🌧️", t: Units.water(rain7) + ' of rain coming',
      m:"Hold off watering established beds. Wet foliage spreads blight and mildew — stay out of the beds while leaves are wet." });
    if(rain7 < 0.1 && dry >= 6) out.push({ k:"w", i:"🏜️", t:"Dry week ahead",
      m:"No meaningful rain forecast. Water deeply and less often rather than a little every day, and mulch to cut losses roughly in half." });
    if(rainPast > 0.25) out.push({ k:"g", i:"💧", t: Units.water(rainPast) + ' fell in the last week',
      m:"Already banked — subtract this from what your beds need." });
    return out;
  },

  render(){
    const box = $("#s-weather");
    const w = APP.weather;
    if(!DB.get("lat")){
      box.innerHTML = '<div class="card"><div class="note i">Set your location to see local weather.</div>' +
        '<button class="btn block" style="margin-top:10px" onclick="Onboard.open()">Set location</button></div>';
      return;
    }
    if(!w || !w.daily){
      /* fetch at most once per visit — never loop when the network is down */
      if(Weather._failed){
        box.innerHTML = '<div class="card"><div class="note w">Could not reach the weather service. ' +
          'Everything else in the app works offline — planting dates, seed bank, the plant doctor and your records are all on-device.</div>' +
          '<button class="btn block" style="margin-top:10px" onclick="Weather._failed=false;Weather.render()">Try again</button></div>';
        return;
      }
      box.innerHTML = '<div class="card center"><span class="spinner"></span> <span class="muted sm">Fetching weather…</span></div>';
      if(!Weather._loading){
        Weather._loading = true;
        getWeather(true).then(got => {
          Weather._loading = false;
          Weather._failed = !(got && got.daily);
          if(APP.tab === "weather") Weather.render();
        });
      }
      return;
    }
    const c = w.current || {}, d = w.daily;
    const todayIdx = d.time.indexOf(iso(today()));
    let h = '';

    h += '<div class="hero"><div class="row between">' +
      '<div><div class="lbl">' + esc(DB.get("locLabel") || "") + '</div>' +
      '<div style="font-size:2.6rem;font-weight:800;line-height:1">' + Units.temp(num(c.temperature_2m)) + '</div>' +
      '<div class="sm" style="opacity:.94">' + esc(Live.wx(c.weather_code)[0]) + '</div></div>' +
      '<div style="font-size:3.2rem">' + Live.wx(c.weather_code)[1] + '</div></div>';
    if(todayIdx >= 0) h += '<div class="row" style="gap:14px;margin-top:10px;font-size:.8rem;opacity:.95">' +
      '<span>↑ ' + Math.round(num(d.temperature_2m_max[todayIdx])) + '°</span>' +
      '<span>↓ ' + Math.round(num(d.temperature_2m_min[todayIdx])) + '°</span>' +
      '<span>💧 ' + Math.round(num(c.relative_humidity_2m)) + '%</span>' +
      '<span>🌬️ ' + Math.round(num(c.wind_speed_10m)) + ' mph</span></div>';
    h += '</div>';

    h += '<div class="row" style="gap:8px;margin-top:12px">' +
      '<button class="btn grow" onclick="Weather.snapshot(\'today\')">📸 Snapshot today</button>' +
      '<button class="btn grow" onclick="Weather.snapshot(\'week\')">📸 This week</button></div>' +
      '<div class="tiny muted center" style="margin-top:6px">Saves a shareable image — or opens your share sheet on a phone.</div>';

    const risks = Weather.risks();
    if(risks.length){
      h += '<div class="sec"><h2>What it means for the garden</h2></div>';
      risks.forEach(r => h += '<div class="note ' + r.k + '" style="margin-bottom:8px">' + r.i + ' <b>' + esc(r.t) + '</b><br>' + esc(r.m) + '</div>');
    }

    h += '<div class="sec"><h2>Next 7 days</h2></div><div class="card pad0"><table class="mini" style="width:100%">' +
      '<tr><th>Day</th><th></th><th>High</th><th>Low</th><th>Rain</th></tr>';
    d.time.forEach((t, i) => {
      const dd = diffDays(today(), parseISO(t)); if(dd < 0 || dd > 6) return;
      const lo = num(d.temperature_2m_min[i]), hi = num(d.temperature_2m_max[i]), pr = num(d.precipitation_sum[i]);
      h += '<tr><td class="b">' + (dd === 0 ? "Today" : DOW[parseISO(t).getDay()] + " " + parseISO(t).getDate()) + '</td>' +
        '<td>' + Live.wx(d.weather_code[i])[1] + '</td>' +
        '<td>' + Math.round(hi) + '°' + (hi >= 90 ? ' 🥵' : '') + '</td>' +
        '<td' + (lo <= 36 ? ' style="color:var(--info);font-weight:700"' : '') + '>' + Math.round(lo) + '°' + (lo <= 32 ? ' ❄️' : lo <= 36 ? ' 🥶' : '') + '</td>' +
        '<td>' + (pr > 0.01 ? Units.water(pr) : '—') + '</td></tr>';
    });
    h += '</table></div>';

    h += '<div class="sec"><h2>Last 7 days</h2></div><div class="card pad0"><table class="mini" style="width:100%">' +
      '<tr><th>Day</th><th></th><th>High</th><th>Low</th><th>Rain</th></tr>';
    d.time.forEach((t, i) => {
      const dd = diffDays(today(), parseISO(t)); if(dd >= 0 || dd < -7) return;
      h += '<tr><td class="b">' + DOW[parseISO(t).getDay()] + " " + parseISO(t).getDate() + '</td>' +
        '<td>' + Live.wx(d.weather_code[i])[1] + '</td><td>' + Math.round(num(d.temperature_2m_max[i])) + '°</td>' +
        '<td>' + Math.round(num(d.temperature_2m_min[i])) + '°</td>' +
        '<td>' + (num(d.precipitation_sum[i]) > 0.01 ? Units.water(num(d.precipitation_sum[i])) : '—') + '</td></tr>';
    });
    h += '</table></div>';

    const beds = DB.all("beds");
    if(beds.length){
      h += '<div class="sec"><h2>Watering call</h2></div><div class="card pad0"><div class="list">';
      beds.forEach(b => {
        const r = Recommend.water(b.id, w);
        if(!r){ h += '<div class="item"><div class="av">🪴</div><div class="grow"><div class="b">' + esc(b.name) + '</div>' +
          '<div class="tiny muted">Nothing planted</div></div></div>'; return; }
        const label = r.verdict === "skip" ? "Skip — rain covers it" : r.verdict === "light" ? 'Light top-up, ~' + Units.water(r.deficit) : 'Water ' + Units.water(r.deficit) + ' this week';
        h += '<button class="item" onclick="Journal.quick(\'water\',\'' + b.id + '\')"><div class="av">' +
          (r.verdict === "skip" ? "✅" : "💧") + '</div><div class="grow"><div class="b">' + esc(b.name) + '</div>' +
          '<div class="tiny muted">' + esc(label) + ' · needs ' + Units.waterWeek(r.need) + ' · ' + Units.water(r.rain) + ' rain</div></div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }

    if(todayIdx >= 0 && d.sunrise) h += '<div class="card" style="margin-top:12px"><div class="grid3">' +
      '<div class="stat"><span class="n">' + String(d.sunrise[todayIdx]).slice(11,16) + '</span><span class="l">sunrise</span></div>' +
      '<div class="stat"><span class="n">' + String(d.sunset[todayIdx]).slice(11,16) + '</span><span class="l">sunset</span></div>' +
      '<div class="stat"><span class="n">' + Math.round(num(d.uv_index_max[todayIdx])) + '</span><span class="l">UV index</span></div>' +
      '</div></div>';

    h += '<div class="tiny muted center" style="margin-top:14px">Live from Open-Meteo · updated ' +
      (APP.wxAt ? new Date(APP.wxAt).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}) : "—") +
      ' <button class="chip" style="margin-left:6px" onclick="getWeather(true).then(function(){Weather.render()})">↻ Refresh</button></div>';

    box.innerHTML = h;
  },

  /* ---------- canvas snapshot ---------- */
  snapshot(kind){
    const w = APP.weather; if(!w || !w.daily) return toast("No weather loaded");
    const d = w.daily, c = w.current || {};
    const W = 1080, H = kind === "today" ? 1080 : 1350;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");

    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1f6f4a"); g.addColorStop(0.55, "#37a870"); g.addColorStop(1, "#5cc08a");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,255,255,.10)"; x.beginPath(); x.arc(W - 60, -40, 300, 0, 7); x.fill();
    x.beginPath(); x.arc(-40, H + 40, 260, 0, 7); x.fill();

    const F = (s, wt) => (wt || "600") + " " + s + "px -apple-system, 'Segoe UI', Roboto, sans-serif";
    x.textBaseline = "alphabetic";

    x.fillStyle = "rgba(255,255,255,.86)"; x.font = F(30, "700");
    x.fillText("🌱 POCKET FERTILIZER", 60, 88);
    x.font = F(28, "500");
    x.fillText(esc0(DB.get("locLabel") || "") + "  ·  Zone " + (DB.get("zone") || "—"), 60, 132);
    x.fillText(fmtY(today()) + "  ·  " + DOW[today().getDay()], 60, 174);

    x.fillStyle = "#fff"; x.font = F(150, "800");
    x.fillText(Math.round(num(c.temperature_2m)) + "°", 60, 330);
    x.font = F(46, "700");
    x.fillText(Live.wx(c.weather_code)[1] + "  " + Live.wx(c.weather_code)[0], 60, 392);

    const ti = d.time.indexOf(iso(today()));
    x.font = F(30, "600"); x.fillStyle = "rgba(255,255,255,.92)";
    if(ti >= 0) x.fillText("High " + Math.round(num(d.temperature_2m_max[ti])) + "°   Low " + Math.round(num(d.temperature_2m_min[ti])) + "°" +
      "   Humidity " + Math.round(num(c.relative_humidity_2m)) + "%   Wind " + Math.round(num(c.wind_speed_10m)) + " mph", 60, 448);

    let y = 520;
    if(kind === "week"){
      x.fillStyle = "rgba(255,255,255,.14)";
      roundRect(x, 44, y, W - 88, 300, 28); x.fill();
      x.fillStyle = "rgba(255,255,255,.86)"; x.font = F(26, "700");
      x.fillText("THE WEEK AHEAD", 76, y + 52);
      const days = [];
      d.time.forEach((t, i) => { const dd = diffDays(today(), parseISO(t)); if(dd >= 0 && dd <= 6) days.push(i); });
      const colW = (W - 152) / Math.max(1, days.length);
      days.forEach((i, n) => {
        const cx = 76 + colW * n + colW / 2, t = parseISO(d.time[i]);
        const lo = num(d.temperature_2m_min[i]), hi = num(d.temperature_2m_max[i]), pr = num(d.precipitation_sum[i]);
        x.textAlign = "center";
        x.fillStyle = "rgba(255,255,255,.85)"; x.font = F(24, "700");
        x.fillText(n === 0 ? "TODAY" : DOW[t.getDay()].toUpperCase(), cx, y + 108);
        x.font = F(40, "600"); x.fillText(Live.wx(d.weather_code[i])[1], cx, y + 158);
        x.fillStyle = "#fff"; x.font = F(32, "800"); x.fillText(Math.round(hi) + "°", cx, y + 208);
        x.fillStyle = lo <= 36 ? "#bfe4ff" : "rgba(255,255,255,.72)"; x.font = F(28, "600");
        x.fillText(Math.round(lo) + "°", cx, y + 248);
        if(pr > 0.01){ x.fillStyle = "#cfe8ff"; x.font = F(22, "600"); x.fillText(Units.water(pr), cx, y + 286); }
        x.textAlign = "left";
      });
      y += 348;
    }

    const risks = Weather.risks().slice(0, kind === "today" ? 2 : 3);
    if(risks.length){
      const cardH = 40 + risks.length * 118;
      x.fillStyle = "rgba(0,0,0,.20)";
      roundRect(x, 44, y, W - 88, cardH, 28); x.fill();
      let ry = y + 74;
      risks.forEach(r => {
        x.fillStyle = "#fff"; x.font = F(30, "800");
        x.fillText(r.i + "  " + esc0(r.t), 76, ry);
        x.fillStyle = "rgba(255,255,255,.85)"; x.font = F(24, "500");
        wrapText(x, esc0(r.m), 76, ry + 40, W - 152, 32, 2);
        ry += 118;
      });
      y += cardH + 24;
    }

    const left = Season.daysLeft();
    x.fillStyle = "rgba(255,255,255,.80)"; x.font = F(26, "600");
    if(left !== null && left > 0) x.fillText("🍂 " + left + " days until first frost (" + fmt(Season.firstFrost()) + ")", 60, Math.min(H - 60, y + 20));
    x.font = F(22, "500"); x.fillStyle = "rgba(255,255,255,.6)";
    x.fillText("Weather data: Open-Meteo", 60, H - 42);

    cv.toBlob(blob => {
      const file = new File([blob], "garden-weather-" + iso(today()) + ".png", { type:"image/png" });
      if(navigator.canShare && navigator.canShare({ files:[file] })){
        navigator.share({ files:[file], title:"Garden weather", text:"Weather for the garden — " + fmtY(today()) })
          .catch(() => download(file.name, blob));
      } else download(file.name, blob);
      toast("Snapshot ready 📸");
    }, "image/png");
  }
};

function roundRect(x, l, t, w, h, r){
  x.beginPath();
  x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
  x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
  x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r);
  x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
function wrapText(x, text, l, t, maxW, lh, maxLines){
  const words = String(text).split(" "); let line = "", n = 0;
  for(let i = 0; i < words.length; i++){
    const test = line + words[i] + " ";
    if(x.measureText(test).width > maxW && line){
      x.fillText(line.trim(), l, t + n * lh); line = words[i] + " "; n++;
      if(n >= maxLines){ x.fillText(line.trim().slice(0, 60) + "…", l, t + n * lh); return; }
    } else line = test;
  }
  x.fillText(line.trim(), l, t + n * lh);
}
/* strip anything that is not plain text before it hits canvas */
function esc0(s){ return String(s === null || s === undefined ? "" : s).replace(/[\x00-\x1f\x7f]/g, " "); }
</script>
