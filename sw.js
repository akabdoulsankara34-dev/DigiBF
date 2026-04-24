// sw.js — Service Worker · Digitale Solution POS
// Stratégie : Cache-First pour l'app shell, Network-First pour les données
// Compatible avec le protocole de messages défini dans index.html

const SW_VERSION   = 'ds-sw-v2';
const CACHE_STATIC = SW_VERSION + '-static';

// Fichiers à mettre en cache au premier chargement (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — Mise en cache de l'app shell
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installation…', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())  // Activer immédiatement sans attendre
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — Nettoyage des anciens caches
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation…', SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim()) // Prendre le contrôle de tous les onglets ouverts
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — Stratégie de cache
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions Firebase/CDN
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin)) return;

  // App shell → Cache-First (fonctionne hors ligne)
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(request, clone));
            return res;
          });
        })
        .catch(() => caches.match('/index.html')) // Fallback SPA
    );
    return;
  }

  // Tout le reste → Network-First avec fallback cache
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC — Synchronisation hors ligne
// Tag : 'ds-sync-queue' (enregistré depuis triggerSync() dans l'app)
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync déclenché:', event.tag);
  if (event.tag === 'ds-sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES — Protocole de communication avec l'app (index.html)
// Messages reçus : GET_QUEUE_SIZE | FORCE_SYNC
// Messages envoyés : SYNC_COMPLETE | GET_QUEUE | REMOVE_SYNCED | QUEUE_SIZE | PROCESS_SYNC_QUEUE
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  console.log('[SW] Message reçu:', type);

  switch (type) {

    // L'app demande la taille de la queue au démarrage
    case 'GET_QUEUE_SIZE':
      getQueueFromApp(event).then(queue => {
        sendToAll({ type: 'QUEUE_SIZE', size: queue.length });
      });
      break;

    // Sync manuelle déclenchée depuis l'app (bouton ou retour en ligne)
    case 'FORCE_SYNC':
      processSyncQueue();
      break;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Demande la file d'attente à l'app via MessageChannel
 * L'app répond avec { queue: [...] } (voir case 'GET_QUEUE' dans onSwMessage)
 */
async function getQueueFromApp(originalEvent) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!clients.length) return [];

  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = (e) => resolve(e.data.queue || []);
    clients[0].postMessage({ type: 'GET_QUEUE' }, [port2]);
    // Timeout de sécurité
    setTimeout(() => resolve([]), 3000);
  });
}

/**
 * Traite la queue de synchronisation :
 * 1. Récupère la queue depuis l'app
 * 2. Rejoue chaque requête en fetch
 * 3. Notifie l'app des items synchronisés
 */
async function processSyncQueue() {
  console.log('[SW] Traitement de la queue de sync…');

  let queue = [];
  try {
    // Utiliser un event fictif pour getQueueFromApp
    queue = await new Promise(async (resolve) => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (!clients.length) { resolve([]); return; }

      const { port1, port2 } = new MessageChannel();
      port1.onmessage = (e) => resolve(e.data.queue || []);
      clients[0].postMessage({ type: 'GET_QUEUE' }, [port2]);
      setTimeout(() => resolve([]), 4000);
    });
  } catch(e) {
    console.warn('[SW] Impossible de récupérer la queue:', e.message);
  }

  if (!queue.length) {
    console.log('[SW] Queue vide — rien à synchroniser.');
    sendToAll({ type: 'SYNC_COMPLETE', synced: 0, pending: 0 });
    return;
  }

  console.log(`[SW] ${queue.length} action(s) à synchroniser…`);

  const syncedIds = [];
  let errors = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method:  item.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item.body),
      });
      if (res.ok) {
        syncedIds.push(item.id);
        console.log('[SW] ✅ Synced:', item.type || item.url);
      } else {
        errors++;
        console.warn('[SW] ⚠️ Erreur HTTP', res.status, 'pour', item.url);
      }
    } catch(e) {
      errors++;
      console.warn('[SW] ❌ Fetch échoué:', e.message);
    }
  }

  // Demander à l'app de retirer les items synchronisés
  if (syncedIds.length > 0) {
    sendToAll({ type: 'REMOVE_SYNCED', ids: syncedIds });
  }

  // Notifier l'app du résultat
  sendToAll({
    type:    'SYNC_COMPLETE',
    synced:  syncedIds.length,
    pending: errors,
  });

  console.log(`[SW] Sync terminée — ${syncedIds.length} ok, ${errors} en erreur.`);
}

/**
 * Envoie un message à tous les onglets ouverts de l'app
 */
async function sendToAll(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage(message));
}
