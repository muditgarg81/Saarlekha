import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Send, FileText, Trash2, Edit, Plus, X } from 'lucide-react';
import { injectStandardFields, isStandardField } from '../../utils/standards';

interface FormatField {
  name: string;
  type: string;
  unit?: string;
  options?: string[];
  formula?: {
    left: string;
    operator: string;
    right: string;
  };
}

interface FormatVersion {
  id: string;
  version_num: number;
  fields_schema: FormatField[];
}

interface ReportFormat {
  id: string;
  name: string;
  type: string;
  versions: FormatVersion[];
}

export function DataEntry() {
  const [formats, setFormats] = useState<ReportFormat[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [manpower, setManpower] = useState<{id: string, name: string, department_id: string}[]>([]);
  const [machines, setMachines] = useState<{id: string, name: string, type?: string}[]>([]);
  const [customers, setCustomers] = useState<{id: string, name: string}[]>([]);
  const [jobOrders, setJobOrders] = useState<any[]>([]);
  const [items, setItems] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchParams] = useSearchParams();
  const initialFormatId = searchParams.get('formatId') || '';
  const initialDeptId = searchParams.get('departmentId') || '';
  const filterType = searchParams.get('type') || '';
  const entryId = searchParams.get('entryId') || '';

  // Selection state
  const [selectedFormatId, setSelectedFormatId] = useState(initialFormatId);
  const [selectedDepartment, setSelectedDepartment] = useState(initialDeptId);
  
  // Local Batch state
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [batchEntries, setBatchEntries] = useState<Record<string, any>[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSavedEntry, setEditingSavedEntry] = useState<any>(null);

  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchSingleEntry = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/entries/${id}`);
      const entry = res.data;
      setEditingSavedEntry(entry);
      setSelectedFormatId(entry.format_version?.format_id || entry.format_version?.format?.id);
      setSelectedDepartment(entry.department_id);
      setPayload(entry.payload || {});
    } catch (err) {
      console.error('Failed to load entry:', err);
      alert('Failed to load the selected report entry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entryId) {
      fetchSingleEntry(entryId);
    } else {
      setEditingSavedEntry(null);
      setPayload({});
      const fId = searchParams.get('formatId');
      if (fId) setSelectedFormatId(fId);
      const dId = searchParams.get('departmentId');
      if (dId) setSelectedDepartment(dId);
    }
  }, [entryId, searchParams]);

  const fetchData = async () => {
    try {
      const [formatsRes, deptsRes, manpowerRes, machinesRes, customersRes, jobOrdersRes, itemsRes] = await Promise.all([
        api.get('/reports/formats'),
        api.get('/departments'),
        api.get('/manpower'),
        api.get('/machines'),
        api.get('/customers'),
        api.get('/job-orders'),
        api.get('/items?status=ACTIVE')
      ]);
      const sortedJobOrders = (jobOrdersRes.data || []).sort((a: any, b: any) =>
        (a.order_number || '').localeCompare(b.order_number || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      setFormats(formatsRes.data);
      setDepartments(deptsRes.data);
      setManpower(manpowerRes.data);
      setMachines(machinesRes.data);
      setCustomers(customersRes.data);
      setJobOrders(sortedJobOrders);
      setItems(itemsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!entryId) setLoading(false);
    }
  };

  const filteredFormats = filterType
    ? formats.filter(f => f.type.toUpperCase() === filterType.toUpperCase())
    : formats;

  const activeFormat = formats.find(f => f.id === selectedFormatId);
  const activeSchema = activeFormat
    ? injectStandardFields(activeFormat.versions[0]?.fields_schema || [], activeFormat.type)
    : [];

  const evaluateReportCalculatedField = (
    field: FormatField,
    currentPayload: Record<string, any>,
    visited: Set<string> = new Set()
  ): number => {
    if (field.type !== 'calculated' || !field.formula) return 0;
    if (visited.has(field.name)) return 0;
    visited.add(field.name);

    const { left, operator, right } = field.formula;

    const getVal = (fieldName: string): number => {
      const targetField = activeSchema.find(f => f.name === fieldName);
      if (targetField && targetField.type === 'calculated') {
        return evaluateReportCalculatedField(targetField, currentPayload, visited);
      }
      const v = currentPayload[fieldName];
      if (v === '' || v === undefined || v === null) return 0;
      return Number(v) || 0;
    };

    const leftVal = getVal(left);
    const rightVal = getVal(right);

    let result = 0;
    switch (operator) {
      case '+': result = leftVal + rightVal; break;
      case '-': result = leftVal - rightVal; break;
      case '*': result = leftVal * rightVal; break;
      case '/': result = rightVal === 0 ? 0 : leftVal / rightVal; break;
      case '%': result = rightVal === 0 ? 0 : (leftVal / rightVal) * 100; break;
      default: result = 0;
    }

    visited.delete(field.name);
    return result;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setPayload(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleUpdateSavedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSchema.length === 0 || !entryId) return;

    // Validate inputs
    const missingFields = activeSchema.filter(field => {
      if (field.type === 'calculated') return false;
      if (isStandardField(field.name, activeFormat?.type || 'REPORT')) return false;
      const val = payload[field.name];
      return val === undefined || val === null || val === '';
    });

    if (missingFields.length > 0) {
      alert(`Please fill in all fields: ${missingFields.map(f => f.name).join(', ')}`);
      return;
    }

    // Compute all calculated field values
    const finalPayload = { ...payload };
    activeSchema.forEach(field => {
      if (field.type === 'calculated') {
        finalPayload[field.name] = evaluateReportCalculatedField(field, payload);
      }
    });

    try {
      await api.put(`/reports/entries/${entryId}`, {
        payload: finalPayload,
        department_id: selectedDepartment
      });
      alert('Report entry updated successfully!');
      window.history.back();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update report entry';
      alert(msg);
    }
  };

  const handleDeleteSavedEntry = async () => {
    if (!entryId) return;
    if (!window.confirm('Are you sure you want to delete this report entry?')) return;
    
    try {
      await api.delete(`/reports/entries/${entryId}`);
      alert('Report entry deleted successfully!');
      window.history.back();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to delete report entry';
      alert(msg);
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSchema.length === 0) return;

    // Validate inputs
    const missingFields = activeSchema.filter(field => {
      if (field.type === 'calculated') return false;
      if (isStandardField(field.name, activeFormat?.type || 'REPORT')) return false;
      const val = payload[field.name];
      return val === undefined || val === null || val === '';
    });

    if (missingFields.length > 0) {
      alert(`Please fill in all fields: ${missingFields.map(f => f.name).join(', ')}`);
      return;
    }

    // Compute all calculated field values
    const finalPayload = { ...payload };
    activeSchema.forEach(field => {
      if (field.type === 'calculated') {
        finalPayload[field.name] = evaluateReportCalculatedField(field, payload);
      }
    });

    if (editingIndex !== null) {
      // Update existing row
      const updated = [...batchEntries];
      updated[editingIndex] = finalPayload;
      setBatchEntries(updated);
      setEditingIndex(null);
    } else {
      // Add new row
      setBatchEntries([...batchEntries, finalPayload]);
    }

    // Reset current form inputs
    setPayload({});
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    if (editingSavedEntry) {
      handleUpdateSavedEntry(e);
    } else {
      handleAddEntry(e);
    }
  };

  const handleEditRow = (index: number) => {
    setEditingIndex(index);
    setPayload(batchEntries[index]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = batchEntries.filter((_, i) => i !== index);
    setBatchEntries(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
      setPayload({});
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setPayload({});
  };

  const handleSubmitBatch = async () => {
    if (batchEntries.length === 0) {
      alert('Please add at least one entry to the batch first.');
      return;
    }
    if (!activeFormat || !selectedDepartment) return;

    try {
      const payloadBatch = batchEntries.map(entry => ({
        format_version_id: activeFormat.versions[0].id,
        department_id: selectedDepartment,
        entry_date: new Date().toISOString(),
        payload: entry
      }));

      await api.post('/reports/entries', payloadBatch);
      alert('All report entries submitted successfully!');
      setBatchEntries([]);
      setPayload({});
      setEditingIndex(null);
      setSelectedFormatId('');
      setSelectedDepartment('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to submit reports';
      const details = err.response?.data?.details;
      alert(details ? `${msg}: ${details}` : msg);
    }
  };

  if (loading) return <div className="p-4 text-text-secondary">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full px-1 sm:px-0">
      <div className="flex items-center border-b border-border pb-4 mb-6">
        <FileText className="h-8 w-8 text-primary mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {editingSavedEntry ? 'Edit Report Entry' : 'Data Log Entry'}
          </h1>
          <p className="text-sm text-text-secondary">
            {editingSavedEntry ? 'Modify the saved report parameters.' : 'Fill out operational reports in batches.'}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-card border border-border shadow-sm space-y-6 sm:space-y-8">
        {editingSavedEntry && (
          <div className="bg-blue-50 border border-blue-200 text-primary p-3 rounded-md text-xs font-semibold flex items-center justify-between">
            <span>You are editing a saved report entry. Format and department cannot be modified.</span>
            <button 
              type="button" 
              onClick={() => window.history.back()}
              className="text-primary hover:underline"
            >
              Cancel & Go Back
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pb-6 border-b border-border">
          <div>
            <label className="block text-sm font-semibold text-text-secondary uppercase mb-2">Select Department</label>
            <select 
              disabled={!!editingSavedEntry}
              className="block w-full border border-border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm disabled:opacity-60 disabled:bg-gray-50"
              value={selectedDepartment}
              onChange={e => {
                setSelectedDepartment(e.target.value);
                setBatchEntries([]);
                setPayload({});
                setEditingIndex(null);
              }}
            >
              <option value="">-- Choose Department --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary uppercase mb-2">Select Report Format</label>
            <select 
              disabled={!!editingSavedEntry}
              className="block w-full border border-border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm disabled:opacity-60 disabled:bg-gray-50"
              value={selectedFormatId}
              onChange={e => {
                setSelectedFormatId(e.target.value);
                setBatchEntries([]);
                setPayload({});
                setEditingIndex(null);
              }}
            >
              <option value="">-- Choose Format --</option>
              {filteredFormats.map(f => (
                <option key={f.id} value={f.id}>{f.name} (v{f.versions[0]?.version_num || 0})</option>
              ))}
            </select>
          </div>
        </div>

        {activeFormat && selectedDepartment && (
          <div className="space-y-8">
            {/* Form row section */}
            <form onSubmit={handleSubmitForm} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-text-primary">
                  {editingSavedEntry 
                    ? `Edit Entry for ${activeFormat.name}`
                    : editingIndex !== null 
                      ? 'Edit Row Entry' 
                      : 'Add Row Entry'} for {activeFormat.name}
                </h3>
                {editingIndex !== null && !editingSavedEntry && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary bg-gray-100 px-2 py-1 rounded"
                  >
                    <X className="h-3 w-3" /> Cancel Edit
                  </button>
                )}
              </div>
              
              {activeSchema.length === 0 ? (
                <p className="text-text-secondary italic">This format has no fields defined yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 bg-surface p-4 sm:p-6 rounded-lg border border-border w-full max-w-full overflow-hidden">
                  {activeSchema.map((field, idx) => {
                    const normName = field.name.toLowerCase().trim();
                    if (normName === 'date') {
                      return (
                        <div key={idx} className="flex flex-col min-w-0">
                          <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            disabled
                            className="mt-1 block w-full border border-border bg-gray-50 rounded-lg px-3 py-2 text-sm text-text-secondary font-semibold cursor-not-allowed"
                            value={editingSavedEntry ? new Date(editingSavedEntry.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      );
                    }
                    if (normName === 'department') {
                      return (
                        <div key={idx} className="flex flex-col min-w-0">
                          <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                            Department
                          </label>
                          <input
                            type="text"
                            disabled
                            className="mt-1 block w-full border border-border bg-gray-50 rounded-lg px-3 py-2 text-sm text-text-secondary font-semibold cursor-not-allowed"
                            value={departments.find(d => d.id === selectedDepartment)?.name || ''}
                          />
                        </div>
                      );
                    }
                    if (normName === 'logged by') {
                      return (
                        <div key={idx} className="flex flex-col min-w-0">
                          <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                            Logged By
                          </label>
                          <input
                            type="text"
                            disabled
                            className="mt-1 block w-full border border-border bg-gray-50 rounded-lg px-3 py-2 text-sm text-text-secondary font-semibold cursor-not-allowed"
                            value={editingSavedEntry ? (editingSavedEntry.submitter?.email || '') : (user?.email || '')}
                          />
                        </div>
                      );
                    }

                    const isOperatorField = field.type === 'operator' || 
                      field.name.toLowerCase() === 'operator' || 
                      field.name.toLowerCase() === 'operator name' || 
                      field.name.toLowerCase() === 'operator_name';
                      
                    const isMachineField = field.type === 'machine' || 
                      field.name.toLowerCase() === 'machine' || 
                      field.name.toLowerCase() === 'machine no' || 
                      field.name.toLowerCase() === 'machine name' || 
                      field.name.toLowerCase() === 'loom' || 
                      field.name.toLowerCase() === 'loom no' || 
                      field.name.toLowerCase() === 'loom number';
                      
                    return (
                      <div key={idx} className="flex flex-col min-w-0">
                        <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                          {field.name} {field.unit && <span className="text-primary text-[10px] ml-1">({field.unit})</span>}
                        </label>
                        
                        {isOperatorField ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Operator...</option>
                            {(() => {
                              const filtered = manpower.filter(m => m.department_id === selectedDepartment);
                              const list = filtered.length > 0 ? filtered : manpower;
                              return list.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ));
                            })()}
                          </select>
                        ) : isMachineField ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Machine...</option>
                            {(() => {
                              const isLoom = field.name.toLowerCase().includes('loom') || field.type === 'loom';
                              const filtered = isLoom 
                                ? machines.filter(m => m.name.toLowerCase().includes('loom') || m.type?.toLowerCase().includes('loom'))
                                : machines;
                              const list = filtered.length > 0 ? filtered : machines;
                              return list.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                              ));
                            })()}
                          </select>
                        ) : field.type === 'department' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Department...</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        ) : field.type === 'client' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Client...</option>
                            {customers.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        ) : field.type === 'job_order' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Job Order...</option>
                            {jobOrders.map(jo => (
                              <option key={jo.id} value={jo.order_number}>
                                {jo.order_number} {jo.customer?.name ? `(${jo.customer.name})` : ''}{jo.item?.name || jo.custom_item ? ` - ${jo.item?.name || jo.custom_item}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'item' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select Item...</option>
                            {items.map(it => (
                              <option key={it.id} value={it.name}>{it.name}</option>
                            ))}
                          </select>
                        ) : field.type === 'dropdown' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          >
                            <option value="">Select {field.name}...</option>
                            {field.options?.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'boolean' ? (
                          <select 
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                            value={payload[field.name] !== undefined ? String(payload[field.name]) : ''}
                            onChange={e => handleFieldChange(field.name, e.target.value === 'true')}
                          >
                            <option value="">Select...</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : field.type === 'calculated' ? (
                          <div className="relative mt-1">
                            <input
                              type="text"
                              readOnly
                              disabled
                              className="block w-full border border-border bg-gray-50 rounded-lg px-3 py-2 text-sm text-text-secondary font-semibold cursor-not-allowed"
                              value={(() => {
                                const val = evaluateReportCalculatedField(field, payload);
                                return isNaN(val) || !isFinite(val) ? '0' : String(Number(val.toFixed(4)));
                              })()}
                            />
                            {field.formula && (
                              <span className="text-[10px] text-primary/70 font-medium block mt-1">
                                Formula: {field.formula.left} {field.formula.operator} {field.formula.right}
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            required
                            className="mt-1 block w-full border border-border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            value={payload[field.name] !== undefined ? payload[field.name] : ''}
                            onChange={e => handleFieldChange(field.name, field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

               <div className="flex justify-end gap-3">
                {editingSavedEntry && (
                  <>
                    {(user?.role !== 'OPERATIONS' || editingSavedEntry.submitted_by === user?.id) && (
                      <button
                        type="button"
                        onClick={handleDeleteSavedEntry}
                        className="inline-flex items-center px-4 py-2 border border-transparent bg-danger hover:bg-red-700 rounded-lg shadow-sm text-sm font-semibold text-white transition-all mr-auto"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Delete Entry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.history.back()}
                      className="inline-flex items-center px-4 py-2 border border-border bg-white rounded-lg shadow-sm text-sm font-semibold text-text-secondary hover:bg-surface transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  type="submit"
                  disabled={activeSchema.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-light disabled:opacity-50 transition-all"
                >
                  {editingSavedEntry ? (
                    <>Save Changes</>
                  ) : (
                    <>
                      <Plus className="mr-1.5 h-4 w-4" />
                      {editingIndex !== null ? 'Update Row' : 'Add Row'}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Preview table section */}
            {!editingSavedEntry && batchEntries.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-border">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-text-primary">
                    Pending Entries Batch ({batchEntries.length} rows)
                  </h3>
                  <span className="text-xs text-text-secondary bg-primary/10 px-2 py-0.5 rounded font-medium">
                    Local Preview
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-surface">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">#</th>
                        {activeSchema.map((field, idx) => (
                          <th key={idx} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">
                            {field.name} {field.unit && `(${field.unit})`}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {batchEntries.map((entry, index) => (
                        <tr key={index} className={editingIndex === index ? 'bg-primary/5' : 'hover:bg-surface transition-colors'}>
                          <td className="px-4 py-3 font-medium text-text-secondary">{index + 1}</td>
                          {activeSchema.map((field, idx) => {
                            const normName = field.name.toLowerCase().trim();
                            let displayVal = entry[field.name];
                            if (normName === 'date') {
                              displayVal = new Date().toLocaleDateString();
                            } else if (normName === 'department') {
                              displayVal = departments.find(d => d.id === selectedDepartment)?.name || '';
                            } else if (normName === 'logged by') {
                              displayVal = user?.email || '';
                            } else if (field.type === 'boolean') {
                              displayVal = displayVal === true ? 'Yes' : displayVal === false ? 'No' : '';
                            }
                            return (
                              <td key={idx} className="px-4 py-3 text-text-primary font-medium">
                                {displayVal !== null && displayVal !== undefined && displayVal !== '' ? String(displayVal) : '—'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => handleEditRow(index)}
                              className="text-primary hover:text-primary-light p-1 rounded inline-flex items-center"
                              title="Edit Entry Row"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(index)}
                              className="text-text-secondary hover:text-danger p-1 rounded inline-flex items-center"
                              title="Delete Entry Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 flex justify-between items-center bg-surface p-4 rounded-lg border border-border">
                  <div className="text-xs text-text-secondary">
                    Review the queue above. Click submit to permanently save all entries to the database.
                  </div>
                  <button
                    onClick={handleSubmitBatch}
                    className="inline-flex items-center px-6 py-2.5 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-secondary hover:bg-secondary-light transition-all"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Batch ({batchEntries.length} records)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
