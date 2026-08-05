// Minimal service worker — its only real job is to exist with a fetch
// handler, which is what Chrome/Android require before it will offer
// "Add to Home Screen". No offline caching strategy here (the API needs
// a live connection anyway); this just passes requests straight through.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
