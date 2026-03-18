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

  // Simulated Cloud Function Scheduler
  // Runs every 5 minutes to check for upcoming events
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduler to check for upcoming events...');
    // In a real app, we would use firebase-admin to query Firestore
    // and send FCM messages to users.
    // Since we don't have the service account credentials here,
    // we just log the action.
    console.log('Scheduler check complete.');
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
