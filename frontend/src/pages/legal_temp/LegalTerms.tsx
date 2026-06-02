import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  isPrivate?: boolean;
}

export function LegalTerms({ isPrivate = false }: LegalPageProps) {
  const content = (
    <div className="space-y-6 text-text-primary">
      <section>
        <h2 className="text-lg font-bold text-primary mb-2">1. Scope of Service</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          These General Legal Terms govern your access to and use of Saarlekha's operations reporting platform. By using the platform, you acknowledge that Saarlekha is provided on an "as-is" and "as-available" basis. We reserve the right to modify, suspend, or discontinue any aspect of our services at any time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">2. Intellectual Property Rights</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          All elements of the Saarlekha application, including but not limited to the codebase, system designs, calculation algorithms, templates, icons, logos, and UI patterns, are the exclusive intellectual property of Saarlekha and its licensors. You are granted a limited, non-exclusive, non-transferable, and revocable license to access the platform solely for internal business operations.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">3. Limitations of Liability</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          In no event shall Saarlekha, its developers, or its parent entity be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including but not limited to loss of profits, system downtime, data corruption, or operational interruptions) arising out of your use or inability to use the platform, even if advised of the possibility of such damage.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">4. Indemnification</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          You agree to defend, indemnify, and hold harmless Saarlekha and its personnel from and against any claims, liabilities, damages, losses, and expenses (including legal fees) arising out of your company's use of the platform, violation of these terms, or the logging of any unauthorized or illegal operational records.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-primary mb-2">5. Dispute Resolution and Governing Law</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          These terms and your use of Saarlekha are governed by and construed in accordance with the local jurisdiction where Saarlekha is registered. Any legal actions or proceedings arising from these terms shall be brought exclusively in the courts of that jurisdiction.
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
          <ShieldAlert className="h-8 w-8 text-primary mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Legal Terms</h1>
            <p className="text-sm text-text-secondary">General legal disclaimer, liability limitations, and service level conditions.</p>
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
            <ShieldAlert className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold">Saarlekha</h1>
              <p className="text-xs text-blue-100">Legal Terms</p>
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
