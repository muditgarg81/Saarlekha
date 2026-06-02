-- Drop old policies
DROP POLICY IF EXISTS tenant_isolation_department ON "Department";
DROP POLICY IF EXISTS tenant_isolation_manpower ON "Manpower";
DROP POLICY IF EXISTS tenant_isolation_customer ON "Customer";
DROP POLICY IF EXISTS tenant_isolation_item ON "Item";
DROP POLICY IF EXISTS tenant_isolation_reportformat ON "ReportFormat";
DROP POLICY IF EXISTS tenant_isolation_reportformatversion ON "ReportFormatVersion";
DROP POLICY IF EXISTS tenant_isolation_reportentry ON "ReportEntry";
DROP POLICY IF EXISTS tenant_isolation_joborder ON "JobOrder";
DROP POLICY IF EXISTS tenant_isolation_machine ON "Machine";
DROP POLICY IF EXISTS tenant_isolation_productionrecord ON "ProductionRecord";
DROP POLICY IF EXISTS tenant_isolation_auditlogentry ON "AuditLogEntry";
DROP POLICY IF EXISTS tenant_isolation_maintenancetypeoption ON "MaintenanceTypeOption";

-- Re-create policies with WITH CHECK clause
CREATE POLICY tenant_isolation_department ON "Department" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_manpower ON "Manpower" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_customer ON "Customer" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_item ON "Item" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_reportformat ON "ReportFormat" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_reportformatversion ON "ReportFormatVersion" FOR ALL 
  USING ("format_id" IN (SELECT id FROM "ReportFormat" WHERE "company_id" = current_setting('app.current_tenant_id', true)::text))
  WITH CHECK ("format_id" IN (SELECT id FROM "ReportFormat" WHERE "company_id" = current_setting('app.current_tenant_id', true)::text));

CREATE POLICY tenant_isolation_reportentry ON "ReportEntry" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_joborder ON "JobOrder" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_machine ON "Machine" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_productionrecord ON "ProductionRecord" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_auditlogentry ON "AuditLogEntry" FOR ALL 
  USING ("company_id" IS NULL OR "company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" IS NULL OR "company_id" = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_isolation_maintenancetypeoption ON "MaintenanceTypeOption" FOR ALL 
  USING ("company_id" = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK ("company_id" = current_setting('app.current_tenant_id', true)::text);
