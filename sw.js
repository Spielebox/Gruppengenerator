// Offline-Unterstützung: Die App-Dateien werden auf dem Gerät zwischengespeichert.
// Mit Internet wird immer die aktuelle Version geladen und der Zwischenspeicher
// automatisch erneuert – eine Versionsnummer muss nicht gepflegt werden.
const CACHE = 'gruppenzufall';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

// Zwischenspeicher älterer App-Versionen aufräumen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst das Netz fragen (am Server nachprüfen, ob es eine neuere Fassung gibt),
// ohne Internet den Zwischenspeicher nutzen
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
