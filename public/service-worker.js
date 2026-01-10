
const CACHE_NAME = 'isig-community-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
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

// --- GESTION DES NOTIFICATIONS PUSH OPTIMISÉE POUR ANDROID ---
self.addEventListener('push', event => {
  let data = { title: 'ISIG Community', body: 'Nouveau message reçu.' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = { title: 'Notification', body: event.data.text() };
  }

  const options = {
    body: data.body,
    // Utilisation d'icônes simplifiées pour Android
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    vibrate: [200, 100, 200],
    tag: 'msg-group-' + (data.url || 'default'), // Permet de grouper les notifs
    renotify: true, // Fait vibrer même si une notif du même tag est déjà là
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ouvrir' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate(urlToOpen));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
