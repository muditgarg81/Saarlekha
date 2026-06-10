# Saarlekha — Build Walkthrough

## Services Running Locally

| Service | URL | Status |
|---|---|---|
| Frontend (Vite + React) | http://localhost:5173 | 🟢 Running (task-823) |
| Backend (Express + Prisma) | http://localhost:5000 | 🟢 Running (task-819) |
| Database (Neon PostgreSQL) | Cloud (ap-southeast-1) | 🟢 Connected |

---

## What Was Built & Solved

### 1. Batch Data Entry Page
- **State Management**:
  - Added state hooks `batchEntries` (array of entries) and `editingIndex` in [DataEntry.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DataEntry.tsx) to queue entries locally.
- **Add & Edit Actions**:
  - The entry form's action now triggers **"Add Row"** (or **"Update Row"** if editing). This validates the active schema inputs, saves/updates them inside the local `batchEntries` state, and clears the input fields so the operator can type the next row without leaving the screen.
  - Adding an edit action loads a queued row back into the input fields, letting users modify parameters (e.g. adjust loom size variation) and save it.
- **Delete Action**:
  - Allows removing any row from the queued batch before submission.
- **Batch Preview Table**:
  - Renders a clean preview grid/table listing all current queued entries. Headers match the fields defined in the active report format.
- **Bulk Submission**:
  - Displays a **"Submit Batch"** button summarizing the queue count. Clicking it maps and posts the entire array to `POST /api/reports/entries` in one transaction.

### 2. Backend Batch Insert Scoping
- **Bulk Array Support**:
  - Updated `/api/reports/entries` POST route in [reports.ts](file:///c:/claude/Saarlekha/backend/src/routes/reports.ts) to verify if the request body is an array.
  - If it is an array, it maps each item to the active tenant scope and logs them in a single batch insert query via Prisma's `createMany` database operator.
  - If a single object is sent, it falls back to standard single-row creation, maintaining backward compatibility.

### 3. Collapsible Sidebar Groups
- **Collapsible accordion sections**:
  - Grouped **Manpower**, **Machines**, **Customers**, and **Items Master** under a collapsible **"Masters"** parent using the `Database` icon.
  - Grouped **Production** and **Quality** reports under a collapsible **"Reports"** parent using the `BarChart3` icon.
  - Kept **"Report Builder"** directly on the main top-level sidebar using the `Settings` icon.
- **Auto-expansion**:
  - Added path-matching hooks in [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) to automatically expand the correct accordion group if a user navigates to any sub-route directly.

### 4. Landing Page Selection & Tenant Override
- **Super Admin Landing Page**:
  - Super Admins are presented with the **Companies** selection page at `/` upon login. Clicking a card sets that company as active in `localStorage` and opens the operations dashboard.
- **Tenant Scope Override (Axios + Express)**:
  - An Axios request interceptor injects the `x-tenant-id` header to all outgoing API requests if a tenant ID is selected.
  - On the backend, the `authenticate` middleware inspects this header. If the user is a `SUPER_ADMIN`, it overrides `req.tenantId` to scope all RLS queries to that company.
- **Direct Landing for Standard Users**:
  - Company Admins and Operations users bypass the list entirely and land directly on their company's dashboard.

### 5. Quick Links for Data Entry & State Reset Refinement
- **Query Parameter Mapping**:
  - Configured `DataEntry.tsx` to read `type`, `formatId`, and `departmentId` from the URL query string using `useSearchParams`.
  - Added support for filtering available report formats in the select dropdown based on the `type` parameter (e.g. only showing `QUALITY` formats when `type=QUALITY` is passed).
- **Quality Reports Link**:
  - Added a **"+ Log Entry"** action button in [QualityDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/QualityDetail.tsx) that navigates operators directly to the dynamic batch data entry view scoped to Quality: `/data-entry?type=QUALITY`.
- **Production Report Link**:
  - Added an **"+ Operations Data Entry"** action button in [ProductionDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ProductionDetail.tsx) next to the inline logger, pointing to `/data-entry?type=GENERAL` to allow operators to log general operations formats directly.
- **Data Entry Selector Reset**:
  - Modified `handleSubmitBatch` in [DataEntry.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DataEntry.tsx) to clear the active format and department selection state inputs upon successful submission, indicating the batch transaction is finalized and resetting dropdowns to their default state.

### 6. Items Master: Edit and Delete Operations
- **Backend API Endpoints**:
  - Implemented `PUT /api/items/:id` in [items.ts](file:///c:/claude/Saarlekha/backend/src/routes/items.ts) to update an item's details (e.g. name). It creates an append-only audit log entry with `before` and `after` details.
  - Implemented `DELETE /api/items/:id` in [items.ts](file:///c:/claude/Saarlekha/backend/src/routes/items.ts) to delete an item, also logging a `DELETE` audit action.
  - Restructured both endpoints to enforce company RLS scopes and authorize only `SUPER_ADMIN` and `COMPANY_ADMIN` roles.
- **Frontend Master UI Integration**:
  - Added an `editingItem` state in [ItemsMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/ItemsMaster.tsx) to manage when an admin is modifying an existing item name.
  - Reused the proposal card form dynamically to double as an edit form, updating the card's headings and primary buttons when modifying an item (showing "Save Changes" and a "Cancel" action).
  - Renamed the column header to "Actions" and added edit and delete action buttons styled using `lucide-react` icons (`Edit` and `Trash2`) for admins on every row.

### 7. Job Orders: Edit/Delete Actions & Customizable Columns Master
- **Database Schema Upgrades**:
  - Added a `custom_data Json?` column to the `JobOrder` model in [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma) to hold values for customizable job order parameters.
  - Successfully ran `npx prisma db push` to synchronize changes with the Neon database and regenerated client types via `npx prisma generate`.
- **Backend Endpoints**:
  - Augmented the `POST /api/job-orders` route in [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to accept and save a `custom_data` object.
  - Added `PUT /api/job-orders/:id` (Edit Job Order) and `DELETE /api/job-orders/:id` (Delete Job Order) routes to modify/delete records with complete audit logging.
- **Job Order Columns Master**:
  - Created a new component [JobOrderColumnsMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderColumnsMaster.tsx) under `Masters`.
  - It utilizes the existing generic `ReportFormat` structure with a special `type: 'JOB_ORDER'` format, automatically initializing it if it doesn't exist, and allowing admins to define custom columns (name, data type, unit) using the dynamic add-field model.
- **Dynamic Job Orders View**:
  - Re-wrote [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx) (Job Orders page) to load the Job Order columns schema and render them dynamically as columns in the main table list, and as fields in both the Create and Edit forms.
  - Added Edit and Delete actions for admins on every Job Order row, with cancel and submit operations linking to the new PUT/DELETE routes.
- **Sidebar Navigation Routing**:
  - Wired `/masters/job-orders` inside `App.tsx` and `Layout.tsx`, positioning "Job Order Columns" cleanly in the collapsible "Masters" section in the sidebar.

### 8. Column / Field Re-sequencing (Drag & Drop Reordering)
- **Vanilla Drag & Drop**:
  - Implemented vanilla HTML5 drag-and-drop reordering in both [JobOrderColumnsMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderColumnsMaster.tsx) and [ReportBuilder.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ReportBuilder.tsx).
  - Hovering over a row shows a `GripVertical` handle for drag interaction.
  - Dropping a field updates the list order in state and submits it to the backend to create a new format version with the updated column order.
- **Arrow Removal**:
  - Removed all Up/Down arrows and corresponding swap functions from the UI as requested by the user, providing a cleaner, more interactive drag-and-drop experience.

### 9. Operations User Data Entry Dropdowns & Permissions
- **Assigned Departments Scope**:
  - Updated the backend `GET /api/departments` route in [departments.ts](file:///c:/claude/Saarlekha/backend/src/routes/departments.ts) to support the `OPERATIONS` role.
  - When accessed by an operations user, it filters and returns only the departments they are assigned to via `UserDepartment` mapping.
  - Restricted department modification write endpoints (`POST`, `PUT`, `DELETE`) to admin roles (`SUPER_ADMIN`, `COMPANY_ADMIN`).
  - This solves the 403 Forbidden issue that was previously preventing the Data Entry page from loading formats and departments for operations users.
- **Assigned Departments Scope Enforcement in Dashboard**:
  - Hardened the `GET /api/dashboard/summary` endpoint in [dashboard.ts](file:///c:/claude/Saarlekha/backend/src/routes/dashboard.ts) to verify and restrict the `departmentId` parameter to the operations user's assigned departments, preventing scoping bypass.
- **Operator Name Dropdown**:
  - Modified [DataEntry.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DataEntry.tsx) to check if a field represents an operator (type `operator` or name matching `operator` / `operator name`).
  - If a field matches, it dynamically renders a dropdown `<select>` list instead of a text input.
  - The list is populated with active manpower for the chosen department, with a fallback to all manpower if no records are registered in that department yet.
  - Added the `Operator (Dropdown)` data type in [ReportBuilder.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ReportBuilder.tsx) so admins can explicitly define fields with this dropdown option.
- **Loom & Machine Dropdown**:
  - Modified [DataEntry.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DataEntry.tsx) to query `/api/machines` to load registered machines.
  - If a field represents a machine (type `machine` or name matching `machine` / `loom` / `loom no` / `loom number` / `machine no`), it dynamically renders a select dropdown.
  - If the field context relates to looms, it automatically filters the dropdown to show only machines with "loom" in their name or type, with a fallback to all machines.
  - Storing the machine's name preserves database compatibility.
  - Added the `Machine/Loom (Dropdown)` data type in [ReportBuilder.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ReportBuilder.tsx) so admins can explicitly choose it.

- **Job Order Operations & Open Columns**:
  - Exposed the Job Orders sidebar tab to the `OPERATIONS` role in [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx).
  - Added a date-range filter at the top of the Job Orders page in [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx) to filter job orders client-side.
  - Added an `open` boolean flag toggle (checkbox) inside [JobOrderColumnsMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderColumnsMaster.tsx) so that admins can mark specific custom columns as editable by operations.
  - Handled input disabling in [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx) to make standard job order details (Order Number, Customer, Start Date, End Date, Status) and non-open custom columns readonly/disabled for operations users.
  - Operations users are shown the edit action button but not the delete button.
  - Enforced server-side validation in `PUT /api/job-orders/:id` in [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to verify that operations users only update custom columns marked as `"open": true`, blocking modifications to other fields.

### 11. Navigation Enhancements & Job Order Number Auto-Generation
- **Global Back Button**:
  - Imported `ArrowLeft` from `lucide-react` and added a styled conditional back button in [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) at the top of the desktop and mobile top headers.
  - The button is displayed whenever `location.pathname !== '/'` (i.e. on all sub-pages except the landing dashboard).
  - Clicking it triggers programmatic back navigation using React Router's `navigate(-1)`.
- **Auto-Generated Job Order Numbers**:
  - Updated the job order creation endpoint `POST /api/job-orders` in [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to auto-generate order numbers in sequential format `JO-XXXXX` (e.g. `JO-00001`, `JO-00002` etc.) per company.
  - The backend queries all existing `JO-` prefix job orders for the active tenant, extracts the highest numeric suffix, and increments it by 1 to guarantee unique sequencing and prevent duplicates.
  - Updated [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx) to disable the Order Number input box. It displays `Auto-generated` during creation, and displays the read-only generated order number when editing a job order, ensuring zero manual entry or duplications.
- **Dropdown Actions Menu & Operator Lockout**:
  - Replaced inline row buttons with a clean floating dropdown menu using the `MoreVertical` kebab icon. Clicking it displays a list of context-appropriate actions (Edit Details, Mark as Completed, Mark as Cancelled, Delete Order).
  - To prevent the dropdown from getting cut off by the table's `overflow-x-auto` wrapper, the dropdown is positioned to float directly to the left overlaying columns (`right-full -top-2 mr-2`), and a minimum height constraint of `260px` is applied to the scroll wrapper.
  - Implemented client and server-side lockout rules to lock completed/cancelled job orders. If an order is completed or cancelled, operators (`OPERATIONS`) are shown a Lock icon instead of an Edit link, and the backend route `PUT /api/job-orders/:id` rejects updates with a `403 Forbidden` status.
  - Allowed operations to use the dropdown menu to transition open job orders to `COMPLETED` or `CANCELLED`, but blocked them from editing standard details or making changes once locked.
- **Admin User Invitation**:
  - Modified the backend `/auth/invite` route in [auth.ts](file:///c:/claude/Saarlekha/backend/src/routes/auth.ts) to accept a custom `role` parameter (`COMPANY_ADMIN` or `OPERATIONS`), validating that Company Admins can only invite Operations users while Super Admins can invite both.
  - Updated the frontend [UsersTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/UsersTab.tsx) form to render a **Role** select dropdown for Super Admins.
  - Dynamically hides the **Assign Departments** checklist when a `COMPANY_ADMIN` role is selected, as departments only apply to operations staff.
- **Robust User Deletion**:
  - Re-wrote the backend `DELETE /api/users/:id` endpoint inside [users.ts](file:///c:/claude/Saarlekha/backend/src/routes/users.ts) to execute a transaction that clears the user's `UserDepartment` rows first, resolving foreign key conflicts for unused users.
  - Integrated a fallback soft-deactivation trigger (intercepts foreign-key violations, such as existing Audit logs or Report entries). Instead of failing, it nullifies their credentials, suffix-renames their email address to release the original address for future invites, and hides them from the active user list query (`GET /api/users`), cleanly satisfying data isolation/audit history requirements.
- **Ignore Standard Columns for Operations to Avoid Mismatches**:
  - Restructured `PUT /api/job-orders/:id` inside [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to ignore standard fields (like dates, order numbers, customer IDs) sent in the request payload if the user is `OPERATIONS`. 
  - Instead of throwing a validation error due to date parsing timezone discrepancies (e.g. comparing local time strings from the frontend with UTC timestamps in the database), the backend now only passes the status and custom data fields to Prisma. This lets operations users successfully save changes to editable custom columns.

---

## Running the Automated Tests

You can execute the RLS tenant isolation test suite by running:
```bash
cd backend
npx ts-node src/tests/rls.test.ts
```
Output confirms role connection and policy filtering:
```
Test Client DB Role: [ { rolname: 'saarlekha_app', rolbypassrls: false, rolsuper: false } ]
...
--- Testing under Company A Context (using saarlekha_app client) ---
Query customers: Found 1 customer(s)
✓ SUCCESS: Found Customer A and did NOT find Customer B.
✓ SUCCESS: Direct find of Customer B returned null.
=========================================
ALL RLS TENANT ISOLATION TESTS PASSED! 🎉
=========================================
```
### 10. Delete Option for Report Entries
- **Backend API Layer**:
  - Implemented `DELETE /api/reports/entries/:id` inside [reports.ts](file:///c:/claude/Saarlekha/backend/src/routes/reports.ts).
  - This endpoint validates the tenant scope (`req.tenantId`).
  - It restricts delete operations for `OPERATIONS` users to only entries they submitted themselves (`submitted_by` check), while allowing Admins and Super Admins to delete any entry in the tenant company.
  - Generates an audit log entry of type `DELETE` with the deleted payload.
- **Frontend Dashboard View**:
  - Modified [Dashboard.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/Dashboard.tsx) to add an "Actions" column to the "Recent Report Entries" table.
  - Added a Trash icon button inside each row. Clicking it prompts for confirmation, deletes the record via the API, and triggers `fetchDashboard()` to refresh the dashboard summary data.
  - Used `e.stopPropagation()` on click to prevent row-click event from navigating to the edit page.
- **Frontend Quality Detail View**:
  - Modified [QualityDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/QualityDetail.tsx) to add an "Actions" column to the report entries list.
  - Added a Trash icon button inside each row with stopPropagation and confirmation dialog, calling `fetchEntries()` to refresh the listings.
- **Frontend Data Entry View**:
  - Added a red "Delete Entry" action button to the bottom edit-form actions in [DataEntry.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DataEntry.tsx) when modifying a saved entry.
  - Clicking this deletes the entry from the database and returns the user to the previous page.

### 11. Department-wise Reporting in Daily Reports
- **Frontend Daily Report View**:
  - Modified [DailyReport.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/DailyReport.tsx) to fetch registered departments from `/api/departments`.
  - Added a third toggle option "Department-wise View" to the daily report view filter bar.
  - Implemented grouping logic `getDepartmentWiseReport` which aggregates report entries by their department relationship (`department_id` match) and maps production records to their operator's department.
  - Updated "Expand All" and "Collapse All" actions to expand/collapse department cards.
  - Enhanced production record metadata display to show both the operator and machine name when grouped by department.
  - Updated the Excel, PDF, CSV, and TXT export generator to support department-wise columns, rows, and headers.

### 12. Export Option for Job Orders
- **Frontend Job Orders View**:
  - Imported and integrated the `<ExportBar>` utility component into [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx) next to the "Create Job Order" button.
  - Implemented the `getExportData` helper method to map all standard columns (Order #, Customer, Department, Item Description, Qty, Units, Production, Status, Dates) and all user-configured custom columns dynamically from `joSchema`.
  - Enabled support for exporting the active, filtered list of Job Orders into Excel, PDF, CSV, and TXT formats.

### 13. Scoping Security & Tenant Override Hardening
- **Authentication Scoping Mitigation**:
  - Hardened [auth.ts](file:///c:/claude/Saarlekha/backend/src/middleware/auth.ts) to resolve `req.tenantId` server-side from the verified JWT `companyId` session parameters, eliminating client-side header override vulnerabilities for normal users.
  - Implemented logic that restricts `x-tenant-id` header overrides exclusively to authenticated `SUPER_ADMIN` roles.
  - For standard `COMPANY_ADMIN` and `OPERATIONS` users, any user-supplied `x-tenant-id` headers are ignored and the system falls back safely to their session-verified `companyId`.
- **Automated Verification Suite**:
  - Added [tenant-override.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/tenant-override.test.ts) mapping tests for:
    - **SUPER_ADMIN**: Validates that overrides to `company-A` or `company-B` are honored correctly.
    - **COMPANY_ADMIN**: Validates that attempts to send `x-tenant-id: company-B` are ignored and safely scoped back to their verified `company-A`.
    - **OPERATIONS**: Validates that attempts to override tenant scoping are ignored and safely scoped to `company-A`.
  - Executed tests using `cmd.exe /c "npx ts-node src/tests/tenant-override.test.ts"` showing all assertions passed successfully.

### 14. Keystore & Signing Credentials Security Hardening
- **Secrets Extraction**:
  - Removed all plain-text passwords and hardcoded file references from `frontend/android/app/build.gradle`.
  - Configured `build.gradle` to dynamically read Android release signing parameters from environment variables (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) only if `ANDROID_KEYSTORE_PATH` is defined. This allows clean, unsigned local development builds while supporting safe injection at build time/CI.
- **Physical File Cleanup**:
  - Deleted the physical release keystore `saarlekha.keystore` from the workspace to prevent accidental check-ins.
- **Ignored Patterns Enforcement**:
  - Created a global root [.gitignore](file:///c:/claude/Saarlekha/.gitignore) and updated directory-specific `.gitignore` files to explicitly ignore any `.keystore`, `.jks`, and `*password*` files.
- **Git History Cleanliness**:
  - Confirmed the workspace is a clean initialization directory without an active Git repository history, ensuring no old commits contain legacy credentials.

### 15. Server Configuration Panel Removal from Production UI
- **Gating Behind DEV Flags**:
  - Gated the settings gear button and the "Server Settings" configuration panel in [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) behind `import.meta.env.DEV`.
- **Tree-Shaking Verification**:
  - Built production assets using `npm run build`.
  - Searched the generated JavaScript bundle `dist/assets/index-BtCoESBM.js` for the settings-only keyword `"emulator"`, verifying that the code has been completely stripped out and is absent from the production build.

### 16. Dashboard Scrolling & Summary Card Export Options
- **Scrollable Card Lists**:
  - Re-wrote the table containers for **Operator Efficiency**, **Machine Efficiency**, and **Machine Maintenance** cards in [Dashboard.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/Dashboard.tsx) to support internal vertical scrolling (`overflow-y-auto max-h-[350px]`).
  - Added sticky position configurations (`sticky top-0 z-10 bg-surface`) to table header components so they stay pinned at the top while scrolling through long sets of records.
  - Removed row-truncation (`.slice(0, 6)`) limitations, enabling users to view all active dashboard records directly.
- **Export Options Dropdowns**:
  - Implemented a reusable lightweight `<ExportDropdown>` popup component for each of the three cards.
  - Linked each card's export dropdown to dedicated handlers triggering `exportExcel`, `exportPDF`, `exportCSV`, or `exportTXT` from [export.tsx](file:///c:/claude/Saarlekha/frontend/src/utils/export.tsx) with the active dashboard date range dataset.

### 17. Schema Corrections, Database-backed Tokens, and Account Linking
- **Schema Upgrades & Constraints**:
  - Declared `google_id` as `@unique` on the `User` model to prevent duplicate OAuth identity registration.
  - Upgraded the `department_id` on the `ProductionRecord` model to be non-nullable and enforced its relation mapping to `Department` to ensure correct department-scoped efficiency computations.
  - Declared the `TokenType` enum and the database-backed `Token` model with automated cascading delete constraints.
- **Robust Database-backed Single-use Tokens**:
  - Modified the email verification (`/verify-email`), password reset (`/forgot-password` & `/reset-password`), and user onboarding invitation (`/invite` & `/setup-password`) routes to generate, validate, and mark tokens as consumed (`used_at`) inside database-backed single-use structures with strict validation checks.
- **Bi-directional Account Linking**:
  - Added account-linking in `POST /google` (linking Google sign-ins to existing email accounts if the email matches).
  - Added account-linking in `POST /register` (allowing users to set a password for pre-existing Google OAuth accounts if the email matches).
- **Hardened Audit Logging & Scoping**:
  - Audited all `AuditLogEntry` creations, ensuring `company_id` is always passed on company-scoped actions and only nullable for platform-level actions.
  - Bypassed Dev connection pool caching anomalies by routing directly to database endpoints. All automated scoping security and RLS isolation tests passed successfully.

### 18. Summed-then-divided Efficiency Calculation & Divide-by-zero Mitigation
- **Calculation Alignment**:
  - Implemented the utility function `calculateEfficiency(production, target)` inside [efficiency.ts](file:///c:/claude/Saarlekha/backend/src/utils/efficiency.ts).
  - Configured it to compute efficiency by summing targets and production figures for the period first, then dividing once.
  - Returns `'N/A'` directly if the period's target sum is `0` or negative to avoid divide-by-zero exceptions.
  - Allows uncapped values above 100%.
- **Validation**:
  - Created a test suite [efficiency.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/efficiency.test.ts) covering standard calculations, float formatting, zero-target case, and negative target boundaries.
  - Integrated display fixes in the frontend to handle the string `'N/A'` correctly.

### 19. Row-Level Security Write Checks (WITH CHECK)
- **Stricter Policies**:
  - Replaced all Postgres RLS policies to append the `WITH CHECK` constraint to prevent cross-tenant `INSERT` and `UPDATE` write actions, rather than only filtering `SELECT` queries.
  - The policies verify that the input/modified rows strictly match the authenticated user's `company_id`.
- **Validation**:
  - Implemented the test suite [rls-writes.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-writes.test.ts) running checks across `Customer`, `Manpower`, `ReportEntry`, `JobOrder`, and `ProductionRecord` to verify that cross-tenant writes are immediately blocked.

### 20. Stricter Audit Log RLS Policies
- **Separation of Platform and Tenant Logs**:
  - Restricted the `AuditLogEntry` RLS policy: regular tenants can only see or write audit entries matching their own `company_id`.
  - Platform-level audit logs (where `company_id IS NULL`) are readable and writable exclusively under `SUPER_ADMIN` user role contexts.
- **Validation**:
  - Added the test suite [rls-audit.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-audit.test.ts) proving that a normal tenant context cannot list or insert a `NULL` audit log entry.

### 21. User Table RLS & Pre-Authentication Login Scoping
- **User Scoping**:
  - Enabled Row-Level Security (RLS) on the `User` table, scoping users to the active tenant for normal operations.
- **Pre-Authentication Exception**:
  - Configured RLS policies to allow checking credentials before the tenant ID is resolved by verifying that the `email`, `google_id`, or `id` matches context variables (`app.login_email`, `app.login_google_id`, `app.login_user_id`) set inside pre-auth transactions (used during login, signup, reset password, email verification, and invitation config).
- **Validation**:
  - Implemented the test suite [rls-user.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-user.test.ts) to verify that cross-tenant listing of users is blocked, whereas login pre-auth queries continue to function correctly.

### 22. SQL Injection Verification (Parameterized set_config Queries)
- **Parameterized Security**:
  - Swapped raw string interpolation for template literals inside database transaction context setters. The queries use standard parameterized syntax e.g. `$executeRaw` parameterized placeholders to completely neutralize SQL injection payloads.
- **Validation**:
  - Implemented the test suite [sql-injection.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/sql-injection.test.ts) running malicious SQL syntax payloads (e.g. quote escapes, semicolons, subqueries, UNION injections) against both database-level GUC parameters and unauthenticated API endpoints (/login and /forgot-password) to verify GUC values remain unaltered, standard errors are returned, and no database crashes occur.

### 23. Cross-Role Enforcement Verification
- **Role-Based Endpoint Locks**:
  - Enforced department-level boundaries on report entries list (`GET /entries`), details (`GET /entries/:id`), and updates (`PUT /entries/:id`) for OPERATIONS users.
  - Locked item approval (`PATCH /items/:id/approve` and `PUT /items/:id`) and user management (`/users`) endpoints to admin roles.
- **Validation**:
  - Implemented the test suite [cross-role.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/cross-role.test.ts) to verify that:
    - OPERATIONS users receive a 403 Forbidden error on admin-only endpoints.
    - OPERATIONS users cannot approve items (even their own submissions).
    - OPERATIONS users assigned to Department X cannot read or update entries belonging to Department Y.
    - COMPANY_ADMIN users cannot bypass RLS to read another company's records.
    - JWTs signed with incorrect secrets are rejected with 401 Unauthorized.

### 24. Security Cleanup (Bcrypt Cost, Unverified User Gating, and Invite Serialization)
- **Bcrypt Work Factor**:
  - Increased bcrypt hashing cost factor from `10` to `12` globally across registration, company onboarding, password setup, password reset, and user RLS tests to align with modern cryptographic recommendations.
- **Unverified User Gating**:
  - Configured manual registration to withhold session JWT issuance, requiring the registrant to complete the email verification loop first.
  - Implemented a 403 Forbidden check on manual login (`POST /api/auth/login`) for accounts where `is_email_verified` is false.
- **Invite Payload Sanitization**:
  - Field-picked the response of the `/invite` endpoint to return only `(id, email, role, companyId)`. This prevents accidental serialization of internal sensitive fields (such as `password_hash`).
- **Validation**:
  - Implemented the test suite [rls-invite.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-invite.test.ts) to verify that an administrator context under RLS is permitted to create users and associated invitation tokens for their own company, while attempts to insert users into another company's tenant are blocked with a row-level security policy violation.

### 25. Company Onboarding RLS Policy Fix & Admin User Invite Flow
- **Transaction-Level Tenant Scoping**:
  - Fixed a row-level security violation on `User` inserts when onboarding new companies. In `companiesRouter.post('/')` inside [companies.ts](file:///c:/claude/Saarlekha/backend/src/routes/companies.ts), the handler now sets `app.current_tenant_id` to the newly created company's ID within the Prisma transaction context *prior* to inserting the admin user. This satisfies the RLS `WITH CHECK` constraint without bypassing or disabling RLS.
- **Admin Password Invitation Flow**:
  - Removed the `adminPassword` input field from the Super Admin onboarding screen in [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx) to align with standard credential security practices.
  - The first company admin user is now provisioned with an unverified account (`is_email_verified = false`) without a preset password. The system generates a single-use `INVITE` token and returns the generated invite link (`/setup-password?token=...`) to the Super Admin UI, rendering a copyable modal overlay.
- **Database/RLS Error Sanitization**:
  - Created a database error sanitization utility [db-errors.ts](file:///c:/claude/Saarlekha/backend/src/utils/db-errors.ts). It catches and translates PostgreSQL/RLS errors (e.g. policy violations, unique constraints, foreign keys) into clean, user-friendly messages that do not leak internal database architecture, table names, or constraints.
- **Validation**:
  - Implemented the automated test suite [onboard-rls.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/onboard-rls.test.ts) proving that company and initial admin onboarding completes successfully under RLS context parameters, and blocks User inserts if the transaction-level tenant ID is not configured.

### 26. Report Builder UI Save Action & Name Editing
- **Local Fields Modification State**:
  - Refactored [ReportBuilder.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ReportBuilder.tsx) to store the list of custom fields in a local state variable (`fields`) upon editing a report format. 
  - Click actions for adding a field (`handleAddField`), editing a field (`handleSaveEditField`), deleting a field (`handleDeleteField`), and drag-and-drop reordering (`handleDrop`) now execute local state updates instead of triggering immediate HTTP requests to the backend server.
- **Report Format Name Editing**:
  - Created a new backend route `PUT /api/reports/formats/:id` in [reports.ts](file:///c:/claude/Saarlekha/backend/src/routes/reports.ts) to update a format's metadata (its name) and log the EDIT action to the audit trails.
  - Implemented an editable **Report Format Name** input block in the frontend Report Builder editor panel, allowing administrators to modify the format's title.
- **Save Format Action Button**:
  - Added a **"Save Format"** action button alongside a **"Cancel"** action button at the bottom of the editing pane. Clicking "Save Format" updates both the report name (if modified) and sends the finalized custom fields schema to the backend in one transaction.

### 27. Maintenance Master Navigation
- **Navigation Setup**:
  - Configured "Maintenance Master" under the "Masters" collapsible accordion section inside [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) for `SUPER_ADMIN` and `COMPANY_ADMIN` roles.
  - Clicking this menu item routes to `/masters/maintenance` which correctly invokes the `MaintenanceColumnsMaster` component.
  - Updated accordion auto-expansion logic to automatically expand and activate the "Masters" dropdown if a user directly loads or navigates to the `/masters/maintenance` path.

### 28. Customer Master Edit Feature
- **Backend PUT Endpoint**:
  - Added a new route `PUT /api/customers/:id` in [customers.ts](file:///c:/claude/Saarlekha/backend/src/routes/customers.ts) to allow updating customer information (e.g., name, contact_person, phone, email, billing_address, and gst).
  - Appends an audit log entry for the `EDIT` action with detail comparisons (`before` and `after`).
- **Frontend Customer UI Upgrades**:
  - Extended the UI on the [CustomerMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/CustomerMaster.tsx) page to support editing customer details.
  - Added an edit action button (`Edit2` icon) on the customer cards for admin roles.
  - Populates and reuses the creation form layout for editing customer details, updating its heading to "Edit Customer" and action buttons to "Update Customer" / "Cancel".
  - Incorporated an **Email** field in the customer master form for complete data recording.

### 29. Production Log Layout Refactoring
- **Filter and Route Rules**:
  - Defined a layout rule `hasMachineAndOperator` to identify report formats containing both machine (e.g., `loom`, `machine`) and operator (e.g., `operator`, `person`) fields.
  - Updated [OtherProduction.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/OtherProduction.tsx) to strictly filter out any formats (and corresponding entries) containing both machine and operator fields.
  - Updated [ProductionDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ProductionDetail.tsx) (Machine Production page) to strictly display only the custom format entries containing both machine and operator fields.
- **Removed Tabs and Selectors**:
  - Removed the dropdown/selector tab (which switched between standard daily production and custom formats) from the Machine Production view.
  - Removed standard daily logs form, machine/operator efficiency cards, and raw records tables from Machine Production, letting it directly show the dynamic custom logs.
- **Dynamic Columns Integration**:
  - Upgraded both `ProductionDetail.tsx` and `OtherProduction.tsx` to automatically extract all unique custom fields from their filtered formats.
  - Renders all columns dynamically as separate column headers in the entries table and as separate columns in the Excel/PDF/CSV/TXT downloads, resolving the merged "Logged Details" presentation.
- **Efficiency % Calculation**:
  - Added dynamic efficiency mapping logic using `calculateRowEfficiency` inside `ProductionDetail.tsx`.
  - Automatically identifies production achieved (e.g. `production`, `output`) and target quantity keys inside each entry's custom payload, computes the efficiency percentage, and displays it in a dedicated "Efficiency %" column with matching HSL colored `EfficiencyBadge` indicators.
  - Included the dynamic efficiency metrics inside the reports export definitions.

### 30. Dashboard Efficiency Auto-population & Robust Key Matching
- **Dashboard Summary Upgrades**:
  - Refactored `backend/src/routes/dashboard.ts` to fetch report entries for the period, filter them to keep only those with both machine and operator fields, parse their custom payload keys, and merge them case-insensitively by name with the synced `ProductionRecord` table.
  - This guarantees the overall KPI totals and the **Operator Efficiency** and **Machine Efficiency** boards on the dashboard always auto-populate directly based on all logged machine production sheets.
- **Robust Key Parsing Rules**:
  - Upgraded payload key matching logic globally in `ProductionDetail.tsx`, `dashboard.ts`, and `backend/src/utils/sync.ts` to convert keys to lowercase and strip all non-alphanumeric characters (such as parentheses, e.g. converting `PRODUCTION ACHIEVED (MTR)` to `productionachievedmtr`).
  - Utilizes `startsWith` logic so that fields like `PRODUCTION ACHIEVED (MTR)` and `TARGET (MTR)` map correctly to production and target metrics respectively, solving the previous `N/A` rendering bugs.

### 31. Clickable Job Order Numbers & Job Order Summary
- **Backend Summary Endpoint**:
  - Leveraged the `/api/job-orders/by-number/:orderNumber/summary` endpoint in [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to lookup a job order, retrieve all production entries for the active tenant, parse their payloads case-insensitively, sum up the quantities logged against the job order, and return a structured summary.
- **Frontend JobOrderSummary Page**:
  - Created [JobOrderSummary.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderSummary.tsx) to fetch and render the job order summary details (Client Name, Ordered Qty, Total Produced Qty, and Balance Qty) in data-rich KPI cards, alongside a list of all matching daily production entries.
  - Linked the table logs to exports (Excel, PDF, CSV, TXT) using `ExportBar`.
- **Private Route Integration**:
  - Registered `/job-orders/summary/:orderNumber` route in [App.tsx](file:///c:/claude/Saarlekha/frontend/src/App.tsx) inside the private layout context.
- **Clickable Links across Pages**:
  - Integrated React Router `Link` components in [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx), [OtherProduction.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/OtherProduction.tsx), and [ProductionDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ProductionDetail.tsx).
  - Used case-insensitive substring checks (`joborder`, `joborderno`, `jobordernumber`, `order`, etc.) to automatically detect custom job order fields and render their values as links.
  - Added click propagation handlers to prevent row clicks (which edit logs) from blocking navigation.

### 32. Quality Reports Accordion & Grouped Layout
- **Dynamic Partitioning/Grouping**:
  - Refactored [QualityDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/QualityDetail.tsx) to group quality report entries by format version ID (`groupedEntries`) rather than loading them in a single merged table. This prevents table column mismatches where entries have different quality metrics.
- **Collapsible Group Accordions**:
  - Rendered each quality report format as a separate accordion block with its own dynamic column headers matching that exact format's schema.
  - Added individual collapse/expand button toggles on the header bands (`ChevronDown` and `ChevronUp` icons) and local select-all handling per table.
- **Global Actions**:
  - Integrated global **"Expand All"** and **"Collapse All"** action controls at the top-right of the Entries panel to let users quickly toggle all accordion states at once.
- **Export Alignment**:
  - Configured `ExportBar` headers and rows to construct a unified union schema across all matching records, preventing export alignment issues in downloaded files.
- **Bug Fix**:
  - Re-routed data range params inside the `fetchEntries` callback from `startDate: endDate` to `startDate: startDate`, making the date selection filters fully functional.

### 33. Quality Logs Separation & Grouping in Job Order Summary
- **Backend Log Partitioning**:
  - Refactored `GET /by-number/:orderNumber/summary` in [jobOrders.ts](file:///c:/claude/Saarlekha/backend/src/routes/jobOrders.ts) to separate matching report entries into `productionLogs` and `qualityLogs` lists based on the format type (`QUALITY` vs others).
  - Excluded `QUALITY` entries from the `totalProducedQty` sum (as they are check sheets rather than output counts).
  - Returned full format metadata (`id`, `name`, `type`) and `fields_schema` inside the response payloads.
- **Frontend Quality Accordions**:
  - Updated [JobOrderSummary.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderSummary.tsx) to feature a dedicated **Quality Entry Logs** card panel.
  - Grouped Quality logs inside this section by their format schemas and rendered them in separate expandable/collapsable tables to keep headers and data perfectly aligned.
- **Independent Quality Exports**:
  - Configured a dedicated `ExportBar` component in the Quality logs panel.
  - Dynamically builds a union columns schema mapping all matching Quality formats, ensuring aligned CSV, Excel, PDF, and TXT files.

### 34. Search Bar for Job Orders
- **Search Logic & State**:
  - Added a `searchTerm` state to [JobOrderMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/masters/JobOrderMaster.tsx).
  - Extended the `filteredOrders` logic to filter job orders dynamically. It searches across order number, customer name, department name, item description/custom item, status, and any custom column metadata values inside `custom_data`.
- **Search Panel UI**:
  - Integrated a clean search input bar directly above the main table. Renders with a Lucide `Search` icon, clear search controls, and a results counter matching the standard master pages styling.

### 35. Double Columns Glitch Resolution
- **Issue**: Standard reporting views for **Machine Production** and **Other Production** (under "All Formats" mode) showed duplicate `Date` and `Department` columns, as well as duplicate `Logged By` / `By` columns. This was caused by dynamically mapping the list of unique fields (which could contain standard fields saved in DB templates) alongside hardcoded static layout columns.
- **Fix in ProductionDetail**:
  - Modified [ProductionDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/ProductionDetail.tsx) to filter out standard fields (`Date`, `Department`, `Logged By`, `Submitted By`) from the dynamic `displayFields` array when no specific format is selected (`selectedFormatId` is empty).
- **Fix in OtherProduction**:
  - Modified [OtherProduction.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/OtherProduction.tsx) to filter out standard fields from the dynamic `allUniqueFields` array when no specific format is selected.
- **Fix in QualityDetail**:
  - Modified [QualityDetail.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/reports/QualityDetail.tsx) to filter out standard fields from `allUniqueFields` mapped in the general quality export options.
- **Verification**:
  - Successfully ran `npm.cmd run build` to confirm all frontend static builds compile without warnings or errors.

### 36. Production API URL Correction & Android App Compilation (v1.9)
- **Problem**: 
  - Login on mobile failed because the production fallback API domain was set to `https://saarlekha.com/api`.
  - The root domain is hosted on Vercel, which has router rules rewriting all path patterns `/(.*)` (including `/api/*`) to `/index.html` (the SPA layout).
  - This caused the mobile app to receive the HTML page shell instead of the database-backed JSON API responses when logging in.
- **Resolution**:
  - Updated the API base configuration to point directly to `https://api.saarlekha.com/api` (the true production API server hosted on Render).
  - Modified [src/utils/api.ts](file:///c:/claude/Saarlekha/frontend/src/utils/api.ts), [.env](file:///c:/claude/Saarlekha/frontend/.env), and [.env.example](file:///c:/claude/Saarlekha/frontend/.env.example) to use `https://api.saarlekha.com/api`.
- **App Compilation**:
  - Incremented configuration settings in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 10` and `versionName "1.9"`.
  - Compiled and synced production assets with `npm.cmd run build` and `npx.cmd cap sync android`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab).

### 37. Brand Logo Integration (Option 4 / Shield Emblem - v2.0)
- **Asset Generation**:
  - Cropped the selected Option 4 (bottom-right quadrant of `saarlekha_logo_redone_1780663665203.png`, representing the premium glowing shield badge with gear and manpower outlines) to a clean 512x512 PNG asset.
  - Overwrote [logo.png](file:///c:/claude/Saarlekha/frontend/public/logo.png) inside the frontend public asset directory.
- **UI Integration**:
  - Modified [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) to integrate the new brand logo asset across key components:
    - **Login Container**: Placed the logo icon dynamically above the "Saarlekha" heading to personalize the sign-in and registration landing flows.
    - **Sidebar Navigation**: Added a rounded brand icon next to the "Saarlekha" brand text in the desktop/mobile sidebar header layout.
    - **Mobile Top Bar**: Integrated a small logo icon in the sticky top header for consistent mobile identity representation.
- **Compilation**:
  - Bumped configurations in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 11` and `versionName "2.0"`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab).

### 38. Brand Logo Text Cleanup (v2.1)
- **Asset Modification**:
  - Cleaned the small "Option 4" text label at the bottom of the logo badge.
  - Used a Python script with the Pillow library to copy a clean patch of background from the bottom-left of [logo.png](file:///c:/claude/Saarlekha/frontend/public/logo.png) and paste it over the centered text coordinates (`x=175` to `x=335`, `y=455` to `y=490`).
  - This seamlessly removed the text while preserving the exact gradient and texture of the original design.
- **Compilation**:
  - Bumped configurations in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 12` and `versionName "2.1"`.
  - Compiled, synced, and signed the fresh release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab).

### 39. App Launcher Icons Integration (v2.2)
- **Background Color Configuration**:
  - Modified [ic_launcher_background.xml](file:///c:/claude/Saarlekha/frontend/android/app/src/main/res/values/ic_launcher_background.xml) to change the adaptive background color from white (`#FFFFFF`) to `#20303D` (matching the dark background of our brand logo).
- **Launcher Icon Asset Generation**:
  - Wrote a Python script utilizing Pillow to generate the Android launcher assets across all screen density directories (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`):
    - **Standard Icons (`ic_launcher.png`)**: Resized the brand logo with its dark background to standard launcher sizes.
    - **Round Icons (`ic_launcher_round.png`)**: Cropped the standard launcher icons to perfect circles with transparent outer boundaries.
    - **Adaptive Foreground Icons (`ic_launcher_foreground.png`)**: Isolated the glowing shield graphics from the background (making background pixels transparent), downscaled the shield to `65%` of the canvas bounds to align with Android's system safe zone templates, and centered it on a `512x512` transparent canvas before resizing to adaptive density requirements.
- **Compilation**:
  - Bumped build variables in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 13` and `versionName "2.2"`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab).

### 40. Mobile Export and Sharing Support (v2.3)
- **Problem**:
  - The file export feature (Excel, PDF, CSV, TXT) failed inside the native Android mobile app wrapper. Standard browser download mechanisms (using simulated clicks on blob URLs) are blocked or ignored by default in the Android WebView wrapper.
- **Resolution**:
  - Integrated `@capacitor/filesystem` and `@capacitor/share` plugins to handle file writes and system-level file sharing on native platforms.
  - Refactored `export.tsx` to introduce a unified `saveAndShare(blob: Blob, filename: string)` helper:
    - If running on a native platform (using `Capacitor.isNativePlatform()`), the file blob is converted to a base64 string using a `FileReader` helper.
    - The file is written temporarily to the device's native cache directory (`Directory.Cache`) using `Filesystem.writeFile`.
    - Opens the Android native **Share Sheet** (using `Share.share`) by passing the saved file's native URI, letting the user share or save the file via WhatsApp, Email, or Slack (download-then-share).
    - If running on desktop/web browser, it falls back to standard click-to-download popup automatically.
  - Upgraded export handlers:
    - Updated `exportCSV`, `exportTXT`, `exportExcel`, and `exportPDF` to be `async` functions and invoke `saveAndShare`.
    - Modified `exportExcel` to generate a spreadsheet ArrayBuffer using `XLSX.write(wb, { type: 'array' })`, wrapping it in a spreadsheet MIME blob, rather than calling `XLSX.writeFile` directly.
    - Modified `exportPDF` to capture `doc.output('blob')` rather than calling `doc.save()`.
  - Updated all call-sites and event handlers in `Dashboard.tsx` to handle the asynchronous export functions safely.
- **Compilation**:
  - Bumped configurations in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 14` and `versionName "2.3"`.
  - Compiled React/Vite assets via `npm.cmd run build` and synchronized Capacitor Android assets with `npx.cmd cap sync android`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab) using OpenJDK 21.

### 41. App Rename to SaarLekha - Operations Reporting (v2.4)
- **Problem**:
  - The application branding and display name was unified to match the formal product title "SaarLekha - Operations Reporting".
- **Resolution**:
  - Modified `strings.xml` in the Android resources to set `app_name` and `title_activity_main` to `SaarLekha - Operations Reporting`.
  - Updated `capacitor.config.ts` to configure `appName` as `SaarLekha - Operations Reporting`.
  - Modified `index.html` to update browser `<title>` and `<meta name="apple-mobile-web-app-title">` to `SaarLekha - Operations Reporting`.
  - Updated the PWA configuration parameters in `vite.config.ts` to name the app `SaarLekha - Operations Reporting` and specify `short_name` as `SaarLekha`.
  - Refactored brand logos and layout text rendering in `Layout.tsx` and `export.tsx` to align with the correct `SaarLekha` case formatting.
- **Compilation**:
  - Bumped configurations in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 15` and `versionName "2.4"`.
  - Re-compiled React/Vite assets via `npm.cmd run build` and synchronized Capacitor Android assets with `npx.cmd cap sync android`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab) using Gradle.

### 42. Fresh Build with Version Code 16 (v2.5)
- **Compilation**:
  - Bumped configurations in [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) to `versionCode 16` and `versionName "2.5"`.
  - Re-compiled React/Vite assets via `npm.cmd run build` and synchronized Capacitor Android assets with `npx.cmd cap sync android`.
  - Compiled and signed the release Android App Bundle: [app-release.aab](file:///c:/claude/Saarlekha/frontend/android/app/build/outputs/bundle/release/app-release.aab) using Gradle.

### 43. Dashboard Performance & Security Fixes
- **RLS Client Wrapper Optimization**:
  - Replaced the entire contents of [prisma.ts](file:///c:/claude/Saarlekha/backend/src/db/prisma.ts) with an optimized extension that executes RLS tenant context parameters (`app.current_tenant_id` and `app.current_user_role`) in a single execution statement instead of multiple sequential raw queries.
  - Incorporated `AsyncLocalStorage` to bypass RLS re-wrapping if a query is already inside an active RLS transaction, preventing infinite recursion and redundant round-trips.
- **Secrets Clean-up**:
  - Removed all hardcoded database passwords (specifically the leaked Neon credentials) from `prisma.ts` and from all automated test suites:
    - [onboard-rls.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/onboard-rls.test.ts)
    - [rls-audit.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-audit.test.ts)
    - [rls-invite.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-invite.test.ts)
    - [rls-user.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-user.test.ts)
    - [rls-writes.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls-writes.test.ts)
    - [rls.test.ts](file:///c:/claude/Saarlekha/backend/src/tests/rls.test.ts)
  - Configured test files to dynamically replace connection credentials using a generic regular expression, and added `APP_DATABASE_URL` check.
  - Documented placeholders in [.env.example](file:///c:/claude/Saarlekha/backend/.env.example) and declared the new `PG_POOL_MAX` parameter.
- **Dashboard Summary Optimization**:
  - Refactored [dashboard.ts](file:///c:/claude/Saarlekha/backend/src/routes/dashboard.ts) to wrap all `/summary` reads in a single transaction block. All queries execute on the transaction client argument `tx`, reducing context switching and database round-trips to just one.
  - Replaced the unpaginated JavaScript filter for latest maintenance statuses with a high-performance raw SQL query using `DISTINCT ON (re.payload->>'_machine_id')`, avoiding massive records loads.
- **Performance Database Indexes**:
  - Added indexes to critical tables in [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma) and generated/applied migration `perf_indexes`.
  - Added a fallback SQL script [add_performance_indexes.sql](file:///c:/claude/Saarlekha/backend/prisma/manual/add_performance_indexes.sql) for manual applications.
- **Validation**:
  - Verified successful compilation via `npm run build`.
  - Confirmed the RLS test suites pass successfully.

### 44. Company Data Retention, Archiving & Health Check Updates
- **Company Settings Data Retention Policy**:
  - Updated the database schema [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma) to add `retention_days Int?` in the `Company` model and successfully migrated the DB.
  - Updated the edit company endpoint `PUT /api/companies/:id` in [companies.ts](file:///c:/claude/Saarlekha/backend/src/routes/companies.ts) to support saving the policy setting.
  - Updated the frontend company details editor inside [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx) to render a dropdown mapping standard periods (30 Days, 90 Days, 180 Days, 1 Year, 2 Years, or Indefinite).
- **Data Archiving & Purging Logic**:
  - Created status endpoint `GET /api/companies/:id/retention-status` to calculate the cutoff date based on company retention days and return counts of archivable entries and production logs.
  - Created archive endpoint `GET /api/companies/:id/archive-data` that queries historical logs and returns a downloadable structured JSON file payload representing the archive content.
  - Created purge endpoint `POST /api/companies/:id/purge-data` to permanently delete records older than the cutoff date within a transaction, creating a `DELETE` audit log entry.
  - Integrated the status information, copyable/downloadable file trigger (`handleDownload` via Axios blob), and red Purge Database verification workflow directly inside `CompaniesTab.tsx` for admin roles.
- **Database-backed Health Check**:
  - Refactored health endpoints `/api/health` and `/health` in [index.ts](file:///c:/claude/Saarlekha/backend/src/index.ts) to perform a real `SELECT 1` query using `prisma.$queryRaw` to check actual database connectivity, helping keep Neon compute units awake on ping schedules.
- **Verification**:
  - Verified successful build compilation for both backend (`tsc`) and frontend (`vite build`).

### 45. Subscription Enforcement & Capacity Limits
- **Prisma Database Upgrades**:
  - Added enum type `SubscriptionTier` (with values `STARTER`, `GROWTH`, `ENTERPRISE`) and the `subscription_tier` field on the `Company` model (defaulting to `STARTER`) inside [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma).
  - Automatically generated and applied the database schema migration `add_subscription_tier` to the live PostgreSQL database.
- **Subscription Limits Helper**:
  - Created [subscription.ts](file:///c:/claude/Saarlekha/backend/src/utils/subscription.ts) defining standard tier capacities (`STARTER` has 30 workers and 5 machines, `GROWTH` has 150 workers and 25 machines, and `ENTERPRISE` has unlimited capacity).
  - Exposes `verifySubscriptionLimit` which counts existing workers/machines for the company and raises a `403 Forbidden` error if adding more exceeds the company's tier limits.
- **Backend Enforcements**:
  - Integrated limit checks in the manpower creation endpoint `POST /api/manpower` inside [manpower.ts](file:///c:/claude/Saarlekha/backend/src/routes/manpower.ts).
  - Integrated limit checks in the machine creation endpoint `POST /api/machines` inside [machines.ts](file:///c:/claude/Saarlekha/backend/src/routes/machines.ts) for both single and batch inserts.
  - Restructured `companiesRouter.post('/')` (Onboard Company) and `companiesRouter.put('/:id')` in [companies.ts](file:///c:/claude/Saarlekha/backend/src/routes/companies.ts) to support the `subscription_tier` parameter, securing the update endpoint so only `SUPER_ADMIN` accounts can change a company's tier.
- **Frontend Controls**:
  - Added subscription tier selection dropdowns to both the Onboard Company and Edit Company modals for Super Admin accounts inside [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx).
  - Rendered beautiful, clear badge indicators on the company card detail lists showing their active subscription tier (Starter, Growth, or Enterprise).
- **Verification**:
  - Successfully verified compile type safety by running full production builds for both backend (`prisma generate && tsc`) and frontend (`vite build`).

### 46. Super Admin Sidebar Subscription Details
- **Super Admin Landing Page & Selected Company Views**:
  - Updated [Layout.tsx](file:///c:/claude/Saarlekha/frontend/src/components/Layout.tsx) to fetch the list of all companies continuously every 4 seconds for `SUPER_ADMIN` accounts.
  - Implemented the "Subscription Tiers" summary widget in the sidebar on the landing page (`!selectedCompanyId`), showing breakdown counts of companies in each tier (Starter, Growth, Enterprise).
  - Implemented a detailed "Subscription Detail" card in the sidebar when a company is selected (`selectedCompanyId` is present), displaying the active company's subscription tier and resource limits (Manpower and Machine limits).
- **Verification**:
  - Successfully verified compilation by building Vite/React production assets via `cmd /c npm run build` (built in 1.29s).
  - Pushed the layout changes to the remote repository, triggering Vercel/Render automatic redeployments.

### 48. Razorpay Payment Gateway, Link Redirection, and Administrative Selection Reversion
- **Reversion of Registration Tier Requirements & Redesigned Administrative Selector**:
  - Reverted the registration form [Register.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/auth/Register.tsx) to its previous clean credential/Google authentication layout. New users are no longer required to select a tier, and default to the `STARTER` plan on onboarding.
  - Restored the **Subscription Tier** select dropdown inside the **Onboard New Company** modal in [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx), placing control back in the hands of the Super Admin.
  - Completely redesigned the subscription tier selection inside the **Edit Company Details** form in [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx) into a gorgeous tabbed view. The editor is split into:
    1. **General Details**: Name, Address, GST, Contact Name, Email, Phone, and Data Retention Policy.
    2. **Subscription Plan**: Shows a list of all plans (Starter, Growth, Enterprise) featuring their pricing details, capacity resource limits (Workers/Machines limits), complete features checks (e.g. dynamic columns, custom exports, support priority), inline selection toggle status state markers, and interactive payment link generator buttons.
- **Razorpay Payments Integration (Backend)**:
  - Created a database model `Payment` inside [schema.prisma](file:///c:/claude/Saarlekha/backend/prisma/schema.prisma) tracking transaction amounts, currencies, statuses (`PENDING`, `SUCCESS`, `FAILED`), Razorpay order, payment, signature, and link references.
  - Implemented [payments.ts](file:///c:/claude/Saarlekha/backend/src/routes/payments.ts) with endpoints:
    - `POST /create-order`: Initializes standard Razorpay Order IDs for client-side SDK checkouts, or calls `razorpay.paymentLink.create()` to generate shareable link URLs. Supports developer fallback mock keys (`rzp_test_mockkeyid123`).
    - `POST /verify`: Performs SHA256 HMAC cryptographic verification on direct checkout signatures before committing upgrades inside a database transaction.
    - `GET /verify-link`: Queries the Razorpay API for remote payment link status checks during redirections.
    - `GET /history/:companyId`: Pulls transaction logging records for accounting verification.
- **Subscription Master View (Company Admin)**:
  - Developed [SubscriptionMaster.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/SubscriptionMaster.tsx) featuring visual utilization capacity progress bars tracking manpower and machine allocations.
  - Integrated dynamic script loading for `https://checkout.razorpay.com/v1/checkout.js` inside the inline purchase handlers.
  - Added payment action cards for **Growth** and **Enterprise** subscriptions, offering toggles to pay online with Razorpay SDK or generate shareable payment links.
  - Added a responsive transaction history table at the bottom of the page showing dates, currencies, amounts, order identifiers, payment codes, and success/failed badges.
- **Copyable Links & Callback Gateways (Super Admin & Redirects)**:
  - Added a **"Payment Link"** button on company landing cards in [CompaniesTab.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/CompaniesTab.tsx), spawning an interactive dialog modal allowing Super Admins to select a plan, trigger the backend create link routine, and copy the link.
  - Registered [SubscriptionCallback.tsx](file:///c:/claude/Saarlekha/frontend/src/pages/admin/SubscriptionCallback.tsx) at `/subscription-callback` to process link callback redirects, fetching link status checks and showing user-friendly success/failed state displays.
- **Verification**:
  - Built Vite/React production assets via `cmd /c npm run build` successfully.
  - Pushed changes to GitHub repository, triggering Vercel/Render automatic redeployments.







