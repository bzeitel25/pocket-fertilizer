<script>
/* ============================================================
   PUTTING THE PLANTING SCHEDULE IN A REAL CALENDAR

   The app already works out every date that matters — when each
   sowing window opens, when a packet reaches the end of its
   viability, when each planting should start cropping, and the two
   frost dates the whole year hangs off. All of it lives on a screen
   you have to remember to open.

   That is the wrong place for a reminder. The calendar people
   actually keep is the one on their phone, next to the dentist.

   WHAT THIS IS, HONESTLY.

   This exports a standard iCalendar (.ics) file, which Google
   Calendar, Apple Calendar and Outlook all import. It is a one-way
   snapshot: import it and those dates appear alongside everything
   else; change your plan here and you export again. Events carry a
   stable UID derived from the app's own event id, so a second import
   UPDATES the entries from the first rather than duplicating them —
   which is the part most exports get wrong and the reason people
   only ever import once.

   What it deliberately is NOT is a live two-way Google account
   connection. That needs OAuth, a registered Google Cloud client and
   a server to hold the refresh token; this app has no server by
   design, keeps its data encrypted on the device, and asks for no
   account at all. Claiming "sync" while shipping a download would be
   a lie about where the data goes. A single event can also be pushed
   straight into Google Calendar through their own compose URL, which
   needs no credentials because the person is already signed in.

   All-day events throughout: a sowing window is a day, not 9am.
   ============================================================ */

const CalSync = {
  PRODID: "-//Pocket Fertilizer//Garden Schedule//EN",

  /* ---------- iCalendar plumbing ---------- */

  /* RFC 5545 wants commas, semicolons, backslashes and newlines escaped */
  esc(s){
    return String(s === null || s === undefined ? "" : s)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  },

  /* Lines must not exceed 75 octets. Unfolding is a spec requirement, so a
     long crop note is not optional to wrap — an unwrapped file is rejected
     outright by some importers and silently truncated by others. */
  fold(line){
    if(line.length <= 75) return line;
    let out = line.slice(0, 75), rest = line.slice(75);
    while(rest.length > 74){ out += "\r\n " + rest.slice(0, 74); rest = rest.slice(74); }
    return out + (rest.length ? "\r\n " + rest : "");
  },

  stamp(d){
    const x = d instanceof Date ? d : new Date(d);
    const p = n => String(n).padStart(2, "0");
    return x.getUTCFullYear() + p(x.getUTCMonth()+1) + p(x.getUTCDate()) + "T" +
           p(x.getUTCHours()) + p(x.getUTCMinutes()) + p(x.getUTCSeconds()) + "Z";
  },
  ymd(d){
    const x = d instanceof Date ? d : parseISO(d);
    if(!x) return null;
    const p = n => String(n).padStart(2, "0");
    return x.getFullYear() + p(x.getMonth()+1) + p(x.getDate());
  },

  /* ---------- what goes in ---------- */
  types(){
    return Object.keys(EV).map(k => ({ k: k, n: EV[k].n, i: EV[k].i }));
  },

  events(opts){
    const o = opts || {};
    const from = o.from || addDays(today(), -30);
    const to = o.to || addDays(today(), 400);
    const want = o.types || null;
    const doneToo = !!o.includeDone;
    return DB.all("events").filter(e => {
      if(!e.date) return false;
      if(want && want.indexOf(e.type) < 0) return false;
      if(!doneToo && e.done === "1") return false;
      const d = parseISO(e.date);
      return d && d >= from && d <= to;
    }).sort((a, b) => a.date < b.date ? -1 : 1);
  },

  /* a line of context the calendar entry can stand on its own with */
  describe(e){
    const bits = [];
    if(e.notes) bits.push(e.notes);
    if(e.bed_id){ const b = DB.find("beds", e.bed_id); if(b) bits.push("Bed: " + b.name); }
    if(e.crop_id){
      const c = crop(e.crop_id);
      if(c) bits.push(c.n + " · " + c.dtm + " days to maturity · " + c.sp + '" spacing · ' + c.sun + "h sun");
    }
    if(e.seed_id){ const s = DB.find("seeds", e.seed_id); if(s) bits.push("Packet: " + s.name + (s.variety ? " · " + s.variety : "")); }
    bits.push("From Pocket Fertilizer.");
    return bits.join("\n");
  },

  ics(opts){
    const o = opts || {};
    const evs = CalSync.events(o);
    const now = CalSync.stamp(new Date());
    const L = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:" + CalSync.PRODID,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:" + CalSync.esc(o.name || "Pocket Fertilizer"),
      "X-WR-CALDESC:" + CalSync.esc("Sowing windows, harvest dates and frost dates from your garden plan."),
      "X-WR-TIMEZONE:UTC"
    ];
    evs.forEach(e => {
      const start = CalSync.ymd(e.date); if(!start) return;
      const end = CalSync.ymd(addDays(parseISO(e.date), 1));
      const kind = EV[e.type] || EV.task;
      L.push("BEGIN:VEVENT");
      /* stable, so re-importing updates rather than duplicates */
      L.push("UID:pf-" + (e.auto ? String(e.auto).replace(/[^a-zA-Z0-9:._-]/g, "_") : e.id) + "@pocket-fertilizer");
      L.push("DTSTAMP:" + now);
      L.push("DTSTART;VALUE=DATE:" + start);
      L.push("DTEND;VALUE=DATE:" + end);
      L.push("SUMMARY:" + CalSync.esc(kind.i + " " + e.title));
      L.push("DESCRIPTION:" + CalSync.esc(CalSync.describe(e)));
      L.push("CATEGORIES:" + CalSync.esc(kind.n));
      L.push("TRANSP:TRANSPARENT");
      if(e.done === "1") L.push("STATUS:COMPLETED");
      if(o.alarm){
        /* 9am the day before, which is when you can still act on it */
        L.push("BEGIN:VALARM");
        L.push("TRIGGER:-PT15H");
        L.push("ACTION:DISPLAY");
        L.push("DESCRIPTION:" + CalSync.esc(e.title));
        L.push("END:VALARM");
      }
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.map(CalSync.fold).join("\r\n") + "\r\n";
  },

  /* ---------- one event, straight into Google ----------
     Their compose URL needs no key and no OAuth: the person is already
     signed in, and the entry opens pre-filled for them to confirm. */
  googleUrl(e){
    const start = CalSync.ymd(e.date);
    const end = CalSync.ymd(addDays(parseISO(e.date), 1));
    if(!start) return null;
    const kind = EV[e.type] || EV.task;
    const q = {
      action: "TEMPLATE",
      text: kind.i + " " + e.title,
      dates: start + "/" + end,
      details: CalSync.describe(e)
    };
    return "https://calendar.google.com/calendar/render?" +
      Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&");
  },

  addOne(id){
    const e = DB.find("events", id); if(!e) return;
    const u = CalSync.googleUrl(e);
    if(!u) return toast("That event has no date");
    try{ window.open(u, "_blank", "noopener"); }
    catch(err){ toast("Could not open Google Calendar"); }
  },

  /* ---------- export ---------- */
  download(opts){
    const o = opts || {};
    const evs = CalSync.events(o);
    if(!evs.length) return toast("Nothing in that range to export");
    const text = CalSync.ics(o);
    download("pocket-fertilizer-" + iso(today()) + ".ics",
      new Blob([text], { type: "text/calendar;charset=utf-8" }));
    toast(evs.length + " date" + (evs.length === 1 ? "" : "s") + " exported");
  },

  /* ---------- the sheet ---------- */
  sheet(){
    if(!Season.lastFrost()){
      return openSheet("Calendar sync",
        '<div class="note i">Set your location first — the schedule is built from your frost dates.</div>' +
        '<button class="btn block" style="margin-top:12px" onclick="closeSheet();setTimeout(Onboard.open,250)">Set location</button>');
    }
    Cal.rebuild();
    const all = CalSync.events({ types: null });
    let h = '<p class="muted sm" style="margin-top:0">Export your sowing windows, harvest dates, seed expiry and frost dates as a calendar file. ' +
      'Google Calendar, Apple Calendar and Outlook all import it.</p>';

    h += '<div class="card"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">What to include</div>';
    h += '<div class="row wrap" style="gap:6px">' +
      CalSync.types().map(t => '<button class="chip on" data-t="' + t.k + '">' + t.i + ' ' + esc(t.n) + '</button>').join("") +
      '</div>';
    h += '<div class="field" style="margin-top:12px"><label class="f">How far ahead</label><select id="cs-range">' +
      '<option value="365">The next twelve months</option>' +
      '<option value="180">The next six months</option>' +
      '<option value="90">The next three months</option>' +
      '<option value="1200">Everything the app knows</option></select></div>';
    h += '<div class="row between" style="margin-top:10px"><div><div class="b sm">Remind me the day before</div>' +
      '<div class="tiny muted">Adds an alert at 9am the day before, while you can still act on it.</div></div>' +
      '<button class="switch on" id="cs-alarm"></button></div>';
    h += '<div class="tiny muted" style="margin-top:10px" id="cs-count">' + all.length + ' dates on the schedule</div></div>';

    h += '<button class="btn block" style="margin-top:14px" onclick="CalSync.go()">🗓️ Export calendar file</button>';

    h += '<div class="card" style="margin-top:14px"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Getting it into Google Calendar</div>' +
      '<div class="tiny muted">On a computer: calendar.google.com → the gear → <b>Settings</b> → <b>Import &amp; export</b> → choose the file. ' +
      'On a phone the file usually opens straight into the calendar app when you tap it.<br><br>' +
      'Re-export any time you change the plan and import again — each entry carries a stable id, so the second import ' +
      '<b>updates</b> what the first one added instead of doubling it.</div></div>';

    h += '<div class="note i" style="margin-top:12px"><b>Why a file and not a Google login.</b> A live account connection needs a server ' +
      'holding a token for you. This app has no server and no account — your garden is encrypted on this device and goes nowhere. ' +
      'A file keeps it that way. Single dates can still be pushed straight into Google from the calendar screen.</div>';

    openSheet("Calendar sync", h);
    const a = $("#cs-alarm"); if(a) a.onclick = () => a.classList.toggle("on");
    $$('#sheet-body .chip[data-t]').forEach(el => el.onclick = () => { el.classList.toggle("on"); CalSync.recount(); });
    const r = $("#cs-range"); if(r) r.onchange = CalSync.recount;
  },

  picked(){
    const on = $$('#sheet-body .chip[data-t].on').map(el => el.dataset.t);
    return on.length ? on : null;
  },
  opts(){
    const days = num(($("#cs-range") || {}).value, 365);
    return {
      types: CalSync.picked(),
      from: addDays(today(), -30),
      to: addDays(today(), days),
      alarm: !!($("#cs-alarm") && $("#cs-alarm").classList.contains("on")),
      includeDone: false
    };
  },
  recount(){
    const el = $("#cs-count"); if(!el) return;
    const n = CalSync.events(CalSync.opts()).length;
    el.textContent = n + " date" + (n === 1 ? "" : "s") + " will be exported";
  },
  go(){
    const o = CalSync.opts();
    if(!o.types) return toast("Pick at least one kind of date");
    CalSync.download(o);
  }
};
</script>
