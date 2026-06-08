# SaarLekha - Schema & Performance Bottleneck Specifications

This document outlines the complete database schema (backend Prisma), frontend state types, and an architectural performance analysis of why the platform experiences latency during login and data loading.

---

## 1. Backend Database Schema (Prisma)

The Prisma schema defines the relations, datatypes, and configuration settings used by the PostgreSQL database.

```prisma
// file:///c:/claude/Saarlekha/backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
}

enum Role {
  SUPER_ADMIN
  COMPANY_ADMIN
  OPERATIONS
}

enum ItemStatus {
  PENDING
  ACTIVE
  REJECTED
  INACTIVE
}

enum AuditAction {
  CREATE
  EDIT
  DELETE
  APPROVE
  REJECT
}

model Company {
  id           String   @id @default(uuid())
  name         String
  address      String?
  logo_url     String?
  gst          String?
  contact_name String?
  email        String?
  phone        String?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  users              User[]
  departments        Department[]
  manpower           Manpower[]
  customers          Customer[]
  items              Item[]
  report_formats     ReportFormat[]
  report_entries     ReportEntry[]
  job_orders         JobOrder[]
  machines           Machine[]
  production_records ProductionRecord[]
  audit_logs         AuditLogEntry[]
  maintenance_type_options MaintenanceTypeOption[]
}

model User {
  id                String   @id @default(uuid())
  email             String   @unique
  password_hash     String?
  role              Role
  company_id        String?
  google_id         String?  @unique
  is_email_verified Boolean  @default(false)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  company           Company? @relation(fields: [company_id], references: [id])
  departments       UserDepartment[]
  submitted_items   Item[] @relation("SubmittedItems")
  approved_items    Item[] @relation("ApprovedItems")
  report_entries    ReportEntry[]
  audit_logs        AuditLogEntry[]
  tokens            Token[]
}

model Department {
  id         String   @id @default(uuid())
  name       String
  company_id String
  created_at DateTime @default(now())

  company          Company          @relation(fields: [company_id], references: [id])
  users            UserDepartment[]
  manpower         Manpower[]
  report_entries   ReportEntry[]
  job_orders       JobOrder[]
  machines         Machine[]
  production_records ProductionRecord[]
}

model UserDepartment {
  user_id       String
  department_id String
  
  user          User       @relation(fields: [user_id], references: [id])
  department    Department @relation(fields: [department_id], references: [id])

  @@id([user_id, department_id])
}

model Manpower {
  id                String   @id @default(uuid())
  company_id        String
  name              String
  photo_url         String?
  phone             String?
  aadhaar_masked    String?
  aadhaar_encrypted String?
  blood_group       String?
  emergency_contact String?
  role              String?
  department_id     String
  created_at        DateTime @default(now())

  company           Company            @relation(fields: [company_id], references: [id])
  department        Department         @relation(fields: [department_id], references: [id])
  production_records ProductionRecord[]
}

model Customer {
  id              String   @id @default(uuid())
  company_id      String
  name            String
  contact_person  String?
  phone           String?
  email           String?
  billing_address String?
  gst             String?
  created_at      DateTime @default(now())

  company         Company    @relation(fields: [company_id], references: [id])
  job_orders      JobOrder[]
}

model Item {
  id            String     @id @default(uuid())
  company_id    String
  name          String?
  status        ItemStatus @default(PENDING)
  custom_data   Json?      // Holds custom column values
  reject_reason String?
  submitted_by  String
  approved_by   String?
  created_at    DateTime   @default(now())
  updated_at    DateTime   @updatedAt

  company       Company @relation(fields: [company_id], references: [id])
  submitter     User    @relation("SubmittedItems", fields: [submitted_by], references: [id])
  approver      User?   @relation("ApprovedItems", fields: [approved_by], references: [id])
  job_orders    JobOrder[]
}

model ReportFormat {
  id         String   @id @default(uuid())
  company_id String
  name       String
  type       String   // QUALITY, MAINTENANCE, GENERAL
  created_at DateTime @default(now())

  company    Company @relation(fields: [company_id], references: [id])
  versions   ReportFormatVersion[]
}

model ReportFormatVersion {
  id            String   @id @default(uuid())
  format_id     String
  version_num   Int
  fields_schema Json     // Array of field definitions
  created_at    DateTime @default(now())

  format        ReportFormat  @relation(fields: [format_id], references: [id])
  entries       ReportEntry[]
}

model ReportEntry {
  id                String   @id @default(uuid())
  company_id        String
  format_version_id String
  department_id     String
  submitted_by      String
  entry_date        DateTime
  payload           Json     // Data matching the schema
  created_at        DateTime @default(now())

  company           Company             @relation(fields: [company_id], references: [id])
  format_version    ReportFormatVersion @relation(fields: [format_version_id], references: [id])
  department        Department          @relation(fields: [department_id], references: [id])
  submitter         User                @relation(fields: [submitted_by], references: [id])
}

model JobOrder {
  id          String   @id @default(uuid())
  company_id  String
  order_number String
  customer_id String
  status      String
  start_date  DateTime?
  end_date    DateTime?
  custom_data Json?
  created_at  DateTime @default(now())
  department_id String?
  item_id     String?
  custom_item String?
  order_qty   Float?
  order_qty_unit String?
  production_qty Float?
  production_qty_unit String?

  company     Company     @relation(fields: [company_id], references: [id])
  customer    Customer    @relation(fields: [customer_id], references: [id])
  department  Department? @relation(fields: [department_id], references: [id])
  item        Item?       @relation(fields: [item_id], references: [id])
}

model Machine {
  id          String   @id @default(uuid())
  company_id  String
  name        String
  type        String?
  location    String?
  department_id String?
  created_at  DateTime @default(now())

  company     Company            @relation(fields: [company_id], references: [id])
  department  Department?        @relation(fields: [department_id], references: [id])
  production_records ProductionRecord[]
}

model ProductionRecord {
  id                String   @id @default(uuid())
  company_id        String
  date              DateTime
  production_amount Float
  target_amount     Float
  operator_id       String
  machine_id        String
  department_id     String
  report_entry_id   String?  @unique
  created_at        DateTime @default(now())

  company           Company    @relation(fields: [company_id], references: [id])
  operator          Manpower   @relation(fields: [operator_id], references: [id])
  machine           Machine    @relation(fields: [machine_id], references: [id])
  department        Department @relation(fields: [department_id], references: [id])
}

model AuditLogEntry {
  id          String      @id @default(uuid())
  company_id  String?     // Nullable for Super Admin actions
  user_id     String
  action      AuditAction
  entity_type String
  entity_id   String
  details     Json?       // What changed
  timestamp   DateTime    @default(now())

  company     Company? @relation(fields: [company_id], references: [id])
  user        User     @relation(fields: [user_id], references: [id])
}

model MaintenanceTypeOption {
  id         String   @id @default(uuid())
  company_id String
  name       String
  created_at DateTime @default(now())

  company    Company  @relation(fields: [company_id], references: [id])
}

enum TokenType {
  EMAIL_VERIFICATION
  PASSWORD_RESET
  INVITE
}

model Token {
  id         String    @id @default(uuid())
  token      String    @unique
  type       TokenType
  user_id    String?
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime  @default(now())

  user       User?     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

---

## 2. Frontend State Schemas (TypeScript)

These core frontend models interface with backend endpoints and manage local states.

```typescript
export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'OPERATIONS';

export interface Company {
  id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  gst?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  companyId?: string;
  googleId?: string;
  isEmailVerified: boolean;
}

export interface Department {
  id: string;
  name: string;
  companyId: string;
}

export interface Manpower {
  id: string;
  name: string;
  phone?: string;
  aadhaarMasked?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  role?: string;
  departmentId: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  billingAddress?: string;
  gst?: string;
}

export interface Item {
  id: string;
  companyId: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'INACTIVE';
  customData?: Record<string, any>;
  rejectReason?: string;
  submittedBy: string;
  approvedBy?: string;
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'yes_no' | 'photo' | 'calculated' | 'operator' | 'machine';
  unit?: string;
  options?: string[];
  formula?: string;
  isSystem?: boolean;
}

export interface ReportFormatVersion {
  id: string;
  formatId: string;
  versionNum: number;
  fieldsSchema: FieldDefinition[];
  createdAt: string;
}

export interface ReportFormat {
  id: string;
  companyId: string;
  name: string;
  type: string;
  versions?: ReportFormatVersion[];
}

export interface ReportEntry {
  id: string;
  companyId: string;
  formatVersionId: string;
  departmentId: string;
  submittedBy: string;
  entryDate: string;
  payload: Record<string, any>;
  createdAt: string;
  formatVersion?: ReportFormatVersion;
}

export interface JobOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  customData?: Record<string, any>;
  departmentId?: string;
  itemId?: string;
  customItem?: string;
  orderQty?: number;
  orderQtyUnit?: string;
  productionQty?: number;
  productionQtyUnit?: string;
}

export interface Machine {
  id: string;
  name: string;
  type?: string;
  location?: string;
  departmentId?: string;
}

export interface ProductionRecord {
  id: string;
  date: string;
  productionAmount: number;
  targetAmount: number;
  operatorId: string;
  machineId: string;
  departmentId: string;
  reportEntryId?: string;
}
```

---

## 3. Performance Bottleneck Audit

Analyzing the database structures and router code reveals **four major bottlenecks** causing latency in logins and data-loading:

### Bottleneck A: Index Deficiencies (Full Table Scans)
- **Problem**: There are **zero custom database indexes** defined in `schema.prisma`. 
- **Impact**: 
  - Every single operational query has a `where: { company_id: ... }` filter (enforced automatically by Postgres Row-Level Security). 
  - Date range filters on `entry_date` (`ReportEntry`) and `date` (`ProductionRecord`) scan tables sequentially.
  - Foreign keys like `department_id`, `submitted_by`, and `format_version_id` on `ReportEntry` lack index trees.
  - As table sizes grow, every dashboard refresh forces the database to perform multiple slow, sequential table scans instead of fast index lookups.

### Bottleneck B: Transactional RLS Context Overhead (Waterfalls)
- **Problem**: RLS tenant state is injected into Postgres using local session configuration parameters (`SET LOCAL app.current_tenant_id`). Because transaction contexts in Prisma poolers do not persist across connections, the backend wrapper (`getTenantPrisma` in `prisma.ts`) wraps **every single database operation** in a separate `$transaction` block:
  ```typescript
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
    return (tx as any)[model][operation](args);
  });
  ```
- **Impact**:
  - A route that triggers 8 query commands will open, setup, execute, and commit **8 separate database transactions**.
  - On cloud database setups (e.g. Neon, Supabase, Cloud SQL) with standard network latency, each transaction setup and configuration step introduces multiple roundtrips. This database waterfall adds significant overhead.

### Bottleneck C: Heavy Unpaginated Data Loads
- **Problem**: The `/api/dashboard/summary` endpoint fetches unpaginated historical logs to calculate efficiencies and sync unsynced entries:
  ```typescript
  const reportEntries = await (prismaTenant as any).reportEntry.findMany({
    where: reportEntryWhere,
    include: { format_version: true }
  });
  ```
- **Impact**:
  - If a company has accumulated thousands of reports, this query loads **all entries** in the date range (or company scope) into the Node.js API server memory.
  - The API server subsequently loops through these arrays to perform string manipulation, regex normalizations (`hasMachineAndOperator`), and JSON payload parsing. This results in heavy memory consumption and blocking CPU event loops.

### Bottleneck D: Login Handshake Hash Costs (Bcrypt)
- **Problem**: The manual login handler verifies user passwords against hashes configured with a Bcrypt cost factor of `12`.
- **Impact**:
  - By design, cost factor 12 enforces a CPU-intensive computation. On standard container runtimes (e.g. free or shared-CPU instances like Render/Railway), a single login handshake takes **250ms to 1000ms** of raw CPU time, delaying response times.

---

## 4. Proposed Optimizations

To resolve these performance lags:

1. **Add Indexing Rules**: Add composite and single indexes to `schema.prisma` on performance-critical foreign keys and query parameters:
   ```prisma
   model ReportEntry {
     // ...
     @@index([company_id])
     @@index([company_id, entry_date])
     @@index([department_id])
   }
   ```
2. **Batch Dashboard Data via Database Views or Aggregations**:
   - Instead of loading all raw `ReportEntry` JSON payloads into the Express API server to parse and sum production target metrics, offload these calculations to PostgreSQL queries using `$queryRaw` with JSON path operations (`payload->>'target'`).
3. **Consolidate Dashboard Queries into a Single Transaction**:
   - Refactor `dashboard.ts` to run all KPIs inside a single `prisma.$transaction` block. This reduces GUC `set_config` transaction overhead from 8 loops down to 1.
4. **Cache Layout Metadata**:
   - Cache static lists (like departments or report schemas) on the client side (`localStorage` or React state) rather than reloading them on every navigation hook.
