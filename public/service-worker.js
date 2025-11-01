// public/service-worker.js

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('New notification', data);
  const options = {
    body: data.body,
    icon: '/logo192.png', // Path to a notification icon
    badge: '/badge.png', // Path to a small badge icon
    data: {
      url: data.url // URL to open on click
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        client.navigate(urlToOpen);
        client.focus();
      } else {
        clients.openWindow(urlToOpen);
      }
    })
  );
});
