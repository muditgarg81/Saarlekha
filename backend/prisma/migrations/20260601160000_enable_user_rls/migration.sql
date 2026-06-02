-- Enable RLS and Force RLS on User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

-- Drop old policy if any exists
DROP POLICY IF EXISTS tenant_isolation_user ON "User";

-- Create policy for User
CREATE POLICY tenant_isolation_user ON "User" FOR ALL
  USING (
    ("company_id" = current_setting('app.current_tenant_id', true)::text) OR
    ("email" = current_setting('app.login_email', true)::text) OR
    ("google_id" = current_setting('app.login_google_id', true)::text) OR
    ("id" = current_setting('app.login_user_id', true)::text)
  )
  WITH CHECK (
    ("company_id" = current_setting('app.current_tenant_id', true)::text) OR
    ("email" = current_setting('app.login_email', true)::text) OR
    ("google_id" = current_setting('app.login_google_id', true)::text) OR
    ("id" = current_setting('app.login_user_id', true)::text)
  );
