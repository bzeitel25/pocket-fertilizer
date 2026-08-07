<script>
/* ============================================================
   THE SWITCH ITSELF

   It sits in the plot strip at the top of the Garden tab, beside
   the plot chips, because that is where the measurements are and
   because the question "how wide is that bed, really?" arrives
   while you are looking at the bed — not while you are three
   screens away in Settings. Settings carries it too, for the
   person who sets it once and never thinks about it again.

   Tapping it re-renders whatever screen you are on. Nothing is
   written to any row; the toggle is a single setting and every
   number on screen is computed from the stored inches each time
   it is drawn.
   ============================================================ */

Units.chip = function(){
  return '<button class="chip" onclick="Units.flip()" ' +
    'title="Switch between inches and centimetres" aria-label="Measurement units">' +
    '⇄ ' + (Units.metric ? "cm" : "in") + '</button>';
};

Units.flip = function(){
  Units.toggle();
  haptic();
  /* redraw wherever we are — the numbers are all derived, so this is
     the whole of "swap the app over" */
  try{
    if(APP.tab === "garden") Garden.render();
    else if(APP.tab === "seeds") Seeds.render();
    else if(APP.tab === "weather") Weather.render();
    else if(APP.tab === "library") Library.render();
    else if(APP.tab === "journal") Journal.render();
    else if(APP.tab === "recap") Recap.render();
    else if(APP.tab === "settings") Settings.render();
    else if(APP.tab === "home") Home.render();
  }catch(e){ console.warn("units redraw", e); }
  toast(Units.metric ? "Metric — centimetres, kilos, °C" : "Imperial — inches, pounds, °F");
};

(function wireUnits(){

  /* ---- the plot strip, both views of the Garden tab ---- */
  function intoScroller(){
    const sc = $("#s-garden .scroller");
    if(!sc || sc.querySelector('[onclick*="Units.flip"]')) return;
    sc.insertAdjacentHTML("beforeend", Units.chip());
  }

  const origList = Garden.listView;
  Garden.listView = function(){ origList.call(Garden); intoScroller(); };

  const origBed = Garden.bedView;
  Garden.bedView = function(){
    origBed.call(Garden);
    /* the bed screen has no plot strip, so it goes beside the bed's own
       size line, which is the number most likely to be questioned */
    const box = $("#s-garden");
    const row = box ? box.querySelector(".row") : null;
    if(!row || row.querySelector('[onclick*="Units.flip"]')) return;
    const menu = row.querySelector('button[onclick*="bedMenu"]');
    const el = document.createElement("button");
    el.className = "chip";
    el.setAttribute("onclick", "Units.flip()");
    el.setAttribute("aria-label", "Measurement units");
    el.textContent = "⇄ " + (Units.metric ? "cm" : "in");
    if(menu) row.insertBefore(el, menu); else row.appendChild(el);
  };

  if(window.Gmap && Gmap.render){
    const origMap = Gmap.render;
    Gmap.render = function(){ origMap.apply(Gmap, arguments); intoScroller(); };
  }

  /* ---- and in settings, under Look and feel ---- */
  const origSettings = Settings.render;
  Settings.render = function(){
    origSettings.call(Settings);
    const box = $("#s-settings"); if(!box) return;
    const dark = box.querySelector('button[onclick*="toggleTheme"]');
    if(!dark || !dark.parentNode || !dark.parentNode.parentNode) return;
    const card = dark.parentNode.parentNode;
    card.insertAdjacentHTML("beforeend",
      '<div class="row between" style="margin-top:14px"><div class="grow">' +
      '<div class="row" style="gap:6px"><div class="b">Measurements</div>' + infoBtn("units") + '</div>' +
      '<div class="tiny muted">' + (Units.metric
        ? "Centimetres, metres, kilograms, °C"
        : "Inches, feet, pounds, °F") + '</div></div>' +
      '<div class="seg" style="flex:0 0 auto"><button class="' + (!Units.metric ? "on" : "") +
        '" onclick="Units.pick(false)">in</button><button class="' + (Units.metric ? "on" : "") +
        '" onclick="Units.pick(true)">cm</button></div></div>' +
      '<div class="tiny muted" style="margin-top:8px">There is a ⇄ button on the Garden tab too, for switching while you are looking at a bed. ' +
      'Nothing is rewritten either way — your records are kept in one system and simply shown in the other.</div>');
  };
})();

Units.pick = function(metric){
  if(Units.metric === !!metric) return;
  Units.flip();
};

/* the explanation behind the ⓘ, in the same shape as every other one */
INFO.units = {
  t: "Measurements",
  b: "Switch the whole app between inches, feet and pounds, and centimetres, metres and kilograms. Temperatures switch with it.\n\nIt changes how things are shown, not what is recorded, so you can flip back and forth as often as you like without your beds or harvests changing.",
  tech: "Everything is stored canonically — lengths in inches, weights in pounds, temperatures in Fahrenheit, rainfall in inches — and converted only where a number is drawn on screen or read out of an input. Nothing on disk is rewritten when the setting changes, so the conversion is lossless in both directions and the geometry, spacing and solar maths continue to run in inches throughout. Conversions are exact and then rounded for display; figures inside written growing notes are converted by pattern, and anything not clearly recognised as a measurement is left as written."
};
</script>
