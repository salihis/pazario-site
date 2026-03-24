import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './services/Database.js';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import priceRoutes from './src/api/routes/price.routes.js';
import categoryRoutes from './src/api/routes/category.routes.js';
import orderRoutes from './src/api/routes/order.routes.js';
import attributeRoutes from './src/api/routes/attributes.routes.js';
import publishRoutes from './src/api/routes/publish.routes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  // API Routes
  app.use('/api/v1', priceRoutes);
  app.use('/api/v1', categoryRoutes);
  app.use('/api/v1', orderRoutes);
  app.use('/api/v1', attributeRoutes);
  app.use('/api/v1', publishRoutes);

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  // Products API (Section 4)
  app.get('/api/v1/products', async (req, res) => {
    try {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json({
        success: true,
        data: products,
        meta: { page: 1, total: products.length }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Database error' });
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
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pazar.io Server running on http://localhost:${PORT}`);
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
    res.status(status).json({ success: false, error: message });
  });
}

startServer();
