// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBzaWS-fSmpiEp8rxrf1qzVgBcs6IokqJY",
  authDomain: "gen-lang-client-0540580910.firebaseapp.com",
  projectId: "gen-lang-client-0540580910",
  storageBucket: "gen-lang-client-0540580910.firebasestorage.app",
  messagingSenderId: "919994512557",
  appId: "1:919994512557:web:9c12ebec124d2ca337c224",
  measurementId: "G-FN6JRLZ63P"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Agenda Sind';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma atualização.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Ver evento' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
