import { Router } from 'express';
import { seed } from '../seed';

export const adminRouter = Router();
adminRouter.post('/reset', async (req, res, next) => {
  try {
    if (!process.env.ADMIN_TOKEN || req.header('x-admin-token') !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    res.json({ seeded: await seed() });
  } catch (e) {
    next(e);
  }
});

