/**
 * REZ Payment Gateway - Main Entry Point
 * Handles wallet top-ups, ad payments, and payouts via Razorpay
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { walletRoutes } from './routes/wallet';
import { adsRoutes } from './routes/ads';
import { payoutsRoutes } from './routes/payouts';
import { webhooksRoutes } from './routes/webhooks';

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Webhook routes (before json parser for signature verification)
app.use('/api/webhooks', webhooksRoutes);

// JSON parsing for other routes
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-payment-gateway' });
});

// Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/payouts', payoutsRoutes);

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, () => {
  console.log(`REZ Payment Gateway running on port ${PORT}`);
});

export default app;
