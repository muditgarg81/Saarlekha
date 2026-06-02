# Saarlekha — Build Brief for Google Antigravity

> **Purpose of this file.** This is the single source of truth for building Saarlekha. Build to *this* spec, not to any contradicting design file. The Stitch HTML export is a **visual reference only** — where Stitch added screens or flows not listed here, ignore them. This document wins in any conflict.

---

## 0. What to build

**Saarlekha** — a multi-tenant internal operations reporting platform for manufacturing companies. Companies are onboarded by a super admin; each company runs its own manpower, production, job-order, quality, items, and machine-maintenance reporting through customizable formats, and views results on date-filterable dashboards.

**It must run on both web (desktop browser) and mobile.** Build it **responsive-first** as a single codebase: one React web app that adapts from a ~360px phone layout up to wide desktop, and is installable as a **PWA** so it behaves like an app on phones. (Native iOS/Android via Capacitor/React Native is a possible later phase — do **not** build native now.)

---

## 1. Recommended stack

Use this unless there's a strong reason not to; it keeps one codebase serving web + mobile.

- **Frontend:** React + Vite, TypeScript, Tailwind CSS. Responsive, mobile-first, PWA-enabled (installable, offline shell).
- **Backend:** Node.js + a typed API layer (e.g. Express or Fastify, or Next.js API routes if you prefer a unified app). REST is fine.
- **Database:** **PostgreSQL** (v16+). Use an ORM with migrations (Prisma or Drizzle).
- **Auth:** dual sign-up/sign-in — **email + password** (self-signup, with email verification and password reset) **and** Google OAuth. Invited operations users set their own password via invite link or use Google. Use JWT or server sessions. Hash passwords with bcrypt/Argon2 — never store plaintext.
- **File/object storage:** S3-compatible (AWS S3, Cloudflare R2, or Supabase Storage) for employee photos and report attachments. Store URLs in Postgres, never the binary.
- **Hosting target:** containerized; managed Postgres (Neon / Supabase / Cloud SQL). Document env vars in a `.env.example`.

Deliver a runnable repo: `frontend/`, `backend/`, `db/` (migrations + seed), a `docker-compose.yml` for local dev (app + Postgres), and a `README.md` with setup steps.

---

## 2. Multi-tenancy & data isolation (critical — review personally)

- **Each company is a separate tenant.** Company A must never read Company B's data.
- **Tiered isolation:**
  - **Shared database** for smaller tenants: one Postgres DB with a `company_id` on every tenant-scoped table, enforced by **PostgreSQL Row-Level Security (RLS)** — not just application filters.
  - **Dedicated database/schema per company** for larger tenants.
- Provision the tenant (DB rows or schema) automatically during company onboarding.
- Every query path must be tenant-scoped. Add tests proving cross-tenant reads are blocked.

---

## 3. Roles & permissions

Three roles. Operations must **never** reach admin functions.

| Capability | Super Admin | Company Admin | Operations |
|---|---|---|---|
| Create / onboard companies | ✅ | ❌ | ❌ |
| Create Company Admins | ✅ | ❌ | ❌ |
| Create / edit / delete Operations users | ✅ | ✅ | ❌ |
| Assign one or many departments to an operations user | ✅ | ✅ | ❌ |
| Build & edit formats (reports, job order, maintenance, item columns) | ✅ | ✅ | ❌ |
| Manage manpower, customers | ✅ | ✅ | ❌ |
| Create items in Items Master | ✅ | ✅ | ✅ (saved as *Pending*) |
| Approve / reject operations-created items | ✅ | ✅ | ❌ |
| Enter / edit data inside formats | ✅ | ✅ | ✅ |
| Export reports | ✅ | ✅ | ✅ |
| View dashboards | ✅ (all) | ✅ (all) | ✅ (assigned departments only) |
| Access admin panel | ✅ | ✅ | ❌ |

- **Super Admin** = the person who signs up and creates companies; can create admins and operations users.
- **Company Admin** = created by a super admin; manages one company.
- **Operations** = created by admin or super admin; data entry, export, and item submission only.

---

## 4. Auth & onboarding

**Two sign-up / sign-in methods, both first-class:**

1. **Email + password (manual):** users can sign up and log in with an email and password — no Google account required. Required at signup: name, email, password (with confirm). Include email verification, and a "forgot password" reset flow (emailed reset link).
2. **Google OAuth:** "Continue with Google" for users who prefer it.

Both methods create the same kind of account; a user signs in with whichever they registered with. (If an email used for Google also tries manual signup, link them or warn — don't create duplicates.)

**Password security (mandatory):** never store plaintext passwords. Hash with **bcrypt or Argon2**. Enforce a sensible minimum strength. Never log, transmit, or email a raw password. Rate-limit login attempts.

- **Company creation** fields: company name, address, logo, GST/registration number, contact name, email, phone.
- **Operations onboarding (no password sent):**
  1. Admin creates the operations user record and assigns department(s).
  2. System generates a **one-time, time-limited invite link**.
  3. Admin shares it via the device's **native share sheet** (from their own WhatsApp/SMS/email — a `wa.me` text link; no WhatsApp Business API, no platform messaging cost).
  4. User opens the link and **sets their own password** (or chooses Google sign-in). Plaintext passwords are never transmitted or stored.

---

## 5. Modules

### 5.1 User management
List + create/edit/delete operations users (admins for super admin). Department multi-select. Invite-link flow above. No password field in the admin form.

### 5.2 Manpower management
Create/edit/delete a person: photo, full name, contact number, **Aadhaar number — ALWAYS stored and displayed masked** (show only last 4 digits, e.g. `XXXX XXXX 1234`; never store the full number in readable form; encrypt the stored field), blood group, emergency contact, role, department.

### 5.3 Report builder — "add field" model (NOT drag-and-drop)
- Admin builds a format by **adding fields one at a time**: an "+ Add field" action opens a form/bottom-sheet to define the field — **name, data type, unit** — then adds it. Repeat for unlimited fields; group into sections/tabs.
- Each field has a **data type** (text, number, date, dropdown, yes/no, photo, calculated) so the system can store, validate, and aggregate it (number fields feed production/target totals).
- Define report formats, SKUs, units. Fields and formats are **editable and deletable**.
- **Versioning rule (preserve old data):** editing/deleting a field after data exists must NOT alter or destroy existing records — they keep their original fields and stay viewable/exportable; changes apply to **new** entries only. Implement via field/format versioning, not destructive column drops.

### 5.4 Job order builder
Define job-order parameters. Create units of material (add-material sheet). Select **customer from a dropdown sourced from Customer Master**.

### 5.5 Customer master
Create/edit/delete customers (name, contact person, phone, email, billing address, GST). Feeds the job-order customer dropdown.

### 5.6 Machine maintenance builder
Same add-field model as the report builder, scoped to maintenance, with a machine selector.

### 5.7 Items master (customizable columns + approval workflow)
- **Customizable columns:** admin defines item fields with the same add-field model (name, data type, unit); editable/deletable later; same preserve-old-data versioning.
- **Approval workflow:**
  - Operations can **create** an item → saved as **Pending**; NOT usable elsewhere until approved; operations cannot approve (not even their own) or edit columns.
  - Admin/super admin review a **pending queue** → **Approve** (status Active, becomes selectable in dropdowns) or **Reject** (optional reason).
  - Statuses: Pending, Active, Rejected, (optional) Inactive.
  - All create/approve/reject/edit/delete actions are audit-logged.

---

## 6. Dashboard & detail views

- Visible to admins and operations. Every view has a **date / date-range selector**.
- **Dashboard scope:** operations see **their assigned department(s) only** (one or many, as assigned); admins/super admins see all. Enforce as a server-side access rule, not just a UI filter.
- **Two levels:**
  - **Summary dashboard:** KPI cards (Total Production, Avg Efficiency %, Open Job Orders, Active Manpower) + a section/card per report type.
  - **Detail views** opened by **tapping a report card**: dedicated screens for **Quality, Job Order, Production, Machine Maintenance**, each showing full records for the selected date range and department, inheriting the dashboard filters.
- **Each detail view exports independently** (Excel, PDF, CSV, TXT) via download-then-share (see §8).
- Reports surfaced: Quality, Job Order, Production (machine-wise + operator-wise efficiency), Manpower Summary, Machine Maintenance.

---

## 7. Efficiency calculation

For the selected period, operator-wise and machine-wise:

```
Efficiency = ( total production for the period ) ÷ ( sum of daily targets for the period )
```

- Target is entered **per day**; production is entered **per day**; the period totals are the sums.
- If the period's target sum is 0 → show **N/A** (no divide-by-zero).
- Allow values **above 100%** (over-performance is real); do not cap. *(Confirm with product owner if a cap is later desired.)*

---

## 8. Exports

- Formats: **Excel, PDF, CSV, TXT**.
- Flow: generate file → **download to device → share via native share sheet** (user's own WhatsApp/email). A `wa.me` link cannot attach files, so exports are always download-then-share, not auto-sent.
- Available from each detail view and the dashboard.
- Exports must **never include the full Aadhaar number** (masked only). Gate exports by role and log every export.

---

## 9. Audit log

Append-only log of every create/edit/delete/approve/reject across users, manpower, customers, items, formats, and data entries. Capture **who, what, when**. Surface to admins.

---

## 10. Data entities

- **Company** (name, address, logo, GST, contacts)
- **User** (role, auth, company link; operations users carry assigned department[s])
- **Department**
- **Person/Manpower** (name, photo, contact, **masked Aadhaar**, blood group, emergency contact, role, department)
- **Customer**
- **Item** (admin-defined custom columns; status Pending/Active/Rejected/Inactive; submitted_by, approved_by, timestamps)
- **MaterialUnit**
- **JobOrder**
- **ReportFormat** (versioned; user-defined fields + data types, SKUs, units) + **ReportEntry**
- **Machine** + **MaintenanceRecord**
- **ProductionRecord** (daily production figure, daily target, operator, machine)
- **AuditLogEntry**
- **ExportRecord**

---

## 11. Responsive / web + mobile behaviour

- **Mobile (≤640px):** bottom tab bar, full-screen forms, bottom sheets for pickers/add-field, card lists instead of tables, sticky action buttons.
- **Tablet (641–1024px):** hybrid — sidebar may appear; two-column content.
- **Desktop (≥1024px):** persistent **left sidebar** navigation, multi-column dashboards, real tables with sortable columns, builders may use a wider two-pane layout (field list + properties) while preserving the same add-field interaction.
- One component set, breakpoint-driven. Don't fork the codebase per platform.

---

## 12. Design system (reuse from Stitch — it's good)

From the Stitch `DESIGN.md` ("Industrial Efficiency System"), keep:
- **Typeface:** Inter, with tabular-lining figures (`tnum`) for all numeric/data cells.
- **Primary:** Industrial Blue `#0059bb` / `#0070ea`. **Secondary/data accent:** Precision Teal `#006a6a`. **Error:** `#ba1a1a`.
- **Surfaces:** white cards on light-gray background `#f9f9ff`; hairline borders `#c1c6d7`.
- **Text:** `#181c23` primary, `#414754` secondary/metadata.
- **Radius:** default 0.5rem, cards 0.75–1rem. **Spacing:** 4px base scale, 16px gutter, 20px mobile margin.
- **Status colors:** Active = teal/green, Pending = amber, Rejected = red.
- Aesthetic: corporate-modern, high-contrast, data-dense but legible.

---

## 13. Where Stitch took liberties — correct these

The Stitch export is a visual reference. **Deviate from it on these points to match this spec:**

1. **Login:** Stitch built **email/password** login. That is now **wanted** — build it as one of two first-class methods (§4), **alongside** a "Continue with Google" option. Add the signup, email-verification, and password-reset screens Stitch didn't include.
2. **Extra screens not in scope** — `team_management`, `reports_feed`, `analytics_deep_dive`: do **not** treat these as required modules. Fold any genuinely useful bits into the defined modules (e.g. user/department management lives in §5.1), otherwise omit. Don't invent new top-level features.
3. **Builders:** ensure they use the **add-field** interaction (per §5.3), regardless of how Stitch rendered them. No mandatory drag-and-drop.
4. **Aadhaar:** must be **masked everywhere** (the Stitch mock shows a sample number — never display or store the full value).
5. **Sharing:** no in-app automated WhatsApp/email send — use the **native share sheet** only (§4, §8).
6. **Scope discipline:** build exactly the modules in §5–§9. If something appears in Stitch but not here, it's out of scope unless the product owner confirms.

---

## 14. Build order (suggested milestones)

1. Repo scaffold, Postgres + migrations, auth (email/password signup with verification + reset, **and** Google OAuth, plus invite-link setup), tenant model with RLS, seed data.
2. Company onboarding + super-admin company list + user management (roles, departments, invite links).
3. Manpower (masked Aadhaar) + Customer master.
4. Report builder (add-field + versioning) + operations data entry.
5. Items master with approval workflow; job-order & maintenance builders.
6. Dashboard summary + the four detail views + per-view export + efficiency calc.
7. Audit log, export gating, responsive/PWA polish, cross-tenant isolation tests.

Produce an `implementation_plan.md` from this brief before coding, and pause for human review on: tenant isolation/RLS, auth, and Aadhaar handling.
