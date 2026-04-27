import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registration.active?.scriptURL.includes('/firebase-messaging-sw.js'))
        .map((registration) => registration.unregister())
    );
    return;
  }

  if (import.meta.env.VITE_FIREBASE_VAPID_KEY) {
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (error) {
      console.error('Failed to register Firebase service worker:', error);
    }
  }
}

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
