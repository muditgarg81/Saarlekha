-- Enable RLS and Force RLS
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Manpower" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Manpower" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" FORCE ROW LEVEL SECURITY;

ALTER TABLE "ReportFormat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportFormat" FORCE ROW LEVEL SECURITY;

ALTER TABLE "ReportFormatVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportFormatVersion" FORCE ROW LEVEL SECURITY;

ALTER TABLE "ReportEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportEntry" FORCE ROW LEVEL SECURITY;

ALTER TABLE "JobOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobOrder" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Machine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Machine" FORCE ROW LEVEL SECURITY;

ALTER TABLE "ProductionRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionRecord" FORCE ROW LEVEL SECURITY;

ALTER TABLE "AuditLogEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLogEntry" FORCE ROW LEVEL SECURITY;

ALTER TABLE "MaintenanceTypeOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceTypeOption" FORCE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policies
CREATE POLICY tenant_isolation_department ON "Department" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_manpower ON "Manpower" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_customer ON "Customer" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_item ON "Item" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_reportformat ON "ReportFormat" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_reportformatversion ON "ReportFormatVersion" FOR ALL USING (
  "format_id" IN (SELECT id FROM "ReportFormat" WHERE "company_id" = current_setting('app.current_tenant_id', true)::text)
);
CREATE POLICY tenant_isolation_reportentry ON "ReportEntry" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_joborder ON "JobOrder" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_machine ON "Machine" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_productionrecord ON "ProductionRecord" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
CREATE POLICY tenant_isolation_auditlogentry ON "AuditLogEntry" FOR ALL USING (
  "company_id" IS NULL OR "company_id" = current_setting('app.current_tenant_id', true)::text
);
CREATE POLICY tenant_isolation_maintenancetypeoption ON "MaintenanceTypeOption" FOR ALL USING ("company_id" = current_setting('app.current_tenant_id', true)::text);
