<script>
/* ============================================================
   GARDENING TIPS — 100 of them, rotating
   Written to be specific and worth reading twice, not filler.
   ============================================================ */
const TIPS = [
["Soil","Squeeze a handful of soil. If it ribbons out and stays in a sausage it's clay; if it collapses instantly it's sand. That one test tells you more about watering than any meter."],
["Soil","Compost is not fertiliser. It feeds the soil life that feeds the plant — slower, but it fixes drainage, water-holding and structure at the same time."],
["Soil","Never work wet soil. Digging clay while it's soggy destroys the structure and you'll be fighting bricks for two seasons."],
["Soil","Bare soil is soil losing water and topsoil. Something should always be covering it — a crop, a cover crop, or mulch."],
["Soil","Get a soil test before you buy amendments. Most gardens are already high in phosphorus; adding more does nothing and runs off into waterways."],
["Soil","Earthworm count is a decent free soil test. Ten in a spadeful of moist soil means the biology is working."],
["Watering","One inch of water per week, including rain, is the extension baseline for most vegetables. A rain gauge costs less than a coffee and ends the guesswork."],
["Watering","Water deeply and less often. Daily sprinkles train roots to stay in the top inch, where they cook in the first hot spell."],
["Watering","Water the soil, not the leaves, and do it in the morning. Wet foliage overnight is how blight and mildew spread."],
["Watering","One inch of water over one square foot is about 0.6 gallons. Time how long your hose takes to fill a gallon jug and you'll know exactly how long to run it."],
["Watering","Push a finger two inches into the soil. Damp means wait. This beats every schedule and every moisture meter."],
["Watering","A wilting plant in the afternoon heat may be fine — check again in the evening. If it's still limp, then it's thirsty."],
["Watering","Containers dry out several times faster than beds. In a heat wave they can need water twice a day, and a saucer of standing water will rot the roots instead."],
["Mulch","Two to three inches of mulch roughly halves watering, blocks most weed seeds, and keeps soil temperature steady. It's the highest-return hour you'll spend."],
["Mulch","Keep mulch an inch clear of stems. Piled against the stem it holds moisture where you least want it and invites rot."],
["Mulch","Straw, not hay. Hay is full of seed and you'll be weeding grass all summer."],
["Mulch","Never mulch with fresh wood chips dug into the soil — they tie up nitrogen as they break down. On top as a path or surface layer they're fine."],
["Planting","Bury two thirds of a tomato transplant, stem and all. It roots along the buried stem and anchors far better."],
["Planting","Plant nothing tender until soil temperature, not air temperature, is right. Peppers sulk in cold ground and never fully recover."],
["Planting","Harden transplants off over seven to ten days. A seedling moved straight from a windowsill to full sun scorches in an afternoon."],
["Planting","Transplant in the evening or on an overcast day. It gives roots a night to settle before facing the sun."],
["Planting","Sow small seeds shallower than you think. Lettuce needs light to germinate — press it in rather than burying it."],
["Planting","Water seeds in with a gentle rose, not a jet. A hard stream buries them at random depths."],
["Planting","Label everything as you sow. You will not remember, and seedlings of the same family look identical for weeks."],
["Planting","Succession sow the fast crops — lettuce, radish, beans, cilantro — every two weeks instead of all at once. You'll eat all season rather than all at once."],
["Spacing","Thin ruthlessly. Two good plants beat six starved ones, and crowding invites every fungal disease going."],
["Spacing","Give vining squash and cucumbers a trellis. Vertical fruit is straighter and cleaner and takes a quarter of the ground."],
["Spacing","Plant tall crops on the north side so they don't shade everything else out by July."],
["Seeds","Store seed cool and dry, in a sealed jar in the fridge. Moisture and heat kill viability faster than age does."],
["Seeds","Test old seed before it takes up bed space: ten seeds in a damp paper towel in a bag somewhere warm. Count sprouts after the expected days."],
["Seeds","Onion, parsley and parsnip seed lasts about one year. Buy those fresh every season and stop wondering why they didn't come up."],
["Seeds","Lettuce seed stays viable for years — six is typical. Don't throw it out because it looks old."],
["Seeds","Soak pea, bean, beet and parsley seed overnight before sowing. It knocks days off germination."],
["Seeds","Save seed only from open-pollinated varieties. Seed from an F1 hybrid gives you a lottery, not the plant you liked."],
["Pests","Identify before you spray. Most insects in a garden are neutral or helpful, and a broad-spectrum spray kills the predators first."],
["Pests","A hard jet of water knocks aphids off and they mostly don't climb back. Three days running often ends an outbreak with no spray at all."],
["Pests","If a tomato hornworm has white grains on its back, leave it. Those are parasitic wasp cocoons and that caterpillar is already finished."],
["Pests","Scrape squash bug egg clusters off leaf undersides with a butter knife. Ten seconds now saves the vine in July."],
["Pests","Row cover from the day you sow is the only reliable answer to flea beetles — but take it off once flowers open or nothing gets pollinated."],
["Pests","Don't hang Japanese beetle pheromone traps near the garden. Extension trials find they pull in more beetles than they catch."],
["Pests","Hunt slugs after dark with a torch. Twenty minutes twice a week beats any bait."],
["Pests","Let dill, fennel, cilantro and alyssum flower. Their tiny blooms feed the hoverflies and parasitic wasps that eat your aphids."],
["Pests","Check leaf undersides. Nearly everything that matters — eggs, aphids, mites, mildew — starts there."],
["Disease","Never work among plants when the leaves are wet. You'll carry fungal and bacterial disease from plant to plant on your sleeves."],
["Disease","Mulch is a disease control. Most soil-borne blights reach the plant by rain splashing soil onto the lowest leaves."],
["Disease","Strip the bottom twelve inches of leaves off tomatoes. Airflow at the base is worth more than any spray."],
["Disease","Rotate by plant family, not by crop. Tomato, potato, pepper and eggplant are all the same family and share the same soil diseases."],
["Disease","Bin diseased material, don't compost it. A home compost heap rarely gets hot enough for long enough to kill the spores."],
["Disease","Sterilise pruners between plants with alcohol when anything looks off. Tools spread virus faster than insects do."],
["Disease","Buy varieties with resistance codes when you've had a problem before. It's the cheapest disease control there is."],
["Feeding","Too much nitrogen gives you a magnificent leafy plant and almost no fruit. Ease off once flowering starts."],
["Feeding","Beans and peas fix their own nitrogen. Feeding them nitrogen wastes it and gives you foliage instead of pods."],
["Feeding","Side-dress heavy feeders — corn, brassicas, tomatoes, squash — three to four weeks in, not all at planting."],
["Feeding","Keep fertiliser four to six inches away from stems and water it in, or you'll scorch the roots you're trying to feed."],
["Feeding","Yellow lower leaves usually means nitrogen; yellow new leaves usually means iron or a pH problem. The pattern tells you which."],
["Feeding","Most vegetables want pH between 6.0 and 6.5. Outside that band the nutrients are there but the plant can't reach them."],
["Harvest","Pick constantly. One bean, cucumber or courgette left to mature signals the plant to stop producing."],
["Harvest","Harvest in the morning while everything is full of water and cool. It stores far better than the same thing picked at noon."],
["Harvest","Sweet corn starts turning sugar to starch within hours. Have the water boiling before you pick."],
["Harvest","Pick tomatoes at first blush and ripen them on the counter. The flavour is identical and the birds don't get them."],
["Harvest","Frost genuinely improves kale, parsnip, carrot and brussels sprouts. Cold converts starch to sugar."],
["Harvest","Cut, don't pull. Yanking peppers and squash snaps branches and tears vines."],
["Harvest","Cure winter squash in the sun for ten days and leave two inches of stem. It's the difference between a month and six months of storage."],
["Weather","Water the soil before a frost night. Moist soil holds daytime heat and releases it overnight."],
["Weather","Row cover must not touch the leaves it's protecting, or the cold transfers straight through."],
["Weather","Above about 90°F tomato and pepper pollen goes sterile. Blossom drop in a heat wave isn't your fault and it passes."],
["Weather","Shade cloth over the hottest hours keeps lettuce and spinach going weeks longer into summer."],
["Weather","A week of rain is a week to stay out of the beds. Compacted wet soil undoes a season of work."],
["Planning","Keep a garden notebook, even a scrappy one. Next February you will not remember which tomato was worth the space."],
["Planning","Plan for what you actually eat. A perfect row of something nobody finishes is wasted bed space."],
["Planning","Interplant fast and slow: radishes between carrots mark the row and are gone before the carrots need it."],
["Planning","Count backwards from your first frost to work out the last honest sowing date for anything you plant late."],
["Planning","Start small. A tidy productive 4x8 bed beats a weedy quarter acre in every measure that matters."],
["Planning","Three years is the rotation gap worth aiming for. Brassicas want four where clubroot has appeared."],
["Companions","Basil, marigold and borage genuinely earn their space beside tomatoes — pollinator draw, trap cropping and pest confusion."],
["Companions","Keep alliums away from beans and peas. Onion, garlic and leek suppress them noticeably."],
["Companions","Fennel is the garden's antisocial neighbour — it inhibits most vegetables. Give it a pot or a far corner."],
["Companions","The Three Sisters works: corn as the pole, beans feeding the corn, squash shading out weeds. Sow beans two weeks after corn."],
["Companions","Nasturtium is a genuine trap crop. Aphids and cabbage whites go to it instead of your brassicas."],
["Tools","A sharp hoe used weekly on seedling weeds beats an hour of hand-weeding a month later. Cut them just below the surface."],
["Tools","Clean and oil tools before storing. Rust is a choice."],
["Tools","A five-gallon bucket, a hori-hori knife and a good hose nozzle will do more work than most of the gadget aisle."],
["Tools","Keep a pair of scissors in the garden. Half of harvesting damage comes from pulling things that should be cut."],
["Container","Bigger pots are easier. A small pot dries out, cooks the roots and needs feeding constantly."],
["Container","Use potting mix, not garden soil, in containers. Garden soil compacts into a brick and drains badly in a pot."],
["Container","Every container needs a drainage hole, and gravel in the bottom does not substitute for one — it makes drainage worse."],
["Container","Refresh or replace container mix each year. Last year's is spent and compacted."],
["Seedlings","Bottom heat speeds germination for peppers, tomatoes and aubergines more than anything else you can buy."],
["Seedlings","Light matters more than warmth once seedlings emerge. Leggy, stretched seedlings mean the light is too far away."],
["Seedlings","Put a small fan on your seed tray. Air movement prevents damping off and produces sturdier stems."],
["Seedlings","Bottom-water seed trays. Overhead watering dislodges seed and encourages the fungus that fells seedlings."],
["Seedlings","Pinch the first flowers off transplants. You trade one early fruit for a much bigger plant."],
["General","The best fertiliser is the gardener's shadow. Walking the beds daily catches problems while they're still small."],
["General","Perfection isn't the goal. A few holes in the leaves means the ecosystem is working."],
["General","Grow one thing you've never grown each year. It's how you find out what your garden is actually good at."],
["General","Your local extension office will identify a pest or disease for free. They also know what's moving through your area this week."],
["General","Weeds are information. Plantain says compaction; chickweed says fertile soil; horsetail says wet."],
["General","When something fails, change one variable next time. Change three and you'll never know which mattered."],
["General","Deadhead flowers and pick vegetables and both keep producing. A plant that sets seed thinks its job is done."],
["General","Write the variety name down when something does well. 'That red tomato' is not a variety."],
["General","Most gardening mistakes are recoverable. Very few of them are worth losing an evening over."]
];

const Tips = {
  /* stable across a day so a notification and the app agree */
  forDate(d){
    const dt = d || today();
    const seed = dt.getFullYear() * 1000 + Math.round((dt - new Date(dt.getFullYear(), 0, 1)) / DAY);
    return TIPS[seed % TIPS.length];
  },
  random(){ return TIPS[Math.floor(Math.random() * TIPS.length)]; },
  shown: null,
  card(){
    const t = Tips.shown || Tips.forDate();
    Tips.shown = t;
    return '<div class="card" style="border-left:3px solid var(--green-500)">' +
      '<div class="row between"><div class="tiny b muted" style="text-transform:uppercase;letter-spacing:.06em">' +
        '🌿 Tip · ' + esc(t[0]) + '</div>' +
      '<button class="chip tiny" onclick="Tips.shown=Tips.random();Home.render()">Another</button></div>' +
      '<div class="sm" style="margin-top:6px">' + escU(t[1]) + '</div></div>';
  }
};

/* ============================================================
   REMINDERS
   Local notifications only — there is no server pushing to the
   phone, so these fire while the app is open or recently
   backgrounded, plus a catch-up the moment it is opened. The
   settings copy says exactly that rather than implying more.
   ============================================================ */
const Notify = {
  get on(){ return !!DB.get("notifyOn"); },
  get hour(){ return num(DB.get("notifyHour", 8), 8); },
  supported(){ return typeof Notification !== "undefined"; },
  granted(){ return Notify.supported() && Notification.permission === "granted"; },

  async enable(){
    if(!Notify.supported()) return { ok:false, why:"This browser cannot show notifications." };
    let perm = Notification.permission;
    if(perm === "default"){ try{ perm = await Notification.requestPermission(); }catch(e){ perm = "denied"; } }
    if(perm !== "granted") return { ok:false, why:"Notifications are blocked. Turn them on for this app in your phone's settings." };
    DB.set("notifyOn", true);
    Notify.schedule();
    Notify.send("Reminders are on 🌱", Tips.forDate()[1]);
    return { ok:true };
  },
  disable(){ DB.set("notifyOn", false); if(Notify._t) clearTimeout(Notify._t); },

  async send(title, body, tag){
    if(!Notify.granted() || !Notify.on) return false;
    const opts = { body: body, tag: tag || "pf", icon:"icon-192.png", badge:"icon-192.png" };
    try{
      const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
      if(reg && reg.showNotification){ await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true;
    }catch(e){ return false; }
  },

  /* what actually needs doing, in one line */
  digest(){
    const due = DB.where("events", e => e.done !== "1" && e.type !== "frost" && e.date &&
      diffDays(today(), parseISO(e.date)) >= -3 && diffDays(today(), parseISO(e.date)) <= 2);
    const water = DB.all("beds").map(b => Recommend.water(b.id, APP.weather))
      .filter(w => w && w.verdict === "water").length;
    const frost = (Weather.risks() || []).find(r => /🥶/.test(r.i));
    const bits = [];
    if(frost) bits.push("🥶 " + frost.t + " — cover tender crops");
    if(due.length) bits.push("📌 " + due.length + " thing" + (due.length === 1 ? "" : "s") + " due: " + due.slice(0,2).map(e => e.title).join("; "));
    if(water) bits.push("💧 " + water + " bed" + (water === 1 ? "" : "s") + " need watering");
    return bits;
  },

  /* fired on open, at most once a day */
  async catchUp(){
    if(!Notify.on || !Notify.granted()) return;
    const last = DB.get("notifyLast", "");
    if(last === iso(today())) return;
    DB.set("notifyLast", iso(today()));
    const bits = Notify.digest();
    const tip = Tips.forDate();
    await Notify.send(bits.length ? "In the garden today" : "Gardening tip · " + tip[0],
      bits.length ? bits.join("\n") : tip[1], "pf-daily");
  },

  /* while the app is open, fire at the chosen hour */
  schedule(){
    if(Notify._t) clearTimeout(Notify._t);
    if(!Notify.on) return;
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Notify.hour, 0, 0);
    if(at <= now) at.setDate(at.getDate() + 1);
    const ms = Math.min(at - now, 2147483000);
    Notify._t = setTimeout(() => {
      DB.set("notifyLast", "");
      Notify.catchUp();
      Notify.schedule();
    }, ms);
  },

  sheet(){
    const blocked = Notify.supported() && Notification.permission === "denied";
    openSheet("Daily reminders",
      '<p class="sm" style="margin-top:0">A nudge each morning with anything due — sowing, harvesting, watering, frost warnings — and a gardening tip when there is nothing pressing.</p>' +
      (blocked ? '<div class="note d">Notifications are currently blocked for this app. Turn them back on in your phone\'s settings for the browser or the installed app, then come back here.</div>' : '') +
      '<div class="row between" style="margin-top:14px"><div class="b">Send me reminders</div>' +
        '<button class="switch ' + (Notify.on ? "on" : "") + '" id="nt-on"></button></div>' +
      '<div class="field" style="margin-top:14px"><label class="f">Time of day</label>' +
        '<select id="nt-hour">' + [6,7,8,9,10,17,18,19].map(h =>
          '<option value="' + h + '"' + (h === Notify.hour ? " selected" : "") + '>' +
          (h > 12 ? (h - 12) + ":00 pm" : h + ":00 am") + '</option>').join("") + '</select></div>' +
      '<div class="note i" style="margin-top:14px"><b>What to expect.</b> Reminders come from the app on this phone, not from a server, so they arrive while the app is open or recently used, and you always get a catch-up the moment you open it. Nothing is sent anywhere and no account is involved.</div>' +
      '<button class="btn block" style="margin-top:14px" onclick="Notify.save()">Save</button>' +
      (Notify.on ? '<button class="btn ghost block sm" style="margin-top:8px" onclick="Notify.test()">Send a test now</button>' : ''));
    const sw = $("#nt-on"); if(sw) sw.onclick = () => sw.classList.toggle("on");
  },
  async save(){
    const want = $("#nt-on").classList.contains("on");
    DB.set("notifyHour", num($("#nt-hour").value, 8));
    if(want){
      const r = await Notify.enable();
      if(!r.ok){ toast(r.why); return; }
      toast("Reminders on");
    } else { Notify.disable(); toast("Reminders off"); }
    closeSheet();
    if(APP.tab === "settings") Settings.render();
  },
  async test(){
    const bits = Notify.digest(), tip = Tips.forDate();
    const ok = await Notify.send(bits.length ? "In the garden today" : "Gardening tip · " + tip[0],
      bits.length ? bits.join("\n") : tip[1], "pf-test");
    toast(ok ? "Sent" : "Could not send — check permissions");
  }
};
</script>
