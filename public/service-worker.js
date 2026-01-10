
const CACHE_NAME = 'isig-community-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  console.log('SW: Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW: Activé et prêt.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Stratégie standard pour les fichiers
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// --- GESTION DES NOTIFICATIONS PUSH ---
self.addEventListener('push', event => {
  console.log('SW: Événement Push reçu !');
  
  let data = { title: 'Nouveau message', body: 'Vous avez reçu un message.' };
  
  try {
    if (event.data) {
      data = event.data.json();
      console.log('SW: Données reçues:', data);
    }
  } catch (e) {
    console.error('SW: Erreur lors du parsing JSON des données push', e);
    // Fallback si ce n'est pas du JSON
    data = { title: 'Notification', body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Voir le message' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('SW: Notification affichée avec succès.'))
      .catch(err => console.error('SW: Erreur lors de l\'affichage de la notification', err))
  );
});

self.addEventListener('notificationclick', event => {
  console.log('SW: Notification cliquée !');
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Si une fenêtre est déjà ouverte sur l'app, on la focalise et on navigue
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate(urlToOpen));
        }
      }
      // Sinon, on ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
