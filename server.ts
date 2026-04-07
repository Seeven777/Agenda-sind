import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cron from 'node-cron';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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
    db = getFirestore();
    messaging = getMessaging();
    console.log('Firebase Admin initialized successfully');
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
    const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    
    // Calculate time window (±5 minutes to catch events)
    const startWindow = new Date(targetTime.getTime() - 5 * 60 * 1000);
    const endWindow = new Date(targetTime.getTime() + 5 * 60 * 1000);
    
    const startStr = startWindow.toISOString().slice(0, 16);
    const endStr = endWindow.toISOString().slice(0, 16);
    
    try {
      const eventsRef = db.collection('events');
      const snapshot = await eventsRef
        .where('status', '==', 'agendado')
        .where('notify24h', '==', true)
        .get();
      
      const events: any[] = [];
      
      snapshot.docs.forEach(doc => {
        const eventData = doc.data();
        const eventDateTime = `${eventData.date}T${eventData.time}`;
        
        // Check if event is within the notification window
        if (eventDateTime >= startStr && eventDateTime <= endStr) {
          events.push({ id: doc.id, ...eventData });
        }
      });
      
      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  // Send push notification to a user
  async function sendPushNotification(fcmToken: string, notification: any, data: any): Promise<boolean> {
    if (!messaging) {
      console.log('Firebase Admin not available. Would send notification to:', fcmToken);
      return false;
    }
    
    try {
      const message = {
        token: fcmToken,
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
      return false;
    }
  }

  // Save notification log to Firestore
  async function logNotification(eventId: string, userId: string, type: '24h' | '1h', success: boolean) {
    if (!db) return;
    
    try {
      await db.collection('notification_logs').add({
        eventId,
        userId,
        type,
        success,
        timestamp: FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  // Scheduler for 24-hour notifications
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Checking for 24h notifications...');
    
    try {
      const events = await getEventsNeedingNotification(24);
      
      for (const event of events) {
        if (event.fcmToken) {
          const success = await sendPushNotification(
            event.fcmToken,
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
        }
      }
      
      if (events.length > 0) {
        console.log(`[Scheduler] Processed ${events.length} events for 24h notifications`);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing 24h notifications:', error);
    }
  });

  // Scheduler for 1-hour notifications
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Checking for 1h notifications...');
    
    try {
      const events = await getEventsNeedingNotification(1);
      
      for (const event of events) {
        if (event.fcmToken) {
          const success = await sendPushNotification(
            event.fcmToken,
            {
              title: `🚨 Atenção: ${event.title}`,
              body: `O evento acontece em 1 hora!\nData: ${event.date} às ${event.time}\nLocal: ${event.location}\nCriado por: ${event.creatorName}`
            },
            {
              eventId: event.id,
              type: 'event_reminder_1h',
              url: `/events/${event.id}`
            }
          );
          
          await logNotification(event.id, event.createdBy, '1h', success);
        }
      }
      
      if (events.length > 0) {
        console.log(`[Scheduler] Processed ${events.length} events for 1h notifications`);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing 1h notifications:', error);
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Firebase Admin: ${messaging ? 'Enabled' : 'Disabled (simulation mode)'}`);
  });
}

startServer();
