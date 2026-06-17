-- Expression index speeds up the dashboard maintenance query's
-- `payload->>'_machine_id' IS NOT NULL` filter and ORDER BY, which previously
-- forced a sequential scan since JSON extraction isn't covered by a btree
-- index on the raw column. No data or query results change.
CREATE INDEX "ReportEntry_payload_machine_id_idx" ON "ReportEntry" ((payload->>'_machine_id'));
