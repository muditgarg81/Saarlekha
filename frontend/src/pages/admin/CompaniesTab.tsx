import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, Trash2, X, Phone, Mail, User, ShieldAlert, Shield, Sparkles, Cpu } from 'lucide-react';
import clsx from 'clsx';

interface Company {
  id: string;
  name: string;
  address: string;
  gst: string;
  contact_name: string;
  phone: string;
  email: string;
  retention_days?: number | null;
  subscription_tier?: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
}

function CompanyRetentionStatus({ companyId }: { companyId: string }) {
  const [status, setStatus] = React.useState<{
    retentionDays: number | null;
    olderEntriesCount: number;
    olderProductionCount: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [purging, setPurging] = React.useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get(`/companies/${companyId}/retention-status`);
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch retention status', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStatus();
  }, [companyId]);

  const handlePurge = async () => {
    if (!status) return;
    const total = status.olderEntriesCount + status.olderProductionCount;
    if (total === 0) {
      alert('No old data available to purge.');
      return;
    }

    const message = `CAUTION: You are about to permanently delete ${status.olderEntriesCount} report entries and ${status.olderProductionCount} production records that are older than the configured retention period (${status.retentionDays} days).\n\nThis action cannot be undone.\n\nType "PURGE" to confirm this action:`;
    const confirmation = window.prompt(message);
    if (confirmation === 'PURGE') {
      try {
        setPurging(true);
        const res = await api.post(`/companies/${companyId}/purge-data`);
        alert(`Successfully purged data: Deleted ${res.data.deletedReportEntries} report entries and ${res.data.deletedProductionRecords} production records.`);
        fetchStatus();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to purge data');
      } finally {
        setPurging(false);
      }
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/companies/${companyId}/archive-data`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `saarlekha_archive_${companyId}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert('Failed to download archive');
    }
  };

  if (loading) return <div className="text-xs text-text-secondary mt-2">Loading storage status...</div>;
  if (!status || status.retentionDays === null) {
    return (
      <div className="bg-surface p-3 rounded-lg border border-border text-xs text-text-secondary mt-3">
        <strong>Data Retention:</strong> Indefinite (No Auto-Purge). Old logs are kept indefinitely.
      </div>
    );
  }

  const totalOld = status.olderEntriesCount + status.olderProductionCount;

  return (
    <div className="bg-surface p-3 rounded-lg border border-border space-y-2.5 mt-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-text-primary">Data Retention Policy:</span>
        <span className="text-xs font-bold text-primary">{status.retentionDays} Days</span>
      </div>

      <div className="text-xs text-text-secondary space-y-1">
        <div className="flex justify-between">
          <span>Archivable Report Entries:</span>
          <span className="font-semibold text-text-primary">{status.olderEntriesCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Archivable Production Records:</span>
          <span className="font-semibold text-text-primary">{status.olderProductionCount}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1.5 border-t border-border">
        {totalOld > 0 ? (
          <>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 bg-primary text-white hover:bg-primary-light text-[10px] font-bold py-1.5 rounded transition-all shadow-sm"
            >
              Download Archive
            </button>
            <button
              type="button"
              onClick={handlePurge}
              disabled={purging}
              className="flex-1 bg-danger text-white hover:bg-danger/90 text-[10px] font-bold py-1.5 rounded transition-all shadow-sm disabled:opacity-50"
            >
              {purging ? 'Purging...' : 'Purge Database'}
            </button>
          </>
        ) : (
          <div className="text-[10px] text-text-secondary italic text-center w-full">
            No historical records exceed the retention cutoff.
          </div>
        )}
      </div>
    </div>
  );
}

export function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, selectCompany } = useAuth();
  
  // For editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [editTab, setEditTab] = useState<'general' | 'subscription'>('general');
  const [editBillingCycle, setEditBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // For Razorpay Payment Link Generation
  const [paymentLinkModalCompany, setPaymentLinkModalCompany] = useState<Company | null>(null);
  const [paymentLinkTier, setPaymentLinkTier] = useState<'STARTER' | 'GROWTH' | 'ENTERPRISE'>('STARTER');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // For creation
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    address: '',
    gst: '',
    contact_name: '',
    email: '',
    phone: '',
    adminEmail: '',
    subscription_tier: 'STARTER' as 'STARTER' | 'GROWTH' | 'ENTERPRISE'
  });
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [createdCompanyName, setCreatedCompanyName] = useState<string>('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (company: Company) => {
    setEditingId(company.id);
    setEditForm(company);
    setEditTab('general');
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await api.put(`/companies/${editingId}`, editForm);
      setEditingId(null);
      fetchCompanies();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update company';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const message = `WARNING: Are you sure you want to delete "${name}"?\n\nThis will permanently delete this company and ALL associated data (Users, Manpower, Report Formats, Report Entries, Job Orders, Machines, Production Records, and Audit Logs).\n\nThis operation is irreversible.`;
    if (window.confirm(message)) {
      try {
        await api.delete(`/companies/${id}`);
        fetchCompanies();
      } catch (err: any) {
        const msg = err.response?.data?.error || 'Failed to delete company';
        const details = err.response?.data?.details;
        alert(details ? `${msg}: ${details}` : msg);
      }
    }
  };

  const handleGeneratePaymentLink = async () => {
    if (!paymentLinkModalCompany) return;
    setGeneratingLink(true);
    try {
      const res = await api.post('/payments/create-order', {
        companyId: paymentLinkModalCompany.id,
        tier: paymentLinkTier,
        method: 'link',
        billingCycle: editBillingCycle
      });
      setGeneratedLink(res.data.paymentLinkUrl);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newCompany.name.trim()) {
      setFormError('Company name is required');
      return;
    }

    try {
      const res = await api.post('/companies', newCompany);
      setShowAddForm(false);
      if (res.data.inviteLink) {
        setCreatedInviteLink(res.data.inviteLink);
        setCreatedCompanyName(res.data.company?.name || newCompany.name);
      }
      setNewCompany({
        name: '',
        address: '',
        gst: '',
        contact_name: '',
        email: '',
        phone: '',
        adminEmail: '',
        subscription_tier: 'STARTER'
      });
      fetchCompanies();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to create company';
      const details = err.response?.data?.details;
      setFormError(details ? `${msg}: ${details}` : msg);
    }
  };

  if (loading) return <div className="p-4 text-text-secondary">Loading companies...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-card border border-border shadow-sm">
        <div>
          <p className="text-sm text-text-secondary">
            {user?.role === 'SUPER_ADMIN' 
              ? 'Super Admin View: Displaying and managing all onboarded companies.' 
              : 'Company View: Viewing linked company details.'}
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </button>
        )}
      </div>

      {/* Add Company Form */}
      {showAddForm && (
        <div className="bg-white rounded-card border border-border shadow-md overflow-hidden transition-all duration-300">
          <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Onboard New Company
            </h2>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleCreateCompany} className="p-6 space-y-6">
            {formError && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Company Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b border-border pb-1">
                  Company Metadata
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase">Company Name *</label>
                  <input
                    type="text"
                    required
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter company name"
                    value={newCompany.name}
                    onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase">Address</label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter address"
                    value={newCompany.address}
                    onChange={e => setNewCompany({ ...newCompany, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase">GST/Registration Number</label>
                  <input
                    type="text"
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="GSTIN"
                    value={newCompany.gst}
                    onChange={e => setNewCompany({ ...newCompany, gst: e.target.value })}
                  />
                </div>
              </div>

              {/* Right Column - Contact & Admin Provision */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b border-border pb-1">
                  Contact & Initial Admin User
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase">Contact Name</label>
                    <input
                      type="text"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="John Doe"
                      value={newCompany.contact_name}
                      onChange={e => setNewCompany({ ...newCompany, contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase">Contact Phone</label>
                    <input
                      type="text"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="1234567890"
                      value={newCompany.phone}
                      onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase">Company Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="info@company.com"
                    value={newCompany.email}
                    onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                  />
                </div>
                
                <div className="bg-surface p-3 rounded-lg border border-border space-y-3 mt-4">
                  <div className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    Subscription Tier
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase">Tier *</label>
                    <select
                      className="mt-1 w-full border border-border rounded px-2 py-1 text-sm bg-white"
                      value={newCompany.subscription_tier}
                      onChange={e => setNewCompany({ ...newCompany, subscription_tier: e.target.value as any })}
                    >
                      <option value="STARTER">Starter</option>
                      <option value="GROWTH">Growth</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="bg-surface p-3 rounded-lg border border-border space-y-3 mt-4">
                  <div className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    Provision First Company Admin
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase">Admin Email</label>
                    <input
                      type="email"
                      className="mt-1 w-full border border-border rounded px-2 py-1 text-sm bg-white"
                      placeholder="admin@company.com"
                      value={newCompany.adminEmail}
                      onChange={e => setNewCompany({ ...newCompany, adminEmail: e.target.value })}
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary italic">
                    The admin will receive an invitation link via email to configure their own password.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition-all shadow-sm"
              >
                Create Company
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Companies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {companies.map(company => (
          <div key={company.id} className="bg-white rounded-card border border-border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="p-6 flex-1 flex flex-col justify-between">
              {editingId === company.id ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h3 className="font-bold text-text-primary">Edit Company Details</h3>
                    <button onClick={() => setEditingId(null)} className="text-text-secondary hover:text-text-primary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                   {/* Tabs header */}
                   <div className="flex border-b border-border mb-3">
                     <button
                       type="button"
                       onClick={() => setEditTab('general')}
                       className={clsx(
                         "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer focus:outline-none",
                         editTab === 'general' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                       )}
                     >
                       General Details
                     </button>
                     <button
                       type="button"
                       onClick={() => setEditTab('subscription')}
                       className={clsx(
                         "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer focus:outline-none",
                         editTab === 'subscription' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                       )}
                     >
                       Subscription Plan
                     </button>
                   </div>

                   {editTab === 'general' ? (
                     <div className="grid grid-cols-2 gap-3">
                       <div className="col-span-2">
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Name</label>
                         <input 
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.name || ''} 
                           onChange={e => setEditForm({...editForm, name: e.target.value})} 
                         />
                       </div>
                       <div className="col-span-2">
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Address</label>
                         <input 
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.address || ''} 
                           onChange={e => setEditForm({...editForm, address: e.target.value})} 
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-text-secondary uppercase">GST</label>
                         <input 
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.gst || ''} 
                           onChange={e => setEditForm({...editForm, gst: e.target.value})} 
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Contact Name</label>
                         <input 
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.contact_name || ''} 
                           onChange={e => setEditForm({...editForm, contact_name: e.target.value})} 
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Email</label>
                         <input 
                           type="email"
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.email || ''} 
                           onChange={e => setEditForm({...editForm, email: e.target.value})} 
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Phone</label>
                         <input 
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
                           value={editForm.phone || ''} 
                           onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                         />
                       </div>
                       <div className="col-span-2">
                         <label className="block text-xs font-semibold text-text-secondary uppercase">Data Retention Policy</label>
                         <select
                           className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                           value={editForm.retention_days !== undefined && editForm.retention_days !== null ? String(editForm.retention_days) : ''}
                           onChange={e => {
                             const val = e.target.value;
                             setEditForm({...editForm, retention_days: val === '' ? null : parseInt(val, 10)});
                           }}
                         >
                           <option value="">Indefinite / No Auto-Purge</option>
                           <option value="30">30 Days (1 Month)</option>
                           <option value="90">90 Days (3 Months)</option>
                           <option value="180">180 Days (6 Months)</option>
                  <option value="365">365 Days (1 Year)</option>
                           <option value="730">730 Days (2 Years)</option>
                         </select>
                       </div>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       {/* Billing Cycle Toggle */}
                       <div className="flex justify-center bg-gray-100 p-1 rounded-lg border border-border/60 max-w-[240px] mx-auto mb-2">
                         <button
                           type="button"
                           onClick={() => setEditBillingCycle('yearly')}
                           className={clsx(
                             "flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer focus:outline-none text-center",
                             editBillingCycle === 'yearly' ? "bg-white text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
                           )}
                         >
                           Yearly
                         </button>
                         <button
                           type="button"
                           onClick={() => setEditBillingCycle('monthly')}
                           className={clsx(
                             "flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer focus:outline-none text-center",
                             editBillingCycle === 'monthly' ? "bg-white text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
                           )}
                         >
                           Monthly
                         </button>
                       </div>

                       {[
                         {
                           key: 'STARTER',
                           name: 'Starter Plan',
                           price: editBillingCycle === 'yearly' ? 'Rs. 14,999 / yr' : 'Rs. 1,499 / mo',
                           limits: 'Max 30 Workers • Max 5 Machines',
                           features: ['Custom dynamic columns', 'Advanced exports (Excel/PDF/CSV/TXT)'],
                           icon: Building2
                         },
                         {
                           key: 'GROWTH',
                           name: 'Growth Plan',
                           price: editBillingCycle === 'yearly' ? 'Rs. 49,999 / yr' : 'Rs. 4,999 / mo',
                           limits: 'Max 150 Workers • Max 25 Machines',
                           features: ['Custom dynamic columns', 'Advanced exports (Excel/PDF/CSV/TXT)'],
                           icon: Sparkles
                         },
                         {
                           key: 'ENTERPRISE',
                           name: 'Enterprise Plan',
                           price: editBillingCycle === 'yearly' ? 'Rs. 1,49,999 / yr' : 'Rs. 14,999 / mo',
                           limits: 'Unlimited Workers & Machines',
                           features: [
                             'Custom dynamic columns',
                             'Advanced exports (Excel/PDF/CSV/TXT)',
                             'Indefinite data log archiving',
                             'Priority phone & email support',
                             'AI Integration'
                           ],
                           icon: Cpu
                         }
                       ].map(plan => {
                         const isSelected = editForm.subscription_tier === plan.key;
                         const isActive = company.subscription_tier === plan.key;
                         const PlanIcon = plan.icon;

                         return (
                           <div
                             key={plan.key}
                             onClick={() => setEditForm({ ...editForm, subscription_tier: plan.key as any })}
                             className={clsx(
                               "border p-3 rounded-lg transition-all cursor-pointer flex flex-col gap-2.5 text-left",
                               isSelected
                                 ? "border-primary bg-primary/5 ring-1 ring-primary/25 shadow-xs"
                                 : "border-border bg-white hover:bg-gray-50/60"
                             )}
                           >
                             <div className="flex items-start justify-between">
                               <div className="flex gap-2.5">
                                 <div className={clsx("p-1.5 rounded-lg border flex items-center justify-center", isSelected ? "bg-primary/10 text-primary border-primary/20" : "bg-gray-50 text-gray-400 border-border")}>
                                   <PlanIcon className="h-4 w-4" />
                                 </div>
                                 <div>
                                   <div className="flex items-center gap-1.5 flex-wrap">
                                     <span className="font-bold text-text-primary text-xs leading-none">{plan.name}</span>
                                     {isActive && (
                                       <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-extrabold uppercase px-1 rounded">
                                         Active
                                       </span>
                                     )}
                                     {isSelected && !isActive && (
                                       <span className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-extrabold uppercase px-1 rounded">
                                         Selected
                                       </span>
                                     )}
                                   </div>
                                   <p className="text-[10px] text-text-secondary mt-0.5 font-medium">{plan.limits}</p>
                                 </div>
                               </div>
                               <div className="text-right">
                                 <span className="text-xs font-extrabold text-text-primary">{plan.price}</span>
                               </div>
                             </div>

                             <div className="pt-2 border-t border-dashed border-border/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                               <div className="space-y-0.5">
                                 {plan.features.map((feat, idx) => (
                                   <div key={idx} className="flex items-center gap-1 text-[10px] text-text-secondary">
                                     <span className="text-primary font-bold">✓</span> {feat}
                                   </div>
                                 ))}
                               </div>

                               <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1.5 sm:mt-0 justify-end">
                                 <button
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setPaymentLinkModalCompany(company);
                                     setPaymentLinkTier(plan.key as any);
                                     setGeneratedLink(null);
                                   }}
                                   className="bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/15 px-2 py-0.5 rounded text-[9px] font-semibold transition-all whitespace-nowrap cursor-pointer focus:outline-none"
                                   title="Generate Razorpay payment link"
                                 >
                                   Payment Link
                                 </button>
                                 {!isSelected ? (
                                   <button
                                     type="button"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setEditForm({ ...editForm, subscription_tier: plan.key as any });
                                     }}
                                     className="bg-gray-50 hover:bg-gray-100 border border-border text-text-primary px-2.5 py-0.5 rounded text-[9px] font-semibold transition-all whitespace-nowrap cursor-pointer focus:outline-none"
                                   >
                                     Select
                                   </button>
                                 ) : (
                                   <span className="bg-primary text-white text-[9px] font-bold px-2.5 py-0.5 rounded border border-primary flex items-center gap-1">
                                     Selected
                                   </span>
                                 )}
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   )}
                  <div className="flex gap-2 pt-2 border-t border-border justify-end">
                    <button onClick={() => setEditingId(null)} className="border border-border px-3 py-1 rounded text-sm hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={handleSave} className="bg-primary text-white px-4 py-1 rounded text-sm hover:bg-primary-light font-semibold">Save Changes</button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2.5 bg-surface rounded-lg mr-4 border border-border">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-text-primary leading-tight">{company.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              company.subscription_tier === 'ENTERPRISE'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : company.subscription_tier === 'GROWTH'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}>
                              {company.subscription_tier || 'STARTER'}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">GST: <span className="font-semibold text-text-primary">{company.gst || 'N/A'}</span></p>
                        </div>
                      </div>
                      
                      {user?.role === 'SUPER_ADMIN' && companies.length > 1 && (
                        <button
                          onClick={() => handleDelete(company.id, company.name)}
                          className="text-gray-400 hover:text-danger p-1 rounded hover:bg-red-50 transition-colors"
                          title="Delete Company"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5 text-sm text-text-secondary py-2">
                      <p className="leading-relaxed"><span className="font-semibold text-text-primary">Address:</span> {company.address || 'N/A'}</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-50 mt-2 pb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{company.contact_name || 'No Contact'}</span>
                        </div>
                        {company.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="font-mono text-xs">{company.phone}</span>
                          </div>
                        )}
                        {company.email && (
                          <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate text-xs">{company.email}</span>
                          </div>
                        )}
                      </div>

                      <CompanyRetentionStatus companyId={company.id} />
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                    {user?.role === 'SUPER_ADMIN' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectCompany(company.id, company.name)}
                          className="bg-primary text-white hover:bg-primary-light px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Select Company
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentLinkModalCompany(company);
                            setPaymentLinkTier('GROWTH');
                            setGeneratedLink(null);
                          }}
                          className="bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          title="Generate Payment Link"
                        >
                          Payment Link
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={() => handleEditClick(company)}
                      className="text-primary hover:text-primary-light text-sm font-semibold flex items-center gap-1.5"
                    >
                      Edit Details
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Invite link generated popup */}
      {createdInviteLink && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-md w-full border border-border shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Mail className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Company Onboarded Successfully</h3>
                <p className="text-xs text-text-secondary">Invitation link generated for {createdCompanyName}</p>
              </div>
            </div>
            
            <p className="text-sm text-text-secondary leading-relaxed">
              Share this invite link with the new Company Admin. They can click the link to configure their password and activate their account.
            </p>
            
            <div className="bg-surface border border-border p-3 rounded-lg flex items-center gap-2">
              <input
                type="text"
                readOnly
                className="w-full bg-transparent text-xs font-mono text-text-primary focus:outline-none"
                value={createdInviteLink}
                id="created-invite-link"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdInviteLink);
                  alert('Invite link copied to clipboard!');
                }}
                className="text-xs font-bold text-primary hover:text-primary-light whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
            
            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCreatedInviteLink(null)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-light shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment link generator modal */}
      {paymentLinkModalCompany && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-md w-full border border-border shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Generate Subscription Payment Link</h3>
                <p className="text-xs text-text-secondary">For {paymentLinkModalCompany.name}</p>
              </div>
            </div>

            {!generatedLink ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Select a subscription plan tier to generate a secure Razorpay payment link. You can share this link with the company administrator for subscription payment.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase">Plan Tier</label>
                    <select
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
                      value={paymentLinkTier}
                      onChange={e => setPaymentLinkTier(e.target.value as any)}
                    >
                      <option value="STARTER">Starter Plan</option>
                      <option value="GROWTH">Growth Plan</option>
                      <option value="ENTERPRISE">Enterprise Plan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase">Billing Cycle</label>
                    <select
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
                      value={editBillingCycle}
                      onChange={e => setEditBillingCycle(e.target.value as any)}
                    >
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 border border-border rounded-lg p-3 text-xs font-medium text-text-primary">
                  Selected Price: <span className="font-bold text-primary">
                    {paymentLinkTier === 'STARTER'
                      ? (editBillingCycle === 'yearly' ? 'Rs. 14,999 / year' : 'Rs. 1,499 / month')
                      : paymentLinkTier === 'GROWTH'
                      ? (editBillingCycle === 'yearly' ? 'Rs. 49,999 / year' : 'Rs. 4,999 / month')
                      : (editBillingCycle === 'yearly' ? 'Rs. 1,49,999 / year' : 'Rs. 14,999 / month')
                    }
                  </span>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentLinkModalCompany(null)}
                    className="border border-border px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePaymentLink}
                    disabled={generatingLink}
                    className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-light transition-all shadow-sm disabled:opacity-50"
                  >
                    {generatingLink ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Razorpay payment link has been successfully generated. Copy it below:
                </p>
                <div className="bg-surface border border-border p-3 rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    className="w-full bg-transparent text-xs font-mono text-text-primary focus:outline-none"
                    value={generatedLink}
                    id="generated-payment-link"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      alert('Payment link copied to clipboard!');
                    }}
                    className="text-xs font-bold text-primary hover:text-primary-light whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentLinkModalCompany(null)}
                    className="bg-primary text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-primary-light shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
