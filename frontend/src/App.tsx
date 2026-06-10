import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PublicLayout, PrivateLayout } from './components/Layout';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { SetupPassword } from './pages/auth/SetupPassword';
import { Dashboard } from './pages/Dashboard';

import { AdminPanel } from './pages/admin/AdminPanel';
import { SubscriptionMaster } from './pages/admin/SubscriptionMaster';
import { SubscriptionCallback } from './pages/admin/SubscriptionCallback';
import { AuditLog } from './pages/admin/AuditLog';
import { ManpowerMaster } from './pages/masters/ManpowerMaster';
import { ItemsMaster } from './pages/masters/ItemsMaster';
import { CustomerMaster } from './pages/masters/CustomerMaster';

import { MachineMaster } from './pages/masters/MachineMaster';
import { DepartmentMaster } from './pages/masters/DepartmentMaster';
import { JobOrderMaster } from './pages/masters/JobOrderMaster';
import { JobOrderSummary } from './pages/masters/JobOrderSummary';
import { JobOrderColumnsMaster } from './pages/masters/JobOrderColumnsMaster';
import { MaintenanceColumnsMaster } from './pages/masters/MaintenanceColumnsMaster';
import { ReportBuilder } from './pages/reports/ReportBuilder';
import { DataEntry } from './pages/reports/DataEntry';
import { ProductionDetail } from './pages/reports/ProductionDetail';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { LegalTerms } from './pages/legal/LegalTerms';
import { TermsConditions } from './pages/legal/TermsConditions';
import { OtherProduction } from './pages/reports/OtherProduction';
import { QualityDetail } from './pages/reports/QualityDetail';
import { MachineMaintenance } from './pages/maintenance/MachineMaintenance';
import { DailyReport } from './pages/reports/DailyReport';

// Placeholders for other pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
    <p className="mt-4 text-text-secondary">Coming soon in the next phase of development.</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes (Auth) */}
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/setup-password" element={<SetupPassword />} />
          </Route>

          {/* Standalone Legal routes */}
          <Route path="/privacy-policy" element={<PrivacyPolicy isPrivate={false} />} />
          <Route path="/legal-terms" element={<LegalTerms isPrivate={false} />} />
          <Route path="/terms-conditions" element={<TermsConditions isPrivate={false} />} />

          {/* Private routes (Dashboard & App) */}
          <Route element={<PrivateLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/manpower" element={<ManpowerMaster />} />
            <Route path="/items" element={<ItemsMaster />} />
            <Route path="/customers" element={<CustomerMaster />} />
            <Route path="/data-entry" element={<DataEntry />} />
            <Route path="/reports/builder" element={<ReportBuilder />} />
            <Route path="/production" element={<ProductionDetail />} />
            <Route path="/reports/other-production" element={<OtherProduction />} />
            <Route path="/quality" element={<QualityDetail />} />
            <Route path="/reports/daily" element={<DailyReport />} />
            <Route path="/machines" element={<MachineMaster />} />
            <Route path="/departments" element={<DepartmentMaster />} />
            <Route path="/job-orders" element={<JobOrderMaster />} />
            <Route path="/job-orders/summary/:orderNumber" element={<JobOrderSummary />} />
            <Route path="/masters/job-orders" element={<JobOrderColumnsMaster />} />
            <Route path="/masters/maintenance" element={<MaintenanceColumnsMaster />} />
            <Route path="/maintenance" element={<MachineMaintenance />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/subscription" element={<SubscriptionMaster />} />
            <Route path="/subscription-callback" element={<SubscriptionCallback />} />
            <Route path="/legal/privacy" element={<PrivacyPolicy isPrivate={true} />} />
            <Route path="/legal/terms" element={<LegalTerms isPrivate={true} />} />
            <Route path="/legal/conditions" element={<TermsConditions isPrivate={true} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
