/**
 * REZ SDK Host - Entry Point
 * Central SDK hosting and npm registry for 3rd party apps
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

const app = express();
const PORT = parseInt(process.env.PORT || '4066', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
});
app.use('/api/', limiter);

// Available SDKs registry
const SDK_REGISTRY = {
  '@rez/analytics': {
    version: '1.0.0',
    description: 'Event tracking and analytics SDK',
    endpoint: '/sdk/analytics',
  },
  '@rez/ads': {
    version: '1.0.0',
    description: 'Ad serving and monetization SDK',
    endpoint: '/sdk/ads',
  },
  '@rez/auth': {
    version: '1.0.0',
    description: 'Authentication and user management',
    endpoint: '/sdk/auth',
  },
  '@rez/payments': {
    version: '1.0.0',
    description: 'Payment processing SDK',
    endpoint: '/sdk/payments',
  },
  '@rez/loyalty': {
    version: '1.0.0',
    description: 'Points and rewards SDK',
    endpoint: '/sdk/loyalty',
  },
  '@rez/notifications': {
    version: '1.0.0',
    description: 'Push notifications SDK',
    endpoint: '/sdk/notifications',
  },
  '@rez/oem': {
    version: '1.0.0',
    description: 'OEM/Telco partnership SDK',
    endpoint: '/sdk/oem',
  },
  '@rez/partner': {
    version: '1.0.0',
    description: 'Partner affiliate SDK',
    endpoint: '/sdk/partner',
  },
};

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-sdk-host' });
});

// Get available SDKs
app.get('/api/sdks', (_req, res) => {
  res.json({ success: true, data: SDK_REGISTRY });
});

// Get specific SDK info
app.get('/api/sdks/:name', (req, res) => {
  const sdk = SDK_REGISTRY[req.params.name as keyof typeof SDK_REGISTRY];
  if (!sdk) {
    res.status(404).json({ success: false, error: 'SDK not found' });
    return;
  }
  res.json({ success: true, data: sdk });
});

// SDK documentation
app.get('/api/sdks/:name/docs', (req, res) => {
  const sdkName = req.params.name;
  res.json({
    success: true,
    data: {
      name: sdkName,
      installation: `npm install ${sdkName}`,
      usage: `import { initialize } from '${sdkName}';\n\nconst sdk = initialize({\n  apiKey: process.env.API_KEY\n});`,
    },
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] SDK Host running on port ${PORT}`);
});

export default app;
