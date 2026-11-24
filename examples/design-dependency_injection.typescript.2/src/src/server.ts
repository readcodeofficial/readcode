import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildContainer } from './container';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const container = buildContainer(pool);

const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.header('x-tenant-id');
  if (!tenantId) {
    res.status(400).json({ error: 'missing x-tenant-id' });
    return;
  }
  container.scope.tenantId = tenantId;
  container.scope.requestId = req.header('x-request-id') ?? randomUUID();
  next();
});

app.post('/v1/conversions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clickId, value } = req.body ?? {};
    if (typeof clickId !== 'string' || typeof value !== 'number' || value < 0) {
      res.status(422).json({ error: 'clickId and non-negative value are required' });
      return;
    }
    const outcome = await container.attribution.recordConversion(clickId, value);
    const status = outcome === 'attributed' ? 201 : outcome === 'expired' ? 200 : 404;
    res.status(status).json({ outcome, requestId: container.scope.requestId });
  } catch (err) {
    next(err);
  }
});

app.get('/v1/campaigns/:id/conversions/24h', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await container.attribution.conversionsLast24h(req.params.id);
    res.json({ campaignId: req.params.id, count });
  } catch (err) {
    next(err);
  }
});

app.listen(Number(process.env.PORT ?? 8080));
