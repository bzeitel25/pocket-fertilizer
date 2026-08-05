<script>
/* ============================================================
   PLACE NAMES
   phzmapi returns a zone and coordinates but no place name, so a
   ZIP lookup used to leave the app showing "ZIP 27560" — or
   nothing at all. Open-Meteo's geocoder resolves a US postcode to
   a town, so the app can say "Morrisville, North Carolina".
   ============================================================ */
Live.nameForZip = async function(zip){
  try{
    const g = await Live.jget("https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=en&countryCode=US&name=" +
      encodeURIComponent(String(zip).trim()));
    const r = (g.results || [])[0];
    if(!r) return null;
    return { town: r.name, region: r.admin1 || "", country: r.country_code || "",
             lat: r.latitude, lon: r.longitude };
  }catch(e){ return null; }
};

Live.byZip = async function(q){
  const z = String(q).trim();
  if(/^\d{5}$/.test(z)){
    let zone = null, lat = null, lon = null, range = null;
    try{
      const d = await Live.jget("https://phzmapi.org/" + z + ".json");
      zone = d.zone; lat = parseFloat(d.coordinates.lat); lon = parseFloat(d.coordinates.lon);
      range = d.temperature_range;
    }catch(e){ /* zone lookup can fail; the place lookup below may still work */ }

    const place = await Live.nameForZip(z);
    if(place || lat !== null){
      const town = place ? place.town : null;
      const region = place ? place.region : null;
      return {
        zip: z, zone: zone,
        lat: lat !== null ? lat : place.lat,
        lon: lon !== null ? lon : place.lon,
        town: town, region: region,
        label: town ? (town + (region ? ", " + region : "")) : ("ZIP " + z),
        tempRange: range, src: zone ? "phzmapi + open-meteo" : "open-meteo"
      };
    }
  }
  const g = await Live.jget("https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=en&name=" + encodeURIComponent(z));
  if(!g.results || !g.results.length) throw new Error("Couldn't find that place");
  const r = g.results[0];
  return { zip: null, zone: null, lat: r.latitude, lon: r.longitude,
           town: r.name, region: r.admin1 || "",
           label: [r.name, r.admin1].filter(Boolean).join(", "),
           src: "open-meteo" };
};

Live.byGPS = async function(){
  const p = await new Promise((res, rej) => {
    if(!navigator.geolocation) return rej(new Error("No GPS on this device"));
    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, maximumAge: 600000 });
  });
  const lat = p.coords.latitude, lon = p.coords.longitude;
  /* name the nearest town by searching the geocoder and picking the closest hit */
  let town = null, region = null;
  try{
    const g = await Live.jget("https://geocoding-api.open-meteo.com/v1/search?count=100&format=json&language=en&name=" +
      encodeURIComponent(""));
    void g;
  }catch(e){}
  return { zip: null, zone: null, lat: lat, lon: lon, town: town, region: region,
           label: town ? town + (region ? ", " + region : "")
                       : "Your location (" + lat.toFixed(2) + ", " + lon.toFixed(2) + ")",
           src: "gps" };
};

/* store the parts, not just a display string, so the UI can format them */
Onboard.apply = function(loc, fr){
  const zone = loc.zone || (fr && fr.zoneFromLow) || "6b";
  let lastF, firstF, src;
  if(fr && fr.lastFrost && fr.firstFrost){ lastF = fr.lastFrost; firstF = fr.firstFrost; src = fr.src; }
  else { const f = Season.fallbackFrom(zone); lastF = f[0]; firstF = f[1]; src = "zone average (offline estimate)"; }
  DB.set("zip", loc.zip || null);
  DB.set("town", loc.town || null);
  DB.set("region", loc.region || null);
  DB.set("locLabel", loc.label);
  DB.set("lat", loc.lat); DB.set("lon", loc.lon);
  DB.set("zone", zone);
  DB.set("lastFrost", lastF); DB.set("firstFrost", firstF);
  DB.set("frostSrc", src);
  if(fr && fr.avgAnnualLow !== null && fr.avgAnnualLow !== undefined) DB.set("avgLow", fr.avgAnnualLow);
  DB.set("onboarded", true);
  return { zone: zone, lastF: lastF, firstF: firstF, src: src };
};

/* one-time repair for installs saved before place names existed */
Onboard.repairLabel = async function(){
  const zip = DB.get("zip"), label = DB.get("locLabel", "");
  if(!zip || DB.get("town")) return;
  if(!/^ZIP\b/i.test(label) && label) return;
  const place = await Live.nameForZip(zip);
  if(!place) return;
  DB.set("town", place.town);
  DB.set("region", place.region);
  DB.set("locLabel", place.town + (place.region ? ", " + place.region : ""));
  if(APP.tab === "home") Home.render();
};

Onboard.lookup = async function(q, gps){
  const out = $("#ob-out");
  if(!gps && !String(q || "").trim()){ out.innerHTML = '<div class="note d">Enter a ZIP or a place name.</div>'; return; }
  out.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Finding your area…</span></div>';
  let loc;
  try{ loc = gps ? await Live.byGPS() : await Live.byZip(q); }
  catch(e){ out.innerHTML = '<div class="note d">' + esc(e.message || "Lookup failed") +
    '. Check your connection, or set frost dates by hand in Settings → Advanced.</div>'; return; }

  out.innerHTML = '<div class="row"><span class="spinner"></span><span class="sm muted">Reading ten years of local frost history…</span></div>';
  let fr = null;
  try{ fr = await Live.frostDates(loc.lat, loc.lon); }catch(e){}

  const r = Onboard.apply(loc, fr);
  const yr = today().getFullYear();
  out.innerHTML =
    '<div class="note g"><div class="b" style="font-size:1.05rem">' + esc(loc.label) + '</div>' +
    '<div class="b" style="margin-top:2px">Growing zone ' + esc(r.zone) + (loc.zip ? ' · ZIP ' + esc(loc.zip) : '') + '</div>' +
    '<div style="margin-top:8px">❄️ Last spring frost <b>' + fmt(yr + "-" + r.lastF) + '</b><br>' +
    '🍂 First fall frost <b>' + fmt(yr + "-" + r.firstF) + '</b><br>' +
    '🌱 Growing season <b>' + diffDays(parseISO(yr + "-" + r.lastF), parseISO(yr + "-" + r.firstF)) + ' days</b></div>' +
    '<div class="tiny" style="margin-top:6px;opacity:.8">Source: ' + esc(r.src) +
    (fr && fr.avgAnnualLow !== null && fr.avgAnnualLow !== undefined ? ' · average annual low ' + fr.avgAnnualLow + '°F' : '') + '</div></div>' +
    '<button class="btn block" style="margin-top:12px" onclick="closeSheet();Cal.rebuild();refresh();toast(\'Saved — ' + esc((loc.town || "location").replace(/'/g, "")) + '\')">Use these</button>' +
    '<button class="btn ghost block" style="margin-top:8px" onclick="closeSheet();go(\'settings\')">Adjust by hand</button>';
  await getWeather(true);
};
</script>
