import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import { injectStandardFields } from '../../utils/standards';
import { FileSpreadsheet, Plus, ClipboardList, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

interface ReportFormat {
  id: string;
  name: string;
  type: string;
  versions: {
    id: string;
    version_num: number;
    fields_schema: { name: string; type: string; unit?: string }[];
  }[];
}

interface ReportEntry {
  id: string;
  entry_date: string;
  submitted_by: string;
  payload: Record<string, any>;
  format_version: {
    version_num: number;
    fields_schema: { name: string; type: string; unit?: string }[];
    format: { id: string; name: string; type: string };
  };
  department: { name: string };
  submitter: { email: string };
}

export function GeneralDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [formats, setFormats] = useState<ReportFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    fetchDepts();
  }, [user, isAdmin]);

  const handleSort = (field: string) => {
    const normField = field.trim();
    if (sortField === normField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(normField);
      setSortAsc(true);
    }
  };

  const getSortValue = (entry: ReportEntry, field: string) => {
    const norm = field.toLowerCase().trim();
    if (norm === 'date') {
      return new Date(entry.entry_date).getTime();
    }
    if (norm === 'format') {
      return entry.format_version?.format?.name ?? '';
    }
    if (norm === 'department') {
      return entry.department?.name ?? '';
    }
    if (norm === 'logged by' || norm === 'submitted by' || norm === 'by') {
      return entry.submitter?.email ?? '';
    }
    if (norm === 'logged details' || norm === 'details') {
      return Object.entries(entry.payload || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    const val = entry.payload?.[field];
    if (val === undefined || val === null || val === '' || val === '—') {
      return '';
    }
    return val;
  };

  const sortedEntries = React.useMemo(() => {
    if (!sortField) return entries;
    return [...entries].sort((a, b) => {
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
  }, [entries, sortField, sortAsc]);

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


  const fetchFormats = useCallback(async () => {
    try {
      const res = await api.get('/reports/formats');
      const filtered = res.data.filter((f: any) => f.type === 'GENERAL');
      setFormats(filtered);
    } catch (err) {
      console.error('Failed to fetch formats', err);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { startDate, endDate, type: 'GENERAL' };
      if (selectedFormatId) {
        params.formatId = selectedFormatId;
      }
      if (selectedDepartmentId) {
        params.departmentId = selectedDepartmentId;
      }
      const res = await api.get('/reports/entries', { params });
      setEntries(res.data);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedFormatId, selectedDepartmentId]);

  useEffect(() => {
    fetchFormats();
  }, [fetchFormats]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const deletableEntries = entries.filter(e => user?.role !== 'OPERATIONS' || e.submitted_by === user?.id);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === deletableEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableEntries.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} report entries?`)) return;

    try {
      await api.post('/reports/entries/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      fetchEntries();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete report entries');
    }
  };

  // Get active format fields for table headers and dynamic rows
  const activeFormat = formats.find(f => f.id === selectedFormatId);
  const activeFieldsRaw = activeFormat?.versions[0]?.fields_schema || [];
  const activeFields = selectedFormatId ? injectStandardFields(activeFieldsRaw, 'REPORT') : [];

  const getFieldValue = (entry: ReportEntry, fieldName: string) => {
    const norm = fieldName.toLowerCase().trim();
    if (norm === 'date') {
      return new Date(entry.entry_date).toLocaleDateString();
    }
    if (norm === 'department') {
      return entry.department?.name ?? '';
    }
    if (norm === 'logged by' || norm === 'submitted by') {
      return entry.submitter?.email ?? '';
    }
    return entry.payload?.[fieldName] !== undefined ? String(entry.payload[fieldName]) : '—';
  };

  // Export Columns definition
  const exportColumns = selectedFormatId
    ? activeFields.map(f => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
    : [
        { header: 'Date', key: 'date' },
        { header: 'Format', key: 'format' },
        { header: 'Department', key: 'department' },
        { header: 'Details', key: 'details' },
        { header: 'Submitted By', key: 'submittedBy' }
      ];

  const exportRows = (selectedIds.length > 0 ? sortedEntries.filter(e => selectedIds.includes(e.id)) : sortedEntries).map(e => {
    if (selectedFormatId) {
      const row: Record<string, any> = {};
      activeFields.forEach(f => {
        row[f.name] = getFieldValue(e, f.name);
      });
      return row;
    } else {
      const detailsStr = Object.entries(e.payload || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return {
        date: new Date(e.entry_date).toLocaleDateString(),
        format: e.format_version?.format?.name ?? '',
        department: e.department?.name ?? '',
        details: detailsStr,
        submittedBy: e.submitter?.email ?? ''
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> General Reports
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => navigate('/data-entry?type=GENERAL' + (selectedFormatId ? `&formatId=${selectedFormatId}` : ''))}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light gap-1.5 shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Log Entry
          </button>
          
          <select 
            value={selectedFormatId} 
            onChange={e => setSelectedFormatId(e.target.value)}
            className="border border-border bg-white rounded-md px-3 py-2 text-sm shadow-sm outline-none"
          >
            <option value="">All General Formats</option>
            {formats.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {isAdmin && (
            <select
              value={selectedDepartmentId}
              onChange={e => setSelectedDepartmentId(e.target.value)}
              className="border border-border bg-white rounded-md px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary text-text-primary font-semibold"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-2 shadow-sm text-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none bg-transparent" />
            <span className="text-text-secondary">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none bg-transparent" />
          </div>

          <ExportBar loading={loading} opts={{
            title: selectedIds.length > 0 ? 'Selected General Reports' : 'General Reports',
            subtitle: selectedIds.length > 0 ? `Exported ${selectedIds.length} selected items` : `${startDate} to ${endDate}`,
            filename: `general_${selectedIds.length > 0 ? 'selected' : startDate + '_' + endDate}`,
            columns: exportColumns,
            rows: exportRows
          } as ExportOptions} />
        </div>
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-text-primary">Entries</h2>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm gap-1 transition-colors"
              >
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
          <span className="text-sm text-text-secondary">{sortedEntries.length} records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-text-secondary animate-pulse">Loading...</div>
        ) : sortedEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">No general report entries in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface">
                <tr>
                  <th className="w-12 px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={deletableEntries.length > 0 && selectedIds.length === deletableEntries.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </th>
                  {selectedFormatId ? (
                    activeFields.map(f => 
                      renderSortableHeader(f.name, f.name + (f.unit ? ` (${f.unit})` : ''))
                    )
                  ) : (
                    <>
                      {renderSortableHeader('date', 'Date')}
                      {renderSortableHeader('format', 'Format')}
                      {renderSortableHeader('department', 'Department')}
                      {renderSortableHeader('details', 'Logged Details')}
                      {renderSortableHeader('by', 'By')}
                    </>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {sortedEntries.map(entry => {
                  const canDelete = user?.role !== 'OPERATIONS' || entry.submitted_by === user?.id;
                  return (
                    <tr 
                      key={entry.id} 
                      onClick={() => navigate(`/data-entry?entryId=${entry.id}`)}
                      className="hover:bg-surface cursor-pointer transition-colors"
                    >
                      <td className="w-12 px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled={!canDelete}
                          checked={selectedIds.includes(entry.id)}
                          onChange={() => handleToggleSelect(entry.id)}
                          className={clsx(
                            "rounded h-4 w-4 cursor-pointer",
                            canDelete 
                              ? "border-border text-primary focus:ring-primary" 
                              : "border-gray-200 text-gray-300 cursor-not-allowed opacity-55"
                          )}
                        />
                      </td>
                      {selectedFormatId ? (
                        activeFields.map(f => (
                          <td key={f.name} className="px-6 py-3 text-sm text-text-primary tabular-nums">
                            {getFieldValue(entry, f.name)}
                          </td>
                        ))
                      ) : (
                        <>
                          <td className="px-6 py-3 text-sm text-text-primary tabular-nums">
                            {new Date(entry.entry_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-sm text-text-secondary">{entry.format_version?.format?.name}</td>
                          <td className="px-6 py-3 text-sm text-text-secondary">{entry.department?.name}</td>
                          <td className="px-6 py-3 text-sm text-text-secondary max-w-xs truncate">
                            {Object.entries(entry.payload || {})
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </td>
                          <td className="px-6 py-3 text-sm text-text-secondary">{entry.submitter?.email}</td>
                        </>
                      )}
                      <td className="px-6 py-3 text-right">
                        {canDelete && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Are you sure you want to delete this report entry?')) {
                                try {
                                  await api.delete(`/reports/entries/${entry.id}`);
                                  fetchEntries();
                                } catch (err: any) {
                                  alert(err.response?.data?.error || 'Failed to delete report entry');
                                }
                              }
                            }}
                            className="text-text-secondary hover:text-danger p-1 rounded inline-flex items-center transition-colors"
                            title="Delete Entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
    </div>
  );
}
