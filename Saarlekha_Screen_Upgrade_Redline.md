# Saarlekha — Screen Upgrade Redline & Antigravity Prompts

**Context:** These are corrections to the Stitch mobile mockups (auth, dashboard, data entry, production, quality, maintenance, job orders). The visual design system is good and should be kept; the items below are where Stitch drifted from the spec, plus the responsive (desktop) work that must be added. **Mobile is the priority, but every screen must be a responsive layout that also works on desktop — not a phone-only screen.**

Use the build brief (`AGENTS.md`) and PRD as the source of truth where these conflict with the mockups.

---

## A. Global fixes (apply to ALL screens)

1. **Remove all backend/environment configuration from the user-facing UI.** The auth screen currently shows an "ENVIRONMENT NODE" field with a server URL + "APPLY" button. Delete it. End users must never see or set backend server URLs or API endpoints. If a server switch is needed for local/native testing, gate it behind a dev-only build flag (`import.meta.env.DEV`), never in production UI.

2. **Remove hardcoded `serveousercontent.com` URLs and any temporary Stitch asset hosts.** All assets (logo, icons) must be bundled in the project.

3. **Plain, human language — drop the jargon skin.** Replace invented terms with normal labels:
   - "OPERATOR EMAIL" → "Email"
   - "SECURITY KEY" → "Password"
   - "AUTHORIZE ACCESS" → "Log in"
   - "GOOGLE IDENTITY" → "Continue with Google"
   - "PROVISION NEW ORGANIZATION" → "Create a company / Sign up"
   - Remove "SYSTEM BUILD: 4.8.2-PROD | STATUS: OPERATIONAL" footer.

4. **Keep the app industry-neutral. Remove hardcoded textile/"loom"/"weaving" terminology from UI labels and fixed options.** Saarlekha is a general manufacturing platform. "Loom," "Weaving," "Loom No." etc. may appear only as *sample/seed data* a company could replace — never as built-in field labels, department names, or dropdown options. Machine names, departments, and report types all come from company-defined data.

5. **One consistent navigation set across every screen.** Right now the bottom bar differs per screen (Dashboard/Production/Quality/Inventory/Settings vs Dashboard/Production/Masters/Inventory/Profile vs Home/Log Data/History/Profile). Standardize to the actual modules. Suggested primary nav: **Dashboard · Reports · Masters · Data Entry · Profile** (adjust to final IA, but it must be identical everywhere). **Remove the "Inventory" tab** — inventory is not a module in this project.

6. **Make every screen responsive (mobile + desktop), one codebase:**
   - **Mobile (≤640px):** keep the current card-based layouts, bottom tab bar, full-screen forms, bottom sheets, sticky action buttons.
   - **Tablet (641–1024px):** 2-column content; nav may move to a top bar or rail.
   - **Desktop (≥1024px):** replace the bottom tab bar with a **persistent left sidebar**; card lists become **sortable tables** where appropriate; dashboards use multi-column grids; forms sit in centered max-width containers rather than full-bleed. Same components, breakpoint-driven — do not build separate phone/desktop screens.

7. **Role-correct each screen.** Operations users must not see admin-only controls. Builders, user management, company settings, and item *approval* controls are admin/super-admin only.

---

## B. Per-screen corrections

### Auth
- Remove the ENVIRONMENT NODE / server config block (see A1).
- Email + Password with "Log in", "Forgot password?" link, "Continue with Google", and a "Sign up" link.
- Add the missing **Sign-up** and **Forgot-password** screens (Stitch only built login).
- Keep the Terms & Conditions acknowledgement checkbox — that's fine.
- Desktop: centered card, max-width ~420px, on a clean background.

### Operations Dashboard
- Add a **date-range selector** (not just a single date) — the spec requires date-range filtering on every view.
- Apply **department scoping**: operations users see only their assigned department(s); admins see all. Reflect this in what the dashboard loads, not just a filter chip.
- KPI cards (Production, Efficiency, Job Orders, Workforce) are good. Efficiency may exceed 100% (no cap) — current 104.2% example is correct.
- Tapping a report card / KPI opens the relevant **detail view** (Quality, Job Order, Production, Maintenance).
- Desktop: sidebar + multi-column KPI grid; maintenance and performance panels side-by-side.

### Data Entry
- The batch-queue pattern (add rows locally, review/edit/delete, then submit) is good — keep it.
- Fields must be **driven by the selected report format's schema** (the add-field builder output), not hardcoded "Loom No. / Recorded (mm)". Render whatever fields the format defines.
- Keep the format + department selectors at top.
- Desktop: form and batch-queue table side-by-side (two-column) instead of stacked.

### Machine Production (detail view)
- Good: machine-wise cards, operator, production vs target, efficiency %, multi-select + export (Excel/PDF/CSV/TXT).
- Add **date-range filter** and ensure it inherits the dashboard's range/department.
- Efficiency = period production ÷ period target sum; show **N/A** if target sum is 0; allow >100%.
- Remove "loom" as a built-in; machine names come from the company's Machine master.
- Desktop: switch the card list to a sortable table (Machine, Operator, Production, Target, Efficiency, Date) with the export bar above it.

### Quality (detail view)
- Keep it **industry-neutral** — do not assume a weaving/loom matrix. Render the quality report's company-defined fields.
- Add date-range + department inheritance and independent export.
- Desktop: table layout.

### Machine Maintenance Log
- The checklist + status-badge pattern is good. Maintenance **types and checklist items must be company-defined** (from the maintenance builder / MaintenanceTypeOption), not hardcoded ("Lubricated Gears", etc. are sample data only).
- Machine list comes from the Machine master.
- Desktop: two-column (machine/type/status on one side, checklist on the other).

### Job Orders Master
- Good: order cards, customer, item, order vs production qty, progress, per-row export.
- **Customer must come from Customer Master** (dropdown), and **item from the Items Master** (which carries the approval workflow). Custom columns are admin-defined.
- "Masters" nav grouping is fine, but align it to the standardized nav (A5).
- Desktop: sortable table with the same fields; export per row and bulk.

---

## C. Screens still MISSING that must be built (from the brief, not in this export)

These modules have no screen yet — build them to the same design system, responsive:
1. **Company onboarding** (super admin creates a company: name, address, logo, GST, contacts).
2. **Companies list** (super admin).
3. **User management** (create/edit/delete operations users + admins; multi-department assignment; invite-link generation shared via native share sheet).
4. **Manpower management** (with **masked Aadhaar** — last 4 digits only, never full).
5. **Customer master** (create/edit/delete).
6. **Items master** (list + **approval queue**: operations submit → Pending; admin Approve/Reject; admin-only "Manage columns").
7. **Report builder** (the "+ Add field" model — add fields via form/bottom sheet, list/reorder/edit/delete; NOT mandatory drag-and-drop).
8. **Job order builder** and **Machine maintenance builder** (define formats/columns).

---

## D. Antigravity prompts (paste one at a time)

**Prompt A — global UI corrections**
> Apply these global UI fixes to all existing Saarlekha screens. (1) Remove the "Environment Node"/backend server URL field from the auth screen and any backend/API config from user-facing UI; if a dev server switch is needed, gate it behind `import.meta.env.DEV` only. (2) Remove all hardcoded `serveousercontent.com` and temporary asset URLs; bundle assets in the project. (3) Replace jargon labels with plain language: "Operator Email"→"Email", "Security Key"→"Password", "Authorize Access"→"Log in", "Google Identity"→"Continue with Google", "Provision New Organization"→"Sign up / Create company"; remove the "System Build" footer. (4) Remove hardcoded textile/"loom"/"weaving" terms from labels, departments, and dropdown options — these may exist only as replaceable seed data; all machine names, departments, and report types come from company-defined data. (5) Standardize the navigation to one identical set across every screen — Dashboard, Reports, Masters, Data Entry, Profile — and remove the "Inventory" tab (not a module). Show me the updated nav component and the auth screen first.

**Prompt B — make every screen responsive (mobile + desktop)**
> Make all Saarlekha screens responsive from one codebase, mobile-first but fully functional on desktop. Mobile (≤640px): keep current card layouts, bottom tab bar, full-screen forms, bottom sheets, sticky buttons. Tablet (641–1024px): two-column content. Desktop (≥1024px): replace the bottom tab bar with a persistent left sidebar; convert card lists (production, job orders, quality, maintenance) into sortable tables; use multi-column dashboard grids; center forms in a max-width container. Use the same components with Tailwind breakpoints — do not fork phone/desktop screens. Show me the dashboard and the production list at mobile and desktop breakpoints.

**Prompt C — wire screens to real data & the format builder**
> Make the data-driven screens render company-defined data instead of hardcoded fields. (1) Data Entry must render the fields defined by the selected report format's schema (from the add-field builder), not fixed fields. (2) Machine Production, Quality, Maintenance, and Job Orders must pull machines from the Machine master, customers from the Customer master, items from the Items master, and maintenance types/checklist items from the maintenance builder — none hardcoded. (3) Add a date-range selector to the dashboard and all detail views, with detail views inheriting the dashboard's range and department. (4) Enforce department scoping on what each screen loads for operations users. Show me the Data Entry screen rendering a dynamic format.

**Prompt D — build the missing module screens**
> Build the screens that don't exist yet, using the same design system and responsive rules: company onboarding, companies list (super admin), user management (with multi-department assignment and invite-link generation shared via the native share sheet — desktop fallback to download + copyable wa.me link), manpower management (Aadhaar shown masked, last 4 digits only), customer master, items master (list + approval queue: operations submit → Pending, admin Approve/Reject, admin-only Manage columns), report builder ("+ Add field" model — add fields via form/bottom sheet, list/reorder/edit/delete), job order builder, and machine maintenance builder. Operations users must not see admin-only controls (builders, user management, approvals). Build them one module at a time; start with user management and items master, and show me each before moving on.

---

*Keep the Stitch PNGs as a visual reference for the look; follow this document for behavior, scope, and structure.*
