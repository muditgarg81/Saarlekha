import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, ListPlus, Settings2, Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
import clsx from 'clsx';
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

export function ReportBuilder() {
  const [formats, setFormats] = useState<ReportFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // New Format State
  const [showNewFormat, setShowNewFormat] = useState(false);
  const [newFormatName, setNewFormatName] = useState('');
  const [newFormatType, setNewFormatType] = useState('QUALITY');

  // Edit Format State (Add Field interaction)
  const [activeFormat, setActiveFormat] = useState<ReportFormat | null>(null);
  const [formatName, setFormatName] = useState('');
  const [fields, setFields] = useState<FormatField[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldFormulaLeft, setNewFieldFormulaLeft] = useState('');
  const [newFieldFormulaOperator, setNewFieldFormulaOperator] = useState('-');
  const [newFieldFormulaRight, setNewFieldFormulaRight] = useState('');

  // Editing Field State
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);
  const [editingFieldName, setEditingFieldName] = useState('');
  const [editingFieldType, setEditingFieldType] = useState('text');
  const [editingFieldUnit, setEditingFieldUnit] = useState('');
  const [editingFieldOptions, setEditingFieldOptions] = useState('');
  const [editingFieldFormulaLeft, setEditingFieldFormulaLeft] = useState('');
  const [editingFieldFormulaOperator, setEditingFieldFormulaOperator] = useState('-');
  const [editingFieldFormulaRight, setEditingFieldFormulaRight] = useState('');

  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  const getNumericOperandOptions = (currentFields: FormatField[], excludeIdx?: number | null) => {
    const list: { value: string; label: string }[] = [];
    currentFields.forEach((f, idx) => {
      if (excludeIdx !== undefined && excludeIdx !== null && idx === excludeIdx) return;
      if (f.type === 'number' || f.type === 'calculated') {
        list.push({ value: f.name, label: f.name });
      }
    });
    return list;
  };

  useEffect(() => {
    fetchFormats();
  }, []);

  const fetchFormats = async () => {
    try {
      const res = await api.get('/reports/formats');
      const filtered = res.data.filter((f: any) => f.type !== 'JOB_ORDER' && f.type !== 'MAINTENANCE');
      setFormats(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditFormat = (format: ReportFormat) => {
    setActiveFormat(format);
    setFormatName(format.name);
    const rawFields = format.versions[0]?.fields_schema ? [...format.versions[0].fields_schema] : [];
    setFields(injectStandardFields(rawFields, format.type));
    setEditingFieldIdx(null);
    setNewFieldName('');
    setNewFieldUnit('');
  };

  const handleCreateFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/reports/formats', {
        name: newFormatName,
        type: newFormatType,
        initialFields: [] // Start empty, force them to use "add field"
      });
      setShowNewFormat(false);
      setNewFormatName('');
      fetchFormats();
    } catch (err) {
      alert('Failed to create format');
    }
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFormat || !newFieldName.trim()) return;

    const trimmedName = newFieldName.trim();
    if (isStandardField(trimmedName, activeFormat.type)) {
      alert(`"${trimmedName}" is a standard built-in column on all reports. Do not recreate it as a custom field.`);
      return;
    }

    if (fields.some(f => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A field with this name already exists in this format.');
      return;
    }

    let options: string[] | undefined = undefined;
    if (newFieldType === 'dropdown') {
      const parsed = newFieldOptions.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length === 0) {
        alert('Please specify at least one option for the dropdown.');
        return;
      }
      options = parsed;
    }

    let formula: any = undefined;
    if (newFieldType === 'calculated') {
      if (!newFieldFormulaLeft || !newFieldFormulaRight) {
        alert('Please define both operands for the formula.');
        return;
      }
      formula = {
        left: newFieldFormulaLeft,
        operator: newFieldFormulaOperator,
        right: newFieldFormulaRight
      };
    }

    setFields([...fields, { name: trimmedName, type: newFieldType, unit: newFieldUnit.trim() || undefined, options, formula }]);
    setNewFieldName('');
    setNewFieldUnit('');
    setNewFieldOptions('');
    setNewFieldFormulaLeft('');
    setNewFieldFormulaOperator('-');
    setNewFieldFormulaRight('');
  };

  const handleStartEditField = (idx: number, field: FormatField) => {
    setEditingFieldIdx(idx);
    setEditingFieldName(field.name);
    setEditingFieldType(field.type);
    setEditingFieldUnit(field.unit || '');
    setEditingFieldOptions(field.options ? field.options.join(', ') : '');
    setEditingFieldFormulaLeft(field.formula?.left || '');
    setEditingFieldFormulaOperator(field.formula?.operator || '-');
    setEditingFieldFormulaRight(field.formula?.right || '');
  };

  const handleCancelEditField = () => {
    setEditingFieldIdx(null);
    setEditingFieldOptions('');
  };

  const handleSaveEditField = (idx: number) => {
    if (!editingFieldName.trim()) return;

    const trimmedName = editingFieldName.trim();
    if (activeFormat && isStandardField(trimmedName, activeFormat.type)) {
      alert(`"${trimmedName}" is a standard built-in column on all reports. Do not recreate it as a custom field.`);
      return;
    }

    if (fields.some((f, i) => i !== idx && f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('Another field with this name already exists in this format.');
      return;
    }

    let options: string[] | undefined = undefined;
    if (editingFieldType === 'dropdown') {
      const parsed = editingFieldOptions.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length === 0) {
        alert('Please specify at least one option for the dropdown.');
        return;
      }
      options = parsed;
    }

    let formula: any = undefined;
    if (editingFieldType === 'calculated') {
      if (!editingFieldFormulaLeft || !editingFieldFormulaRight) {
        alert('Please define both operands for the formula.');
        return;
      }
      formula = {
        left: editingFieldFormulaLeft,
        operator: editingFieldFormulaOperator,
        right: editingFieldFormulaRight
      };
    }

    const updated = [...fields];
    updated[idx] = { 
      name: trimmedName, 
      type: editingFieldType, 
      unit: editingFieldUnit.trim() ? editingFieldUnit.trim() : undefined,
      options,
      formula
    };
    setFields(updated);
    setEditingFieldIdx(null);
    setEditingFieldOptions('');
  };

  const handleDeleteField = (idx: number) => {
    if (!confirm('Are you sure you want to delete this field from the format?')) return;
    const updated = fields.filter((_, i) => i !== idx);
    setFields(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    const updated = [...fields];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIndex, 0, draggedItem);
    setFields(updated);
    setDraggedIdx(null);
  };

  const handleSaveFormatSchema = async () => {
    if (!activeFormat || !formatName.trim()) return;
    try {
      // 1. If format name has changed, update it
      if (formatName.trim() !== activeFormat.name) {
        await api.put(`/reports/formats/${activeFormat.id}`, {
          name: formatName.trim()
        });
      }

      // 2. Save the fields schema version
      await api.post(`/reports/formats/${activeFormat.id}/versions`, {
        fields: fields
      });

      fetchFormats();
      setActiveFormat(null);
      alert('Report format updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save report format');
    }
  };

  const handleDeleteFormat = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the report format "${name}"? This will delete all versions.`)) return;

    try {
      await api.delete(`/reports/formats/${id}`);
      fetchFormats();
      if (activeFormat?.id === id) {
        setActiveFormat(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete report format');
    }
  };

  if (loading) return <div className="p-4">Loading report formats...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Report Builder</h1>
          <p className="text-sm text-text-secondary mt-1">Design data entry formats for Quality, Production, and Maintenance.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowNewFormat(!showNewFormat)}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" /> New Format
          </button>
        )}
      </div>

      {showNewFormat && (
        <div className="bg-white p-6 rounded-card border border-border shadow-sm">
          <h3 className="text-lg font-medium text-text-primary mb-4">Create New Report Format</h3>
          <form onSubmit={handleCreateFormat} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary">Format Name</label>
              <input required type="text" className="mt-1 block w-full border border-border rounded-md px-3 py-2" value={newFormatName} onChange={e => setNewFormatName(e.target.value)} />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-text-secondary">Type</label>
              <select className="mt-1 block w-full border border-border rounded-md px-3 py-2" value={newFormatType} onChange={e => setNewFormatType(e.target.value)}>
                <option value="QUALITY">Quality</option>
                <option value="PRODUCTION">Production</option>
              </select>
            </div>
            <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light h-[42px] text-sm font-semibold">
              Create
            </button>
          </form>
        </div>
      )}

      {/* Add Field Builder Pane */}
      {activeFormat && (
        <div className="bg-surface p-6 rounded-card border border-border shadow-inner">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-bold text-text-secondary uppercase">Report Format Name</label>
              <input
                type="text"
                required
                className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white font-semibold text-text-primary"
                value={formatName}
                onChange={e => setFormatName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary font-mono">
                Version {activeFormat.versions[0]?.version_num || 0}
              </span>
              <button 
                type="button"
                onClick={() => setActiveFormat(null)} 
                className="text-text-secondary hover:text-text-primary font-semibold text-sm border border-border px-3 py-1.5 rounded-lg bg-white"
              >
                Close Editor
              </button>
            </div>
          </div>


          {/* Existing Fields */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wider text-xs">Current Fields</h4>
            <div className="space-y-2">
              {fields.length === 0 ? (
                <p className="text-sm italic text-gray-500">No fields defined yet.</p>
              ) : (
                fields.map((f, idx) => (
                  <div 
                    key={idx} 
                    draggable={isAdmin}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={clsx(
                      "flex items-center bg-white p-3 rounded border border-border shadow-sm transition-all duration-200 select-none",
                      isAdmin && "cursor-grab active:cursor-grabbing hover:border-primary/50",
                      draggedIdx === idx && "opacity-40 bg-gray-50 border-dashed border-primary"
                    )}
                  >
                    {isAdmin && (
                      <GripVertical className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                    )}
                    <Settings2 className="h-5 w-5 text-gray-400 mr-3" />
                    {editingFieldIdx === idx ? (
                      <div className="flex-1 flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase">Field Name</label>
                          <input type="text" className="border border-border rounded px-2 py-1 text-sm w-full focus:ring-primary focus:border-primary mt-1" value={editingFieldName} onChange={e => setEditingFieldName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase">Type</label>
                          <select className="border border-border rounded px-2 py-1 text-sm focus:ring-primary focus:border-primary mt-1" value={editingFieldType} onChange={e => setEditingFieldType(e.target.value)}>
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                            <option value="dropdown">Dropdown (Custom)</option>
                            <option value="operator">Operator (Dropdown)</option>
                            <option value="machine">Machine/Loom (Dropdown)</option>
                            <option value="client">Client (Dropdown)</option>
                            <option value="job_order">Job Order Number (Dropdown)</option>
                            <option value="item">Items (Dropdown)</option>
                            <option value="calculated">Calculated (Formula)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase">Unit</label>
                          <input type="text" placeholder="Unit" className="border border-border rounded px-2 py-1 text-sm w-24 focus:ring-primary focus:border-primary mt-1" value={editingFieldUnit} onChange={e => setEditingFieldUnit(e.target.value)} />
                        </div>
                        {editingFieldType === 'dropdown' && (
                          <div className="w-full mt-2">
                            <label className="block text-[10px] font-semibold text-text-secondary uppercase">Dropdown Options (comma-separated)</label>
                            <input type="text" placeholder="e.g. Option A, Option B, Option C" className="border border-border rounded px-2 py-1.5 text-sm w-full focus:ring-primary focus:border-primary mt-1 bg-white" value={editingFieldOptions} onChange={e => setEditingFieldOptions(e.target.value)} />
                          </div>
                        )}
                        {editingFieldType === 'calculated' && (
                          <div className="w-full mt-2 p-3 bg-gray-50 rounded border border-border/60">
                            <label className="block text-[10px] font-bold text-text-primary uppercase mb-1">Configure Formula</label>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="font-semibold text-text-secondary">{editingFieldName || 'Field'} = </span>
                              <select 
                                className="border border-border rounded px-2 py-1 bg-white"
                                value={editingFieldFormulaLeft}
                                onChange={e => setEditingFieldFormulaLeft(e.target.value)}
                              >
                                <option value="">Select Operand...</option>
                                {getNumericOperandOptions(fields, editingFieldIdx).map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <select 
                                className="border border-border rounded px-2 py-1 bg-white font-bold"
                                value={editingFieldFormulaOperator}
                                onChange={e => setEditingFieldFormulaOperator(e.target.value)}
                              >
                                <option value="+">+</option>
                                <option value="-">-</option>
                                <option value="*">*</option>
                                <option value="/">/</option>
                                <option value="%">% (Percentage)</option>
                              </select>
                              <select 
                                className="border border-border rounded px-2 py-1 bg-white"
                                value={editingFieldFormulaRight}
                                onChange={e => setEditingFieldFormulaRight(e.target.value)}
                              >
                                <option value="">Select Operand...</option>
                                {getNumericOperandOptions(fields, editingFieldIdx).map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1.5 ml-2 pb-1">
                          <button type="button" onClick={() => handleSaveEditField(idx)} className="text-green-600 hover:text-green-800 p-1.5 rounded hover:bg-green-50" title="Save Changes"><Check className="h-4 w-4" /></button>
                          <button type="button" onClick={handleCancelEditField} className="text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100" title="Cancel"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <span className="font-medium text-text-primary">{f.name}</span>
                          <span className="ml-2 text-xs text-text-secondary uppercase px-2 py-0.5 bg-gray-100 rounded">
                            {isStandardField(f.name, activeFormat.type) ? 'Standard' : f.type}
                          </span>
                          {f.unit && <span className="ml-2 text-xs text-secondary">({f.unit})</span>}
                          {f.type === 'dropdown' && f.options && (
                            <div className="text-xs text-text-secondary mt-1 font-medium bg-gray-50 px-2 py-1 rounded border border-border/40 inline-block">
                              Options: {f.options.join(', ')}
                            </div>
                          )}
                          {f.type === 'calculated' && f.formula && (
                            <div className="text-xs text-primary mt-1 font-semibold bg-blue-50/70 px-2 py-1 rounded border border-blue-100 inline-block">
                              Formula: {f.name} = {f.formula.left || '?'} {f.formula.operator} {f.formula.right || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!isStandardField(f.name, activeFormat.type) && (
                            <>
                              <button type="button" onClick={() => handleStartEditField(idx, f)} className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50" title="Edit field"><Edit2 className="h-4 w-4" /></button>
                              <button type="button" onClick={() => handleDeleteField(idx)} className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50" title="Delete field"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Field Form */}
          <form onSubmit={handleAddField} className="bg-white p-4 rounded-md border border-border shadow-sm">
            <h4 className="text-sm font-medium text-text-primary mb-4 flex items-center">
              <ListPlus className="mr-2 h-4 w-4 text-primary" />
              + Add Field
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-text-secondary">Field Name</label>
                <input required type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary">Data Type</label>
                <select className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                  <option value="dropdown">Dropdown (Custom)</option>
                  <option value="operator">Operator (Dropdown)</option>
                  <option value="machine">Machine/Loom (Dropdown)</option>
                  <option value="client">Client (Dropdown)</option>
                  <option value="job_order">Job Order Number (Dropdown)</option>
                  <option value="item">Items (Dropdown)</option>
                  <option value="calculated">Calculated (Formula)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary">Unit (Optional)</label>
                <input type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary" value={newFieldUnit} onChange={e => setNewFieldUnit(e.target.value)} />
              </div>
            </div>
            {newFieldType === 'dropdown' && (
              <div className="mt-4">
                <label className="block text-xs font-semibold text-text-secondary uppercase">Dropdown Options (comma-separated)</label>
                <input required type="text" placeholder="e.g. Option A, Option B, Option C" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white font-semibold" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} />
              </div>
            )}
            {newFieldType === 'calculated' && (
              <div className="mt-4 p-4 bg-gray-50 rounded border border-border/60">
                <label className="block text-xs font-bold text-text-primary uppercase mb-2">Configure Formula</label>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-text-secondary">{newFieldName || 'Field'} = </span>
                  <select 
                    className="border border-border rounded px-3 py-2 bg-white"
                    value={newFieldFormulaLeft}
                    onChange={e => setNewFieldFormulaLeft(e.target.value)}
                  >
                    <option value="">Select Operand...</option>
                    {getNumericOperandOptions(fields).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select 
                    className="border border-border rounded px-3 py-2 bg-white font-bold"
                    value={newFieldFormulaOperator}
                    onChange={e => setNewFieldFormulaOperator(e.target.value)}
                  >
                    <option value="+">+</option>
                    <option value="-">-</option>
                    <option value="*">*</option>
                    <option value="/">/</option>
                    <option value="%">% (Percentage)</option>
                  </select>
                  <select 
                    className="border border-border rounded px-3 py-2 bg-white"
                    value={newFieldFormulaRight}
                    onChange={e => setNewFieldFormulaRight(e.target.value)}
                  >
                    <option value="">Select Operand...</option>
                    {getNumericOperandOptions(fields).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md text-sm hover:bg-primary-light transition-colors font-semibold">
                Add Field
              </button>
            </div>
          </form>

          {/* Action Buttons to save or cancel */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border mt-6 bg-transparent">
            <button
              type="button"
              onClick={() => setActiveFormat(null)}
              className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-all font-medium bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveFormatSchema}
              className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-light transition-all shadow-sm"
            >
              Save Format
            </button>
          </div>
        </div>
      )}

      {/* Formats List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formats.map((format) => (
          <div key={format.id} className="bg-white rounded-card border border-border shadow-sm p-6 relative flex flex-col hover:shadow-md transition-shadow">
            {isAdmin && format.type !== 'JOB_ORDER' && format.type !== 'MAINTENANCE' && (
              <button 
                onClick={() => handleDeleteFormat(format.id, format.name)} 
                className="absolute top-4 right-4 text-danger hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                title="Delete Format"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-text-primary mb-1 truncate pr-8">{format.name}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 uppercase tracking-wide mb-4">
                {format.type}
              </span>
              <div className="text-sm text-text-secondary">
                <p>Latest Version: v{format.versions[0]?.version_num || 0}</p>
                <p>Fields: {format.versions[0]?.fields_schema?.length || 0}</p>
              </div>
            </div>
            
            {isAdmin && (
              <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
                <button 
                  onClick={() => handleStartEditFormat(format)}
                  className="text-primary hover:text-primary-light text-sm font-semibold inline-flex items-center"
                >
                  <ListPlus className="mr-1 h-4 w-4" /> Edit Fields
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
