const CACHE_NAME = "blockfall-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("blockfall-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// The page asks a waiting worker to take over once the player is between games.
self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Pages: network first so updates land quickly, falling back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html").then(response => {
          if (!response) throw new Error("Offline app shell is unavailable.");
          return response;
        }))
    );
    return;
  }

  // Static assets: serve from cache instantly, refresh in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request, { ignoreSearch: true }).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached || Response.error());
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return network;
      })
    )
  );
});
