import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, ListPlus, Settings2, Trash2, Edit2, Check, X, ClipboardList, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import { injectStandardFields, isStandardField } from '../../utils/standards';

interface FormatField {
  name: string;
  type: string;
  unit?: string;
  open?: boolean;
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

export function JobOrderColumnsMaster() {
  const [format, setFormat] = useState<ReportFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Add Field State
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldFormulaLeft, setNewFieldFormulaLeft] = useState('order_qty');
  const [newFieldFormulaOperator, setNewFieldFormulaOperator] = useState('-');
  const [newFieldFormulaRight, setNewFieldFormulaRight] = useState('production_qty');

  // Editing Field State
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);
  const [editingFieldName, setEditingFieldName] = useState('');
  const [editingFieldType, setEditingFieldType] = useState('text');
  const [editingFieldUnit, setEditingFieldUnit] = useState('');
  const [editingFieldOpen, setEditingFieldOpen] = useState(false);
  const [editingFieldOptions, setEditingFieldOptions] = useState('');
  const [editingFieldFormulaLeft, setEditingFieldFormulaLeft] = useState('order_qty');
  const [editingFieldFormulaOperator, setEditingFieldFormulaOperator] = useState('-');
  const [editingFieldFormulaRight, setEditingFieldFormulaRight] = useState('production_qty');

  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  const getNumericOperandOptions = (currentFields: FormatField[], excludeIdx?: number | null) => {
    const list = [
      { value: 'order_qty', label: 'Order Qty (Standard)' },
      { value: 'production_qty', label: 'Production Qty (Standard)' }
    ];
    
    currentFields.forEach((f, idx) => {
      if (excludeIdx !== undefined && excludeIdx !== null && idx === excludeIdx) return;
      if (f.type === 'number' || f.type === 'calculated') {
        list.push({ value: f.name, label: `${f.name} (Custom)` });
      }
    });
    
    return list;
  };

  const getOperandLabel = (val?: string) => {
    if (!val) return '';
    if (val === 'order_qty') return 'Order Qty';
    if (val === 'production_qty') return 'Production Qty';
    return val;
  };

  useEffect(() => {
    fetchJobOrderFormat();
  }, []);

  const fetchJobOrderFormat = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/formats');
      const allFormats: ReportFormat[] = res.data;
      const joFormat = allFormats.find(f => f.type === 'JOB_ORDER');
      
      if (joFormat) {
        setFormat(joFormat);
      } else {
        // Create default format for job orders if not found
        const createRes = await api.post('/reports/formats', {
          name: 'Job Order Columns',
          type: 'JOB_ORDER',
          initialFields: []
        });
        
        // Fetch again to get versions properly mapped
        const refreshRes = await api.get('/reports/formats');
        const refreshed: ReportFormat[] = refreshRes.data;
        const newJoFormat = refreshed.find(f => f.type === 'JOB_ORDER');
        if (newJoFormat) {
          setFormat(newJoFormat);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!format || !newFieldName.trim()) return;

    const trimmedName = newFieldName.trim();
    if (isStandardField(trimmedName, 'JOB_ORDER')) {
      alert(`"${trimmedName}" is a standard built-in column on all Job Orders. Do not recreate it.`);
      return;
    }

    if (fields.some(f => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A column with this name already exists.');
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
      formula = {
        left: newFieldFormulaLeft,
        operator: newFieldFormulaOperator,
        right: newFieldFormulaRight
      };
    }

    const updatedFields = [...fields, { 
      name: trimmedName, 
      type: newFieldType, 
      unit: newFieldUnit.trim() ? newFieldUnit.trim() : undefined,
      open: newFieldOpen,
      options,
      formula
    }];

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: updatedFields
      });
      setNewFieldName('');
      setNewFieldUnit('');
      setNewFieldOpen(false);
      setNewFieldOptions('');
      setNewFieldFormulaLeft('order_qty');
      setNewFieldFormulaOperator('-');
      setNewFieldFormulaRight('production_qty');
      
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'JOB_ORDER');
      if (updatedFormat) setFormat(updatedFormat);
      
      alert('Column added successfully!');
    } catch (err) {
      alert('Failed to add column to Job Order');
    }
  };

  const handleStartEditField = (idx: number, field: FormatField) => {
    setEditingFieldIdx(idx);
    setEditingFieldName(field.name);
    setEditingFieldType(field.type);
    setEditingFieldUnit(field.unit || '');
    setEditingFieldOpen(!!field.open);
    setEditingFieldOptions(field.options ? field.options.join(', ') : '');
    setEditingFieldFormulaLeft(field.formula?.left || 'order_qty');
    setEditingFieldFormulaOperator(field.formula?.operator || '-');
    setEditingFieldFormulaRight(field.formula?.right || 'production_qty');
  };

  const handleCancelEditField = () => {
    setEditingFieldIdx(null);
    setEditingFieldOptions('');
  };

  const handleSaveEditField = async (idx: number) => {
    if (!format || !editingFieldName.trim()) return;
    
    const trimmedName = editingFieldName.trim();
    if (isStandardField(trimmedName, 'JOB_ORDER')) {
      alert(`"${trimmedName}" is a standard built-in column on all Job Orders. Do not rename to it.`);
      return;
    }

    const currentFields = [...fields];
    if (currentFields.some((f, i) => i !== idx && f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('Another column with this name already exists.');
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
      formula = {
        left: editingFieldFormulaLeft,
        operator: editingFieldFormulaOperator,
        right: editingFieldFormulaRight
      };
    }

    currentFields[idx] = { 
      name: trimmedName, 
      type: editingFieldType, 
      unit: editingFieldUnit.trim() ? editingFieldUnit.trim() : undefined,
      open: editingFieldOpen,
      options,
      formula
    };

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: currentFields
      });
      setEditingFieldIdx(null);
      setEditingFieldOptions('');
      
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'JOB_ORDER');
      if (updatedFormat) setFormat(updatedFormat);
      
      alert('Column updated successfully!');
    } catch (err) {
      alert('Failed to edit column');
    }
  };

  const handleDeleteField = async (idx: number) => {
    if (!format) return;
    if (!confirm('Are you sure you want to delete this column? Existing job order custom values will not be deleted but won\'t display here.')) return;

    const currentFields = fields.filter((_, i) => i !== idx);

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: currentFields
      });
      
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'JOB_ORDER');
      if (updatedFormat) setFormat(updatedFormat);
      
      alert('Column deleted successfully!');
    } catch (err) {
      alert('Failed to delete column');
    }
  };



  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    if (!format) return;
    const currentFields = [...fields];
    
    // Remove the dragged item
    const [draggedItem] = currentFields.splice(draggedIdx, 1);
    // Insert it at the target position
    currentFields.splice(targetIndex, 0, draggedItem);

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: currentFields
      });
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'JOB_ORDER');
      if (updatedFormat) setFormat(updatedFormat);
    } catch (err) {
      alert('Failed to reorder columns');
    } finally {
      setDraggedIdx(null);
    }
  };

  if (loading) return <div className="p-4">Loading Job Order Column Master...</div>;

  const rawFields = format?.versions[0]?.fields_schema || [];
  const fields = injectStandardFields(rawFields, 'JOB_ORDER');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center border-b border-border pb-4 mb-6">
        <ClipboardList className="h-8 w-8 text-primary mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Job Order Columns Master</h1>
          <p className="text-sm text-text-secondary">Define and customize fields that will be filled out for Job Orders.</p>
        </div>
      </div>

<div className="bg-white p-6 rounded-card border border-border shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-text-primary">Defined Job Order Columns</h3>
        
        {fields.length === 0 ? (
          <p className="text-sm italic text-text-secondary">No custom columns defined yet. Add fields below to customize your job orders.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f, idx) => (
              <div 
                key={idx} 
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                className={clsx(
                  "flex items-center bg-surface p-3 rounded border border-border shadow-sm transition-all duration-200 select-none",
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
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase">Column Name</label>
                      <input type="text" className="border border-border rounded px-2 py-1.5 text-sm w-full focus:ring-primary focus:border-primary mt-1 bg-white" value={editingFieldName} onChange={e => setEditingFieldName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase">Type</label>
                      <select className="border border-border rounded px-2 py-1.5 text-sm focus:ring-primary focus:border-primary mt-1 bg-white" value={editingFieldType} onChange={e => setEditingFieldType(e.target.value)}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                        <option value="dropdown">Dropdown (Custom)</option>
                        <option value="department">Department (Dropdown)</option>
                        <option value="calculated">Calculated (Formula)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase">Unit</label>
                      <input type="text" placeholder="Unit" className="border border-border rounded px-2 py-1.5 text-sm w-24 focus:ring-primary focus:border-primary mt-1 bg-white" value={editingFieldUnit} onChange={e => setEditingFieldUnit(e.target.value)} />
                    </div>
                    <div className="pb-1">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-border text-primary focus:ring-primary h-4 w-4" checked={editingFieldOpen} onChange={e => setEditingFieldOpen(e.target.checked)} />
                        <span className="text-[10px] font-semibold text-text-secondary uppercase">Open for Ops</span>
                      </label>
                    </div>
                    {editingFieldType === 'dropdown' && (
                      <div className="w-full mt-2">
                        <label className="block text-[10px] font-semibold text-text-secondary uppercase">Dropdown Options (comma-separated)</label>
                        <input type="text" placeholder="e.g. Option A, Option B, Option C" className="border border-border rounded px-2 py-1.5 text-sm w-full focus:ring-primary focus:border-primary mt-1 bg-white font-semibold" value={editingFieldOptions} onChange={e => setEditingFieldOptions(e.target.value)} />
                      </div>
                    )}
                    {editingFieldType === 'calculated' && (
                      <div className="w-full mt-2 p-3 bg-gray-50 rounded border border-border/60">
                        <label className="block text-[10px] font-bold text-text-primary uppercase mb-1">Configure Formula</label>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-text-secondary">{editingFieldName || 'Column'} = </span>
                          <select 
                            className="border border-border rounded px-2 py-1 bg-white"
                            value={editingFieldFormulaLeft}
                            onChange={e => setEditingFieldFormulaLeft(e.target.value)}
                          >
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
                          </select>
                          <select 
                            className="border border-border rounded px-2 py-1 bg-white"
                            value={editingFieldFormulaRight}
                            onChange={e => setEditingFieldFormulaRight(e.target.value)}
                          >
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
                        {isStandardField(f.name, 'JOB_ORDER') ? 'Standard' : f.type}
                      </span>
                      {f.unit && <span className="ml-2 text-xs text-secondary">({f.unit})</span>}
                      {!isStandardField(f.name, 'JOB_ORDER') && (
                        f.open ? (
                          <span className="ml-2 text-xs text-green-700 font-semibold px-2.5 py-0.5 bg-green-50 border border-green-200 rounded-full">Open (Ops Entry)</span>
                        ) : (
                          <span className="ml-2 text-xs text-gray-500 font-medium px-2.5 py-0.5 bg-gray-50 border border-gray-200 rounded-full">Admin Only</span>
                        )
                      )}
                      {f.type === 'dropdown' && f.options && (
                        <div className="text-xs text-text-secondary mt-1 font-medium bg-gray-50 px-2 py-1 rounded border border-border/40 inline-block w-full">
                          Options: {f.options.join(', ')}
                        </div>
                      )}
                      {f.type === 'calculated' && f.formula && (
                        <div className="text-xs text-primary mt-1 font-semibold bg-blue-50/70 px-2 py-1 rounded border border-blue-100 inline-block w-full">
                          Formula: {f.name} = {getOperandLabel(f.formula.left)} {f.formula.operator} {getOperandLabel(f.formula.right)}
                        </div>
                      )}
                    </div>
                    {isAdmin && !isStandardField(f.name, 'JOB_ORDER') && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleStartEditField(idx, f)} className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50" title="Edit Column"><Edit2 className="h-4 w-4" /></button>
                        <button type="button" onClick={() => handleDeleteField(idx)} className="text-danger hover:text-red-900 p-1 rounded hover:bg-red-50" title="Delete Column"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleAddField} className="bg-surface p-4 rounded-md border border-border shadow-inner">
            <h4 className="text-sm font-medium text-text-primary mb-4 flex items-center">
              <ListPlus className="mr-2 h-4 w-4 text-primary" />
              + Add Job Order Column
            </h4>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Column Name</label>
                <input required type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Data Type</label>
                 <select className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                  <option value="dropdown">Dropdown (Custom)</option>
                  <option value="department">Department (Dropdown)</option>
                  <option value="calculated">Calculated (Formula)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Unit (Optional)</label>
                <input type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldUnit} onChange={e => setNewFieldUnit(e.target.value)} />
              </div>
              <div className="pb-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-border text-primary focus:ring-primary h-4 w-4" checked={newFieldOpen} onChange={e => setNewFieldOpen(e.target.checked)} />
                  <span className="text-xs font-semibold text-text-secondary uppercase">Open for Ops</span>
                </label>
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
                  <span className="font-semibold text-text-secondary">{newFieldName || 'Column'} = </span>
                  <select 
                    className="border border-border rounded px-3 py-2 bg-white"
                    value={newFieldFormulaLeft}
                    onChange={e => setNewFieldFormulaLeft(e.target.value)}
                  >
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
                  </select>
                  <select 
                    className="border border-border rounded px-3 py-2 bg-white"
                    value={newFieldFormulaRight}
                    onChange={e => setNewFieldFormulaRight(e.target.value)}
                  >
                    {getNumericOperandOptions(fields).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md text-sm hover:bg-primary-light transition-colors font-semibold">
                Add Column
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
