import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Check, X, AlertTriangle, Wrench, Trash2, Edit, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import clsx from 'clsx';
import { injectStandardFields } from '../../utils/standards';

interface Machine {
  id: string;
  name: string;
  type: string;
}

export function MachineMaintenance() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [format, setFormat] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const [sortField, setSortField] = useState<string>('maintenance date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: string) => {
    const normField = field.trim();
    if (sortField === normField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(normField);
      setSortAsc(true);
    }
  };

  const getSortValue = (record: any, field: string) => {
    const norm = field.toLowerCase().trim();
    if (norm === 'department') {
      return record.department?.name ?? '';
    }
    if (norm === 'maintenance date') {
      return new Date(record.entry_date).getTime();
    }
    if (norm === 'machine') {
      return record.payload?._machine ?? '';
    }
    if (norm === 'maintenance type') {
      return record.payload?._maintenance_type ?? '';
    }
    if (norm === 'status') {
      return record.payload?._status ?? '';
    }
    const val = record.payload?.[field];
    if (val === undefined || val === null || val === '' || val === '—') {
      return '';
    }
    return val;
  };

  const sortedRecords = React.useMemo(() => {
    if (!sortField) return records;
    return [...records].sort((a, b) => {
      const valA = getSortValue(a, sortField);
      const valB = getSortValue(b, sortField);

      const numA = Number(valA);
      const numB = Number(valB);
      const isNumA = !isNaN(numA) && valA !== '' && valA !== null && valA !== undefined && typeof valA !== 'boolean';
      const isNumB = !isNaN(numB) && valB !== '' && valB !== null && valB !== undefined && typeof valB !== 'boolean';

      let comparison = 0;
      if (isNumA && isNumB) {
        comparison = numA - numB;
      } else if (isNumA) {
        comparison = -1;
      } else if (isNumB) {
        comparison = 1;
      } else {
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      }

      return sortAsc ? comparison : -comparison;
    });
  }, [records, sortField, sortAsc]);

  const renderSortableHeader = (field: string, label: string, align: 'left' | 'right' = 'left') => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={clsx(
          "group cursor-pointer select-none px-6 py-3 text-xs font-semibold text-text-secondary uppercase hover:bg-border/30 transition-colors",
          align === 'right' ? 'text-right' : 'text-left'
        )}
      >
        <div className={clsx("flex items-center gap-1.5", align === 'right' ? 'justify-end' : 'justify-start')}>
          <span>{label}</span>
          {isSorted ? (
            sortAsc ? (
              <ArrowUp className="h-3 w-3 text-primary shrink-0" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary shrink-0" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-text-secondary/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };


  // Selected Record Modal State
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Multiselect state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Entry state
  const [showEntry, setShowEntry] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [entryStatus, setEntryStatus] = useState('completed');
  const [maintenanceTypes, setMaintenanceTypes] = useState<any[]>([]);
  const [selectedMaintType, setSelectedMaintType] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryPayload, setEntryPayload] = useState<Record<string, any>>({});
  const [activeDropdown, setActiveDropdown] = useState<{ id: string; top: number; left: number } | null>(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!activeDropdown) return;
    const handleScroll = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [activeDropdown]);

  const fetchData = async () => {
    try {
      const [mRes, fRes, rRes, dRes, mtRes] = await Promise.all([
        api.get('/machines'),
        api.get('/reports/formats'),
        api.get('/reports/entries?type=MAINTENANCE'),
        api.get('/departments'),
        api.get('/maintenance-types')
      ]);
      setMachines(mRes.data);
      setDepartments(dRes.data);
      setMaintenanceTypes(mtRes.data);
      if (dRes.data.length > 0) {
        setSelectedDepartmentId(dRes.data[0].id);
      }
      
      const maintFormat = fRes.data.find((f: any) => f.type === 'MAINTENANCE');
      if (maintFormat) {
        setFormat(maintFormat);
      } else {
        // If not found, create default maintenance columns format
        await api.post('/reports/formats', {
          name: 'Machine Maintenance Columns',
          type: 'MAINTENANCE',
          initialFields: []
        });
        const refreshRes = await api.get('/reports/formats');
        const refreshedFormat = refreshRes.data.find((f: any) => f.type === 'MAINTENANCE');
        if (refreshedFormat) {
          setFormat(refreshedFormat);
        }
      }

      setRecords(rRes.data);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canModify = (record: any) => {
    return user?.role !== 'OPERATIONS' || record.submitted_by === user?.id;
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const modifiableRecords = records.filter(r => canModify(r));
    if (selectedIds.length === modifiableRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(modifiableRecords.map(r => r.id));
    }
  };

  const handleStartEdit = (record: any) => {
    setSelectedMachineId(record.payload?._machine_id || '');
    setSelectedDepartmentId(record.department_id || '');
    
    if (record.entry_date) {
      const d = new Date(record.entry_date);
      const dateStr = d.toISOString().split('T')[0];
      setEntryDate(dateStr);
    } else {
      setEntryDate('');
    }
    
    setEntryStatus(record.payload?._status || 'completed');
    setSelectedMaintType(record.payload?._maintenance_type || '');
    
    const payloadFields: Record<string, any> = {};
    if (record.payload) {
      Object.entries(record.payload).forEach(([k, v]) => {
        if (!k.startsWith('_')) {
          payloadFields[k] = v;
        }
      });
    }
    setEntryPayload(payloadFields);
    setEditingId(record.id);
    setShowEntry(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedMachineId('');
    if (departments.length > 0) {
      setSelectedDepartmentId(departments[0].id);
    }
    setEntryDate('');
    setEntryStatus('completed');
    setSelectedMaintType('');
    setEntryPayload({});
    setShowEntry(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this maintenance log?')) return;
    try {
      await api.delete(`/reports/entries/${id}`);
      setSelectedIds(prev => prev.filter(x => x !== id));
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete maintenance log');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} maintenance logs?`)) return;
    try {
      await api.post('/reports/entries/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to bulk delete maintenance logs');
    }
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!format || !format.versions?.[0]) {
      alert('Maintenance checklist format is not configured.');
      return;
    }
    const machine = machines.find(m => m.id === selectedMachineId);

    try {
      if (editingId) {
        await api.put(`/reports/entries/${editingId}`, {
          department_id: selectedDepartmentId,
          entry_date: entryDate,
          payload: {
            ...entryPayload,
            _machine: machine?.name || 'N/A',
            _machine_id: selectedMachineId,
            _status: entryStatus,
            _maintenance_type: selectedMaintType
          }
        });
        alert('Maintenance record updated successfully!');
      } else {
        await api.post('/reports/entries', {
          format_version_id: format.versions[0].id,
          department_id: selectedDepartmentId,
          entry_date: entryDate,
          payload: {
            ...entryPayload,
            _machine: machine?.name || 'N/A',
            _machine_id: selectedMachineId,
            _status: entryStatus,
            _maintenance_type: selectedMaintType
          }
        });
        alert('Maintenance logged successfully!');
      }
      setShowEntry(false);
      setSelectedMachineId('');
      if (departments.length > 0) {
        setSelectedDepartmentId(departments[0].id);
      }
      setEntryDate('');
      setEntryStatus('completed');
      setSelectedMaintType('');
      setEntryPayload({});
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit maintenance entry');
    }
  };

  const getStatusBadge = (status: string) => {
    const normalized = (status || 'completed').toLowerCase();
    switch (normalized) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            <Check className="mr-1 h-3 w-3" /> Completed
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Wrench className="mr-1 h-3 w-3" /> Open
          </span>
        );
      case 'partially completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <AlertTriangle className="mr-1 h-3 w-3" /> Partially Completed
          </span>
        );
      case 'parts missing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <X className="mr-1 h-3 w-3" /> Parts Missing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const fields = format
    ? injectStandardFields(format.versions[0]?.fields_schema || [], 'MAINTENANCE')
    : [];

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Machine Maintenance</h1>
          <p className="text-sm text-text-secondary mt-1">Log and view machine maintenance checklist execution reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (editingId) {
                handleCancelEdit();
              } else {
                setShowEntry(!showEntry);
              }
            }}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light font-semibold shadow-sm gap-1.5"
          >
            <Plus className="h-4 w-4" /> {editingId ? 'Cancel Edit' : 'Log Maintenance'}
          </button>
          <ExportBar
            loading={loading}
            opts={{
              title: selectedIds.length > 0 ? 'Selected Machine Maintenance Logs' : 'Machine Maintenance Logs',
              subtitle: selectedIds.length > 0 ? `Exported ${selectedIds.length} selected items` : 'All Maintenance Records',
              filename: `maintenance_${selectedIds.length > 0 ? 'selected' : 'all'}`,
              columns: [
                { header: 'Department', key: 'department' },
                ...fields.map((f: any) => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
              ],
              rows: (selectedIds.length > 0 ? sortedRecords.filter(r => selectedIds.includes(r.id)) : sortedRecords).map(r => {
                const rowData: Record<string, any> = {
                  department: r.department?.name || 'N/A'
                };
                fields.forEach((f: any) => {
                  const normName = f.name.toLowerCase().trim();
                  if (normName === 'maintenance date') {
                    rowData[f.name] = new Date(r.entry_date).toLocaleDateString();
                  } else if (normName === 'machine') {
                    rowData[f.name] = r.payload?._machine || 'N/A';
                  } else if (normName === 'maintenance type') {
                    rowData[f.name] = r.payload?._maintenance_type || '—';
                  } else if (normName === 'status') {
                    rowData[f.name] = r.payload?._status || 'completed';
                  } else {
                    const val = r.payload?.[f.name];
                    let displayVal = val;
                    if (f.type === 'boolean') {
                      displayVal = val === 'ok' ? 'OK' : val === 'issue' ? 'Issue' : val;
                    }
                    rowData[f.name] = displayVal !== null && displayVal !== undefined && displayVal !== '' ? String(displayVal) : '—';
                  }
                });
                return rowData;
              })
            } as ExportOptions}
          />
        </div>
      </div>

      {/* Log Entry Form */}
      {showEntry && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm animate-in fade-in duration-100">
          <h3 className="text-lg font-medium text-text-primary mb-4">Log Maintenance Activity</h3>
          <form onSubmit={handleSubmitEntry} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-secondary uppercase">Department</label>
                <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white" value={selectedDepartmentId} onChange={e => setSelectedDepartmentId(e.target.value)}>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fields.map((field: any, idx: number) => {
                const normName = field.name.toLowerCase().trim();
                
                if (normName === 'maintenance date') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Maintenance Date</label>
                      <input required type="date" className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                    </div>
                  );
                }
                
                if (normName === 'machine') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Machine</label>
                      <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-semibold" value={selectedMachineId} onChange={e => setSelectedMachineId(e.target.value)}>
                        <option value="">Select Machine</option>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  );
                }
                
                if (normName === 'maintenance type') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Maintenance Type</label>
                      <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-semibold" value={selectedMaintType} onChange={e => setSelectedMaintType(e.target.value)}>
                        <option value="">Select Maintenance Type</option>
                        {maintenanceTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  );
                }
                
                if (normName === 'status') {
                  return (
                    <div key={idx}>
                      <label className="block text-sm font-semibold text-text-secondary uppercase">Status</label>
                      <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-semibold" value={entryStatus} onChange={e => setEntryStatus(e.target.value)}>
                        <option value="completed">completed</option>
                        <option value="open">open</option>
                        <option value="partially completed">partially completed</option>
                        <option value="parts missing">parts missing</option>
                      </select>
                    </div>
                  );
                }
                
                return (
                  <div key={idx}>
                    <label className="block text-sm font-semibold text-text-secondary uppercase">{field.name} {field.unit && `(${field.unit})`}</label>
                    {field.type === 'boolean' ? (
                      <select required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm bg-white font-semibold text-text-primary" value={entryPayload[field.name] || ''} onChange={e => setEntryPayload(p => ({ ...p, [field.name]: e.target.value }))}>
                        <option value="">Select</option>
                        <option value="ok">OK ✓</option>
                        <option value="issue">Issue Found</option>
                      </select>
                    ) : (
                      <input type={field.type === 'number' ? 'number' : 'text'} step="any" required className="mt-1 block w-full border border-border rounded-md px-3 py-2 text-sm font-semibold" value={entryPayload[field.name] || ''} onChange={e => setEntryPayload(p => ({ ...p, [field.name]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex gap-2">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary-light shadow-sm">
                {editingId ? 'Save Changes' : 'Submit Record'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-100 text-text-secondary px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-text-primary">Maintenance Log</h2>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm gap-1 transition-colors"
              >
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
          <span className="text-sm text-text-secondary">{sortedRecords.length} records</span>
        </div>

        {sortedRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-text-secondary">No maintenance records yet. Use "Log Maintenance" to start.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface">
                <tr>
                  <th className="w-12 px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={sortedRecords.filter(r => canModify(r)).length > 0 && selectedIds.length === sortedRecords.filter(r => canModify(r)).length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </th>
                  {renderSortableHeader('department', 'Department')}
                  {fields.map((field: any, idx: number) => 
                    renderSortableHeader(field.name, field.name + (field.unit ? ` (${field.unit})` : ''))
                  )}
                  <th className="px-6 py-3 text-right text-xs font-semibold text-text-secondary uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
                {sortedRecords.map(record => {
                  const modifiable = canModify(record);
                  return (
                    <tr 
                      key={record.id} 
                      onClick={() => setSelectedRecord(record)}
                      className="hover:bg-surface/50 cursor-pointer transition-colors"
                      title="Click to view details"
                    >
                      <td className="w-12 px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled={!modifiable}
                          checked={selectedIds.includes(record.id)}
                          onChange={() => handleToggleSelect(record.id)}
                          className={clsx(
                            "rounded h-4 w-4 cursor-pointer",
                            modifiable 
                              ? "border-border text-primary focus:ring-primary" 
                              : "border-gray-200 text-gray-300 cursor-not-allowed opacity-55"
                          )}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{record.department?.name || 'N/A'}</td>
                      {fields.map((field: any, idx: number) => {
                        const normName = field.name.toLowerCase().trim();
                        if (normName === 'maintenance date') {
                          return (
                            <td key={idx} className="px-6 py-4 text-sm text-text-primary font-medium tabular-nums">
                              {new Date(record.entry_date).toLocaleDateString()}
                            </td>
                          );
                        }
                        if (normName === 'machine') {
                          return (
                            <td key={idx} className="px-6 py-4 text-sm text-text-secondary font-semibold">
                              {record.payload?._machine || 'N/A'}
                            </td>
                          );
                        }
                        if (normName === 'maintenance type') {
                          return (
                            <td key={idx} className="px-6 py-4 text-sm text-text-secondary font-medium">
                              {record.payload?._maintenance_type || '—'}
                            </td>
                          );
                        }
                        if (normName === 'status') {
                          return (
                            <td key={idx} className="px-6 py-4">
                              {getStatusBadge(record.payload?._status)}
                            </td>
                          );
                        }
                        
                        const val = record.payload?.[field.name];
                        let displayVal = val;
                        if (field.type === 'boolean') {
                          displayVal = val === 'ok' ? 'OK ✓' : val === 'issue' ? 'Issue ⚠' : val;
                        }
                        return (
                          <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium">
                            {displayVal !== null && displayVal !== undefined && displayVal !== '' ? String(displayVal) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {modifiable && (
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeDropdown?.id === record.id) {
                                  setActiveDropdown(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setActiveDropdown({
                                    id: record.id,
                                    top: rect.bottom + 4,
                                    left: rect.right - 112
                                  });
                                }
                              }}
                              className="p-1 rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors focus:outline-none"
                              title="Actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeDropdown?.id === record.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveDropdown(null)} 
                                />
                                <div 
                                  style={{
                                    position: 'fixed',
                                    top: activeDropdown ? `${activeDropdown.top}px` : undefined,
                                    left: activeDropdown ? `${activeDropdown.left}px` : undefined,
                                  }}
                                  className="w-28 bg-white rounded-md border border-border shadow-lg z-50 py-1"
                                >
                                  <button
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      handleStartEdit(record);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface transition-colors"
                                  >
                                    <Edit className="h-3.5 w-3.5 text-text-secondary" /> Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      handleDelete(record.id);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-danger" /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Record Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-card max-w-lg w-full p-6 shadow-xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Maintenance Log Details</h3>
                <p className="text-xs text-text-secondary mt-0.5">Machine checklist execution report</p>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-text-secondary hover:text-text-primary p-1.5 rounded-full hover:bg-surface transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-4 bg-surface p-4 rounded-lg text-sm border border-border/55">
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Date</span>
                  <span className="font-medium text-text-primary tabular-nums mt-0.5 block">{new Date(selectedRecord.entry_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Status</span>
                  <div className="mt-1">
                    {getStatusBadge(selectedRecord.payload?._status)}
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Machine</span>
                  <span className="font-semibold text-primary mt-0.5 block">{selectedRecord.payload?._machine || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Department</span>
                  <span className="font-semibold text-text-primary mt-0.5 block">{selectedRecord.department?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Maintenance Type</span>
                  <span className="font-semibold text-text-primary mt-0.5 block">{selectedRecord.payload?._maintenance_type || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-text-secondary uppercase">Format Config</span>
                  <span className="font-medium text-text-primary mt-0.5 block">{selectedRecord.format_version?.format?.name || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-primary border-b border-border/60 pb-1.5 uppercase tracking-wider text-xs">Logged Values (in Schema Sequence)</h4>
                <div className="divide-y divide-border/40">
                  {fields.map((f: any) => {
                    const normName = f.name.toLowerCase().trim();
                    let displayVal: React.ReactNode = '—';
                    if (normName === 'maintenance date') {
                      displayVal = <span className="text-sm font-mono text-text-secondary font-semibold tabular-nums">{new Date(selectedRecord.entry_date).toLocaleDateString()}</span>;
                    } else if (normName === 'machine') {
                      displayVal = <span className="font-semibold text-primary">{selectedRecord.payload?._machine || 'N/A'}</span>;
                    } else if (normName === 'maintenance type') {
                      displayVal = <span className="font-semibold text-text-primary">{selectedRecord.payload?._maintenance_type || '—'}</span>;
                    } else if (normName === 'status') {
                      displayVal = getStatusBadge(selectedRecord.payload?._status);
                    } else {
                      const val = selectedRecord.payload?.[f.name];
                      if (f.type === 'boolean') {
                        displayVal = val === 'ok' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                            <Check className="mr-1 h-3.5 w-3.5" /> OK
                          </span>
                        ) : val === 'issue' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Issue Found
                          </span>
                        ) : (
                          <span className="text-sm font-mono text-text-secondary font-semibold tabular-nums">{String(val)}</span>
                        );
                      } else {
                        displayVal = <span className="text-sm font-mono text-text-secondary font-semibold tabular-nums">{val !== null && val !== undefined && val !== '' ? String(val) : '—'}</span>;
                      }
                    }

                    return (
                      <div key={f.name} className="flex justify-between items-center py-2.5">
                        <span className="text-sm font-medium text-text-primary">{f.name} {f.unit && `(${f.unit})`}</span>
                        <div>{displayVal}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-6 flex justify-end">
              <button 
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-text-secondary rounded-md text-sm font-semibold transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
