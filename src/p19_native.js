<script>
/* ============================================================
   NATIVE SHELL  —  Android and iOS store builds
   ============================================================

   The same index.html runs in three places: a browser tab, a home-screen
   PWA, and the store builds wrapped by Capacitor. This part is the only
   place that knows the difference.

   Nothing here changes behaviour on the web. Every patch below is guarded
   by Native.active, and every native call falls back to what the app did
   before if the plugin is missing — so a half-installed native project
   degrades to the web behaviour rather than breaking a screen.

   What it wires up:
     - exports (CSV, .sqlite, JSON backup, snapshot images) go through the
       real system share sheet and land in the device's Documents folder,
       instead of a browser download that has nowhere to go on iOS
     - the source links on crop and diagnosis pages open in the system
       browser rather than replacing the app inside its own web view
     - the hardware Back button on Android walks the app's own history
     - pending writes are flushed when the app leaves the foreground, so a
       swipe-away from the app switcher cannot lose the last edit
     - haptics on the actions that place or remove a plant
     - status bar, splash screen, and safe-area insets
     - the in-app updater is replaced by the store's own update channel
     - voice input, which would otherwise be lost: the Web Speech API is a
       Chrome and Safari feature, not a web view one, so window.SpeechRecognition
       is simply absent inside both native shells.

       On Android the mic is rebuilt on the platform recogniser. On iOS it is
       removed instead, and that is deliberate: the community speech plugin
       ships a CocoaPods podspec and no Package.swift, so Capacitor's
       SPM-based iOS project excludes it — `cap sync ios` says so outright.
       A mic button that cannot listen is worse than no mic button, and a
       control that does nothing is something App Review looks for. If the
       plugin ever gains SPM support, deleting the removal below is the only
       change needed; the rest of the voice path is already platform-neutral.
   ============================================================ */

const Native = (() => {
  const cap = window.Capacitor;
  const active = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  const P = (active && cap.Plugins) || {};
  const platform = active ? cap.getPlatform() : "web";

  const has = name => !!P[name];

  /* Blob -> bare base64, which is what the Filesystem plugin wants */
  function toBase64(blob){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(",") + 1)); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  const N = {
    active, platform,
    isIOS:     platform === "ios",
    isAndroid: platform === "android",

    /* ---- boot ---- */
    async init(){
      if(!active) return;
      document.documentElement.classList.add("native", "native-" + platform);

      if(has("StatusBar")){
        try{
          await P.StatusBar.setStyle({ style: "LIGHT" });
          if(N.isAndroid) await P.StatusBar.setBackgroundColor({ color: "#1f6f4a" });
        }catch(e){}
      }

      if(has("Keyboard")){
        try{ await P.Keyboard.setScroll({ isDisabled: true }); }catch(e){}
      }

      /* Android hardware Back: walk the app's own navigation first, and only
         let the OS close the app when there is nothing left to go back to. */
      if(has("App") && N.isAndroid){
        try{
          P.App.addListener("backButton", () => {
            const sheet = document.getElementById("sheet");
            if(sheet && sheet.classList.contains("on") && typeof closeSheet === "function"){
              closeSheet(); return;
            }
            if(typeof APP === "object" && APP.tab && APP.tab !== "home"){
              if(typeof go === "function"){ go("home"); return; }
            }
            P.App.exitApp();
          });
        }catch(e){}
      }

      /* A phone can kill a backgrounded app at any moment. Writes are
         normally debounced, so flush them the instant the app goes away —
         otherwise the last edit before a swipe-away is the one that is lost.
         The ten-minute passphrase auto-lock in p13_init.js runs off
         visibilitychange, which the web view fires here too, so it needs
         nothing from this part. */
      if(has("App")){
        try{
          P.App.addListener("appStateChange", st => {
            if(st.isActive) return;
            try{ if(typeof DB === "object" && DB.flush) DB.flush(); }catch(e){}
          });
        }catch(e){}
      }

      window.addEventListener("load", () => {
        if(has("SplashScreen")) setTimeout(() => { try{ P.SplashScreen.hide(); }catch(e){} }, 250);
      });
      if(document.readyState === "complete" && has("SplashScreen")){
        setTimeout(() => { try{ P.SplashScreen.hide(); }catch(e){} }, 250);
      }
    },

    /* ---- files ----
       Writes into the app's Documents directory and then offers the share
       sheet, so a CSV can go straight to email, Files, Drive or a desktop.
       Returns false when it could not handle it, and the caller falls back
       to the browser download path. */
    async save(name, blob){
      if(!active || !has("Filesystem")) return false;
      try{
        const data = await toBase64(blob);
        const dir = N.isIOS ? "DOCUMENTS" : "DOCUMENTS";
        const w = await P.Filesystem.writeFile({ path: name, data, directory: dir, recursive: true });
        if(has("Share")){
          try{
            await P.Share.share({ title: name, url: w.uri, dialogTitle: "Save or send " + name });
          }catch(e){ /* the gardener dismissed the sheet; the file is still saved */ }
        }
        return true;
      }catch(e){ return false; }
    },

    /* ---- links ----
       Source URLs open in the system browser with its own address bar, so
       the reader can see they are on a real extension-service domain. */
    async openExternal(url){
      if(!active) return false;
      if(has("Browser")){
        try{ await P.Browser.open({ url, presentationStyle: "popover" }); return true; }catch(e){}
      }
      return false;
    },

    /* ---- voice ----
       Mirrors just enough of the Web Speech API surface that Assist.mic can
       drive it: start, stop, and a partial-then-final stream of transcripts. */
    voice: {
      available(){ return active && has("SpeechRecognition"); },

      async start(onPartial, onFinal, onError, onEnd){
        const SRP = P.SpeechRecognition;
        try{
          const perm = await SRP.requestPermissions();
          const state = perm && (perm.speechRecognition || perm.microphone);
          if(state && state !== "granted") { onError("not-allowed"); onEnd(); return false; }
        }catch(e){ /* older builds resolve permissions implicitly in start() */ }

        let last = "";
        const partial = await SRP.addListener("partialResults", d => {
          const m = d && d.matches && d.matches[0];
          if(m){ last = m; onPartial(m); }
        });
        const ended = await SRP.addListener("listeningState", d => {
          if(d && d.status === "stopped"){
            partial.remove(); ended.remove();
            if(last) onFinal(last); else onEnd();
          }
        });

        try{
          const r = await SRP.start({
            language: "en-US", maxResults: 2, partialResults: true, popup: false
          });
          /* Android resolves start() with the final matches; iOS streams them */
          const m = r && r.matches && r.matches[0];
          if(m){ last = m; }
        }catch(e){
          partial.remove(); ended.remove();
          onError(e && e.message === "Missing permission" ? "not-allowed" : "error");
          onEnd(); return false;
        }
        return true;
      },

      stop(){ try{ P.SpeechRecognition.stop(); }catch(e){} }
    },

    /* ---- haptics ---- */
    tap(style){
      if(!active || !has("Haptics")) return;
      try{
        if(style === "success") P.Haptics.notification({ type: "SUCCESS" });
        else if(style === "warn") P.Haptics.notification({ type: "WARNING" });
        else P.Haptics.impact({ style: style === "heavy" ? "HEAVY" : "LIGHT" });
      }catch(e){}
    }
  };

  return N;
})();

/* ============================================================
   PATCHES — every one is a no-op on the web
   ============================================================ */
if(Native.active){

  /* --- exports go through the system share sheet --- */
  if(typeof download === "function"){
    const webDownload = download;
    window.download = function(name, blob){
      Native.save(name, blob).then(ok => {
        if(ok){ if(typeof toast === "function") toast("Saved to Files 📄"); }
        else webDownload(name, blob);
      });
    };
  }

  /* --- source links leave the web view --- */
  document.addEventListener("click", e => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="http"]') : null;
    if(!a) return;
    const url = a.getAttribute("href");
    if(!url || url.indexOf("http") !== 0) return;
    e.preventDefault();
    Native.openExternal(url).then(ok => { if(!ok) window.open(url, "_blank", "noopener"); });
  }, true);

  /* --- the store owns updates now ---
     Leaving the self-updater in place would be a rejection on both stores:
     Apple forbids an app that downloads and runs new code around review,
     and Play treats it the same way. In the store builds the button says
     where updates come from and does nothing else. */
  if(typeof Updater === "object"){
    const storeName = Native.isIOS ? "the App Store" : "Google Play";
    Updater.label = () => "↻ Updates come from " + storeName;
    Updater.go = () => {
      const el = typeof $ === "function" ? $("#upd-status") : null;
      const msg = "This copy of Pocket Fertilizer was installed from " + storeName +
                  ", so updates arrive through it — there is nothing to check here. " +
                  "You are on build " + BUILD + ". Your garden data is never touched by an update.";
      if(el) el.innerHTML = '<div class="note i">' + msg + '</div>';
      else if(typeof toast === "function") toast("Updates come from " + storeName);
    };
    Updater.update = Updater.go;
  }

  /* --- the mic, rebuilt on the platform recogniser --- */
  if(typeof Assist === "object" && typeof Assist.mic === "function" && Native.voice.available()){
    Assist.mic = function(){
      if(Assist.listening){ Native.voice.stop(); return; }
      Assist.listening = true; Assist.draw();
      if(typeof haptic === "function") haptic();

      const inp = () => (typeof $ === "function" ? $("#as-input") : null);
      const done = () => { Assist.listening = false; Assist.draw(); };

      Native.voice.start(
        text => { const i = inp(); if(i) i.value = text; },
        text => { done(); const i = inp(); if(i) i.value = ""; Assist.send(text); },
        err  => { if(typeof toast === "function") toast(err === "not-allowed" ? "Microphone permission denied" : "Didn't catch that"); },
        done
      ).then(ok => { if(!ok) done(); });
    };
  }

  /* --- and where there is no recogniser at all, no mic button --- */
  if(typeof Assist === "object" && typeof Assist.draw === "function" && !Native.voice.available()){
    const drawn = Assist.draw;
    Assist.draw = function(scroll){
      drawn.call(this, scroll);
      const box = document.getElementById("s-assist");
      const bar = box && box.querySelector(".asbar");
      if(!bar) return;
      const mic = bar.querySelector('.iconbtn[title="Speak"]');
      if(mic) mic.remove();
      const inp = bar.querySelector("#as-input");
      if(inp && !Assist.listening) inp.placeholder = "Ask or tell me to do something…";
    };
  }

  /* --- haptics on placing and lifting a plant --- */
  if(typeof Garden === "object"){
    ["place", "removePlanting"].forEach(fn => {
      if(typeof Garden[fn] !== "function") return;
      const orig = Garden[fn];
      Garden[fn] = function(){
        const out = orig.apply(this, arguments);
        Native.tap(fn === "removePlanting" ? "warn" : "light");
        return out;
      };
    });
  }

  Native.init();
}
</script>
