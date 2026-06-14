import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import { injectStandardFields } from '../../utils/standards';
import { ShieldCheck, Plus, ClipboardList, Trash2, MoreVertical, Edit, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

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
  created_at?: string;
}

export function QualityDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<{ id: string; top: number; left: number } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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
      return new Date(entry.created_at || entry.entry_date).getTime();
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

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/entries', { 
        params: { 
          startDate, 
          endDate, 
          type: 'QUALITY',
          departmentId: selectedDepartmentId || undefined
        } 
      });
      setEntries(res.data);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedDepartmentId]);

  const deletableEntries = entries.filter(e => user?.role !== 'OPERATIONS' || e.submitted_by === user?.id);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

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

  const getFieldValue = (entry: ReportEntry, fieldName: string) => {
    const norm = fieldName.toLowerCase().trim();
    if (norm === 'date') {
      const dateStr = new Date(entry.entry_date).toLocaleDateString();
      if (entry.created_at) {
        const timeStr = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr}`;
      }
      return dateStr;
    }
    if (norm === 'department') {
      return entry.department?.name ?? '';
    }
    if (norm === 'logged by' || norm === 'submitted by') {
      return entry.submitter?.email ?? '';
    }
    return entry.payload?.[fieldName] !== undefined ? String(entry.payload[fieldName]) : '—';
  };

  // Group entries by format ID
  const groupedEntries = useMemo(() => {
    const groups: Record<string, {
      formatId: string;
      formatName: string;
      fields: { name: string; type: string; unit?: string }[];
      entries: ReportEntry[];
    }> = {};

    sortedEntries.forEach(entry => {
      const format = entry.format_version?.format;
      if (!format) return;
      
      const formatId = format.id;
      if (!groups[formatId]) {
        groups[formatId] = {
          formatId,
          formatName: format.name,
          fields: injectStandardFields(entry.format_version.fields_schema || [], 'REPORT'),
          entries: []
        };
      }
      groups[formatId].entries.push(entry);
    });

    return Object.values(groups);
  }, [sortedEntries]);

  const toggleGroup = (formatId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [formatId]: !prev[formatId]
    }));
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    groupedEntries.forEach(g => {
      next[g.formatId] = true;
    });
    setCollapsedGroups(next);
  };

  const handleExpandAll = () => {
    setCollapsedGroups({});
  };

  const handleToggleSelectGroupAll = (groupEntries: ReportEntry[]) => {
    const groupDeletable = groupEntries.filter(e => user?.role !== 'OPERATIONS' || e.submitted_by === user?.id);
    const groupDeletableIds = groupDeletable.map(e => e.id);
    const allSelectedInGroup = groupDeletableIds.length > 0 && groupDeletableIds.every(id => selectedIds.includes(id));
    
    if (allSelectedInGroup) {
      setSelectedIds(prev => prev.filter(id => !groupDeletableIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const otherIds = prev.filter(id => !groupDeletableIds.includes(id));
        return [...otherIds, ...groupDeletableIds];
      });
    }
  };

  const allUniqueFields = useMemo(() => {
    const fieldMap = new Map<string, { name: string; type: string; unit?: string }>();
    entries.forEach(e => {
      const versionFields = e.format_version?.fields_schema || [];
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
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-secondary" /> Quality Reports
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => navigate('/data-entry?type=QUALITY')}
            className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light gap-1.5 shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Log Entry
          </button>
          <button 
            onClick={() => navigate(`/reports/daily?type=QUALITY&date=${endDate}`)}
            className="inline-flex items-center px-4 py-2 bg-secondary text-white text-sm font-medium rounded-md hover:bg-teal-700 gap-1.5 shadow-sm font-semibold"
          >
            <ClipboardList className="h-4 w-4" /> Daily Quality Report
          </button>
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
            title: selectedIds.length > 0 ? 'Selected Quality Reports' : 'Quality Reports',
            subtitle: selectedIds.length > 0 ? `Exported ${selectedIds.length} selected items` : `${startDate} to ${endDate}`,
            filename: `quality_${selectedIds.length > 0 ? 'selected' : startDate + '_' + endDate}`,
            columns: [
              { header: 'Date', key: 'date' },
              { header: 'Format', key: 'format' },
              { header: 'Department', key: 'department' },
              { header: 'Submitted By', key: 'submittedBy' },
              ...allUniqueFields.map((f: any) => ({ header: f.name + (f.unit ? ` (${f.unit})` : ''), key: f.name }))
            ],
            rows: (selectedIds.length > 0 ? sortedEntries.filter(e => selectedIds.includes(e.id)) : sortedEntries).map(e => {
              const dateStr = new Date(e.entry_date).toLocaleDateString();
              const timeStr = e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const rowData: Record<string, any> = {
                date: timeStr ? `${dateStr} ${timeStr}` : dateStr,
                format: e.format_version?.format?.name ?? '',
                department: e.department?.name ?? '',
                submittedBy: e.submitter?.email ?? '',
              };
              allUniqueFields.forEach(f => {
                rowData[f.name] = e.payload?.[f.name] ?? '';
              });
              return rowData;
            })
          } as ExportOptions} />
        </div>
      </div>

      <div className="bg-white rounded-card border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExpandAll}
              className="text-xs text-primary hover:underline font-semibold bg-white border border-border px-2 py-1 rounded transition-colors hover:bg-surface"
            >
              Expand All
            </button>
            <button 
              onClick={handleCollapseAll}
              className="text-xs text-text-secondary hover:underline font-semibold bg-white border border-border px-2 py-1 rounded transition-colors hover:bg-surface"
            >
              Collapse All
            </button>
            <span className="text-sm text-text-secondary font-medium">{entries.length} records</span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-text-secondary animate-pulse">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">No quality report entries in this period.</div>
        ) : (
          <div className="divide-y divide-border">
            {groupedEntries.map(group => {
              const isCollapsed = collapsedGroups[group.formatId];
              const groupDeletable = group.entries.filter(e => user?.role !== 'OPERATIONS' || e.submitted_by === user?.id);
              const groupDeletableIds = groupDeletable.map(e => e.id);
              const isGroupAllSelected = groupDeletableIds.length > 0 && groupDeletableIds.every(id => selectedIds.includes(id));
              
              return (
                <div key={group.formatId} className="bg-white">
                  {/* Collapsible Header */}
                  <div 
                    onClick={() => toggleGroup(group.formatId)}
                    className="flex items-center justify-between px-6 py-4 bg-surface/50 border-b border-border cursor-pointer hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-primary text-sm">{group.formatName}</span>
                      <span className="text-xs text-text-secondary bg-gray-200 px-2 py-0.5 rounded-full font-mono font-semibold">{group.entries.length} logs</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-xs font-semibold">
                      <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Group Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface">
                          <tr>
                            <th className="w-12 px-6 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={groupDeletableIds.length > 0 && isGroupAllSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelectGroupAll(group.entries);
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                              />
                            </th>
                            {group.fields.map(f => 
                              renderSortableHeader(f.name, f.name + (f.unit ? ` (${f.unit})` : ''))
                            )}
                            <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase w-20">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-white">
                          {group.entries.map(entry => {
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
                                {group.fields.map(f => {
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
                                })}
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
                                                    fetchEntries();
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
