import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PublicLayout, PrivateLayout } from './components/Layout';

// Auth pages — lazy loaded
const Login = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const SetupPassword = lazy(() => import('./pages/auth/SetupPassword').then(m => ({ default: m.SetupPassword })));

// Private pages — lazy loaded
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel').then(m => ({ default: m.AdminPanel })));
const SubscriptionMaster = lazy(() => import('./pages/admin/SubscriptionMaster').then(m => ({ default: m.SubscriptionMaster })));
const SubscriptionCallback = lazy(() => import('./pages/admin/SubscriptionCallback').then(m => ({ default: m.SubscriptionCallback })));
const AuditLog = lazy(() => import('./pages/admin/AuditLog').then(m => ({ default: m.AuditLog })));
const ManpowerMaster = lazy(() => import('./pages/masters/ManpowerMaster').then(m => ({ default: m.ManpowerMaster })));
const ItemsMaster = lazy(() => import('./pages/masters/ItemsMaster').then(m => ({ default: m.ItemsMaster })));
const CustomerMaster = lazy(() => import('./pages/masters/CustomerMaster').then(m => ({ default: m.CustomerMaster })));
const MachineMaster = lazy(() => import('./pages/masters/MachineMaster').then(m => ({ default: m.MachineMaster })));
const DepartmentMaster = lazy(() => import('./pages/masters/DepartmentMaster').then(m => ({ default: m.DepartmentMaster })));
const JobOrderMaster = lazy(() => import('./pages/masters/JobOrderMaster').then(m => ({ default: m.JobOrderMaster })));
const JobOrderSummary = lazy(() => import('./pages/masters/JobOrderSummary').then(m => ({ default: m.JobOrderSummary })));
const JobOrderColumnsMaster = lazy(() => import('./pages/masters/JobOrderColumnsMaster').then(m => ({ default: m.JobOrderColumnsMaster })));
const MaintenanceColumnsMaster = lazy(() => import('./pages/masters/MaintenanceColumnsMaster').then(m => ({ default: m.MaintenanceColumnsMaster })));
const ReportBuilder = lazy(() => import('./pages/reports/ReportBuilder').then(m => ({ default: m.ReportBuilder })));
const DataEntry = lazy(() => import('./pages/reports/DataEntry').then(m => ({ default: m.DataEntry })));
const ProductionDetail = lazy(() => import('./pages/reports/ProductionDetail').then(m => ({ default: m.ProductionDetail })));
const OtherProduction = lazy(() => import('./pages/reports/OtherProduction').then(m => ({ default: m.OtherProduction })));
const QualityDetail = lazy(() => import('./pages/reports/QualityDetail').then(m => ({ default: m.QualityDetail })));
const DailyReport = lazy(() => import('./pages/reports/DailyReport').then(m => ({ default: m.DailyReport })));
const MachineMaintenance = lazy(() => import('./pages/maintenance/MachineMaintenance').then(m => ({ default: m.MachineMaintenance })));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const LegalTerms = lazy(() => import('./pages/legal/LegalTerms').then(m => ({ default: m.LegalTerms })));
const TermsConditions = lazy(() => import('./pages/legal/TermsConditions').then(m => ({ default: m.TermsConditions })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
