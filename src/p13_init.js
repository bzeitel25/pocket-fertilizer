<script>
/* ============================================================
   THEME, MENU, LOCK SCREEN, BOOT
   ============================================================ */
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute("content", t === "dark" ? "#0e1512" : "#1f6f4a");
}
function toggleTheme(){
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next); localStorage.setItem("pf.theme", next);
  try{ DB.set("theme", next); }catch(e){}
}

function moreMenu(){
  const items = [
    ["journal","📖","Garden Journal","Water, feed, spend, harvest"],
    ["recap","📊","Season Recap","Yield, cost per pound, takeaways"],
    ["library","📚","Plant Library", CROPS.length + " crops with full care guides"],
    ["help","📖","How to use it","Starter guide and manual"],
    ["weather","🌤️","Weather","Forecast, risks & snapshots"],
    ["sources","📚","Sources & accuracy","References, and install/update"],
    ["settings","⚙️","Settings","Location, security, backup"],
    ["sql","🗄️","SQL Console","Query your garden database"]
  ];
  openSheet("Menu", '<div class="list">' + items.map(i =>
    '<button class="item" onclick="closeSheet();go(\'' + i[0] + '\')"><div class="av">' + i[1] + '</div>' +
    '<div class="grow"><div class="b">' + i[2] + '</div><div class="tiny muted">' + esc(i[3]) + '</div></div>' +
    '<span class="go">›</span></button>').join("") + '</div>' +
    '<div class="tiny muted center" style="margin-top:16px">🌱 Pocket Fertilizer<br>Encrypted on-device · works offline</div>');
}

function lockScreen(msg){
  const el = document.createElement("div");
  el.className = "lock-screen"; el.id = "lockscreen";
  el.innerHTML = '<div class="lock-card center">' +
    '<div style="font-size:2.6rem">🌱</div>' +
    '<h2 style="margin:6px 0 2px">Pocket Fertilizer</h2>' +
    '<p class="tiny muted" style="margin:0 0 16px">Your garden data is encrypted on this device.</p>' +
    '<input type="password" id="lk-pw" placeholder="Passphrase" autocomplete="current-password" style="text-align:center">' +
    '<div id="lk-err" class="tiny" style="color:var(--danger);min-height:18px;margin-top:8px">' + esc(msg || "") + '</div>' +
    '<button class="btn block" id="lk-go">Unlock</button>' +
    '<button class="btn ghost block sm" style="margin-top:10px" id="lk-reset">Forgot it — start over</button>' +
    '</div>';
  document.body.appendChild(el);
  const go2 = async () => {
    const pw = $("#lk-pw").value;
    if(!pw) return;
    $("#lk-err").textContent = "Checking…";
    try{
      await Vault.unlockPass(Vault.meta, pw);
      el.remove();
      await boot2();
    }catch(e){ $("#lk-err").textContent = "That passphrase doesn't open it."; $("#lk-pw").value = ""; }
  };
  $("#lk-go").onclick = go2;
  $("#lk-pw").addEventListener("keydown", e => { if(e.key === "Enter") go2(); });
  $("#lk-reset").onclick = () => {
    if(!confirm("This permanently deletes the encrypted data on this device. There is no way to recover it without the passphrase. Continue?")) return;
    Vault.wipe(); Blobs.del("vault").then(() => location.reload());
  };
  setTimeout(() => $("#lk-pw").focus(), 150);
}

/* ---------- boot ---------- */
let BOOTED = false;

async function boot(){
  applyTheme(localStorage.getItem("pf.theme") || "light");

  if(!Crypto.available){
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;text-align:center">' +
      '<h2>Secure storage unavailable</h2><p>This browser is not exposing WebCrypto, which Pocket Fertilizer needs to encrypt your data. ' +
      'Open the app over <b>https://</b> or <b>http://localhost</b> rather than as a local file, or use a current version of Chrome, Safari, Firefox or Edge.</p></div>';
    return;
  }

  Vault.load();
  if(!Vault.exists()){
    await Vault.initDevice();
    await boot2(true);
  } else if(Vault.mode === "device"){
    try{ await Vault.unlockDevice(Vault.meta); await boot2(); }
    catch(e){ lockScreen("Stored key is unreadable."); }
  } else {
    lockScreen();
  }
}

async function boot2(firstRun){
  if(BOOTED) return; BOOTED = true;
  try{ await DB.load(); }
  catch(e){
    console.error(e);
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;text-align:center">' +
      '<h2>Could not decrypt your data</h2><p>The stored vault did not open with this key. If you set a passphrase, reload and enter it. ' +
      'If you cleared site data, the old vault cannot be recovered.</p><button onclick="location.reload()">Reload</button></div>';
    return;
  }

  const savedTheme = DB.get("theme");
  if(savedTheme) applyTheme(savedTheme);

  /* wire chrome */
  $$("nav.tabs button").forEach(b => b.onclick = () => { haptic(); go(b.dataset.tab); });
  $("#btn-theme").onclick = toggleTheme;
  $("#btn-more").onclick = moreMenu;
  $("#scrim").onclick = closeSheet;
  $("#sheet-close").onclick = closeSheet;
  document.addEventListener("keydown", e => { if(e.key === "Escape") closeSheet(); });

  /* persist on the way out */
  window.addEventListener("pagehide", () => { DB.flush(); });
  document.addEventListener("visibilitychange", () => {
    if(document.hidden){ DB.flush(); APP.hiddenAt = Date.now(); }
    else if(Vault.mode === "pass" && APP.hiddenAt && Date.now() - APP.hiddenAt > 10 * 60 * 1000){ location.reload(); }
  });

  Updater.init();
  Coach.paint();
  go("home");

  /* SQLite engine loads in the background — the app never waits on it */
  DB.initSqlite().then(ok => {
    if(ok){ DB.hydrateSqlite(); }
    if(APP.tab === "sql") SqlView.render();
  });

  Cal.rebuild();
  Onboard.repairLabel();
  Notify.schedule();
  setTimeout(() => Notify.catchUp(), 2500);
  getWeather().then(() => { if(APP.tab === "home") Home.weather(); });

  if(firstRun || !DB.get("onboarded")) setTimeout(() => Onboard.open(), 700);
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
</script>
</body>
</html>
