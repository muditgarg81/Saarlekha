import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  isPrivate?: boolean;
}

export function TermsConditions({ isPrivate = false }: LegalPageProps) {
  const content = (
    <div className="space-y-6 text-text-primary">
      <section>
        <h2 className="text-lg font-bold text-primary mb-2">1. Account Registration & User Responsibilities</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          To register for Saarlekha, you must onboard your company using valid registration data (e.g., Company Name, GST/Registration number). As the primary Company Admin, you are responsible for defining roles, assigning departments to operations users, and sharing secure invitation links. You must safeguard all credentials and remain fully responsible for all data entries logged under your company tenant.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">2. Prohibited Uses</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          You and your authorized operations users agree not to use the platform to:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-text-secondary">
          <li>Upload, log, or transmit any data that is fraudulent, inaccurate, or in violation of local labor and tax laws.</li>
          <li>Circumvent or attempt to bypass PostgreSQL Row-Level Security (RLS) policies or cross-tenant query configurations.</li>
          <li>Log personnel data containing unmasked Aadhaar numbers or transmit raw plaintext government credentials.</li>
          <li>Interfere with the platform's performance or attempt unauthorized access to other tenant databases.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">3. Data Ownership</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your company retains sole ownership of all raw operational records, reports, targets, and employee profiles logged to the Saarlekha platform. By submitting data to the service, you grant Saarlekha a worldwide, royalty-free license to store, process, aggregate, and display this data within your specific tenant dashboard context.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">4. Operations Invite-Link Mechanics</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          When onboarding operations users, credentials are not set by the admin. The system generates a secure, one-time, time-limited invite link. You are responsible for distributing this link securely to your employee. The employee must set their password or configure Google OAuth upon opening the link. Saarlekha is not responsible for any unauthorized account configuration resulting from insecure share distribution.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">5. Service Suspension & Termination</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          We reserve the right to suspend or terminate your company's access to Saarlekha immediately, without prior notice or liability, if you violate these Terms & Conditions or engage in any behavior that threatens platform integrity, performance, or multi-tenant database isolation.
        </p>
      </section>

      <div className="pt-4 border-t border-border text-xs text-text-secondary">
        Last updated: June 1, 2026
      </div>
    </div>
  );

  if (isPrivate) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center border-b border-border pb-4 mb-6">
          <FileText className="h-8 w-8 text-primary mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Terms & Conditions</h1>
            <p className="text-sm text-text-secondary">Acceptable use guidelines, data ownership, security practices, and user account rules.</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-card border border-border shadow-sm">
          {content}
        </div>
      </div>
    );
  }

  // Public Layout
  return (
    <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-card shadow-sm border border-border overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary-light px-8 py-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold">Saarlekha</h1>
              <p className="text-xs text-blue-100">Terms & Conditions</p>
            </div>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded px-3 py-1.5 transition-colors gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign Up
          </Link>
        </div>
        <div className="p-8 md:p-12">
          {content}
        </div>
      </div>
    </div>
  );
}
