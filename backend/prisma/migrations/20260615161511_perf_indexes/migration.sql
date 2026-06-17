-- CreateIndex
CREATE INDEX "ProductionRecord_company_id_operator_id_date_idx" ON "ProductionRecord"("company_id", "operator_id", "date");

-- CreateIndex
CREATE INDEX "ProductionRecord_company_id_machine_id_date_idx" ON "ProductionRecord"("company_id", "machine_id", "date");

-- CreateIndex
CREATE INDEX "ReportEntry_company_id_format_version_id_idx" ON "ReportEntry"("company_id", "format_version_id");

-- CreateIndex
CREATE INDEX "Token_expires_at_idx" ON "Token"("expires_at");

-- CreateIndex
CREATE INDEX "Token_user_id_type_idx" ON "Token"("user_id", "type");
