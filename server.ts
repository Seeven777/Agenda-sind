import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cron from 'node-cron';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase Admin
let db: ReturnType<typeof getFirestore> | null = null;
let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  // Check if we have the required environment variables for Firebase Admin
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
    // Usa o mesmo banco nomeado configurado no app cliente.
    db = getFirestore(firebaseConfig.firestoreDatabaseId);
    messaging = getMessaging();
    console.log(`Firebase Admin initialized successfully (${firebaseConfig.firestoreDatabaseId})`);
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT not found. Server-side notifications will be simulated.');
  }
} catch (error) {
  console.warn('Firebase Admin initialization failed:', error);
  console.warn('Server-side notifications will be simulated.');
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      firebaseAdmin: !!messaging,
      timestamp: new Date().toISOString()
    });
  });

  // Get upcoming events that need notification
  async function getEventsNeedingNotification(hoursBefore: number) {
    if (!db) return [];

    const now = new Date();
    // Define uma janela de 10 minutos para garantir que o cron pegue o evento
    const startWindow = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000) - 5 * 60 * 1000);
    const endWindow = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000) + 5 * 60 * 1000);

    const notifyField = hoursBefore === 24 ? 'notify24h' : 'notify1h';

    try {
      const eventsRef = db.collection('events');
      const snapshot = await eventsRef
        .where('status', '==', 'agendado')
        .where(notifyField, '==', true)
        .get();

      const events: any[] = [];

      snapshot.docs.forEach(doc => {
        const eventData = doc.data();
        const [year, month, day] = (eventData.date || '').split('-').map(Number);
        const [hour, minute] = (eventData.time || '').split(':').map(Number);

        if (!year || !month || !day || typeof hour !== 'number' || typeof minute !== 'number') {
          return;
        }

        const eventDateTime = new Date(year, month - 1, day, hour, minute, 0);
        const eventTimeMs = eventDateTime.getTime();

        // Check if event is within the notification window
        if (eventTimeMs >= startWindow.getTime() && eventTimeMs <= endWindow.getTime()) {
          events.push({ id: doc.id, ...eventData });
        }
      });

      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async function getUserFCMToken(userId: string): Promise<string | null> {
    if (!db) return null;

    try {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return null;
      return userSnap.data()?.fcmToken || null;
    } catch (error) {
      console.error('Error fetching user FCM token:', error);
      return null;
    }
  }

  // Send push notification to a user
  async function sendPushNotification(fcmToken: string | null, userId: string, notification: any, data: any): Promise<boolean> {
    if (!messaging) {
      console.log('Firebase Admin not available. Would send notification to:', fcmToken || userId);
      return false;
    }

    const token = fcmToken || await getUserFCMToken(userId);
    if (!token) {
      console.warn('No FCM token available for user:', userId);
      return false;
    }

    try {
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: data,
        webpush: {
          fcmOptions: {
            link: data.url || '/'
          },
          headers: {
            Urgency: 'high'
          }
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'event_reminders',
            priority: 'high' as const
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await messaging.send(message);
      console.log('Push notification sent:', response);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error; // Throw error instead of returning false
    }
  }

  // Save notification log to Firestore
  async function logNotification(eventId: string, userId: string, type: '24h' | '1h' | '5min', success: boolean) {
    // Removido o registro no Firestore para economizar cota (Quota Limit Exceeded).
    // Usamos logs de console para monitoramento sem custos de escrita.
    if (success) {
      console.log(`[Notification SUCCESS] Event: ${eventId}, User: ${userId}, Type: ${type}`);
    } else {
      console.error(`[Notification FAILED] Event: ${eventId}, User: ${userId}, Type: ${type}`);
    }
  }

  // Scheduler for 24-hour notifications
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Checking for 24h notifications...');

    try {
      const events = await getEventsNeedingNotification(24);

      for (const event of events) {
        try {
          const success = await sendPushNotification(
            event.fcmToken || null,
            event.createdBy,
            {
              title: `⏰ Lembrete: ${event.title}`,
              body: `O evento acontece em 24 horas!\nData: ${event.date} às ${event.time}\nLocal: ${event.location}`
            },
            {
              eventId: event.id,
              type: 'event_reminder_24h',
              url: `/events/${event.id}`
            }
          );

          await logNotification(event.id, event.createdBy, '24h', success);
        } catch (error) {
          console.error(`[Scheduler] Error sending 24h notification for event ${event.id}:`, error);
          await logNotification(event.id, event.createdBy, '24h', false);
        }
      }

      if (events.length > 0) {
        console.log(`[Scheduler] Processed ${events.length} events for 24h notifications`);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing 24h notifications:', error);
    }
  });

  // Scheduler for 5-minute notifications (notify ALL users)
  cron.schedule('*/1 * * * *', async () => {
    console.log('[Scheduler] Checking for 5min notifications...');

    if (!db) {
      console.log('[Scheduler] Firebase Admin not available. Skipping 5min notifications.');
      return;
    }

    try {
      const now = new Date();
      const startWindow = new Date(now.getTime() + 4 * 60 * 1000); // 4 minutes from now
      const endWindow = new Date(now.getTime() + 6 * 60 * 1000);   // 6 minutes from now

      // Adicionado filtro de status para reduzir leituras desnecessárias
      const eventsSnapshot = await db.collection('events')
        .where('status', '==', 'agendado')
        .get();

      const events = [];
      eventsSnapshot.docs.forEach(doc => {
        const eventData = doc.data();

        if (eventData.isPersonal === true) {
          return; // Skip private events
        }

        const [year, month, day] = (eventData.date || '').split('-').map(Number);
        const [hour, minute] = (eventData.time || '').split(':').map(Number);

        if (!year || !month || !day || typeof hour !== 'number' || typeof minute !== 'number') {
          return;
        }

        const eventDateTime = new Date(year, month - 1, day, hour, minute, 0);
        const eventTimeMs = eventDateTime.getTime();

        // Check if event is within the 5-minute window
        if (eventTimeMs >= startWindow.getTime() && eventTimeMs <= endWindow.getTime()) {
          events.push({ id: doc.id, ...eventData });
        }
      });

      if (events.length === 0) {
        return; // No events to notify about
      }

      console.log(`[Scheduler] Found ${events.length} events for 5min notifications`);

      // Get ALL users with FCM tokens
      const usersSnapshot = await db.collection('users')
        .where('fcmToken', '!=', null)
        .get();

      const usersWithTokens = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      console.log(`[Scheduler] Notifying ${usersWithTokens.length} users about ${events.length} events`);

      // Send notifications to ALL users for EACH event
      for (const event of events) {
        let successCount = 0;
        let failCount = 0;

        for (const user of usersWithTokens) {
          try {
            const success = await sendPushNotification(
              user.fcmToken,
              user.id,
              {
                title: `🚨 Evento em 5 minutos: ${event.title}`,
                body: `O evento começa em 5 minutos!\nData: ${event.date} às ${event.time}\nLocal: ${event.location}\nCriado por: ${event.creatorName}`
              },
              {
                eventId: event.id,
                type: 'event_reminder_5min',
                url: `/events/${event.id}`
              }
            );

            if (success) {
              successCount++;
            } else {
              failCount++;
            }

            // Log notification for each user
            await logNotification(event.id, user.id, '5min', success);

          } catch (error) {
            console.error(`[Scheduler] Error notifying user ${user.id} about event ${event.id}:`, error);
            failCount++;
            await logNotification(event.id, user.id, '5min', false);
          }
        }

        console.log(`[Scheduler] Event ${event.id}: ${successCount} successful, ${failCount} failed notifications`);
      }

    } catch (error) {
      console.error('[Scheduler] Error processing 5min notifications:', error);
    }
  });

  // API endpoint to manually trigger notification check
  app.post('/api/notifications/check', async (req, res) => {
    try {
      const events24h = await getEventsNeedingNotification(24);
      const events1h = await getEventsNeedingNotification(1);

      res.json({
        success: true,
        eventsNeedingNotification: {
          '24h': events24h,
          '1h': events1h
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to check notifications' });
    }
  });

  // API endpoint to send a test notification
  app.post('/api/notifications/test', async (req, res) => {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'FCM token required' });
    }

    try {
      const success = await sendPushNotification(
        fcmToken,
        'test',
        {
          title: '🔔 Teste de Notificação',
          body: 'As notificações estão funcionando corretamente!'
        },
        {
          type: 'test',
          url: '/'
        }
      );

      res.json({ success });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to send test notification' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Firebase Admin: ${messaging ? 'Enabled' : 'Disabled (simulation mode)'}`);
  });
}

startServer();
