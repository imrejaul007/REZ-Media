import { Router } from 'express';

const router = Router();

// Example route
router.get('/example', (_req, res) => {
  res.json({ message: 'Example endpoint' });
});

export default router;
