/**
 * Search Synonyms Routes
 * Day 5-7: Search Improvements
 */

import { Router, Request, Response } from 'express';
import { addSynonym, getSynonyms, importSynonyms } from '../services/synonymsService';
import { requireInternalToken } from '../middleware/internalAuth';

const router = Router();

/**
 * GET /api/search/synonyms
 * List all synonym rules
 */
router.get('/', requireInternalToken, async (_req: Request, res: Response) => {
  const synonyms = await getSynonyms();
  res.json({ success: true, data: synonyms });
});

/**
 * POST /api/search/synonyms
 * Add new synonym rule
 */
router.post('/', requireInternalToken, async (req: Request, res: Response) => {
  const { terms } = req.body;

  if (!terms || !Array.isArray(terms) || terms.length < 2) {
    return res.status(400).json({ error: 'terms array with 2+ items required' });
  }

  const rule = await addSynonym(terms);
  res.json({ success: true, data: rule });
});

/**
 * POST /api/search/synonyms/bulk
 * Bulk import synonyms
 */
router.post('/bulk', requireInternalToken, async (req: Request, res: Response) => {
  const { rules } = req.body;

  if (!rules || !Array.isArray(rules)) {
    return res.status(400).json({ error: 'rules array required' });
  }

  const result = await importSynonyms(rules);
  res.json({ success: true, ...result });
});

export default router;
