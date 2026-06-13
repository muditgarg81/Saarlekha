import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, ListPlus, Settings2, Trash2, Edit2, Check, X, ClipboardList, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import { injectStandardFields, isStandardField, type FormatField } from '../../utils/standards';

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

export function MaintenanceColumnsMaster() {
  const [format, setFormat] = useState<ReportFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Add Field State
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldOpen, setNewFieldOpen] = useState(true); // Default to true for maintenance checklist items

  // Editing Field State
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);
  const [editingFieldName, setEditingFieldName] = useState('');
  const [editingFieldType, setEditingFieldType] = useState('text');
  const [editingFieldUnit, setEditingFieldUnit] = useState('');
  const [editingFieldOpen, setEditingFieldOpen] = useState(true);

  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Maintenance Type Options State
  const [options, setOptions] = useState<any[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionName, setEditingOptionName] = useState('');

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    fetchMaintenanceFormat();
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await api.get('/maintenance-types');
      setOptions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    try {
      await api.post('/maintenance-types', { name: newOptionName.trim() });
      setNewOptionName('');
      fetchOptions();
      alert('Maintenance Type option added successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add option');
    }
  };

  const handleStartEditOption = (opt: any) => {
    setEditingOptionId(opt.id);
    setEditingOptionName(opt.name);
  };

  const handleSaveEditOption = async (id: string) => {
    if (!editingOptionName.trim()) return;
    try {
      await api.put(`/maintenance-types/${id}`, { name: editingOptionName.trim() });
      setEditingOptionId(null);
      setEditingOptionName('');
      fetchOptions();
      alert('Option updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update option');
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      await api.delete(`/maintenance-types/${id}`);
      fetchOptions();
      alert('Option deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete option');
    }
  };

  const fetchMaintenanceFormat = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/formats');
      const allFormats: ReportFormat[] = res.data;
      const maintFormat = allFormats.find(f => f.type === 'MAINTENANCE');
      
      if (maintFormat) {
        setFormat(maintFormat);
      } else {
        // Create default format for maintenance if not found
        await api.post('/reports/formats', {
          name: 'Machine Maintenance Columns',
          type: 'MAINTENANCE',
          initialFields: []
        });
        
        // Fetch again to get versions properly mapped
        const refreshRes = await api.get('/reports/formats');
        const refreshed: ReportFormat[] = refreshRes.data;
        const newMaintFormat = refreshed.find(f => f.type === 'MAINTENANCE');
        if (newMaintFormat) {
          setFormat(newMaintFormat);
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
    if (isStandardField(trimmedName, 'MAINTENANCE')) {
      alert(`"${trimmedName}" is a standard built-in column on all maintenance logs. Do not recreate it.`);
      return;
    }

    if (fields.some(f => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A column with this name already exists.');
      return;
    }

    const updatedFields = [...fields, { 
      name: trimmedName, 
      type: newFieldType, 
      unit: newFieldUnit.trim() ? newFieldUnit.trim() : undefined,
      open: newFieldOpen
    }];

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: updatedFields
      });
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'MAINTENANCE');
      if (updatedFormat) setFormat(updatedFormat);

      // Reset
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldUnit('');
      setNewFieldOpen(true);
      alert('Checklist item added successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add column');
    }
  };

  const handleDeleteField = async (idxToDelete: number) => {
    if (!format) return;
    if (!confirm('Are you sure you want to delete this checklist column? This will apply to new entries.')) return;

    const currentFields = fields.filter((_, i) => i !== idxToDelete);

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: currentFields
      });
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'MAINTENANCE');
      if (updatedFormat) setFormat(updatedFormat);
      alert('Column deleted successfully!');
    } catch (err) {
      alert('Failed to delete checklist column');
    }
  };

  const handleStartEditField = (idx: number, field: FormatField) => {
    setEditingFieldIdx(idx);
    setEditingFieldName(field.name);
    setEditingFieldType(field.type);
    setEditingFieldUnit(field.unit || '');
    setEditingFieldOpen(field.open ?? true);
  };

  const handleCancelEditField = () => {
    setEditingFieldIdx(null);
    setEditingFieldName('');
    setEditingFieldType('text');
    setEditingFieldUnit('');
    setEditingFieldOpen(true);
  };

  const handleSaveEditField = async (idxToSave: number) => {
    if (!format || !editingFieldName.trim()) return;

    const trimmedName = editingFieldName.trim();
    if (isStandardField(trimmedName, 'MAINTENANCE')) {
      alert(`"${trimmedName}" is a standard built-in column on all maintenance logs. Do not rename to it.`);
      return;
    }

    const currentFields = [...fields];
    if (currentFields.some((f, i) => i !== idxToSave && f.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('Another column with this name already exists.');
      return;
    }

    currentFields[idxToSave] = {
      name: trimmedName,
      type: editingFieldType,
      unit: editingFieldUnit.trim() ? editingFieldUnit.trim() : undefined,
      open: editingFieldOpen
    };

    try {
      await api.post(`/reports/formats/${format.id}/versions`, {
        fields: currentFields
      });
      // Refresh
      const refreshRes = await api.get('/reports/formats');
      const refreshed: ReportFormat[] = refreshRes.data;
      const updatedFormat = refreshed.find(f => f.type === 'MAINTENANCE');
      if (updatedFormat) setFormat(updatedFormat);

      setEditingFieldIdx(null);
      alert('Column updated successfully!');
    } catch (err) {
      alert('Failed to update checklist column');
    }
  };

  // Drag and Drop support
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex || !format) return;

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
      const updatedFormat = refreshed.find(f => f.type === 'MAINTENANCE');
      if (updatedFormat) setFormat(updatedFormat);
    } catch (err) {
      alert('Failed to reorder columns');
    } finally {
      setDraggedIdx(null);
    }
  };

  if (loading) return <div className="p-4">Loading Maintenance Column Master...</div>;

  const rawFields = format?.versions[0]?.fields_schema || [];
  const fields = injectStandardFields(rawFields, 'MAINTENANCE');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center border-b border-border pb-4 mb-6">
        <ClipboardList className="h-8 w-8 text-primary mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Maintenance Columns Master</h1>
          <p className="text-sm text-text-secondary">Define and customize checklist fields that will be logged during machine maintenance.</p>
        </div>
      </div>

      {/* Standard / Static Columns list */}
      <div className="bg-white p-6 rounded-card border border-border shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Standard Built-in Columns (Static)</h3>
        <p className="text-xs text-text-secondary">
          These columns are standard on all maintenance logs. Do not recreate them as custom columns:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            'Maintenance Date',
            'Machine (Dropdown)',
            'Maintenance Type (Dropdown)',
            'Status'
          ].map(col => (
            <span key={col} className="px-3 py-1 bg-gray-50 border border-border rounded text-xs font-semibold text-text-secondary select-none">
              {col}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-card border border-border shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-text-primary">Defined Maintenance Checklist Columns</h3>
        
        {fields.length === 0 ? (
          <p className="text-sm italic text-text-secondary">No custom columns defined yet. Add checklist items below to customize your maintenance reports.</p>
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
                        <option value="boolean">OK/Issue (Yes/No)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-secondary uppercase">Unit</label>
                      <input type="text" placeholder="Unit" className="border border-border rounded px-2 py-1.5 text-sm w-24 focus:ring-primary focus:border-primary mt-1 bg-white" value={editingFieldUnit} onChange={e => setEditingFieldUnit(e.target.value)} />
                    </div>
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
                        {isStandardField(f.name, 'MAINTENANCE') ? 'Standard' : (f.type === 'boolean' ? 'OK/Issue' : f.type)}
                      </span>
                      {f.unit && <span className="ml-2 text-xs text-secondary">({f.unit})</span>}
                    </div>
                    {isAdmin && !isStandardField(f.name, 'MAINTENANCE') && (
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
              + Add Maintenance Checklist Column
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Column Name</label>
                <input required type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Data Type</label>
                <select className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">OK/Issue (Yes/No)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase">Unit (Optional)</label>
                <input type="text" className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary bg-white" value={newFieldUnit} onChange={e => setNewFieldUnit(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md text-sm hover:bg-primary-light transition-colors font-semibold">
                Add Column
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Maintenance Type Options Manager */}
      <div className="bg-white p-6 rounded-card border border-border shadow-sm space-y-6">
        <div className="border-b border-border pb-3">
          <h3 className="text-lg font-semibold text-text-primary">Maintenance Type Options</h3>
          <p className="text-xs text-text-secondary mt-1">Configure options for the standard built-in "Maintenance Type" dropdown.</p>
        </div>

        {options.length === 0 ? (
          <p className="text-sm italic text-text-secondary py-2">No options defined yet. Add options below.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt) => (
              <div 
                key={opt.id} 
                className="flex items-center justify-between bg-surface p-3 rounded border border-border transition-colors hover:border-primary/45"
              >
                {editingOptionId === opt.id ? (
                  <div className="flex-1 flex gap-2">
                    <input 
                      type="text" 
                      className="border border-border rounded px-2 py-1 text-sm flex-1 bg-white focus:ring-primary focus:border-primary" 
                      value={editingOptionName} 
                      onChange={e => setEditingOptionName(e.target.value)} 
                    />
                    <button 
                      onClick={() => handleSaveEditOption(opt.id)} 
                      className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setEditingOptionId(null)} 
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-sm text-text-primary">{opt.name}</span>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStartEditOption(opt)} 
                          className="text-primary hover:text-primary-light p-1 rounded hover:bg-blue-50"
                          title="Edit Option"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOption(opt.id)} 
                          className="text-danger hover:text-red-950 p-1 rounded hover:bg-red-50"
                          title="Delete Option"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleAddOption} className="bg-surface p-4 rounded-md border border-border shadow-inner mt-4">
            <h4 className="text-sm font-semibold text-text-primary mb-3">+ Add Maintenance Type Option</h4>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-text-secondary uppercase">Option Name</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. breakdown maintenance"
                  className="mt-1 block w-full border border-border rounded px-3 py-2 text-sm bg-white focus:ring-primary focus:border-primary" 
                  value={newOptionName} 
                  onChange={e => setNewOptionName(e.target.value)} 
                />
              </div>
              <button 
                type="submit" 
                className="bg-primary text-white px-5 py-2 rounded-md text-sm hover:bg-primary-light transition-colors font-semibold h-[40px]"
              >
                Add Option
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
