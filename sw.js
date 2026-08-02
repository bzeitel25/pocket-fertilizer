/* Pocket Fertilizer — service worker
   App shell is cached so the whole app works with no signal at all.
   Weather / zone / Wikipedia calls always go to the network and simply
   fail soft when offline; the app is built to expect that. */
const VERSION = "pf-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
/* SQLite engine — cached on first successful load so the SQL console
   and .sqlite export keep working offline afterwards. */
const RUNTIME_ALLOW = ["cdnjs.cloudflare.com"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  /* never cache live data lookups */
  if(/open-meteo|phzmapi|wikipedia|api\.anthropic\.com/.test(url.hostname)) return;

  /* app shell: network-first so updates land, cache as the fallback */
  if(url.origin === self.location.origin){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  /* allowlisted CDN: cache-first, it is version-pinned */
  if(RUNTIME_ALLOW.indexOf(url.hostname) >= 0){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  }
});
