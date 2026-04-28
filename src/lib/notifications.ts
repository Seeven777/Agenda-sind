import { messaging, requestNotificationPermission, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { safeUpdateDoc, safeSetDoc } from './firestoreHelpers';
import { onMessage } from 'firebase/messaging';

const FCM_CACHE_PREFIX = 'agendaSind:fcmToken:';
const FCM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CachedTokenState = {
  token: string;
  savedAt: number;
  topicsAt?: number;
};

function getCachedTokenState(userId: string): CachedTokenState | null {
  try {
    const raw = localStorage.getItem(`${FCM_CACHE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) as CachedTokenState : null;
  } catch {
    return null;
  }
}

function setCachedTokenState(userId: string, token: string, topicsAt?: number) {
  try {
    localStorage.setItem(`${FCM_CACHE_PREFIX}${userId}`, JSON.stringify({
      token,
      savedAt: Date.now(),
      topicsAt,
    }));
  } catch {
    // localStorage can fail in private mode; the app still works without this cache.
  }
}

// Request and save FCM token for a user. The local cache avoids repeated Firestore
// reads/writes when the app remounts or the user reopens the notification modal.
export async function saveFCMToken(userId: string, options: { force?: boolean } = {}): Promise<string | null> {
  try {
    if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
      return null;
    }

    const token = await requestNotificationPermission();

    if (token) {
      const cached = getCachedTokenState(userId);
      const cacheStillFresh = cached?.token === token && Date.now() - cached.savedAt < FCM_CACHE_TTL_MS;

      if (!options.force && cacheStillFresh) {
        if (!cached.topicsAt || Date.now() - cached.topicsAt > FCM_CACHE_TTL_MS) {
          subscribeToTopics(token, userId);
          setCachedTokenState(userId, token, Date.now());
        }
        return token;
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.fcmToken === token) {
          subscribeToTopics(token, userId);
          setCachedTokenState(userId, token, Date.now());
          return token;
        }

        await safeUpdateDoc(userRef, {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        });
      } else {
        await safeSetDoc(userRef, {
          uid: userId,
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        }, { merge: true });
      }

      subscribeToTopics(token, userId);
      setCachedTokenState(userId, token, Date.now());
      return token;
    }

    return null;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return null;
  }
}

async function subscribeToTopics(token: string, userId: string) {
  const topics = ['institutional_alerts', `user_${userId}`];

  for (const topic of topics) {
    fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcmToken: token, topic })
    }).catch(err => console.error(`Failed to subscribe to topic ${topic}:`, err));
  }
}

// Get FCM token for a user
export async function getUserFCMToken(userId: string): Promise<string | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data().fcmToken || null;
    }

    return null;
  } catch (error) {
    console.error('Error getting user FCM token:', error);
    return null;
  }
}

// Listen for foreground messages
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | undefined {
  if (messaging) {
    return onMessage(messaging, (payload) => {
      callback(payload);
    });
  }
  return undefined;
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Get notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

// Request notification permission (browser native)
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return await Notification.requestPermission();
}

// Format event time for notification
export function formatEventTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

// Calculate time until event
export function getTimeUntilEvent(eventDate: string, eventTime: string): number {
  const eventDateTime = new Date(`${eventDate}T${eventTime}:00`);
  const now = new Date();
  return eventDateTime.getTime() - now.getTime();
}

// Format relative time
export function formatRelativeTime(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} dia${days > 1 ? 's' : ''}`;
  }

  if (hours >= 1) {
    return `${hours} hora${hours > 1 ? 's' : ''}`;
  }

  return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
}

// Create notification payload for an event
export function createEventNotificationPayload(
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    creatorName: string;
  },
  type: '24h' | '1h'
): { title: string; body: string; data: Record<string, string> } {
  const timeLabel = type === '24h' ? '24 horas' : '1 hora';
  const formattedTime = formatEventTime(event.time);
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? new Date(`${event.date}T12:00:00`) : null;
  const formattedDate = eventDate && !Number.isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    : 'data nao informada';

  return {
    title: `Lembrete: ${event.title}`,
    body: `Em ${timeLabel} - ${formattedDate} as ${formattedTime}\nLocal: ${event.location}\nCriado por: ${event.creatorName}`,
    data: {
      eventId: event.id,
      type: 'event_reminder',
      url: `/events/${event.id}`
    }
  };
}
