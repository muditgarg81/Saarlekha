-- CreateIndex
CREATE INDEX "AuditLogEntry_company_id_timestamp_idx" ON "AuditLogEntry"("company_id", "timestamp");

-- CreateIndex
CREATE INDEX "Customer_company_id_idx" ON "Customer"("company_id");

-- CreateIndex
CREATE INDEX "JobOrder_company_id_status_idx" ON "JobOrder"("company_id", "status");

-- CreateIndex
CREATE INDEX "JobOrder_customer_id_idx" ON "JobOrder"("customer_id");

-- CreateIndex
CREATE INDEX "Machine_company_id_idx" ON "Machine"("company_id");

-- CreateIndex
CREATE INDEX "Machine_department_id_idx" ON "Machine"("department_id");

-- CreateIndex
CREATE INDEX "Manpower_company_id_idx" ON "Manpower"("company_id");

-- CreateIndex
CREATE INDEX "Manpower_department_id_idx" ON "Manpower"("department_id");

-- CreateIndex
CREATE INDEX "ProductionRecord_company_id_date_idx" ON "ProductionRecord"("company_id", "date");

-- CreateIndex
CREATE INDEX "ProductionRecord_operator_id_idx" ON "ProductionRecord"("operator_id");

-- CreateIndex
CREATE INDEX "ProductionRecord_machine_id_idx" ON "ProductionRecord"("machine_id");

-- CreateIndex
CREATE INDEX "ReportEntry_company_id_entry_date_idx" ON "ReportEntry"("company_id", "entry_date");

-- CreateIndex
CREATE INDEX "ReportEntry_department_id_idx" ON "ReportEntry"("department_id");

-- CreateIndex
CREATE INDEX "ReportEntry_format_version_id_idx" ON "ReportEntry"("format_version_id");

-- CreateIndex
CREATE INDEX "ReportFormat_company_id_type_idx" ON "ReportFormat"("company_id", "type");

-- CreateIndex
CREATE INDEX "ReportFormatVersion_format_id_idx" ON "ReportFormatVersion"("format_id");
