// Firebase Messaging Service Worker
const DEBUG_SW = false;
const log = (...args) => {
  if (DEBUG_SW) console.log(...args);
};
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration from the app
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

// Handle background messages (push notifications)
messaging.onBackgroundMessage((payload) => {
  log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Extract notification data
  const notificationTitle = payload.notification?.title || 'Agenda Sind';
  const notificationBody = payload.notification?.body || 'Você tem uma nova atualização.';
  const notificationIcon = payload.notification?.icon || '/logo.png';
  const notificationBadge = '/logo.png';
  
  // Get additional data
  const data = payload.data || {};
  const eventId = data.eventId;
  const notificationType = data.type || 'default';
  
  // Create notification options
  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    data: {
      ...data,
      url: data.url || (eventId ? `/events/${eventId}` : '/')
    },
    vibrate: [200, 100, 200],
    tag: `agenda-${notificationType}-${eventId || Date.now()}`,
    renotify: true,
    requireInteraction: notificationType === 'event_reminder',
    actions: [
      { action: 'open_event', title: 'Ver Evento' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    timestamp: Date.now()
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => log('[firebase-messaging-sw.js] Notification shown successfully'))
    .catch(err => console.error('[firebase-messaging-sw.js] Error showing notification:', err));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  log('[firebase-messaging-sw.js] Notification click event:', event);
  
  // Handle dismiss action
  if (event.action === 'dismiss') {
    event.notification.close();
    return;
  }
  
  // Close the notification
  event.notification.close();
  
  // Get the URL to navigate to
  const targetUrl = event.notification.data?.url || '/';
  
  // Check if there's already a window open
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        // Check if this is our app
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL
          client.navigate(targetUrl)
            .then(() => {
              if (client.visibilityState === 'hidden') {
                client.focus();
              }
            })
            .catch(() => {
              // If navigation fails, just focus the client
              client.focus();
            });
          return;
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
    .catch(err => {
      console.error('[firebase-messaging-sw.js] Error handling notification click:', err);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  log('[firebase-messaging-sw.js] Notification closed:', event);
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  log('[firebase-messaging-sw.js] Push subscription changed:', event);
  
  event.waitUntil(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.registration.active?.pushManager?.applicationServerKey
    })
    .then(subscription => {
      log('[firebase-messaging-sw.js] New subscription:', subscription);
      // Here you would typically send the new subscription to your server
    })
    .catch(err => {
      console.error('[firebase-messaging-sw.js] Error resubscribing:', err);
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  log('[firebase-messaging-sw.js] Message from main app:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
