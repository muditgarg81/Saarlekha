import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import { injectStandardFields } from '../../utils/standards';
import { FileSpreadsheet, Plus, Trash2, MoreVertical, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

// Helper to identify reports with both machine and operator
export function hasMachineAndOperator(fields: { name: string; type: string }[]) {
  if (!fields || !Array.isArray(fields)) return false;
  const hasMachine = fields.some(f => {
    const l = f.name.toLowerCase().replace(/[\s_\.]/g, '');
    return l === 'machine' || l === 'machineno' || l === 'machinename' || l === 'loom' || l === 'loomno' || l === 'loomnumber';
  });
  const hasOperator = fields.some(f => {
    const l = f.name.toLowerCase().replace(/[\s_\.]/g, '');
    return l === 'operator' || l === 'operatorname' || l === 'operatorid' || l === 'person' || l === 'staff';
  });
  return hasMachine && hasOperator;
}

export function OtherProduction() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [formats, setFormats] = useState<ReportFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<{ id: string; top: number; left: number } | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const today = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate] = useState(today);

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
    if (norm === 'department') {
      return entry.department?.name ?? '';
    }
    if (norm === 'logged by' || norm === 'submitted by' || norm === 'by') {
      return entry.submitter?.email ?? '';
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
      const filtered = res.data.filter((f: any) => {
        if (f.type !== 'PRODUCTION' && f.type !== 'GENERAL') return false;
        const schema = f.versions[0]?.fields_schema || [];
        return !hasMachineAndOperator(schema);
      });
      setFormats(filtered);
    } catch (err) {
      console.error('Failed to fetch formats', err);
    }
  }, []);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role || '');

  useEffect(() => {
    if (!isAdmin) return;
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    fetchDepartments();
  }, [isAdmin]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      if (selectedFormatId) {
        params.formatId = selectedFormatId;
      }
      if (selectedDepartmentId) {
        params.departmentId = selectedDepartmentId;
      }
      
      const res = await api.get('/reports/entries', { params });
      
      // Filter entries client-side to keep only formats visible on this page
      const visibleFormatIds = new Set(formats.map(f => f.id));
      const filteredEntries = res.data.filter((e: any) => {
        return visibleFormatIds.has(e.format_version?.format?.id);
      });
      
      setEntries(filteredEntries);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedFormatId, formats, selectedDepartmentId]);

  useEffect(() => {
    fetchFormats();
  }, [fetchFormats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete report entries');
    }
  };

  // Get active format fields for table headers and dynamic rows
  const activeFormat = formats.find(f => f.id === selectedFormatId);
  const activeFields = activeFormat?.versions[0]?.fields_schema || [];

  // Gather unique fields for headers when no specific format is selected
  const allUniqueFields = React.useMemo(() => {
    const fieldMap = new Map<string, { name: string; type: string; unit?: string }>();
    formats.forEach(fmt => {
      const versionFields = fmt.versions[0]?.fields_schema || [];
      versionFields.forEach(f => {
        const key = f.name.toLowerCase().trim();
        if (key === 'date' || key === 'department' || key === 'logged by' || key === 'submitted by') {
          return;
        }
        if (!fieldMap.has(key)) {
          fieldMap.set(key, f);
        }
      });
    });
    return Array.from(fieldMap.values());
  }, [formats]);

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

  const displayFields = React.useMemo(() => {
    if (selectedFormatId) {
      return injectStandardFields(activeFields, 'REPORT');
    }
    return allUniqueFields;
  }, [selectedFormatId, activeFields, allUniqueFields]);

  // Export Columns definition
  const exportColumns = selectedFormatId
    ? displayFields.map(f => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
    : [
        { header: 'Date', key: 'date' },
        { header: 'Format', key: 'format' },
        { header: 'Department', key: 'department' },
        { header: 'Submitted By', key: 'submittedBy' },
        ...displayFields.map(f => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
      ];

  const exportRows = (selectedIds.length > 0 ? sortedEntries.filter(e => selectedIds.includes(e.id)) : sortedEntries).map(e => {
    if (selectedFormatId) {
      const rowData: Record<string, any> = {};
      displayFields.forEach(f => {
        rowData[f.name] = getFieldValue(e, f.name);
      });
      return rowData;
    } else {
      const rowData: Record<string, any> = {
        date: new Date(e.entry_date).toLocaleDateString(),
        format: e.format_version?.format?.name ?? '',
        department: e.department?.name ?? '',
        submittedBy: e.submitter?.email ?? '',
      };
      displayFields.forEach(f => {
        rowData[f.name] = e.payload?.[f.name] ?? '';
      });
      return rowData;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> Other Production
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => navigate('/data-entry?type=PRODUCTION' + (selectedFormatId ? `&formatId=${selectedFormatId}` : ''))}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light gap-1.5 shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Log Entry
          </button>
          
          {isAdmin && (
            <select
              value={selectedDepartmentId}
              onChange={e => setSelectedDepartmentId(e.target.value)}
              className="border border-border bg-white rounded-md px-3 py-2 text-sm shadow-sm outline-none text-text-primary font-medium"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <select 
            value={selectedFormatId} 
            onChange={e => setSelectedFormatId(e.target.value)}
            className="border border-border bg-white rounded-md px-3 py-2 text-sm shadow-sm outline-none"
          >
            <option value="">All Production Sheets</option>
            {formats.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-2 shadow-sm text-sm">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none bg-transparent" />
            <span className="text-text-secondary">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none bg-transparent" />
          </div>

          <ExportBar loading={loading} opts={{
            title: selectedIds.length > 0 ? 'Selected Other Production' : 'Other Production Reports',
            subtitle: selectedIds.length > 0 ? `Exported ${selectedIds.length} selected items` : `${startDate} to ${endDate}`,
            filename: `other_production_${selectedIds.length > 0 ? 'selected' : startDate + '_' + endDate}`,
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
          <div className="p-8 text-center text-sm text-text-secondary">No other production sheet entries in this period.</div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
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
                    displayFields.map(f => 
                      renderSortableHeader(f.name, f.name + (f.unit ? ` (${f.unit})` : ''))
                    )
                  ) : (
                    <>
                      {renderSortableHeader('date', 'Date')}
                      {renderSortableHeader('department', 'Department')}
                      {displayFields.map(f => 
                        renderSortableHeader(f.name, f.name + (f.unit ? ` (${f.unit})` : ''))
                      )}
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
                        displayFields.map(f => {
                          const val = getFieldValue(entry, f.name);
                          const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                          const isJobOrder = l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
                          
                          return (
                            <td key={f.name} className="px-6 py-3 text-sm text-text-primary tabular-nums">
                              {isJobOrder && val && val !== '—' ? (
                                <Link 
                                  to={`/job-orders/summary/${encodeURIComponent(String(val))}`}
                                  className="text-primary hover:underline font-semibold"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {val}
                                </Link>
                              ) : (
                                val
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <>
                          <td className="px-6 py-3 text-sm text-text-primary tabular-nums">
                            {new Date(entry.entry_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-sm text-text-secondary">{entry.department?.name}</td>
                          {displayFields.map(f => {
                            const val = entry.payload?.[f.name];
                            const displayVal = val !== undefined && val !== null ? String(val) : '—';
                            const l = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const isJobOrder = l.startsWith('joborder') || l === 'joborderno' || l === 'jobordernumber' || l === 'joborderid' || l === 'order';
                            
                            return (
                              <td key={f.name} className="px-6 py-3 text-sm text-text-primary tabular-nums">
                                {isJobOrder && val ? (
                                  <Link 
                                    to={`/job-orders/summary/${encodeURIComponent(String(val))}`}
                                    className="text-primary hover:underline font-semibold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {displayVal}
                                  </Link>
                                ) : (
                                  displayVal
                                )}
                              </td>
                            );
                          })}
                          <td className="px-6 py-3 text-sm text-text-secondary">{entry.submitter?.email}</td>
                        </>
                      )}
                      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeDropdown?.id === entry.id) {
                                setActiveDropdown(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveDropdown({
                                  id: entry.id,
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

                          {activeDropdown?.id === entry.id && (
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
                                    navigate(`/data-entry?entryId=${entry.id}`);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5 text-text-secondary" /> Edit
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={async () => {
                                      setActiveDropdown(null);
                                      if (window.confirm('Are you sure you want to delete this report entry?')) {
                                        try {
                                          await api.delete(`/reports/entries/${entry.id}`);
                                          fetchData();
                                        } catch (err: any) {
                                          alert(err.response?.data?.error || 'Failed to delete report entry');
                                        }
                                      }
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-danger" /> Delete
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block sm:hidden divide-y divide-border bg-white p-4 space-y-4">
            {sortedEntries.map(entry => {
              const canDelete = user?.role !== 'OPERATIONS' || entry.submitted_by === user?.id;
              return (
                <div 
                  key={entry.id} 
                  onClick={() => navigate(`/data-entry?entryId=${entry.id}`)}
                  className="border border-border rounded-card p-4 shadow-sm space-y-3 bg-white hover:border-primary transition-all relative cursor-pointer"
                >
                  {/* Header: Date, Checkbox, Submitter, and dropdown actions */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
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
                      </div>
                      <span className="text-sm font-bold text-text-primary font-mono tabular-nums">
                        {new Date(entry.entry_date).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeDropdown?.id === entry.id) {
                              setActiveDropdown(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveDropdown({
                                id: entry.id,
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
                        
                        {activeDropdown?.id === entry.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                            <div 
                              style={{
                                position: 'fixed',
                                top: activeDropdown ? `${activeDropdown.top}px` : undefined,
                                left: activeDropdown ? `${activeDropdown.left}px` : undefined,
                              }}
                              className="w-28 bg-white rounded-md border border-border shadow-lg z-50 py-1 text-left"
                            >
                              <button
                                onClick={() => {
                                  setActiveDropdown(null);
                                  navigate(`/data-entry?entryId=${entry.id}`);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface transition-colors"
                              >
                                <Edit className="h-3.5 w-3.5 text-text-secondary" /> Edit
                              </button>
                              {canDelete && (
                                <button
                                  onClick={async () => {
                                    setActiveDropdown(null);
                                    if (window.confirm('Are you sure you want to delete this report entry?')) {
                                      try {
                                        await api.delete(`/reports/entries/${entry.id}`);
                                        fetchData();
                                      } catch (err: any) {
                                        alert(err.response?.data?.error || 'Failed to delete report entry');
                                      }
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-danger" /> Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata: Department, Submitter */}
                  <div className="text-xs text-text-secondary flex justify-between">
                    <span>Dept: <span className="font-semibold text-text-primary">{entry.department?.name || 'N/A'}</span></span>
                    <span>By: <span className="font-semibold">{entry.submitter?.email?.split('@')[0]}</span></span>
                  </div>

                  {/* Content grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {displayFields.map(f => {
                      const val = entry.payload?.[f.name];
                      const displayVal = val !== undefined && val !== null ? String(val) : '—';
                      return (
                        <div key={f.name} className="bg-surface/40 p-2 rounded border border-border/40">
                          <span className="block text-[10px] text-text-secondary uppercase font-semibold">{f.name}</span>
                          <span className="font-medium text-text-primary font-mono tabular-nums">{displayVal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
