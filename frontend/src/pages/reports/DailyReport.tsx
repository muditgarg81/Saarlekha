import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ExportBar } from '../../utils/export';
import type { ExportOptions } from '../../utils/export';
import { 
  Calendar, Users, Factory, Wrench, ShieldCheck, 
  ClipboardList, CheckCircle2, AlertCircle, FileText,
  ChevronDown, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

interface Machine {
  id: string;
  name: string;
  type?: string;
  location?: string;
}

interface Manpower {
  id: string;
  name: string;
  role?: string;
  department_id?: string;
}

interface ProductionRecord {
  id: string;
  date: string;
  production_amount: number;
  target_amount: number;
  operator: { name: string };
  machine: { name: string };
}

interface ReportEntry {
  id: string;
  entry_date: string;
  payload: Record<string, any>;
  format_version: {
    format: { name: string; type: string };
    fields_schema: { name: string; type: string; unit?: string }[];
  };
  department_id?: string;
  department: { name: string };
  submitter: { email: string };
}

export function DailyReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const typeParam = searchParams.get('type') || '';
  const isQualityOnly = typeParam === 'QUALITY';
  
  const today = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(dateParam || today);
  const [groupBy, setGroupBy] = useState<'machine' | 'operator' | 'department'>('machine');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const newExpanded: Record<string, boolean> = {};
    if (groupBy === 'machine') {
      machines.forEach(m => {
        newExpanded[m.id] = true;
      });
    } else if (groupBy === 'operator') {
      manpower.forEach(op => {
        newExpanded[op.id] = true;
      });
    } else {
      departments.forEach(d => {
        newExpanded[d.id] = true;
      });
    }
    setExpandedIds(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const [machines, setMachines] = useState<Machine[]>([]);
  const [manpower, setManpower] = useState<Manpower[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [
        api.get('/machines'),
        api.get('/manpower'),
        api.get('/reports/entries', { params: { startDate: dateStr, endDate: dateStr, type: isQualityOnly ? 'QUALITY' : undefined } }),
        api.get('/departments')
      ];
      
      if (!isQualityOnly) {
        promises.push(api.get('/production', { params: { startDate: dateStr, endDate: dateStr } }));
      }

      const results = await Promise.all(promises);
      setMachines(results[0].data);
      setManpower(results[1].data);
      setReportEntries(results[2].data);
      setDepartments(results[3].data);
      if (!isQualityOnly && results[4]) {
        setProductionRecords(results[4].data);
      } else {
        setProductionRecords([]);
      }
    } catch (err) {
      console.error('Failed to load daily report data:', err);
    } finally {
      setLoading(false);
    }
  }, [isQualityOnly]);

  useEffect(() => {
    fetchData(reportDate);
    setExpandedIds({});
  }, [reportDate, fetchData, groupBy]);

  // Helper matching functions to associate report entries with machines or operators
  const isMatchForMachine = (entry: ReportEntry, machineName: string): boolean => {
    if (!machineName) return false;
    const nameLower = machineName.toLowerCase().trim();
    
    // Check direct machine fields in payload
    if (entry.payload._machine && String(entry.payload._machine).toLowerCase().trim() === nameLower) {
      return true;
    }

    // Scan all payload values for machine name match
    return Object.values(entry.payload).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().trim() === nameLower
    );
  };

  const isMatchForOperator = (entry: ReportEntry, op: Manpower): boolean => {
    const opNameLower = op.name.toLowerCase().trim();
    
    // Check if the operator name is mentioned in any value of the payload
    return Object.values(entry.payload).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().trim() === opNameLower
    );
  };

  // Grouped data computations
  const getMachineWiseReport = () => {
    return machines.map(mac => {
      const prodList = productionRecords.filter(p => p.machine?.name === mac.name);
      const repList = reportEntries.filter(e => isMatchForMachine(e, mac.name));
      
      return {
        machine: mac,
        production: prodList,
        reports: repList,
        hasActivity: prodList.length > 0 || repList.length > 0
      };
    });
  };

  const getOperatorWiseReport = () => {
    return manpower.map(op => {
      const prodList = productionRecords.filter(p => p.operator?.name === op.name);
      const repList = reportEntries.filter(e => isMatchForOperator(e, op));
      
      return {
        operator: op,
        production: prodList,
        reports: repList,
        hasActivity: prodList.length > 0 || repList.length > 0
      };
    });
  };

  const getDepartmentWiseReport = () => {
    return departments.map(dept => {
      const deptManpower = manpower.filter(m => m.department_id === dept.id);
      const deptManpowerNames = deptManpower.map(m => m.name.toLowerCase().trim());
      
      const prodList = productionRecords.filter(p => 
        p.operator?.name && deptManpowerNames.includes(p.operator.name.toLowerCase().trim())
      );
      const repList = reportEntries.filter(e => e.department_id === dept.id);
      
      return {
        department: dept,
        production: prodList,
        reports: repList,
        hasActivity: prodList.length > 0 || repList.length > 0
      };
    });
  };

  // Setup export options
  const getExportData = (): ExportOptions => {
    const isMachine = groupBy === 'machine';
    const isOperator = groupBy === 'operator';
    const groupNameHeader = isMachine ? 'Machine' : isOperator ? 'Operator' : 'Department';

    if (isQualityOnly) {
      // 1. Gather all unique dynamic fields across quality reports
      const uniqueFields = new Set<string>();
      reportEntries.forEach(r => {
        if (r.payload) {
          Object.keys(r.payload).forEach(key => {
            if (!key.startsWith('_')) {
              uniqueFields.add(key);
            }
          });
        }
      });
      const fieldKeys = Array.from(uniqueFields);

      // 2. Build columns
      const columns = [
        { header: groupNameHeader, key: 'groupName' },
        { header: 'Report Type', key: 'type' },
        ...fieldKeys.map(fk => ({ header: fk, key: fk })),
        { header: 'Department', key: 'department' },
        { header: 'Logged By', key: 'loggedBy' }
      ];

      // 3. Build rows
      const rows: Record<string, any>[] = [];
      const activeReportList = groupBy === 'machine' 
        ? getMachineWiseReport() 
        : groupBy === 'operator' 
          ? getOperatorWiseReport() 
          : getDepartmentWiseReport();
          
      activeReportList.forEach(item => {
        if (!item.hasActivity) return;
        
        item.reports.forEach(r => {
          const typeLabel = r.payload._type === 'MAINTENANCE' ? 'Maintenance' : r.format_version?.format?.name || 'QC/Quality';
          const rowObj: Record<string, any> = {
            groupName: isMachine 
              ? (item as any).machine.name 
              : isOperator 
                ? (item as any).operator.name 
                : (item as any).department.name,
            type: `${typeLabel} Report`,
            department: r.department?.name || '',
            loggedBy: r.submitter?.email || ''
          };
          
          fieldKeys.forEach(fk => {
            rowObj[fk] = r.payload[fk] ?? '';
          });
          
          rows.push(rowObj);
        });
      });

      return {
        title: `Daily Quality Report (${groupNameHeader}-wise)`,
        subtitle: `Date: ${reportDate}`,
        filename: `daily_quality_report_${groupBy}_${reportDate}`,
        columns,
        rows
      };
    }

    // Default general Daily Operations Report
    const columns = [
      { header: groupNameHeader, key: 'groupName' },
      { header: 'Type', key: 'type' },
      { header: 'Activity Details', key: 'details' },
      { header: 'Associated Person / Resource', key: 'association' },
      { header: 'Timestamp / By', key: 'metadata' }
    ];

    const rows: Record<string, any>[] = [];

    const activeList = groupBy === 'machine' 
      ? getMachineWiseReport() 
      : groupBy === 'operator' 
        ? getOperatorWiseReport() 
        : getDepartmentWiseReport();

    activeList.forEach(item => {
      if (!item.hasActivity) return;
      
      const groupName = isMachine 
        ? (item as any).machine.name 
        : isOperator 
          ? (item as any).operator.name 
          : (item as any).department.name;

      item.production.forEach(p => {
        const eff = p.target_amount > 0 ? ((p.production_amount / p.target_amount) * 100).toFixed(1) : 'N/A';
        rows.push({
          groupName,
          type: 'Production Record',
          details: `Produced: ${p.production_amount} / Target: ${p.target_amount} (Eff: ${eff}%)`,
          association: isOperator ? `Machine: ${p.machine?.name}` : `Operator: ${p.operator?.name}`,
          metadata: 'Production Log'
        });
      });

      item.reports.forEach(r => {
        const typeLabel = r.payload._type === 'MAINTENANCE' ? 'Maintenance' : r.format_version?.format?.name || 'QC/Quality';
        const detailsStr = Object.entries(r.payload)
          .filter(([key]) => !key.startsWith('_'))
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');

        rows.push({
          groupName,
          type: `${typeLabel} Report`,
          details: detailsStr,
          association: isOperator 
            ? `Dept: ${r.department?.name}` 
            : isMachine 
              ? `Dept: ${r.department?.name}` 
              : `Logged under: ${r.department?.name}`,
          metadata: `Logged by ${r.submitter?.email}`
        });
      });
    });

    return {
      title: `Daily Operations Report (${groupNameHeader}-wise)`,
      subtitle: `Date: ${reportDate}`,
      filename: `daily_report_${groupBy}_${reportDate}`,
      columns,
      rows
    };
  };

  const machineReport = getMachineWiseReport();
  const operatorReport = getOperatorWiseReport();
  const departmentReport = getDepartmentWiseReport();
  const activeReport = groupBy === 'machine' 
    ? machineReport 
    : groupBy === 'operator' 
      ? operatorReport 
      : departmentReport;
  const totalRecordsCount = activeReport.reduce((acc, curr) => acc + (curr.production.length + curr.reports.length), 0);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            {isQualityOnly ? 'Daily Quality Report' : 'Daily Operations Report'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {isQualityOnly 
              ? 'Aggregate list of all Quality and QC inspection entries for a selected day.'
              : 'Aggregate list of all logs, QC quality entries, and production records for a specific day.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-2 shadow-sm text-sm">
            <Calendar className="h-4 w-4 text-text-secondary" />
            <input 
              type="date" 
              value={reportDate} 
              onChange={e => setReportDate(e.target.value)} 
              className="outline-none bg-transparent font-medium text-text-primary" 
            />
          </div>

          {/* Export Bar */}
          <ExportBar 
            loading={loading} 
            opts={getExportData()} 
          />
        </div>
      </div>

      {/* Filter / Toggle Bar */}
      <div className="bg-white p-4 rounded-card border border-border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-surface p-1 rounded-lg border border-border w-full sm:w-auto">
          <button
            onClick={() => setGroupBy('machine')}
            className={clsx(
              "flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
              groupBy === 'machine' 
                ? "bg-white text-primary shadow-sm border border-border" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Factory className="mr-1.5 h-3.5 w-3.5" />
            Machine-wise View
          </button>
          <button
            onClick={() => setGroupBy('operator')}
            className={clsx(
              "flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
              groupBy === 'operator' 
                ? "bg-white text-primary shadow-sm border border-border" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Operator-wise View
          </button>
          <button
            onClick={() => setGroupBy('department')}
            className={clsx(
              "flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
              groupBy === 'department' 
                ? "bg-white text-primary shadow-sm border border-border" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
            Department-wise View
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-text-secondary">
          <button 
            type="button"
            onClick={handleExpandAll}
            className="text-primary hover:underline hover:text-primary-light"
          >
            Expand All
          </button>
          <span className="text-border">|</span>
          <button 
            type="button"
            onClick={handleCollapseAll}
            className="text-primary hover:underline hover:text-primary-light"
          >
            Collapse All
          </button>
          <span className="text-border">|</span>
          <span>
            Found <span className="text-primary font-bold">{totalRecordsCount}</span> total entries
          </span>
        </div>
      </div>

      {/* Report Listing */}
      {loading ? (
        <div className="bg-white p-12 text-center border border-border rounded-card shadow-sm animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/4 mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Generating daily report matrix...</p>
        </div>
      ) : totalRecordsCount === 0 ? (
        <div className="bg-white p-16 text-center border border-border rounded-card shadow-sm flex flex-col items-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-text-primary">No Activity Logged</h3>
          <p className="text-sm text-text-secondary max-w-sm mt-1">
            {isQualityOnly
              ? `There are no quality reports recorded for ${new Date(reportDate).toLocaleDateString()}.`
              : `There are no production records, quality reports, or maintenance logs recorded for ${new Date(reportDate).toLocaleDateString()}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeReport.map(item => {
            if (!item.hasActivity) return null;
            
            const isMachine = groupBy === 'machine';
            const isOperator = groupBy === 'operator';
            const itemId = isMachine 
              ? (item as any).machine.id 
              : isOperator 
                ? (item as any).operator.id 
                : (item as any).department.id;
            const isExpanded = !!expandedIds[itemId];
            const icon = isMachine ? Factory : isOperator ? Users : ClipboardList;
            const titleName = isMachine 
              ? (item as any).machine.name 
              : isOperator 
                ? (item as any).operator.name 
                : (item as any).department.name;
            const subtitleText = isMachine 
              ? `${(item as any).machine.type || 'Loom'} - Location: ${(item as any).machine.location || 'N/A'}`
              : isOperator
                ? `${(item as any).operator.role || 'Operator'}`
                : `Department - active reports/logs`;

            return (
              <div 
                key={itemId}
                className="bg-white rounded-card border border-border shadow-sm overflow-hidden hover:shadow transition-shadow"
              >
                {/* Header (Click to toggle) */}
                <div 
                  onClick={() => toggleExpand(itemId)}
                  className="bg-surface px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-white border border-border text-primary">
                      {React.createElement(icon, { className: "h-5 w-5" })}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{titleName}</h3>
                      <p className="text-xs text-text-secondary">{subtitleText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-border text-text-secondary rounded-full shadow-sm">
                      {item.production.length > 0 && `${item.production.length} production `}
                      {item.reports.length > 0 && `${item.reports.length} quality `}
                      {item.production.length === 0 && item.reports.length === 0 ? 'No entries' : 'entries'}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Body lists - visible only when expanded */}
                {isExpanded && (
                  <div className="divide-y divide-border border-t border-border">
                    {/* Production Records */}
                    {item.production.map(p => {
                      const eff = p.target_amount > 0 ? ((p.production_amount / p.target_amount) * 100).toFixed(1) : null;
                      return (
                        <div key={p.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50/55 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <div>
                              <span className="text-xs font-semibold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 border border-green-200 rounded">
                                Production
                              </span>
                              <span className="ml-3 text-sm font-medium text-text-primary">
                                Produced: <strong className="tabular-nums">{p.production_amount}</strong> / Target: <span className="tabular-nums">{p.target_amount}</span>
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm text-text-secondary self-stretch md:self-auto justify-between border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                            <div>
                              Efficiency: {' '}
                              {eff ? (
                                <span className="font-bold font-mono text-primary tabular-nums">
                                  {eff}%
                                </span>
                              ) : (
                                <span className="text-text-secondary">N/A</span>
                              )}
                            </div>
                            <div className="text-xs italic bg-surface px-2.5 py-1 border border-border rounded">
                              {groupBy === 'machine' 
                                ? `Operator: ${p.operator?.name}` 
                                : groupBy === 'operator' 
                                  ? `Machine: ${p.machine?.name}` 
                                  : `Operator: ${p.operator?.name} | Machine: ${p.machine?.name}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Report entries */}
                    {item.reports.map(r => {
                      const isMaint = r.payload._type === 'MAINTENANCE';
                      const reportLabel = isMaint ? 'Maintenance' : r.format_version?.format?.name || 'Report';
                      const badgeColor = isMaint 
                        ? 'bg-amber-50 text-amber-800 border-amber-200' 
                        : 'bg-blue-50 text-blue-800 border-blue-200';
                      const IconDetail = isMaint ? Wrench : ShieldCheck;

                      return (
                        <div 
                          key={r.id} 
                          onClick={() => navigate(`/data-entry?entryId=${r.id}&returnUrl=${returnUrl}`)}
                          className="p-5 hover:bg-gray-100 cursor-pointer transition-colors space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2.5">
                              {React.createElement(IconDetail, { className: clsx("h-4 w-4", isMaint ? "text-amber-600" : "text-secondary") })}
                              <span className={clsx("text-xs font-semibold uppercase tracking-wider px-2 py-0.5 border rounded", badgeColor)}>
                                {reportLabel}
                              </span>
                              {groupBy !== 'department' && (
                                <span className="text-xs font-medium text-text-secondary">
                                  Dept: {r.department?.name}
                                </span>
                              )}
                            </div>
                            
                            <div className="text-xs text-text-secondary italic">
                              Logged by {r.submitter?.email}
                            </div>
                          </div>

                          {/* Display Payload Keys */}
                          <div className="flex flex-wrap gap-2.5 pt-1.5 pl-6">
                            {(() => {
                              const rendered = new Set<string>();
                              const fields = r.format_version?.fields_schema || [];
                              const list = fields.map(f => {
                                const val = r.payload?.[f.name];
                                if (val === undefined || val === null) return null;
                                rendered.add(f.name);
                                return (
                                  <div 
                                    key={f.name}
                                    className="bg-surface border border-border rounded px-2.5 py-1 text-xs text-text-primary"
                                  >
                                    <span className="font-semibold text-text-secondary uppercase text-[10px] tracking-wider block mb-0.5">
                                      {f.name}{f.unit ? ` (${f.unit})` : ''}
                                    </span>
                                    <span className="font-mono font-medium">{String(val)}</span>
                                  </div>
                                );
                              }).filter(Boolean);

                              const extra = Object.entries(r.payload || {})
                                .filter(([key]) => !key.startsWith('_') && !rendered.has(key))
                                .map(([key, val]) => (
                                  <div 
                                    key={key}
                                    className="bg-surface border border-border rounded px-2.5 py-1 text-xs text-text-primary"
                                  >
                                    <span className="font-semibold text-text-secondary uppercase text-[10px] tracking-wider block mb-0.5">
                                      {key}
                                    </span>
                                    <span className="font-mono font-medium">{String(val)}</span>
                                  </div>
                                ));

                              return [...list, ...extra];
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
