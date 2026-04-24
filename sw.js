// sw.js
const CACHE_NAME = 'digitale-solution-v1';
const OFFLINE_URL = '/index.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Installation — mise en cache des ressources essentielles
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — stratégie Network First avec fallback cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match(OFFLINE_URL)))
  );
});

// Messages depuis l'app (GET_QUEUE_SIZE, FORCE_SYNC, SAVE_QUEUE)
self.addEventListener('message', event => {
  const { type } = event.data || {};
  if (type === 'GET_QUEUE_SIZE') {
    event.source?.postMessage({ type: 'QUEUE_SIZE', size: 0 });
  }
  if (type === 'FORCE_SYNC' || type === 'SAVE_QUEUE') {
    // Implémente ta logique de sync ici
  }
});
