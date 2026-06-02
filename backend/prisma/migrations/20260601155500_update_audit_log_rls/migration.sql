-- Drop old audit log policy
DROP POLICY IF EXISTS tenant_isolation_auditlogentry ON "AuditLogEntry";

-- Re-create audit log policy with stricter rules
CREATE POLICY tenant_isolation_auditlogentry ON "AuditLogEntry" FOR ALL
  USING (
    ("company_id" = current_setting('app.current_tenant_id', true)::text) OR
    ("company_id" IS NULL AND current_setting('app.current_user_role', true)::text = 'SUPER_ADMIN')
  )
  WITH CHECK (
    ("company_id" = current_setting('app.current_tenant_id', true)::text) OR
    ("company_id" IS NULL AND current_setting('app.current_user_role', true)::text = 'SUPER_ADMIN')
  );
