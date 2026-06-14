import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, User, Trash2, Edit2, X, Search } from 'lucide-react';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';

interface Manpower {
  id: string;
  name: string;
  phone: string;
  aadhaar_masked: string;
  role: string;
  blood_group?: string;
  emergency_contact?: string;
  department_id: string;
  department: { name: string };
}

export function ManpowerMaster() {
  const { user } = useAuth();

  if (user?.role === 'OPERATIONS') {
    return <Navigate to="/" replace />;
  }

  const [manpower, setManpower] = useState<Manpower[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', aadhaar: '', blood_group: '', emergency_contact: '', role: 'Operator', department_id: ''
  });

  // Search & Multiselect state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = (matching: Manpower[]) => {
    const matchingIds = matching.map(m => m.id);
    const allSelected = matchingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !matchingIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...matchingIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected manpower record(s)?`)) return;

    try {
      await api.post('/manpower/bulk-delete', { ids: selectedIds });
      alert('Selected manpower records deleted successfully.');
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete selected manpower records');
    }
  };

  const getExportOpts = (matching: Manpower[]): ExportOptions => {
    const list = selectedIds.length > 0
      ? manpower.filter(m => selectedIds.includes(m.id))
      : matching;
    return {
      title: 'Manpower Master Report',
      subtitle: selectedIds.length > 0
        ? `Exported ${selectedIds.length} selected records`
        : `Exported all ${matching.length} records`,
      filename: selectedIds.length > 0 ? 'manpower_selected' : 'manpower_all',
      columns: [
        { header: 'Full Name', key: 'name' },
        { header: 'Role / Designation', key: 'role' },
        { header: 'Department', key: 'department' },
        { header: 'Aadhaar (Masked)', key: 'aadhaar' },
        { header: 'Phone Number', key: 'phone' },
        { header: 'Blood Group', key: 'blood_group' },
        { header: 'Emergency Contact', key: 'emergency_contact' }
      ],
      rows: list.map(m => ({
        name: m.name,
        role: m.role || 'Operator',
        department: m.department?.name || 'N/A',
        aadhaar: m.aadhaar_masked || 'N/A',
        phone: m.phone || 'N/A',
        blood_group: m.blood_group || 'N/A',
        emergency_contact: m.emergency_contact || 'N/A'
      }))
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mpRes, deptRes] = await Promise.all([
        api.get('/manpower'),
        api.get('/departments')
      ]);
      setManpower(mpRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isDuplicateName = manpower.some(
      m => m.name.toLowerCase().trim() === formData.name.toLowerCase().trim() && m.id !== editingId
    );
    const enteredPhoneClean = formData.phone.replace(/\D/g, '');
    const isDuplicatePhone = enteredPhoneClean && manpower.some(
      m => m.phone.replace(/\D/g, '') === enteredPhoneClean && m.id !== editingId
    );
    const enteredAadhaarLast4 = formData.aadhaar.replace(/\s/g, '').slice(-4);
    const isDuplicateAadhaar = enteredAadhaarLast4 && enteredAadhaarLast4.length === 4 && manpower.some(
      m => m.aadhaar_masked && m.aadhaar_masked.replace(/\s/g, '').slice(-4) === enteredAadhaarLast4 && m.id !== editingId
    );

    if (isDuplicateName) {
      if (!window.confirm(`A manpower person named "${formData.name.trim()}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    } else if (isDuplicatePhone) {
      if (!window.confirm(`A manpower person with phone number "${formData.phone.trim()}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    } else if (isDuplicateAadhaar) {
      if (!window.confirm(`A manpower person with Aadhaar ending in "${enteredAadhaarLast4}" already exists. Do you want to save this duplicate?`)) {
        return;
      }
    }

    try {
      if (editingId) {
        await api.put(`/manpower/${editingId}`, formData);
      } else {
        await api.post('/manpower', formData);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', aadhaar: '', blood_group: '', emergency_contact: '', role: 'Operator', department_id: '' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save manpower record');
    }
  };

  const handleEdit = (person: Manpower) => {
    setEditingId(person.id);
    setFormData({
      name: person.name,
      phone: person.phone || '',
      aadhaar: person.aadhaar_masked || '', // Send masked; backend ignores update if it contains 'X'
      blood_group: person.blood_group || '',
      emergency_contact: person.emergency_contact || '',
      role: person.role || 'Operator',
      department_id: person.department_id || ''
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', phone: '', aadhaar: '', blood_group: '', emergency_contact: '', role: 'Operator', department_id: '' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this manpower record?')) return;
    try {
      await api.delete(`/manpower/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete manpower record');
    }
  };

  if (loading) return <div className="p-4">Loading manpower...</div>;

  // Filter manpower based on search query
  const filteredManpower = manpower.filter(m => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      m.name.toLowerCase().includes(term) ||
      (m.role || '').toLowerCase().includes(term) ||
      (m.phone || '').toLowerCase().includes(term) ||
      (m.aadhaar_masked || '').toLowerCase().includes(term) ||
      (m.department?.name || '').toLowerCase().includes(term)
    );
  });

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Manpower Master</h1>
        {['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '') && (
          <button 
            onClick={() => { if (showForm && editingId) { handleCancel(); } else { setShowForm(!showForm); } }}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors"
          >
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Person'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            {editingId ? 'Edit Manpower Record' : 'New Manpower Record'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Full Name</label>
              <input required type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Phone Number</label>
              <input required type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Aadhaar Number</label>
              <input required type="text" placeholder="12-digit number" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm font-mono" value={formData.aadhaar} onChange={e => setFormData({...formData, aadhaar: e.target.value})} />
              <p className="text-xs text-text-secondary mt-1">Stored securely via AES-256 encryption. Last-4 digits displayed only.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Department</label>
              <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Role / Designation</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Blood Group (Optional)</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.blood_group} onChange={e => setFormData({...formData, blood_group: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Emergency Contact (Optional)</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} />
            </div>
            <div className="md:col-span-2 pt-2 flex gap-3">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light transition-colors text-sm font-semibold">
                {editingId ? 'Update Record' : 'Save Record'}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="border border-border text-text-secondary px-4 py-2 rounded-md hover:bg-surface transition-colors text-sm font-semibold">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Search Bar & Actions Panel */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-card border border-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-text-secondary" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-md text-sm bg-white placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="Search by name, role, phone, aadhaar, or department..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedIds([]); // reset selection on search
              }}
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedIds([]);
              }}
              className="text-sm text-primary hover:underline font-semibold self-start md:self-auto"
            >
              Clear Search
            </button>
          )}

          {/* Export Actions */}
          {filteredManpower.length > 0 && (
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-text-secondary font-medium mr-1">
                {selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : 'Export All'}
              </span>
              <ExportBar opts={getExportOpts(filteredManpower)} />
            </div>
          )}
        </div>

        {/* Multi-Select Select-All Action Bar */}
        {filteredManpower.length > 0 && (
          <div className="border-t border-border/60 pt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all-checkbox"
                checked={filteredManpower.length > 0 && filteredManpower.every(m => selectedIds.includes(m.id))}
                onChange={() => handleToggleSelectAll(filteredManpower)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label htmlFor="select-all-checkbox" className="font-medium text-text-secondary cursor-pointer select-none">
                Select All {filteredManpower.length} Matching Records
                {selectedIds.length > 0 && (
                  <span className="ml-1.5 text-primary font-bold">
                    ({selectedIds.length} Selected)
                  </span>
                )}
              </label>
            </div>

            {selectedIds.length > 0 && isAdmin && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-danger text-white rounded-md text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface">
              <tr>
                <th className="w-12 px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredManpower.length > 0 && filteredManpower.every(m => selectedIds.includes(m.id))}
                    onChange={() => handleToggleSelectAll(filteredManpower)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Role & Dept</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Aadhaar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {filteredManpower.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-text-secondary">No records found.</td>
                </tr>
              ) : (
                filteredManpower.map((person) => (
                  <tr key={person.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(person.id)}
                        onChange={() => handleToggleSelect(person.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-8 w-8 text-text-secondary bg-surface p-1 rounded-full mr-3" />
                        <span className="text-sm font-medium text-text-primary">{person.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      <div>{person.role}</div>
                      <div className="text-xs text-primary">{person.department?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-secondary">
                      {person.aadhaar_masked}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {person.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isAdmin && (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleEdit(person)} className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50" title="Edit details">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(person.id)} className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50" title="Delete record">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block sm:hidden divide-y divide-border bg-white">
          {filteredManpower.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No manpower records found.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {filteredManpower.map((person) => (
                <div 
                  key={person.id} 
                  className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white hover:border-primary transition-all relative"
                >
                  {/* Header: User icon, Name, and Selection check */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(person.id)}
                        onChange={() => handleToggleSelect(person.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <div className="flex items-center">
                        <User className="h-6 w-6 text-text-secondary bg-surface p-1 rounded-full mr-2" />
                        <span className="text-sm font-semibold text-text-primary">{person.name}</span>
                      </div>
                    </div>
                    
                    {/* Role Badge */}
                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-primary">
                      {person.role}
                    </span>
                  </div>

                  {/* Body Content Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface/40 p-2 rounded border border-border/40">
                      <span className="block text-[10px] text-text-secondary uppercase font-semibold">Department</span>
                      <span className="font-medium text-text-primary font-mono">{person.department?.name || '—'}</span>
                    </div>
                    <div className="bg-surface/40 p-2 rounded border border-border/40">
                      <span className="block text-[10px] text-text-secondary uppercase font-semibold">Phone</span>
                      <span className="font-medium text-text-primary font-mono">{person.phone || '—'}</span>
                    </div>
                    <div className="bg-surface/40 p-2 rounded border border-border/40">
                      <span className="block text-[10px] text-text-secondary uppercase font-semibold">Masked Aadhaar</span>
                      <span className="font-medium text-text-primary font-mono">{person.aadhaar_masked || '—'}</span>
                    </div>
                    <div className="bg-surface/40 p-2 rounded border border-border/40">
                      <span className="block text-[10px] text-text-secondary uppercase font-semibold">Blood Group</span>
                      <span className="font-medium text-text-primary font-mono">{person.blood_group || '—'}</span>
                    </div>
                    {person.emergency_contact && (
                      <div className="bg-surface/40 p-2 rounded border border-border/40 col-span-2">
                        <span className="block text-[10px] text-text-secondary uppercase font-semibold">Emergency Contact</span>
                        <span className="font-medium text-text-primary font-mono">{person.emergency_contact}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Row (Admin only) */}
                  {isAdmin && (
                    <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
                      <button 
                        onClick={() => handleEdit(person)} 
                        className="text-primary hover:bg-blue-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                        title="Edit details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(person.id)} 
                        className="text-danger hover:bg-red-50 p-1.5 rounded border border-border flex items-center gap-1 text-xs font-semibold"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
