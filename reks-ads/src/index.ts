/**
 * REZ-Ads - Ad Serving Platform
 * Express API for ad campaigns, placements, and serving
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

interface Ad {
  id: string;
  merchantId: string;
  title: string;
  imageUrl: string;
  ctaUrl: string;
  placement: 'home_banner' | 'explore_feed' | 'store_listing' | 'search_result';
  bid: number;
  budget: number;
  status: 'active' | 'paused';
}

const ads: Ad[] = [
  {
    id: '1',
    merchantId: 'm1',
    title: 'Summer Sale',
    imageUrl: 'https://example.com/summer.jpg',
    ctaUrl: 'https://rez.money/summer',
    placement: 'home_banner',
    bid: 5,
    budget: 50000,
    status: 'active'
  }
];

// Health
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-ads' });
});

// List ads
app.get('/api/ads', (req: Request, res: Response) => {
  const { placement, status } = req.query;
  let filtered = ads;
  if (placement) filtered = filtered.filter(a => a.placement === placement);
  if (status) filtered = filtered.filter(a => a.status === status);
  res.json({ data: filtered });
});

// Get single ad
app.get('/api/ads/:id', (req: Request, res: Response) => {
  const ad = ads.find(a => a.id === req.params.id);
  if (!ad) return res.status(404).json({ error: 'Not found' });
  res.json({ data: ad });
});

// Create ad
app.post('/api/ads', (req: Request, res: Response) => {
  const ad: Ad = { id: Date.now().toString(), ...req.body };
  ads.push(ad);
  res.status(201).json({ data: ad });
});

// Update ad
app.put('/api/ads/:id', (req: Request, res: Response) => {
  const idx = ads.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  ads[idx] = { ...ads[idx], ...req.body };
  res.json({ data: ads[idx] });
});

// Delete ad
app.delete('/api/ads/:id', (req: Request, res: Response) => {
  const idx = ads.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  ads.splice(idx, 1);
  res.json({ success: true });
});

const PORT = process.env.PORT || 4007;
app.listen(PORT, () => console.log(`REZ-Ads running on ${PORT}`));
