import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import routes from './routes/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4062', 10);

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(',') }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use((req: Request, _res: Response, next) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'deal-manager' }));

app.use('/api', (req: Request, res: Response, next) => {
  if (req.headers['x-internal-token'] !== process.env.INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

app.use('/api', routes);

mongoose.connect(process.env.MONGODB_URI || '').then(() => {
  console.log(`Deal Manager on port ${PORT}`);
  app.listen(PORT);
});

process.on('SIGTERM', () => { mongoose.connection.close(); process.exit(0); });
process.on('SIGINT', () => { mongoose.connection.close(); process.exit(0); });
