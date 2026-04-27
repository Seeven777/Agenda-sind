import { messaging, requestNotificationPermission, db } from './firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { onMessage } from 'firebase/messaging';

// Request and save FCM token for a user
export async function saveFCMToken(userId: string): Promise<string | null> {
  try {
    if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
      return null;
    }

    const token = await requestNotificationPermission();

    if (token) {
      // Para economizar quota de escrita (Firestore Free Tier),
      // verificamos se o token já é o mesmo que está no banco de dados.
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.fcmToken === token) {
          return token; // Token já atualizado, evita gravação desnecessária
        }

        await updateDoc(userRef, {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        });
      } else {
        // Criar perfil se não existir (raro)
        await setDoc(userRef, {
          uid: userId,
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString()
        }, { merge: true });
      }
      return token;
    }

    return null;
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return null;
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
    : 'data não informada';

  return {
    title: `⏰ Lembrete: ${event.title}`,
    body: `Em ${timeLabel} - ${formattedDate} às ${formattedTime}\nLocal: ${event.location}\nCriado por: ${event.creatorName}`,
    data: {
      eventId: event.id,
      type: 'event_reminder',
      url: `/events/${event.id}`
    }
  };
}
