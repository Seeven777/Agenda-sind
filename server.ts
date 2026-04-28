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
  const notificationSchedulerEnabled = process.env.ENABLE_NOTIFICATION_SCHEDULER === 'true';
  const notificationCron = process.env.NOTIFICATION_CRON || '*/15 * * * *';

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
    // Define uma janela de 5 minutos para corresponder Ã  frequÃªncia do cron (evita notificaÃ§Ãµes duplicadas e leituras extras)
    const startWindow = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000));
    const endWindow = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000) + 4 * 60 * 1000 + 59 * 1000);

    const notifyField = hoursBefore === 24 ? 'notify24h' : 'notify1h';
    const targetDate = new Date(now.getTime() + (hoursBefore * 60 * 60 * 1000));
    const targetDateStr = targetDate.toISOString().split('T')[0];

    try {
      const eventsRef = db.collection('events');
      const snapshot = await eventsRef
        .where('status', '==', 'agendado')
        .where(notifyField, '==', true)
        .where('date', '==', targetDateStr)
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

  // Endpoint para inscrever o usuario em topicos de notificacao.
  // Fica fora do scheduler para continuar funcionando mesmo com os cron jobs desligados.
  app.post('/api/notifications/subscribe', async (req, res) => {
    const { fcmToken, topic = 'institutional_alerts' } = req.body;
    if (!messaging || !fcmToken) {
      return res.status(400).json({ success: false, error: 'Messaging not available or token missing' });
    }

    try {
      const response = await messaging.subscribeToTopic(fcmToken, topic);
      console.log(`[FCM] User subscribed to ${topic}:`, response);
      res.json({ success: true, response });
    } catch (error) {
      console.error('[FCM] Error subscribing to topic:', error);
      res.status(500).json({ success: false, error: 'Failed to subscribe' });
    }
  });

  if (notificationSchedulerEnabled) {
  // Scheduler for 24-hour notifications
  cron.schedule(notificationCron, async () => { // Frequencia configuravel para controlar a cota
    console.log('[Scheduler] Checking for 24h notifications...');

    try {
      const events = await getEventsNeedingNotification(24); // Isso lÃª os eventos

      if (events.length === 0) {
        console.log('[Scheduler] Nenhum evento de 24h encontrado.');
        return;
      }

      for (const event of events) {
        try {
          // OTIMIZAÃ‡ÃƒO: Notifica o criador via tÃ³pico individual ou token salvo no evento
          // Para economizar leitura na coleÃ§Ã£o 'users', enviamos para o tÃ³pico do criador
          const message = {
            topic: `user_${event.createdBy}`,
            notification: {
              title: `â° Lembrete: ${event.title}`,
              body: `O evento acontece em 24 horas!\nData: ${event.date} Ã s ${event.time}\nLocal: ${event.location}`
            },
            data: {
              eventId: event.id,
              notificationType: 'event_reminder_24h', // Mudando type para evitar conflitos de palavras reservadas
              url: `/events/${event.id}`
            }
          };

          await messaging.send(message);
          await logNotification(event.id, event.createdBy, '24h', true);
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

  // Scheduler for upcoming notifications (notify ALL users)
  cron.schedule(notificationCron, async () => { // Frequencia configuravel para controlar a cota
    console.log('[Scheduler] Checking for events starting soon...');

    if (!db) {
      return;
    }

    try {
      const now = new Date();
      const startWindow = new Date(now.getTime());
      const endWindow = new Date(now.getTime() + 15 * 60 * 1000); // Janela de 15 min sincronizada com o cron

      const todayStr = now.toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const eventsSnapshot = await db.collection('events')
        .where('status', '==', 'agendado')
        .where('date', '==', todayStr) // Foca apenas no dia de hoje para o lembrete de 5min
        // Opcional: Adicionar um campo 'notified5m: false' no futuro para filtrar apenas os nÃ£o enviados
        .limit(100) // Evita ler milhares de docs de uma vez
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
        console.log('[Scheduler] No events found in the current 15min window.');
        return; // No events to notify about
      }

      console.log(`[Scheduler] Found ${events.length} events for 5min notifications`);

      if (messaging) {
        // OTIMIZAÃ‡ÃƒO MÃXIMA: Envia para o tÃ³pico em vez de ler cada usuÃ¡rio no banco
        for (const event of events) {
          try {
            const message = {
              topic: 'institutional_alerts',
              notification: {
                title: `ðŸš¨ Evento em 5 minutos: ${event.title}`,
                body: `O evento comeÃ§a em 5 minutos!\nLocal: ${event.location}`
              },
              data: {
                eventId: event.id,
                notificationType: 'event_reminder_5min',
                url: `/events/${event.id}`
              }
            };

            const response = await messaging.send(message);
            console.log(`[Scheduler] Topic notification sent for event ${event.id}:`, response);
            await logNotification(event.id, 'topic_broadcast', '5min', true);
          } catch (error) {
            console.error(`[Scheduler] Error sending topic notification for event ${event.id}:`, error);
            await logNotification(event.id, 'topic_broadcast', '5min', false);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error processing 5min notifications:', error);
    }
  });
  } else {
    console.log('[Scheduler] Notification scheduler disabled. Set ENABLE_NOTIFICATION_SCHEDULER=true to enable it.');
  }

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
          title: 'ðŸ”” Teste de NotificaÃ§Ã£o',
          body: 'As notificaÃ§Ãµes estÃ£o funcionando corretamente!'
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
