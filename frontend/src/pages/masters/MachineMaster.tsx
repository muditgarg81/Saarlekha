import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Settings2, Trash2, Edit2, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import clsx from 'clsx';

interface Machine {
  id: string;
  name: string;
  type: string;
  location: string;
  department_id?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
}

interface Department {
  id: string;
  name: string;
}

export function MachineMaster() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', type: '', location: '', department_id: '' });

  // Batch creation states
  const [batchMachines, setBatchMachines] = useState<{ name: string; type: string; location: string; department_id: string; departmentName?: string }[]>([]);
  const [editingBatchIndex, setEditingBatchIndex] = useState<number | null>(null);

  // Search & Collapsible states
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  
  // Multiselect state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleDeptCollapse = (deptId: string) => {
    setCollapsedDepts(prev => ({
      ...prev,
      [deptId]: !prev[deptId]
    }));
  };

  const handleToggleSelect = (machineId: string) => {
    setSelectedIds(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const handleToggleSelectAll = (matchingMachines: Machine[]) => {
    const matchingIds = matchingMachines.map(m => m.id);
    const allSelected = matchingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      // Remove all matching machine IDs from selection
      setSelectedIds(prev => prev.filter(id => !matchingIds.includes(id)));
    } else {
      // Add missing matching machine IDs to selection
      setSelectedIds(prev => {
        const union = new Set([...prev, ...matchingIds]);
        return Array.from(union);
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected machine(s)?`)) return;

    try {
      await api.post('/machines/bulk-delete', { ids: selectedIds });
      alert('Selected machines deleted successfully.');
      setSelectedIds([]);
      fetchMachines();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete selected machines');
    }
  };

  const getExportOpts = (matchingMachines: Machine[]): ExportOptions => {
    const list = selectedIds.length > 0
      ? machines.filter(m => selectedIds.includes(m.id))
      : matchingMachines;
    
    return {
      title: 'Machine Master Report',
      subtitle: selectedIds.length > 0
        ? `Exported ${selectedIds.length} selected machines`
        : `Exported all ${matchingMachines.length} machines`,
      filename: selectedIds.length > 0 ? 'machines_selected' : 'machines_all',
      columns: [
        { header: 'Machine Name', key: 'name' },
        { header: 'Type / Category', key: 'type' },
        { header: 'Location / Floor', key: 'location' },
        { header: 'Department', key: 'department' }
      ],
      rows: list.map(m => ({
        name: m.name,
        type: m.type || 'N/A',
        location: m.location || 'N/A',
        department: m.department?.name || 'N/A'
      }))
    };
  };

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    fetchMachines();
    fetchDepartments();
  }, []);

  const fetchMachines = async () => {
    try {
      const res = await api.get('/machines');
      setMachines(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToBatch = () => {
    if (!formData.name.trim()) {
      alert('Please enter a machine name/ID.');
      return;
    }
    
    const isDuplicate = machines.some(
      m => m.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    ) || batchMachines.some(
      (m, idx) => m.name.toLowerCase().trim() === formData.name.toLowerCase().trim() && idx !== editingBatchIndex
    );
    if (isDuplicate) {
      if (!window.confirm(`A machine named "${formData.name.trim()}" already exists. Do you want to add it to the batch?`)) {
        return;
      }
    }

    const dept = departments.find(d => d.id === formData.department_id);
    const newRow = {
      name: formData.name.trim(),
      type: formData.type.trim(),
      location: formData.location.trim(),
      department_id: formData.department_id,
      departmentName: dept?.name || ''
    };

    if (editingBatchIndex !== null) {
      setBatchMachines(prev => prev.map((item, idx) => idx === editingBatchIndex ? newRow : item));
      setEditingBatchIndex(null);
    } else {
      setBatchMachines(prev => [...prev, newRow]);
    }
    // Clear name but keep other values to speed up typing of similar machines
    setFormData(prev => ({ ...prev, name: '' }));
  };

  const handleEditBatchRow = (index: number) => {
    const item = batchMachines[index];
    setEditingBatchIndex(index);
    setFormData({
      name: item.name,
      type: item.type,
      location: item.location,
      department_id: item.department_id
    });
  };

  const handleRemoveBatchRow = (index: number) => {
    setBatchMachines(prev => prev.filter((_, idx) => idx !== index));
    if (editingBatchIndex === index) {
      setEditingBatchIndex(null);
      setFormData(prev => ({ ...prev, name: '' }));
    } else if (editingBatchIndex !== null && editingBatchIndex > index) {
      setEditingBatchIndex(prev => prev! - 1);
    }
  };

  const handleSaveBatch = async () => {
    const toSubmit = [...batchMachines];
    if (formData.name.trim() !== '' && editingBatchIndex === null) {
      const isDuplicate = machines.some(
        m => m.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
      );
      if (isDuplicate) {
        if (!window.confirm(`A machine named "${formData.name.trim()}" already exists. Do you want to save it?`)) {
          return;
        }
      }
      toSubmit.push({
        name: formData.name.trim(),
        type: formData.type.trim(),
        location: formData.location.trim(),
        department_id: formData.department_id
      });
    }

    if (toSubmit.length === 0) {
      alert('Please enter or add at least one machine.');
      return;
    }

    try {
      await api.post('/machines', toSubmit);
      alert(`Successfully saved ${toSubmit.length} machine(s)!`);
      handleCancel();
      fetchMachines();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save batch machines');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const isDuplicate = machines.some(
        m => m.name.toLowerCase().trim() === formData.name.toLowerCase().trim() && m.id !== editingId
      );
      if (isDuplicate) {
        if (!window.confirm(`A machine named "${formData.name.trim()}" already exists. Do you want to update it?`)) {
          return;
        }
      }
      try {
        const payload = {
          ...formData,
          department_id: formData.department_id || null
        };
        await api.put(`/machines/${editingId}`, payload);
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', type: '', location: '', department_id: '' });
        fetchMachines();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to save machine');
      }
    } else {
      handleSaveBatch();
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setFormData({
      name: machine.name,
      type: machine.type || '',
      location: machine.location || '',
      department_id: machine.department_id || ''
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingBatchIndex(null);
    setBatchMachines([]);
    setFormData({ name: '', type: '', location: '', department_id: '' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this machine?')) return;
    try {
      await api.delete(`/machines/${id}`);
      fetchMachines();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete machine');
    }
  };

  if (loading) return <div className="p-4">Loading machines...</div>;

  // Filter machines based on search query
  const filteredMachines = machines.filter(m => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      m.name.toLowerCase().includes(term) ||
      (m.type || '').toLowerCase().includes(term) ||
      (m.location || '').toLowerCase().includes(term) ||
      (m.department?.name || '').toLowerCase().includes(term)
    );
  });

  // Group filtered machines by department
  const groupedMachines = (() => {
    const groups: {
      deptId: string;
      deptName: string;
      machines: Machine[];
    }[] = [];

    // Add groups for departments that have machines
    departments.forEach(dept => {
      const deptMachines = filteredMachines.filter(m => m.department_id === dept.id);
      if (deptMachines.length > 0) {
        groups.push({
          deptId: dept.id,
          deptName: dept.name,
          machines: deptMachines
        });
      }
    });

    // Add group for unassigned machines
    const unassignedMachines = filteredMachines.filter(m => !m.department_id);
    if (unassignedMachines.length > 0) {
      groups.push({
        deptId: 'unassigned',
        deptName: 'Unassigned / Other',
        machines: unassignedMachines
      });
    }

    return groups;
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Machine Master</h1>
        {isAdmin && (
          <button 
            onClick={() => { if (showForm && editingId) { handleCancel(); } else { setShowForm(!showForm); } }}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors"
          >
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Machine'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            {editingId ? 'Edit Machine Details' : 'New Machine'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Machine Name/ID</label>
              <input required={editingId !== null || batchMachines.length === 0} type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Type / Category</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Location / Floor</label>
              <input type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Department</label>
              <select className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})}>
                <option value="">Select Department (Optional)</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Batch Preview Table */}
            {batchMachines.length > 0 && (
              <div className="md:col-span-4 mt-2 border border-border rounded-lg overflow-hidden bg-surface">
                <div className="px-4 py-2 border-b border-border bg-gray-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-text-secondary uppercase">Queued Machines ({batchMachines.length})</span>
                  <button 
                    type="button" 
                    onClick={() => setBatchMachines([])} 
                    className="text-xs text-danger hover:underline font-semibold"
                  >
                    Clear List
                  </button>
                </div>
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase">Machine Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase">Department</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-text-secondary uppercase w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {batchMachines.map((m, idx) => (
                      <tr key={idx} className={clsx("hover:bg-surface/50", editingBatchIndex === idx && "bg-blue-50/50")}>
                        <td className="px-4 py-2 font-medium text-text-primary">{m.name}</td>
                        <td className="px-4 py-2 text-text-secondary">{m.type || '—'}</td>
                        <td className="px-4 py-2 text-text-secondary">{m.location || '—'}</td>
                        <td className="px-4 py-2 text-text-secondary">{m.departmentName || '—'}</td>
                        <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-3 text-xs font-semibold">
                            <button 
                              type="button" 
                              onClick={() => handleEditBatchRow(idx)}
                              className="text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveBatchRow(idx)}
                              className="text-danger hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="md:col-span-4 pt-2 flex gap-3">
              {editingId ? (
                <>
                  <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light transition-colors text-sm font-semibold">
                    Update Machine
                  </button>
                  <button type="button" onClick={handleCancel} className="border border-border text-text-secondary px-4 py-2 rounded-md hover:bg-surface transition-colors text-sm font-semibold">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleAddToBatch}
                    className="bg-secondary text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors text-sm font-semibold"
                  >
                    {editingBatchIndex !== null ? 'Update Row' : '+ Add Row'}
                  </button>
                  {(batchMachines.length > 0 || formData.name.trim() !== '') && (
                    <button
                      type="button"
                      onClick={handleSaveBatch}
                      className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light transition-colors text-sm font-semibold"
                    >
                      {batchMachines.length > 0 
                        ? `Save Batch (${batchMachines.length + (formData.name.trim() !== '' && editingBatchIndex === null ? 1 : 0)} Machines)` 
                        : 'Save Machine'}
                    </button>
                  )}
                  <button type="button" onClick={handleCancel} className="border border-border text-text-secondary px-4 py-2 rounded-md hover:bg-surface transition-colors text-sm font-semibold">
                    Cancel
                  </button>
                </>
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
              placeholder="Search by name, type, location or department..."
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
          {filteredMachines.length > 0 && (
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-text-secondary font-medium mr-1">
                {selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : 'Export All'}
              </span>
              <ExportBar opts={getExportOpts(filteredMachines)} />
            </div>
          )}
        </div>

        {/* Multi-Select Select-All Action Bar */}
        {filteredMachines.length > 0 && (
          <div className="border-t border-border/60 pt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all-checkbox"
                checked={filteredMachines.length > 0 && filteredMachines.every(m => selectedIds.includes(m.id))}
                onChange={() => handleToggleSelectAll(filteredMachines)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label htmlFor="select-all-checkbox" className="font-medium text-text-secondary cursor-pointer select-none">
                Select All {filteredMachines.length} Matching Machines
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

      {/* Grouped Machines List */}
      <div className="space-y-6">
        {groupedMachines.length === 0 ? (
          <div className="bg-white rounded-card border border-border p-8 text-center text-text-secondary">
            No machines found matching your criteria.
          </div>
        ) : (
          groupedMachines.map((group) => {
            const isCollapsed = !!collapsedDepts[group.deptId];
            return (
              <div key={group.deptId} className="space-y-4">
                {/* Department Header Accordion Toggle */}
                <button
                  type="button"
                  onClick={() => toggleDeptCollapse(group.deptId)}
                  className="w-full flex items-center justify-between bg-surface border border-border hover:bg-gray-50 px-4 py-3 rounded-lg shadow-sm transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">
                      {group.deptName}
                    </span>
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                      {group.machines.length} {group.machines.length === 1 ? 'Machine' : 'Machines'}
                    </span>
                  </div>
                  <div>
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-text-secondary" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-text-secondary" />
                    )}
                  </div>
                </button>

                {/* Machines Grid */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.machines.map((machine) => (
                      <div key={machine.id} className="bg-white rounded-card border border-border shadow-sm p-6 relative hover:shadow-md transition-shadow">
                        {isAdmin && (
                          <div className="absolute top-4 right-4 flex gap-1 bg-white pl-2 pb-2 rounded-bl">
                            <button onClick={() => handleEdit(machine)} className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50 transition-colors" title="Edit Machine">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(machine.id)} className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors" title="Delete Machine">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(machine.id)}
                            onChange={() => handleToggleSelect(machine.id)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 mr-3 cursor-pointer"
                          />
                          <div className="p-2 bg-surface rounded-lg mr-3">
                            <Settings2 className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="text-lg font-bold text-text-primary truncate pr-16">{machine.name}</h3>
                        </div>
                        <div className="space-y-1 text-sm text-text-secondary">
                          <p>Type: {machine.type || 'N/A'}</p>
                          <p>Location: {machine.location || 'N/A'}</p>
                          <p>Department: {machine.department?.name || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
