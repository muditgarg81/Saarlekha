# Implementation Plan — "Carry Forward" Field Type (Repeat Previous Value)

Add a new dynamic field data type to the Report Builder that **pre-fills a new
data entry with the previously entered value** of a selected field, while keeping
the field fully **editable (amendable)**. It supports an underlying base type
(figure/number, text, or date) chosen at design time.

This is distinct from the existing `calculated` type: a calculated field is always
re-derived and is read-only; a **carry-forward field is only seeded once as a
default and then behaves as a normal stored value the user can change.** The
server must never recompute or overwrite a carry-forward value after the user has
set it.

---

## User Review Required

> [!IMPORTANT]
> **Source of the "previous" value (default behaviour being implemented):**
> 1. **Within the current batch/session** — a new row carries forward the value
>    from the **immediately preceding row** in the same data-entry batch.
> 2. **First row of the batch** — carries forward from the **most recent saved
>    `ReportEntry`** of this format (ordered by `entryDate` desc, then
>    `createdAt` desc), scoped to the current tenant.
> 3. **No prior value exists** — the field renders blank.

> [!IMPORTANT]
> **Configurable options on the field (design-time):**
> - **Base Type**: `number` | `text` | `date` — controls input rendering,
>   validation, and the optional unit.
> - **Source Field** (default = *this field itself*): allows mirroring another
>   field's previous value, e.g. `Opening (Mtr)` carries forward the previous
>   entry's `Production`. The dropdown lists other fields in the same format.

> [!IMPORTANT]
> **Optional (Phase 2, ship core first):** **Carry Scope** — instead of "last
> entry overall", match the last entry sharing the same value of a chosen *key*
> field (e.g. carry forward the last value **for the same Job Order**). Default
> scope is "last entry overall". Implement the field config now but the keyed
> lookup can follow in a second pass.

---

## Proposed Changes

### 1. Field schema & types

Field definitions are stored as JSON inside `ReportFormat.schema`, so **no Prisma
migration is required** unless a DB enum constrains the field type — verify and,
if such an enum exists, extend it. Otherwise only TypeScript types and validation
change.

#### [MODIFY] field type definitions (e.g. `backend/src/utils/fields.ts` and the matching frontend types)
- Extend the `FieldType` union with `'carry_forward'`.
- Extend the `FieldDefinition` interface with carry-forward config:
  ```typescript
  type FieldType =
    | 'text' | 'number' | 'date' | 'dropdown' | 'yes_no'
    | 'photo' | 'calculated' | 'operator' | 'machine'
    | 'carry_forward';                       // NEW

  interface FieldDefinition {
    id: string;
    name: string;
    type: FieldType;
    unit?: string;
    options?: string[];
    formula?: string;
    isSystem?: boolean;
    // --- carry_forward config ---
    carryBaseType?: 'number' | 'text' | 'date'; // how value is rendered/validated
    carrySourceFieldId?: string;                // default: own id (self)
    carryScopeFieldId?: string;                 // Phase 2: key field for scoped lookup
  }
  ```

### 2. Backend

#### [NEW] `GET /api/reports/formats/:formatId/last-value`
Returns the most recent stored value to seed a carry-forward field. Tenant-scoped
through the existing RLS transaction wrapper (`withTenant`).
- **Query params**: `sourceFieldId` (required), and Phase 2 `scopeFieldId` +
  `scopeValue` (optional).
- **Logic**: find the latest `ReportEntry` for `formatId` (ordered `entryDate`
  desc, `createdAt` desc); if `scopeFieldId`/`scopeValue` provided, filter to
  entries whose `values[scopeFieldId] == scopeValue`. Return
  `{ value: values[sourceFieldId] ?? null }`.
- Must respect tenant isolation; never read another company's entries.

#### [MODIFY] entry create route (`backend/src/routes/reports.ts`, `POST /entries`)
- In the loop that computes `calculated` fields server-side, **explicitly skip
  `carry_forward` fields** — store whatever value the client submitted, unchanged.
  Carry-forward is a client-seeded default, not a server-derived value.
- Validate the submitted value against `carryBaseType` (numeric for `number`,
  parseable date for `date`); reject malformed numbers/dates with a 400.

### 3. Frontend — Report Builder (Add/Edit Format)

#### [MODIFY] the field editor / "Add Field" form (the Report Builder component)
- Add **"Carry Forward (repeat previous value)"** as an option in the **Data Type**
  dropdown.
- When selected, reveal extra controls in the Add Field row and in the per-field
  edit panel:
  - **Base Type** select: Number / Text / Date.
  - **Source Field** select: defaults to **"This field"**; also lists the other
    fields in the current format (by name → id) so it can mirror another field.
  - **Unit (Optional)**: keep, relevant when Base Type = Number.
  - *(Phase 2)* **Carry Scope** select: "Last entry overall" (default) or one of
    the format's fields as the key.
- Render a badge/tag on the field row consistent with the existing tags
  (`STANDARD`, `NUMBER`, `JOB_ORDER`, …), e.g. **`CARRY FWD`**.
- Persist the new config props into the format `schema` JSON. Saving the format
  bumps its version (existing behaviour) — confirm older entries are unaffected
  because each `ReportEntry` keeps its own `schemaSnapshot`.

### 4. Frontend — Data Log Entry

#### [MODIFY] the Data Entry / batch logger component
- On rendering a `carry_forward` field for a **new row**, resolve the seed value:
  - If a preceding row exists in the current batch, copy that row's value of the
    configured **source field**.
  - Else call `GET /reports/formats/:formatId/last-value?sourceFieldId=...` to seed
    from the last saved entry.
  - Else leave blank.
- Render the input using the **Base Type** (number input + unit, text input, or
  date picker) — **always editable**.
- Show a subtle, non-blocking hint that the value was carried forward and can be
  changed (e.g. helper text "Carried forward — editable", and an indicator if the
  user has amended it from the seeded value).
- The (possibly amended) value is submitted like any normal field value; do not
  send a "recompute" flag.

---

## Behaviour rules (acceptance semantics)

1. A carry-forward field is **seeded once** when a row is created and is then a
   normal editable value. Re-opening or editing a saved entry shows the **stored**
   value, never a re-seeded one.
2. Editing the seeded value and saving makes **that amended value** the one future
   entries carry forward.
3. `source field = self` repeats the field's own last value; a different source
   field mirrors that field's last value (e.g. Opening = previous Production).
4. First-ever entry for a format/field → blank seed.
5. Carry-forward values appear in tables, dashboards, and exports exactly like
   normal stored values.
6. Tenant isolation: seeding only ever reads the current company's entries.

---

## Verification Plan

### Automated
- Backend build: `npm run build` in `backend/`.
- Frontend build: `npm run build` in `frontend/`.
- (If a DB enum was extended) `npx prisma migrate dev --name add_carry_forward_field`.

### Manual
1. **Design**: In `FABRIC PRODUCTION`, add a field "Last Production (Mtr)", Data
   Type = **Carry Forward**, Base Type = Number, Source Field = **This field**,
   Unit = Mtr. Save (version bumps).
2. **Seed from previous entry**: Log entry 1 with the field = 100. Start entry 2 →
   the field pre-fills **100** and is editable. Change to 120, save. Start entry 3
   → it pre-fills **120**.
3. **Within-batch carry**: In a multi-row batch, set row 1's field; confirm row 2
   pre-fills from row 1, and remains editable.
4. **Mirror another field**: Add "Opening (Mtr)" with Source Field = **Production**.
   Confirm a new entry seeds Opening with the previous entry's Production value.
5. **First entry**: On a fresh format, confirm the carry-forward field is blank.
6. **No overwrite**: Save an amended value, reload the saved entry, confirm the
   amended value persists (server did not recompute it).
7. **Isolation**: As a different company, confirm seeding does not surface the
   first company's values.
