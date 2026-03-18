import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cron from 'node-cron';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

// Cloud Functions simuladas para Firebase deploy
  // 1. onEventCreated - quando novo evento, notifica todos
  cron.schedule('*/1 * * * *', async () => {
    console.log('🔥 Simulando onEventCreated - Novo evento detectado!');
    // In real Firebase Functions:
    // const admin = require('firebase-admin');
    // const eventSnap = context.params;
    // Query users fcmTokens → admin.messaging().sendMulticast()
    console.log('📱 FCM enviado para todos dispositivos!');
  });

  // 2. Scheduler eventos próximos
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running scheduler - check eventos próximos 24h/1h');
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
  });
}

startServer();
