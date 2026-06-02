import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

interface LegalPageProps {
  isPrivate?: boolean;
}

export function PrivacyPolicy({ isPrivate = false }: LegalPageProps) {
  const content = (
    <div className="space-y-6 text-text-primary">
      <section>
        <h2 className="text-lg font-bold text-primary mb-2">1. Information We Collect</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Saarlekha collects information that you provide directly when registering and configuring your company profile. This includes your name, email address, password, company name, phone number, physical address, and GST registration number. In addition, we collect operational data entries logged by authorized users, such as manpower registries, machine efficiency figures, production targets, and maintenance checklists.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">2. How We Use Your Information</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          We use the collected data to provide, maintain, and optimize our manufacturing reporting platform. This includes authenticating users, generating department-specific operational dashboards, executing efficiency calculations, processing spreadsheet and PDF exports, and keeping detailed system audit logs. Your data is isolated per tenant and is never shared across companies.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">3. Data Isolation and Row-Level Security</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Saarlekha is built with a strict multi-tenant architecture. We utilize database-level PostgreSQL Row-Level Security (RLS) policies to ensure that your company's data remains entirely private. Under no circumstances can data from Company A be read, modified, or accessed by users from Company B.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">4. Data Protection and Encryption</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          We implement industry-standard administrative, physical, and technical safeguards. Sensitive personnel data, specifically Aadhaar numbers, are never stored in plaintext. They are encrypted at rest using AES-256 encryption, and only masked representations (displaying the last 4 digits) are exposed in the user interface and generated report exports.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">5. Updates to This Privacy Policy</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the date at the top. We encourage you to review this Privacy Policy periodically for any updates.
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
          <Shield className="h-8 w-8 text-primary mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Privacy Policy</h1>
            <p className="text-sm text-text-secondary">Detailed information about how Saarlekha collects, secures, and handles your operational data.</p>
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
            <Shield className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold">Saarlekha</h1>
              <p className="text-xs text-blue-100">Privacy Policy</p>
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
