/**
 * Search Indexer Routes
 */

import { Router } from 'express';
import { handleProductEvent, searchProducts } from '../services/search-indexer.service';

const router = Router();

/** Index product */
router.post('/index/product', async (req, res) => {
  await handleProductEvent(req.body);
  res.json({ success: true });
});

/** Search products */
router.get('/search', async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });

  const results = await searchProducts(q as string, parseInt(limit as string) || 20);
  res.json({ results });
});

/** Batch index */
router.post('/index/batch', async (req, res) => {
  const { products } = req.body;
  for (const p of (products || [])) {
    await handleProductEvent(p);
  }
  res.json({ success: true, indexed: products?.length || 0 });
});

export default router;
