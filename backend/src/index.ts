import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
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

app.use(cors());
app.use(express.json());

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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
