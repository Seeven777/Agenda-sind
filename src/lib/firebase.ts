import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;
let hasWarnedMissingVapidKey = false;

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export const requestNotificationPermission = async () => {
  if (!messaging) return null;
  
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    if (!hasWarnedMissingVapidKey) {
      console.info('VITE_FIREBASE_VAPID_KEY is not set. Push notifications are disabled in this environment.');
      hasWarnedMissingVapidKey = true;
    }
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('An error occurred while requesting permission. ', error);
    return null;
  }
};
