# Project: Saarlekha

## 1. Overview
Saarlekha is a multi-tenant internal operations reporting platform for manufacturing companies. It allows operations managers and company administrators to handle manpower, machine production, quality checks, maintenance activities, and job orders through customizable schema layouts. It features a responsive mobile-first shell (PWA-enabled) and handles secure multi-tenancy isolation natively at the database level.

---

## 2. Technical Stack
- **Frontend:** React + Vite, TypeScript, Tailwind CSS, Lucide Icons, Capacitor (Android/iOS integration).
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, CORS, JSON Web Token (JWT) auth.
- **Database:** PostgreSQL (v16+) with native Row-Level Security (RLS) enforcement.
- **Authentication:** Email & Password login, Google OAuth integration, email validation, and forgot password flows.

---

## 3. Database Schema (Prisma)
Below is the complete database structure defined in [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
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
  google_id         String?
  is_email_verified Boolean  @default(false)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  company           Company? @relation(fields: [company_id], references: [id])
  departments       UserDepartment[]
  submitted_items   Item[] @relation("SubmittedItems")
  approved_items    Item[] @relation("ApprovedItems")
  report_entries    ReportEntry[]
  audit_logs        AuditLogEntry[]
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
  custom_data   Json?      
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
  type       String   
  created_at DateTime @default(now())

  company    Company @relation(fields: [company_id], references: [id])
  versions   ReportFormatVersion[]
}

model ReportFormatVersion {
  id            String   @id @default(uuid())
  format_id     String
  version_num   Int
  fields_schema Json     
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
  payload           Json     
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
  report_entry_id   String?  @unique
  created_at        DateTime @default(now())

  company           Company  @relation(fields: [company_id], references: [id])
  operator          Manpower @relation(fields: [operator_id], references: [id])
  machine           Machine  @relation(fields: [machine_id], references: [id])
}

model AuditLogEntry {
  id          String      @id @default(uuid())
  company_id  String?     
  user_id     String
  action      AuditAction
  entity_type String      
  entity_id   String
  details     Json?       
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
```

---

## 4. Key Architectural Implementations

### Multi-Tenant Isolation (RLS Security)
- Row-Level Security is strictly enforced using PostgreSQL policies scoping every query to the company identifier (`company_id`).
- For Super Admins, an interceptor header `x-tenant-id` passes the target tenant, which overrides the connection scoping inside backend transactions dynamically.

### Dynamic Production Synchronization
- When operators log batch entries, the system automatically checks for custom schema mappings linking machine targets and operator targets.
- It intercepts updates and syncs entries to the `ProductionRecord` model inside a clean, single-scoped transaction context to prevent divide-by-zero or replication drift.

---

## 5. Frontend Screens & Components Structure
- **Auth Shell:** Manual and Google OAuth registration/login routing with strict Terms & Conditions acceptance blocks. Exposes a settings panel to easily update backend servers for native mobile testing.
- **Accordion Sidebar:** Collapsible groups for Masters (Manpower, Machines, Customers, Items Master, Job Order Columns), Reports (Machine Production, Other Production, Quality, Daily Quality Matrix), and Legal Policies.
- **Dynamic Batch Entry:** Logs queued rows locally in-memory, letting operators review, edit, or delete items inside an interactive table before finalizing submission.
- **Collapsible Drilldowns:** Renders dynamic matrix metrics grouped machine-wise or operator-wise with accordion controls and customized selective row download bars (Excel, PDF, CSV, TXT).

---

## 6. Mobile & Android Native Builds (PWA)
- **Automatic Signing:** Configured build scripts linking a release keystore (`saarlekha.keystore`) inside `build.gradle` so compiling app bundles auto-signs assets.
- **Java Keyword Split:** Bypassed standard compile rules prohibiting Java keywords (like `package` in `saarlekha.package.myapp`) by binding a different runtime namespace (`saarlekha.pkg.myapp`) to compile safe class files.
- **Bypass Headers:** Added request intercepts delivering `bypass-tunnel-reminder: true` headers to let mobile endpoints seamlessly connect to local tunnels without warning block screens.

---
*Export Manifest compiled for Claude Projects*
