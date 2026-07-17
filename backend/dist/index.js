"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("./db/prisma");
dotenv_1.default.config();
const auth_1 = require("./routes/auth");
const users_1 = require("./routes/users");
const departments_1 = require("./routes/departments");
const companies_1 = require("./routes/companies");
const manpower_1 = require("./routes/manpower");
const customers_1 = require("./routes/customers");
const items_1 = require("./routes/items");
const reports_1 = require("./routes/reports");
const jobOrders_1 = require("./routes/jobOrders");
const machines_1 = require("./routes/machines");
const production_1 = require("./routes/production");
const dashboard_1 = require("./routes/dashboard");
const audit_1 = require("./routes/audit");
const maintenanceTypes_1 = require("./routes/maintenanceTypes");
const payments_1 = require("./routes/payments");
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    maxAge: 86400,
}));
app.use(express_1.default.json());
// Cache-control: sensitive/user-specific endpoints must not be cached
app.use('/api/auth', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/dashboard', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/audit', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/payments', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Cache-control: reference data changes infrequently — 60s private cache
app.use('/api/departments', (req, res, next) => {
    if (req.method === 'GET')
        res.set('Cache-Control', 'private, max-age=60');
    next();
});
app.use('/api/machines', (req, res, next) => {
    if (req.method === 'GET')
        res.set('Cache-Control', 'private, max-age=60');
    next();
});
app.use('/api/maintenance-types', (req, res, next) => {
    if (req.method === 'GET')
        res.set('Cache-Control', 'private, max-age=60');
    next();
});
app.use('/api/auth', auth_1.authRouter);
app.use('/api/users', users_1.usersRouter);
app.use('/api/departments', departments_1.departmentsRouter);
app.use('/api/companies', companies_1.companiesRouter);
app.use('/api/manpower', manpower_1.manpowerRouter);
app.use('/api/customers', customers_1.customersRouter);
app.use('/api/items', items_1.itemsRouter);
app.use('/api/reports', reports_1.reportsRouter);
app.use('/api/job-orders', jobOrders_1.jobOrdersRouter);
app.use('/api/machines', machines_1.machinesRouter);
app.use('/api/production', production_1.productionRouter);
app.use('/api/dashboard', dashboard_1.dashboardRouter);
app.use('/api/audit', audit_1.auditRouter);
app.use('/api/maintenance-types', maintenanceTypes_1.maintenanceTypesRouter);
app.use('/api/payments', payments_1.paymentsRouter);
app.get('/api/health', async (req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});
app.get('/health', async (req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});
app.get('/api/liveness', (_req, res) => res.json({ status: 'ok' }));
// Invoked by an external scheduler (daily). Never called by the browser app.
app.post('/api/internal/purge-tokens', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret)
        return res.status(500).json({ error: 'CRON_SECRET not configured.' });
    const header = req.headers.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    // Timing-safe compare; lengths must match before timingSafeEqual.
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }
    try {
        const result = await prisma_1.prisma.token.deleteMany({
            where: { expires_at: { lt: new Date() } },
        });
        return res.json({ purged: result.count });
    }
    catch (err) {
        console.error('Token purge failed:', err.message);
        return res.status(500).json({ error: 'Purge failed.' });
    }
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
