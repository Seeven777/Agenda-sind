import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Serve static files from public/ first (manifest.json, logo.png, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

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
    let indexHtml = await vite.transformIndexHtml('/index.html', fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8'));
    app.use(vite.middlewares);

    // SPA fallback for client-side routes in dev (/calendar, /events/*)
    app.get('*', async (req, res) => {
      try {
        const url = req.originalUrl;
        let template = await vite.transformIndexHtml(url, indexHtml);
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        return res.status(500).end(e.message);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
