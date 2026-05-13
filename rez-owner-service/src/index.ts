/**
 * REZ Owner Service
 *
 * Unified Owner Dashboard API - Aggregates all inventory from:
 * - AdBazaar (physical listings)
 * - DOOH Screens
 * - QR Campaigns (AdsQr)
 * - In-App Ads
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import ownerRoutes from './routes/ownerRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4010;

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ===========================================
// HEALTH CHECK
// ===========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-owner-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ===========================================
// API ROUTES
// ===========================================

// Owner Dashboard API
app.use('/api/owner', ownerRoutes);

// ===========================================
// ERROR HANDLING
// ===========================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    REZ OWNER SERVICE                        ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                ║
║  Environment: ${process.env.NODE_ENV || 'development'}                          ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                 ║
║  - GET  /health                                             ║
║  - GET  /api/owner/:id/inventory                            ║
║  - GET  /api/owner/:id/earnings                             ║
║  - GET  /api/owner/:id/analytics                            ║
║  - GET  /api/owner/:id/adbazaar                             ║
║  - GET  /api/owner/:id/dooh                                 ║
║  - GET  /api/owner/:id/qr-campaigns                         ║
║  - GET  /api/owner/:id/inapp-ads                            ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
