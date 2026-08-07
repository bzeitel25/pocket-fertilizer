<script>
/* ============================================================
   POCKET FERTILIZER — core: utilities, crypto, encrypted SQLite
   ============================================================ */
"use strict";

/* ---------- tiny DOM utils ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = s => String(s === null || s === undefined ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
/* An id is a primary key, and DB.sqlWrite inserts with OR REPLACE — a
   collision does not error, it overwrites whatever row already held that id.
   The old form was a millisecond stamp plus six random base36 characters,
   which is fine when rows arrive one tap at a time and much thinner than it
   looks when several hundred are written inside the same millisecond, as an
   imported garden is. The counter makes two ids from one session incapable
   of colliding at all; the stamp keeps them from colliding across sessions.
   Math.random().toString(36) is also allowed to come back short — "0.5" —
   so the random tail is padded rather than trusted to be six characters. */
let uidN = 0;
const uid = () => Date.now().toString(36) +
  (uidN = (uidN + 1) % 46656).toString(36).padStart(3, "0") +
  Math.random().toString(36).slice(2, 8).padEnd(6, "0");
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : (d || 0); };

/* ---------- dates ---------- */
const DAY = 86400000;
function today(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function iso(d){ if(!d) return ""; const x = (d instanceof Date) ? d : new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0"); }
function parseISO(s){ if(!s) return null; const p = String(s).split("-");
  if(p.length < 3) return null; const d = new Date(+p[0], +p[1]-1, +p[2]); d.setHours(0,0,0,0); return d; }
function addDays(d, n){ const x = new Date(d instanceof Date ? d.getTime() : parseISO(d).getTime()); x.setDate(x.getDate()+n); x.setHours(0,0,0,0); return x; }
function diffDays(a, b){ const A = a instanceof Date ? a : parseISO(a), B = b instanceof Date ? b : parseISO(b);
  return Math.round((B - A) / DAY); }
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fmt(d){ const x = d instanceof Date ? d : parseISO(d); if(!x) return "—";
  return MON[x.getMonth()] + " " + x.getDate(); }
function fmtY(d){ const x = d instanceof Date ? d : parseISO(d); if(!x) return "—";
  return MON[x.getMonth()] + " " + x.getDate() + ", " + x.getFullYear(); }
function relDay(d){ const n = diffDays(today(), d instanceof Date ? d : parseISO(d));
  if(n === 0) return "today"; if(n === 1) return "tomorrow"; if(n === -1) return "yesterday";
  if(n > 0) return "in " + n + " days"; return Math.abs(n) + " days ago"; }

/* ---------- UI helpers ---------- */
let toastT = null;
function toast(msg, ms){
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms || 2200);
}
function haptic(){ if(navigator.vibrate) try{ navigator.vibrate(8); }catch(e){} }
let sheetOnClose = null;
function openSheet(title, html, onClose){
  $("#sheet-title").textContent = title;
  $("#sheet-body").innerHTML = html;
  $("#sheet").classList.add("on"); $("#scrim").classList.add("on");
  sheetOnClose = onClose || null;
  $("#sheet-body").scrollTop = 0;
}
function closeSheet(){
  $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on");
  if(sheetOnClose){ const f = sheetOnClose; sheetOnClose = null; setTimeout(f, 220); }
  setTimeout(() => { if(!$("#sheet").classList.contains("on")) $("#sheet-body").innerHTML = ""; }, 300);
}
function confirmSheet(title, msg, okLabel, onOk, danger){
  openSheet(title,
    '<p class="muted" style="margin-top:0">' + esc(msg) + '</p>' +
    '<div class="row" style="gap:8px">' +
      '<button class="btn ghost grow" onclick="closeSheet()">Cancel</button>' +
      '<button class="btn grow ' + (danger ? "danger" : "") + '" id="cnf-ok">' + esc(okLabel || "Confirm") + '</button>' +
    '</div>');
  $("#cnf-ok").onclick = () => { closeSheet(); setTimeout(onOk, 200); };
}

/* ============================================================
   CRYPTO — WebCrypto AES-256-GCM, PBKDF2-SHA256 key derivation
   ============================================================ */
const Crypto = (() => {
  const subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  const ITER = 310000;
  const enc = new TextEncoder(), dec = new TextDecoder();

  function rand(n){ const a = new Uint8Array(n); (window.crypto || {}).getRandomValues
      ? window.crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.floor(Math.random()*256)); return a; }
  function b64(bytes){ let s = ""; const b = new Uint8Array(bytes);
    for(let i=0;i<b.length;i+=0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i+0x8000));
    return btoa(s); }
  function unb64(str){ const s = atob(str); const a = new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) a[i] = s.charCodeAt(i); return a; }

  async function importRaw(bytes){
    return subtle.importKey("raw", bytes, {name:"AES-GCM"}, true, ["encrypt","decrypt"]);
  }
  async function deriveKEK(pass, salt){
    const base = await subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({name:"PBKDF2", salt: salt, iterations: ITER, hash:"SHA-256"},
      base, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
  }
  async function encryptWith(key, bytes){
    const iv = rand(12);
    const ct = await subtle.encrypt({name:"AES-GCM", iv: iv}, key, bytes);
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), 12);
    return out;
  }
  async function decryptWith(key, bytes){
    const b = new Uint8Array(bytes);
    const pt = await subtle.decrypt({name:"AES-GCM", iv: b.slice(0,12)}, key, b.slice(12));
    return new Uint8Array(pt);
  }
  return {
    available: !!subtle, rand, b64, unb64, importRaw, deriveKEK, encryptWith, decryptWith,
    ITER, enc, dec,
    async newDEK(){ return importRaw(rand(32)); },
    async exportKey(k){ return new Uint8Array(await subtle.exportKey("raw", k)); }
  };
})();

/* ============================================================
   VAULT — key management (device key or passphrase-wrapped key)
   ============================================================ */
const Vault = (() => {
  const META = "pf.vault.v1";
  let DEK = null, meta = null;

  function readMeta(){ try{ return JSON.parse(localStorage.getItem(META) || "null"); }catch(e){ return null; } }
  function writeMeta(m){ meta = m; localStorage.setItem(META, JSON.stringify(m)); }

  async function initDevice(){
    const raw = Crypto.rand(32);
    DEK = await Crypto.importRaw(raw);
    writeMeta({ mode:"device", dek: Crypto.b64(raw), created: Date.now(), iter: Crypto.ITER });
    return DEK;
  }
  async function unlockDevice(m){ DEK = await Crypto.importRaw(Crypto.unb64(m.dek)); return DEK; }

  async function unlockPass(m, pass){
    const kek = await Crypto.deriveKEK(pass, Crypto.unb64(m.salt));
    const raw = await Crypto.decryptWith(kek, Crypto.unb64(m.wrapped)); // throws on wrong pass
    DEK = await Crypto.importRaw(raw);
    return DEK;
  }
  async function setPassphrase(pass){
    if(!DEK) throw new Error("locked");
    const raw = await Crypto.exportKey(DEK);
    const salt = Crypto.rand(16);
    const kek = await Crypto.deriveKEK(pass, salt);
    const wrapped = await Crypto.encryptWith(kek, raw);
    writeMeta({ mode:"pass", salt: Crypto.b64(salt), wrapped: Crypto.b64(wrapped),
                created: (meta && meta.created) || Date.now(), iter: Crypto.ITER });
  }
  async function removePassphrase(){
    if(!DEK) throw new Error("locked");
    const raw = await Crypto.exportKey(DEK);
    writeMeta({ mode:"device", dek: Crypto.b64(raw), created:(meta && meta.created) || Date.now(), iter: Crypto.ITER });
  }
  return {
    get meta(){ return meta || (meta = readMeta()); },
    get mode(){ const m = meta || readMeta(); return m ? m.mode : null; },
    get unlocked(){ return !!DEK; },
    exists(){ return !!readMeta(); },
    initDevice, unlockDevice, unlockPass, setPassphrase, removePassphrase,
    async encrypt(bytes){ return Crypto.encryptWith(DEK, bytes); },
    async decrypt(bytes){ return Crypto.decryptWith(DEK, bytes); },
    load(){ meta = readMeta(); return meta; },
    wipe(){ localStorage.removeItem(META); DEK = null; meta = null; }
  };
})();

/* ============================================================
   BLOB STORE — IndexedDB with localStorage fallback
   ============================================================ */
const Blobs = (() => {
  const DBN = "pocket_fertilizer", STORE = "kv";
  let idb = null, ready = false;
  function open(){
    return new Promise(res => {
      if(!window.indexedDB) return res(null);
      let req;
      try{ req = indexedDB.open(DBN, 1); }catch(e){ return res(null); }
      req.onupgradeneeded = () => { try{ req.result.createObjectStore(STORE); }catch(e){} };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
      setTimeout(() => res(null), 2500);
    });
  }
  async function init(){ if(ready) return; idb = await open(); ready = true; }
  async function get(k){
    await init();
    if(idb) return new Promise(res => {
      try{ const r = idb.transaction(STORE,"readonly").objectStore(STORE).get(k);
        r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
      }catch(e){ res(null); }
    });
    const s = localStorage.getItem("pf.blob." + k);
    return s ? Crypto.unb64(s) : null;
  }
  async function set(k, bytes){
    await init();
    if(idb) return new Promise((res, rej) => {
      try{ const t = idb.transaction(STORE,"readwrite"); t.objectStore(STORE).put(bytes, k);
        t.oncomplete = () => res(true); t.onerror = () => rej(t.error);
      }catch(e){ rej(e); }
    });
    localStorage.setItem("pf.blob." + k, Crypto.b64(bytes)); return true;
  }
  async function del(k){ await init(); if(idb){ try{ idb.transaction(STORE,"readwrite").objectStore(STORE).delete(k); }catch(e){} }
    localStorage.removeItem("pf.blob." + k); }
  return { get, set, del, get backend(){ return idb ? "IndexedDB" : "localStorage"; } };
})();

/* ---------- camera ----------
   This app photographs plants and seed packets. It should never open
   pointing at the gardener's face.

   facingMode:{ideal:"environment"} is only a preference — a browser is free
   to hand back the front camera and report success, which is what some
   Android builds do. So: demand the rear camera outright, and only relax
   the constraint if the device genuinely has no rear camera.            */
const Cam = {
  supported(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },

  /* `native:true` asks for the sensor's own framing.

     The default here requests a 1280x1280 ideal, and a square ideal is a
     request the hardware cannot satisfy — browsers meet it by cropping the
     sensor, which arrives looking like the camera zoomed itself in. Fine for
     a seed packet held close; wrong for a skyline, where the crop silently
     removes the top of the very obstruction being measured. */
  async rear(extra){
    if(!Cam.supported()) throw new Error("no-camera");
    const opts = Object.assign({}, extra || {});
    const native = !!opts.native; delete opts.native;
    const base = native ? opts
      : Object.assign({ width:{ ideal:1280 }, height:{ ideal:1280 } }, opts);
    const tries = [
      Object.assign({ facingMode:{ exact:"environment" } }, base),
      Object.assign({ facingMode:{ ideal:"environment" } }, base)
    ];

    /* if the device lists its cameras, name the rear one explicitly —
       the most reliable route on Android, where labels are consistent */
    try{
      if(navigator.mediaDevices.enumerateDevices){
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === "videoinput");
        const back = cams.find(d => /back|rear|environment/i.test(d.label || ""));
        if(back) tries.unshift(Object.assign({ deviceId:{ exact: back.deviceId } }, base));
      }
    }catch(e){ /* labels need permission first; the facingMode attempts cover it */ }

    let last = null;
    for(const video of tries){
      try{ return await navigator.mediaDevices.getUserMedia({ video: video, audio:false }); }
      catch(e){ last = e; }
    }
    /* genuinely no rear camera — a laptop, say. Better a front camera than none. */
    try{ return await navigator.mediaDevices.getUserMedia({ video:true, audio:false }); }
    catch(e){ throw last || e; }
  },

  stop(stream){ if(stream) try{ stream.getTracks().forEach(t => t.stop()); }catch(e){} }
};
</script>
