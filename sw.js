/* Service worker: permite abrir la app sin internet.
   Estrategia: responde desde la caché al instante y actualiza en segundo plano.
   Las llamadas a /api/ (envío automático) nunca se guardan en caché. */
const CACHE = "consulta-telemedicina-v8";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./cie10-data.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const esNavegacion = req.mode === "navigate";
  const clave = esNavegacion ? "./index.html" : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(clave, { ignoreSearch: esNavegacion });
      const deRed = fetch(req)
        .then((resp) => {
          // Solo se guardan respuestas propias y completas (no redirecciones de inicio de sesión)
          if (resp.ok && resp.type === "basic" && !resp.redirected) cache.put(clave, resp.clone());
          return resp;
        })
        .catch(() => null);
      if (enCache) {
        event.waitUntil(deRed);
        return enCache;
      }
      const resp = await deRed;
      return resp || new Response("Sin conexión", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    })
  );
});
