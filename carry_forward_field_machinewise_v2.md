# Implementation Plan v2 — "Carry Forward" Field Type, Machine-Wise (Scoped)

Add a new dynamic field data type to the Report Builder that **pre-fills a new
data entry with the previously entered value of a selected field, for the same
machine** (or other key) — while keeping the field fully **editable (amendable)**.

> **Supersedes v1.** The change from v1 is that the "previous value" lookup is
> **scoped to a key field (the machine) by default**, not "last entry overall".

**Canonical use case (from the Loom Production format):** `Opening reading` should
auto-fill with the **previous `Closing reading` for that same `Loom Number`**, and
the operator can still amend it.

This is distinct from `calculated`: a calculated field is always re-derived and
read-only. **A carry-forward field is seeded once as a default and then behaves as
a normal stored, editable value.** The server must never recompute or overwrite a
carry-forward value after the user has set it.

---

## User Review Required

> [!IMPORTANT]
> **Default behaviour being implemented — machine-wise carry forward:**
> A carry-forward field reproduces the **most recent value of its Source Field for
> the same machine**, resolved as the latest of:
> 1. earlier rows in the **current batch** whose machine value matches, and
> 2. the most recent **saved `ReportEntry`** whose machine value matches.
> If neither exists (first time for that machine) → blank seed. The value is
> always editable.

> [!IMPORTANT]
> **Field configuration (design-time):**
> - **Source Field** — the field whose previous value to reproduce (default = this
>   field itself). For the loom case, set Source Field = `Closing reading`.
> - **Carry Scope** — how "previous" is keyed:
>   - **Per machine** *(default)* — keyed to the format's `machine`-type field
>     (e.g. `Loom Number`). Auto-detected; if the format has more than one machine
>     field, the designer picks which one.
>   - **Per field** — keyed to any chosen field (e.g. Operator, Job Order).
>   - **Last entry overall** — unscoped fallback.
> - **Base Type** — `number` | `text` | `date` (drives input + validation; should
>   match the Source Field's type).
> - **Unit (Optional)** — as today, relevant when Base Type = Number.

> [!IMPORTANT]
> **Seed timing:** because the seed depends on the machine, a carry-forward field
> stays **blank until the row's machine field is filled**, and **re-resolves if the
> machine on that row is changed** (a value tied to the previously selected machine
> no longer applies).

> [!IMPORTANT]
> **Warn before discarding edits on machine change:** if the operator changes the
> machine on a row where a carry-forward field holds a value they **manually
> amended** (i.e. it differs from the seed), show a **confirmation dialog** before
> replacing it:
> - **Confirm** → re-resolve the carry-forward fields for the new machine.
> - **Cancel** → revert the machine field to its previous value and keep all entered
>   values untouched.
>
> If no amended value would be lost (carry-forward fields are still the untouched
> seed or empty), re-resolve **silently** — do not nag the operator when nothing is
> at risk.

---

## Proposed Changes

### 1. Field schema & types

Field definitions live as JSON in `ReportFormat.schema`, so **no Prisma migration
is required** unless a DB enum constrains field type — verify and extend if so.

#### [MODIFY] field type definitions (`backend/src/utils/fields.ts` + matching frontend types)
- Extend the `FieldType` union with `'carry_forward'`.
- Extend `FieldDefinition`:
  ```typescript
  interface FieldDefinition {
    id: string;
    name: string;
    type: FieldType;                 // add 'carry_forward'
    unit?: string;
    options?: string[];
    formula?: string;
    isSystem?: boolean;
    // --- carry_forward config ---
    carryBaseType?: 'number' | 'text' | 'date';
    carrySourceFieldId?: string;     // default: own id (self)
    carryScope?: 'machine' | 'field' | 'overall';   // default: 'machine' if a machine field exists
    carryScopeFieldId?: string;      // the key field id (the machine field); required for 'machine'/'field'
  }
  ```

### 2. Backend

#### [NEW] `GET /api/reports/formats/:formatId/last-value`
Returns the value to seed a carry-forward field, tenant-scoped via the existing
`withTenant` RLS wrapper.
- **Query params**: `sourceFieldId` (required); `scopeFieldId` + `scopeValue`
  (required when scope is machine/field).
- **Logic**: query `ReportEntry` for `formatId`, filtered by the scope key, newest
  first, take 1, return `{ value: values[sourceFieldId] ?? null }`.
  - Filter on the JSON `values` column by path — in Prisma/Postgres:
    ```typescript
    where: {
      formatId,
      ...(scopeFieldId && scopeValue !== undefined
        ? { values: { path: [scopeFieldId], equals: scopeValue } }
        : {}),
    },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    ```
  - Never read another tenant's entries (RLS already enforces this).

#### [MODIFY] entry create route (`backend/src/routes/reports.ts`, `POST /entries`)
- In the loop that computes `calculated` fields, **explicitly skip
  `carry_forward` fields** — persist the client-submitted value unchanged.
- Validate each carry-forward value against `carryBaseType` (numeric for `number`,
  parseable date for `date`); 400 on malformed input.

### 3. Frontend — Report Builder (Add/Edit Format)

#### [MODIFY] the field editor / "Add Field" form
- Add **"Carry Forward (previous value)"** to the **Data Type** dropdown.
- When selected, reveal:
  - **Source Field** select — "This field" (default) + other fields in the format.
  - **Carry Scope** select — **Per machine** (default, pre-selecting the format's
    `machine`-type field; if >1, show a machine-field picker), Per field (key-field
    picker), or Last entry overall.
  - **Base Type** select (Number/Text/Date) and **Unit (Optional)**.
- Persist config into the format `schema` JSON; saving bumps the format version
  (existing behaviour). Older `ReportEntry` rows are unaffected — each keeps its own
  `schemaSnapshot`.
- Render a badge on the field row, e.g. **`CARRY FWD`**, and optionally a hint
  line like the calculated field's, e.g.
  *"Carry: previous Closing reading · per Loom Number"*.

### 4. Frontend — Data Log Entry

#### [MODIFY] the Data Entry / batch logger
For each `carry_forward` field on a row:
- **Resolve the seed only once the row's scope field (machine) has a value.** Until
  then show a placeholder such as "Select machine first".
- **Seed source = latest of:** (a) the closest *earlier* row in the current batch
  whose scope field matches this row's scope value — take its Source Field value;
  else (b) `GET /reports/formats/:formatId/last-value` with `sourceFieldId`,
  `scopeFieldId`, `scopeValue`. Else blank.
- **Reactivity (with warning):** if the operator changes the machine on the row:
  - If any carry-forward field on that row holds a **manually amended** value, show
    a confirmation dialog (e.g. *"Change machine to {new}? The opening/carried values
    you entered for {old} will be replaced with {new}'s previous readings."*).
    **Confirm** re-resolves the seeds for the new machine; **Cancel** reverts the
    machine selection and keeps the entered values.
  - If the carry-forward fields are still the untouched seed (or empty), re-resolve
    silently for the new machine — no dialog.
- Render with the Base Type (numeric input + unit / text / date), **always
  editable**. Show a subtle "carried forward — editable" hint, and indicate when the
  user has amended it from the seeded value.
- Submit the (possibly amended) value as a normal field value — no recompute flag.

---

## Behaviour rules (acceptance semantics)

1. A carry-forward field is **seeded once per row** (reactively, after the machine
   is known) and is thereafter a normal editable value. Re-opening a saved entry
   shows the **stored** value, never a re-seeded one.
2. The seed is the **most recent Source Field value for the same machine** (batch
   rows ahead of saved entries when both match).
3. An amended value, once saved, becomes the value future entries for that machine
   carry forward.
4. Changing the machine on an unsaved row re-resolves the seed for the new machine,
   **after a confirmation dialog if doing so would discard a manually amended
   carry-forward value** (silent re-resolve when nothing entered would be lost).
5. First entry for a given machine → blank seed.
6. Carry-forward values appear in tables, dashboards, and exports like normal
   stored values.
7. Tenant isolation: seeding reads only the current company's entries.

---

## Verification Plan

### Automated
- Backend build: `npm run build` in `backend/`.
- Frontend build: `npm run build` in `frontend/`.
- (If a DB enum was extended) `npx prisma migrate dev --name add_carry_forward_field`.

### Manual (Loom Production format)
1. **Configure**: Edit `Opening reading` → Data Type = **Carry Forward**, Source
   Field = **Closing reading**, Carry Scope = **Per machine** (Loom Number), Base
   Type = Number, Unit = Mtr. Save (version bumps).
2. **Machine-wise seed**: Log Loom 5 with Closing reading = 1,000. Start a new
   entry, select **Loom 5** → `Opening reading` pre-fills **1,000**, editable.
3. **Different machine isolates**: In the same new entry flow, select **Loom 8**
   (which last closed at 500) → Opening re-resolves to **500**, not 1,000.
4. **Interleaved looms**: Log Loom 5 (close 1,200) then Loom 8 (close 600); a later
   Loom 5 entry seeds **1,200** and a later Loom 8 entry seeds **600**.
5. **Within batch**: In one batch, add a Loom 5 row (close 1,300), then another
   Loom 5 row → its Opening seeds **1,300** from the earlier batch row.
6. **First time**: Select a loom with no history → Opening is blank.
7. **No overwrite**: Amend a seeded Opening, save, reload the entry → the amended
   value persists (server did not recompute it).
8. **Change machine — warn when an edit is at risk**: On an unsaved row, seed
   Opening for Loom 5 and **amend it** (e.g. type 1,050). Switch to Loom 8 → a
   **confirmation dialog appears**. Confirm → Opening re-resolves to Loom 8's
   previous reading.
9. **Change machine — cancel reverts**: Repeat step 8 but **Cancel** the dialog →
   the machine stays Loom 5 and the amended 1,050 is preserved.
10. **Change machine — no warning when untouched**: Seed Opening for Loom 5 but do
    **not** edit it; switch to Loom 8 → it re-resolves **silently**, no dialog.
11. **Isolation**: As another company, confirm no seeding from this company's data.
