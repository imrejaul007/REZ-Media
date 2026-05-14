import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { dealService } from '../services/dealService.js';

const router = Router();

const CreateDealSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['pmp', 'preferred', 'guaranteed']),
  advertiserId: z.string(),
  publisherId: z.string(),
  ssp: z.string(),
  floorPrice: z.number().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  targeting: z.object({
    geo: z.array(z.string()).optional(),
    screenTypes: z.array(z.string()).optional(),
    screenIds: z.array(z.string()).optional(),
  }).optional(),
  budget: z.number().positive().optional(),
  pacing: z.object({
    daily: z.number().positive().optional(),
    weekly: z.number().positive().optional(),
  }).optional(),
});

// Deals
router.get('/deals', async (req: Request, res: Response) => {
  const { status, advertiserId, publisherId, ssp } = req.query;
  const deals = await dealService.listDeals({
    status: status as any,
    advertiserId: advertiserId as string,
    publisherId: publisherId as string,
    ssp: ssp as string,
  });
  res.json({ success: true, data: deals });
});

router.post('/deals', async (req: Request, res: Response) => {
  try {
    const data = CreateDealSchema.parse(req.body);
    const deal = await dealService.createDeal({
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });
    res.json({ success: true, data: deal });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

router.get('/deals/:dealId', async (req: Request, res: Response) => {
  const deal = await dealService.getDeal(req.params.dealId);
  if (!deal) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: deal });
});

router.patch('/deals/:dealId', async (req: Request, res: Response) => {
  const deal = await dealService.updateDeal(req.params.dealId, req.body);
  res.json({ success: true, data: deal });
});

router.post('/deals/:dealId/activate', async (req: Request, res: Response) => {
  const deal = await dealService.activateDeal(req.params.dealId);
  res.json({ success: true, data: deal });
});

router.post('/deals/:dealId/pause', async (req: Request, res: Response) => {
  const deal = await dealService.pauseDeal(req.params.dealId);
  res.json({ success: true, data: deal });
});

router.post('/deals/:dealId/end', async (req: Request, res: Response) => {
  const deal = await dealService.endDeal(req.params.dealId);
  res.json({ success: true, data: deal });
});

// Check eligibility
router.post('/deals/:dealId/check', async (req: Request, res: Response) => {
  const result = await dealService.checkDealEligibility(req.params.dealId, req.body);
  res.json({ success: true, data: result });
});

export default router;
