import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, Trash2, X, Phone, Mail, User, ShieldAlert } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  address: string;
  gst: string;
  contact_name: string;
  phone: string;
  email: string;
}

export function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, selectCompany } = useAuth();
  
  // For editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Company>>({});

  // For creation
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    address: '',
    gst: '',
    contact_name: '',
    email: '',
    phone: '',
    adminEmail: ''
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
        adminEmail: ''
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-text-secondary uppercase">Name</label>
                      <input 
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.name || ''} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})} 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-text-secondary uppercase">Address</label>
                      <input 
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.address || ''} 
                        onChange={e => setEditForm({...editForm, address: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase">GST</label>
                      <input 
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.gst || ''} 
                        onChange={e => setEditForm({...editForm, gst: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase">Contact Name</label>
                      <input 
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.contact_name || ''} 
                        onChange={e => setEditForm({...editForm, contact_name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase">Email</label>
                      <input 
                        type="email"
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.email || ''} 
                        onChange={e => setEditForm({...editForm, email: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary uppercase">Phone</label>
                      <input 
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-sm" 
                        value={editForm.phone || ''} 
                        onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                      />
                    </div>
                  </div>
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
                          <h3 className="text-lg font-bold text-text-primary leading-tight">{company.name}</h3>
                          <p className="text-xs text-text-secondary mt-0.5">GST: <span className="font-semibold text-text-primary">{company.gst || 'N/A'}</span></p>
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
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-50 mt-2">
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
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                    {user?.role === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => selectCompany(company.id, company.name)}
                        className="bg-primary text-white hover:bg-primary-light px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        Select Company
                      </button>
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
    </div>
  );
}
