// public/sw.js
// Minimal service worker: ilova qobig'ini (shell) keshlaydi, shunda "Bosh ekranga qo'shish"
// orqali o'rnatilgan ilova tezroq ochiladi. Video/socket trafigi hech qachon keshlanmaydi.

const CACHE_NAME = "birgatomosha-shell-v1";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/common.js",
  "/js/config.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Socket.io, API va yuklangan videolarni HECH QACHON keshlamaymiz
  if (
    url.pathname.startsWith("/socket.io") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/uploads")
  ) {
    return; // brauzerning odatiy tarmoq so'roviga qo'yib beramiz
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
