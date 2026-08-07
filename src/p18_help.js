<script>
/* ============================================================
   HELP — the starter guide, in the app
   Written for someone who has just opened it for the first time.
   ============================================================ */
const GUIDE = [
{ id:"start", icon:"🌱", t:"Getting started",
  p:["Open the app and tell it where you garden. Everything else follows from that.",
     "Tap **Set my location** and type your ZIP code. The app looks up your growing zone, then reads ten years of local weather to work out when frost usually ends in spring and returns in autumn. Those two dates drive every planting date it suggests.",
     "If the dates look wrong for your particular garden — a frost pocket, a warm south wall — you can change them by hand under Settings → Advanced settings."],
  steps:["Tap Set my location on the home screen","Enter your ZIP code, tap Look it up","Tap Use these"] },

{ id:"install", icon:"📲", t:"Putting it on your home screen",
  p:["This works like an app once installed: its own icon, full screen, and it keeps working with no signal at the far end of the garden.",
     "On an iPhone open the link in Safari, tap the Share button, then **Add to Home Screen**. On Android, open it in Chrome and tap **Install on this phone** in Settings, or use the browser menu's Install option.",
     "To get later improvements, open Settings and tap **Check for updates**. Your garden records are never touched by an update."],
  steps:["Open the link on your phone","Add to Home Screen","Open it from the new icon"] },

{ id:"beds", icon:"🪴", t:"Planning your beds",
  p:["A bed is a grid. Each square is one square foot by default — the classic square-foot method — but you can change the square size for wide rows or in-ground beds.",
     "Tap **Garden**, then New bed, and set how many squares across and down. Tap any empty square to plant it. The app knows real spacing, so a square of lettuce becomes four plants and a square of carrots sixteen.",
     "Plants can cover more than one square. Tap a planting to select it, then drag the round handle at its corner — or use the width and height steppers — to stretch it across as many squares as it really takes.",
     "When you stretch something, say which it is: **one plant sprawling** over that area, or the area **filled with plants** at proper spacing. If you record a single cucumber covering six square feet, the app remembers and offers that same footprint next time you plant cucumber.",
     "To move something, **press and hold it** for a moment until it lifts, then drag it wherever you like and let go. It lands on the nearest square that works — and if you drop it on another planting, the two swap places, provided the one being displaced fits where yours came from.",
     "To plant several of the same thing, open one and tap **Duplicate** for an instant copy in the nearest free space, or **Copy to place** and then tap as many squares as you want. Copies keep the size, variety and plant count of the original.",
     "Plantings that shouldn't sit next to each other get a ⚠️ on the grid; ones that help each other get a 💚. Tap either for the reason."],
  steps:["Garden → New bed","Tap a square, pick a crop","Press and hold a planting to drag it","Tap it, then Duplicate or Copy to place more"] },

{ id:"map", icon:"🗺️", t:"Seeing the whole garden",
  p:["The Garden tab has two views. **Beds** is the list you plant into; **Map** is the plan of your whole garden.",
     "Every bed appears on the map at its real size in feet, with the crops growing in it shown inside. Tap any bed to open and work on it.",
     "Tap **Arrange** and you can drag beds around until the plan matches your actual garden. Everything snaps to the nearest half foot. Select something and you can rotate it ninety degrees — useful for a long bed that runs the other way.",
     "Add landmarks for orientation: the shed, a tree, the water tap, the path, the house. They aren't planted, they just make the map readable at a glance.",
     "The 📸 button saves the whole plan as a picture, with a north arrow and a scale bar, so you can print it or send it to someone."],
  steps:["Garden → Map","Tap Arrange","Drag beds into place, rotate as needed","Add landmarks, then tap Done"] },

{ id:"seeds", icon:"🌰", t:"The seed bank",
  p:["Add every packet you own and the app takes it from there.",
     "Tap **Seeds → Add packet**. Photograph the packet or type it in. What matters most is the crop, the variety and the year it was packed — the packed year is how the app works out whether the seed is still good.",
     "Each packet gets a viability rating based on how long that crop's seed normally lasts. Old packets are flagged before they waste bed space, and the 🧪 Germ test button walks you through the ten-seed paper towel test if you want to check for certain.",
     "Adding packets is also what fills your calendar — see below."],
  steps:["Seeds → Add packet","Pick the crop and variety","Enter the packed year","Save"] },

{ id:"calendar", icon:"🗓️", t:"The grow calendar",
  p:["The calendar builds itself. You don't enter planting dates.",
     "Every packet in your seed bank generates its own dates, worked out from your frost dates: when to start it indoors, when to move it outside, when to sow directly, and when to sow for a fall crop. Anything you plant also gets a projected first-harvest date.",
     "Dates are always in the future. If a crop's window for this year has already gone by, the app shows next year's date instead.",
     "You can add your own tasks alongside, and tick anything off as you do it."],
  steps:["Seeds → add your packets","Calendar fills in automatically","Tap any entry for the detail"] },

{ id:"doctor", icon:"🔬", t:"Diagnosing a sick plant",
  p:["Tap **Doctor**, then photograph the affected leaf — or upload a photo you already took.",
     "The app looks at the picture on your phone and measures how much of the leaf is healthy green, yellowing or browning, and whether the damage sits at the edges. That pre-selects some symptoms for you.",
     "Then tick everything else you can see: spots, holes, wilting, insects, and what the weather and watering have been like. The more you tick, the sharper the answer.",
     "You get ranked possibilities with a confidence figure, what to do in the next 48 hours, how to prevent it next time, and a link to the university extension page that published the guidance so you can check it yourself.",
     "For anything that spreads — blight, wilt, a virus — get a real identification from your local extension office. There's a button for that on every diagnosis."],
  steps:["Doctor → Open camera","Take the photo","Tick what you can see","Diagnose"] },

{ id:"weather", icon:"🌤️", t:"Weather that means something",
  p:["The Weather screen shows the week ahead and the week just gone, but the useful part is what it says about your plants.",
     "It flags frost nights, heat above the point where tomato and pepper pollen stops working, wet spells that spread disease, and dry weeks that need deep watering.",
     "It also tells you which beds actually need water, by subtracting the rain that has already fallen from what those particular crops need.",
     "The 📸 Snapshot buttons turn the day or the week into a picture you can share."],
  steps:["Menu → Weather","Read the garden notes at the top","Tap a bed to log watering"] },

{ id:"assistant", icon:"✨", t:"The assistant",
  p:["Tap **Ask** and either type or hold the microphone and talk.",
     "It isn't just advice — it can do things. Ask it to add tomatoes to plot A and it opens that bed with tomatoes ready to place, and warns you if the bed is short on sun or already holds a bad neighbour. It can create beds, add seed packets, log harvests and watering, and answer questions about your own records like how much you picked last month.",
     "If it sends you to another screen to finish something by hand, its instructions travel with you as a banner at the top until you dismiss them.",
     "It needs a free key from Google or Anthropic to think. Settings → the assistant walks you through it; it takes about a minute and no card is required."],
  steps:["Settings → Ask questions, get things done → Connect","Follow the link to create a free key","Paste it in and save","Use the ✨ Ask tab"] },

{ id:"journal", icon:"📖", t:"Keeping records",
  p:["Log watering, feeding, treatments, weeding and harvests as you go. It takes seconds and it is what makes the end-of-season recap worth reading.",
     "For harvests, record the weight and roughly what it would have cost in a shop. The recap then works out yield per crop, pounds per square foot for each bed, and what your food actually cost you to grow.",
     "When you log the first harvest from a planting, the app notes how many days it really took and starts building your garden's own days-to-maturity figures. After a few records it plans with your numbers instead of the seed catalogue's."],
  steps:["Home → Log a harvest, or Journal → Log activity","Record weight and value","Read the Season Recap in autumn"] },

{ id:"trust", icon:"📚", t:"How much to trust it",
  p:["Germination temperatures, seed viability, watering and pH come from university extension services and the USDA, and every crop page links to the source so you can check.",
     "Days to maturity is shown as a range rather than a single number, because it swings with variety, heat and light. Your seed packet always wins over the app.",
     "Spacing and sowing dates are regional. The app calculates from your own frost dates, which is the best it can do, but your local extension office knows your area better.",
     "Companion planting evidence is mixed. The app flags conflicts only where there's a defensible reason — shared pests, shared disease, competition — and says so on the Sources screen."],
  steps:["Menu → Sources & accuracy","Tap any source to read the original"] },

{ id:"privacy", icon:"🔒", t:"Your information",
  p:["Everything stays on your phone. There is no account, nothing is uploaded, and no one else can see your garden.",
     "The records are scrambled before they're stored, so they can't be read off the device. You can add a passphrase in Settings if the phone is shared — but if you forget it, nothing can recover the notes, so save a backup first.",
     "Settings → Save a backup writes everything to a single file you can keep somewhere safe or move to a new phone.",
     "The only things that leave the phone are the weather and zone lookups, and the assistant if you connect one."],
  steps:["Settings → Save a backup","Optionally set a passphrase","Keep the backup file somewhere safe"] },

{ id:"twodevices", icon:"⇄", t:"Using two devices",
  p:["A phone in the garden and a tablet on the kitchen table are two separate copies of this app, each with its own records. You can move a garden from one to the other.",
     "On the device that has the garden, go to **Garden** and tap **Copy this garden to another device** — or Settings → Two devices → Send. Choose which plots to include, and whether to bring seed packets, your journal and harvests, and photos. Photos are what make the file large, so leave them off if you are emailing it.",
     "That saves one file. Send it however suits — AirDrop, Nearby Share, email, a cloud drive.",
     "On the other device, open Settings and tap **Bring a garden in from a file**. It shows you what is in the file before writing anything: how many beds and plants, and any varieties or crops that device has not seen before, which it will add for you.",
     "It **adds**, it never replaces. Whatever is already on that device is untouched, and a plot arriving under a name that is taken comes in with (imported) after it. This is the difference between this and Restore from a backup, which wipes the device and puts the backup in its place.",
     "Two things stay behind on purpose. Your own days-to-maturity averages are not carried, because a file can be imported twice and counting one garden twice in its own average would skew every harvest date afterwards. And sowing dates are recalculated from *that* device's frost dates, so if the two are set to different places the dates will differ — the beds and plants themselves come across exactly."],
  steps:["Garden → Copy this garden to another device","Choose the plots and what to include","Save the file and send it over","On the other device: Settings → Bring a garden in from a file"] }
];

const Help = {
  open: null,
  render(){
    const box = $("#s-help");
    let h = '<div class="card"><div class="row" style="gap:10px"><div style="font-size:1.8rem">📖</div>' +
      '<div class="grow"><div class="b">How to use Pocket Fertilizer</div>' +
      '<div class="tiny muted">Everything the app does, in order, from first open.</div></div></div>' +
      '<button class="btn ghost block sm" style="margin-top:12px" onclick="Help.download()">⬇︎ Save this guide to my phone</button></div>';

    h += '<div class="sec"><h2>Guide</h2></div>';
    GUIDE.forEach(g => {
      const open = Help.open === g.id;
      h += '<div class="card" style="margin-bottom:10px">' +
        '<button class="row between" style="width:100%;text-align:left" onclick="Help.toggle(\'' + g.id + '\')">' +
          '<div class="row" style="gap:10px"><div style="font-size:1.4rem">' + g.icon + '</div>' +
          '<div class="b">' + esc(g.t) + '</div></div>' +
          '<div style="color:var(--text-3);font-size:1.1rem">' + (open ? "⌄" : "›") + '</div></button>';
      if(open){
        g.p.forEach(par => h += '<p class="sm" style="margin:10px 0 0">' + mdLite(par) + '</p>');
        if(g.steps && g.steps.length){
          h += '<div class="note g" style="margin-top:12px"><b>Quick steps</b><ol style="margin:6px 0 0;padding-left:18px">' +
            g.steps.map(s => '<li style="margin-bottom:3px">' + esc(s) + '</li>').join("") + '</ol></div>';
        }
      }
      h += '</div>';
    });

    h += '<div class="sec"><h2>Still stuck?</h2></div><div class="card">' +
      '<div class="sm">Ask the assistant — it knows this app and your garden. Or reach a real gardener: your county extension office answers questions free.</div>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<button class="btn ghost sm" onclick="go(\'assist\')">✨ Ask the assistant</button>' +
      '<a class="btn ghost sm" href="https://ask.extension.org/" target="_blank" rel="noopener noreferrer">Ask Extension ↗</a></div></div>';

    box.innerHTML = h;
  },
  toggle(id){ Help.open = Help.open === id ? null : id; Help.render(); },

  text(){
    const L = [];
    L.push("POCKET FERTILIZER — USER GUIDE");
    L.push("Version " + BUILD);
    L.push("https://bzeitel25.github.io/pocket-fertilizer/");
    L.push("");
    L.push("A gardener's pocket assistant: plan beds on a grid, track a seed bank,");
    L.push("get a calendar built from your own frost dates, diagnose sick plants from");
    L.push("a photo, read the weather for what it means to your plants, and ask for");
    L.push("any of it by voice. Everything stays on your phone.");
    L.push("");
    GUIDE.forEach(g => {
      L.push("");
      L.push("=".repeat(64));
      L.push(g.t.toUpperCase());
      L.push("=".repeat(64));
      L.push("");
      g.p.forEach(p => { L.push(p.replace(/\*\*/g, "")); L.push(""); });
      if(g.steps && g.steps.length){
        L.push("Quick steps:");
        g.steps.forEach((s, i) => L.push("  " + (i + 1) + ". " + s));
        L.push("");
      }
    });
    L.push("");
    L.push("=".repeat(64));
    L.push("WHERE THE ADVICE COMES FROM");
    L.push("=".repeat(64));
    L.push("");
    Object.keys(SOURCES).forEach(k => {
      const s = SOURCES[k];
      L.push("- " + s.n);
      L.push("  " + s.org);
      L.push("  " + s.url);
      L.push("");
    });
    L.push("Days to maturity is a range, not a fact — your seed packet wins.");
    L.push("For anything that might spread, get a real identification:");
    L.push("https://ask.extension.org/");
    L.push("");
    return L.join("\n");
  },
  download(){
    download("pocket-fertilizer-guide.txt", new Blob([Help.text()], { type:"text/plain;charset=utf-8" }));
    toast("Guide saved");
  }
};
</script>
