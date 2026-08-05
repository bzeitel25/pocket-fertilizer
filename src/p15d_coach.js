<script>
/* ============================================================
   COACH BANNER
   When the assistant sends you to another screen to do something
   by hand, its instructions used to vanish with the Ask tab. The
   banner carries the message with you until you dismiss it.
   ============================================================ */
const Coach = {
  el(){ return $("#coach"); },
  show(text, opts){
    const o = opts || {};
    const box = Coach.el(); if(!box || !text) return;
    DB.set("coachMsg", { text: String(text), at: Date.now(), from: o.from || "assist" });
    Coach.paint();
  },
  paint(){
    const box = Coach.el(); if(!box) return;
    const m = DB.get("coachMsg", null);
    if(!m || !m.text){ box.innerHTML = ""; box.classList.remove("on"); return; }
    box.innerHTML =
      '<div class="coach-card">' +
        '<div class="row" style="align-items:flex-start;gap:8px">' +
          '<div style="font-size:1.1rem;line-height:1.3">✨</div>' +
          '<div class="grow"><div class="tiny b" style="opacity:.75;text-transform:uppercase;letter-spacing:.06em">From the assistant</div>' +
            '<div class="sm" style="margin-top:2px">' + mdLite(m.text) + '</div></div>' +
          '<button class="coach-x" onclick="Coach.hide()" aria-label="Dismiss">✕</button>' +
        '</div>' +
        '<div class="row" style="gap:6px;margin-top:8px">' +
          (APP.tab === "assist" ? '' : '<button class="chip" onclick="Coach.back()">← Back to Ask</button>') +
          '<button class="chip" onclick="Coach.hide()">Done</button>' +
        '</div>' +
      '</div>';
    box.classList.add("on");
  },
  hide(){ DB.set("coachMsg", null); Coach.paint(); },
  back(){ Coach.hide(); go("assist"); }
};

/* the banner lives outside the screens, so it survives navigation */
(function wrapGo(){
  const orig = window.go;
  window.go = function(tab, opts){ orig(tab, opts); Coach.paint(); };
})();

/* ============================================================
   the assistant flags when it has moved you somewhere
   ============================================================ */
(function trackNav(){
  const NAVS = { open_screen:1, plant_crop:1, create_bed:1 };
  const orig = Assist.run.bind(Assist);
  Assist.run = async function(name, args){
    const out = await orig(name, args);
    if(NAVS[name] && out && out.ok !== false) Assist.navigated = true;
    /* a refused action is exactly the case where she has to do it herself */
    if(out && out.ok === false && /not yours to remove|Seed Bank/i.test(String(out.error || "")))
      Assist.needsHer = true;
    return out;
  };
})();

(function carryMessage(){
  const orig = Assist.send.bind(Assist);
  Assist.send = async function(text){
    Assist.navigated = false; Assist.needsHer = false;
    await orig(text);
    const last = Assist.msgs.slice().reverse().find(m => m.who === "ai");
    if((Assist.navigated || Assist.needsHer) && last && last.text && last.text.length > 3){
      Coach.show(last.text);
    }
  };
})();
</script>
