import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { prisma } from './db/prisma';

dotenv.config();

import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { departmentsRouter } from './routes/departments';
import { companiesRouter } from './routes/companies';
import { manpowerRouter } from './routes/manpower';
import { customersRouter } from './routes/customers';
import { itemsRouter } from './routes/items';
import { reportsRouter } from './routes/reports';
import { jobOrdersRouter } from './routes/jobOrders';
import { machinesRouter } from './routes/machines';
import { productionRouter } from './routes/production';
import { dashboardRouter } from './routes/dashboard';
import { auditRouter } from './routes/audit';
import { maintenanceTypesRouter } from './routes/maintenanceTypes';
import { paymentsRouter } from './routes/payments';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  maxAge: 86400,
}));
app.use(express.json());

// Cache-control: sensitive/user-specific endpoints must not be cached
app.use('/api/auth', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/dashboard', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/audit', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/payments', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Cache-control: reference data changes infrequently — 60s private cache
app.use('/api/departments', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=60');
  next();
});
app.use('/api/machines', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=60');
  next();
});
app.use('/api/maintenance-types', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=60');
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/manpower', manpowerRouter);
app.use('/api/customers', customersRouter);
app.use('/api/items', itemsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/job-orders', jobOrdersRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/production', productionRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);
app.use('/api/maintenance-types', maintenanceTypesRouter);
app.use('/api/payments', paymentsRouter);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/api/liveness', (_req, res) => res.json({ status: 'ok' }));

// Invoked by an external scheduler (daily). Never called by the browser app.
app.post('/api/internal/purge-tokens', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET not configured.' });

  const header = req.headers.authorization ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  // Timing-safe compare; lengths must match before timingSafeEqual.
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const result = await prisma.token.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
    return res.json({ purged: result.count });
  } catch (err: any) {
    console.error('Token purge failed:', err.message);
    return res.status(500).json({ error: 'Purge failed.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
