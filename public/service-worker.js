
const CACHE_NAME = 'isig-community-v1';
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
});

self.addEventListener('fetch', event => {
  // Stratégie Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});

// Notifications Push
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Notification', body: 'Nouveau message sur ISIG Community' };
  const options = {
    body: data.body,
    icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    badge: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEKe9pUpwKblGupj71Ds69l0lUj5jL-otikA&s',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
