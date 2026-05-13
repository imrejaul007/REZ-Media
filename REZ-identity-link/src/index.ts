/**
 * REZ Identity Link - Main Entry Point
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { identityRoutes } from './routes/identity';

const app = express();

// Security
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-identity-link' });
});

// Routes
app.use('/api/identity', identityRoutes);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_identity';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

const PORT = process.env.PORT || 4017;
app.listen(PORT, () => {
  console.log(`REZ Identity Link running on port ${PORT}`);
});
});
